import fs = require('fs');
import https = require('https');
import path = require('path');
import querystring = require('querystring');
import url = require('url');

import type { ClientOptions, Data } from 'ws';
import type { ScriptedGame } from './room-game-scripted';
import type { UserHostedGame } from './room-game-user-hosted';
import type { Room } from './rooms';
import type {
	GroupName, IClientMessageTypes, ILoginOptions, IMessageParserFile, IOutgoingMessage, IRoomInfoResponse, IRoomsResponse,
	IServerConfig, IServerGroup, IServerProcessingMeasurement, ITournamentMessageTypes, QueryResponseType, ServerProcessingType,
	ServerGroupData, IUserDetailsResponse
} from './types/client';
import type { ISeparatedCustomRules } from './types/dex';
import type { RoomType } from './types/rooms';
import type { IExtractedBattleId } from './types/tools';
import type { ITournamentEndJson, ITournamentUpdateJson } from './types/tournaments';
import type { User } from './users';

const MAIN_HOST = "sim3.psim.us";
const REPLAY_SERVER_ADDRESS = "replay.pokemonshowdown.com";
const CHALLSTR_TIMEOUT_SECONDS = 15;
const RELOGIN_SECONDS = 60;
const LOGIN_TIMEOUT_SECONDS = 150;
const SERVER_RESTART_CONNECTION_TIME = 10 * 1000;
const REGULAR_MESSAGE_THROTTLE = 625;
const TRUSTED_MESSAGE_THROTTLE = 125;
const SERVER_THROTTLE_BUFFER_LIMIT = 5;
const DEFAULT_LATENCY = 25;
const DEFAULT_PROCESSING_TIME = 25;
const MAX_MESSAGE_SIZE = 100 * 1024;
const BOT_GREETING_COOLDOWN = 6 * 60 * 60 * 1000;
const LATENCY_CHECK_INTERVAL = 15 * 1000;
const MAX_PROCESSING_MEASUREMENT_GAP = LATENCY_CHECK_INTERVAL;
const INVITE_COMMAND = '/invite ';
const HTML_CHAT_COMMAND = '/raw ';
const UHTML_CHAT_COMMAND = '/uhtml ';
const UHTML_CHANGE_CHAT_COMMAND = '/uhtmlchange ';
const HANGMAN_START_COMMAND = "/log A game of hangman was started by ";
const HANGMAN_END_COMMAND = "/log (The game of hangman was ended by ";
const HANGMAN_END_RAW_MESSAGE = "The game of hangman was ended.";
const USER_NOT_FOUND_MESSAGE = "/error User ";

const FILTERS_REGEX_N = /\u039d/g;
// eslint-disable-next-line no-misleading-character-class
const FILTERS_REGEX_EMPTY_CHARACTERS = /[\u200b\u007F\u00AD\uDB40\uDC00\uDC21]/g;
const FILTERS_REGEX_O_LEFT = /\u03bf/g;
const FILTERS_REGEX_O_RIGHT = /\u043e/g;
const FILTERS_REGEX_A = /\u0430/g;
const FILTERS_REGEX_E_LEFT = /\u0435/g;
const FILTERS_REGEX_E_RIGHT = /\u039d/g;
const FILTERS_REGEX_FORMATTING = /__|\*\*|``|\[\[|\]\]/g;

const DEFAULT_GROUP_SYMBOLS: KeyedDict<GroupName, string> = {
	'administrator': '&',
	'roomowner': '#',
	'host': '\u2605',
	'moderator': '@',
	'driver': '%',
	'bot': '*',
	'player': '\u2606',
	'voice': '+',
	'prizewinner': '^',
	'regularuser': ' ',
	'muted': '!',
	'locked': '\u203d',
};

const DEFAULT_SERVER_GROUPS: ServerGroupData[] = [
	{
		"symbol": DEFAULT_GROUP_SYMBOLS.administrator,
		"name": "Administrator",
		"type": "leadership",
	},
	{
		"symbol": DEFAULT_GROUP_SYMBOLS.roomowner,
		"name": "Room Owner",
		"type": "leadership",
	},
	{
		"symbol": DEFAULT_GROUP_SYMBOLS.host,
		"name": "Host",
		"type": "leadership",
	},
	{
		"symbol": DEFAULT_GROUP_SYMBOLS.moderator,
		"name": "Moderator",
		"type": "staff",
	},
	{
		"symbol": DEFAULT_GROUP_SYMBOLS.driver,
		"name": "Driver",
		"type": "staff",
	},
	{
		"symbol": DEFAULT_GROUP_SYMBOLS.bot,
		"name": "Bot",
		"type": "normal",
	},
	{
		"symbol": DEFAULT_GROUP_SYMBOLS.player,
		"name": "Player",
		"type": "normal",
	},
	{
		"symbol": DEFAULT_GROUP_SYMBOLS.voice,
		"name": "Voice",
		"type": "normal",
	},
	{
		"symbol": DEFAULT_GROUP_SYMBOLS.prizewinner,
		"name": "Prize Winner",
		"type": "normal",
	},
	{
		"symbol": DEFAULT_GROUP_SYMBOLS.regularuser,
		"name": null,
		"type": "normal",
	},
	{
		"symbol": DEFAULT_GROUP_SYMBOLS.muted,
		"name": "Muted",
		"type": "punishment",
	},
	{
		"symbol": DEFAULT_GROUP_SYMBOLS.locked,
		"name": "Locked",
		"type": "punishment",
	},
];

