import fs = require('fs');
import path = require('path');

import { Room } from './rooms';
import { IAuctionDatabase, IDatabase, IGlobalDatabase } from './types/storage';
import { User } from './users';
import { LogsWorker } from './workers/logs';

const MAX_QUEUED_OFFLINE_MESSAGES = 3;
const LAST_SEEN_EXPIRATION = 30 * 24 * 60 * 60 * 1000;
const OFFLINE_MESSAGE_EXPIRATION = 30 * 24 * 60 * 60 * 1000;

const globalDatabaseId = 'globalDB';
const auctionDatabaseId = 'auctions';
const hostingDatabaseSuffix = '-hostingDB';
const archivedDatabasesDir = path.join(Tools.rootFolder, 'archived-databases');
const databasesDir = path.join(Tools.rootFolder, 'databases');
const baseOfflineMessageLength = '[28 Jun 2019, 00:00:00 GMT-0500] **** said: '.length;

interface IStorageWorkers {
	logs: LogsWorker;
}

export class Storage {
	databases: Dict<IDatabase> = {};
	loadedDatabases: boolean = false;
	workers: IStorageWorkers = {
		logs: new LogsWorker(),
	};

	globalDatabaseExportInterval: NodeJS.Timer;

	constructor() {
		this.globalDatabaseExportInterval = this.setGlobalDatabaseExportInterval();
	}

	onReload(previous: Partial<Storage>) {
		if (previous.databases) this.databases = previous.databases;
		if (previous.loadedDatabases) this.loadedDatabases = previous.loadedDatabases;

		if (previous.globalDatabaseExportInterval) clearInterval(previous.globalDatabaseExportInterval);
		this.globalDatabaseExportInterval = this.setGlobalDatabaseExportInterval();
	}

	unrefWorkers(): void {
		const workers = Object.keys(this.workers) as (keyof IStorageWorkers)[];
		for (let i = 0; i < workers.length; i++) {
			this.workers[workers[i]].unref();
		}
	}

	setGlobalDatabaseExportInterval(): NodeJS.Timer {
		return setInterval(() => this.exportDatabase(globalDatabaseId), 15 * 60 * 1000);
	}

	getDatabase(room: Room): IDatabase {
		if (!(room.id in this.databases)) this.databases[room.id] = {};
		return this.databases[room.id];
	}

	getGlobalDatabase(): IGlobalDatabase {
		if (!(globalDatabaseId in this.databases)) this.databases[globalDatabaseId] = {};
		return this.databases[globalDatabaseId] as IGlobalDatabase;
	}

	getAuctionDatabase(): IAuctionDatabase {
		if (!(auctionDatabaseId in this.databases)) this.databases[auctionDatabaseId] = {};
		return this.databases[auctionDatabaseId] as IAuctionDatabase;
	}

	getHostingDatabase(room: Room): IDatabase {
		const id = room.id + hostingDatabaseSuffix;
		if (!(id in this.databases)) this.databases[id] = {};
		return this.databases[id];
	}

	exportDatabase(roomid: string): void {
		if (!(roomid in this.databases) || roomid.startsWith('battle-') || roomid.startsWith('groupchat-')) return;
		const contents = JSON.stringify(this.databases[roomid]);
		Tools.safeWriteFileSync(path.join(databasesDir, roomid + '.json'), contents);
	}

	exportAuctionDatabase() {
		if (!(auctionDatabaseId in this.databases)) return;
		const contents = JSON.stringify(this.databases[auctionDatabaseId]);
		Tools.safeWriteFileSync(path.join(databasesDir, auctionDatabaseId + '.json'), contents);
	}

	archiveDatabase(roomid: string) {
		if (!(roomid in this.databases) || roomid.startsWith('battle-') || roomid.startsWith('groupchat-')) return;
		const date = new Date();
		const year = date.getFullYear();
		const month = date.getMonth() + 1;
		const day = date.getDate();
		const filename = roomid + '-' + year + '-' + (month < 10 ? '0' : '') + month + '-' + (day < 10 ? '0' : '') + day + '-at-' + Tools.toTimestampString(date).split(' ')[1].split(':').join('-');
		const contents = JSON.stringify(this.databases[roomid]);
		Tools.safeWriteFileSync(path.join(archivedDatabasesDir, filename + '.json'), contents);
	}

