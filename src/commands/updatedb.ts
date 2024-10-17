import { ChatInputApplicationCommandData, ChatInputCommandInteraction, GuildMember } from "discord.js";

import { EventReminder } from "../eventReminder.js";
import { Logger } from "../logger.js";
import { ICommandHandler } from "../structures.js";
import { MultipleClassInitializationsError, nameof, UninitializedClassError } from "../util.js";

export class UpdateDbCommandHandler implements ICommandHandler {
	private static INSTANCE = new UpdateDbCommandHandler();

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
	 * partially initialized, either by {@linkcode UpdateDbCommandHandler.init} or
	 * {@linkcode UpdateDbCommandHandler.setLogger}
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
			name: "updatedb",
			description: "Updates the event and virtual live list"
		};
	}

	public async handle(interaction: ChatInputCommandInteraction) {
		if (!UpdateDbCommandHandler.LOGGER) {
			throw new UninitializedClassError(
				UpdateDbCommandHandler.name,
				nameof(() => UpdateDbCommandHandler.LOGGER)
			);
		}

		const executor = interaction.member as GuildMember;
		UpdateDbCommandHandler.LOGGER.log(`${executor.id} requested event database update!`);

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
