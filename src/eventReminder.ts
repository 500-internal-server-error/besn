import { EventEmitter } from "events";
import * as fs from "fs";
import jsonfile from "jsonfile";
import { DateTime } from "luxon";
import * as ns from "node-schedule";

import { Logger } from "./logger.js";
import { VirtualLive } from "./structures.js";
import * as util from "./util.js";

export const enum EventReminderEvent {
	StoryStart = "storyStart",
	ShowStart = "showStart"
}

export class EventReminder {
	private static readonly LOGGER = Logger.get("EventReminder");
	public static readonly EVENT_EMITTER = new EventEmitter();

	private constructor() {}

	public static async init() {
		await this.refreshResources();
	}

	/* eslint-disable
		@typescript-eslint/no-unsafe-argument,
		@typescript-eslint/no-unsafe-assignment,
		@typescript-eslint/no-unsafe-member-access,
		@typescript-eslint/no-unsafe-return
	*/
	public static async refreshResources() {
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
			util.downloadFile(
				"https://sekai-world.github.io/sekai-master-db-en-diff/events.json",
				"./run/resources/stories.json"
			),
			util.downloadFile(
				"https://sekai-world.github.io/sekai-master-db-en-diff/virtualLives.json",
				"./run/resources/shows.json"
			)
		]);

		// Afterwards we can setup the scheduler using data from the files we downloaded
		// Reads can be conccurent (async), again we don't need to wait for one to finish reading before reading another
		// But we do again need to wait for all of them to finish

		this.LOGGER.log("Reading resource files...");

		// This should be fine, since we have a default value in case the promise was not fulfilled

		// @ts-expect-error
		const [stories, shows]: [any[], VirtualLive[]] = (await Promise.allSettled([
			jsonfile.readFileSync("./run/resources/stories.json"),
			jsonfile.readFileSync("./run/resources/shows.json"),
		])).map((result) => result.status === "fulfilled" ? result.value : []);

		// We can cancel everything so we start clean

		this.LOGGER.log("Clearing all scheduled events...");
		await ns.gracefulShutdown();

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

			const job = ns.scheduleJob(name, actualRemindAtDate.toJSDate(), () => {
				this.EVENT_EMITTER.emit(EventReminderEvent.StoryStart, name, startAtDate.toSeconds());
				this.LOGGER.log(`Event fired: Story "${name}" released`);
				ns.cancelJob(job);
			});
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

				const job = ns.scheduleJob(`${name} #${i + 1}`, actualRemindAtDate.toJSDate(), () => {
					this.EVENT_EMITTER.emit(EventReminderEvent.ShowStart, name, startAtDate.toSeconds());
					this.LOGGER.log(`Event fired: Show "${name}" will start at ${startAtDate.toISO()}`);
					ns.cancelJob(job);
				});
			}
		}
	}
	/* eslint-enable */

	public static getScheduledEvents() {
		return ns.scheduledJobs;
	}
}
