import { GuildMember, TextChannel } from "discord.js";

import { ServiceLocation } from "./configManager.js";
import { Logger } from "./logger.js";
import { MultipleClassInitializationsError, nameof, UninitializedClassError } from "./util.js";

export class BoostNotifier {
	private static LOGGER?: Logger = undefined;

	private static SERVICE_LOCATIONS?: readonly ServiceLocation[] = undefined;

	private constructor() {}

	public static init(logger: Logger, serviceLocations: readonly ServiceLocation[]) {
		this.setLogger(logger);
		this.setServiceLocations(serviceLocations);
	}

	/**
	 * Change the {@linkcode Logger} used for future operations
	 *
	 * This method should not be called multiple times. While it is possible, doing so is likely a mistake or a sign of
	 * bad architecture.
	 *
	 * @param logger The {@linkcode Logger} to use for future operations
	 *
	 * @returns None
	 *
	 * @throws Throws {@linkcode MultipleClassInitializationsError} if the class has already been initialized or
	 * partially initialized, either by {@linkcode BoostNotifier.init} or {@linkcode BoostNotifier.setLogger}
	 */
	public static setLogger(logger: Logger) {
		if (this.LOGGER) throw new MultipleClassInitializationsError(this.name, nameof(() => this.LOGGER));
		this.LOGGER = logger;
	}

	public static setServiceLocations(serviceLocations: readonly ServiceLocation[]) {
		this.SERVICE_LOCATIONS = serviceLocations;
	}

	public static async handle(oldMember: GuildMember, newMember: GuildMember) {
		if (!this.LOGGER) {
			throw new UninitializedClassError(this.name, nameof(() => this.LOGGER));
		}

		if (!this.SERVICE_LOCATIONS) {
			throw new UninitializedClassError(this.name, nameof(() => this.SERVICE_LOCATIONS));
		}

		for (const serviceLocation of this.SERVICE_LOCATIONS) {
			// Check if the member update was from a location we service, otherwise keep looking
			if (oldMember.guild.id !== serviceLocation.guildId) continue;

			this.LOGGER.debug(`User ${oldMember.id} from guild ${oldMember.guild.id} changed somehow`);

			// The member is in a location we service
			// Check if they gained or lost the role we care about
			// If so, write the appropriate message

			const oldMemberRoles = oldMember.roles.cache;
			const newMemberRoles = newMember.roles.cache;
			const boostRoleId = serviceLocation.modules.boostNotifier.boostRole;

			this.LOGGER.debug(`Previously was:\n${JSON.stringify(oldMember, null, 4)}`);
			this.LOGGER.debug(`Now is:\n${JSON.stringify(newMember, null, 4)}`);

			let message = "";
			if (!oldMemberRoles.has(boostRoleId) && newMemberRoles.has(boostRoleId)) {
				message = `<@${oldMember.id}> started boosting the server! :tada:`;
			} else if (oldMemberRoles.has(boostRoleId) && !newMemberRoles.has(boostRoleId)) {
				message = `<@${oldMember.id}> is no longer boosting the server :broken_heart:`;
			}

			const guild = oldMember.guild;
			const ioChannel = await guild.channels.fetch(serviceLocation.modules.boostNotifier.ioChannelId);

			if (!ioChannel?.isTextBased()) {
				this.LOGGER.warn(
					`Caught nitro (de)boosting action in guild ${guild.id} caused by user ${oldMember.id}`
					+ ` but its configured IO channel ${ioChannel?.id} is not a text channel!`
				);
			} else if (message.length > 0) {
				this.LOGGER.log(message);
				void (ioChannel as TextChannel).send(message);
			}

			// Stop looking if we did stuff
			return;
		}

		this.LOGGER.log(`Something about ${oldMember.id} changed but they're not in a serviced guild!`);
	}
}
