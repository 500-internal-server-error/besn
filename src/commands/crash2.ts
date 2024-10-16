import { ChatInputApplicationCommandData, ChatInputCommandInteraction, GuildMember } from "discord.js";

import { ConfigManager } from "../configManager3.js";
import { Logger } from "../logger2.js";
import { ICommandHandler } from "../structures.js";
import { MultipleClassInitializationsError, nameof, UninitializedClassError } from "../util.js";

export class CrashCommandHandler implements ICommandHandler {
	private static INSTANCE = new CrashCommandHandler();

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
	 * partially initialized, either by {@linkcode CrashCommandHandler.init} or
	 * {@linkcode CrashCommandHandler.setLogger}
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
			name: "crash",
			description: "Can they not shut down the bot more gently??? 😭"
		};
	}

	public handle(interaction: ChatInputCommandInteraction) {
		if (!CrashCommandHandler.LOGGER) {
			throw new UninitializedClassError(CrashCommandHandler.name, nameof(() => CrashCommandHandler.LOGGER));
		}

		const executor = interaction.member as GuildMember;
		CrashCommandHandler.LOGGER.log(`${executor.id} requested a shutdown!`);

		// TODO: Get the ConfigManager implemented properly
		if (executor.id !== ConfigManager.getGlobalConfig().ownerId) {
			CrashCommandHandler.LOGGER.log(
				`${executor.id} tried to issue commands without having the appropriate permission!`
			);

			void interaction.reply(
				{
					content: ":sparkles:     :innocent: :thumbsdown:     :sparkles:",
					ephemeral: true
				}
			);

			return;
		}

		// Should probably find a better way to shutdown
		// eslint-disable-next-line @typescript-eslint/only-throw-error
		throw "Shutdown Request";
	}
}
