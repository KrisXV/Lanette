import util = require('util');
import type { ICommandDefinition } from "../command-parser";
import type { Room } from "../rooms";
import type { ITournamentUpdateJson, ITournamentEndJson, IBracketNode } from '../types/tournaments';
import type { IPluginInterface, } from '../types/plugins';
import type { IClientMessageTypes, ITournamentMessageTypes } from '../types/client';
import { commandCharacter } from '../config';


function getLadder(room: Room) {
	const database = Storage.getDatabase(room);
	if (!database.scrappieLadder) {
		database.scrappieLadder = {};
		Storage.exportDatabase(room.id);
	}
	return database.scrappieLadder;
}

function tryGetRoomName(room: Room): string {
	if (!Config.rooms || !Config.rooms.includes(room.id)) return '';
	return room.title;
}

function isConfigured(room: Room): boolean {
	const database = Storage.getDatabase(room);
	if (!database.scrappieLeaderboardSettings) return false;
	return true;
}

function filterTier(tier: string, filter: string | string[] | RegExp | Object | null): boolean {
	tier = Tools.toId(tier);
	if (typeof filter === 'string') {
		return tier === Tools.toId(filter);
	} else if (filter !== null && typeof filter === 'object') {
		if (Array.isArray(filter)) {
			return filter.map(Tools.toId).includes(tier);
		} else if (util.types.isRegExp(filter)) {
			return filter.test(tier);
		} else {
			return tier in filter;
		}
	} else {
		return true;
	}
}

function getConfig(room: Room): {
	tierFilter: string | string[] | RegExp | Object | null,
	onlyOfficial: boolean,
	winnerPoints: number,
	finalistPoints: number,
	semiFinalistPoints: number,
	battlePoints: number,
} {
	const database = Storage.getDatabase(room);
	if (!database.scrappieLeaderboardSettings) {
		database.scrappieLeaderboardSettings = {
			tierFilter: null,
			onlyOfficial: false,
			winnerPoints: 5,
			finalistPoints: 3,
			semiFinalistPoints: 1,
			battlePoints: 0,
		};
		Storage.exportDatabase(room.id);
	}
	const res = database.scrappieLeaderboardSettings;
	return res;
}

function parseTournamentTree(tree: IBracketNode): {[k: string]: number} {
	const auxObj: {[k: string]: number} = {};
	const team = tree.team;
	const state = tree.state;
	const children: IBracketNode[] = tree.children || [];
	if (!(team in auxObj)) auxObj[team] = 0;
	if (state === "finished") {
		auxObj[team] += 1;
	}
	let aux: {[k: string]: number};
	for (const child of children) {
		aux = parseTournamentTree(child);
		for (const j in aux) {
			if (!(j in auxObj)) auxObj[j] = 0;
			auxObj[j] += aux[j];
		}
	}
	return auxObj;
}

function parseTournamentResults(data: ITournamentEndJson): {
	players: string[], general: {[k: string]: number}, winner: string, finalist: string, semiFinalists: string[]
} | null {
	const generator = Tools.toId(data.generator);
	if (generator === 'singleelimination') {
		const parsedTree = parseTournamentTree(data.bracketData.rootNode!);
		const res: {
			players: string[], general: {[k: string]: number}, winner: string, finalist: string, semiFinalists: string[]
		} = {
			players: Object.keys(parsedTree),
			general: {},
			winner: Tools.toId(data.results[0][0]),
			finalist: "",
			semiFinalists: [],
		};
		for (const i in parsedTree) {
			res.general[Tools.toId(i)] = parsedTree[i];
		}
		let aux: string;
		let aux2: string;
		if (data.bracketData.rootNode!.children) {
			for (const child of data.bracketData.rootNode!.children) {
				aux = Tools.toId(child.team || '');
				if (aux && aux !== res.winner) {
					res.finalist = aux;
				}
				if (child.children) {
					for (const child2 of child.children) {
						aux2 = Tools.toId(child2.team || '');
						if (aux2 && ![res.winner, res.finalist].includes(aux2) && !res.semiFinalists.includes(aux2)) {
							res.semiFinalists.push(aux2);
						}
					}
				}
			}
		}
		return res;
	} else {
		return null;
	}
}

