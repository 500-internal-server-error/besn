import { ChatInputApplicationCommandData, ChatInputCommandInteraction, GuildMember } from "discord.js";
import { DateTime } from "luxon";

import { EventReminder } from "../eventReminder.js";
import { Logger } from "../logger2.js";
import { ICommandHandler } from "../structures.js";
import { MultipleClassInitializationsError, nameof, UninitializedClassError } from "../util.js";

export class ListEventsCommandHandler implements ICommandHandler {
	private static INSTANCE = new ListEventsCommandHandler();

	private static LOGGER?: Logger = undefined;

	private constructor() {}

	public static init(logger: Logger) {
		this.setLogger(logger);
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
	 * partially initialized, either by {@linkcode ListEventsCommandHandler.init} or
	 * {@linkcode ListEventsCommandHandler.setLogger}
	 */
	public static setLogger(logger: Logger) {
		if (this.LOGGER) throw new MultipleClassInitializationsError(this.name, nameof(() => this.LOGGER));
		this.LOGGER = logger;
	}

	public static getInstance() {
		return this.INSTANCE;
	}

	public getSignature(): ChatInputApplicationCommandData {
		return {
			name: "listevents",
			description: "List all the scheduled events"
		};
	}

	public async handle(interaction: ChatInputCommandInteraction) {
		if (!ListEventsCommandHandler.LOGGER) {
			throw new UninitializedClassError(
				ListEventsCommandHandler.name,
				nameof(() => ListEventsCommandHandler.LOGGER)
			);
		}

		const executor = interaction.member as GuildMember;
		ListEventsCommandHandler.LOGGER.log(`${executor.id} requested a list of scheduled events!`);

		ListEventsCommandHandler.LOGGER.debug("Enumerating scheduled events...");

		const replies: string[] = [];
		let currentReplyMessageLength = 0;
		let replyMessageCount = 0;

		let reply = `# Scheduled Events (page ${replyMessageCount + 1})\n`;

		const futureEvents = EventReminder.getScheduledEvents();

		for (const [jobName, job] of Object.entries(futureEvents)) {
			// For some reason it doesn't work with JS Date, but it does with ISO string

			const eventName = jobName;
			const eventRemindAtTime = DateTime.fromISO(job.nextInvocation()?.toISOString());

			ListEventsCommandHandler.LOGGER.debug(`Found event "${eventName}":`);
			ListEventsCommandHandler.LOGGER.debug(`  - job.nextInvocation() = ${job.nextInvocation().toISOString()}`);
			ListEventsCommandHandler.LOGGER.debug(`  - eventRemindAtTime = ${eventRemindAtTime.toISO()}`);

			reply += `- ${eventName} at `;
			reply += `<t:${eventRemindAtTime.toSeconds()}:f> / <t:${eventRemindAtTime.toSeconds()}:R>\n`;
			currentReplyMessageLength++;

			if (currentReplyMessageLength > 20) {
				replies.push(reply);
				currentReplyMessageLength = 0;
				replyMessageCount++;
				reply = `# Scheduled Events (page ${replyMessageCount + 1})\n`;
			}
		}

		replies.push(reply);

		ListEventsCommandHandler.LOGGER.debug("Finished enumerating scheduled events");

		await interaction.reply({ content: replies[0], ephemeral: true });
		for (let i = 1; i < replies.length; i++) {
			await interaction.followUp({ content: replies[i], ephemeral: true });
		}
	}
}