	importDatabases(): void {
		if (this.loadedDatabases) return;

		const databases = fs.readdirSync(databasesDir);
		for (let i = 0; i < databases.length; i++) {
			const fileName = databases[i];
			if (!fileName.endsWith('.json')) continue;
			const id = fileName.substr(0, fileName.indexOf('.json'));
			const file = fs.readFileSync(path.join(databasesDir, fileName)).toString();
			this.databases[id] = JSON.parse(file);
		}

		const globalDatabase = this.getGlobalDatabase();

		this.loadedDatabases = true;
	}

	exportDatabases(): void {
		for (const i in this.databases) {
			this.exportDatabase(i);
		}
	}

	clearLeaderboard(roomid: string): boolean {
		if (!(roomid in this.databases) || !this.databases[roomid].leaderboard) return false;
		this.archiveDatabase(roomid);
		const date = new Date();
		const month = date.getMonth() + 1;
		const day = date.getDate();
		const clearAnnual = (month === 12 && day === 31) || (month === 1 && day === 1);
		for (const i in this.databases[roomid].leaderboard) {
			const user = this.databases[roomid].leaderboard![i];
			if (clearAnnual) {
				user.annual = 0;
			} else {
				user.annual += user.current;
			}
			user.current = 0;

			if (clearAnnual) {
				user.annualSources = {};
			} else {
				for (const source in user.sources) {
					if (source in user.annualSources) {
						user.annualSources[source] += user.sources[source];
					} else {
						user.annualSources[source] = user.sources[source];
					}
				}
			}
			user.sources = {};
		}
		if (roomid + hostingDatabaseSuffix in this.databases) this.clearLeaderboard(roomid + hostingDatabaseSuffix);
		this.exportDatabase(roomid);
		return true;
	}

	createLeaderboardEntry(database: IDatabase, name: string, id: string): void {
		database.leaderboard![id] = {
			annual: 0,
			annualSources: {},
			current: 0,
			name,
			sources: {},
		};
	}

	addPoints(room: Room, name: string, amount: number, source: string): void {
		if (!amount) return;
		if (amount < 0) return this.removePoints(room, name, amount * -1, source);
		const database = this.getDatabase(room);
		if (!database.leaderboard) database.leaderboard = {};
		name = Tools.toAlphaNumeric(name);
		const id = toID(name);
		if (!id) return;
		source = toID(source);
		if (!source) return;
		if (!(id in database.leaderboard)) {
			this.createLeaderboardEntry(database, name, id);
		} else {
			database.leaderboard[id].name = name;
		}
		database.leaderboard[id].current += amount;
		if (!(source in database.leaderboard[id].sources)) database.leaderboard[id].sources[source] = 0;
		database.leaderboard[id].sources[source] += amount;
	}

	removePoints(room: Room, name: string, amount: number, source: string): void {
		if (!amount) return;
		if (amount < 0) return this.addPoints(room, name, amount * -1, source);
		const database = this.getDatabase(room);
		if (!database.leaderboard) return;
		name = Tools.toAlphaNumeric(name);
		const id = toID(name);
		if (!(id in database.leaderboard)) return;
		source = toID(source);
		if (!source) return;
		database.leaderboard[id].name = name;
		database.leaderboard[id].current -= amount;
		if (database.leaderboard[id].current < 0) database.leaderboard[id].current = 0;
		if (source in database.leaderboard[id].sources) {
			database.leaderboard[id].sources[source] -= amount;
			if (database.leaderboard[id].sources[source] <= 0) delete database.leaderboard[id].sources[source];
		}
	}

