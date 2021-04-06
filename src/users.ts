import type { ScriptedGame } from "./room-game-scripted";
import type { Room } from "./rooms";
import type { GroupName, IChatLogEntry, MessageListener } from "./types/client";
import type { IUserMessageOptions, IUserRoomData } from "./types/users";

const chatFormatting: string[] = ["*", "_", "`", "~", "^", "\\"];

export class User {
	away: boolean | null = null;
	chatLog: IChatLogEntry[] = [];
	game: ScriptedGame | undefined = undefined;
	group: string | null = null;
	rooms = new Map<Room, IUserRoomData>();
	status: string | null = null;

	id: string;
	name!: string;

	htmlMessageListeners?: Dict<MessageListener>;
	messageListeners?: Dict<MessageListener>;
	uhtmlMessageListeners?: Dict<Dict<MessageListener>>;

	constructor(name: string, id: string) {
		this.id = id;

		this.setName(name);
	}

	setName(name: string): void {
		name = Tools.stripHtmlCharacters(name);

		while (chatFormatting.includes(name.charAt(0))) {
			name = name.substr(1).trim();
		}

		while (chatFormatting.includes(name.substr(-1))) {
			name = name.substr(0, name.length - 1).trim();
		}

		for (const formatting of chatFormatting) {
			const doubleFormatting = formatting + formatting;
			while (name.includes(doubleFormatting)) {
				name = name.replace(doubleFormatting, "").trim();
			}
		}

		this.name = name;
	}

	addChatLog(log: string): void {
		this.chatLog.unshift({log, type: 'chat'});
		this.trimChatLog();
	}

	addHtmlChatLog(log: string): void {
		this.chatLog.unshift({log, type: 'html'});
		this.trimChatLog();
	}

	addUhtmlChatLog(uhtmlName: string, log: string): void {
		this.chatLog.unshift({log, type: 'uhtml', uhtmlName});
		this.trimChatLog();
	}

	trimChatLog(): void {
		while (this.chatLog.length > 30) {
			this.chatLog.pop();
		}
	}

	hasRank(room: Room, targetRank: GroupName): boolean {
		if (!this.rooms.has(room)) return false;
		const groupSymbols = Client.getGroupSymbols();
		if (!(targetRank in groupSymbols)) return false;
		const serverGroups = Client.getServerGroups();
		return serverGroups[this.rooms.get(room)!.rank].ranking >= serverGroups[groupSymbols[targetRank]].ranking;
	}

	isBot(room: Room): boolean {
		if (!this.rooms.has(room)) return false;
		const groupSymbols = Client.getGroupSymbols();
		if (!groupSymbols.bot) return false;
		return this.rooms.get(room)!.rank === groupSymbols.bot;
	}

	isDeveloper(): boolean {
		return Config.developers && Config.developers.includes(this.id) ? true : false;
	}

	isIdleStatus(): boolean {
		if (!this.status) return false;
		const status = Tools.toId(this.status);
		return !(status === 'busy' || status === 'idle' || status === 'away');
	}

	updateStatus(status: string, away: boolean): void {
		this.status = status;
		this.away = away;

		this.rooms.forEach((value, room) => {
			if (room.game && room.game.onUserUpdateStatus) room.game.onUserUpdateStatus(this, status, away);
			if (room.tournament && room.tournament.onUserUpdateStatus) room.tournament.onUserUpdateStatus(this, status, away);
			if (room.userHostedGame && room.userHostedGame.onUserUpdateStatus) room.userHostedGame.onUserUpdateStatus(this, status, away);
		});
	}

	say(message: string, options?: IUserMessageOptions): void {
		if (!global.Users.get(this.name)) return;

		if (!(options && options.dontPrepare)) message = Tools.prepareMessage(message);
		if (!(options && options.dontCheckFilter)) {
			const filter = Client.checkFilters(message);
			if (filter) {
				Tools.logMessage("Message not sent to " + this.name + " due to " + filter + ": " + message);
				return;
			}
		}

		const type = options && options.type ? options.type : 'pm';
		Client.send({
			message: "|/pm " + this.name + ", " + message,
			text: message,
			type,
			serverProcessingType: type === 'command' ? 'not-measured' : 'pm',
			user: this.id,
			measure: !(options && options.dontMeasure),
		});
	}

