import { Client } from "discord.js";

import { Logger } from "./logger2.js";
import { ICommandHandler, ServiceLocation } from "./structures.js";

export class MasterCommandHandler {
	private readonly logger: Logger;
	private readonly client: Client;

	private readonly serviceLocations: readonly ServiceLocation[];
	private readonly commands: readonly ICommandHandler[];

	public constructor(
		logger: Logger,
		client: Client,
		serviceLocations: readonly ServiceLocation[],
		commandHandlers: readonly ICommandHandler[]
	) {
		this.logger = logger;
		this.client = client;
		this.serviceLocations = serviceLocations;
		this.commands = commandHandlers;
	}

	public async registerCommands() {
		for (const serviceLocation of this.serviceLocations) {
			try {
				// For every guild we plan to serve

				this.logger.debug(`Accessing guild ${serviceLocation.guildId}...`);
				const guild = await this.client.guilds.fetch(serviceLocation.guildId);

				// Start fresh

				this.logger.debug(`Resetting commands for guild ${serviceLocation.guildId}...`);
				await guild.commands.set([]);

				// Add all the commands

				this.logger.debug(`Adding commands for guild ${serviceLocation.guildId}...`);

				for (const commandHandler of this.commands) {
					this.logger.debug(
						`  - Adding command ${commandHandler.getSignature().name} for guild ${serviceLocation.guildId}...`
					);
					void guild.commands.create(commandHandler.getSignature());
				}

				this.logger.debug(`Finished adding commands for guild ${serviceLocation.guildId}`);
			} catch (_e: any) {
				const e = _e as Error;
				this.logger.error(`${e.name}: ${e.message}`);
				this.logger.error(
					`Was processing: { guildId: ${serviceLocation.guildId} , ioChannelId: ${serviceLocation.ioChannelId} }`
				);
			}
		}
	}
}

export abstract class CommandHandler {
	protected readonly logger: Logger;

	public constructor(logger: Logger) {
		this.logger = logger;
	}
}
