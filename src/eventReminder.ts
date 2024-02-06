import { spawn, spawnSync } from "child_process";
import { Snowflake } from "discord.js";
import { EventEmitter } from "events";
import * as jsonfile from "jsonfile";
import { DateTime } from "luxon";
import * as ns from "node-schedule";

import { Logger } from "./logger";

export type EventReminderConfig = {
	pingRoleId: Snowflake;
}

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

	public static async refreshResources() {
		// Prepare folder to store them in
		// Wait until we are done (sync), before downloading, otherwise they have nowhere to go

		this.LOGGER.log("Preparing resource folder...");
		spawnSync("mkdir -p ./run/resources", { shell: true });

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
			spawn(
				`curl -s -o "./run/resources/stories.json" "https://sekai-world.github.io/sekai-master-db-en-diff/events.json"`,
				{ shell: true }
			),

			spawn(
				`curl -s -o "./run/resources/shows.json" "https://sekai-world.github.io/sekai-master-db-en-diff/virtualLives.json"`,
				{ shell: true }
			)
		]);

		// Afterwards we can setup the scheduler using data from the files we downloaded
		// Reads can be conccurent (async), again we don't need to wait for one to finish reading before reading another
		// But we do again need to wait for all of them to finish

		this.LOGGER.log("Reading resource files...");
		const [stories, shows]: any[][] = (await Promise.allSettled([
			jsonfile.readFile("./run/resources/stories.json"),
			jsonfile.readFile("./run/resources/shows.json"),
		])).map((result) => result.status === "fulfilled" ? result.value : []);

		// We can cancel everything so we start clean

		this.LOGGER.log("Clearing all scheduled events...");
		ns.gracefulShutdown();

		// Get a current time (msecs since Unix Epoch) to measure everything against
		const currentTime = DateTime.utc().toMillis();

		// Find all the stuff that are scheduled to start/end in the future

		// jq '.[] | select(.startAt >= ${DateTime.utc().toMillis()})' ./run/resources/stories.json
		// jq '.[] | select(.endAt >= ${DateTime.utc().toMillis()} and .id < 1000)' ./run/resources/shows.json

		const futureStories = stories.filter((story) => story.startAt >= currentTime);
		// const futureStories = [{id: 10, name: "oohoo", eventType: "yes", startAt: 1707202290000}]
		const futureShows = shows.filter((show) => show.endAt >= currentTime && show.id < 1000);

		for (const futureStory of futureStories) {
			const { id, name, eventType: storyEventType, startAt } = futureStory;

			// Remind 5 mins before start to give time to prepare

			const startAtDate = DateTime.fromMillis(startAt);
			const normalRemindAtDate = startAtDate.minus({ minutes: 5 });
			const now = DateTime.utc();

			this.LOGGER.debug(`Scheduling future story: ${name} (id = ${id}, eventType = ${storyEventType})`);
			this.LOGGER.debug(`  - Starts at: ${startAtDate.toISO()}`);
			this.LOGGER.debug(`  - Normal Remind at: ${normalRemindAtDate.toISO()}`);
			this.LOGGER.debug(`  - Now is: ${now.toISO()}`);

			// If the we passed the start date already, then don't bother reminding

			if (startAtDate < now) {
				this.LOGGER.debug(`  - Start time is in the past, don't bother reminding`);
				continue;
			};

			// Now we know the start date is in the future
			// If the we passed the normal remind date already, then we use the start date, since at least that's in the future
			// Otherwise use the normal prep time

			let actualRemindAtDate;

			if (normalRemindAtDate < now) {
				actualRemindAtDate = startAtDate;
				this.LOGGER.debug(`  - Start time is in the future but normal remind time is in the past, use start time`);
			} else {
				actualRemindAtDate = normalRemindAtDate;
				this.LOGGER.debug(`  - Normal remind time is in the future, use normal remind time`);
			}

			this.LOGGER.debug(`  - Actual Remind at: ${actualRemindAtDate.toISO()}`);

			const job = ns.scheduleJob(name, actualRemindAtDate.toJSDate(), (date) => {
				this.EVENT_EMITTER.emit(EventReminderEvent.StoryStart, name, startAtDate.toSeconds());
				this.LOGGER.log(`Event fired: Story "${name}" released`);
				ns.cancelJob(job);
			});
		}

		for (const futureShow of futureShows) {
			const { id, name, virtualLiveSchedules } = futureShow;

			for (let i = 0, schedule = virtualLiveSchedules[i]; i < virtualLiveSchedules.length; i++) {
				const { startAt } = schedule;

				// Remind 5 mins before start to give time to prepare

				const startAtDate = DateTime.fromMillis(startAt);
				const normalRemindAtDate = startAtDate.minus({ minutes: 5 });
				const now = DateTime.utc();

				this.LOGGER.debug(`Scheduling future show: ${name} #${i + 1} (id = ${id})`);
				this.LOGGER.debug(`  - Starts at: ${startAtDate.toISO()}`);
				this.LOGGER.debug(`  - Normal Remind at: ${normalRemindAtDate.toISO()}`);
				this.LOGGER.debug(`  - Now is: ${now.toISO()}`);

				// If the we passed the start date already, then don't bother reminding

				if (startAtDate < now) {
					this.LOGGER.debug(`  - Start time is in the past, don't bother reminding`);
					continue;
				};

				// Now we know the start date is in the future
				// If the we passed the normal remind date already, then we use the start date, since at least that's in the future
				// Otherwise use the normal prep time

				let actualRemindAtDate;

				if (normalRemindAtDate < now) {
					actualRemindAtDate = startAtDate;
					this.LOGGER.debug(`  - Start time is in the future but normal remind time is in the past, use start time`);
				} else {
					actualRemindAtDate = normalRemindAtDate;
					this.LOGGER.debug(`  - Normal remind time is in the future, use normal remind time`);
				}

				this.LOGGER.debug(`  - Actual Remind at: ${actualRemindAtDate.toISO()}`);

				const job = ns.scheduleJob(`${name} #${i + 1}`, actualRemindAtDate.toJSDate(), (date) => {
					this.EVENT_EMITTER.emit(EventReminderEvent.ShowStart, name, startAtDate.toSeconds());
					this.LOGGER.log(`Event fired: Show "${name}" will start at ${startAtDate.toISO()}`);
					ns.cancelJob(job);
				});
			}
		}
	}

	public static getScheduledEvents() {
		return ns.scheduledJobs;
	}
}