	canPerform(room: Room, targetRank: GroupName = 'roomowner'): boolean {
		return this.hasRank(room, targetRank) || this.isDeveloper();
	}

	isHost(room: Room): boolean {
		const hosts = Storage.getDatabase(room).hosts;
		// eslint-disable-next-line @typescript-eslint/unbound-method
		if (hosts) return hosts.map(Tools.toId).includes(this.id);
		return false;
	}

	isEmojiWhitelisted(room: Room): boolean {
		const storage = Storage.getDatabase(room);
		if (!storage.emojiWhitelist) return false;
		return storage.emojiWhitelist.includes(this.id);
	}

	sayCommand(command: string, dontCheckFilter?: boolean): void {
		this.say(command, {dontCheckFilter, dontPrepare: true, dontMeasure: true, type: 'command'});
	}

	on(message: string, listener: MessageListener): void {
		if (!this.messageListeners) this.messageListeners = {};
		this.messageListeners[Tools.toId(Tools.prepareMessage(message))] = listener;
	}

	onHtml(html: string, listener: MessageListener): void {
		if (!this.htmlMessageListeners) this.htmlMessageListeners = {};
		this.htmlMessageListeners[Tools.toId(Client.getListenerHtml(html, true))] = listener;
	}

	onUhtml(name: string, html: string, listener: MessageListener): void {
		const id = Tools.toId(name);
		if (!this.uhtmlMessageListeners) this.uhtmlMessageListeners = {};
		if (!(id in this.uhtmlMessageListeners)) this.uhtmlMessageListeners[id] = {};
		this.uhtmlMessageListeners[id][Tools.toId(Client.getListenerUhtml(html, true))] = listener;
	}

	off(message: string): void {
		if (!this.messageListeners) return;
		delete this.messageListeners[Tools.toId(Tools.prepareMessage(message))];
	}

	offHtml(html: string): void {
		if (!this.htmlMessageListeners) return;
		delete this.htmlMessageListeners[Tools.toId(Client.getListenerHtml(html, true))];
	}

	offUhtml(name: string, html: string): void {
		if (!this.uhtmlMessageListeners) return;
		const id = Tools.toId(name);
		if (!(id in this.uhtmlMessageListeners)) return;
		delete this.uhtmlMessageListeners[id][Tools.toId(Client.getListenerUhtml(html, true))];
	}

	getBotRoom(): Room | undefined {
		let botRoom: Room | undefined;
		this.rooms.forEach((data, room) => {
			if (!botRoom && global.Users.self.isBot(room) && room.type === 'chat') botRoom = room;
		});

		return botRoom;
	}
}

export class Users {
	self: User;

	private users: Dict<User> = {};

	constructor() {
		const username = Config.username || "Self";
		this.self = this.add(username, Tools.toId(username));
	}

	getNameFormattingList(): string[] {
		return chatFormatting;
	}

	/** Should only be used when interacting with a potentially new user (in Client) */
	add(name: string, id: string): User {
		if (!(id in this.users)) this.users[id] = new User(name, id);
		return this.users[id];
	}

	get(name: string): User | undefined {
		return this.users[Tools.toId(name)];
	}

	remove(user: User): void {
		if (user === this.self) return;

		const id = user.id;
		for (const i in user) {
			// @ts-expect-error
			delete user[i];
		}

		delete this.users[id];
	}

	removeAll(): void {
		for (const i in this.users) {
			this.remove(this.users[i]);
		}
	}

	getUserIds(): string[] {
		return Object.keys(this.users);
	}

	rename(name: string, oldId: string): User {
		const id = Tools.toId(name);
		if (!(oldId in this.users)) return this.add(name, id);

		const user = this.users[oldId];
		delete this.users[oldId];
		if (id in this.users) return this.users[id];

		user.setName(name);
		user.id = id;
		this.users[id] = user;
		user.rooms.forEach((value, room) => {
			if (room.game) room.game.renamePlayer(user, oldId);
			if (room.tournament) room.tournament.renamePlayer(user, oldId);
			if (room.userHostedGame) room.userHostedGame.renamePlayer(user, oldId);
		});

		return user;
	}
}

export const instantiate = (): void => {
	global.Users = new Users();
};