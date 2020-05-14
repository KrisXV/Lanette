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
	gameCount?: number;
	thcWinners?: Dict<string>;
	userHostedGameCount?: number;
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
}

interface IOfflineMessage {
	message: string;
	readTime: number;
	sender: string;
	sentTime: number;
	expired?: boolean;
}

export interface IGlobalDatabase {
	lastSeen?: Dict<number>;
	offlineMessages?: Dict<IOfflineMessage[]>;
	emojis?: Dict<string>;
}