/* eslint-disable max-len */
// Substitution dictionary adapted from https://github.com/ThreeLetters/NoSwearingPlease/blob/master/index.js, licensed under MIT.
const EVASION_DETECTION_SUBSTITUTIONS: Dict<string[]> = {
	a: ["a", "4", "@", "á", "â", "ã", "à", "ᗩ", "A", "ⓐ", "Ⓐ", "α", "͏", "₳", "ä", "Ä", "Ꮧ", "λ", "Δ", "Ḁ", "Ꭺ", "ǟ", "̾", "ａ", "Ａ", "ᴀ", "ɐ", "🅐", "𝐚", "𝐀", "𝘢", "𝘈", "𝙖", "𝘼", "𝒶", "𝓪", "𝓐", "𝕒", "𝔸", "𝔞", "𝔄", "𝖆", "𝕬", "🄰", "🅰", "𝒜", "𝚊", "𝙰", "ꍏ", "а"],
	b: ["b", "8", "ᗷ", "B", "ⓑ", "Ⓑ", "в", "฿", "ḅ", "Ḅ", "Ᏸ", "ϐ", "Ɓ", "ḃ", "Ḃ", "ɮ", "ｂ", "Ｂ", "ʙ", "🅑", "𝐛", "𝐁", "𝘣", "𝘉", "𝙗", "𝘽", "𝒷", "𝓫", "𝓑", "𝕓", "𝔹", "𝔟", "𝔅", "𝖇", "𝕭", "🄱", "🅱", "𝐵", "Ⴆ", "𝚋", "𝙱", "♭", "b"],
	c: ["c", "ç", "ᑕ", "C", "ⓒ", "Ⓒ", "¢", "͏", "₵", "ċ", "Ċ", "ፈ", "ς", "ḉ", "Ḉ", "Ꮯ", "ƈ", "̾", "ｃ", "Ｃ", "ᴄ", "ɔ", "🅒", "𝐜", "𝐂", "𝘤", "𝘊", "𝙘", "𝘾", "𝒸", "𝓬", "𝓒", "𝕔", "ℂ", "𝔠", "ℭ", "𝖈", "𝕮", "🄲", "🅲", "𝒞", "𝚌", "𝙲", "☾", "с"],
	d: ["d", "ᗪ", "D", "ⓓ", "Ⓓ", "∂", "Đ", "ď", "Ď", "Ꮄ", "Ḋ", "Ꭰ", "ɖ", "ｄ", "Ｄ", "ᴅ", "🅓", "𝐝", "𝐃", "𝘥", "𝘋", "𝙙", "𝘿", "𝒹", "𝓭", "𝓓", "𝕕", "​", "𝔡", "𝖉", "𝕯", "🄳", "🅳", "𝒟", "ԃ", "𝚍", "𝙳", "◗", "ⅾ"],
	e: ["e", "3", "é", "ê", "E", "ⓔ", "Ⓔ", "є", "͏", "Ɇ", "ệ", "Ệ", "Ꮛ", "ε", "Σ", "ḕ", "Ḕ", "Ꭼ", "ɛ", "̾", "ｅ", "Ｅ", "ᴇ", "ǝ", "🅔", "𝐞", "𝐄", "𝘦", "𝘌", "𝙚", "𝙀", "ℯ", "𝓮", "𝓔", "𝕖", "𝔻", "𝔢", "𝔇", "𝖊", "𝕰", "🄴", "🅴", "𝑒", "𝐸", "ҽ", "𝚎", "𝙴", "€", "е", "ё"],
	f: ["f", "ᖴ", "F", "ⓕ", "Ⓕ", "₣", "ḟ", "Ḟ", "Ꭶ", "ғ", "ʄ", "ｆ", "Ｆ", "ɟ", "🅕", "𝐟", "𝐅", "𝘧", "𝘍", "𝙛", "𝙁", "𝒻", "𝓯", "𝓕", "𝕗", "𝔼", "𝔣", "𝔈", "𝖋", "𝕱", "🄵", "🅵", "𝐹", "ϝ", "𝚏", "𝙵", "Ϝ", "f"],
	g: ["g", "q", "6", "9", "G", "ⓖ", "Ⓖ", "͏", "₲", "ġ", "Ġ", "Ꮆ", "ϑ", "Ḡ", "ɢ", "̾", "ｇ", "Ｇ", "ƃ", "🅖", "𝐠", "𝐆", "𝘨", "𝘎", "𝙜", "𝙂", "ℊ", "𝓰", "𝓖", "𝕘", "𝔽", "𝔤", "𝔉", "𝖌", "𝕲", "🄶", "🅶", "𝑔", "𝒢", "ɠ", "𝚐", "𝙶", "❡", "ց", "𝙶"],
	h: ["h", "ᕼ", "H", "ⓗ", "Ⓗ", "н", "Ⱨ", "ḧ", "Ḧ", "Ꮒ", "ɦ", "ｈ", "Ｈ", "ʜ", "ɥ", "🅗", "𝐡", "𝐇", "𝘩", "𝘏", "𝙝", "𝙃", "𝒽", "𝓱", "𝓗", "𝕙", "𝔾", "𝔥", "𝔊", "𝖍", "𝕳", "🄷", "🅷", "𝐻", "ԋ", "𝚑", "𝙷", "♄", "h"],
	i: ["i", "!", "l", "1", "í", "I", "ⓘ", "Ⓘ", "ι", "͏", "ł", "ï", "Ï", "Ꭵ", "ḭ", "Ḭ", "ɨ", "̾", "ｉ", "Ｉ", "ɪ", "ı", "🅘", "𝐢", "𝐈", "𝘪", "𝘐", "𝙞", "𝙄", "𝒾", "𝓲", "𝓘", "𝕚", "ℍ", "𝔦", "ℌ", "𝖎", "𝕴", "🄸", "🅸", "𝐼", "𝚒", "𝙸", "♗", "і", "¡", "|"],
	j: ["j", "ᒍ", "J", "ⓙ", "Ⓙ", "נ", "Ꮰ", "ϳ", "ʝ", "ｊ", "Ｊ", "ᴊ", "ɾ", "🅙", "𝐣", "𝐉", "𝘫", "𝘑", "𝙟", "𝙅", "𝒿", "𝓳", "𝓙", "𝕛", "​", "𝔧", "𝖏", "𝕵", "🄹", "🅹", "𝒥", "𝚓", "𝙹", "♪", "ј"],
	k: ["k", "K", "ⓚ", "Ⓚ", "к", "͏", "₭", "ḳ", "Ḳ", "Ꮶ", "κ", "Ƙ", "ӄ", "̾", "ｋ", "Ｋ", "ᴋ", "ʞ", "🅚", "𝐤", "𝐊", "𝘬", "𝘒", "𝙠", "𝙆", "𝓀", "𝓴", "𝓚", "𝕜", "𝕀", "𝔨", "ℑ", "𝖐", "𝕶", "🄺", "🅺", "𝒦", "ƙ", "𝚔", "𝙺", "ϰ", "k"],
	l: ["l", "i", "1", "/", "|", "ᒪ", "L", "ⓛ", "Ⓛ", "ℓ", "Ⱡ", "ŀ", "Ŀ", "Ꮭ", "Ḷ", "Ꮮ", "ʟ", "ｌ", "Ｌ", "🅛", "𝐥", "𝐋", "𝘭", "𝘓", "𝙡", "𝙇", "𝓁", "𝓵", "𝓛", "𝕝", "𝕁", "𝔩", "​", "𝖑", "𝕷", "🄻", "🅻", "𝐿", "ʅ", "𝚕", "𝙻", "↳", "ⅼ"],
	m: ["m", "ᗰ", "M", "ⓜ", "Ⓜ", "м", "͏", "₥", "ṃ", "Ṃ", "Ꮇ", "ϻ", "Μ", "ṁ", "Ṁ", "ʍ", "̾", "ｍ", "Ｍ", "ᴍ", "ɯ", "🅜", "𝐦", "𝐌", "𝘮", "𝘔", "𝙢", "𝙈", "𝓂", "𝓶", "𝓜", "𝕞", "𝕂", "𝔪", "𝔍", "𝖒", "𝕸", "🄼", "🅼", "𝑀", "ɱ", "𝚖", "𝙼", "♔", "ⅿ"],
	n: ["n", "ñ", "ᑎ", "N", "ⓝ", "Ⓝ", "и", "₦", "ń", "Ń", "Ꮑ", "π", "∏", "Ṇ", "ռ", "ｎ", "Ｎ", "ɴ", "🅝", "𝐧", "𝐍", "𝘯", "𝘕", "𝙣", "𝙉", "𝓃", "𝓷", "𝓝", "𝕟", "𝕃", "𝔫", "𝔎", "𝖓", "𝕹", "🄽", "🅽", "𝒩", "ɳ", "𝚗", "𝙽", "♫", "ո", "η", "𝙽"],
	o: ["o", "0", "ó", "ô", "õ", "ú", "O", "ⓞ", "Ⓞ", "σ", "͏", "Ø", "ö", "Ö", "Ꭷ", "Θ", "ṏ", "Ṏ", "Ꮎ", "օ", "̾", "ｏ", "Ｏ", "ᴏ", "🅞", "𝐨", "𝐎", "𝘰", "𝘖", "𝙤", "𝙊", "ℴ", "𝓸", "𝓞", "𝕠", "𝕄", "𝔬", "𝔏", "𝖔", "𝕺", "🄾", "🅾", "𝑜", "𝒪", "𝚘", "𝙾", "⊙", "ο"],
	p: ["p", "ᑭ", "P", "ⓟ", "Ⓟ", "ρ", "₱", "ṗ", "Ṗ", "Ꭾ", "Ƥ", "Ꮲ", "ք", "ｐ", "Ｐ", "ᴘ", "🅟", "𝐩", "𝐏", "𝘱", "𝘗", "𝙥", "𝙋", "𝓅", "𝓹", "𝓟", "𝕡", "ℕ", "𝔭", "𝔐", "𝖕", "𝕻", "🄿", "🅿", "𝒫", "𝚙", "𝙿", "р"],
	q: ["q", "ᑫ", "Q", "ⓠ", "Ⓠ", "͏", "Ꭴ", "φ", "Ⴓ", "զ", "̾", "ｑ", "Ｑ", "ϙ", "ǫ", "🅠", "𝐪", "𝐐", "𝘲", "𝘘", "𝙦", "𝙌", "𝓆", "𝓺", "𝓠", "𝕢", "​", "𝔮", "𝔑", "𝖖", "𝕼", "🅀", "🆀", "𝒬", "𝚚", "𝚀", "☭", "ԛ"],
	r: ["r", "ᖇ", "R", "ⓡ", "Ⓡ", "я", "Ɽ", "ŕ", "Ŕ", "Ꮢ", "г", "Γ", "ṙ", "Ṙ", "ʀ", "ｒ", "Ｒ", "ɹ", "🅡", "𝐫", "𝐑", "𝘳", "𝘙", "𝙧", "𝙍", "𝓇", "𝓻", "𝓡", "𝕣", "𝕆", "𝔯", "𝔒", "𝖗", "𝕽", "🅁", "🆁", "𝑅", "ɾ", "𝚛", "𝚁", "☈", "r", "𝚁"],
	s: ["s", "5", "ᔕ", "S", "ⓢ", "Ⓢ", "ѕ", "͏", "₴", "ṩ", "Ṩ", "Ꮥ", "Ѕ", "Ṡ", "ֆ", "̾", "ｓ", "Ｓ", "ꜱ", "🅢", "𝐬", "𝐒", "𝘴", "𝘚", "𝙨", "𝙎", "𝓈", "𝓼", "𝓢", "𝕤", "ℙ", "𝔰", "𝔓", "𝖘", "𝕾", "🅂", "🆂", "𝒮", "ʂ", "𝚜", "𝚂", "ѕ"],
	t: ["t", "+", "T", "ⓣ", "Ⓣ", "т", "₮", "ẗ", "Ṯ", "Ꮦ", "τ", "Ƭ", "Ꮖ", "ȶ", "ｔ", "Ｔ", "ᴛ", "ʇ", "🅣", "𝐭", "𝐓", "𝘵", "𝘛", "𝙩", "𝙏", "𝓉", "𝓽", "𝓣", "𝕥", "​", "𝔱", "𝔔", "𝖙", "𝕿", "🅃", "🆃", "𝒯", "ƚ", "𝚝", "𝚃", "☂", "t"],
	u: ["u", "ú", "ü", "ᑌ", "U", "ⓤ", "Ⓤ", "υ", "͏", "Ʉ", "Ü", "Ꮼ", "Ʊ", "ṳ", "Ṳ", "ʊ", "̾", "ｕ", "Ｕ", "ᴜ", "🅤", "𝐮", "𝐔", "𝘶", "𝘜", "𝙪", "𝙐", "𝓊", "𝓾", "𝓤", "𝕦", "ℚ", "𝔲", "ℜ", "𝖚", "𝖀", "🅄", "🆄", "𝒰", "𝚞", "𝚄", "☋", "ս"],
	v: ["v", "ᐯ", "V", "ⓥ", "Ⓥ", "ν", "ṿ", "Ṿ", "Ꮙ", "Ʋ", "Ṽ", "ʋ", "ｖ", "Ｖ", "ᴠ", "ʌ", "🅥", "𝐯", "𝐕", "𝘷", "𝘝", "𝙫", "𝙑", "𝓋", "𝓿", "𝓥", "𝕧", "​", "𝔳", "𝖛", "𝖁", "🅅", "🆅", "𝒱", "𝚟", "𝚅", "✓", "ⅴ"],
	w: ["w", "ᗯ", "W", "ⓦ", "Ⓦ", "ω", "͏", "₩", "ẅ", "Ẅ", "Ꮗ", "ш", "Ш", "ẇ", "Ẇ", "Ꮃ", "ա", "̾", "ｗ", "Ｗ", "ᴡ", "ʍ", "🅦", "𝐰", "𝐖", "𝘸", "𝘞", "𝙬", "𝙒", "𝓌", "𝔀", "𝓦", "𝕨", "ℝ", "𝔴", "𝔖", "𝖜", "𝖂", "🅆", "🆆", "𝒲", "ɯ", "𝚠", "𝚆", "ԝ"],
	x: ["x", "᙭", "X", "ⓧ", "Ⓧ", "χ", "Ӿ", "ẍ", "Ẍ", "ጀ", "ϰ", "Ж", "х", "Ӽ", "ｘ", "Ｘ", "🅧", "𝐱", "𝐗", "𝘹", "𝘟", "𝙭", "𝙓", "𝓍", "𝔁", "𝓧", "𝕩", "​", "𝔵", "𝔗", "𝖝", "𝖃", "🅇", "🆇", "𝒳", "𝚡", "𝚇", "⌘", "х"],
	y: ["y", "Y", "ⓨ", "Ⓨ", "у", "͏", "Ɏ", "ÿ", "Ÿ", "Ꭹ", "ψ", "Ψ", "ẏ", "Ẏ", "Ꮍ", "ч", "ʏ", "̾", "ｙ", "Ｙ", "ʎ", "🅨", "𝐲", "𝐘", "𝘺", "𝘠", "𝙮", "𝙔", "𝓎", "𝔂", "𝓨", "𝕪", "𝕊", "𝔶", "𝔘", "𝖞", "𝖄", "🅈", "🆈", "𝒴", "ყ", "𝚢", "𝚈", "☿", "у"],
	z: ["z", "ᘔ", "Z", "ⓩ", "Ⓩ", "Ⱬ", "ẓ", "Ẓ", "ፚ", "Ꮓ", "ʐ", "ｚ", "Ｚ", "ᴢ", "🅩", "𝐳", "𝐙", "𝘻", "𝘡", "𝙯", "𝙕", "𝓏", "𝔃", "𝓩", "𝕫", "𝕋", "𝔷", "𝔙", "𝖟", "𝖅", "🅉", "🆉", "𝒵", "ȥ", "𝚣", "𝚉", "☡", "z"],
};
/* eslint-enable */
const EVASION_DETECTION_SUB_STRINGS: Dict<string> = {};

for (const letter in EVASION_DETECTION_SUBSTITUTIONS) {
	EVASION_DETECTION_SUB_STRINGS[letter] = `[${EVASION_DETECTION_SUBSTITUTIONS[letter].join('')}]`;
}

function constructEvasionRegex(str: string): RegExp {
	const buf = "\\b" +
		[...str].map(letter => (EVASION_DETECTION_SUB_STRINGS[letter] || letter) + '+').join('\\.?') +
		"\\b";
	return new RegExp(buf, 'iu');
}

function constructBannedWordRegex(bannedWords: string[]): RegExp {
	return new RegExp('(?:\\b|(?!\\w))(?:' + bannedWords.join('|') + ')(?:\\b|\\B(?!\\w))', 'i');
}

let connectListener: (() => void) | null;
let messageListener: ((message: Data) => void) | null;
let errorListener: ((error: Error) => void) | null;
let closeListener: ((code: number, reason: string) => void) | null;
let pongListener: (() => void) | null;

export class Client {
	private battleFilterRegularExpressions: RegExp[] | null = null;
	private botGreetingCooldowns: Dict<number> = {};
	private challstr: string = '';
	private challstrTimeout: NodeJS.Timer | undefined = undefined;
	private chatFilterRegularExpressions: RegExp[] | null = null;
	private configBannedWordsRegex: RegExp | null = null;
	private connectionAttempts: number = 0;
	private connectionAttemptTime: number = Config.connectionAttemptTime || 60 * 1000;
	private connectionTimeout: NodeJS.Timer | undefined = undefined;
	private evasionFilterRegularExpressions: RegExp[] | null = null;
	private groupSymbols: KeyedDict<GroupName, string> = DEFAULT_GROUP_SYMBOLS;
	private incomingMessageQueue: {message: Data, timestamp: number}[] = [];
	private lastOutgoingMessage: IOutgoingMessage | null = null;
	private lastProcessingTimeCheck: number = 0;
	private lastSendTimeoutTime: number = 0;
	private lastServerProcessingType: ServerProcessingType = 'not-measured';
	private loggedIn: boolean = false;
	private loginServerHostname: string = '';
	private loginServerPath: string = '';
	private loginTimeout: NodeJS.Timer | undefined = undefined;
	private messageParsers: IMessageParserFile[] = [];
	private messageParsersExist: boolean = false;
	private outgoingMessageQueue: IOutgoingMessage[] = [];
	private pauseIncomingMessages: boolean = true;
	private pauseOutgoingMessages: boolean = false;
	private pingWsAlive: boolean = true;
	private maxProcessingMeasurementGap = MAX_PROCESSING_MEASUREMENT_GAP;
	private publicChatRooms: string[] = [];
	private reconnectRoomMessages: Dict<string[]> = {};
	private reloadInProgress: boolean = false;
	private replayServerAddress: string = Config.replayServer || REPLAY_SERVER_ADDRESS;
	private retryLoginTimeout: NodeJS.Timer | undefined = undefined;
	private roomsToRejoin: string[] = [];
	private sendThrottle: number = Config.trustedUser ? TRUSTED_MESSAGE_THROTTLE : REGULAR_MESSAGE_THROTTLE;
	private sendTimeout: NodeJS.Timer | true | undefined = undefined;
	private server: string = Config.server || Tools.mainServer;
	private serverGroupsResponse: ServerGroupData[] = DEFAULT_SERVER_GROUPS;
	private serverGroups: Dict<IServerGroup> = {};
	private serverId: string = 'showdown';
	private serverLatency: number = DEFAULT_LATENCY;
	private serverPingTimeout: NodeJS.Timer | null = null;
	serverTimeOffset: number = 0;
	private serverProcessingTimes: KeyedDict<ServerProcessingType, number> = {
		'chat': DEFAULT_PROCESSING_TIME,
		'chat-html': DEFAULT_PROCESSING_TIME,
		'pm': DEFAULT_PROCESSING_TIME,
		'pm-html': DEFAULT_PROCESSING_TIME,
		'join-room': DEFAULT_PROCESSING_TIME,
		'leave-room': DEFAULT_PROCESSING_TIME,
		'not-measured': DEFAULT_PROCESSING_TIME,
	};
	private serverProcessingMeasurements: KeyedDict<ServerProcessingType, IServerProcessingMeasurement[]> = {
		'chat': [],
		'chat-html': [],
		'pm': [],
		'pm-html': [],
		'join-room': [],
		'leave-room': [],
		'not-measured': [],
	};
	private webSocket: import('ws') | null = null;