function getPoints(room: Room, username: string): {
	username: string, roomid: string, wins: number, finals: number,
	semis: number, battles: number, tours: number, points: number
} {
	const userid = Tools.toId(username);
	const roomid = room.id;
	const roomConfig = getConfig(room);
	const winPoints = roomConfig.winnerPoints;
	const finalPoints = roomConfig.finalistPoints;
	const semiPoints = roomConfig.semiFinalistPoints;
	const battlePoints = roomConfig.battlePoints;
	const res = {
		username,
		roomid,
		wins: 0,
		finals: 0,
		semis: 0,
		battles: 0,
		tours: 0,
		points: 0,
	};
	const ladder = getLadder(room);
	if (!ladder[userid]) return res;
	const userLadder = ladder[userid];
	res.username = userLadder[0];
	res.wins = userLadder[1];
	res.finals = userLadder[2];
	res.semis = userLadder[3];
	res.battles = userLadder[4];
	res.tours = userLadder[5];
	res.points = (winPoints * res.wins) + (finalPoints * res.finals) + (semiPoints * res.semis) + (battlePoints * res.battles);
	return res;
}

function getTop(room: Room): [string, number, number, number, number, number, number][] | null {
	if (!isConfigured(room)) return null;
	const roomConfig = getConfig(room);
	const pWin = roomConfig.winnerPoints;
	const pFinal = roomConfig.finalistPoints;
	const pSemiFinal = roomConfig.semiFinalistPoints;
	const pBattle = roomConfig.battlePoints;
	const db = Storage.getDatabase(room);
	if (!db.scrappieLadder) return [];
	const ladder = getLadder(room);
	const top: [string, number, number, number, number, number, number][] = [];
	let points = 0;
	for (const userid in ladder) {
		const u = ladder[userid];
		points = (pWin * u[1]) + (pFinal * u[2]) + (pSemiFinal * u[3]) + (pBattle * u[4]);
		// @ts-ignore
		top.push(u.concat([points]));
	}
	return top.sort((a, b) => {
		if (a[6] !== b[6]) return b[6] - a[6]; //Points
		if (a[1] !== b[1]) return b[1] - a[1]; //Wins
		if (a[2] !== b[2]) return b[2] - a[2]; //Finals
		if (a[3] !== b[3]) return b[3] - a[3]; //Semis
		if (a[4] !== b[4]) return b[4] - a[4]; //Battles
		if (a[5] !== b[5]) return b[5] - a[5]; //Tours played
		return 0;
	});
}

function getTable(room: Room, n: number): string | null {
	if (!isConfigured(room)) return null;
	const top = getTop(room);
	if (!top) return null;
	let table = `Room: ${room.title}\n\n`;
	table += `----|------|---------|---|---|----|-------------|-------------\n`;
	for (let i = 0; i < n && i < top.length; i++) {
		table += `${i + 1} | ${top[i][0]} | ${top[i][6]} | ${top[i][1]} | ${top[i][2]} | ${top[i][3]} | ${top[i][5]} | ${top[i][4]}`;
		table += `\n`;
	}
	return table;
}

function addUser(room: Room, username: string, type: 'A' | 'W' | 'F' | 'S' | 'B', auxData = 0): void {
	const ladder = getLadder(room);
	const userid = Tools.toId(username);
	if (!ladder[userid]) ladder[userid] = [username, 0, 0, 0, 0, 0];
	switch (type) {
		case 'A':
			ladder[userid][0] = username;
			ladder[userid][5]++;
			Storage.exportDatabase(room.id);
			break;
		case 'W':
			ladder[userid][1]++;
			Storage.exportDatabase(room.id);
			break;
		case 'F':
			ladder[userid][2]++;
			Storage.exportDatabase(room.id);
			break;
		case 'S':
			ladder[userid][3]++;
			Storage.exportDatabase(room.id);
			break;
		case 'B':
			if (!auxData) return;
			ladder[userid][4] += auxData;
			Storage.exportDatabase(room.id);
			break;
	}
}

