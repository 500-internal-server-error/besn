import { ChatInputApplicationCommandData, ChatInputCommandInteraction, GuildMember } from "discord.js";
import { DateTime } from "luxon";

import { EventReminder } from "../eventReminder";
import { Logger } from "../logger";
import { ICommandHandler } from "../structures";

export class ListEventsCommandHandler implements ICommandHandler {
	private static readonly INSTANCE = new ListEventsCommandHandler();
	private static readonly LOGGER = Logger.get("ListEventsCommandHandler");

	private constructor() {}

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
			ListEventsCommandHandler.LOGGER.debug(`  - job.nextInvocation() = ${job.nextInvocation()}`);
			ListEventsCommandHandler.LOGGER.debug(`  - eventRemindAtTime = ${eventRemindAtTime}`);
			ListEventsCommandHandler.LOGGER.debug(`  - eventRemindAtTime.toISO() = ${eventRemindAtTime.toISO()}`);
			ListEventsCommandHandler.LOGGER.debug(`  - eventRemindAtTime.toSeconds() = ${eventRemindAtTime.toSeconds()}`);

			reply += `- ${eventName} at <t:${eventRemindAtTime.toSeconds()}:f> / <t:${eventRemindAtTime.toSeconds()}:R>\n`;
			currentReplyMessageLength++;

			if (currentReplyMessageLength > 20) {
				replies.push(reply);
				currentReplyMessageLength = 0;
				replyMessageCount++;
				reply = `# Scheduled Events (page ${replyMessageCount + 1})\n`;
			}
		}

		ListEventsCommandHandler.LOGGER.debug("Finished enumerating scheduled events");

		await interaction.reply({ content: replies[0] ?? reply, ephemeral: true });
		for (let i = 1; i < replies.length; i++) {
			await interaction.followUp({ content: replies[i], ephemeral: true });
		}
	}
}