	constructor() {
		connectListener = () => this.onConnect();
		messageListener = (message: Data) => this.onMessage(message, Date.now());
		errorListener = (error: Error) => this.onConnectionError(error);
		closeListener = (code: number, description: string) => this.onConnectionClose(code, description);

		if (this.server.startsWith('https://')) {
			this.server = this.server.substr(8);
		} else if (this.server.startsWith('http://')) {
			this.server = this.server.substr(7);
		}
		if (this.server.endsWith('/')) this.server = this.server.substr(0, this.server.length - 1);

		this.parseServerGroups();
		this.updateConfigSettings();

		const messageParsersDir = path.join(Tools.builtFolder, 'message-parsers');
		const privateMessageParsersDir = path.join(messageParsersDir, 'private');

		this.loadMessageParsersDirectory(messageParsersDir);
		this.loadMessageParsersDirectory(privateMessageParsersDir, true);

		this.messageParsers.sort((a, b) => b.priority - a.priority);
		this.messageParsersExist = this.messageParsers.length > 0;
	}

	getGroupSymbols(): Readonly<KeyedDict<GroupName, string>> {
		return this.groupSymbols;
	}

	getServerGroups(): Readonly<Dict<IServerGroup>> {
		return this.serverGroups;
	}

	getHtmlChatCommand(): string {
		return HTML_CHAT_COMMAND;
	}

	getUhtmlChatCommand(): string {
		return UHTML_CHAT_COMMAND;
	}

	getUhtmlChangeChatCommand(): string {
		return UHTML_CHANGE_CHAT_COMMAND;
	}

	getLastOutgoingMessage(): Readonly<IOutgoingMessage> | null {
		return this.lastOutgoingMessage;
	}

	getServer(): string {
		return this.server;
	}

	getReplayServerAddress(): string {
		return this.replayServerAddress;
	}

	getOutgoingMessageQueue(): readonly IOutgoingMessage[] {
		return this.outgoingMessageQueue;
	}

	getUserAttributionHtml(name: string): string {
		return '<div style="float:right;color:#888;font-size:8pt">[' + name + ']</div><div style="clear:both"></div>';
	}

	getListenerHtml(html: string, inPm?: boolean): string {
		html = '<div class="infobox">' + html;
		if (!inPm && Users.self.group !== this.groupSymbols.bot) {
			html += this.getUserAttributionHtml(Users.self.name);
		}
		html += '</div>';
		return html;
	}

	getListenerUhtml(html: string, inPm?: boolean): string {
		if (!inPm && Users.self.group !== this.groupSymbols.bot) {
			html += this.getUserAttributionHtml(Users.self.name);
		}
		return html;
	}

	getMsgRoomButton(room: Room, message: string, label: string, disabled?: boolean, buttonStyle?: string): string {
		return '<button class="button' + (disabled ? " disabled" : "") + '"' + (buttonStyle ? ' style="' + buttonStyle + '"' : '') +
			'name="send" value="/msg ' + Users.self.name + ', ' + '/msgroom ' + room.title + ', ' + message + '">' + label + '</button>';
	}

	getPmUserButton(user: User, message: string, label: string, disabled?: boolean, buttonStyle?: string): string {
		return '<button class="button' + (disabled ? " disabled" : "") + '"' + (buttonStyle ? ' style="' + buttonStyle + '"' : '') +
			' name="send" value="/msg ' + user.name + ', ' + message + '">' + label + '</button>';
	}

	getPmSelfButton(message: string, label: string, disabled?: boolean, buttonStyle?: string): string {
		return this.getPmUserButton(Users.self, message, label, disabled, buttonStyle);
	}

	getSendThrottle(serverProcessingType: ServerProcessingType): number {
		return this.sendThrottle + this.serverLatency + this.serverProcessingTimes[serverProcessingType];
	}

	checkFilters(message: string, room?: Room): string | undefined {
		if (room) {
			if (room.configBannedWords) {
				if (!room.configBannedWordsRegex) {
					room.configBannedWordsRegex = constructBannedWordRegex(room.configBannedWords);
				}
				if (message.match(room.configBannedWordsRegex)) return "config room banned words";
			}

			if (room.serverBannedWords) {
				if (!room.serverBannedWordsRegex) {
					room.serverBannedWordsRegex = constructBannedWordRegex(room.serverBannedWords);
				}
				if (message.match(room.serverBannedWordsRegex)) return "server room banned words";
			}
		}

		let lowerCase = message
			.replace(FILTERS_REGEX_N, 'N').toLowerCase()
			.replace(FILTERS_REGEX_EMPTY_CHARACTERS, '')
			.replace(FILTERS_REGEX_O_LEFT, 'o')
			.replace(FILTERS_REGEX_O_RIGHT, 'o')
			.replace(FILTERS_REGEX_A, 'a')
			.replace(FILTERS_REGEX_E_LEFT, 'e')
			.replace(FILTERS_REGEX_E_RIGHT, 'e');

		lowerCase = lowerCase.replace(FILTERS_REGEX_FORMATTING, '');

		if (this.battleFilterRegularExpressions && room && room.type === 'battle') {
			for (const expression of this.battleFilterRegularExpressions) {
				if (lowerCase.match(expression)) return "battle filter";
			}
		}

		if (this.chatFilterRegularExpressions) {
			for (const expression of this.chatFilterRegularExpressions) {
				if (lowerCase.match(expression)) return "chat filter";
			}
		}

		if (this.evasionFilterRegularExpressions) {
			let evasionLowerCase = lowerCase.normalize('NFKC');
			evasionLowerCase = evasionLowerCase.replace(/[\s-_,.]+/g, '.');
			for (const expression of this.evasionFilterRegularExpressions) {
				if (evasionLowerCase.match(expression)) return "evasion filter";
			}
		}

		if (this.configBannedWordsRegex && message.match(this.configBannedWordsRegex)) return "config banned words";
	}

	extractBattleId(source: string): IExtractedBattleId | null {
		return Tools.extractBattleId(source, this.replayServerAddress, this.server, this.serverId);
	}

	joinRoom(roomid: string): void {
		this.send({
			message: '|/join ' + roomid,
			roomid,
			type: 'join-room',
			serverProcessingType: 'join-room',
			measure: true,
		});
	}

	send(outgoingMessage: IOutgoingMessage): void {
		if (!outgoingMessage.message || !this.webSocket) return;

		if (outgoingMessage.message.length > MAX_MESSAGE_SIZE) {
			throw new Error("Message exceeds server size limit of " + (MAX_MESSAGE_SIZE / 1024) + "KB: " + outgoingMessage.message);
		}

		if (this.sendTimeout || this.pauseOutgoingMessages) {
			this.outgoingMessageQueue.push(outgoingMessage);
			return;
		}

		outgoingMessage.serverLatency = this.serverLatency;
		outgoingMessage.serverProcessingTime = this.serverProcessingTimes[outgoingMessage.serverProcessingType];

		this.sendTimeout = true;
		this.webSocket.send(outgoingMessage.message, () => {
			if (outgoingMessage.measure) outgoingMessage.sentTime = Date.now();
			this.lastOutgoingMessage = outgoingMessage;
			this.lastServerProcessingType = outgoingMessage.serverProcessingType;

			if (this.sendTimeout === true && !this.reloadInProgress && this === global.Client) {
				this.setSendTimeout(this.getSendThrottle(outgoingMessage.serverProcessingType));
			}
		});
	}

	updateConfigSettings(): void {
		if (Config.bannedWords && Config.bannedWords.length) this.configBannedWordsRegex = constructBannedWordRegex(Config.bannedWords);
	}

	getSendThrottleValues(): string[] {
		const values = ["Base throttle: " + this.sendThrottle + "ms", "Latency: " + this.serverLatency + "ms"];
		const types = Object.keys(this.serverProcessingTimes) as ServerProcessingType[];
		for (const type of types) {
			if (type === 'not-measured') continue;

			values.push("");
			values.push(type + ":");
			values.push("Throttle: " + this.getSendThrottle(type) + "ms");
			values.push("Processing time: " + this.serverProcessingTimes[type] + "ms" + (this.serverProcessingMeasurements[type].length ?
				" ([" + this.serverProcessingMeasurements[type].map(x => x.measurement).join(", ") + "])" : ""));
		}
		values.push("");
		values.push("Queued outgoing messages: " + this.outgoingMessageQueue.length);
		return values;
	}

	private loadMessageParsersDirectory(directory: string, optional?: boolean): void {
		let messageParserFiles: string[] = [];
		try {
			messageParserFiles = fs.readdirSync(directory);
		} catch (e) {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
			if (e.code === 'ENOENT' && optional) return;
			throw e;
		}

		for (const fileName of messageParserFiles) {
			if (!fileName.endsWith('.js') || fileName === 'example.js') continue;
			const filePath = path.join(directory, fileName);
			// eslint-disable-next-line @typescript-eslint/no-var-requires
			const messageParser = require(filePath) as IMessageParserFile;
			// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
			if (!messageParser.parseMessage) throw new Error("No parseMessage function exported from " + filePath);

			if (!messageParser.priority) messageParser.priority = 0;
			this.messageParsers.push(messageParser);
		}
	}

	private setClientListeners(): void {
		if (!this.webSocket) return;

		this.webSocket.on('open', connectListener!);
		this.webSocket.on('message', messageListener!);
		this.webSocket.on('error', errorListener!);
		this.webSocket.on('close', closeListener!);
	}

	private removeClientListeners(previousClient?: boolean): void {
		if (!this.webSocket) return;

		if (connectListener) {
			this.webSocket.removeAllListeners('open');
			if (previousClient) connectListener = null;
		}

		if (messageListener) {
			this.webSocket.removeAllListeners('message');
			if (previousClient) messageListener = null;
		}

		if (errorListener) {
			this.webSocket.removeAllListeners('error');
			if (previousClient) errorListener = null;
		}

		if (closeListener) {
			this.webSocket.removeAllListeners('close');
			if (previousClient) closeListener = null;
		}

		if (pongListener) {
			this.webSocket.removeAllListeners('pong');
			if (previousClient) pongListener = null;
		}

		if (this.serverPingTimeout) clearTimeout(this.serverPingTimeout);
	}