function writeResults(
	room: Room,
	results?: {players: string[], winner: string, finalist: string, semiFinalists: string[], general: {[k: string]: number}}
): void {
	if (!results) return;
	for (const player of results.players) {
		addUser(room, player, 'A');
	}
	if (results.winner) {
		addUser(room, results.winner, 'W');
	}
	if (results.finalist) {
		addUser(room, results.finalist, 'W');
	}
	for (const semi of results.semiFinalists) {
		addUser(room, semi, 'S');
	}
	for (const user in results.general) {
		addUser(room, user, 'B', results.general[user]);
	}
}

function onTournamentEnd(room: Room, data: ITournamentEndJson & {isOfficialTour: boolean}): void {
	if (!isConfigured(room)) return;
	if (!data.isOfficialTour) {
		if (getConfig(room).onlyOfficial) return
		const filter = getConfig(room).tierFilter;
		if (!filterTier(data.format, filter)) return;
	}
	const results = parseTournamentResults(data);
	if (!results) return;
	writeResults(room, results);
	Storage.exportDatabase(room.id);
}

function getResetCodes(room: Room): Dict<string> {
	const db = Storage.getDatabase(room);
	if (!db.resetCodes) {
		db.resetCodes = {};
		Storage.exportDatabase(room.id);
	}
	return db.resetCodes;
	
}

function generateRandomNick(num: number): string {
	const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
	let str = '';
	for (let i = 0, l = chars.length; i < num; i++) {
		str += chars.charAt(~~(Math.random() * l));
	}
	return str;
}

function getResetHashCode(room: Room): string | null {
	if (!getLadder(room)) return null;
	const codes = getResetCodes(room);
	for (const i in codes) {
		if (codes[i] === room.id) {
			delete codes[i];
			Storage.exportDatabase(room.id);
		}
	}
	const code = generateRandomNick(10);
	codes[code] = room.id;
	Storage.exportDatabase(room.id);
	return code;
}

function execResetHashCode(code: string, room: Room): string | boolean {
	const resetCodes = getResetCodes(room);
	if (resetCodes[code]) {
		const roomid = resetCodes[code];
		const ladder = getLadder(room);
		if (ladder[roomid]) {
			delete ladder[roomid];
			Storage.exportDatabase(room.id);
		}
		delete resetCodes[code];
		Storage.exportDatabase(room.id);
		return roomid;
	}
	return false;
}

