import { ChatInputCommandInteraction, Client, GuildMember } from "discord.js";

import { Logger } from "./logger.js";
import { ICommandHandler, ServiceLocation } from "./structures.js";

export class MasterCommandHandler {
	private static readonly LOGGER = Logger.get("MasterCommandHandler");

	private client: Client;
	private serviceLocations: readonly ServiceLocation[];
	private commands: ICommandHandler[];

	public constructor(client: Client, serviceLocations: readonly ServiceLocation[], commands?: ICommandHandler[]) {
		this.client = client;
		this.serviceLocations = serviceLocations;
		this.commands = commands ?? [];
	}

	public async registerCommands() {
		for (const serviceLocation of this.serviceLocations) {
			try {
				// For every guild we plan to serve

				MasterCommandHandler.LOGGER.debug(`Accessing guild ${serviceLocation.guildId}...`);
				const guild = await this.client.guilds.fetch(serviceLocation.guildId);

				// Start fresh

				MasterCommandHandler.LOGGER.debug(`Resetting commands for guild ${serviceLocation.guildId}...`);
				await guild.commands.set([]);

				// Add all the commands

				MasterCommandHandler.LOGGER.debug(`Adding commands for guild ${serviceLocation.guildId}...`);

				for (const command of this.commands) {
					MasterCommandHandler.LOGGER.debug(
						`  - Adding command ${command.getSignature().name} for guild ${serviceLocation.guildId}...`
					);
					void guild.commands.create(command.getSignature());
				}

				MasterCommandHandler.LOGGER.debug(`Finished adding commands for guild ${serviceLocation.guildId}`);
			} catch (_e: any) {
				const e = _e as Error;
				MasterCommandHandler.LOGGER.error(`${e.name}: ${e.message}`);
				MasterCommandHandler.LOGGER.error(
					`Was processing: { guildId: ${serviceLocation.guildId} , ioChannelId: ${serviceLocation.ioChannelId} }`
				);
			}
		}
	}

	public async deleteCommands() {
		this.commands = [];

		for (const serviceLocation of this.serviceLocations) {
			try {
				const guild = await this.client.guilds.fetch(serviceLocation.guildId);

				void guild.commands.set([]);
			} catch (_e: any) {
				const e = _e as Error;
				MasterCommandHandler.LOGGER.error(`${e.name}: ${e.message}`);
				MasterCommandHandler.LOGGER.error(
					`Was processing: { guildId: ${serviceLocation.guildId} , ioChannelId: ${serviceLocation.ioChannelId} }`
				);
			}
		}
	}

	public handle(interaction: ChatInputCommandInteraction) {
		const executor = interaction.member as GuildMember;
		const executorGuild = interaction.guild;

		// Check if the interaction was issued from a location we service

		const requiredGuild = this.serviceLocations.filter(
			(serviceLocation) => serviceLocation.guildId === executorGuild?.id
		);

		if (requiredGuild.length <= 0) {
			MasterCommandHandler.LOGGER.log(`${executor.id} tried to issue commands without being in a serviced guild!`);

			void interaction.reply(
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
			MasterCommandHandler.LOGGER.log(
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

		// `interaction.command` shouldn't be null since the param is already a ChatInputCommandInteraction,
		// but apparently ts doesn't know that

		const executorCommand = interaction.command?.name;

		for (const command of this.commands) {
			if (command.getSignature().name === executorCommand) {
				void command.handle(interaction);
				break;
			}
		}
	}
}