	private pingServer(): void {
		if (!this.webSocket || this.reloadInProgress) return;
		if (!this.pingWsAlive) {
			this.pingWsAlive = true;
			this.prepareReconnect();
			return;
		}

		let pingTime = 0;
		pongListener = () => {
			this.pingWsAlive = true;

			if (this.reloadInProgress || this !== global.Client) return;

			const oldServerLatency = this.serverLatency;
			if (pingTime) {
				this.serverLatency = Math.ceil((Date.now() - pingTime) / 2);
			} else {
				this.serverLatency = 0;
			}

			if (this.sendTimeout && this.sendTimeout !== true && this.serverLatency > oldServerLatency) {
				this.setSendTimeout(this.getSendThrottle(this.lastServerProcessingType) + (this.serverLatency - oldServerLatency));
			}
		};

		this.pingWsAlive = false;
		this.webSocket.removeAllListeners('pong');
		this.webSocket.once('pong', pongListener);
		this.webSocket.ping('', undefined, () => {
			pingTime = Date.now();

			if (this.serverPingTimeout) clearTimeout(this.serverPingTimeout);
			this.serverPingTimeout = setTimeout(() => this.pingServer(), LATENCY_CHECK_INTERVAL + 1000);
		});
	}

	private beforeReload(): void {
		this.reloadInProgress = true;
		this.pauseIncomingMessages = true;
	}

	/* eslint-disable @typescript-eslint/no-unnecessary-condition */
	private onReload(previous: Client): void {
		if (previous.challstrTimeout) clearTimeout(previous.challstrTimeout);
		if (previous.serverPingTimeout) clearTimeout(previous.serverPingTimeout);

		if (previous.lastSendTimeoutTime) this.lastSendTimeoutTime = previous.lastSendTimeoutTime;
		if (previous.lastServerProcessingType) this.lastServerProcessingType = previous.lastServerProcessingType;
		if (previous.lastProcessingTimeCheck) this.lastProcessingTimeCheck = previous.lastProcessingTimeCheck;
		if (previous.lastOutgoingMessage) this.lastOutgoingMessage = Object.assign({}, previous.lastOutgoingMessage);

		if (previous.serverLatency) this.serverLatency = previous.serverLatency;
		if (previous.serverProcessingTimes) Object.assign(this.serverProcessingTimes, previous.serverProcessingTimes);
		if (previous.serverProcessingMeasurements) {
			const types = Object.keys(previous.serverProcessingMeasurements) as ServerProcessingType[];
			for (const type of types) {
				this.serverProcessingMeasurements[type] = previous.serverProcessingMeasurements[type].slice();
			}
		}

		if (previous.outgoingMessageQueue) this.outgoingMessageQueue = previous.outgoingMessageQueue.slice();
		if (previous.webSocket) {
			if (previous.removeClientListeners) previous.removeClientListeners(true);

			this.webSocket = previous.webSocket;
			this.setClientListeners();
			this.pingServer();

			if (previous.incomingMessageQueue) {
				for (const item of previous.incomingMessageQueue.slice()) {
					if (!this.incomingMessageQueue.includes(item)) this.onMessage(item.message, item.timestamp);
				}
			}

			this.pauseIncomingMessages = false;
			if (this.incomingMessageQueue.length) {
				for (const item of this.incomingMessageQueue) {
					this.onMessage(item.message, item.timestamp);
				}

				this.incomingMessageQueue = [];
			}
		}

		if (previous.botGreetingCooldowns) Object.assign(this.botGreetingCooldowns, previous.botGreetingCooldowns);
		if (previous.challstr) this.challstr = previous.challstr;
		if (previous.battleFilterRegularExpressions) this.battleFilterRegularExpressions = previous.battleFilterRegularExpressions.slice();
		if (previous.chatFilterRegularExpressions) this.chatFilterRegularExpressions = previous.chatFilterRegularExpressions.slice();
		if (previous.evasionFilterRegularExpressions) {
			this.evasionFilterRegularExpressions = previous.evasionFilterRegularExpressions.slice();
		}
		if (previous.groupSymbols) Object.assign(this.groupSymbols, previous.groupSymbols);
		if (previous.loggedIn) this.loggedIn = previous.loggedIn;
		if (previous.publicChatRooms) this.publicChatRooms = previous.publicChatRooms.slice();
		if (previous.sendThrottle) this.sendThrottle = previous.sendThrottle;

		if (previous.sendTimeout) {
			if (previous.sendTimeout !== true) clearTimeout(previous.sendTimeout);
			if (!this.sendTimeout) this.setSendTimeout(this.lastSendTimeoutTime);
		}

		if (previous.server) this.server = previous.server;
		if (previous.serverGroupsResponse) {
			this.serverGroupsResponse = previous.serverGroupsResponse.slice();
			this.parseServerGroups();
		} else if (previous.serverGroups) {
			Object.assign(this.serverGroups, previous.serverGroups);
		}
		if (previous.serverId) this.serverId = previous.serverId;
		if (previous.serverTimeOffset) this.serverTimeOffset = previous.serverTimeOffset;

		for (const i in previous) {
			// @ts-expect-error
			delete previous[i];
		}
	}

	/* eslint-enable */

	private clearConnectionTimeouts(): void {
		if (this.connectionTimeout) clearTimeout(this.connectionTimeout);
		if (this.challstrTimeout) clearTimeout(this.challstrTimeout);
		if (this.loginTimeout) clearTimeout(this.loginTimeout);
		if (this.retryLoginTimeout) clearTimeout(this.retryLoginTimeout);
		if (this.serverPingTimeout) clearTimeout(this.serverPingTimeout);
		this.clearSendTimeout();
	}

	private onConnectFail(error?: Error): void {
		this.clearConnectionTimeouts();

		console.log('Failed to connect to server ' + this.serverId);
		if (error) console.log(error.stack);

		this.connectionAttempts++;
		const reconnectTime = this.connectionAttemptTime * this.connectionAttempts;
		console.log('Retrying in ' + reconnectTime / 1000 + ' seconds');
		this.connectionTimeout = setTimeout(() => this.connect(), reconnectTime);
	}

	private onConnectionError(error: Error): void {
		this.clearConnectionTimeouts();

		console.log('Connection error: ' + error.stack);
		// 'close' is emitted directly after 'error' so reconnecting is handled in onConnectionClose
	}

	private onConnectionClose(code: number, reason: string): void {
		this.terminateWebSocket();

		console.log('Connection closed: ' + reason + ' (' + code + ')');
		console.log('Reconnecting in ' + SERVER_RESTART_CONNECTION_TIME / 1000 + ' seconds');

		this.connectionTimeout = setTimeout(() => this.reconnect(), SERVER_RESTART_CONNECTION_TIME);
	}

	private onConnect(): void {
		this.clearConnectionTimeouts();

		console.log('Successfully connected');

		this.challstrTimeout = setTimeout(() => {
			console.log("Did not receive a challstr! Reconnecting in " + this.connectionAttemptTime / 1000 + " seconds");
			this.terminateWebSocket();
			this.connectionTimeout = setTimeout(() => this.connect(), this.connectionAttemptTime);
		}, CHALLSTR_TIMEOUT_SECONDS * 1000);

		this.pingServer();

		void Dex.fetchClientData();
	}

	private connect(): void {
		if (Config.username) {
			const action = new url.URL('https://' + Tools.mainServer + '/~~' + this.serverId + '/action.php');
			if (!action.hostname || !action.pathname) {
				console.log("Failed to parse login server URL");
				process.exit();
			}

			this.loginServerHostname = action.hostname;
			this.loginServerPath = action.pathname;
		}

		const httpsOptions = {
			hostname: Tools.mainServer,
			path: '/crossdomain.php?' + querystring.stringify({host: this.server, path: ''}),
			method: 'GET',
		};

		this.pauseIncomingMessages = false;
		if (this.connectionTimeout) clearTimeout(this.connectionTimeout);
		this.connectionTimeout = setTimeout(() => this.onConnectFail(), 30 * 1000);

		console.log("Attempting to connect to the server " + this.server + "...");
		https.get(httpsOptions, response => {
			response.setEncoding('utf8');
			let data = '';
			response.on('data', chunk => {
				data += chunk;
			});
			response.on('end', () => {
				const configData = data.split('var config = ')[1];
				if (configData) {
					let config = JSON.parse(configData.split(';')[0]) as IServerConfig | string;
					// the config is potentially encoded twice by the server
					if (typeof config === 'string') config = JSON.parse(config) as IServerConfig;
					if (config.host) {
						if (config.id) this.serverId = config.id;

						let address: string;
						if (config.host === 'showdown') {
							address = 'wss://' + MAIN_HOST + ':' + (config.port || 443) + '/showdown/websocket';
						} else {
							address = 'ws://' + config.host + ':' + (config.port || 8000) + '/showdown/websocket';
						}

						const wsOptions: ClientOptions = {
							perMessageDeflate: Config.perMessageDeflate || false,
							headers: {
								"User-Agent": "ws",
							},
						};

						// eslint-disable-next-line @typescript-eslint/no-var-requires
						const ws = require('ws') as typeof import('ws');
						this.webSocket = new ws(address, wsOptions);
						this.pauseOutgoingMessages = false;
						this.setClientListeners();

						return;
					}
				}
				console.log('Error: failed to get data for server ' + this.server);
			});
		}).on('error', error => {
			console.log('Error: ' + error.message);
		});
	}

	private terminateWebSocket(): void {
		this.clearConnectionTimeouts();
		this.removeClientListeners();

		if (this.webSocket) {
			this.webSocket.terminate();
			this.webSocket = null;
		}

		this.pauseOutgoingMessages = true;
	}

	private prepareReconnect(): void {
		this.terminateWebSocket();

		Tools.logMessage("Client.reconnect() called");

		this.roomsToRejoin = Rooms.getRoomIds();
		if (Config.rooms && !Config.rooms.includes('lobby')) {
			const index = this.roomsToRejoin.indexOf('lobby');
			if (index !== -1) this.roomsToRejoin.splice(index, 1);
		}

		for (const id of this.roomsToRejoin) {
			const room = Rooms.get(id)!;
			let game: ScriptedGame | UserHostedGame | undefined;
			if (room.game && room.game.started) {
				game = room.game;
			} else if (room.userHostedGame && room.userHostedGame.started) {
				game = room.userHostedGame;
			}

			if (game) {
				this.reconnectRoomMessages[room.id] = [Users.self.name + " had to reconnect to the server so the game was " +
					"forcibly ended."];
				game.deallocate(true);
			}
		}

		for (const id of Users.getUserIds()) {
			const user = Users.get(id)!;
			if (user.game) user.game.deallocate(true);
		}

		this.reconnect(true);
	}

	private reconnect(prepared?: boolean): void {
		if (!prepared) {
			Rooms.removeAll();
			Users.removeAll();
			this.outgoingMessageQueue = [];
		}

		this.loggedIn = false;
		this.connectionAttempts = 0;
		this.connect();
	}

	private onMessage(webSocketData: Data, now: number): void {
		if (!webSocketData || typeof webSocketData !== 'string') return;

		if (this.pauseIncomingMessages) {
			this.incomingMessageQueue.push({message: webSocketData, timestamp: now});
			return;
		}

		const lines = webSocketData.split("\n");
		let roomid: string;
		if (lines[0].startsWith('>')) {
			roomid = lines[0].substr(1);
			lines.shift();
		} else {
			roomid = 'lobby';
		}

		let room = Rooms.get(roomid);
		if (!room) {
			room = Rooms.add(roomid);
			if (this.lastOutgoingMessage && this.lastOutgoingMessage.type === 'join-room' &&
				this.lastOutgoingMessage.roomid === room.id) {
				this.clearLastOutgoingMessage(now);
			}
		}

		for (let i = 0; i < lines.length; i++) {
			if (!lines[i]) continue;
			try {
				this.parseMessage(room, lines[i], now);
				if (lines[i].startsWith('|init|')) {
					const page = room.type === 'html';
					const chat = !page && room.type === 'chat';
					for (let j = i + 1; j < lines.length; j++) {
						if (page) {
							if (lines[j].startsWith('|pagehtml|')) {
								this.parseMessage(room, lines[j], now);
								break;
							}
						} else if (chat) {
							if (lines[j].startsWith('|users|')) {
								this.parseMessage(room, lines[j], now);
								for (let k = j + 1; k < lines.length; k++) {
									if (lines[k].startsWith('|:|')) {
										this.parseMessage(room, lines[k], now);
										break;
									}
								}
								break;
							}
						}
					}

					if (page || chat) return;
				}
			} catch (e) {
				console.log(e);
				Tools.logError(e);
			}
		}
	}

