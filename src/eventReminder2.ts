import { EventEmitter } from "events";
import * as fs from "fs";
import jsonfile from "jsonfile";
import { DateTime } from "luxon";
import * as ns from "node-schedule";
import { AsyncTask, SimpleIntervalJob, ToadScheduler } from "toad-scheduler";

import { Logger } from "./logger2.js";
import { Story, VirtualLive } from "./structures.js";
import { downloadFile, MultipleClassInitializationsError, nameof, UninitializedClassError } from "./util.js";

export const enum EventReminderEvent {
	StoryStart = "storyStart",
	ShowStart = "showStart"
}

export class EventReminder {
	private static LOGGER?: Logger = undefined;

	private static EVENT_EMITTER?: EventEmitter = undefined;
	private static SCHEDULER?: ToadScheduler = undefined;

	private static SCHEDULED_EVENTS?: ns.Job[] = undefined;

	private constructor() {}

	public static async init(logger: Logger) {
		this.setLogger(logger);

		if (this.EVENT_EMITTER) {
			throw new MultipleClassInitializationsError(this.name, nameof(() => this.EVENT_EMITTER));
		}
		this.EVENT_EMITTER = new EventEmitter();

		if (this.SCHEDULER) throw new MultipleClassInitializationsError(this.name, nameof(() => this.SCHEDULER));
		this.SCHEDULER = new ToadScheduler();
		this.SCHEDULER.addSimpleIntervalJob(
			new SimpleIntervalJob(
				{ hours: 1 },
				new AsyncTask(
					"EventReminder: ResourceRefreshJob",
					async () => {
						if (!this.LOGGER) throw new UninitializedClassError(this.name, nameof(() => this.LOGGER));

						this.LOGGER.log("Refreshing resources...");
						await this.refreshResources();
						this.LOGGER.log("Finished refreshing resources");
					}
				)
			)
		);

		if (this.SCHEDULED_EVENTS) {
			throw new MultipleClassInitializationsError(this.name, nameof(() => this.SCHEDULED_EVENTS));
		}
		this.SCHEDULED_EVENTS = [];

		await this.refreshResources();
	}

	/**
	 * Change the {@linkcode Logger} used for future operations
	 *
	 * This method should not be called multiple times. While it is possible, doing so is likely a mistake or a sign of
	 * bad architecture.
	 *
	 * @param logger The {@linkcode Logger} to use for future operations
	 *
	 * @returns None
	 *
	 * @throws Throws {@linkcode MultipleClassInitializationsError} if the class has already been initialized or
	 * partially initialized, either by {@linkcode EventReminder.init} or {@linkcode EventReminder.setLogger}
	 */
	public static setLogger(logger: Logger) {
		if (this.LOGGER) throw new MultipleClassInitializationsError(this.name, nameof(() => this.LOGGER));
		this.LOGGER = logger;
	}

	public static on(
		eventName: EventReminderEvent.StoryStart,
		listener: (name: string, startAt: DateTime) => void | Promise<void>
	): void;

	public static on(
		eventName: EventReminderEvent.ShowStart,
		listener: (name: string, startAt: DateTime) => void | Promise<void>
	): void;

	public static on(eventName: EventReminderEvent, listener: (...args: any[]) => any): void {
		if (!this.EVENT_EMITTER) throw new UninitializedClassError(this.name, nameof(() => this.EVENT_EMITTER));
		this.EVENT_EMITTER.on(eventName, listener);
	}

