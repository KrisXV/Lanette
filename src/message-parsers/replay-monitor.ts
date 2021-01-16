import type { Room } from "../rooms";
import type { IClientMessageTypes, IMessageParserFunction } from "../types/client";

export const parseMessage: IMessageParserFunction = function(room: Room, messageType: keyof IClientMessageTypes,
	messageParts: readonly string[]) {
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
			const botDev = room.id === 'botdevelopment' && user.id === 'kris';

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
								// eslint-disable-next-line max-len
								`/hidelines ${user.id}, 1, Automated response: Please only post battle links related to random formats in here.`
							);
						}
					}
				}
			}
		}
	}
};