	transferData(roomid: string, source: string, destination: string): boolean {
		if (!(roomid in this.databases)) return false;
		const sourceId = toID(source);
		const destinationId = toID(destination);
		if (!sourceId || !destinationId || sourceId === destinationId) return false;
		const database = this.databases[roomid];
		if (database.leaderboard && sourceId in database.leaderboard) {
			if (!(destinationId in database.leaderboard)) this.createLeaderboardEntry(database, destination, destinationId);
			for (const source in database.leaderboard[sourceId].sources) {
				if (source in database.leaderboard[destinationId].sources) {
					database.leaderboard[destinationId].sources[source] += database.leaderboard[sourceId].sources[source];
				} else {
					database.leaderboard[destinationId].sources[source] = database.leaderboard[sourceId].sources[source];
				}
				delete database.leaderboard[sourceId].sources[source];
			}
			for (const source in database.leaderboard[sourceId].annualSources) {
				if (source in database.leaderboard[destinationId].annualSources) {
					database.leaderboard[destinationId].annualSources[source] += database.leaderboard[sourceId].annualSources[source];
				} else {
					database.leaderboard[destinationId].annualSources[source] = database.leaderboard[sourceId].annualSources[source];
				}
				delete database.leaderboard[sourceId].annualSources[source];
			}
			database.leaderboard[destinationId].current += database.leaderboard[sourceId].current;
			database.leaderboard[sourceId].current = 0;
			database.leaderboard[destinationId].annual += database.leaderboard[sourceId].annual;
			database.leaderboard[sourceId].annual = 0;
		}

		if (database.gameAchievements && sourceId in database.gameAchievements) {
			if (!(destinationId in database.gameAchievements)) database.gameAchievements[destinationId] = [];
			for (let i = 0; i  < database.gameAchievements[sourceId].length; i++) {
				const achievement = database.gameAchievements[sourceId][i];
				if (!database.gameAchievements[destinationId].includes(achievement)) database.gameAchievements[destinationId].push(achievement);
			}
		}

		if (roomid + hostingDatabaseSuffix in this.databases) this.transferData(roomid + hostingDatabaseSuffix, source, destination);
		return true;
	}

	getMaxOfflineMessageLength(sender: User, message: string): number {
		return Tools.maxMessageLength - (baseOfflineMessageLength + sender.name.length);
	}

	storeOfflineMessage(sender: string, recipientId: string, message: string): boolean {
		const database = this.getGlobalDatabase();
		if (!database.offlineMessages) database.offlineMessages = {};
		if (recipientId in database.offlineMessages) {
			const senderId = toID(sender);
			let queuedMessages = 0;
			for (let i = 0; i < database.offlineMessages[recipientId].length; i++) {
				if (!database.offlineMessages[recipientId][i].readTime && toID(database.offlineMessages[recipientId][i].sender) === senderId) queuedMessages++;
			}
			if (queuedMessages > MAX_QUEUED_OFFLINE_MESSAGES) return false;
		} else {
			database.offlineMessages[recipientId] = [];
		}

		database.offlineMessages[recipientId].push({
			message,
			sender,
			readTime: 0,
			sentTime: Date.now(),
		});
		return true;
	}

	retrieveOfflineMessages(user: User, retrieveRead?: boolean): boolean {
		const database = this.getGlobalDatabase();
		if (!database.offlineMessages || !(user.id in database.offlineMessages)) return false;
		const now = Date.now();
		const expiredTime = now - OFFLINE_MESSAGE_EXPIRATION;
		let hasExpiredMessages = false;
		for (let i = 0; i < database.offlineMessages[user.id].length; i++) {
			const message = database.offlineMessages[user.id][i];
			if (message.readTime) {
				if (message.readTime <= expiredTime) {
					message.expired = true;
					if (!hasExpiredMessages) hasExpiredMessages = true;
				}
				if (!retrieveRead) continue;
			}
			const date = new Date(message.sentTime);
			let dateString = date.toUTCString();
			dateString = dateString.substr(dateString.indexOf(',') + 1);
			dateString = dateString.substr(0, dateString.indexOf(':') - 3);
			let timeString = date.toTimeString();
			timeString = timeString.substr(0, timeString.indexOf('('));
			user.say("[" + dateString.trim() + ", " + timeString.trim() + "] " + "**" + message.sender + "** said: " + message.message);
			message.readTime = now;
		}

		if (hasExpiredMessages) database.offlineMessages[user.id] = database.offlineMessages[user.id].filter(x => !x.expired);

		return true;
	}

	clearOfflineMessages(user: User): boolean {
		const database = this.getGlobalDatabase();
		if (!database.offlineMessages || !(user.id in database.offlineMessages)) return false;
		delete database.offlineMessages[user.id];
		return true;
	}

	checkBotGreeting(room: Room, user: User, timestamp: number): boolean {
		const database = this.getDatabase(room);
		if (!database.botGreetings || !(user.id in database.botGreetings)) return false;
		if (database.botGreetings[user.id].expiration && timestamp >= database.botGreetings[user.id].expiration!) {
			delete database.botGreetings[user.id];
			return false;
		}
		room.say(database.botGreetings[user.id].greeting);
		return true;
	}
}
