import {
	ApplicationCommandOptionType,
	ChatInputApplicationCommandData,
	ChatInputCommandInteraction,
	EmbedBuilder,
	GuildMember
} from "discord.js";
import { DateTime } from "luxon";

import { Logger } from "../logger.js";
import { ICommandHandler } from "../structures.js";
import * as Util from "../util.js";

export class StatusCommandHandler implements ICommandHandler {
	private static readonly INSTANCE = new StatusCommandHandler();
	private static readonly LOGGER = Logger.get("StatusCommandHandler");

	private constructor() {}

	public static getInstance() {
		return this.INSTANCE;
	}

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

	public async handle(interaction: ChatInputCommandInteraction) {
		const executor = interaction.member as GuildMember;
		StatusCommandHandler.LOGGER.log(`${executor.id} requested bot status!`);

		const time = `<t:${DateTime.utc().toUnixInteger()}:f>`;
		const happyEmoji = "<:mafuyulilguy:1119765248828780687>";
		const sadEmoji = "<:enajiiempty:1132921144366878730>";

		await interaction.reply({
			embeds: [
				new EmbedBuilder()
					.setColor(Util.getRandomColor())
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
