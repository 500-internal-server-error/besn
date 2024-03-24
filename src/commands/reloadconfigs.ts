import { ChatInputApplicationCommandData, ChatInputCommandInteraction, GuildMember } from "discord.js";

import { Logger } from "../logger.js";
import { ICommandHandler } from "../structures.js";
import { ConfigManager } from "../configManager.js";

export class ReloadConfigsCommandHandler implements ICommandHandler {
	private static readonly INSTANCE = new ReloadConfigsCommandHandler();
	private static readonly LOGGER = Logger.get("ReloadConfigCommandHandler");

	private constructor() {}

	public static getInstance() {
		return this.INSTANCE;
	}

	public getSignature(): ChatInputApplicationCommandData {
		return {
			name: "reloadconfigs",
			description: "Reloads all configs"
		};
	}

	public handle(interaction: ChatInputCommandInteraction) {
		const executor = interaction.member as GuildMember;
		const executorGuild = executor.guild;
		ReloadConfigsCommandHandler.LOGGER.log(`${executor.id} requested a reload of configs!`);

		const configString = JSON.stringify(ConfigManager.getConfig(executorGuild.id), null, 4);

		ReloadConfigsCommandHandler.LOGGER.debug(configString);
		ConfigManager.loadConfigs();
		void interaction.reply({ content: "Configs reloaded!", ephemeral: true });
	}
}