	private parseMessage(room: Room, rawMessage: string, now: number): void {
		let message: string;
		let messageType: keyof IClientMessageTypes;
		if (!rawMessage.startsWith("|")) {
			message = rawMessage;
			messageType = '';
		} else {
			message = rawMessage.substr(1);
			const pipeIndex = message.indexOf("|");
			if (pipeIndex !== -1) {
				messageType = message.substr(0, pipeIndex) as keyof IClientMessageTypes;
				message = message.substr(pipeIndex + 1);
			} else {
				messageType = message as keyof IClientMessageTypes;
				message = '';
			}
		}

		const messageParts = message.split("|");

		if (this.messageParsersExist) {
			for (const messageParser of this.messageParsers) {
				if (messageParser.parseMessage(room, messageType, messageParts, now) === true) return;
			}
		}

		switch (messageType) {
		/**
		 * Global messages
		 */
		case 'popup': {
			let msg = message.split('');
			for (const [i, m] of msg.entries()) {
				if (m === '|' && msg[i + 1] === '|') msg.splice(i + 1, 1);
			}
			msg = msg.join('').split('|');
			const roArray: string[] = msg[msg.indexOf('Room Owners (#):') + 1].split(',');
			const modArray: string[] = msg[msg.indexOf('Moderators (@):') + 1].split(',');
			const driverArray: string[] = msg[msg.indexOf('Drivers (%):') + 1].split(',');
			const botArray: string[] = msg[msg.indexOf('Bots (*):') + 1].split(',');
			const voiceArray: string[] = msg[msg.indexOf('Voices (+):') + 1].split(',');
			const messageArgs: IClientMessageTypes['popup'] = {
				roomowners: roArray,
				mods: modArray,
				bots: botArray,
				drivers: driverArray,
				voices: voiceArray,
			};
			for (const account of messageArgs.voices) {
				if (!Tools.toId(account).startsWith('lt71lx')) continue;
				(Rooms.get('officialladdertournament') as Room).say(`/roomdevoice ${Tools.toId(account)}`);
			}
			break;
		}

		case 'challstr': {
			if (this.challstrTimeout) clearTimeout(this.challstrTimeout);

			this.challstr = message;

			if (Config.username) {
				this.loginTimeout = setTimeout(() => {
					console.log("Failed to login. Reconnecting in " + this.connectionAttemptTime / 1000 + " seconds");
					this.terminateWebSocket();
					this.connectionTimeout = setTimeout(() => this.connect(), this.connectionAttemptTime);
				}, LOGIN_TIMEOUT_SECONDS * 1000);

				this.checkLoginSession();
			}
			break;
		}

		case 'updateuser': {
			const messageArguments: IClientMessageTypes['updateuser'] = {
				usernameText: messageParts[0],
				loginStatus: messageParts[1],
			};
			let rank: string = '';
			const firstCharacter = messageArguments.usernameText.charAt(0);
			for (const i in this.serverGroups) {
				if (this.serverGroups[i].symbol === firstCharacter) {
					rank = firstCharacter;
					messageArguments.usernameText = messageArguments.usernameText.substr(1);
					break;
				}
			}
			const {away, status, username} = Tools.parseUsernameText(messageArguments.usernameText);

			if (Tools.toId(username) !== Users.self.id) return;
			if (this.loggedIn) {
				if (status || Users.self.status) Users.self.status = status;
				if (away) {
					Users.self.away = true;
				} else if (Users.self.away) {
					Users.self.away = false;
				}
			} else {
				if (messageArguments.loginStatus !== '1') {
					console.log('Failed to log in');
					return;
				}

				if (this.loginTimeout) clearTimeout(this.loginTimeout);

				console.log('Successfully logged in');
				this.loggedIn = true;
				this.send({message: '|/blockchallenges', type: 'command', serverProcessingType: 'not-measured'});
				this.send({message: '|/cmd rooms', type: 'command', serverProcessingType: 'not-measured'});
				if (Tools.toAlphaNumeric(Config.username) !== Config.username) {
					this.send({message: '|/trn ' + Config.username, type: 'command', serverProcessingType: 'not-measured'});
				}

				if (rank) {
					Users.self.group = rank;
				} else {
					this.send({message: '|/cmd userdetails ' + Users.self.id, type: 'command', serverProcessingType: 'not-measured'});
				}

				if (this.roomsToRejoin.length) {
					for (const roomId of this.roomsToRejoin) {
						this.joinRoom(roomId);
					}

					this.roomsToRejoin = [];
				} else if (Config.rooms) {
					for (const roomId of Config.rooms) {
						this.joinRoom(roomId);
					}
				}

				if (Config.avatar) this.send({message: '|/avatar ' + Config.avatar, type: 'command', serverProcessingType: 'not-measured'});
			}
			break;
		}

		case 'queryresponse': {
			const messageArguments: IClientMessageTypes['queryresponse'] = {
				type: messageParts[0] as QueryResponseType,
				response: messageParts.slice(1).join('|'),
			};

			if (messageArguments.type === 'roominfo') {
				if (messageArguments.response && messageArguments.response !== 'null') {
					const response = JSON.parse(messageArguments.response) as IRoomInfoResponse;
					const responseRoom = Rooms.get(response.id);
					if (responseRoom) {
						responseRoom.onRoomInfoResponse(response);
						Games.updateGameCatalog(responseRoom);
					}
				}
			} else if (messageArguments.type === 'rooms') {
				if (messageArguments.response && messageArguments.response !== 'null') {
					const response = JSON.parse(messageArguments.response) as IRoomsResponse;
					for (const chatRoom of response.chat) {
						this.publicChatRooms.push(Tools.toRoomId(chatRoom.title));
					}
					for (const officialRoom of response.official) {
						this.publicChatRooms.push(Tools.toRoomId(officialRoom.title));
					}
					for (const psplRoom of response.pspl) {
						this.publicChatRooms.push(Tools.toRoomId(psplRoom.title));
					}
				}
			} else if (messageArguments.type === 'userdetails') { // eslint-disable-line @typescript-eslint/no-unnecessary-condition
				if (messageArguments.response && messageArguments.response !== 'null') {
					const response = JSON.parse(messageArguments.response) as IUserDetailsResponse;
					if (response.userid === Users.self.id) Users.self.group = response.group;
				}
			}
			break;
		}

		case 'init': {
			const messageArguments: IClientMessageTypes['init'] = {
				type: messageParts[0] as RoomType,
			};

			if (this.lastOutgoingMessage && this.lastOutgoingMessage.type === 'join-room' &&
				this.lastOutgoingMessage.roomid === room.id) {
				this.clearLastOutgoingMessage(now);
			}

			room.init(messageArguments.type);
			if (room.type === 'chat') {
				console.log("Joined room: " + room.id);
				if (room.id === 'staff') room.sayCommand('/filters view');
				room.sayCommand('/cmd roominfo ' + room.id);
				room.sayCommand('/banword list');

				if (room.id in this.reconnectRoomMessages) {
					for (const reconnectMessage of this.reconnectRoomMessages[room.id]) {
						room.say(reconnectMessage);
					}
					delete this.reconnectRoomMessages[room.id];
				}

				if (room.id in Tournaments.schedules) {
					Tournaments.setScheduledTournament(room);
				}
			}
			break;
		}

		case 'deinit': {
			if (this.lastOutgoingMessage && this.lastOutgoingMessage.type === 'leave-room' &&
				this.lastOutgoingMessage.roomid === room.id) {
				this.clearLastOutgoingMessage(now);
			}

			Rooms.remove(room);
			break;
		}

		case 'noinit': {
			const messageArguments: IClientMessageTypes['noinit'] = {
				action: messageParts[0],
				newId: messageParts[1],
				newTitle: messageParts[2],
			};

			if (messageArguments.action === 'rename') {
				const oldId = room.id;
				Rooms.renameRoom(room, messageArguments.newId, messageArguments.newTitle);
				Storage.renameRoom(room, oldId);
			} else {
				Rooms.remove(room);
			}

			break;
		}

		case 'title': {
			const messageArguments: IClientMessageTypes['title'] = {
				title: messageParts[0],
			};

			room.setTitle(messageArguments.title);
			break;
		}

		case 'customgroups': {
			const messageArguments: IClientMessageTypes['customgroups'] = {
				groups: JSON.parse(messageParts[0]) as ServerGroupData[],
			};

			this.serverGroupsResponse = messageArguments.groups;
			this.parseServerGroups();
			break;
		}

		/**
		 * Chat messages
		 */
		case 'users': {
			const messageArguments: IClientMessageTypes['users'] = {
				userlist: messageParts[0],
			};

			if (messageArguments.userlist === '0') return;

			const addedUsers = new Set<User>();
			const users = messageArguments.userlist.split(",");
			for (let i = 1; i < users.length; i++) {
				const rank = users[i].charAt(0);
				const {away, status, username} = Tools.parseUsernameText(users[i].substr(1));
				const id = Tools.toId(username);
				if (!id) continue;

				const user = Users.add(username, id);
				addedUsers.add(user);

				room.onUserJoin(user, rank);
				if (status || user.status) user.status = status;
				if (away) {
					user.away = true;
				} else if (user.away) {
					user.away = false;
				}
			}

			// prune users after reconnecting
			for (const id of Users.getUserIds()) {
				const user = Users.get(id)!;
				if (user.rooms.has(room) && !addedUsers.has(user)) room.onUserLeave(user);
			}

			break;
		}

		case 'join':
		case 'j':
		case 'J': {
			const messageArguments: IClientMessageTypes['join'] = {
				rank: messageParts[0].charAt(0),
				usernameText: messageParts[0].substr(1),
			};
			const {away, status, username} = Tools.parseUsernameText(messageArguments.usernameText);
			const id = Tools.toId(username);
			if (!id) return;

			const user = Users.add(username, id);
			room.onUserJoin(user, messageArguments.rank);
			user.updateStatus(status, away);

			if (user === Users.self && this.publicChatRooms.includes(room.id) && Users.self.hasRank(room, 'driver')) {
				this.sendThrottle = TRUSTED_MESSAGE_THROTTLE;
			}

			Storage.updateLastSeen(user, now);
			if (Config.allowMail && messageArguments.rank !== this.groupSymbols.locked) Storage.retrieveOfflineMessages(user);
			if ((!room.game || room.game.isMiniGame) && !room.userHostedGame && (!(user.id in this.botGreetingCooldowns) ||
				now - this.botGreetingCooldowns[user.id] >= BOT_GREETING_COOLDOWN)) {
				if (Storage.checkBotGreeting(room, user, now)) this.botGreetingCooldowns[user.id] = now;
			}
			break;
		}

		case 'leave':
		case 'l':
		case 'L': {
			const messageArguments: IClientMessageTypes['leave'] = {
				possibleRank: messageParts[0].charAt(0),
				username: messageParts[0].substr(1),
			};

			let rank: string | undefined;
			let username: string;
			if (messageArguments.possibleRank in this.serverGroups) {
				rank = messageArguments.possibleRank;
				username = messageArguments.username;
			} else {
				username = messageArguments.possibleRank + messageArguments.username;
			}
			const id = Tools.toId(username);
			if (!id) return;

			const user = Users.add(username, id);
			if (!rank) {
				const roomData = user.rooms.get(room);
				if (roomData && roomData.rank) rank = roomData.rank;
			}

			room.onUserLeave(user);

			Storage.updateLastSeen(user, now);
			break;
		}

		case 'name':
		case 'n':
		case 'N': {
			const messageArguments: IClientMessageTypes['name'] = {
				rank: messageParts[0].charAt(0),
				usernameText: messageParts[0].substr(1),
				oldId: messageParts[1],
			};

			const {away, status, username} = Tools.parseUsernameText(messageArguments.usernameText);
			const user = Users.rename(username, messageArguments.oldId);
			room.onUserJoin(user, messageArguments.rank, true);
			user.updateStatus(status, away);

			if (!user.away && Config.allowMail && messageArguments.rank !== this.groupSymbols.locked) {
				Storage.retrieveOfflineMessages(user);
			}

			Storage.updateLastSeen(user, now);
			break;
		}

		case 'chat':
		case 'c':
		case 'c:': {
			let messageArguments: IClientMessageTypes['chat'];
			if (messageType === 'c:') {
				messageArguments = {
					timestamp: (parseInt(messageParts[0]) + this.serverTimeOffset) * 1000,
					rank: messageParts[1].charAt(0),
					username: messageParts[1].substr(1),
					message: messageParts.slice(2).join("|"),
				};
			} else {
				messageArguments = {
					timestamp: now,
					rank: messageParts[0].charAt(0),
					username: messageParts[0].substr(1),
					message: messageParts.slice(1).join("|"),
				};
			}

			const userId = Tools.toId(messageArguments.username);
			if (!userId) return;

			const user = Users.add(messageArguments.username, userId);
			const roomData = user.rooms.get(room);
			if (roomData) roomData.lastChatMessage = messageArguments.timestamp;

			if (user === Users.self) {
				if (messageArguments.message.startsWith(HTML_CHAT_COMMAND)) {
					const html = Tools.unescapeHTML(messageArguments.message.substr(HTML_CHAT_COMMAND.length));
					const htmlId = Tools.toId(html);
					if (this.lastOutgoingMessage && this.lastOutgoingMessage.type === 'chat-html' &&
						Tools.toId(this.lastOutgoingMessage.html) === htmlId) {
						this.clearLastOutgoingMessage(now);
					}

					room.addHtmlChatLog(html);

					if (htmlId in room.htmlMessageListeners) {
						room.htmlMessageListeners[htmlId](now);
						delete room.htmlMessageListeners[htmlId];
					}
				} else {
					let uhtml = '';
					let uhtmlChange = false;
					if (messageArguments.message.startsWith(UHTML_CHAT_COMMAND)) {
						uhtml = messageArguments.message.substr(UHTML_CHAT_COMMAND.length);
					} else if (messageArguments.message.startsWith(UHTML_CHANGE_CHAT_COMMAND)) {
						uhtml = messageArguments.message.substr(UHTML_CHANGE_CHAT_COMMAND.length);
						uhtmlChange = true;
					}

					const commaIndex = uhtml.indexOf(',');
					if (commaIndex !== -1) {
						const uhtmlName = uhtml.substr(0, commaIndex);
						const uhtmlId = Tools.toId(uhtmlName);
						const html = Tools.unescapeHTML(uhtml.substr(commaIndex + 1));
						const htmlId = Tools.toId(html);
						if (this.lastOutgoingMessage && this.lastOutgoingMessage.type === 'chat-uhtml' &&
							Tools.toId(this.lastOutgoingMessage.uhtmlName) === uhtmlId &&
							Tools.toId(this.lastOutgoingMessage.html) === htmlId) {
							this.clearLastOutgoingMessage(now);
						}

						if (!uhtmlChange) room.addUhtmlChatLog(uhtmlName, html);

						if (uhtmlId in room.uhtmlMessageListeners) {
							if (htmlId in room.uhtmlMessageListeners[uhtmlId]) {
								room.uhtmlMessageListeners[uhtmlId][htmlId](now);
								delete room.uhtmlMessageListeners[uhtmlId][htmlId];
							}
						}
					} else {
						const messageId = Tools.toId(messageArguments.message);
						if (this.lastOutgoingMessage && this.lastOutgoingMessage.type === 'chat' &&
							Tools.toId(this.lastOutgoingMessage.text) === messageId) {
							this.clearLastOutgoingMessage(now);
						}

						room.addChatLog(messageArguments.message);

						if (messageId in room.messageListeners) {
							room.messageListeners[messageId](now);
							delete room.messageListeners[messageId];
						}
					}
				}
			} else {
				room.addChatLog(messageArguments.message);
				this.parseChatMessage(room, user, messageArguments.message, now);
			}

			Storage.updateLastSeen(user, messageArguments.timestamp);

			if (messageArguments.message.startsWith('/log ')) {
				if (messageArguments.message.startsWith(HANGMAN_START_COMMAND)) {
					room.serverHangman = true;
				} else if (messageArguments.message.startsWith(HANGMAN_END_COMMAND)) {
					delete room.serverHangman;
				}
			}

			break;
		}

		case ':': {
			const messageArguments: IClientMessageTypes[':'] = {
				timestamp: parseInt(messageParts[0]),
			};
			this.serverTimeOffset = Math.floor(now / 1000) - messageArguments.timestamp;
			break;
		}

		case 'pm': {
			const messageArguments: IClientMessageTypes['pm'] = {
				rank: messageParts[0].charAt(0),
				username: messageParts[0].substr(1),
				recipientRank: messageParts[1].charAt(0),
				recipientUsername: messageParts[1].substr(1),
				message: messageParts.slice(2).join("|"),
			};

			const userId = Tools.toId(messageArguments.username);
			if (!userId) return;

			const isHtml = messageArguments.message.startsWith(HTML_CHAT_COMMAND);
			const isUhtml = !isHtml && messageArguments.message.startsWith(UHTML_CHAT_COMMAND);
			const isUhtmlChange = !isHtml && !isUhtml && messageArguments.message.startsWith(UHTML_CHANGE_CHAT_COMMAND);

			const user = Users.add(messageArguments.username, userId);
			if (user === Users.self) {
				if (messageArguments.message.startsWith(USER_NOT_FOUND_MESSAGE)) return;

				const recipientId = Tools.toId(messageArguments.recipientUsername);
				if (!recipientId) return;

				const recipient = Users.add(messageArguments.recipientUsername, recipientId);
				if (isUhtml || isUhtmlChange) {
					const uhtml = messageArguments.message.substr(messageArguments.message.indexOf(" ") + 1);
					const commaIndex = uhtml.indexOf(",");
					const uhtmlName = uhtml.substr(0, commaIndex);
					const uhtmlId = Tools.toId(uhtmlName);
					const html = Tools.unescapeHTML(uhtml.substr(commaIndex + 1));
					const htmlId = Tools.toId(html);

					if (this.lastOutgoingMessage && this.lastOutgoingMessage.type === 'pm-uhtml' &&
						this.lastOutgoingMessage.user === recipient.id && Tools.toId(this.lastOutgoingMessage.uhtmlName) === uhtmlId &&
						Tools.toId(this.lastOutgoingMessage.html) === htmlId) {
						this.clearLastOutgoingMessage(now);
					}

					if (!isUhtmlChange) user.addUhtmlChatLog(uhtmlName, html);

					if (recipient.uhtmlMessageListeners) {
						if (uhtmlId in recipient.uhtmlMessageListeners) {
							if (htmlId in recipient.uhtmlMessageListeners[uhtmlId]) {
								recipient.uhtmlMessageListeners[uhtmlId][htmlId](now);
								delete recipient.uhtmlMessageListeners[uhtmlId][htmlId];
							}
						}
					}
				} else if (isHtml) {
					const html = Tools.unescapeHTML(messageArguments.message.substr(HTML_CHAT_COMMAND.length));
					const htmlId = Tools.toId(html);
					if (this.lastOutgoingMessage && this.lastOutgoingMessage.type === 'pm-html' &&
						this.lastOutgoingMessage.user === recipient.id && Tools.toId(this.lastOutgoingMessage.html) === htmlId) {
						this.clearLastOutgoingMessage(now);
					}

					user.addHtmlChatLog(html);

					if (recipient.htmlMessageListeners) {
						if (htmlId in recipient.htmlMessageListeners) {
							recipient.htmlMessageListeners[htmlId](now);
							delete recipient.htmlMessageListeners[htmlId];
						}
					}
				} else {
					const messageId = Tools.toId(messageArguments.message);
					if (this.lastOutgoingMessage && this.lastOutgoingMessage.type === 'pm' &&
						this.lastOutgoingMessage.user === recipient.id &&
						Tools.toId(this.lastOutgoingMessage.text) === messageId) {
						this.clearLastOutgoingMessage(now);
					}

					user.addChatLog(messageArguments.message);

					if (recipient.messageListeners) {
						if (messageId in recipient.messageListeners) {
							recipient.messageListeners[messageId](now);
							delete recipient.messageListeners[messageId];
						}
					}
				}
			} else {
				if (isUhtml || isUhtmlChange) {
					user.addUhtmlChatLog("", "html");
				} else if (isHtml) {
					user.addHtmlChatLog("html");
				} else {
					user.addChatLog(messageArguments.message);

					let commandMessage = messageArguments.message;
					const battleUrl = this.extractBattleId(commandMessage.startsWith(INVITE_COMMAND) ?
						commandMessage.substr(INVITE_COMMAND.length) : commandMessage);
					if (battleUrl) {
						commandMessage = Config.commandCharacter + 'check ' + battleUrl.fullId;
					}

					if (messageArguments.rank !== this.groupSymbols.locked) {
						CommandParser.parse(user, user, commandMessage, now);
					}
				}
			}
			break;
		}

		case '': {
			const messageArguments: IClientMessageTypes[''] = {
				message: rawMessage,
			};

			if (messageArguments.message.startsWith('Banned phrases in room ')) {
				let subMessage = messageArguments.message.split('Banned phrases in room ')[1];
				const colonIndex = subMessage.indexOf(':');
				const roomId = subMessage.substr(0, colonIndex);
				subMessage = subMessage.substr(colonIndex + 2);
				if (subMessage) {
					const bannedWordsRoom = Rooms.get(roomId);
					if (bannedWordsRoom) {
						bannedWordsRoom.serverBannedWords = subMessage.split(',').map(x => x.trim());
						bannedWordsRoom.serverBannedWordsRegex = null;
					}
				}
			} else if (messageArguments.message === HANGMAN_END_RAW_MESSAGE) {
				delete room.serverHangman;
			}
			break;
		}

		case 'raw':
		case 'html': {
			const messageArguments: IClientMessageTypes['html'] = {
				html: Tools.unescapeHTML(messageParts.join("|")),
			};

			room.addHtmlChatLog(messageArguments.html);

			const htmlId = Tools.toId(messageArguments.html);
			if (htmlId in room.htmlMessageListeners) {
				room.htmlMessageListeners[htmlId](now);
				delete room.htmlMessageListeners[htmlId];
			}

			if (messageArguments.html === '<strong class="message-throttle-notice">Your message was not sent because you\'ve been ' +
				'typing too quickly.</strong>') {
				Tools.logMessage("Typing too quickly;\n" + this.getSendThrottleValues().join("\n") +
					(this.lastOutgoingMessage && this.lastOutgoingMessage.sentTime ?
					"\n\nMessage sent at: " + new Date(this.lastOutgoingMessage.sentTime).toTimeString() + "; " +
					"Processing time last measured at: " + new Date(this.lastProcessingTimeCheck).toTimeString() + "; " +
					"Message: " + JSON.stringify(this.lastOutgoingMessage) : ""));
				this.setSendTimeout(this.getSendThrottle(this.lastServerProcessingType) * (SERVER_THROTTLE_BUFFER_LIMIT + 1));
			} else if (messageArguments.html.startsWith('<div class="broadcast-red"><strong>Moderated chat was set to ')) {
				room.modchat = messageArguments.html.split('<div class="broadcast-red">' +
					'<strong>Moderated chat was set to ')[1].split('!</strong>')[0];
			} else if (messageArguments.html.startsWith('<div class="broadcast-red"><strong>This battle is invite-only!</strong>') ||
				messageArguments.html.startsWith('<div class="broadcast-red"><strong>This room is now invite only!</strong>')) {
				room.inviteOnlyBattle = true;
			} else if (messageArguments.html.startsWith('<div class="broadcast-blue"><strong>Moderated chat was disabled!</strong>')) {
				room.modchat = 'off';
			} else if (messageArguments.html.startsWith('<div class="infobox infobox-limited">This tournament includes:<br />')) {
				if (room.tournament) {
					const separatedCustomRules: ISeparatedCustomRules = {
						addedbans: [], removedbans: [], addedrestrictions: [], addedrules: [], removedrules: [],
					};
					const lines = messageArguments.html.substr(0, messageArguments.html.length - 6)
						.split('<div class="infobox infobox-limited">This tournament includes:<br />')[1].split('<br />');
					let currentCategory: 'addedbans' | 'removedbans' | 'addedrestrictions' | 'addedrules' | 'removedrules' = 'addedbans';
					for (let line of lines) {
						line = line.trim();
						if (line.startsWith('<b>')) {
							const category = Tools.toId(line.split('<b>')[1].split('</b>')[0]);
							if (category === 'addedbans' || category === 'removedbans' ||
								category === 'addedrestrictions' || category === 'addedrules' || category === 'removedrules') {
								currentCategory = category;
							}
						}
						if (line.includes('</b> - ')) line = line.split('</b> - ')[1].trim();
						separatedCustomRules[currentCategory] = line.split(",").map(x => x.trim());
					}

					room.tournament.format.customRules = Dex.combineCustomRules(separatedCustomRules);
					room.tournament.format.separatedCustomRules = null;
					if (!room.tournament.manuallyNamed) room.tournament.setCustomFormatName();
				}
			} else if (messageArguments.html.startsWith('<div class="broadcast-green"><p style="text-align:left;font-weight:bold;' +
				'font-size:10pt;margin:5px 0 0 15px">The word has been guessed. Congratulations!</p>')) {
				if (room.userHostedGame) {
					const winner = messageArguments.html.split('<br />Winner: ')[1].split('</td></tr></table></div>')[0].trim();
					if (Tools.isUsernameLength(winner)) {
						room.userHostedGame.useHostCommand("addgamepoint", winner);
					}
				}
				delete room.serverHangman;
			} else if (messageArguments.html.startsWith('<div class="broadcast-red"><p style="text-align:left;font-weight:bold;' +
				'font-size:10pt;margin:5px 0 0 15px">Too bad! The mon has been hanged.</p>')) {
				delete room.serverHangman;
			} else if (messageArguments.html === "<b>The tournament's custom rules were cleared.</b>") {
				if (room.tournament) {
					room.tournament.format.customRules = null;
					room.tournament.format.separatedCustomRules = null;
					if (!room.tournament.manuallyNamed) room.tournament.setCustomFormatName();
				}
			}
			break;
		}

		case 'pagehtml': {
			if (room.id === 'view-filters') {
				let battleFilterRegularExpressions: RegExp[] | null = null;
				let chatFilterRegularExpressions: RegExp[] | null = null;
				let evasionFilterRegularExpressions: RegExp[] | null = null;
				const messageArguments: IClientMessageTypes['pagehtml'] = {
					html: Tools.unescapeHTML(messageParts.join("|")),
				};
				if (messageArguments.html.includes('<table>')) {
					const table = messageArguments.html.split('<table>')[1].split('</table>')[0];
					const rows = table.split("<tr>");
					let currentHeader = '';
					let shortener = false;
					let evasion = false;
					let battleFilter = false;

					for (const row of rows) {
						if (!row) continue;
						if (row.startsWith('<th colspan="2"><h3>')) {
							currentHeader = row.split('<th colspan="2"><h3>')[1].split('</h3>')[0].split(' <span ')[0];
							shortener = currentHeader === 'URL Shorteners';
							evasion = currentHeader === 'Filter Evasion Detection';
							battleFilter = currentHeader === 'Filtered in battles';
						} else if (row.startsWith('<td><abbr') && currentHeader !== 'Whitelisted names' &&
							currentHeader !== 'Filtered in names') {
							const word = row.split('<code>')[1].split('</code>')[0].trim();

							let replacementWord = row.split("</abbr>")[1];
							const reasonIndex = replacementWord.indexOf('</small>');
							if (reasonIndex !== -1) replacementWord = replacementWord.substr(reasonIndex + 8);
							const hasReplacement = replacementWord.includes(" &rArr; ");

							let regularExpression: RegExp | undefined;
							try {
								if (evasion) {
									regularExpression = constructEvasionRegex(word);
								} else {
									regularExpression = new RegExp(shortener ? '\\b' + word : word, hasReplacement ? 'igu' : 'iu');
								}
							} catch (e) {
								console.log(e);
								Tools.logError(e);
							}

							if (regularExpression) {
								if (evasion) {
									if (!evasionFilterRegularExpressions) evasionFilterRegularExpressions = [];
									evasionFilterRegularExpressions.push(regularExpression);
								} else if (battleFilter) {
									if (!battleFilterRegularExpressions) battleFilterRegularExpressions = [];
									battleFilterRegularExpressions.push(regularExpression);
								} else {
									if (!chatFilterRegularExpressions) chatFilterRegularExpressions = [];
									chatFilterRegularExpressions.push(regularExpression);
								}
							}
						}
					}
				}

				this.battleFilterRegularExpressions = battleFilterRegularExpressions;
				this.chatFilterRegularExpressions = chatFilterRegularExpressions;
				this.evasionFilterRegularExpressions = evasionFilterRegularExpressions;
			}
			break;
		}

		case 'uhtmlchange':
		case 'uhtml': {
			const messageArguments: IClientMessageTypes['uhtml'] = {
				name: messageParts[0],
				html: Tools.unescapeHTML(messageParts.slice(1).join("|")),
			};

			room.addUhtmlChatLog(messageArguments.name, messageArguments.html);

			const id = Tools.toId(messageArguments.name);
			if (id in room.uhtmlMessageListeners) {
				const htmlId = Tools.toId(messageArguments.html);
				if (htmlId in room.uhtmlMessageListeners[id]) {
					room.uhtmlMessageListeners[id][htmlId](now);
					delete room.uhtmlMessageListeners[id][htmlId];
				}
			}
			break;
		}

		/**
		 * Tournament messages
		 */
		case 'tournament': {
			if (!Config.allowTournaments || !Config.allowTournaments.includes(room.id)) return;

			const type = messageParts[0] as keyof ITournamentMessageTypes;
			messageParts.shift();
			switch (type) {
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
				break;
			}

			case 'end': {
				const messageArguments: ITournamentMessageTypes['end'] = {
					json: JSON.parse(messageParts.join("|")) as ITournamentEndJson,
				};

				room.addHtmlChatLog("tournament|end");

				if (!room.tournament) Tournaments.createTournament(room, messageArguments.json);
				if (room.tournament) {
					room.tournament.update(messageArguments.json);
					room.tournament.updateEnd();
					room.tournament.end();
				}
				const database = Storage.getDatabase(room);

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
						let setRandomTournament = false;
						if (Config.randomTournamentTimers && room.id in Config.randomTournamentTimers) {
							if (Tournaments.canSetRandomTournament(room)) {
								Tournaments.setRandomTournamentTimer(room, Config.randomTournamentTimers[room.id]);
								setRandomTournament = true;
							} else if (Tournaments.canSetRandomQuickTournament(room)) {
								Tournaments.setRandomTournamentTimer(room, Config.randomTournamentTimers[room.id], true);
								setRandomTournament = true;
							}
						}
						if (!setRandomTournament && room.id in Tournaments.scheduledTournaments) {
							Tournaments.setScheduledTournamentTimer(room);
						}
					}
				}
				break;
			}

			case 'forceend': {
				room.addHtmlChatLog("tournament|forceend");

				if (room.tournament) room.tournament.forceEnd();
				break;
			}

			case 'start': {
				room.addHtmlChatLog("tournament|start");

				if (room.tournament) room.tournament.start();
				break;
			}

			case 'join': {
				room.addHtmlChatLog("tournament|join");

				if (!room.tournament) return;

				const messageArguments: ITournamentMessageTypes['join'] = {
					username: messageParts[0],
				};
				room.tournament.createPlayer(messageArguments.username);
				break;
			}

			case 'leave':
			case 'disqualify': {
				room.addHtmlChatLog("tournament|leave");

				if (!room.tournament) return;

				const messageArguments: ITournamentMessageTypes['leave'] = {
					username: messageParts[0],
				};
				room.tournament.destroyPlayer(messageArguments.username);
				break;
			}

			case 'battlestart': {
				room.addHtmlChatLog("tournament|battlestart");

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
				room.addHtmlChatLog("tournament|battleend");

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

		/**
		 * Battle messages
		 */
		case 'player': {
			const messageArguments: IClientMessageTypes['player'] = {
				slot: messageParts[0],
				username: messageParts[1],
			};

			if (room.tournament) {
				room.tournament.onBattlePlayer(room, messageArguments.slot, messageArguments.username);
			}

			if (room.game) {
				if (room.game.onBattlePlayer) room.game.onBattlePlayer(room, messageArguments.slot, messageArguments.username);
			}
			break;
		}

		case 'teamsize': {
			const messageArguments: IClientMessageTypes['teamsize'] = {
				slot: messageParts[0],
				size: parseInt(messageParts[1]),
			};

			if (room.tournament) {
				room.tournament.onBattleTeamSize(room, messageArguments.slot, messageArguments.size);
			}

			if (room.game) {
				if (room.game.onBattleTeamSize && !room.game.onBattleTeamSize(room, messageArguments.slot, messageArguments.size)) {
					room.leave();
				}
			}
			break;
		}

		case 'teampreview': {
			if (room.game) {
				if (room.game.onBattleTeamPreview && !room.game.onBattleTeamPreview(room)) {
					room.leave();
				}
			}
			break;
		}

		case 'start': {
			if (room.game) {
				if (room.game.onBattleStart && !room.game.onBattleStart(room)) {
					room.leave();
				}
			}
			break;
		}

		case 'poke': {
			const messageArguments: IClientMessageTypes['poke'] = {
				slot: messageParts[0],
				details: messageParts[1],
				item: messageParts[2] === 'item',
			};

			if (room.game) {
				if (room.game.onBattlePokemon && !room.game.onBattlePokemon(room, messageArguments.slot, messageArguments.details,
					messageArguments.item)) {
					room.leave();
				}
			}
			break;
		}

		case 'faint': {
			const messageArguments: IClientMessageTypes['faint'] = {
				pokemon: messageParts[0],
			};

			if (room.tournament) {
				room.tournament.onBattleFaint(room, messageArguments.pokemon);
			}

			if (room.game) {
				if (room.game.onBattleFaint && !room.game.onBattleFaint(room, messageArguments.pokemon)) {
					room.leave();
				}
			}
			break;
		}

		case 'drag':
		case 'switch': {
			const messageArguments: IClientMessageTypes['switch'] = {
				pokemon: messageParts[0],
				details: messageParts[1],
				hpStatus: messageParts[2].split(" ") as [string, string],
			};

			if (room.game) {
				if (room.game.onBattleSwitch && !room.game.onBattleSwitch(room, messageArguments.pokemon, messageArguments.details,
					messageArguments.hpStatus)) {
					room.leave();
				}
			}
			break;
		}

		case 'win': {
			const messageArguments: IClientMessageTypes['win'] = {
				username: messageParts[0],
			};

			if (room.game) {
				if (room.game.onBattleWin) room.game.onBattleWin(room, messageArguments.username);
				room.leave();
			}

			break;
		}

		case 'expire': {
			if (room.game && room.game.onBattleExpire) room.game.onBattleExpire(room);
			break;
		}
		}
	}

