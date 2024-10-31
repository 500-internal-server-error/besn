import { ChatInputApplicationCommandData, ChatInputCommandInteraction, Client, GuildMember } from "discord.js";

import { ServiceLocation } from "./configManager.js";
import { Logger } from "./logger.js";
import { MultipleClassInitializationsError, nameof, UninitializedClassError, UninitializedDependencyError } from "./util.js";

export interface ICommandHandler {
	getSignature(): ChatInputApplicationCommandData;
	handle(interaction: ChatInputCommandInteraction): Promise<void> | void;
}

export class MasterCommandHandler {
	private static LOGGER?: Logger = undefined;

	private static CLIENT?: Client = undefined;
	private static SERVICE_LOCATIONS?: readonly ServiceLocation[] = undefined;
	private static COMMAND_HANDLERS?: readonly ICommandHandler[] = undefined;

	private constructor() {}

	public static init(
		logger: Logger,
		client: Client,
		serviceLocations: readonly ServiceLocation[],
		commandHandlers: readonly ICommandHandler[]
	) {
		this.setLogger(logger);
		this.setClient(client);
		this.setServiceLocations(serviceLocations);
		this.setCommandHandlers(commandHandlers);
	}

	public static setLogger(logger: Logger) {
		if (this.LOGGER) throw new MultipleClassInitializationsError(this.name, nameof(() => this.LOGGER));
		this.LOGGER = logger;
	}

	public static setClient(client: Client) {
		if (this.CLIENT) throw new MultipleClassInitializationsError(this.name, nameof(() => this.CLIENT));
		this.CLIENT = client;
	}

	public static setServiceLocations(serviceLocations: readonly ServiceLocation[]) {
		this.SERVICE_LOCATIONS = serviceLocations;
	}

	public static setCommandHandlers(commandHandlers: readonly ICommandHandler[]) {
		if (this.COMMAND_HANDLERS) {
			throw new MultipleClassInitializationsError(this.name, nameof(() => this.COMMAND_HANDLERS));
		}

		this.COMMAND_HANDLERS = commandHandlers;
	}

	public static async registerCommands() {
		if (!this.SERVICE_LOCATIONS) throw new UninitializedClassError(this.name, nameof(() => this.SERVICE_LOCATIONS));
		if (!this.COMMAND_HANDLERS) throw new UninitializedClassError(this.name, nameof(() => this.COMMAND_HANDLERS));
		if (!this.CLIENT) throw new UninitializedClassError(this.name, nameof(() => this.CLIENT));
		if (!this.CLIENT.isReady()) throw new UninitializedDependencyError(nameof(() => this.CLIENT));
		if (!this.LOGGER) throw new UninitializedClassError(this.name, nameof(() => this.LOGGER));

		void this.CLIENT.application.commands.set([]);

		for (const serviceLocation of this.SERVICE_LOCATIONS) {
			try {
				// For every guild we plan to serve

				this.LOGGER.debug(`Accessing guild ${serviceLocation.guildId}...`);
				const guild = await this.CLIENT.guilds.fetch(serviceLocation.guildId);

				// Start fresh

				this.LOGGER.debug(`Resetting commands for guild ${serviceLocation.guildId}...`);
				await guild.commands.set([]);

				// Add all the commands

				this.LOGGER.debug(`Adding commands for guild ${serviceLocation.guildId}...`);

				for (const commandHandler of this.COMMAND_HANDLERS) {
					this.LOGGER.debug(
						`  - Adding command ${commandHandler.getSignature().name} for guild ${serviceLocation.guildId}...`
					);
					void guild.commands.create(commandHandler.getSignature());
				}

				this.LOGGER.debug(`Finished adding commands for guild ${serviceLocation.guildId}`);
			} catch (e) {
				if (!(e instanceof Error)) throw e;

				this.LOGGER.error(`${e.name}: ${e.message}`);
				this.LOGGER.error(
					`Was processing:\n`
					+ `  - guildId: ${serviceLocation.guildId}\n`
					+ `  - ioChannelId: ${serviceLocation.primaryIoChannelId}`
				);
			}
		}
	}

	public static async deleteCommands() {
		if (!this.SERVICE_LOCATIONS) throw new UninitializedClassError(this.name, nameof(() => this.SERVICE_LOCATIONS));
		if (!this.CLIENT) throw new UninitializedClassError(this.name, nameof(() => this.CLIENT));
		if (!this.CLIENT.isReady()) throw new UninitializedDependencyError(nameof(() => this.CLIENT));
		if (!this.LOGGER) throw new UninitializedClassError(this.name, nameof(() => this.LOGGER));

		for (const serviceLocation of this.SERVICE_LOCATIONS) {
			try {
				// For every guild we serve

				this.LOGGER.debug(`Accessing guild ${serviceLocation.guildId}...`);
				const guild = await this.CLIENT.guilds.fetch(serviceLocation.guildId);

				// Delete everything

				this.LOGGER.debug(`Resetting commands for guild ${serviceLocation.guildId}...`);
				void guild.commands.set([]);
			} catch (e) {
				if (!(e instanceof Error)) throw e;

				this.LOGGER.error(`${e.name}: ${e.message}`);
				this.LOGGER.error(
					`Was processing:\n`
					+ `  - guildId: ${serviceLocation.guildId}\n`
					+ `  - ioChannelId: ${serviceLocation.primaryIoChannelId}`
				);
			}
		}
	}

	public static handle(interaction: ChatInputCommandInteraction) {
		if (!this.LOGGER) throw new UninitializedClassError(this.name, nameof(() => this.LOGGER));
		if (!this.SERVICE_LOCATIONS) throw new UninitializedClassError(this.name, nameof(() => this.SERVICE_LOCATIONS));
		if (!this.COMMAND_HANDLERS) throw new UninitializedClassError(this.name, nameof(() => this.COMMAND_HANDLERS));

		const executor = interaction.member as GuildMember;
		const executorGuild = interaction.guild;

		// Check if the interaction came from a location we service

		const requiredGuild = this.SERVICE_LOCATIONS.filter(
			(serviceLocation) => serviceLocation.guildId === executorGuild?.id
		);

		if (requiredGuild.length <= 0) {
			this.LOGGER.log(`${executor.id} tried to issue commands without being in a serviced guild!`);

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
			this.LOGGER.log(`${executor.id} tried to issue commands without having the appropriate permission!`);

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

		for (const command of this.COMMAND_HANDLERS) {
			if (command.getSignature().name === executorCommand) {
				void command.handle(interaction);
				break;
			}
		}
	}
}
