import type { TrainerSpriteId } from "./dex";
import type { HexCode, TimeZone } from "./tools";

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

export interface IGameTrainerCard {
	pokemon: string[];
	avatar?: TrainerSpriteId;
	background?: HexCode;
	pokemonGifs?: boolean;
}

export interface IGameHostBox {
	pokemon: string[];
	shinyPokemon: boolean[];
	background?: HexCode;
	buttons?: HexCode;
	signupsBackground?: HexCode;
	signupsButtons?: HexCode;
}

export interface IGameScriptedBox {
	pokemon: string[];
	background?: HexCode;
	buttons?: HexCode;
	signupsBackground?: HexCode;
	signupsButtons?: HexCode;
	previewFormat?: string;
}

export type UserHostStatus = 'unapproved' | 'novice' | 'approved';

export type LeaderboardType = 'gameLeaderboard' | 'gameHostingLeaderbaord' | 'tournamentLeaderboard' | 'unsortedLeaderboard';

export interface ILeaderboard {
	entries: Dict<ILeaderboardEntry>;
	sources: string[];
	type: LeaderboardType;
}

export interface ICachedLeaderboardEntry {
	id: string;
	points: number;
}

export interface IGameStat {
	format: string;
	inputTarget: string;
	startingPlayerCount: number;
	endingPlayerCount: number;
	startTime: number;
	endTime: number;
	winners: string[];
}

interface ILastCycleData {
	scriptedGameStats?: IGameStat[];
	userHostedGameStats?: Dict<IGameStat[]>;
}

export interface IDatabase {
	botGreetings?: Dict<IBotGreeting>;
	eventInformation?: Dict<IEventInformation>;
	gameAchievements?: Dict<string[]>;
	gameLeaderboard?: ILeaderboard;
	gameHostingLeaderbaord?: ILeaderboard;
	gameHostBoxes?: Dict<IGameHostBox>;
	gameScriptedBoxes?: Dict<IGameScriptedBox>;
	gameTrainerCards?: Dict<IGameTrainerCard>;
	lastCycleData?: ILastCycleData;
	lastGameFormatTimes?: Dict<number>;
	lastGameTime?: number;
	lastTournamentFormatTimes?: Dict<number>;
	lastTournamentTime?: number;
	lastUserHostedGameFormatTimes?: Dict<number>;
	lastUserHostedGameTime?: number;
	leaderboardManagers?: string[];
	miniGameCounts?: Dict<number>;
	pastGames?: IPastGame[];
	pastTournaments?: IPastTournament[];
	pastUserHostedGames?: IPastGame[];
	queuedTournament?: {formatid: string; playerCap: number; scheduled: boolean; time: number};
	roomSampleTeamsLink?: string;
	scriptedGameCounts?: Dict<number>;
	scriptedGameStats?: IGameStat[];
	thcWinners?: Dict<string>;
	tournamentLeaderboard?: ILeaderboard;
	unsortedLeaderboard?: ILeaderboard;
	userHostedGameCounts?: Dict<number>;
	userHostedGameStats?: Dict<IGameStat[]>;
	userHostedGameQueue?: IQueuedUserHostedGame[];
	userHostStatuses?: Dict<UserHostStatus>;
	hosts?: string[];
	tourRuleset?: string[];
	tourcfg?: {
		autodq: {
			randoms: number | 'off';
			normal: number | 'off';
		};
		autostart: number | 'off';
	};
	samples?: Dict<string[]>;
	ruleset?: {
		[k: string]: {
			name: string;
			baseFormat: string;
			remrules: string[];
			addrules: string[];
			bans: string[];
			unbans: string[];
			aliases?: string[];
		};
	};
	emojiWhitelist?: string[];
	lastTour?: number;
}

interface IOfflineMessage {
	message: string;
	readTime: number;
	sender: string;
	sentTime: number;
	discarded?: boolean;
}

export interface IGlobalDatabase {
	lastSeen?: Dict<number>;
	loginSessionCookie?: string;
	offlineMessages?: Dict<{messages: IOfflineMessage[], timezone?: TimeZone}>;
	emojis?: Dict<string>;
	privateRooms?: string[];
}