	public static async refreshResources() {
		if (!this.SCHEDULED_EVENTS) throw new UninitializedClassError(this.name, nameof(() => this.SCHEDULED_EVENTS));
		if (!this.LOGGER) throw new UninitializedClassError(this.name, nameof(() => this.LOGGER));

		// Prepare folder to store them in
		// Wait until we are done (sync), before downloading, otherwise they have nowhere to go

		this.LOGGER.log("Preparing resource folder...");
		fs.mkdirSync("./run/resources/", { recursive: true });

		// Download can be concurrent (async), we don't need to wait for one to finish before starting another
		// But we do need to wait for all of them to finish downloading before we can process them
		// Pre-existing / old files are fine, we just overwrite them

		// Note: Using different terminology to differentiate the things otherwise named similarly
		//  No | PJSK               | Bot
		// ----+--------------------+-----
		//  1. | Event              | Story
		//  2. | Live               | Show
		//  3. | Either event/live  | Event

		this.LOGGER.log("Downloading resources files...");
		await Promise.allSettled([
			downloadFile(
				"https://sekai-world.github.io/sekai-master-db-en-diff/events.json",
				"./run/resources/stories.json"
			),
			downloadFile(
				"https://sekai-world.github.io/sekai-master-db-en-diff/virtualLives.json",
				"./run/resources/shows.json"
			)
		]);

		// Afterwards we can setup the scheduler using data from the files we downloaded

		this.LOGGER.log("Reading resource files...");

		const stories = jsonfile.readFileSync("./run/resources/stories.json", { throws: false }) as Story[] | null ?? [];
		const shows = jsonfile.readFileSync("./run/resources/shows.json", { throws: false }) as VirtualLive[] | null ?? [];

		// We can cancel everything so we start clean

		this.LOGGER.log("Clearing all scheduled events...");
		for (const job of this.SCHEDULED_EVENTS.values()) ns.cancelJob(job);
		this.SCHEDULED_EVENTS.length = 0;

		// Get a current time (msecs since Unix Epoch) to measure everything against
		const currentTime = DateTime.utc().toMillis();

		// Find all the stuff that are scheduled to start/end in the future
		// Note: show.id < 1k to ensure only "real" shows get captured, the game has some shows for every new player,
		// which use id "bands" > 10k, > 20k, etc. Not sure what the lowest "band" is, 1k is probably fine to guarantee
		// it's a "real" show

		const futureStories = stories.filter((story) => story.startAt >= currentTime);
		const futureShows = shows.filter((show) => show.endAt >= currentTime && show.id < 1000);

		this.LOGGER.log("Scheduling future stories...");

		for (const futureStory of futureStories) {
			const { id, name, eventType: storyEventType, startAt } = futureStory;

			// Remind 5 mins before start to give time to prepare

			const startAtDate = DateTime.fromMillis(startAt);
			const normalRemindAtDate = startAtDate.minus({ minutes: 5 });
			const now = DateTime.utc();

			this.LOGGER.debug(`  - Scheduling future story: ${name} (id = ${id}, eventType = ${storyEventType})`);
			this.LOGGER.debug(`    - Starts at: ${startAtDate.toISO()}`);
			this.LOGGER.debug(`    - Normal Remind at: ${normalRemindAtDate.toISO()}`);
			this.LOGGER.debug(`    - Now is: ${now.toISO()}`);

			// If the we passed the start date already, then don't bother reminding

			if (startAtDate < now) {
				this.LOGGER.debug(`  - Start time is in the past, don't bother reminding`);
				continue;
			}

			// Now we know the start date is in the future
			//
			// If the we passed the normal remind date already, then we use the start date,
			// since at least that's in the future
			//
			// Otherwise use the normal prep time

			let actualRemindAtDate;

			if (normalRemindAtDate < now) {
				actualRemindAtDate = startAtDate;
				this.LOGGER.debug(`    - Start time is in the future but normal remind time is in the past, use start time`);
			} else {
				actualRemindAtDate = normalRemindAtDate;
				this.LOGGER.debug(`    - Normal remind time is in the future, use normal remind time`);
			}

			this.LOGGER.debug(`    - Actual Remind at: ${actualRemindAtDate.toISO()}`);

			const job = ns.scheduleJob(`EventReminder: ${name}`, actualRemindAtDate.toJSDate(), () => {
				if (!this.EVENT_EMITTER) {
					throw new UninitializedClassError(this.name, nameof(() => this.EVENT_EMITTER));
				}

				if (!this.LOGGER) {
					throw new UninitializedClassError(this.name, nameof(() => this.LOGGER));
				}

				this.EVENT_EMITTER.emit(EventReminderEvent.StoryStart, name, startAtDate);
				this.LOGGER.log(`Event fired: Story "${name}" released`);
				ns.cancelJob(job);
			});

			this.SCHEDULED_EVENTS.push(job);
		}

		this.LOGGER.log("Scheduling future shows...");

		for (const futureShow of futureShows) {
			const { id, name, virtualLiveSchedules } = futureShow;

			this.LOGGER.debug(`Scheduling future show (outer for loop): { id: ${id}, name: "${name}" }`);

			for (const [i, schedule] of virtualLiveSchedules.entries()) {
				const { startAt } = schedule;

				// Remind 5 mins before start to give time to prepare

				const startAtDate = DateTime.fromMillis(startAt);
				const normalRemindAtDate = startAtDate.minus({ minutes: 5 });
				const now = DateTime.utc();

				this.LOGGER.debug(`  - Scheduling future show: ${name} #${i + 1} (id = ${id})`);
				this.LOGGER.debug(`    - Starts at: ${startAtDate.toISO()}`);
				this.LOGGER.debug(`    - Normal Remind at: ${normalRemindAtDate.toISO()}`);
				this.LOGGER.debug(`    - Now is: ${now.toISO()}`);

				// If the we passed the start date already, then don't bother reminding

				if (startAtDate < now) {
					this.LOGGER.debug(`    - Start time is in the past, don't bother reminding`);
					continue;
				}

				// Now we know the start date is in the future
				//
				// If the we passed the normal remind date already, then we use the start date,
				// since at least that's in the future
				//
				// Otherwise use the normal prep time

				let actualRemindAtDate;

				if (normalRemindAtDate < now) {
					actualRemindAtDate = startAtDate;
					this.LOGGER.debug(
						`    - Start time is in the future but normal remind time is in the past, use start time`
					);
				} else {
					actualRemindAtDate = normalRemindAtDate;
					this.LOGGER.debug(`    - Normal remind time is in the future, use normal remind time`);
				}

				this.LOGGER.debug(`    - Actual Remind at: ${actualRemindAtDate.toISO()}`);

				const job = ns.scheduleJob(`EventReminder: ${name} #${i + 1}`, actualRemindAtDate.toJSDate(), () => {
					if (!this.EVENT_EMITTER) {
						throw new UninitializedClassError(this.name, nameof(() => this.EVENT_EMITTER));
					}

					if (!this.LOGGER) {
						throw new UninitializedClassError(this.name, nameof(() => this.LOGGER));
					}

					this.EVENT_EMITTER.emit(EventReminderEvent.ShowStart, name, startAtDate);
					this.LOGGER.log(`Event fired: Show "${name}" will start at ${startAtDate.toISO()}`);
					ns.cancelJob(job);
				});

				this.SCHEDULED_EVENTS.push(job);
			}
		}
	}

	public static getScheduledEvents() {
		return ns.scheduledJobs;
	}
}