	private parseChatMessage(room: Room, user: User, message: string, now: number): void {
		CommandParser.parse(room, user, message, now);

		const lowerCaseMessage = message.toLowerCase();

		// unlink tournament battle replays
		if (room.unlinkTournamentReplays && room.tournament && !room.tournament.format.team &&
			lowerCaseMessage.includes(this.replayServerAddress) && !user.hasRank(room, 'voice')) {
			const battle = this.extractBattleId(lowerCaseMessage);
			if (battle && room.tournament.battleRooms.includes(battle.publicId)) {
				room.sayCommand("/warn " + user.name + ", Please do not link to tournament battles");
			}
		}

		// unlink game battles
		if (room.game && room.game.battleData && room.game.battleRooms && (lowerCaseMessage.includes(this.replayServerAddress) ||
			lowerCaseMessage.includes(this.server)) && !user.hasRank(room, 'voice')) {
			const battle = this.extractBattleId(lowerCaseMessage);
			if (battle && room.game.battleRooms.includes(battle.publicId)) {
				room.sayCommand("/warn " + user.name + ", Please do not link to game battles");
			}
		}

		// unlink unapproved Challonge tournaments
		if (room.unlinkChallongeLinks && lowerCaseMessage.includes('challonge.com/')) {
			const links: string[] = [];
			const possibleLinks = message.split(" ");
			for (const possibleLink of possibleLinks) {
				const link = Tools.getChallongeUrl(possibleLink);
				if (link) links.push(link);
			}

			const database = Storage.getDatabase(room);
			let rank: GroupName = 'voice';
			if (Config.userHostedTournamentRanks && room.id in Config.userHostedTournamentRanks) {
				rank = Config.userHostedTournamentRanks[room.id].review;
			}

			const authOrTHC = user.hasRank(room, rank) || (database.thcWinners && user.id in database.thcWinners);
			outer:
			for (const link of links) {
				if (room.approvedUserHostedTournaments) {
					for (const i in room.approvedUserHostedTournaments) {
						if (room.approvedUserHostedTournaments[i].urls.includes(link)) {
							if (!authOrTHC && room.approvedUserHostedTournaments[i].hostId !== user.id) {
								room.sayCommand("/warn " + user.name + ", Please do not post links to other hosts' tournaments");
							}
							break outer;
						}
					}
				}

				if (authOrTHC) {
					if (!room.approvedUserHostedTournaments) room.approvedUserHostedTournaments = {};
					room.approvedUserHostedTournaments[link] = {
						hostName: user.name,
						hostId: user.id,
						startTime: now,
						approvalStatus: 'approved',
						reviewer: user.id,
						urls: [link],
					};
				} else {
					for (const i in room.newUserHostedTournaments) {
						if (room.newUserHostedTournaments[i].urls.includes(link)) {
							if (room.newUserHostedTournaments[i].hostId !== user.id) {
								room.sayCommand("/warn " + user.name + ", Please do not post links to other hosts' tournaments");
							} else if (room.newUserHostedTournaments[i].approvalStatus === 'changes-requested') {
								let name = room.newUserHostedTournaments[i].reviewer;
								const reviewer = Users.get(name);
								if (reviewer) name = reviewer.name;
								room.sayCommand("/warn " + user.name + ", " + name + " has requested changes for your tournament and you " +
									"must wait for them to be approved");
							} else {
								room.sayCommand("/warn " + user.name + ", You must wait for a staff member to approve your tournament");
							}
							break outer;
						}
					}
					room.sayCommand("/warn " + user.name + ", Your tournament must be approved by a staff member");
					user.say('Use the command ``' + Config.commandCharacter + 'gettourapproval ' + room.id + ', __bracket link__, ' +
						'__signup link__`` to get your tournament approved (insert your actual links).');
					break;
				}
			}
		}

		// per-game parsing
		if (room.game && room.game.parseChatMessage) room.game.parseChatMessage(user, message);
	}

