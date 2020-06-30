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

export interface IUserHostedGameStats {
	endTime: number;
	format: string;
	inputTarget: string;
	playerCount: number;
	startTime: number;
}

export type UserHostStatus = 'unapproved' | 'novice' | 'approved';

export type LeaderboardType = 'gameLeaderboard' | 'tournamentLeaderboard' | 'unsortedLeaderboard';

export type Leaderboard = Dict<ILeaderboardEntry>;

export interface IDatabase {
	botGreetings?: Dict<IBotGreeting>;
	eventInformation?: Dict<IEventInformation>;
	gameAchievements?: Dict<string[]>;
	gameCount?: number;
	gameLeaderboard?: Leaderboard;
	lastGameFormatTimes?: Dict<number>;
	lastGameTime?: number;
	lastTournamentFormatTimes?: Dict<number>;
	lastTournamentTime?: number;
	lastUserHostedGameFormatTimes?: Dict<number>;
	lastUserHostedGameTime?: number;
	pastGames?: IPastGame[];
	pastTournaments?: IPastTournament[];
	pastUserHostedGames?: IPastGame[];
	previousUserHostedGameStats?: Dict<IUserHostedGameStats[]>;
	queuedTournament?: {formatid: string; playerCap: number; scheduled: boolean; time: number};
	roomSampleTeamsLink?: string;
	thcWinners?: Dict<string>;
	tournamentLeaderboard?: Leaderboard;
	unsortedLeaderboard?: Leaderboard;
	userHostedGameCount?: number;
	userHostedGameStats?: Dict<IUserHostedGameStats[]>;
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
	expired?: boolean;
}

export interface IGlobalDatabase {
	lastSeen?: Dict<number>;
	offlineMessages?: Dict<IOfflineMessage[]>;
	emojis?: Dict<string>;
	privateRooms?: string[];
}
