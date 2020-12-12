import type { IPluginInterface } from "../types/plugins";
import type { Room } from "../rooms";
import type { IClientMessageTypes } from "../types/client";
import type { CommandDefinitions } from "../types/command-parser";
import type { CommandContext } from "../command-parser";

/* eslint-disable @typescript-eslint/explicit-function-return-type, @typescript-eslint/explicit-module-boundary-types */

export const commands: CommandDefinitions<CommandContext> = {
	forceleaveroom: {
		command(target, room, user) {
			/* if (this.isPm(room)) {
				if (!target) return this.say(`Please provide a room name. Syntax: \`\`${Config.commandCharacter}forceleaveroom [room]\`\``);
				if (!Config.rooms || !Config.rooms.length) return;
				const rooms = Config.rooms.map(Tools.toRoomId);
				if (!rooms.includes(Tools.toRoomId(target))) {
					return this.say(`Please provide a room that ${Config.username} is in.`);
				}
				const usedRoom = Rooms.get(Tools.toRoomId(target)) as Room;
				if (!user.canPerform(usedRoom, 'roomowner')) return this.say('Access denied.');
				usedRoom.say(`/leave`);
				this.say('Done.');
				return;
			} else {
				if (!user.canPerform(room, 'roomowner')) return;
				this.say('Adios!');
				this.say('/leave');
				return;
			} */
			if (this.isPm(room) || !user.canPerform(room, 'roomowner')) return;
			this.say('Adios!');
			this.say('/leave');
			return;
		},
	},
};

/* eslint-enable @typescript-eslint/explicit-function-return-type,@typescript-eslint/no-unused-vars*/

export class Module implements IPluginInterface {
	name: string = "Replay Monitor";

	parseMessage(room: Room, messageType: keyof IClientMessageTypes, messageParts: string[]): true | undefined {
		switch (messageType) {
			case 'chat':
			case 'c':
			case 'c:': {
				let messageArguments: IClientMessageTypes['chat'];
				if (messageType === 'c:') {
					messageArguments = {
						timestamp: (parseInt(messageParts[0]) + Client.serverTimeOffset) * 1000,
						rank: messageParts[1].charAt(0),
						username: messageParts[1].substr(1),
						message: messageParts.slice(2).join("|"),
					};
				} else {
					messageArguments = {
						timestamp: Date.now(),
						rank: messageParts[0].charAt(0),
						username: messageParts[0].substr(1),
						message: messageParts.slice(1).join("|"),
					};
				}

				const id = Tools.toId(messageArguments.username);
				if (!id) return;

				const user = Users.add(messageArguments.username, id);
				const botDev = (room.id === 'botdevelopment' && user.id === 'kris')

				if (room.id === 'ruinsofalph' || botDev) {
					if (/(re)?play\.pokemonshowdown\.com\/(.+-)?gen8/i.test(messageArguments.message)) {
						if (user !== Users.self) {
							room.say(`/hidelines ${user.id}, 1, Automated response: Please only post replays for gens 1-7 here.`);
						}
					}
				}
				if (room.id === 'randombattles' || botDev) {
					const matched = messageArguments.message.match(
						/(?:re)?play\.pokemonshowdown\.com\/(?:smogtours-)?(?:battle-)?((?:gen\d)?[^-]+(?:-[^ ]*)?)/i
					);
					if (matched) {
						const format = Dex.pokemonShowdownDex.getFormat(matched[1].split('-')[0]);
						if (format.exists && user !== Users.self && !user.hasRank(room, botDev ? 'roomowner' : 'voice')) {
							if (!(format.team || format.id.includes('metronome'))) {
								room.say(
									`/hidelines ${user.id}, 1, Automated response: Please only post battle links related to random formats in here.`
								);
							}
						}
					}
				}
			}
		}
	}
}
