import { ChatInputApplicationCommandData, ChatInputCommandInteraction, GuildMember } from "discord.js";

import { Logger } from "../logger";
import { ICommandHandler } from "../structures";
import { ConfigManager } from "../configManager";

export class DumpConfigCommandHandler implements ICommandHandler {
	private static readonly INSTANCE = new DumpConfigCommandHandler();
	private static readonly LOGGER = Logger.get("DumpConfigCommandHandler");

	private constructor() {}

	public static getInstance() {
		return this.INSTANCE;
	}

	public getSignature(): ChatInputApplicationCommandData {
		return {
			name: "dumpconfig",
			description: "Dumps the current config"
		};
	}

	public async handle(interaction: ChatInputCommandInteraction) {
		const executor = interaction.member as GuildMember;
		const executorGuild = executor.guild;
		DumpConfigCommandHandler.LOGGER.log(`${executor.id} requested a dump of server ${executorGuild.id}'s current config!`);

		const configString = JSON.stringify(ConfigManager.getConfig(executorGuild.id), null, 4);

		DumpConfigCommandHandler.LOGGER.debug(configString);
		interaction.reply({ content: `\`\`\`json\n${configString}\n\`\`\``, ephemeral: true });
	}
}
