import { ChatInputApplicationCommandData, ChatInputCommandInteraction, GuildMember } from "discord.js";

import { Logger } from "../logger";
import { ICommandHandler } from "../structures";
import { ConfigManager } from "../configManager";

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

	public async handle(interaction: ChatInputCommandInteraction) {
		const executor = interaction.member as GuildMember;
		const executorGuild = executor.guild;
		ReloadConfigsCommandHandler.LOGGER.log(`${executor.id} requested a reload of configs!`);

		const configString = JSON.stringify(ConfigManager.getConfig(executorGuild.id), null, 4);

		ReloadConfigsCommandHandler.LOGGER.debug(configString);
		ConfigManager.loadConfigs();
		interaction.reply({ content: "Configs reloaded!", ephemeral: true });
	}
}
