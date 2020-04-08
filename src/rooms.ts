import { GroupName } from "./client";
import { Player } from "./room-activity";
import { IRoomInfoResponse } from "./types/client-message-types";
import { User } from "./users";

export type RoomType = 'battle' | 'chat' | 'html';

export class Room {
	bannedWords: string[] | null = null;
	bannedWordsRegex: RegExp | null = null;
	readonly htmlMessageListeners: Dict<() => void> = {};
	readonly messageListeners: Dict<() => void> = {};
	modchat: string = 'off';
	timers: Dict<NodeJS.Timer> | null = null;
	readonly uhtmlMessageListeners: Dict<Dict<() => void>> = {};
	readonly users = new Set<User>();

	readonly id: string;
	readonly sendId: string;
	title: string;
	type!: RoomType;

	// set immediately in checkConfigSettings()

	constructor(id: string) {
		this.id = id;
		this.sendId = id === 'lobby' ? '' : id;
		this.title = id;

		this.checkConfigSettings();
	}

	init(type: RoomType): void {
		this.type = type;
	}

	deInit(): void {
		this.users.forEach(user => {
			user.rooms.delete(this);
			if (!user.rooms.size) Users.remove(user);
		});
	}

	// eslint-disable-next-line @typescript-eslint/no-empty-function
	checkConfigSettings(): void {}

	onRoomInfoResponse(response: IRoomInfoResponse): void {
		this.modchat = response.modchat === false ? 'off' : response.modchat;
		this.title = response.title;
	}

	say(message: string, dontPrepare?: boolean, dontCheckFilter?: boolean): void {
		if (!dontPrepare) message = Tools.prepareMessage(message);
		if (!dontCheckFilter && Client.willBeFiltered(message, this)) return;
		Client.send(this.sendId + "|" + message);
	}

	sayCommand(command: string, dontCheckFilter?: boolean): void {
		this.say(command, true, dontCheckFilter);
	}

	sayHtml(html: string): void {
		this.say("/addhtmlbox " + html, true, true);
	}

	sayUhtml(uhtmlName: string, html: string): void {
		this.say("/adduhtml " + uhtmlName + ", " + html, true, true);
	}

	sayUhtmlChange(uhtmlName: string, html: string): void {
		this.say("/changeuhtml " + uhtmlName + ", " + html, true, true);
	}

	sayAuthUhtml(uhtmlName: string, html: string): void {
		this.say("/addrankuhtml +, " + uhtmlName + ", " + html, true, true);
	}

	sayAuthUhtmlChange(uhtmlName: string, html: string): void {
		this.say("/changerankuhtml +, " + uhtmlName + ", " + html, true, true);
	}

	sayModUhtml(uhtmlName: string, html: string, rank: GroupName): void {
		this.say("/addrankuhtml " + Client.groupSymbols[rank] + ", " + uhtmlName + ", " + html, true, true);
	}

	sayModUhtmlChange(uhtmlName: string, html: string, rank: GroupName): void {
		this.say("/changerankuhtml " + Client.groupSymbols[rank] + ", " + uhtmlName + ", " + html, true, true);
	}

	pmHtml(user: User | Player, html: string): void {
		this.say("/pminfobox " + user.id + "," + html, true);
	}

	pmUhtml(user: User | Player, uhtmlName: string, html: string): void {
		this.say("/pmuhtml " + user.id + "," + uhtmlName + "," + html, true);
	}

	pmUhtmlChange(user: User | Player, uhtmlName: string, html: string): void {
		this.say("/pmuhtmlchange " + user.id + "," + uhtmlName + "," + html, true);
	}

	on(message: string, listener: () => void): void {
		this.messageListeners[Tools.toId(Tools.prepareMessage(message))] = listener;
	}

	onHtml(html: string, listener: () => void): void {
		this.htmlMessageListeners[Tools.toId(Client.getListenerHtml(html))] = listener;
	}

	onUhtml(name: string, html: string, listener: () => void): void {
		const id = Tools.toId(name);
		if (!(id in this.uhtmlMessageListeners)) this.uhtmlMessageListeners[id] = {};
		this.uhtmlMessageListeners[id][toID(Client.getListenerUhtml(html))] = listener;
	}

	off(message: string): void {
		delete this.messageListeners[Tools.toId(Tools.prepareMessage(message))];
	}

	offHtml(html: string): void {
		delete this.htmlMessageListeners[Tools.toId(Client.getListenerHtml(html))];
	}

	offUhtml(name: string, html: string): void {
		const id = Tools.toId(name);
		if (!(id in this.uhtmlMessageListeners)) return;
		delete this.uhtmlMessageListeners[id][toID(Client.getListenerUhtml(html))];
	}
}

export class Rooms {
	private rooms: Dict<Room> = {};

	add(id: string): Room {
		if (!(id in this.rooms)) this.rooms[id] = new Room(id);
		return this.rooms[id];
	}

	remove(room: Room): void {
		room.deInit();
		delete this.rooms[room.id];
	}

	removeAll(): void {
		for (const i in this.rooms) {
			this.remove(this.rooms[i]);
		}
	}

	get(id: string): Room | undefined {
		return this.rooms[id];
	}

	search(input: string): Room | undefined {
		let id = Tools.toRoomId(input);
		if (Config.roomAliases && !(id in this.rooms) && Config.roomAliases[id]) id = Config.roomAliases[id];
		return this.get(id);
	}

	checkLoggingConfigs(): void {
		for (const i in this.rooms) {
			this.rooms[i].checkConfigSettings();
		}
	}
}
