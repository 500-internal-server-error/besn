import { ChatInputCommandInteraction, Client, GuildMember } from "discord.js";

import { Logger } from "./logger";
import { ConfigFile, ICommandHandler } from "./structures";

export class MasterCommandHandler {
	private static readonly LOGGER = Logger.get("MasterCommandHandler");

	private client: Client;
	private config: ConfigFile;
	private commands: ICommandHandler[];

	public constructor(client: Client, config: ConfigFile, commands?: ICommandHandler[]) {
		this.client = client;
		this.config = config;
		this.commands = commands ?? [];
	}

	public async registerCommands(commands?: ICommandHandler[]) {
		// If we were passed a new array of commands then we use that
		this.commands = commands ?? this.commands;

		for (const serviceLocation of this.config.serviceLocationWhitelist) {
			try {
				// For every guild we plan to serve
				const guild = await this.client.guilds.fetch(serviceLocation.guildId);

				// Start fresh
				await guild.commands.set([]);

				// Add all the commands
				for (const command of this.commands) {
					guild.commands.create(command.getSignature());
				}
			} catch (e: any) {
				MasterCommandHandler.LOGGER.error(`${e.name}: ${e.message}`);
				MasterCommandHandler.LOGGER.error(`Was processing: { guildId: ${serviceLocation.guildId} , ioChannelId: ${serviceLocation.ioChannelId} }`);
			}
		}
	}

	public async deleteCommands() {
		this.commands = [];

		for (const serviceLocation of this.config.serviceLocationWhitelist) {
			try {
				const guild = await this.client.guilds.fetch(serviceLocation.guildId);

				guild.commands.set([]);
			} catch (e: any) {
				MasterCommandHandler.LOGGER.error(`${e.name}: ${e.message}`);
				MasterCommandHandler.LOGGER.error(`Was processing: { guildId: ${serviceLocation.guildId} , ioChannelId: ${serviceLocation.ioChannelId} }`);
			}
		}
	}

	public async handle(interaction: ChatInputCommandInteraction) {
		const executor = interaction.member as GuildMember;
		const executorGuild = interaction.guild;

		// Check if the interaction was issued from a location we service

		const requiredGuild = this.config.serviceLocationWhitelist.filter(
			(serviceLocation) => serviceLocation.guildId === executorGuild?.id
		);

		if (requiredGuild.length <= 0) {
			MasterCommandHandler.LOGGER.log(`${executor.id} tried to issue commands without being in a serviced guild!`);

			interaction.reply(
				{
					content: ":sparkles:     :innocent: :thumbsdown:     :sparkles:",
					ephemeral: true
				}
			);

			return;
		}

		// Check if the command executor has at least one of the roles allowed to use the bot

		const executorRoles = executor.roles;
		const authorizedRoles = requiredGuild[0].commandAccessRoleIds;

		if (!executorRoles.cache.hasAny(...authorizedRoles)) {
			MasterCommandHandler.LOGGER.log(`${executor.id} tried to issue commands without having the appropriate permission!`);

			interaction.reply(
				{
					content: ":sparkles:     :innocent: :thumbsdown:     :sparkles:",
					ephemeral: true
				}
			);

			return;
		}

		// `interaction.command` shouldn't be null since the param is already a ChatInputCommandInteraction,
		// but apparently ts doesn't know that

		const executorCommand = interaction.command?.name;

		for (const command of this.commands) {
			if (command.getSignature().name === executorCommand) {
				command.handle(interaction);
				break;
			}
		}
	}
}
