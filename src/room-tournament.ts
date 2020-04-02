import { Activity, Player } from "./room-activity";
import { Room } from "./rooms";
import { IFormat } from "./types/in-game-data-types";

interface IBracketNode {
	readonly result: string;
	readonly state: 'available' | 'challenging' | 'inprogress' | 'finished' | 'unavailable';
	readonly team: string;
	readonly children?: IBracketNode[];
}

interface IBracketData {
	readonly type: string;
	readonly rootNode?: IBracketNode;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	readonly tableHeaders?: {cols: any[]; rows: any[]};
	readonly users?: string[];
}

interface ICurrentBattle {
	readonly playerA: Player;
	readonly playerB: Player;
	readonly roomid: string;
}

export interface ITournamentUpdateJSON {
	/** An object representing the current state of the bracket */
	bracketData: IBracketData;
	/** A list of opponents that can currently challenge you */
	challengeBys: string[];
	/** The name of the opponent that has challenged you */
	challenged: string;
	/** A list of opponents that you can currently challenge */
	challenges: string[];
	/** The name of the opponent that you are challenging */
	challenging: string;
	/** The tournament's custom name or the format being used */
	format: string;
	/** The type of bracket being used by the tournament */
	generator: string;
	/** Whether or not you have joined the tournament */
	isJoined: boolean;
	/** Whether or not the tournament has started */
	isStarted: boolean;
	/** The player cap that was set or 0 if it was removed */
	playerCap: number;
	/** The format being used; sent if a custom name was set */
	teambuilderFormat: string;
}

export interface ITournamentEndJSON {
	/** An object representing the final state of the bracket */
	bracketData: IBracketData;
	/** The tournament's custom name or the format that was used */
	format: string;
	/** The type of bracket that was used by the tournament */
	generator: string;
	/** The name(s) of the winner(s) of the tournament */
	results: string[][];
}

export interface IBattleData {
	remainingPokemon: Dict<number>;
	slots: Map<Player, string>;
}

const generators: Dict<number> = {
	"Single": 1,
	"Double": 2,
	"Triple": 3,
	"Quadruple": 4,
	"Quintuple": 5,
	"Sextuple": 6,
};

export class Tournament extends Activity {
	readonly activityType: string = 'tournament';
	adjustCapTimer: NodeJS.Timer | null = null;
	readonly battleData: Dict<IBattleData> = {};
	readonly battleRooms: string[] = [];
	readonly createTime: number = Date.now();
	readonly currentBattles: ICurrentBattle[] = [];
	generator: number = 1;
	readonly info: ITournamentUpdateJSON & ITournamentEndJSON = {
		bracketData: {type: ''},
		challengeBys: [],
		challenged: '',
		challenges: [],
		challenging: '',
		format: '',
		generator: '',
		isJoined: false,
		isStarted: false,
		playerCap: 0,
		results: [],
		teambuilderFormat: '',
	};
	isRoundRobin: boolean = false;
	manuallyNamed: boolean = false;
	manuallyEnabledPoints: boolean = false;
	originalFormat: string = '';
	scheduled: boolean = false;
	totalPlayers: number = 0;
	updates: Partial<ITournamentUpdateJSON> = {};

	readonly joinBattles: boolean;

	// set in initialize()
	format!: IFormat;
	playerCap!: number;
	readonly room!: Room;

	constructor(room: Room, pmRoom?: Room) {
		super(room, pmRoom);

		this.joinBattles = Config.trackTournamentBattleScores && Config.trackTournamentBattleScores.includes(room.id) ? true : false;
	}

	initialize(format: IFormat, generator: string, playerCap: number, name?: string): void {
		this.format = format;
		this.playerCap = playerCap;
		this.name = name || format.name;
		this.originalFormat = format.name;
		this.id = format.id;
		this.uhtmlBaseName = 'tournament-' + this.id;

		this.setGenerator(generator);
	}

	setGenerator(generator: string): void {
		const generatorName = generator.split(" ")[0];
		if (generatorName in generators) {
			this.generator = generators[generatorName];
		} else {
			const generatorNumber = parseInt(generator.split("-tuple")[0]);
			if (!isNaN(generatorNumber)) this.generator = generatorNumber;
		}
		this.isRoundRobin = toID(generator).includes('roundrobin');
	}

