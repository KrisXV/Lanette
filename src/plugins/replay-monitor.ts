import type { IPluginInterface } from "../types/plugins";
import type { Room } from "../rooms";
import type { IClientMessageTypes } from "../types/client";
import type { ICommandDefinition } from "../command-parser";

export const commands: Dict<ICommandDefinition> = {
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

export class Module implements IPluginInterface {
	name: string = "Replay Monitor";

	parseMessage(room: Room, messageType: keyof IClientMessageTypes, messageParts: string[]): true | undefined {
		switch (messageType) {
			case 'chat':
			case 'c':
			case 'c:': {
				const hasColon = messageType === 'c:';
				const messageArguments: IClientMessageTypes['chat'] = {
					timestamp: (hasColon ? (parseInt(messageParts[0]) + Client.serverTimeOffset) * 1000 : Date.now()),
					rank: messageParts[hasColon ? 1 : 0].charAt(0),
					username: messageParts[hasColon ? 1 : 0].substr(1),
					message: messageParts.slice(hasColon ? 2 : 1).join("|"),
				};

				const id = Tools.toId(messageArguments.username);
				if (!id) return;

				const user = Users.add(messageArguments.username, id);

				if (room.id === 'ruinsofalph') {
					if (messageArguments.message.includes('play.pokemonshowdown.com') && messageArguments.message.includes('gen8')) {
						if (user !== Users.self) {
							room.say(`/warn ${user.id}, Automated response: Please only post replays for gens 1-7 here.`);
							room.say(`/forcehidetext ${user.id}, 1`);
						}
					}
				}
				if (room.id === 'randombattles') {
					if (messageArguments.message.includes('play.pokemonshowdown.com')) {
						const msgPart = messageArguments.message;
						const formatIdIndex = msgPart.includes('replay') ? 0 : 1;
						const findBattle = msgPart.split('.com/')[1].split('-')[formatIdIndex];
						const format = Dex.getFormat(findBattle);
						if (format && user !== Users.self &&
							(!user.hasRank(room, 'voice') || !['typhlosion08', 'tnunes'].includes(user.id))) {
							if (!format.team && !format.id.includes('metronome')) {
								room.say(`/forcehidetext ${user.id}, 1`);
								room.say(`${user.name}: Please only post battle links related to random formats in here.`);
							}
						}
					}
				}
			}
		}
	}
}
