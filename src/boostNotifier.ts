import { GuildMember, TextChannel } from "discord.js";

import { Logger } from "./logger.js";
import { ServiceLocation } from "./structures.js";

export class BoostNotifier {
	private static readonly LOGGER = Logger.get("BoostNotifier");

	private serviceLocations: readonly ServiceLocation[];

	public constructor(serviceLocations: readonly ServiceLocation[]) {
		this.serviceLocations = serviceLocations;
	}

	public async handle(oldMember: GuildMember, newMember: GuildMember) {
		for (const serviceLocation of this.serviceLocations) {
			// Check if the member update was from a location we service, otherwise keep looking
			if (oldMember.guild.id !== serviceLocation.guildId) continue;

			BoostNotifier.LOGGER.debug(`User ${oldMember.id} from guild ${oldMember.guild.id} changed somehow`);

			// The member is in a location we service
			// Check if they gained or lost the role we care about
			// If so, write the appropriate message

			const oldMemberRoles = oldMember.roles.cache;
			const newMemberRoles = newMember.roles.cache;
			const boostRoleId = serviceLocation.modules.boostNotifier.boostRole;

			BoostNotifier.LOGGER.debug(`Previously had these roles: ${oldMemberRoles.toJSON().toString()}`);
			BoostNotifier.LOGGER.debug(`Now has these roles: ${newMemberRoles.toJSON().toString()}`);

			let message = "";
			let shouldSend = false;
			if (!oldMemberRoles.has(boostRoleId) && newMemberRoles.has(boostRoleId)) {
				message = `<@${oldMember.id}> started boosting the server! :tada:`;
				shouldSend = true;
			} else if (oldMemberRoles.has(boostRoleId) && !newMemberRoles.has(boostRoleId)) {
				message = `<@${oldMember.id}> is no longer boosting the server :broken_heart:`;
				shouldSend = true;
			} else {
				message = `<@${oldMember.id}> changed somehow but not the boost role`;
				shouldSend = false;
			}

			const guild = oldMember.guild;
			const ioChannel = await guild.channels.fetch(serviceLocation.modules.boostNotifier.ioChannelId);

			if (!ioChannel?.isTextBased()) {
				BoostNotifier.LOGGER.warn(
					`Caught nitro (de)boosting action in guild ${guild.id} caused by user ${oldMember.id}`
					+ ` but its configured IO channel ${ioChannel?.id} is not a text channel!`
				);
			} else if (message.length > 0 && shouldSend) {
				BoostNotifier.LOGGER.log(message);
				void (ioChannel as TextChannel).send(message);
			}

			// Stop looking if we did stuff
			return;
		}

		BoostNotifier.LOGGER.log(`Something about ${oldMember.id} changed but they're not in a serviced guild!`);
	}
}