	setCustomFormatName(): void {
		const previousName = this.name;
		const customFormatName = Dex.getCustomFormatName(this.format, this.room);
		if (this.format.customRules && (customFormatName === this.format.name || customFormatName.length > 100)) {
			this.name = this.format.name + " (custom rules)";
		} else {
			this.name = customFormatName;
		}

		if (this.name !== previousName) this.sayCommand("/tour name " + this.name);
	}

	canAwardPoints(): boolean {
		if (((this.format.customRules && Config.rankedCustomTournaments && Config.rankedCustomTournaments.includes(this.room.id)) ||
		(!this.format.customRules && Config.rankedTournaments && Config.rankedTournaments.includes(this.room.id))) &&
		!(this.format.unranked && Config.useDefaultUnrankedTournaments && Config.useDefaultUnrankedTournaments.includes(this.room.id))) return true;

		return false;
	}

	adjustCap(): void {
		if (this.playerCount % 8 === 0) {
			this.sayCommand("/tour start");
			return;
		}
		let newCap = this.playerCount + 1;
		while (newCap % 8 !== 0) {
			newCap += 1;
		}

		if (this.playerCap && newCap >= this.playerCap) return;
		CommandParser.parse(this.room, Users.self, Config.commandCharacter + "tournamentcap " + newCap);
	}

	deallocate(): void {
		if (this.adjustCapTimer) clearTimeout(this.adjustCapTimer);
		if (this.startTimer) clearTimeout(this.startTimer);
		this.room.tournament = null;
	}

	start(): void {
		if (this.startTimer) clearTimeout(this.startTimer);
		this.started = true;
		this.startTime = Date.now();
	}

