import { ChatInputApplicationCommandData, ChatInputCommandInteraction, GuildMember } from "discord.js";

import { ICommandHandler } from "../commandHandler.js";
import { ConfigManager } from "../configManager.js";
import { Logger } from "../logger.js";
import { MultipleClassInitializationsError, nameof, UninitializedClassError } from "../util.js";

export class DumpConfigCommandHandler implements ICommandHandler {
	private static INSTANCE = new DumpConfigCommandHandler();

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
			name: "dumpconfig",
			description: "Dumps the current config"
		};
	}

	public handle(interaction: ChatInputCommandInteraction) {
		if (!DumpConfigCommandHandler.LOGGER) {
			throw new UninitializedClassError(DumpConfigCommandHandler.name, nameof(() => DumpConfigCommandHandler.LOGGER));
		}

		const executor = interaction.member as GuildMember;
		const executorGuild = executor.guild;
		DumpConfigCommandHandler.LOGGER.log(
			`${executor.id} requested a dump of server ${executorGuild.id}'s current config!`
		);

		const configString = JSON.stringify(ConfigManager.getConfig(executorGuild.id), null, 4);

		DumpConfigCommandHandler.LOGGER.debug(configString);
		void interaction.reply({ content: `\`\`\`json\n${configString}\n\`\`\``, ephemeral: true });
	}
}