export const commands: Dict<ICommandDefinition> = {
	official: {
		command(target, room, user) {
			if (this.isPm(room)) return;
			if (!user.canPerform(room, 'driver') && !user.isHost(room)) return;
			if (!isConfigured(room)) {
				return this.say(`Leaderboards aren't set up for this room.`);
			}
			if (!room.tournament) {
				return this.say(`There is no tournament ongoing right now.`);
			}
			const database = Storage.getDatabase(room);
			if (database.nextTournamentOfficial) {
				return this.say(`This tournament is already official.`);
			}
			database.nextTournamentOfficial = true;
			Storage.exportDatabase(room.id);
			return this.say(`This tournament is now official and will count towards the leaderboard.`);
		},
	},
	unofficial: {
		command(target, room, user) {
			if (this.isPm(room)) return;
			if (!user.canPerform(room, 'driver') && !user.isHost(room)) return;
			if (!isConfigured(room)) {
				return this.say(`Leaderboards aren't set up for this room.`);
			}
			if (!room.tournament) {
				return this.say(`There is no tournament ongoing right now.`);
			}
			const database = Storage.getDatabase(room);
			if (!database.nextTournamentOfficial) {
				return this.say(`This tournament is already unofficial.`);
			}
			database.nextTournamentOfficial = false;
			Storage.exportDatabase(room.id);
			return this.say(`This tournament is now unofficial and will not count towards the leaderboard.`);
		},
	},
	tourleaderboard: {
		command(target, room, user) {
			const args = target.split(',');
			if (!args[0]) {
				let cmdStart = this.isPm(room) ? '' : user.canPerform(room, 'voice') ? '': `/pm ${user.id},`;
				return this.say(`${cmdStart}Correct syntax: ${commandCharacter}tourleaderboard [rank|top|table|reset|viewconfig|setconfig]`);
			}
			switch (Tools.toId(args[0])) {
				case 'rank':
				case 'ranking':
					this.run('tourrank', args.slice(1).join(','));
					break;
				case 'top':
					this.run('tourtop', args.slice(1).join(','));
					break;
				case 'table':
					this.run('tourtable', args.slice(1).join(','));
					break;
				case 'reset':
					this.run('tourreset', args.slice(1).join(','));
					break;
				case 'confirmreset':
					this.run('tourconfirmreset', args.slice(1).join(','));
					break;
			}
		},
	},
	tourrank: {
		command(target, room, user) {
			if (this.isPm(room)) {
				const args = target.split(',');
				if (args.length < 1) {
					return this.say(`Please provide a target room.`);
				}
				const attemptedTargetRoom = Tools.toRoomId(args[0]);
				let tarRoom = Rooms.get(attemptedTargetRoom);
				if (!tarRoom) {
					return this.say(`Room '${attemptedTargetRoom}' not found. Please provide a room that I'm in.`);
				}
				if (!isConfigured(tarRoom)) {
					return this.say(`Room '${tarRoom.title}' does not have a leaderboard configured.`);
				}
				const attemptedUserID = Tools.toId(args[1] || user.name);
				if (!Tools.isUsernameLength(attemptedUserID)) {
					return this.say(`Invalid user '${attemptedUserID}'.`);
				}
				const rank = getPoints(tarRoom, attemptedUserID);
				let buf = `Rank **${rank.username}** in __${tryGetRoomName(tarRoom)}__ | `;
				buf += `Points: ${rank.points} | `;
				buf += `Wins: ${rank.wins} times, Finals: ${rank.finals} times, Semis: ${rank.semis} times | `;
				buf += `Total: ${rank.tours} tours, ${rank.battles} battles`;
				return this.say(buf);
			} else {
				let msgStarter = ``;
				if (!user.canPerform(room, 'voice')) msgStarter = `/pm ${user.id},`;
				if (!isConfigured(room)) {
					return this.say(`${msgStarter}This room does not have a leaderboard configured.`);
				}
				const attemptedUserID = Tools.toId(target || user.id);
				if (!Tools.isUsernameLength(attemptedUserID)) {
					return this.say(`${msgStarter}Invalid user '${attemptedUserID}'.`);
				}
				const rank = getPoints(room, attemptedUserID);
				let buf = `${msgStarter}Rank **${rank.username}** in __${tryGetRoomName(room)}__ | `;
				buf += `Points: ${rank.points} | `;
				buf += `Wins: ${rank.wins} times, Finals: ${rank.finals} times, Semis: ${rank.semis} times | `;
				buf += `Total: ${rank.tours} tours, ${rank.battles} battles`;
				return this.say(buf);
			}
		},
		aliases: ["tourranking"],
	},
	tourtop: {
		command(target, room, user) {
			if (this.isPm(room)) {
				const args = target.split(',');
				if (args.length < 1) {
					return this.say(`Please provide a target room.`);
				}
				const attemptedTargetRoom = Tools.toRoomId(args[0]);
				let tarRoom = Rooms.get(attemptedTargetRoom);
				if (!tarRoom) {
					return this.say(`Room '${attemptedTargetRoom}' not found. Please provide a room that I'm in.`);
				}
				if (!isConfigured(tarRoom)) {
					return this.say(`Room '${tarRoom.title}' does not have a leaderboard configured.`);
				}
				const top = getTop(tarRoom);
				if (!top || !top.length) {
					return this.say(`The top users list for room ${tarRoom.title} is empty.`);
				}
				const topResults: string[] = [];
				for (let i = 0; i < 5 && i < top.length; i++) {
					topResults.push(`__#${i + 1}__ **${top[i][0]}** (${top[i][6]})`);
				}
				return this.say(`**${tryGetRoomName(tarRoom)}** | ${topResults.join(', ')}`);
			} else {
				let msgStarter = ``;
				if (!user.canPerform(room, 'voice')) msgStarter = `/pm ${user.id},`;
				if (!isConfigured(room)) {
					return this.say(`${msgStarter}Room '${room.title}' does not have a leaderboard configured.`);
				}
				const top = getTop(room);
				if (!top || !top.length) {
					return this.say(`${msgStarter}The top users list for room ${room.title} is empty.`);
				}
				const topResults: string[] = [];
				for (let i = 0; i < 5 && i < top.length; i++) {
					topResults.push(`__#${i + 1}__ **${top[i][0]}** (${top[i][6]})`);
				}
				return this.say(`${msgStarter}**${tryGetRoomName(room)}** | ${topResults.join(', ')}`);
			}
		},
	},
	tourtable: {
		command(target, room, user) {
			if (this.isPm(room)) {
				const args = target.split(',');
				if (args.length < 1) {
					return this.say(`Please provide a target room.`);
				}
				const attemptedTargetRoom = Tools.toRoomId(args[0]);
				let tarRoom = Rooms.get(attemptedTargetRoom);
				if (!tarRoom) {
					return this.say(`Room '${attemptedTargetRoom}' not found. Please provide a room that I'm in.`);
				}
				if (!isConfigured(tarRoom)) {
					return this.say(`Room '${tarRoom.title}' does not have a leaderboard configured.`);
				}
				const size = args[1] ? parseInt(args[1]) : 100;
				if (!size || size < 0) {
					return this.say(`Invalid number ${size}. Please use a positive whole number.`);
				}
				const table = getTable(tarRoom, size);
				if (!table) {
					return this.say(`Sorry, the leaderboard table for ${tarRoom.title} is empty.`);
				}
				const id = tarRoom.id;
				Tools.uploadToHastebin(table, str => {
					return this.say(`Table (${id}): ${str}`);
				});
			} else {
				if (!isConfigured(room)) {
					return this.say(`Room '${room.title}' does not have a leaderboard configured.`);
				}
				const size = target ? parseInt(target) : 100;
				if (!size || size < 0) {
					return this.say(`Invalid number ${size}. Please use a positive whole number.`);
				}
				const table = getTable(room, size);
				if (!table) {
					return this.say(`Sorry, the leaderboard table for ${room.title} is empty.`);
				}
				Tools.uploadToHastebin(table, str => {
					return this.say(`Table (${room.title}): ${str}`);
				});
			}
		},
	},
	tourreset: {
		command(target, room, user) {
			if (this.isPm(room) || !user.canPerform(room, 'roomowner')) return;
			if (!Tools.toId(target) || Tools.toRoomId(target) !== room.id) {
				return this.say(`Correct syntax: ${commandCharacter}tourreset ${room.id}`);
			}
			const code = getResetHashCode(room);
			if (!code) {
				return this.say(`There was an issue generating the reset token.`);
			}
			return this.say(`Use \`\`${commandCharacter}tourconfirmreset ${code}\`\` to confirm.`);
		},
	},
	tourconfirmreset: {
		command(target, room, user) {
			if (this.isPm(room) || !user.canPerform(room, 'roomowner')) return;
			if (!Tools.toId(target)) {
				return this.say(`Correct syntax: ${commandCharacter}tourconfirmreset [hashcode]`);
			}
			const code = execResetHashCode(target.trim(), room);
			if (!code) {
				return this.say(`Invalid confirmation token.`);
			}
			return this.say(`Leaderboard reset.`);
		},
	},
	tourviewconfig: {
		command(target, room, user) {
			if (this.isPm(room) || !user.canPerform(room, 'roomowner')) return;
			if (!isConfigured(room)) {
				return this.say(`This room does not have leaderboard configuration set-up. Use \`\`${commandCharacter}toursetconfig\`\`.`);
			}
			const config = getConfig(room);
			let buf = `**Room:** ${room.title}`;
			buf += `, **Win pts:** ${config.winnerPoints}`;
			buf += `, **Finals pts:** ${config.finalistPoints}`;
			buf += `, **Semis pts:** ${config.semiFinalistPoints}`;
			buf += `, **Battle pts:** ${config.battlePoints}`;
			if (config.onlyOfficial) buf += `, **Officials only:** on`;
			this.say(`/pm ${user.id},${buf}`);
		},
	},
	toursetconfig: {
		command(target, room, user) {
			if (this.isPm(room) || !user.canPerform(room, 'roomowner')) return;
			const args = target.split(',');
			if (args.length < 2 || !Tools.toId(args[0])) {
				return this.say(`Correct syntax: ${commandCharacter}toursetconfig [room], [on|off], [win points], [finals points], [semis points], [battle points], [official|all]`);
			}
			if (Tools.toRoomId(args[0]) !== room.id) {
				return this.say(`The room parameter must match the room that the command is used in.`);
			}
			if (args[6] && !['official', 'all'].includes(Tools.toId(args[6]))) {
				return this.say(`Correct syntax: ${commandCharacter}toursetconfig [room], [on|off], [win points], [finals points], [semis points], [battle points], [official|all]`);
			}
			const enabled = Tools.toId(args[1]);
			const confAux = getConfig(room);
			if (enabled === 'on') {
				if (args[2]) {
					confAux.winnerPoints = parseInt(args[2]);
					Storage.exportDatabase(room.id);
				}
				if (args[3]) {
					confAux.finalistPoints = parseInt(args[3]);
					Storage.exportDatabase(room.id);
				}
				if (args[4]) {
					confAux.semiFinalistPoints = parseInt(args[4]);
					Storage.exportDatabase(room.id);
				}
				if (args[5]) {
					confAux.battlePoints = parseInt(args[5]);
					Storage.exportDatabase(room.id);
				}
				if (args[6]) {
					if (Tools.toId(args[6]) === 'official') {
						confAux.onlyOfficial = true;
						Storage.exportDatabase(room.id);
					} else {
						confAux.onlyOfficial = false;
						Storage.exportDatabase(room.id);
					}
				}
				Storage.getDatabase(room).scrappieLeaderboardSettings = confAux;
				Storage.exportDatabase(room.id);
				return this.say(`Settings saved.`);
			} else {
				if (isConfigured(room)) {
					const db = Storage.getDatabase(room);
					delete db.scrappieLeaderboardSettings;
					Storage.exportDatabase(room.id);
					return this.say(`Leaderboards disabled.`)
				} else {
					return this.say(`Leaderboards are already disabled.`);
				}
			}
		},
	},
};

