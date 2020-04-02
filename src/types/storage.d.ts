import { GroupName } from "../client";
import { IServerGroup } from "./client-message-types";
import { IFormat } from "./in-game-data-types";

interface IEventInformation {
	name: string;
	link?: {description: string; url: string};
	formatIds?: string[];
}

interface ILeaderboardEntry {
	annual: number;
	annualSources: Dict<number>;
	current: number;
	name: string;
	sources: Dict<number>;
}

interface IQueuedUserHostedGame {
	format: string;
	id: string;
	name: string;
}

interface IBotGreeting {
	greeting: string;
	expiration?: number;
}

export interface IPastTournament {
	inputTarget: string;
	name: string;
	time: number;
}

export interface IPastGame {
	inputTarget: string;
	name: string;
	time: number;
}

export type UserHostStatus = 'unapproved' | 'novice' | 'approved';

export interface IDatabase {
	botGreetings?: Dict<IBotGreeting>;
	eventInformation?: Dict<IEventInformation>;
	gameAchievements?: Dict<string[]>;
	hosts?: string[];
	tourRuleset?: string[];
	tourcfg?: {
		autodq: {
			randoms: number | 'off';
			normal: number | 'off';
		};
		autostart: number | 'off';
	};
	samples?: {[k: string]: string[]};
	ruleset?: {
		[k: string]: {
			name: string;
			baseFormat: IFormat;
			remrules: string[];
			addrules: string[];
			bans: string[];
			unbans: string[];
			aliases?: string[];
		};
	};
	rank?: {
		pokeitem: GroupName;
	};
	lastGameFormatTimes?: Dict<number>;
	lastGameTime?: number;
	lastTournamentFormatTimes?: Dict<number>;
	lastTournamentTime?: number;
	lastUserHostedGameFormatTimes?: Dict<number>;
	lastUserHostedGameTime?: number;
	leaderboard?: Dict<ILeaderboardEntry>;
	pastGames?: IPastGame[];
	pastTournaments?: IPastTournament[];
	pastUserHostedGames?: IPastGame[];
	queuedTournament?: {formatid: string; playerCap: number; scheduled: boolean; time: number};
	thcWinners?: Dict<string>;
	userHostedGameQueue?: IQueuedUserHostedGame[];
	userHostStatuses?: Dict<UserHostStatus>;
}

interface IOfflineMessage {
	message: string;
	readTime: number;
	sender: string;
	sentTime: number;
	expired?: boolean;
}

export interface IGlobalDatabase {
	offlineMessages?: Dict<IOfflineMessage[]>;
}

interface IAuctions {
	auctions: {
		[k: string]: {
			name: string;
			startMoney: number;
			owners: string[];
			rooms: string[];
			managers: {};
			teams: {};
			running: boolean;
			allowNom: string;
			nomOrder: string[];
			nomQueue: string[];
			nommedPlayer: string;
			bid: number;
			bidder: string;
			players: {};
		};
	};
}

export interface IAuctionDatabase {
	rooms: Dict<IAuctions>;
}