	private parseServerGroups(): void {
		this.serverGroups = {};

		let ranking = this.serverGroupsResponse.length;
		for (const group of this.serverGroupsResponse) {
			this.serverGroups[group.symbol] = Object.assign({ranking}, group);
			ranking--;

			if (group.name === null) {
				this.groupSymbols.regularuser = group.symbol;
			} else {
				this.groupSymbols[Tools.toId(group.name) as GroupName] = group.symbol;
			}
		}
	}

	private clearLastOutgoingMessage(responseTime?: number): void {
		if (this.lastOutgoingMessage) {
			const oldServerProcessingTime = this.serverProcessingTimes[this.lastOutgoingMessage.serverProcessingType];

			if (this.lastOutgoingMessage.measure && this.lastOutgoingMessage.sentTime && responseTime) {
				const serverProcessingMeasurements = this.serverProcessingMeasurements[this.lastOutgoingMessage.serverProcessingType];
				serverProcessingMeasurements.push({
					measurement: Math.max(0, responseTime - this.lastOutgoingMessage.sentTime -
						(this.lastOutgoingMessage.serverLatency! * 2)),
					timestamp: responseTime,
				});

				while (responseTime - serverProcessingMeasurements[0].timestamp > this.maxProcessingMeasurementGap) {
					serverProcessingMeasurements.shift();
				}

				const samplesTotal = serverProcessingMeasurements.map(x => x.measurement).reduce((total, i) => total += i);
				this.serverProcessingTimes[this.lastOutgoingMessage.serverProcessingType] = samplesTotal ?
					Math.ceil(samplesTotal / serverProcessingMeasurements.length) : 0;

				this.lastProcessingTimeCheck = responseTime;
			}

			if (this.sendTimeout && this.sendTimeout !== true &&
				this.lastServerProcessingType === this.lastOutgoingMessage.serverProcessingType &&
				this.serverProcessingTimes[this.lastOutgoingMessage.serverProcessingType] > oldServerProcessingTime) {
				this.setSendTimeout(this.getSendThrottle(this.lastOutgoingMessage.serverProcessingType) +
					(this.serverProcessingTimes[this.lastOutgoingMessage.serverProcessingType] - oldServerProcessingTime));
			}

			this.lastOutgoingMessage = null;
		}
	}

