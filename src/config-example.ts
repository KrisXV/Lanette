import { GroupName } from "./client";

/* eslint-disable prefer-const*/

/**
 * Values in the object will override the values set throughout the config when starting Lanette with `tempConfig.js`
 */
export let tempConfig: typeof Config = {};

/**
 * The username used for logging in to PS
 */
export let username = '';

/**
 * The password used for logging in to PS
 *
 * Leave blank if the username is unregistered
 */
export let password = '';

/**
 * The server address used to connect to PS (must end in .psim.us)
 *
 * Leave blank to connect to the main server
 */
export let server = '';

/**
 * The base amount of time (in milliseconds) between connection attempts
 */
export let reconnectTime = 60 * 1000;

/**
 * A list of rooms to join after logging in
 */
export let rooms: string[] = [];

/**
 * Room aliases that can be used with user input
 */
export let roomAliases: Dict<string> = {};

/**
 * The avatar code to use after logging in
 */
export let avatar = '';

/**
 * The character used to denote commands in chat messages
 */
export let commandCharacter = '.';

/**
 * Whether or not PS code should be updated upon hotpatching
 */
export let autoUpdatePS: boolean = false;

/**
 * Whether or not users can send messages to other offline users
 */
export let allowMail: boolean = true;

/**
 * Userids of those who should have access to the eval command
 */
export let developers: string[] = [];

/**
 * For each room in the object, the length of time in which an awarded bot greeting will last
 */
export let awardedBotGreetingDurations: Dict<number> = {};

/* eslint-enable prefer-const*/