	onEnd(): void {
		const database = Storage.getDatabase(this.room);
		if (!database.pastTournaments) database.pastTournaments = [];
		database.pastTournaments.unshift({inputTarget: this.format.inputTarget, name: this.format.name, time: Date.now()});
		while (database.pastTournaments.length > 8) {
			database.pastTournaments.pop();
		}

		if (!database.lastTournamentFormatTimes) database.lastTournamentFormatTimes = {};
		database.lastTournamentFormatTimes[this.format.id] = Date.now();

		let winners: string[] = [];
		let runnersUp: string[] = [];
		let semiFinalists: string[] = [];
		if (this.info.bracketData.type === 'tree') {
			const data = this.info.bracketData.rootNode;
			if (data && data.children && this.generator === 1) {
				const winner = data.team;
				winners.push(winner);
				let runnerUp = '';
				if (data.children[0].team === winner) {
					runnerUp = data.children[1].team;
				} else {
					runnerUp = data.children[0].team;
				}
				runnersUp.push(runnerUp);

				if (data.children[0].children && data.children[0].children.length) {
					if (data.children[0].children[0].team === runnerUp || data.children[0].children[0].team === winner) {
						semiFinalists.push(data.children[0].children[1].team);
					} else {
						semiFinalists.push(data.children[0].children[0].team);
					}
				}
				if (data.children[1].children && data.children[1].children.length) {
					if (data.children[1].children[0].team === runnerUp || data.children[1].children[0].team === winner) {
						semiFinalists.push(data.children[1].children[1].team);
					} else {
						semiFinalists.push(data.children[1].children[0].team);
					}
				}
			}
		} else {
			if (this.info.results[0]) winners = this.info.results[0];
			if (this.info.results[1]) runnersUp = this.info.results[1];
			if (this.info.results[2]) semiFinalists = this.info.results[2];
		}
		const singleElimination = !this.isRoundRobin && this.generator === 1;
		if (!winners.length || !runnersUp.length || (singleElimination && semiFinalists.length < 2)) return;
		if (!this.canAwardPoints() && !this.manuallyEnabledPoints) {
			const text = ["runner" + (runnersUp.length > 1 ? "s" : "") + "-up " + Tools.joinList(runnersUp, '**'), "winner" + (winners.length > 1 ? "s" : "") + " " + Tools.joinList(winners, '**')];
			if (semiFinalists.length) text.unshift("semi-finalist" + (semiFinalists.length > 1 ? "s" : "") + " " + Tools.joinList(semiFinalists, '**'));
			this.sayCommand('/wall Congratulations to ' + Tools.joinList(text));
		} else {
			let multiplier = 1;
			if (!this.format.teamLength || !this.format.teamLength.battle || this.format.teamLength.battle > 2) {
				if (this.totalPlayers >= 32) {
					multiplier += ((Math.floor(this.totalPlayers / 32)) * 0.5);
				}
			}
			if (this.scheduled) multiplier *= 2.5;

			let pointsName = 'points';
			let semiFinalistPoints: number;
			let runnerUpPoints: number;
			let winnerPoints: number;
			if (Config.allowScriptedGames && Config.allowScriptedGames.includes(this.room.id)) {
				pointsName = "bits";
				semiFinalistPoints = Math.round((100 * multiplier));
				runnerUpPoints = Math.round((200 * multiplier));
				winnerPoints = Math.round((300 * multiplier));
			} else {
				semiFinalistPoints = Math.round((1 * multiplier));
				runnerUpPoints = Math.round((2 * multiplier));
				winnerPoints = Math.round((3 * multiplier));
			}

			const pointsHtml: string[] = [];
			pointsHtml.push("runner" + (runnersUp.length > 1 ? "s" : "") + "-up " + Tools.joinList(runnersUp, '<b>', '</b>') + " for earning " + runnerUpPoints + " points");
			pointsHtml.push("winner" + (winners.length > 1 ? "s" : "") + " " + Tools.joinList(winners, '<b>', '</b>') + " for earning " + winnerPoints + " points");
			if (semiFinalists.length) {
				pointsHtml.unshift("semi-finalist" + (semiFinalists.length > 1 ? "s" : "") + " " + Tools.joinList(semiFinalists, '<b>', '</b>') + " for earning " + semiFinalistPoints + " point" + (semiFinalistPoints > 1 ? "s" : ""));
			}

			const playerStatsHtml = '';
			// if (showPlayerStats) playerStatsHtml = Tournaments.getPlayerStatsHtml(this.room, this.format);

			this.sayHtml("<div class='infobox-limited'>Congratulations to " + Tools.joinList(pointsHtml) + "!" + (playerStatsHtml ? "<br><br>" + playerStatsHtml : "") + "</div>");

			const winnerPm = 'You were awarded **' + winnerPoints + ' ' + pointsName + '** for being ' + (winners.length > 1 ? 'a' : 'the') + ' tournament winner! To see your total amount, use this command: ``.rank ' + this.room.title + '``';
			for (let i = 0; i < winners.length; i++) {
				Storage.addPoints(this.room, winners[i], winnerPoints, this.format.id);
				// Client.outgoingPms[toID(winners[i])] = winnerPm;
				const user = Users.get(winners[i]);
				if (user) user.say(winnerPm);
			}

			const runnerUpPm = 'You were awarded **' + runnerUpPoints + ' ' + pointsName + '** for being ' + (runnersUp.length > 1 ? 'a' : 'the') + ' runner-up in the tournament! To see your total amount, use this command: ``.rank ' + this.room.title + '``';
			for (let i = 0; i < runnersUp.length; i++) {
				Storage.addPoints(this.room, runnersUp[i], runnerUpPoints, this.format.id);
				// Client.outgoingPms[toID(runnersUp[i])] = runnerUpPm;
				const user = Users.get(runnersUp[i]);
				if (user) user.say(runnerUpPm);
			}

			const semiFinalistPm = 'You were awarded **' + semiFinalistPoints + ' ' + pointsName + '** for being ' + (semiFinalists.length > 1 ? 'a' : 'the') + ' semi-finalist in the tournament! To see your total amount, use this command: ``.rank ' + this.room.title + '``';
			for (let i = 0; i < semiFinalists.length; i++) {
				Storage.addPoints(this.room, semiFinalists[i], semiFinalistPoints, this.format.id);
				// Client.outgoingPms[toID(semiFinalists[i])] = semiFinalistPm;
				const user = Users.get(semiFinalists[i]);
				if (user) user.say(semiFinalistPm);
			}
		}

		Storage.exportDatabase(this.room.id);
	}

	forceEnd(): void {
		if (this.timeout) clearTimeout(this.timeout);
		this.deallocate();
	}

	update(json: Partial<ITournamentUpdateJSON & ITournamentEndJSON>): void {
		Object.assign(this.updates, json);
	}