	private clearSendTimeout(): void {
		if (this.sendTimeout) {
			if (this.sendTimeout === true) {
				delete this.sendTimeout;
			} else {
				clearTimeout(this.sendTimeout);
			}
		}
	}

	private setSendTimeout(time: number): void {
		this.clearSendTimeout();

		this.lastSendTimeoutTime = time;
		this.sendTimeout = setTimeout(() => {
			if (this.reloadInProgress) {
				this.sendTimeout = true;
				return;
			}

			delete this.sendTimeout;
			if (!this.outgoingMessageQueue.length) return;
			this.send(this.outgoingMessageQueue.shift()!);
		}, time);
	}

	private setRetryLoginTimeout(sessionUpkeep?: boolean): void {
		console.log((sessionUpkeep ? 'Trying' : 'Retrying') + ' login in' + RELOGIN_SECONDS + ' seconds');

		if (this.retryLoginTimeout) clearTimeout(this.retryLoginTimeout);
		this.retryLoginTimeout = setTimeout(() => this.login(), RELOGIN_SECONDS * 1000);
	}

	private checkLoginSession(): void {
		const globalDatabase = Storage.getGlobalDatabase();
		if (!Config.password || !globalDatabase.loginSessionCookie) {
			this.login();
			return;
		}

		const options: ILoginOptions = {
			hostname: this.loginServerHostname,
			path: this.loginServerPath,
			agent: false,
			method: 'POST',
		};

		const postData =  querystring.stringify({
			'act': 'upkeep',
			'challstr': this.challstr,
		});

		options.headers = {
			'Content-Type': 'application/x-www-form-urlencoded',
			'Content-Length': postData.length,
			'cookie': globalDatabase.loginSessionCookie,
		};

		const request = https.request(options, response => {
			response.setEncoding('utf8');
			let data = '';
			response.on('data', chunk => {
				data += chunk;
			});
			response.on('end', () => {
				if (!data) {
					console.log('Did not receive a response from the login server.');
					this.login();
					return;
				}

				if (data.charAt(0) === ']') data = data.substr(1);

				let sessionAssertion: string | undefined;
				try {
					const sessionResponse = JSON.parse(data) as {assertion?: string; username?: string, loggedin?: boolean};
					if (sessionResponse.username && sessionResponse.loggedin) {
						sessionAssertion = sessionResponse.assertion;
					}
				} catch (e) {
					console.log('Error parsing session upkeep response:\n' + (e as Error).stack);
					this.setRetryLoginTimeout(true);
					return;
				}

				if (!sessionAssertion || !this.verifyLoginAssertion(sessionAssertion, true)) {
					delete globalDatabase.loginSessionCookie;
					this.login();
				}
			});
		});

		request.on('error', error => {
			console.log('Error in session upkeep call: ' + error.stack);
			this.setRetryLoginTimeout(true);
		});

		if (postData) request.write(postData);
		request.end();
	}

	private login(): void {
		if (this.retryLoginTimeout) clearTimeout(this.retryLoginTimeout);

		const options: ILoginOptions = {
			hostname: this.loginServerHostname,
			path: this.loginServerPath,
			agent: false,
			method: '',
		};

		let postData = '';
		if (Config.password) {
			options.method = 'POST';
			postData = querystring.stringify({
				'act': 'login',
				'name': Config.username,
				'pass': Config.password,
				'challstr': this.challstr,
			});
			options.headers = {
				'Content-Type': 'application/x-www-form-urlencoded',
				'Content-Length': postData.length,
			};
		} else {
			options.method = 'GET';
			options.path += '?' + querystring.stringify({
				'act': 'getassertion',
				'userid': Tools.toId(Config.username),
				'challstr': this.challstr,
			});
		}

		const request = https.request(options, response => {
			response.setEncoding('utf8');
			let data = '';
			response.on('data', chunk => {
				data += chunk;
			});
			response.on('end', () => {
				if (!data) {
					console.log('Did not receive a response from the login server.');
					this.setRetryLoginTimeout();
					return;
				}

				if (response.headers['set-cookie']) {
					for (const cookie of response.headers['set-cookie']) {
						const equalsIndex = cookie.indexOf('=');
						if (equalsIndex !== -1 && cookie.substr(0, equalsIndex) === 'sid') {
							let value = cookie;
							const semiColonIndex = value.indexOf(';');
							if (semiColonIndex !== -1) value = value.substr(0, semiColonIndex);

							Storage.getGlobalDatabase().loginSessionCookie = value;
							Storage.exportGlobalDatabase();
						}
					}
				}

				if (data.charAt(0) === ']') data = data.substr(1);

				let loginAssertion = '';
				try {
					const loginResponse = JSON.parse(data) as {assertion: string; curuser?: {loggedin: boolean}};
					if (Config.password && (!loginResponse.curuser || !loginResponse.curuser.loggedin)) {
						console.log('Failed to log in.');
						this.setRetryLoginTimeout();
						return;
					}

					loginAssertion = loginResponse.assertion;
				} catch (e) {
					console.log('Error parsing login response:\n' + (e as Error).stack);
					this.setRetryLoginTimeout();
					return;
				}

				this.verifyLoginAssertion(loginAssertion);
			});
		});

		request.on('error', error => {
			console.log('Error in login call: ' + error.stack);
			this.setRetryLoginTimeout();
		});

		if (postData) request.write(postData);
		request.end();
	}

	private verifyLoginAssertion(assertion: string, sessionUpkeep?: boolean): boolean {
		if (assertion.slice(0, 14).toLowerCase() === '<!doctype html') {
			const endIndex = assertion.indexOf('>');
			if (endIndex !== -1) assertion = assertion.slice(endIndex + 1);
		}
		if (assertion.charAt(0) === '\r') assertion = assertion.slice(1);
		if (assertion.charAt(0) === '\n') assertion = assertion.slice(1);
		if (assertion.indexOf('<') >= 0) {
			const message = 'Something is interfering with the connection to the login server.';
			if (sessionUpkeep) {
				console.log(message + ' (session upkeep)');
			} else {
				console.log(message);
				this.setRetryLoginTimeout();
			}
			return false;
		}

		if (assertion.substr(0, 2) === ';;') {
			if (sessionUpkeep) {
				console.log('Failed to check session: invalid cookie');
				return false;
			} else {
				console.log('Failed to log in: invalid username or password');
				process.exit();
			}
		} else if (assertion.indexOf('\n') >= 0 || !assertion) {
			const message = 'Something is interfering with the connection to the login server.';
			if (sessionUpkeep) {
				console.log(message + ' (session upkeep)');
			} else {
				console.log(message);
				this.setRetryLoginTimeout();
			}
			return false;
		} else {
			this.send({message: '|/trn ' + Config.username + ',0,' + assertion, type: 'command', serverProcessingType: 'not-measured'});
			return true;
		}
	}
}

export const instantiate = (): void => {
	const oldClient = global.Client as Client | undefined;
	if (oldClient) {
		// @ts-expect-error
		oldClient.beforeReload();
	}

	global.Client = new Client();

	if (oldClient) {
		// @ts-expect-error
		global.Client.onReload(oldClient);
	}
};
