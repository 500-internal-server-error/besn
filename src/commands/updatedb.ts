import { ChatInputApplicationCommandData, ChatInputCommandInteraction, GuildMember } from "discord.js";

import { EventReminder } from "../eventReminder.js";
import { ICommandHandler } from "../structures.js";
import { Logger } from "../logger.js";

export class UpdatedbCommandHandler implements ICommandHandler {
	private static readonly INSTANCE = new UpdatedbCommandHandler();
	private static readonly LOGGER = Logger.get("UpdatedbCommandHandler");

	private constructor() {}

	public static getInstance() {
		return this.INSTANCE;
	}

	public getSignature(): ChatInputApplicationCommandData {
		return {
			name: "updatedb",
			description: "Updates the event and virtual live list"
		};
	}

	public async handle(interaction: ChatInputCommandInteraction) {
		const executor = interaction.member as GuildMember;
		UpdatedbCommandHandler.LOGGER.log(`${executor.id} requested event database update!`);

		// This might take a while, so we start it first
		const downloadProgress = EventReminder.refreshResources();

		// This shouldn't take too long, so we can wait it out
		await interaction.reply({
			content: "Updating event and virtual live list...",
			ephemeral: true
		});

		// We probably finish replying faster than we finish downloading, so now we wait out the download
		await downloadProgress;

		// Edit our original reply to signal we finished downloading
		await interaction.followUp({
			content: "Finished updating event and virtual live list",
			ephemeral: true
		});
	}
}
