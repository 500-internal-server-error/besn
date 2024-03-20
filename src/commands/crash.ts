import { ChatInputApplicationCommandData, ChatInputCommandInteraction, GuildMember } from "discord.js";

import { Logger } from "../logger.js";
import { ICommandHandler } from "../structures.js";

export class CrashCommandHandler implements ICommandHandler {
	private static readonly INSTANCE = new CrashCommandHandler();
	private static readonly LOGGER = Logger.get("CrashCommandHandler");

	private constructor() {}

	public static getInstance() {
		return this.INSTANCE;
	}

	public getSignature(): ChatInputApplicationCommandData {
		return {
			name: "crash",
			description: "Can they not shut down the bot more gently??? 😭"
		};
	}

	public async handle(interaction: ChatInputCommandInteraction) {
		const executor = interaction.member as GuildMember;
		CrashCommandHandler.LOGGER.log(`${executor.id} requested a shutdown!`);

		// TODO: Get the ConfigManager implemented properly
		if (executor.id !== "503050029078937610") {
			CrashCommandHandler.LOGGER.log(`${executor.id} tried to issue commands without having the appropriate permission!`);

			interaction.reply(
				{
					content: ":sparkles:     :innocent: :thumbsdown:     :sparkles:",
					ephemeral: true
				}
			);

			return;
		}

		// Should probably find a better way to shutdown
		throw "Shutdown Request";
	}
}
