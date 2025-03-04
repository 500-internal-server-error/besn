import { ChatInputApplicationCommandData, ChatInputCommandInteraction, GuildMember } from "discord.js";

import { ICommandHandler } from "../commandHandler.js";
import { ConfigManager } from "../configManager.js";
import { Logger } from "../logger.js";
import { MultipleClassInitializationsError, nameof, UninitializedClassError } from "../util.js";

export class ReloadConfigsCommandHandler implements ICommandHandler {
	private static INSTANCE = new ReloadConfigsCommandHandler();

	private static LOGGER?: Logger = undefined;

	private constructor() {}

	public static init(logger: Logger) {
		this.setLogger(logger);
	}

	public static setLogger(logger: Logger) {
		if (this.LOGGER) throw new MultipleClassInitializationsError(this.name, nameof(() => this.LOGGER));
		this.LOGGER = logger;
	}

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
		if (!ReloadConfigsCommandHandler.LOGGER) {
			throw new UninitializedClassError(
				ReloadConfigsCommandHandler.name,
				nameof(() => ReloadConfigsCommandHandler.LOGGER)
			);
		}

		const executor = interaction.member as GuildMember;
		const executorGuild = executor.guild;
		ReloadConfigsCommandHandler.LOGGER.log(`${executor.id} requested a reload of configs!`);

		const configString = JSON.stringify(ConfigManager.getConfig(executorGuild.id), null, 4);

		ReloadConfigsCommandHandler.LOGGER.debug(configString);
		const configsLoadResult = ConfigManager.loadConfigs("./run/configs"); // TODO: do not hardcode paths
		if (!(configsLoadResult instanceof Error)) ConfigManager.setConfigs(configsLoadResult[0]);
		void interaction.reply({ content: "Configs reloaded!", ephemeral: true });
	}
}