	updateEnd(): void {
		Object.assign(this.info, this.updates);
		if (this.updates.generator) this.setGenerator(this.updates.generator);
		if (this.updates.bracketData) {
			if (this.info.isStarted) {
				this.updateBracket();
			} else {
				if (this.updates.bracketData.users) {
					for (let i = 0; i < this.updates.bracketData.users.length; i++) {
						this.createPlayer(this.updates.bracketData.users[i]);
					}
				}
			}
		}
		if (this.updates.format) {
			const format = Dex.getFormat(this.updates.format);
			if (format) {
				this.name = format.name;
				if (format.name === this.originalFormat) this.manuallyNamed = false;
			} else {
				this.name = this.updates.format;
				this.manuallyNamed = true;
			}
		}

		this.updates = {};
	}

	updateBracket(): void {
		const players: Dict<string> = {};
		const losses: Dict<number> = {};
		if (this.info.bracketData.type === 'tree') {
			if (!this.info.bracketData.rootNode) return;
			const queue = [this.info.bracketData.rootNode];
			while (queue.length > 0) {
				const node = queue[0];
				queue.shift();
				if (!node.children) continue;

				if (node.children[0] && node.children[0].team) {
					const userA = toID(node.children[0].team);
					if (!players[userA]) players[userA] = node.children[0].team;
					if (node.children[1] && node.children[1].team) {
						const userB = toID(node.children[1].team);
						if (!players[userB]) players[userB] = node.children[1].team;
						if (node.state === 'finished') {
							if (node.result === 'win') {
								if (!losses[userB]) losses[userB] = 0;
								losses[userB]++;
							} else if (node.result === 'loss') {
								if (!losses[userA]) losses[userA] = 0;
								losses[userA]++;
							}
						}
					}
				}

				node.children.forEach(child => {
					if (child) queue.push(child);
				});
			}
		} else if (this.info.bracketData.type === 'table') {
			if (!this.info.bracketData.tableHeaders || !this.info.bracketData.tableHeaders.cols) return;
			for (let i = 0; i < this.info.bracketData.tableHeaders.cols.length; i++) {
				const player = toID(this.info.bracketData.tableHeaders.cols[i]);
				if (!players[player]) players[player] = this.info.bracketData.tableHeaders.cols[i];
			}
		}

		if (!this.totalPlayers) this.totalPlayers = Object.keys(players).length;

		// clear users who are now guests (currently can't be tracked)
		for (const i in this.players) {
			if (!(i in players)) delete this.players[i];
		}

		for (const i in players) {
			const player = this.createPlayer(players[i]) || this.players[i];
			if (player.eliminated) continue;
			if (losses[i] && losses[i] !== player.losses) {
				player.losses = losses[i];
				if (player.losses >= this.generator) {
					player.eliminated = true;
				}
			}
		}
	}

	onBattleStart(usernameA: string, usernameB: string, roomid: string): void {
		const idA = Tools.toId(usernameA);
		const idB = Tools.toId(usernameB);
		if (!(idA in this.players) || !(idB in this.players)) {
			console.log("Player not found for " + usernameA + " vs. " + usernameB + " in " + roomid);
			return;
		}
		this.currentBattles.push({
			playerA: this.players[idA],
			playerB: this.players[idB],
			roomid,
		});

		this.battleRooms.push(roomid);

		if (this.generator === 1 && this.getRemainingPlayerCount() === 2) {
			this.sayCommand("/wall Final battle of the " + this.name + " " + this.activityType + ": <<" + roomid + ">>!");
		}
		if (this.joinBattles) {
			const battleRoom = Rooms.add(roomid);
			battleRoom.tournament = this;
			this.sayCommand("/join " + roomid);
		}
	}

	onBattleEnd(usernameA: string, usernameB: string, score: [string, string], roomid: string): void {
		const idA = Tools.toId(usernameA);
		const idB = Tools.toId(usernameB);
		if (!(idA in this.players) || !(idB in this.players)) {
			console.log("Player not found for " + usernameA + " vs. " + usernameB + " in " + roomid);
			return;
		}
		for (let i = 0; i < this.currentBattles.length; i++) {
			if (this.currentBattles[i].playerA === this.players[idA] && this.currentBattles[i].playerB === this.players[idB] && this.currentBattles[i].roomid === roomid) {
				this.currentBattles.splice(i, 1);
				break;
			}
		}

		if (this.joinBattles) {
			const room = Rooms.get(roomid);
			if (room) room.say("/leave");
		}
	}
}
