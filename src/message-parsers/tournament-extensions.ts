import type { Room } from "../rooms";
import type { IClientMessageTypes, IMessageParserFunction, ITournamentMessageTypes } from "../types/client";
import type { ITournamentUpdateJson, ITournamentEndJson } from "../types/tournaments";

export const parseMessage: IMessageParserFunction = function(room: Room, messageType: keyof IClientMessageTypes,
	originalMessageParts: readonly string[]) {
	const messageParts = originalMessageParts.slice();
	switch (messageType) {
		case 'tournament': {
			if (!Config.allowTournaments || !Config.allowTournaments.includes(room.id)) return;
			const type = messageParts[0] as keyof ITournamentMessageTypes;
			messageParts.shift();
			switch (type) {
				case 'create': {
					if (room.id === 'othermetas') return;
					const msgArguments: ITournamentMessageTypes['create'] = {
						format: Dex.getExistingFormat(messageParts[0]),
						generator: messageParts[1],
						playerCap: parseInt(messageParts[2]),
					};
					const format = msgArguments.format;
					const database = Storage.getDatabase(room);
					const globalDB = Storage.getGlobalDatabase();
					if (!format.id.startsWith('gen8')) {
						if (globalDB.privateRooms && !globalDB.privateRooms.includes(room.id)) {
							if (room.id !== 'ruinsofalph') {
								if (room.id === 'oldshark') {
									// (Rooms.get('ruinsofalph') as Room).say(`[Gen ${Tools.toId(messageParts[0])[3]}] (Pure) Hackmons in <<${room.id}>>`);
								} else {
									(Rooms.get('ruinsofalph') as Room).say(`${format.name} in <<${room.id}>>`);
								}
							} else {
								if (format.team) {
									(Rooms.get('randombattles') as Room).say(`${format.name} in <<ruinsofalph>>`);
								}
							}
						}
					}
					if (database.tourRuleset) {
						database.tourRuleset = [];
						Storage.exportDatabase(room.id);
					}

					if (Users.self.hasRank(room, 'bot')) {
						const tourcfg = database.tourcfg;
						// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
						if (tourcfg && tourcfg.autodq) {
							let used = tourcfg.autodq.normal;
							if (format.team) used = tourcfg.autodq.randoms;
							if (!['off', 0].includes(used)) {
								room.say(`/tour autodq ${used}`);
							}
						}
						if (tourcfg && tourcfg.autostart) {
							const used = tourcfg.autostart;
							if (!['off', 0].includes(used)) {
								room.say(`/tour autostart ${used}`);
							}
						}
					}
					break;
				}

				case 'update': {
					const messageArguments: ITournamentMessageTypes['update'] = {
						json: JSON.parse(messageParts.join("|")) as ITournamentUpdateJson,
					};
					if (!room.tournament) Tournaments.createTournament(room, messageArguments.json);
					if (room.tournament) {
						room.tournament.update(messageArguments.json);
						if (room.id === 'ruinsofalph' && room.tournament.started &&
							room.tournament.getRemainingPlayerCount() <= 5) {
							room.sayCommand('/tour forcepublic on');
						}
					}
					break;
				}

				case 'updateEnd': {
					if (room.tournament) room.tournament.updateEnd();
					break;
				}

				case 'end': {
					const messageArguments: ITournamentMessageTypes['end'] = {
						json: JSON.parse(messageParts.join("|")) as ITournamentEndJson,
					};
					if (!room.tournament) Tournaments.createTournament(room, messageArguments.json);
					if (room.tournament) {
						room.tournament.update(messageArguments.json);
						room.tournament.updateEnd();
						room.tournament.end();
					}
					const database = Storage.getDatabase(room);
					const now = Date.now();
					database.lastTournamentTime = now;

					// delayed scheduled tournament
					if (room.id in Tournaments.nextScheduledTournaments && Tournaments.nextScheduledTournaments[room.id].time <= now) {
						Tournaments.setScheduledTournamentTimer(room);
					} else {
						let queuedTournament = false;
						if (database.queuedTournament) {
							const format = Dex.getFormat(database.queuedTournament.formatid, true);
							if (format) {
								queuedTournament = true;
								if (!database.queuedTournament.time) {
									database.queuedTournament.time = now + Tournaments.queuedTournamentTime;
								}
								Tournaments.setTournamentTimer(room, database.queuedTournament.time, format,
									database.queuedTournament.playerCap, database.queuedTournament.scheduled);
							} else {
								delete database.queuedTournament;
								Storage.exportDatabase(room.id);
							}
						}

						if (!queuedTournament) {
							if (Config.randomTournamentTimers && room.id in Config.randomTournamentTimers &&
								Tournaments.canSetRandomTournament(room)) {
								Tournaments.setRandomTournamentTimer(room, Config.randomTournamentTimers[room.id]);
							} else if (room.id in Tournaments.scheduledTournaments) {
								Tournaments.setScheduledTournamentTimer(room);
							}
						}
					}

					if (room.id === 'othermetas') {
						if (!database.recentTours) database.recentTours = [];
						const format = Dex.getFormat(messageArguments.json.format);
						database.recentTours.unshift(format ? format.name : messageArguments.json.format);
						if (database.recentTours.length > 5) {
							database.recentTours.splice(database.recentTours.length - 1, database.recentTours.length - 5);
						}
						Storage.exportDatabase(room.id);
					}
					break;
				}

				case 'forceend': {
					if (room.tournament) room.tournament.forceEnd();
					break;
				}

				case 'start': {
					if (room.tournament) room.tournament.start();
					break;
				}

				case 'join': {
					if (!room.tournament) return;

					const messageArguments: ITournamentMessageTypes['join'] = {
						username: messageParts[0],
					};
					room.tournament.createPlayer(messageArguments.username);
					break;
				}

				case 'leave':
				case 'disqualify': {
					if (!room.tournament) return;

					const messageArguments: ITournamentMessageTypes['leave'] = {
						username: messageParts[0],
					};
					room.tournament.destroyPlayer(messageArguments.username);
					break;
				}

				case 'battlestart': {
					if (!room.tournament) return;

					const messageArguments: ITournamentMessageTypes['battlestart'] = {
						usernameA: messageParts[0],
						usernameB: messageParts[1],
						roomid: messageParts[2],
					};
					room.tournament.onBattleStart(messageArguments.usernameA, messageArguments.usernameB, messageArguments.roomid);
					break;
				}

				case 'battleend': {
					if (!room.tournament) return;

					const messageArguments: ITournamentMessageTypes['battleend'] = {
						usernameA: messageParts[0],
						usernameB: messageParts[1],
						result: messageParts[2] as 'win' | 'loss' | 'draw',
						score: messageParts[3].split(',') as [string, string],
						recorded: messageParts[4] as 'success' | 'fail',
						roomid: messageParts[5],
					};
					room.tournament.onBattleEnd(messageArguments.usernameA, messageArguments.usernameB, messageArguments.score,
						messageArguments.roomid);
					break;
				}
			}
			return true;
		}
	}
};
