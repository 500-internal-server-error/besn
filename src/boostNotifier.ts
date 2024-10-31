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

			// The member is in a location we service
			// Check if they gained or lost the role we care about
			// If so, write the appropriate message

			const oldMemberRoles = oldMember.roles.cache;
			const newMemberRoles = newMember.roles.cache;
			const boostRoleId = serviceLocation.modules.boostNotifier.boostRole;

			let message: string | undefined;
			let ioChannelId: string | undefined;
			if (!oldMemberRoles.has(boostRoleId) && newMemberRoles.has(boostRoleId)) {
				const { userKey, formatMessage } = serviceLocation.modules.boostNotifier.boostMessage;
				message = formatMessage.replaceAll(userKey, oldMember.id);

				const configIoChannelId = serviceLocation.modules.boostNotifier.ioChannelId;
				ioChannelId = typeof configIoChannelId === "string" ? configIoChannelId : configIoChannelId.boost;
			} else if (oldMemberRoles.has(boostRoleId) && !newMemberRoles.has(boostRoleId)) {
				const { userKey, formatMessage } = serviceLocation.modules.boostNotifier.deboostMessage;
				message = formatMessage.replaceAll(userKey, oldMember.id);

				const configIoChannelId = serviceLocation.modules.boostNotifier.ioChannelId;
				ioChannelId = typeof configIoChannelId === "string" ? configIoChannelId : configIoChannelId.deboost;
			}

			// If message and/or ioChannelId is still empty it means something changed, but is uninteresting to us
			if (!message || !ioChannelId) return;

			const guild = oldMember.guild;
			const ioChannel = await guild.channels.fetch(ioChannelId);

			if (!ioChannel?.isTextBased()) {
				this.LOGGER.warn(
					`Caught nitro (de)boosting action in guild ${guild.id} caused by user ${oldMember.id}`
					+ ` but its configured IO channel ${ioChannel?.id} is not a text channel!`
				);
			}

			this.LOGGER.log(message);
			void (ioChannel as TextChannel).send(message);

			// Stop looking if we did stuff
			return;
		}

		this.LOGGER.log(`Something about ${oldMember.id} changed but they're not in a serviced guild!`);
	}
}
