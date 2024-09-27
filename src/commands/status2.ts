import {
	ApplicationCommandOptionType,
	ChatInputApplicationCommandData,
	ChatInputCommandInteraction,
	EmbedBuilder,
	GuildMember
} from "discord.js";
import { DateTime } from "luxon";

import { CommandHandler } from "../commandHandler2.js";
import { ICommandHandler } from "../structures.js";
import * as util from "../util.js";

export class StatusCommandHandler extends CommandHandler implements ICommandHandler {
	public getSignature(): ChatInputApplicationCommandData {
		return {
			name: "status",
			description: "Queries the bot's status",
			options: [
				{
					name: "gift",
					description: "A gift for me??? UwU",
					type: ApplicationCommandOptionType.Boolean,
					required: false
				}
			]
		};
	}

	public handle(interaction: ChatInputCommandInteraction) {
		const executor = interaction.member as GuildMember;
		this.logger.log(`${executor.id} requested bot status!`);

		const time = `<t:${DateTime.utc().toUnixInteger()}:f>`;
		const happyEmoji = "<:mafuyulilguy:1119765248828780687>";
		const sadEmoji = "<:enajiiempty:1132921144366878730>";

		void interaction.reply({
			embeds: [
				new EmbedBuilder()
					.setColor(util.getRandomColor())
					.setTitle("**Bot Status**")
					.addFields(
						{
							name: "Online",
							value: "Yes! No... Maybe?"
						},
						{
							name: "Time",
							value: `It _was_ ${time}... This ain't instant messaging, though!`
						},
						{
							name: "Emotion",
							value: (interaction.options.getBoolean("gift") ? `OMG GIFT!!! ${happyEmoji}` : sadEmoji)
						}
					)
			],
			ephemeral: true
		});
	}
}