export class Module implements IPluginInterface {
	name: string = "Scrappie Leaderboards";

	parseMessage(room: Room, messageType: keyof IClientMessageTypes, messageParts: string[]): true | undefined {
		switch (messageType) {
		case 'tournament': {
			const type = messageParts[0] as keyof ITournamentMessageTypes;
			messageParts.shift();
			switch (type) {
			case 'create': {
				const db = Storage.getDatabase(room);
				if (db.scrappieLeaderboardSettings && !db.scrappieLeaderboardSettings.onlyOfficial) {
					db.nextTournamentOfficial = true;
				}
				break;
			}

			case 'update': {
				const messageArguments: ITournamentMessageTypes['update'] = {
					json: JSON.parse(messageParts.join("|")) as ITournamentUpdateJson,
				};
				if (!room.tournament) Tournaments.createTournament(room, messageArguments.json);
				if (room.tournament) room.tournament.update(messageArguments.json);
				break;
			}

			case 'updateEnd': {
				if (room.tournament) room.tournament.updateEnd();
				if (room.tournament && !room.tournament.started)
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
							if (!database.queuedTournament.time) database.queuedTournament.time = now + Tournaments.queuedTournamentTime;
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
				const db = Storage.getDatabase(room);
				onTournamentEnd(room, Object.assign({isOfficialTour: !!db.nextTournamentOfficial}, messageArguments.json));
				db.nextTournamentOfficial = false;
				Storage.exportDatabase(room.id);
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
			break;
		}
		}
	}
}
