// eslint-disable-next-line @typescript-eslint/camelcase
import child_process = require('child_process');
import fs = require('fs');
import https = require('https');
import path = require('path');

import { ICommandDefinition } from "./command-parser";
import { commandCharacter } from './config';
import { Player } from "./room-activity";
import { Game } from './room-game';
import { IBattleData } from './room-tournament';
import { Room } from "./rooms";
import { GameDifficulty, IGameFormat } from "./types/games";
import { IFormat } from "./types/in-game-data-types";
import { User } from "./users";
import { UserHostStatus } from './types/storage';
import { UserHosted } from './games/internal/user-hosted';

type ReloadableModule = 'client' | 'commandparser' | 'commands' | 'config' | 'dex' | 'games' | 'storage' | 'tools' | 'tournaments';
const moduleOrder: ReloadableModule[] = ['tools', 'config', 'dex', 'client', 'commandparser', 'commands', 'games', 'storage', 'tournaments'];

const AWARDED_BOT_GREETING_DURATION = 60 * 24 * 60 * 60 * 1000;

let reloadInProgress = false;

const ALL_TIERS = ['AG', 'Uber', 'OU', 'UUBL', 'UU', 'RUBL', 'RU', 'NUBL', 'NU', 'PUBL', 'PU', 'ZU', 'NFE', 'LC Uber', 'LC', 'CAP', 'CAP NFE', 'CAP LC', 'DUber', 'DOU', 'DBL', 'DUU', 'DNU', 'Mega', 'All Pokemon', 'All Abilities', 'All Items', 'All Moves'].map(toID);

/* eslint-disable @typescript-eslint/explicit-function-return-type,@typescript-eslint/no-unused-vars*/
const commands: Dict<ICommandDefinition> = {
	shockedlapras: {
		command(target, room, user) {
			if (this.isPm(room) || !user.canPerform(room, 'roomowner')) return;
			this.sayUhtml(``, `<img src="https://cdn.discordapp.com/emojis/528403513894502440.png?v=1" alt="shockedlapras" width="20" height="20" />`, room);
			return;
		},
		aliases: ['sl'],
	},
	tourconfig: {
		command(target, room, user) {
			if (this.isPm(room)) return;
			if (!user.canPerform(room, 'moderator')) return;
			if (!target) return this.say(`${commandCharacter}econfig autostart/autodq`);
			target = target.trim();
			const args = target.split(' ');
			if (!Storage.getDatabase(room).tourcfg) {
				Storage.databases[room.id].tourcfg = {
					autodq: {
						randoms: 2,
						normal: 3,
					},
					autostart: 3,
				};
				Storage.exportDatabase(room.id);
			}
			const db = Storage.getDatabase(room).tourcfg;
			switch (toID(args[0])) {
			case 'reset':
				Storage.databases[room.id].tourcfg = {
					autodq: {
						randoms: 2,
						normal: 3,
					},
					autostart: 3,
				};
				Storage.exportDatabase(room.id);
				this.say("``eliminationtour`` configuration reset.");
				return;
			case 'autodq':
			case 'setautodq':
			case 'adq':
				if (
					!args[1] ||
					!args[2] ||
					!['randoms', 'normal'].includes(toID(args[1]))
				) {
					return this.say(`Correct syntax: ${commandCharacter}econfig autodq randoms/normal __[number | "off"]__`);
				}
				const arg2ID = toID(args[2]);
				const arg2Int = parseFloat(arg2ID);
				if (toID(args[1]) === 'randoms') {
					if (arg2ID !== 'off' && isNaN(arg2Int)) {
						return this.say(`${args[2]} must either be an integer or "off".`);
					}
					if (arg2ID === 'off' || arg2Int === 0) {
						db!.autodq.randoms = 'off';
						Storage.exportDatabase(room.id);
						return this.say(`Autodq timer for random formats successfully turned off.`);
					}
					db!.autodq.randoms = arg2Int;
					Storage.exportDatabase(room.id);
					return this.say(`Autodq timer for random formats successfully set to ${arg2Int} minutes.`);
				}
				if (arg2ID !== 'off' && isNaN(arg2Int)) {
					return this.say(`${args[2]} must either be an integer or "off".`);
				}
				if (arg2ID === 'off' || arg2Int === 0) {
					db!.autodq.normal = 'off';
					Storage.exportDatabase(room.id);
					return this.say(`Autodq timer for non-random formats successfully turned off.`);
				}
				db!.autodq.normal = arg2Int;
				Storage.exportDatabase(room.id);
				return this.say(`Autodq timer for non-random formats successfully set to ${arg2Int} minutes.`);
			case 'autostart':
			case 'setautostart':
			case 'as':
				if (!args[1]) {
					return this.say(`Correct syntax: ${commandCharacter}econfig autostart __[number/"off"]__`);
				}
				const arg1ID = toID(args[1]);
				const arg1Int = parseInt(arg1ID);
				if (arg1ID !== 'off' && isNaN(arg1Int)) return this.say(`${args[2]} must either be a number or "off".`);
				if (arg1ID === 'off' || arg1Int === 0) {
					db!.autostart = "off";
					Storage.exportDatabase(room.id);
					return this.say(`Autostart successfully turned off.`);
				}
				db!.autostart = arg1Int;
				Storage.exportDatabase(room.id);
				return this.say(`Autostart successfully set to ${arg1Int}.`);
			default:
		return this.say(`Correct syntax: ${commandCharacter}econfig autostart/autodq`);
			}
		},
		aliases: ['econfig'],
	},
	/**
	 * Sample team commands
	 */
	addsample: {
		command(target, room, user) {
			if (this.isPm(room)) return this.say(`This can only be used in rooms.`);
			if (!user.canPerform(room, 'driver')) return;
			if (!target) return this.say(`Correct Syntax: ${commandCharacter}addsample __[tier]__, __[link]__`);
			target = target.trim();
			const args = target.split(',');
			const db = Storage.getDatabase(room);
			if (!db.samples) {
				db.samples = {};
				Storage.exportDatabase(room.id);
			}
			if (!args[0]) return this.say(`Correct syntax: ${commandCharacter}addsample __[tier]__, __[;ink]__`);
			const arg0ID = toID(args[0]);
			if (!args[1]) return this.say(`Correct syntax: ${commandCharacter}addsample __[tier]__, __[;ink]__`);
			if (!args[1].trim().startsWith('http')) return this.say("Please provide a valid link.");
			if (!(arg0ID in db.samples)) {
				db.samples[arg0ID] = [];
				Storage.exportDatabase(room.id);
				this.say(`Sample team storage for ${args[0].trim()} created.`);
			}
			const index = db.samples[arg0ID].findIndex(tier => toID(tier) === toID(args[1]));
			if (index >= 0) return this.say("That link is already in the database.");
			db.samples[arg0ID].push(args[1].trim());
			Storage.exportDatabase(room.id);
			return this.say("Sample team added.");
		},
		aliases: ['addsamples'],
	},
	removesample: {
		command(target, room, user) {
			if (this.isPm(room)) return this.say(`This can only be used in rooms.`);
			if (!user.canPerform(room, 'driver')) return;
			if (!target) return this.say(`Correct Syntax: ${commandCharacter}delsample __[tier]__, __[link]__`);
			target = target.trim();
			const args = target.split(',');
			const db = Storage.getDatabase(room);
			if (!db.samples) return this.say(`There are no samples.`);
			if (!args[0]) return this.say(`Correct syntax: ${commandCharacter}delsample __[tier]__, __[link]__`);
			const arg0ID = toID(args[0]);
			if (!args[1]) return this.say(`Correct syntax: ${commandCharacter}delsample __[tier]__, __[link]__`);
			if (!args[1].trim().startsWith('http')) return this.say("Please provide a valid link.");
			if (!(arg0ID in db.samples)) return this.say(`The format ${args[0].trim()} wasn't found.`);
			const index = db.samples[arg0ID].findIndex(link => toID(link) === toID(args[1]));
			if (index < 0) return this.say("That link isn't in the database.");
			db.samples[arg0ID].splice(index, 1);
			Storage.exportDatabase(room.id);
			return this.say("Sample team removed.");
		},
		aliases: ['removesamples', 'deletesample', 'deletesamples', 'delsample', 'remsample'],
	},
	samples: {
		command(target, room, user) {
			const args = target.trim().split(',');
			if (this.isPm(room)) return;
			const db = Storage.getDatabase(room);
			if (!db.samples) return this.say(`There are no sample teams.`);
			const arg0ID = toID(args[0]);
			if (!(arg0ID in db.samples)) return this.say(`Format not found.`);
			if (!db.samples[arg0ID].length) return this.say(`There are currently no sample teams for ${args[0].trim()}.`);
			if (db.samples[arg0ID].length === 1) return this.say(`Sample teams for \`\`${args[0].trim()}\`\`: ${db.samples[arg0ID][0]}`);
			if (Users.self.hasRank(room, 'bot')) {
				let buf = `<h4>Sample teams for ${arg0ID}:</h4>`;
				buf += `<p>`;
				for (const link of db.samples[arg0ID]) {
					if (db.samples[arg0ID].indexOf(link) === db.samples[arg0ID].length - 1) {
						buf += `&bull; <a href="${link}">${link}</a>`;
					} else {
						buf += `&bull; <a href="${link}">${link}</a><br />`;
					}
				}
				buf += `</p>`;
				return this.sayHtml(buf, room);
			}
			const prettyTeamList = `Sample teams for ${arg0ID}:\n\n${db.samples[arg0ID].map((team, index) => `${index + 1}: ${team}`).join('\n')}`;
			Tools.uploadToHastebin(prettyTeamList, hastebinUrl => {
				return this.say(`Sample teams for ${arg0ID}: ${hastebinUrl}`);
			});
		},
		aliases: ['sample'],
	},
	host: {
		command(target, room, user) {
			if (this.isPm(room)) return this.say(`This command can only be used in rooms.`);
			if (!user.canPerform(room, 'driver')) return;
			if (!target) return this.say(`Correct syntax: ${commandCharacter}host __[user]__`);
			target = target.trim();
			if (!Storage.databases[room.id].hosts) {
				Storage.databases[room.id].hosts = [];
				Storage.exportDatabase(room.id);
			}
			const db = Storage.getDatabase(room).hosts;
			if (target.length > 18) return this.say(`Please provide a real username.`);
			const index = db!.findIndex(host => toID(host) === toID(target));
			if (index >= 0) return this.say(`That user is already a host.`);
			db!.push(toID(target));
			Storage.exportDatabase(room.id);
			this.makeModnote(`ADDHOST: ${toID(target)} by ${user.id}`);
			return this.say(`User '${target}' successfully added as a host.`);
		},
		aliases: ['addhost'],
	},
	dehost: {
		command(target, room, user) {
			if (this.isPm(room)) return this.say(`This command can only be used in rooms.`);
			if (!user.canPerform(room, 'driver')) return;
			if (!target) return this.say(`Correct syntax: ${commandCharacter}dehost __[user]__`);
			target = target.trim();
			const db = Storage.getDatabase(room).hosts;
			if (!db) return this.say(`There are no hosts.`);
			if (target.length > 18) return this.say(`Please provide a real username.`);
			const index = db.findIndex(host => toID(host) === toID(target));
			if (index < 0) return this.say(`That user is not a host.`);
			db.splice(index, 1);
			Storage.exportDatabase(room.id);
			this.makeModnote(`REMOVEHOST: ${toID(target)} by ${user.id}`);
			return this.say(`User '${target}' successfully removed as a host.`);
		},
		aliases: ['unhost', 'remhost', 'removehost'],
	},
	clearhosts: {
		command(target, room, user) {
			if (this.isPm(room)) return;
			if (!user.canPerform(room, 'roomowner')) return;
			target = target.trim();
			Storage.getDatabase(room).hosts = [];
			Storage.exportDatabase(room.id);
			this.makeModnote(`${user.name} cleared the host list.`);
			return this.say(`Host list successfully cleared.`);
		},
	},
	viewhosts: {
		command(target, room, user) {
			if (this.isPm(room)) return;
			if (!user.canPerform(room, 'driver')) return;
			const hosts = Storage.getDatabase(room).hosts;
			if (!hosts || !hosts.length) return this.say(`There are currently no hosts.`);
			const prettyHostList = `Hosts for ${room.id}:\n\n${hosts.map((host, index) => `${index + 1}: ${host}`).join('\n')}`;
			Tools.uploadToHastebin(prettyHostList, hastebinUrl => {
				this.say(`**${room.id}** hosts: ${hastebinUrl}`);
			});
		},
		aliases: ['hosts'],
	},
	/**
	 * Room commands
	 */
	eliminationtour: {
		command(target, room, user) {
			if (!this.isPm(room) && !user.canPerform(room, 'driver') && !user.isHost(room)) return;
			const args = target.split(' ');
			if (!args[0] || toID(args[0]) === 'help') {
				return this.say(`\`\`@etour\`\` command guide: [[here <https://pastebin.com/raw/fN23vVUn>]]`);
			}
			if (this.isPm(room)) return;
			const db = Storage.getDatabase(room);
			if (!db.tourRuleset) {
				db.tourRuleset = [];
			}
			// const tour = db.tourRuleset;
			// const samples = db.samples!;
			if (!db.tourcfg) {
				db.tourcfg = {
					autodq: {
						normal: 3,
						randoms: 2,
					},
					autostart: 2,
				};
			}
			const tourcfg = db.tourcfg;
			const arg0ID = toID(args[0]);
			if (['start', 'forcestart'].includes(arg0ID)) {
				this.makeModnote(`TOUR: started by ${user.id}`);
				this.say(`/tour start`);
				return;
			} else if (['end', 'forceend'].includes(arg0ID)) {
				this.makeModnote(`TOUR: ended by ${user.id}`);
				this.say('/tour end');
				return;
			} else if (['name', 'setname'].includes(arg0ID)) {
				const name = args.slice(1).join(' ').trim();
				if (!name) return this.say(`Correct syntax: ${commandCharacter}etour name __[name]__`);
				this.makeModnote(`TOUR: renamed by ${user.id}`);
				this.say(`/tour name ${name}`);
				return;
			} else if (['clearname', 'delname'].includes(arg0ID)) {
				this.makeModnote(`TOUR: name cleared by ${user.id}`);
				this.say(`/tour clearname`);
				return;
			} else if (['autostart', 'setautostart', 'as'].includes(arg0ID)) {
				if (!args[1]) return this.say(`Correct syntax: ${commandCharacter}etour autostart __[number | "off"]__`);
				const autostartTimer = parseInt(args[1]);
				if (toID(args[1]) !== 'off' && isNaN(autostartTimer)) return this.say(`${args[1]} is not a number.`);
				if (toID(args[1]) === 'off' || autostartTimer === 0) return this.say(`/tour autostart off`);
				this.makeModnote(`TOUR: autostart set by ${user.id}`);
				this.say(`/tour autostart ${autostartTimer}`);
				return;
			} else if (['autodq', 'setautodq', 'adq', 'runautodq'].includes(arg0ID)) {
				if (arg0ID === 'runautodq') return this.say(`/tour runautodq`);
				if (!args[1]) return this.say(`Correct syntax: ${commandCharacter}etour autodq __[number | "off"]__`);
				const autodqTimer = parseInt(args[1]);
				if (toID(args[1]) !== 'off' && isNaN(autodqTimer)) return this.say(`${args[1]} is not a number.`);
				if (toID(args[1]) === 'off' || autodqTimer === 0) return this.say(`/tour autodq off`);
				this.makeModnote(`TOUR: autodq set by ${user.id}`);
				this.say(`/tour autodq ${autodqTimer}`);
				return;
			} else if (['dq', 'disqualify'].includes(arg0ID)) {
				const targetUString = args.slice(1).join(' ').trim();
				if (!Tools.isUsernameLength(targetUString)) return this.say(`User '${targetUString}' not found.`);
				this.makeModnote(`TOUR: ${targetUString} disqualified by ${user.id}`);
				this.say(`/tour dq ${targetUString}`);
				return;
			} else if (['addrule'].includes(arg0ID)) {
				const addedRules = args.slice(1).join(' ').trim().split(',');
				if (!addedRules.length) return this.say(`Please provide rules to add. Here is a list: https://github.com/smogon/pokemon-showdown/blob/master/config/CUSTOM-RULES.md`);
				for (const rule of addedRules.map(r => r.trim())) {
					if (!Dex.getFormat(rule)) return this.say(`Rule '${rule}' not found. [[Here is a list of rules <Here is a list: https://github.com/smogon/pokemon-showdown/blob/master/config/CUSTOM-RULES.md>]]`);
					if (db.tourRuleset.includes(`!${rule}`)) {
						const ruleIndex = db.tourRuleset.indexOf(`!${rule}`);
						db.tourRuleset.splice(ruleIndex, 1);
						Storage.exportDatabase(room.id);
					} else {
						if (db.tourRuleset.includes(rule)) return this.say(`The rule ${rule} is already added.`);
						db.tourRuleset.push(rule);
						Storage.exportDatabase(room.id);
					}
				}
				this.makeModnote(`TOUR: Ruleset adjusted by ${user.id}`);
				this.say(`/tour rules ${db.tourRuleset.join(',')}`);
				return;
			} else if (['delrule', 'removerule'].includes(arg0ID)) {
				const removedRules = args.slice(1).join(' ').trim().split(',');
				if (!removedRules.length) return this.say(`Please provide rules to add. Here is a list: https://github.com/smogon/pokemon-showdown/blob/master/config/CUSTOM-RULES.md`);
				for (const rule of removedRules.map(r => r.trim())) {
					if (!Dex.getFormat(rule)) return this.say(`Rule '${rule}' not found. [[Here is a list of rules <Here is a list: https://github.com/smogon/pokemon-showdown/blob/master/config/CUSTOM-RULES.md>]]`);
					if (db.tourRuleset.includes(rule)) {
						const ruleIndex = db.tourRuleset.indexOf(rule);
						db.tourRuleset.splice(ruleIndex, 1);
						Storage.exportDatabase(room.id);
					} else {
						if (db.tourRuleset.includes(`!${rule}`)) return this.say(`The rule ${rule} is already added.`);
						db.tourRuleset.push(`!${rule}`);
						Storage.exportDatabase(room.id);
					}
				}
				this.makeModnote(`TOUR: Ruleset adjusted by ${user.id}`);
				this.say(`/tour rules ${db.tourRuleset.join(',')}`);
				return;
			} else if (['ban', 'addban'].includes(arg0ID)) {
				const banlist = args.slice(1).join(' ').trim().split(',');
				if (!banlist.length) return this.say(`Please provide Pokemon/items/moves/abilities/tiers to ban.`);
				for (const ban of banlist.map(r => r.trim())) {
					if (
						!Dex.getTemplate(ban) &&
						!Dex.getItem(ban) &&
						!Dex.getMove(ban) &&
						!Dex.getAbility(ban) &&
						!ALL_TIERS.includes(toID(ban))
					) {
						return this.say(`Invalid ban '${ban}'`);
					}
					if (db.tourRuleset.includes(`+${ban}`)) {
						const banIndex = db.tourRuleset.indexOf(`+${ban}`);
						db.tourRuleset.splice(banIndex, 1);
						Storage.exportDatabase(room.id);
					} else {
						if (db.tourRuleset.includes(`-${ban}`)) return this.say(`The object ${ban} is already added.`);
						db.tourRuleset.push(`-${ban}`);
						Storage.exportDatabase(room.id);
					}
				}
				this.makeModnote(`TOUR: Ruleset adjusted by ${user.id}`);
				this.say(`/tour rules ${db.tourRuleset.join(',')}`);
				return;
			} else if (['unban', 'removeban'].includes(arg0ID)) {
				const unbanlist = args.slice(1).join(' ').trim().split(',');
				if (!unbanlist.length) return this.say(`Please provide Pokemon/items/moves/abilities/tiers to unban.`);
				for (const unban of unbanlist.map(r => r.trim())) {
					if (
						!Dex.getTemplate(unban) &&
						!Dex.getItem(unban) &&
						!Dex.getMove(unban) &&
						!Dex.getAbility(unban) &&
						!ALL_TIERS.includes(toID(unban))
					) {
						return this.say(`Invalid unban '${unban}'`);
					}
					if (db.tourRuleset.includes(`-${unban}`)) {
						const unbanIndex = db.tourRuleset.indexOf(`-${unban}`);
						db.tourRuleset.splice(unbanIndex, 1);
						Storage.exportDatabase(room.id);
					} else {
						if (db.tourRuleset.includes(`+${unban}`)) return this.say(`The object ${unban} is already added.`);
						db.tourRuleset.push(`+${unban}`);
						Storage.exportDatabase(room.id);
					}
				}
				this.makeModnote(`TOUR: Ruleset adjusted by ${user.id}`);
				this.say(`/tour rules ${db.tourRuleset.join(',')}`);
				return;
			} else if (['rules'].includes(arg0ID)) {
				const ruleList = args.slice(1).join(' ').trim().split(',');
				if (!ruleList.length) return this.say(`Invalid rule ''`);
				for (const rule of ruleList.map(r => r.trim())) {
					if (rule.startsWith('!')) {
						if (!Dex.getFormat(rule)) return this.say(`Invalid Rule '${rule}'`);
						if (db.tourRuleset.map(toID).includes(toID(rule))) {
							db.tourRuleset.splice(db.tourRuleset.map(toID).indexOf(toID(rule)), 1);
							Storage.exportDatabase(room.id);
						} else {
							if (db.tourRuleset.map(toID).includes(toID(rule))) {
								return this.say(`${rule} is already in the ruleset.`);
							}
							db.tourRuleset.push(rule);
							Storage.exportDatabase(room.id);
						}
					} else if (['+', '-'].includes(rule.charAt(0))) {
						const slicedRule = rule.substr(1);
						if (slicedRule.includes('+')) {
							const slindex = slicedRule.indexOf('++');
							let split = slicedRule.split('+');
							if (slindex >= 0) split = slicedRule.split('++');
							for (const sp of split.map(x => x.trim())) {
								if (
									!Dex.getTemplate(sp) &&
									!Dex.getItem(sp) &&
									!Dex.getMove(sp) &&
									!Dex.getAbility(sp) &&
									!ALL_TIERS.includes(toID(sp))
								) {
									return this.say(`Invalid section of ${rule.charAt(0) === '-' ? 'ban' : 'unban'} '${rule}': ${sp}`);
								}
								if (toID(sp) === 'metronome') {
									return this.say(`Please specify the Metronome you'd like to ban by preceding it with \`\`item:\`\` or \`\`move:\`\``);
								}
							}
							if (db.tourRuleset.map(toID).includes(toID(rule))) {
								db.tourRuleset.splice(db.tourRuleset.map(toID).indexOf(toID(rule)), 1);
								Storage.exportDatabase(room.id);
							} else {
								if (db.tourRuleset.map(toID).includes(toID(rule))) {
									return this.say(`${rule} is already in the ruleset.`);
								}
								db.tourRuleset.push(rule);
								Storage.exportDatabase(room.id);
							}
						} else {
							if (
								!Dex.getTemplate(rule) &&
								!Dex.getItem(rule) &&
								!Dex.getMove(rule) &&
								!Dex.getAbility(rule) &&
								!ALL_TIERS.includes(toID(rule))
							) {
								return this.say(`Invalid ${rule.charAt(0) === '-' ? 'ban' : 'unban'} '${rule}'`);
							}
							if (toID(rule) === 'metronome') {
								return this.say(`Please specify the Metronome you'd like to ban by preceding it with \`\`item:\`\` or \`\`move:\`\``);
							}
							if (db.tourRuleset.map(toID).includes(toID(rule))) {
								db.tourRuleset.splice(db.tourRuleset.map(toID).indexOf(toID(rule)), 1);
								Storage.exportDatabase(room.id);
							} else {
								if (db.tourRuleset.map(toID).includes(toID(rule))) {
									return this.say(`${rule} is already in the ruleset.`);
								}
								db.tourRuleset.push(rule);
								Storage.exportDatabase(room.id);
							}
						}
					} else {
						if (!Dex.getFormat(rule)) return this.say(`Invalid Rule '${rule}'`);
						if (db.tourRuleset.map(toID).includes(toID(rule))) {
							db.tourRuleset.splice(db.tourRuleset.map(toID).indexOf(toID(rule)), 1);
							Storage.exportDatabase(room.id);
						} else {
							if (db.tourRuleset.map(toID).includes(toID(rule))) {
								return this.say(`${rule} is already in the ruleset.`);
							}
							db.tourRuleset.push(rule);
							Storage.exportDatabase(room.id);
						}
					}
				}
				this.makeModnote(`TOUR: Ruleset adjusted by ${user.id}`);
				this.say(`/tour rules ${db.tourRuleset.join(',')}`);
				return;
			} else if (['clearrules'].includes(arg0ID)) {
				db.tourRuleset = [];
				this.makeModnote(`TOUR: Ruleset cleared by ${user.id}`);
				this.say(`/tour clearrules`);
				return;
			} else if (['viewrules'].includes(arg0ID)) {
				this.say(`!tour viewrules`);
				return;
			} else if (['timer', 'forcetimer'].includes(arg0ID)) {
				if (!args[1] || !['on', 'off'].includes(toID(args[1]))) return this.say(`Correct syntax: ${commandCharacter}etour timer __["on" | "off"]__`);
				this.makeModnote(`TOUR: Forcetimer toggled by ${user.id}`);
				this.say(`/tour forcetimer ${toID(args[1])}`);
				return;
			} else if (['scout', 'scouting'].includes(arg0ID)) {
				if (!args[1] || !['on', 'off'].includes(toID(args[1]))) return this.say(`Correct syntax: ${commandCharacter}etour scouting __["on" | "off"]__`);
				this.makeModnote(`TOUR: Scouting toggled by ${user.id}`);
				if (toID(args[1]) === 'on') {
					this.say(`/tour scouting allow`);
				} else {
					this.say(`/tour scouting disallow`);
				}
				return;
			} else if (['modjoin'].includes(arg0ID)) {
				if (!args[1] || !['on', 'off'].includes(toID(args[1]))) return this.say(`Correct syntax: ${commandCharacter}etour scouting __["on" | "off"]__`);
				this.makeModnote(`TOUR: Modjoin toggled by ${user.id}`);
				if (toID(args[1]) === 'on') {
					this.say(`/tour modjoin allow`);
				} else {
					this.say(`/tour modjoin disallow`);
				}
				return;
			} else if (['cap', 'playercap'].includes(arg0ID)) {
				const arg1Int = parseInt(args[1]);
				if (!args[1] || isNaN(arg1Int)) return this.say(`Correct syntax: ${commandCharacter}etour playercap __[number]__`);
				this.makeModnote(`TOUR: Player cap set to ${arg1Int} by ${user.id}`);
				this.say(`/tour cap ${arg1Int}`);
				return;
			} else if (arg0ID) {
				const targets = args.join(' ').trim().split(',');
				const f = targets[0];
				const format = Dex.getFormat(f) ? Dex.getFormat(f) : Dex.getCustomFormat(f, room) ? Dex.getCustomFormat(f, room) : null;
				if (!format) return this.say(`Please provide a valid format.`);
				const baseFormat = 'id' in format ? format : format.baseFormat;
				let formatid: string;
				formatid = baseFormat.id;
				let tourcmd = `/tour new ${formatid}`;
				if (targets[1] && ['elimination', 'elim', 'roundrobin'].includes(toID(targets[1]))) {
					tourcmd += `, ${toID(targets[1])}`;
				} else {
					tourcmd += `, elimination`;
				}
				if (targets[2]) {
					const t2Int = parseInt(targets[2]);
					if (isNaN(t2Int)) return this.say(`Correct syntax: ${commandCharacter}etour __[format]__, __["elimination" | "roundrobin"]__, __[player cap]__`);
					tourcmd += `, ${t2Int}`;
				} else {
					tourcmd += `,`;
				}
				if (targets[3]) {
					const t3Int = parseInt(targets[3]);
					if (isNaN(t3Int)) return this.say(`Correct syntax: ${commandCharacter}etour __[format]__, __["elimination" | "roundrobin"]__, __[player cap]__, __[rounds]__`);
					tourcmd += `, ${t3Int}`;
				} else {
					tourcmd += `,`;
				}
				const name = targets[4] ? targets.slice(4).join(',') : format.name !== baseFormat.name ? format.name.trim() : baseFormat.name.trim();
				if (name) {
					tourcmd += `, ${name}`;
				} else {
					tourcmd += `,`;
				}
				this.makeModnote(`TOUR: ${formatid} made by ${user.id}`);
				db.tourRuleset = [];
				Storage.exportDatabase(room.id);
				this.say(tourcmd);
				if (tourcfg.autostart && !['off', 0].includes(tourcfg.autostart)) {
					this.say(`/tour autostart ${tourcfg.autostart}`);
				}
				if (!baseFormat.team) {
					this.say(`!rfaq ${formatid.slice(0, 4)}samples`);
				} else {
					this.say(`!rfaq oldgenmoves`);
				}
				if (!('id' in format)) {
					db.tourRuleset = db.tourRuleset.concat(format.remrules).concat(format.addrules).concat(format.bans).concat(format.unbans);
					Storage.exportDatabase(room.id);
					this.say(`/tour rules ${db.tourRuleset.join(',')}`);
				}
				return;
			}
		},
		aliases: ['etour'],
	},
	deletebanlist: {
		command(target, room, user) {
			if (this.isPm(room)) return this.say(`This command can only be used in rooms.`);
			if (!user.canPerform(room, 'moderator')) return;
			if (!target) return this.say(`Correct syntax: ${commandCharacter}delbanlist [ID]`);
			const formatid = toID(target);
			const rset = Storage.getDatabase(room).ruleset;
			if (!rset) return this.say(`This room doesn't have any custom banlists.`);
			if (!(formatid in rset)) return this.say(`The custom banlist '${target}' doesn't exist.`);
			const name = rset[formatid].name;
			delete rset[formatid];
			Storage.exportDatabase(room.id);
			return this.say(`Custom banlist for '${name}' successfully deleted.`);
		},
		aliases: ['delbanlist', 'delbl', 'removebanlist', 'delruleset', 'removeruleset'],
	},
	addbanlist: {
		command(target, room, user) {
			if (this.isPm(room)) return this.say(`This command can only be used in rooms.`);
			if (!user.canPerform(room, 'moderator')) return;
			if (!target) return this.say(`Correct syntax: ${commandCharacter}addbanlist Name | Base Format | Ruleset <separated by commas and using !, +, - format> | Aliases (optional, separated by commas)`);
			const targets = target.split('|');
			if (targets.length < 3) return this.say(`Correct syntax: ${commandCharacter}addbanlist Name | Base Format | Ruleset <separated by commas and using !, +, - format> | Aliases (optional, separated by commas)`);
			const name = targets[0].trim();
			const id = toID(name);
			const format = Dex.getFormat(targets[1]);
			if (!format) return this.say(`Invalid format '${targets[1].trim()}'.`);
			let ruleString = targets[2].trim();
			if (ruleString.startsWith('https://hastebin.com/raw/')) {
				https.get(ruleString, res => {
					let data = '';
					res.on('data', chunk => {
						data += chunk;
					});
					ruleString = data;
					res.on('end', () => {
						ruleString = data;
					});
					ruleString = data;
					res.on('error', err => console.log(err.stack));
					ruleString = data;
				});
			}
			const rules = ruleString.trim().split(',');
			if (!rules.length) return this.say(`Correct syntax: ${commandCharacter}addbanlist Name | Base Format | Ruleset <separated by commas and using !, +, - format> | Aliases (optional, separated by commas)`);
			if (!Storage.databases[room.id].ruleset) {
				Storage.databases[room.id].ruleset = {};
				Storage.exportDatabase(room.id);
			}
			const db = Storage.getDatabase(room);
			if (!db.ruleset) {
				db.ruleset = {};
				Storage.exportDatabase(room.id);
			}
			if (!(id in db.ruleset)) {
				db.ruleset[id] = {name: name.trim(), baseFormat: format, remrules: [], addrules: [], bans: [], unbans: []};
				Storage.exportDatabase(room.id);
				this.say(`Custom rule table for ${name} created. (This does not mean the rules were added.)`);
			}
			const rset = db.ruleset[id];
			for (let rule of rules.map(r => r.trim())) {
				if (rule.startsWith('!')) {
					if (!Dex.getFormat(rule)) return this.say(`Invalid Rule '${rule}'`);
					rset.remrules.push(rule);
					Storage.exportDatabase(room.id);
				} else if (['+', '-'].includes(rule.charAt(0))) {
					const slicedRule = rule.substr(1);
					if (slicedRule.includes('+')) {
						const slindex = slicedRule.indexOf('++');
						let split = slicedRule.split('+');
						if (slindex >= 0) split = slicedRule.split('++');
						for (let sp of split.map(x => x.trim())) {
							const usingValidMetronomeBan = toID(sp).includes('metronome') && toID(sp.slice(4)) === 'metronome';
							let usedSp = sp;
							if (usingValidMetronomeBan) {
								sp = toID(sp).startsWith('move') ? 'move:Metronome' : 'item:Metronome';
								usedSp = 'metronome';
							}
							if (
								!Dex.getTemplate(usedSp) &&
								!Dex.getItem(usedSp) &&
								!Dex.getMove(usedSp) &&
								!Dex.getAbility(usedSp) &&
								!ALL_TIERS.includes(toID(usedSp))
							) {
								return this.say(`Invalid section of ${rule.charAt(0) === '-' ? 'ban' : 'unban'} '${rule}': ${sp}`);
							}
							if (toID(usedSp) === 'metronome' && !usingValidMetronomeBan) {
								return this.say(`Please specify the Metronome you'd like to ban by preceding it with \`\`item:\`\` or \`\`move:\`\``);
							}
						}
						if (rule.charAt(0) === '+') {
							rset.unbans.push(rule);
							Storage.exportDatabase(room.id);
						} else {
							rset.bans.push(rule);
							Storage.exportDatabase(room.id);
						}
					} else {
						const usingValidMetronomeBan = toID(rule).includes('metronome') && toID(rule.slice(4)) === 'metronome';
						let usedRule = rule;
						if (usingValidMetronomeBan) {
							rule = toID(rule).startsWith('move') ? 'move:Metronome' : 'item:Metronome';
							usedRule = 'metronome';
						}
						if (
							!Dex.getTemplate(usedRule) &&
							!Dex.getItem(usedRule) &&
							!Dex.getMove(usedRule) &&
							!Dex.getAbility(usedRule) &&
							!ALL_TIERS.includes(toID(usedRule))
						) {
							return this.say(`Invalid ${rule.charAt(0) === '-' ? 'ban' : 'unban'} '${rule}'`);
						}
						if (toID(usedRule) === 'metronome' && !usingValidMetronomeBan) {
							return this.say(`Please specify the Metronome you'd like to ban by preceding it with \`\`item:\`\` or \`\`move:\`\``);
						}
						if (rule.charAt(0) === '+') {
							rset.unbans.push(rule);
							Storage.exportDatabase(room.id);
						} else {
							rset.bans.push(rule);
							Storage.exportDatabase(room.id);
						}
					}
				} else {
					if (!Dex.getFormat(rule)) return this.say(`Invalid Rule '${rule}'`);
					rset.addrules.push(rule);
					Storage.exportDatabase(room.id);
				}
			}
			if (targets[3]) {
				const a = targets[3].trim().split(',').map(toID);
				if (!rset.aliases) {
					rset.aliases = a;
					Storage.exportDatabase(room.id);
				} else {
					for (const al of a) {
						if (rset.aliases.includes(al)) continue;
						rset.aliases.push(al);
						Storage.exportDatabase(room.id);
					}
				}
			}
			return this.say(`Custom banlist for format '${name.trim()}' added.`);
		},
		aliases: ['addruleset', 'addbl'],
	},
	/**
	 * BOF commands
	 */
	/*massinvite: {
		command(target, room, user) {
			if (room.id !== 'bof') return;
			if (this.isPm(room)) return;
			if (!user.canPerform(room, 'roomowner')) return;
			return this.say('/roomauth');
		},
	},*/
	pokemon: {
		command(target, room, user) {
			if (room.id !== 'bof') return;
			if (this.isPm(room)) return;
			const db = Storage.getDatabase(room);
			if (!db.rank) {
				db.rank = {
					pokeitem: 'driver',
				};
				Storage.exportDatabase(room.id);
			}
			if (!user.canPerform(room, db.rank.pokeitem)) return;
			if (!target || !Dex.getTemplate(target)) return this.say(`that literally is not a pokemon`);
			this.sayUhtml(toID(target), `<psicon pokemon="${toID(target)}">`, room);
		},
	},
	item: {
		command(target, room, user) {
			if (room.id !== 'bof') return;
			if (this.isPm(room)) return;
			const db = Storage.getDatabase(room);
			if (!db.rank) {
				db.rank = {
					pokeitem: 'driver',
				};
				Storage.exportDatabase(room.id);
			}
			if (!user.canPerform(room, db.rank.pokeitem)) return;
			if (!target || !Dex.getItem(target)) return this.say(`that literally is not an item`);
			this.sayUhtml(toID(target), `<psicon item="${toID(target)}">`, room);
		},
	},
	repeat: {
		command(target, room, user) {
			if (room.id !== 'bof') return;
			if (this.isPm(room)) return;
			const count = parseInt(target.split(',')[0]);
			if (isNaN(count)) return this.say(`${target.split(',')[0]} is not a number.`);
			if (count < 0 || count > 5) return this.say(`The count must be a number between 1 and 100.`);
			const args = target.split(',').slice(1);
			if (args.length < 2) return;
			for (const i of args) {
				if (!Dex.getTemplate(i)) return this.say(`${i} is not a Pokemon.`);
			}
			let c = 0;
			while (c < count) {
				args.forEach(x => this.sayUhtml('repeat', `<psicon pokemon="${x}">`, room));
				c++;
			}
		},
	},
	lasagna: {
		command(target, room, user) {
			if (room.id !== 'bof' || this.isPm(room) || !user.canPerform(room, 'roomowner')) return;
			const str = 'i fucking hate it i fucking hate lasagna its the fucking its the worst thing my dad always makes fucking god damn lasagna at christmas and its the worst i fucking hate it its like my least favorite food my brother hates it too i dont know why my dad fucking makes that shit its fucking disgusting i hate lasagna fuck';
			if (target) {
				if (!Tools.isUsernameLength(target.trim())) return;
				return this.say(`/pminfobox ${target}, ${str}`);
			}
			this.sayUhtml('lasgna', 'i fucking hate it i fucking hate lasagna its the fucking its the worst thing my dad always makes fucking god damn lasagna at christmas and its the worst i fucking hate it its like my least favorite food my brother hates it too i dont know why my dad fucking makes that shit its fucking disgusting i hate lasagna fuck', room);
		},
	},
	illegalmons: {
		command(target, room, user) {
			if (room.id !== 'bof') return;
			if (this.isPm(room)) return;
			if (!user.canPerform(room, 'roomowner')) return;
			let t = toID(target);
			if (!t) t = 'all';
			if (t === 'all') return this.say(`lol im not broadcasting that`);
			const illegalMonsList: {[k: string]: string[]} = {cap: [], past: [], future: [], custom: [], unobtainable: [], lgpe: []};
			for (const i in Dex.data.pokedex) {
				const template = Dex.getTemplate(i);
				if (!template || typeof template.isNonstandard !== 'string') continue;
				if (template.isNonstandard === 'CAP') {
					illegalMonsList.cap.push(template.name);
				}
				if (template.isNonstandard === 'Past') {
					illegalMonsList.past.push(template.name);
				}
				if (template.isNonstandard === 'Future') {
					illegalMonsList.future.push(template.name);
				}
				if (template.isNonstandard === 'Unobtainable') {
					illegalMonsList.unobtainable.push(template.name);
				}
				if (template.isNonstandard === 'Custom') {
					illegalMonsList.custom.push(template.name);
				}
				if (template.isNonstandard === 'LGPE') {
					illegalMonsList.lgpe.push(template.name);
				}
			}
			let usedArray = [];
			switch (t) {
				case 'cap': usedArray = illegalMonsList.cap; break;
				// case 'past': usedArray = illegalMonsList.past; break;
				case 'future': usedArray = illegalMonsList.future; break;
				case 'unobtainable': usedArray = illegalMonsList.unobtainable; break;
				case 'custom': usedArray = illegalMonsList.custom; break;
				case 'lgpe': usedArray = illegalMonsList.lgpe; break;
				default: usedArray = illegalMonsList.custom.concat(illegalMonsList.lgpe); break;
			}
			const buf = usedArray.sort().map(x => `<span style="white-space:nowrap;text-decoration:none;"><psicon pokemon="${x}">${x}</span>`).join(`,`);
			this.sayHtml(buf, room);
		},
	},
	/**
	 * Developer commands
	 */
	eval: {
		command(target, room, user) {
			if (room.id === 'bof' && !user.isDeveloper()) {
				return this.say(`/pm ${user.id}, good job trying to use my commands you clown`);
			}
			try {
				this.say(eval(target));
			} catch (e) {
				this.say(e.message);
				console.log(e.stack);
			}
		},
		aliases: ['js'],
		developerOnly: true,
	},
	gitpull: {
		command(target, room, user) {
			// eslint-disable-next-line @typescript-eslint/camelcase
			child_process.exec('git pull', {}, err => {
				if (err) {
					this.say("An error occurred while running ``git pull``: " + err.message);
				} else {
					this.say("Successfully ran ``git pull``.");
				}
			});
		},
		developerOnly: true,
	},
	updateps: {
		command(target, room, user) {
			this.say("Running ``update-ps``...");
			Tools.runUpdatePS(user);
		},
		developerOnly: true,
	},
	reload: {
		async asyncCommand(target, room, user) {
			if (!target) return;
			const hasModules: boolean[] = moduleOrder.slice().map(x => false);
			const targets = target.split(",");
			for (let i = 0; i < targets.length; i++) {
				const id = toID(targets[i]) as ReloadableModule;
				if (id === 'commandparser') {
					if (Storage.workers.logs.requestsByUserid.length) return this.say("You must wait for all logs requests to finish first.");
				}
				const moduleIndex = moduleOrder.indexOf(id);
				if (moduleIndex !== -1) {
					hasModules[moduleIndex] = true;
				} else {
					return this.say("'" + targets[i].trim() + "' is not a module or cannot be reloaded.");
				}
			}

			if (reloadInProgress) return this.say("You must wait for the current reload to finish.");
			reloadInProgress = true;

			const modules: ReloadableModule[] = [];
			for (let i = 0; i < hasModules.length; i++) {
				if (hasModules[i]) modules.push(moduleOrder[i]);
			}

			if (modules.includes('commandparser')) CommandParser.reloadInProgress = true;

			this.say("Running ``tsc``...");
			// eslint-disable-next-line @typescript-eslint/no-var-requires
			await require(path.join(Tools.rootFolder, 'build.js'))(() => {
				for (let i = 0; i < modules.length; i++) {
					if (modules[i] === 'client') {
						const oldClient = global.Client;
						Tools.uncacheTree('./client');
						// eslint-disable-next-line @typescript-eslint/no-var-requires
						const client: typeof import('./client') = require('./client');
						global.Client = new client.Client();
						Client.onReload(oldClient);
					} else if (modules[i] === 'commandparser') {
						Tools.uncacheTree('./command-parser');
						// eslint-disable-next-line @typescript-eslint/no-var-requires
						const commandParser: typeof import('./command-parser') = require('./command-parser');
						global.CommandParser = new commandParser.CommandParser();
					} else if (modules[i] === 'commands') {
						Tools.uncacheTree('./commands');
						// eslint-disable-next-line @typescript-eslint/no-var-requires
						global.Commands = CommandParser.loadBaseCommands(require('./commands'));
					} else if (modules[i] === 'config') {
						Tools.uncacheTree('./config');
						Tools.uncacheTree('./config-loader');
						// eslint-disable-next-line @typescript-eslint/no-var-requires
						const config: typeof import('./config-example') = require('./config-loader').load(require('./config'));
						global.Config = config;
						Rooms.checkLoggingConfigs();
					} else if (modules[i] === 'dex') {
						Tools.uncacheTree('./dex');
						// eslint-disable-next-line @typescript-eslint/no-var-requires
						const dex: typeof import('./dex') = require('./dex');
						global.Dex = new dex.Dex();
					} else if (modules[i] === 'storage') {
						const oldStorage = global.Storage;
						Storage.unrefWorkers();
						Tools.uncacheTree('./storage');
						// eslint-disable-next-line @typescript-eslint/no-var-requires
						const storage: typeof import('./storage') = require('./storage');
						global.Storage = new storage.Storage();
						Storage.onReload(oldStorage);
					} else if (modules[i] === 'tools') {
						const oldTools = global.Tools;
						Tools.uncacheTree('./tools');
						// eslint-disable-next-line @typescript-eslint/no-var-requires
						const tools: typeof import('./tools') = require('./tools');
						global.Tools = new tools.Tools();
						Tools.onReload(oldTools);
					} else if (modules[i] === 'tournaments') {
						const oldTournaments = global.Tournaments;
						Tools.uncacheTree('./tournaments');
						Tools.uncacheTree('./room-activity');
						// eslint-disable-next-line @typescript-eslint/no-var-requires
						const tournaments: typeof import('./tournaments') = require('./tournaments');
						global.Tournaments = new tournaments.Tournaments();
						Tournaments.onReload(oldTournaments);
					}
				}
				this.say("Successfully reloaded: " + modules.join(", "));
				reloadInProgress = false;
			}, () => {
				this.say("Failed to build files.");
				reloadInProgress = false;
				if (CommandParser.reloadInProgress) CommandParser.reloadInProgress = false;
			});
		},
		aliases: ['hotpatch'],
		developerOnly: true,
	},

	/**
	 * Informational commands
	 */
	jointournament: {
		command(target, room, user) {
			if (!this.isPm(room) && !user.hasRank(room, 'voice')) return;
			const targetUser = Users.get(target);
			this.say((targetUser ? targetUser.name + ": you" : "You") + " can join a scripted tournament by clicking the ``Join`` button at the top of the chat or using the command ``/tour join``. | Guide to joining user-hosted tournaments: http://pstournaments.weebly.com/joining-a-tournament.html");
		},
		aliases: ['jointour'],
	},
	autodq: {
		command(target, room, user) {
			if (this.isPm(room) || !user.hasRank(room, 'voice')) return;
			if (!Config.tournamentAutoDQTimers || !(room.id in Config.tournamentAutoDQTimers)) return this.say("The automatic disqualification timer is not set for " + room.title + ".");
			this.say("The automatic disqualification timer is currently set to " + Config.tournamentAutoDQTimers[room.id] + " minutes. You will be disqualified from a tournament if you fail to send or accept a challenge from your opponent before the timer expires.");
		},
	},
	sampleteams: {
		command(target, room, user) {
			if (!this.isPm(room) && !user.hasRank(room, 'voice')) return;
			const format = Dex.getFormat(target);
			if (!format) return this.sayError(['invalidFormat', target]);
			if (!format.teams) return this.say("No sample teams link found for " + format.name + ".");
			this.say("**" + format.name + " sample teams**: " + format.teams);
		},
		aliases: ['steams'],
	},
	viabilityranking: {
		command(target, room, user) {
			if (!this.isPm(room) && !user.hasRank(room, 'voice')) return;
			const format = Dex.getFormat(target);
			if (!format) return this.sayError(['invalidFormat', target]);
			if (!format.viability) return this.say("No viability ranking link found for " + format.name + ".");
			this.say("**" + format.name + " viability ranking**: " + format.viability);
		},
		aliases: ['vranking'],
	},
	format: {
		command(target, room, user) {
			let pmRoom: Room | undefined;
			if (this.isPm(room)) {
				user.rooms.forEach((value, room) => {
					if (!pmRoom && Users.self.hasRank(room, 'bot')) pmRoom = room;
				});
				if (!pmRoom) return this.say("You must be in a room where " + Users.self.name + " has bot rank.");
			} else {
				if (!user.hasRank(room, 'voice')) return;
				pmRoom = room;
			}
			const format = Dex.getFormat(target);
			if (!format) return this.sayError(['invalidFormat', target]);
			const html = Dex.getFormatInfoDisplay(format);
			if (!html.length) return this.say("No info found for " + format.name + ".");
			this.sayHtml("<b>" + format.name + "</b>" + html, pmRoom);
		},
		aliases: ['om', 'tier'],
	},

	/**
	 * Tournament commands
	 */
	tournament: {
		command(target, room, user) {
			let tournamentRoom: Room;
			if (this.isPm(room)) {
				const targetRoom = Rooms.search(target);
				if (!targetRoom) return this.sayError(['invalidBotRoom', target]);
				if (!Config.allowTournaments || !Config.allowTournaments.includes(targetRoom.id)) return this.sayError(['disabledTournamentFeatures', targetRoom.title]);
				if (!user.rooms.has(targetRoom)) return this.sayError(['noPmHtmlRoom', targetRoom.title]);
				tournamentRoom = targetRoom;
			} else {
				if (target) return this.run('createtournament');
				if (!user.hasRank(room, 'voice')) return;
				if (!Config.allowTournaments || !Config.allowTournaments.includes(room.id)) return this.sayError(['disabledTournamentFeatures', room.title]);
				tournamentRoom = room;
			}

			if (!tournamentRoom.tournament) return this.say("A tournament is not in progress in this room.");
			const tournament = tournamentRoom.tournament;
			let html = "<b>" + tournament.name + " " + (tournament.isRoundRobin ? "Round Robin " : "") + "tournament</b><br />";
			if (tournament.started) {
				if (tournament.startTime) html += "<b>Duration</b>: " + Tools.toDurationString(Date.now() - tournament.startTime) + "<br />";
				const remainingPlayers = tournament.getRemainingPlayerCount();
				if (remainingPlayers !== tournament.totalPlayers) {
					html += "<b>Remaining players</b>: " + remainingPlayers + "/" + tournament.totalPlayers;
				} else {
					html += "<b>Players</b>: " + remainingPlayers;
				}
			} else {
				html += "<b>Signups duration</b>: " + Tools.toDurationString(Date.now() - tournament.createTime) + "<br />";
				html += "<b>" + tournament.playerCount + "</b> player" + (tournament.playerCount === 1 ? " has" : "s have") + " joined";
			}
			this.sayHtml(html, tournamentRoom);
		},
		aliases: ['tour'],
	},
	createtournament: {
		command(target, room, user) {
			if (this.isPm(room) || !user.hasRank(room, 'driver')) return;
			if (!Config.allowTournaments || !Config.allowTournaments.includes(room.id)) return this.sayError(['disabledTournamentFeatures', room.title]);
			if (!Users.self.hasRank(room, 'bot')) return this.sayError(['missingBotRankForFeatures', 'tournament']);
			if (room.tournament) return this.say("There is already a tournament in progress in this room.");
			const format = Dex.getFormat(target);
			if (!format || !format.tournamentPlayable) return this.sayError(['invalidTournamentFormat', format ? format.name : target]);
			let playerCap: number = 0;
			if (Config.defaultTournamentPlayerCaps && room.id in Config.defaultTournamentPlayerCaps) {
				playerCap = Config.defaultTournamentPlayerCaps[room.id];
			}
			this.sayCommand("/tour new " + format.name + ", elimination" + (playerCap ? ", " + playerCap : ""));
		},
		aliases: ['createtour', 'ct'],
	},
	tournamentcap: {
		command(target, room, user) {
			if (this.isPm(room) || !room.tournament || room.tournament.started || !user.hasRank(room, 'driver')) return;
			const cap = parseInt(target);
			if (isNaN(cap)) return this.say("You must specify a valid player cap.");
			if (cap < Tournaments.minPlayerCap || cap > Tournaments.maxPlayerCap) return this.say("The tournament's player cap must be between " + Tournaments.minPlayerCap + " and " + Tournaments.maxPlayerCap + ".");
			if (room.tournament.adjustCapTimer) clearTimeout(room.tournament.adjustCapTimer);
			this.sayCommand("/tour cap " + cap);
			if (!room.tournament.playerCap) this.sayCommand("/tour autostart on");
			this.say("The tournament's player cap is now **" + cap + "**.");
		},
		aliases: ['tcap'],
	},
	tournamentenablepoints: {
		command(target, room, user, cmd) {
			if (this.isPm(room) || !room.tournament || !user.hasRank(room, 'driver')) return;
			if (!(Config.rankedTournaments && Config.rankedTournaments.includes(room.id) && !(Config.rankedCustomTournaments && Config.rankedCustomTournaments.includes(room.id)))) {
				return this.say("A tournament leaderboard is not enabled for this room.");
			}
			if (cmd === 'tournamentenablepoints' || cmd === 'tourenablepoints') {
				if (room.tournament.canAwardPoints() || room.tournament.manuallyEnabledPoints) return this.say("The " + room.tournament.name + " tournament will already award leaderboard points.");
				room.tournament.manuallyEnabledPoints = true;
				this.say("The " + room.tournament.name + " tournament will now award leaderboard points.");
			} else {
				if (!room.tournament.canAwardPoints() || !room.tournament.manuallyEnabledPoints) return this.say("The " + room.tournament.name + " tournament will already not award leaderboard points.");
				room.tournament.manuallyEnabledPoints = false;
				this.say("The " + room.tournament.name + " tournament will no longer award leaderboard points.");
			}
		},
		aliases: ['tourenablepoints', 'tournamentdisablepoints', 'tourdisablepoints'],
	},
	tournamentbattlescore: {
		command(target, room, user) {
			const targets = target.split(",");
			let tournamentRoom: Room;
			if (this.isPm(room)) {
				const targetRoom = Rooms.search(targets[0]);
				if (!targetRoom) return this.sayError(['invalidBotRoom', targets[0]]);
				targets.shift();
				tournamentRoom = targetRoom;
			} else {
				if (!user.hasRank(room, 'voice')) return;
				tournamentRoom = room;
			}

			if (!tournamentRoom.tournament) return this.say("A tournament is not in progress in this room.");
			if (tournamentRoom.tournament.generator !== 1) return this.say("This command is currently only usable in Single Elimination tournaments.");
			const id = toID(targets[0]);
			if (!(id in tournamentRoom.tournament.players)) return this.say("'" + targets[0] + "' is not a player in the " + tournamentRoom.title + " tournament.");
			const targetPlayer = tournamentRoom.tournament.players[id];
			if (targetPlayer.eliminated) return this.say(targetPlayer.name + " has already been eliminated from the " + tournamentRoom.title + " tournament.");

			let currentBattle: IBattleData | undefined;
			for (let i = 0; i < tournamentRoom.tournament.currentBattles.length; i++) {
				if (tournamentRoom.tournament.currentBattles[i].playerA === targetPlayer || tournamentRoom.tournament.currentBattles[i].playerB === targetPlayer) {
					currentBattle = tournamentRoom.tournament.battleData[tournamentRoom.tournament.currentBattles[i].roomid];
					break;
				}
			}

			if (!currentBattle) return this.say(targetPlayer.name + " is not currently in a tournament battle.");
			const slots = Tools.shuffle(Object.keys(currentBattle.remainingPokemon));
			this.say("The score of " + targetPlayer.name + "'s current battle is " + (slots.length < 2 ? "not yet available" : currentBattle.remainingPokemon[slots[0]] + " - " + currentBattle.remainingPokemon[slots[1]]) + ".");
		},
		aliases: ['tbscore', 'tbattlescore'],
	},
	scheduledtournament: {
		command(target, room, user) {
			const targets = target.split(',');
			let tournamentRoom: Room;
			if (this.isPm(room)) {
				const targetRoom = Rooms.search(targets[0]);
				if (!targetRoom) return this.sayError(['invalidBotRoom', targets[0]]);
				targets.shift();
				if (!Config.allowTournaments || !Config.allowTournaments.includes(targetRoom.id)) return this.sayError(['disabledTournamentFeatures', targetRoom.title]);
				if (!user.rooms.has(targetRoom)) return this.sayError(['noPmHtmlRoom', targetRoom.title]);
				if (!(targetRoom.id in Tournaments.nextScheduledTournaments)) return this.say("There is no tournament scheduled for " + targetRoom.title + ".");
				tournamentRoom = targetRoom;
			} else {
				if (!user.hasRank(room, 'voice')) return;
				if (!Config.allowTournaments || !Config.allowTournaments.includes(room.id)) return this.sayError(['disabledTournamentFeatures', room.title]);
				if (!(room.id in Tournaments.nextScheduledTournaments)) return this.say("There is no tournament scheduled for this room.");
				tournamentRoom = room;
			}

			const scheduledTournament = Tournaments.nextScheduledTournaments[tournamentRoom.id];
			const format = Dex.getExistingFormat(scheduledTournament.format, true);
			const now = Date.now();
			let html = "<b>Next" + (this.pm ? " " + tournamentRoom.title : "") + " scheduled tournament</b>: " + format.name + "<br />";
			if (now > scheduledTournament.time) {
				html += "<b>Delayed</b><br />";
			} else {
				html += "<b>Starting in</b>: " + Tools.toDurationString(scheduledTournament.time - now) + "<br />";
			}

			if (format.customRules) html += "<br /><b>Custom rules:</b><br />" + Dex.getCustomRulesHtml(format);
			this.sayHtml(html, tournamentRoom);
		},
		aliases: ['scheduledtour', 'officialtournament', 'officialtour', 'official'],
	},
	gettournamentschedule: {
		command(target, room, user) {
			const targets = target.split(',');
			let tournamentRoom: Room;
			if (this.isPm(room)) {
				const targetRoom = Rooms.search(targets[0]);
				if (!targetRoom) return this.sayError(['invalidBotRoom', targets[0]]);
				targets.shift();
				if (!user.hasRank(targetRoom, 'moderator')) return;
				if (!Config.allowTournaments || !Config.allowTournaments.includes(targetRoom.id)) return this.sayError(['disabledTournamentFeatures', targetRoom.title]);
				tournamentRoom = targetRoom;
			} else {
				if (!user.hasRank(room, 'moderator')) return;
				if (!Config.allowTournaments || !Config.allowTournaments.includes(room.id)) return this.sayError(['disabledTournamentFeatures', room.title]);
				tournamentRoom = room;
			}
			const month = parseInt(targets[0]);
			if (isNaN(month)) return this.say("You must specify the month (1-12).");
			const schedule = Tournaments.getTournamentScheduleHtml(tournamentRoom);
			if (!schedule) return this.say("No tournament schedule found for " + tournamentRoom.title + ".");
			this.sayCommand("!code " + schedule);
		},
		aliases: ['gettourschedule'],
	},
	queuetournament: {
		command(target, room, user, cmd) {
			if (this.isPm(room) || !user.hasRank(room, 'driver')) return;
			if (!Config.allowTournaments || !Config.allowTournaments.includes(room.id)) return this.sayError(['disabledTournamentFeatures', room.title]);
			if (!Users.self.hasRank(room, 'bot')) return this.sayError(['missingBotRankForFeatures', 'tournament']);
			const database = Storage.getDatabase(room);
			if (database.queuedTournament && !cmd.startsWith('force')) {
				const format = Dex.getFormat(database.queuedTournament.formatid, true);
				if (format) {
					return this.say(format.name + " is already queued for " + room.title + ".");
				} else {
					delete database.queuedTournament;
				}
			}
			if (target.includes('@@@')) return this.say("You must specify custom rules separately (``" + Config.commandCharacter + cmd + " format, cap, custom rules``).");
			const targets = target.split(',');
			const id = toID(targets[0]);
			let scheduled = false;
			let format: IFormat | null = null;
			if (id === 'scheduled' || id === 'official') {
				if (!(room.id in Tournaments.schedules)) return this.say("There is no tournament schedule for this room.");
				scheduled = true;
				format = Dex.getExistingFormat(Tournaments.nextScheduledTournaments[room.id].format, true);
			} else {
				if (room.id in Tournaments.nextScheduledTournaments && Date.now() > Tournaments.nextScheduledTournaments[room.id].time) return this.say("The scheduled tournament is delayed so you must wait until after it starts.");
				format = Dex.getFormat(targets[0]);
				if (!format || !format.tournamentPlayable) return this.sayError(['invalidTournamentFormat', format ? format.name : target]);
				if (Tournaments.isInPastTournaments(room, format.inputTarget)) return this.say(format.name + " is on the past tournaments list and cannot be queued.");
			}

			let playerCap: number = 0;
			if (scheduled) {
				if (Config.scheduledTournamentsMaxPlayerCap && Config.scheduledTournamentsMaxPlayerCap.includes(room.id)) playerCap = Tournaments.maxPlayerCap;
			} else if (targets.length > 1) {
				playerCap = parseInt(targets[1]);
				if (isNaN(playerCap)) return this.say("You must specify a valid number for the player cap.");
				if (playerCap && (playerCap < Tournaments.minPlayerCap || playerCap > Tournaments.maxPlayerCap)) {
					return this.say("You must specify a player cap between " + Tournaments.minPlayerCap + " and " + Tournaments.maxPlayerCap + ".");
				}
			}
			if (!playerCap && Config.defaultTournamentPlayerCaps && room.id in Config.defaultTournamentPlayerCaps) {
				playerCap = Config.defaultTournamentPlayerCaps[room.id];
			}

			if (targets.length > 2) {
				if (scheduled) {
					if (format.customRules) return this.say("You cannot alter the custom rules of scheduled tournaments.");
					return this.say("You cannot add custom rules to scheduled tournaments.");
				}
				const customRules: string[] = [];
				for (let i = 2; i < targets.length; i++) {
					const rule = targets[i].trim();
					if (format.team && (rule.charAt(0) === '+' || rule.charAt(0) === '-')) return this.say("You currently cannot specify bans or unbans for formats with generated teams.");
					try {
						Dex.validateRule(rule, format);
					} catch (e) {
						return this.say(e.message);
					}
					customRules.push(rule);
				}
				format = Dex.getExistingFormat(format.name + "@@@" + customRules.join(','), true);
			}

			let time: number = 0;
			if (scheduled) {
				time = Tournaments.nextScheduledTournaments[room.id].time;
			} else if (!room.tournament) {
				const now = Date.now();
				if (database.lastTournamentTime) {
					if (database.lastTournamentTime + Tournaments.queuedTournamentTime < now) {
						time = now + Tournaments.delayedScheduledTournamentTime;
					} else {
						time = database.lastTournamentTime + Tournaments.queuedTournamentTime;
					}
				} else {
					database.lastTournamentTime = now;
					time = now + Tournaments.queuedTournamentTime;
				}
			}

			database.queuedTournament = {formatid: format.name + (format.customRules ? '@@@' + format.customRules.join(',') : ''), playerCap, scheduled, time};
			if (scheduled) {
				Tournaments.setScheduledTournamentTimer(room);
			} else if (time) {
				Tournaments.setTournamentTimer(room, time, format, playerCap);
			}
			this.run('queuedtournament', '');

			Storage.exportDatabase(room.id);
		},
		aliases: ['forcequeuetournament', 'forcenexttournament', 'forcenexttour'],
	},
	queuedtournament: {
		command(target, room, user) {
			let tournamentRoom: Room;
			if (this.isPm(room)) {
				const targetRoom = Rooms.search(target);
				if (!targetRoom) return this.sayError(['invalidBotRoom', target]);
				if (!Config.allowTournaments || !Config.allowTournaments.includes(targetRoom.id)) return this.sayError(['disabledTournamentFeatures', targetRoom.title]);
				if (!user.rooms.has(targetRoom)) return this.sayError(['noPmHtmlRoom', targetRoom.title]);
				tournamentRoom = targetRoom;
			} else {
				if (!user.hasRank(room, 'voice')) return;
				if (!Config.allowTournaments || !Config.allowTournaments.includes(room.id)) return this.sayError(['disabledTournamentFeatures', room.title]);
				if (target) return this.run('queuetournament');
				tournamentRoom = room;
			}

			const database = Storage.getDatabase(tournamentRoom);
			const errorText = "There is no tournament queued for " + (this.pm ? tournamentRoom.title : "this room") + ".";
			if (!database.queuedTournament) return this.say(errorText);
			const format = Dex.getFormat(database.queuedTournament.formatid, true);
			if (!format) {
				delete database.queuedTournament;
				Storage.exportDatabase(tournamentRoom.id);
				return this.say(errorText);
			}
			let html = "<b>Queued" + (this.pm ? " " + tournamentRoom.title : "") + " tournament</b>: " + format.name + (database.queuedTournament.scheduled ? " <i>(scheduled)</i>" : "") + "<br />";
			if (database.queuedTournament.time) {
				const now = Date.now();
				if (now > database.queuedTournament.time) {
					html += "<b>Delayed</b><br />";
				} else {
					html += "<b>Starting in</b>: " + Tools.toDurationString(database.queuedTournament.time - now) + "<br />";
				}
			} else if (tournamentRoom.tournament) {
				html += "<b>Starting in</b>: " + Tools.toDurationString(Tournaments.queuedTournamentTime) + " after the " + tournamentRoom.tournament.name + " tournament ends<br />";
			}

			if (format.customRules) html += "<br /><b>Custom rules:</b><br />" + Dex.getCustomRulesHtml(format);
			this.sayHtml(html, tournamentRoom);
		},
		aliases: ['queuedtour', 'nexttournament', 'nexttour'],
	},
	pasttournaments: {
		command(target, room, user) {
			const targets = target.split(',');
			let tournamentRoom: Room;
			if (this.isPm(room)) {
				const targetRoom = Rooms.search(targets[0]);
				if (!targetRoom) return this.sayError(['invalidBotRoom', targets[0]]);
				if (!Config.allowTournaments || !Config.allowTournaments.includes(targetRoom.id)) return this.sayError(['disabledTournamentFeatures', targetRoom.title]);
				tournamentRoom = targetRoom;
				targets.shift();
			} else {
				if (!user.hasRank(room, 'voice')) return;
				if (!Config.allowTournaments || !Config.allowTournaments.includes(room.id)) return this.sayError(['disabledTournamentFeatures', room.title]);
				tournamentRoom = room;
			}

			const database = Storage.getDatabase(tournamentRoom);
			if (!database.pastTournaments) return this.say("The past tournament list is empty.");

			const names: string[] = [];
			const option = toID(targets[0]);
			const displayTimes = option === 'time' || option === 'times';
			const now = Date.now();
			for (let i = 0; i < database.pastTournaments.length; i++) {
				const format = Dex.getFormat(database.pastTournaments[i].inputTarget);
				let tournament = format ? Dex.getCustomFormatName(format, tournamentRoom) : database.pastTournaments[i].name;

				if (displayTimes) {
					let duration = now - database.pastTournaments[i].time;
					if (duration < 1000) duration = 1000;
					tournament += " <i>(" + Tools.toDurationString(duration, {hhmmss: true}) + " ago)</i>";
				}

				names.push(tournament);
			}
			this.sayHtml("<b>Past tournaments</b>" + (displayTimes ? "" : " (most recent first)") + ": " + Tools.joinList(names) + ".", tournamentRoom);
		},
		aliases: ['pasttours', 'recenttournaments', 'recenttours'],
	},
	lasttournament: {
		command(target, room, user) {
			const targets = target.split(',');
			let tournamentRoom: Room;
			if (this.isPm(room)) {
				const targetRoom = Rooms.search(targets[0]);
				if (!targetRoom) return this.sayError(['invalidBotRoom', targets[0]]);
				targets.shift();
				if (!Config.allowTournaments || !Config.allowTournaments.includes(targetRoom.id)) return this.sayError(['disabledTournamentFeatures', targetRoom.title]);
				tournamentRoom = targetRoom;
			} else {
				if (!user.hasRank(room, 'voice')) return;
				if (!Config.allowTournaments || !Config.allowTournaments.includes(room.id)) return this.sayError(['disabledTournamentFeatures', room.title]);
				tournamentRoom = room;
			}

			const database = Storage.getDatabase(tournamentRoom);
			if (!targets[0]) {
				if (!database.lastTournamentTime) return this.say("No tournaments have been played in " + tournamentRoom.title + ".");
				return this.say("The last tournament in " + tournamentRoom.title + " ended **" + Tools.toDurationString(Date.now() - database.lastTournamentTime) + "** ago.");
			}
			const format = Dex.getFormat(targets[0]);
			if (!format) return this.sayError(['invalidFormat', target]);
			if (!database.lastTournamentFormatTimes || !(format.id in database.lastTournamentFormatTimes)) return this.say(format.name + " has not been played in " + tournamentRoom.title + ".");
			this.say("The last " + format.name + " tournament in " + tournamentRoom.title + " ended **" + Tools.toDurationString(Date.now() - database.lastTournamentFormatTimes[format.id]) + "** ago.");
		},
		aliases: ['lasttour'],
	},
	usercreatedformats: {
		command(target, room, user) {
			if (!this.isPm(room) && !user.hasRank(room, 'voice')) return;
			this.say('Approved and user-created formats: http://pstournaments.weebly.com/formats.html');
		},
		aliases: ['userhostedformats', 'userformats'],
	},
	gettournamentapproval: {
		command(target, room, user, cmd) {
			if (!this.isPm(room)) return;
			const targets = target.split(',');
			const targetRoom = Rooms.search(targets[0]);
			if (!targetRoom) return this.sayError(['invalidBotRoom', targets[0]]);
			const bracketLink = Tools.getChallongeUrl(targets[1]);
			const signupsLink = Tools.getChallongeUrl(targets[2]);
			if (!bracketLink || !signupsLink || (!bracketLink.includes('/signup/') && !signupsLink.includes('/signup/'))) {
				return this.say("You must specify the links to both your tournament's bracket page and its signup page. (e.g. ``" + Config.commandCharacter + cmd + " " + targets[0].trim() + ", challonge.com/abc, challonge.com/tournaments/signup/123``)");
			}
			if (targetRoom.approvedUserHostedTournaments) {
				for (const i in targetRoom.approvedUserHostedTournaments) {
					if (targetRoom.approvedUserHostedTournaments[i].urls.includes(bracketLink) || targetRoom.approvedUserHostedTournaments[i].urls.includes(signupsLink)) {
						if (user.id !== targetRoom.approvedUserHostedTournaments[i].hostId) return this.say("The specified tournament has already been approved for " + targetRoom.approvedUserHostedTournaments[i].hostName + ".");
						delete targetRoom.approvedUserHostedTournaments[i];
						break;
					}
				}
			}

			if (targetRoom.newUserHostedTournaments) {
				for (const i in targetRoom.newUserHostedTournaments) {
					if (user.id === targetRoom.newUserHostedTournaments[i].hostId) return this.say("You are already on the waiting list for staff review.");
				}
			}

			const database = Storage.getDatabase(targetRoom);
			let authOrTHC = '';
			if ((Config.userHostedTournamentRanks && targetRoom.id in Config.userHostedTournamentRanks && user.hasRank(targetRoom, Config.userHostedTournamentRanks[targetRoom.id].review)) ||
				(database.thcWinners && user.id in database.thcWinners)) {
				authOrTHC = user.name;
			}

			if (!targetRoom.newUserHostedTournaments) targetRoom.newUserHostedTournaments = {};
			targetRoom.newUserHostedTournaments[bracketLink] = {
				hostName: user.name,
				hostId: user.id,
				startTime: Date.now(),
				approvalStatus: '',
				reviewer: '',
				urls: [bracketLink, signupsLink],
			};

			if (authOrTHC) {
				if (!targetRoom.approvedUserHostedTournaments) targetRoom.approvedUserHostedTournaments = {};
				targetRoom.approvedUserHostedTournaments[bracketLink] = targetRoom.newUserHostedTournaments[bracketLink];
				delete targetRoom.newUserHostedTournaments[bracketLink];

				targetRoom.approvedUserHostedTournaments[bracketLink].approvalStatus = 'approved';
				targetRoom.approvedUserHostedTournaments[bracketLink].reviewer = toID(authOrTHC);

				this.say("Roomauth and THC winners are free to advertise without using this command!");
			} else {
				Tournaments.showUserHostedTournamentApprovals(targetRoom);
				this.say("A staff member will review your tournament as soon as possible!");
			}
		},
		aliases: ['gettourapproval'],
	},
	reviewuserhostedtournament: {
		command(target, room, user) {
			if (!this.isPm(room)) return;
			const targets = target.split(',');
			const targetRoom = Rooms.search(targets[0]);
			if (!targetRoom || !Config.userHostedTournamentRanks || !(targetRoom.id in Config.userHostedTournamentRanks) || !user.hasRank(targetRoom, Config.userHostedTournamentRanks[targetRoom.id].review)) return;
			const link = targets[1].trim();
			if (!targetRoom.newUserHostedTournaments || !(link in targetRoom.newUserHostedTournaments)) return;
			if (targetRoom.newUserHostedTournaments[link].reviewer) {
				let name = targetRoom.newUserHostedTournaments[link].reviewer;
				const reviewer = Users.get(name);
				if (reviewer) name = reviewer.name;
				return this.say(name + " is already reviewing " + targetRoom.newUserHostedTournaments[link].hostName + "'s tournament.");
			}
			targetRoom.newUserHostedTournaments[link].reviewer = user.id;
			targetRoom.newUserHostedTournaments[link].reviewTimer = setTimeout(() => {
				if (targetRoom!.newUserHostedTournaments![link] && !targetRoom!.newUserHostedTournaments![link].approvalStatus &&
					targetRoom!.newUserHostedTournaments![link].reviewer === user.id) {
					targetRoom!.newUserHostedTournaments![link].reviewer = '';
					Tournaments.showUserHostedTournamentApprovals(targetRoom!);
				}
			}, 10 * 60 * 1000);
			Tournaments.showUserHostedTournamentApprovals(targetRoom);
		},
		aliases: ['reviewuserhostedtour'],
	},
	approveuserhostedtournament: {
		command(target, room, user, cmd) {
			if (!this.isPm(room)) return;
			const targets = target.split(',');
			const targetRoom = Rooms.search(targets[0]);
			if (!targetRoom || !Config.userHostedTournamentRanks || !(targetRoom.id in Config.userHostedTournamentRanks) || !user.hasRank(targetRoom, Config.userHostedTournamentRanks[targetRoom.id].review)) return;

			const link = targets[1].trim();
			if (!targetRoom.newUserHostedTournaments || !(link in targetRoom.newUserHostedTournaments)) return;
			if (!targetRoom.newUserHostedTournaments[link].reviewer) return this.say("You must first claim " + targetRoom.newUserHostedTournaments[link].hostName + "'s tournament by clicking the ``Review`` button.");
			if (targetRoom.newUserHostedTournaments[link].reviewer !== user.id) {
				let name = targetRoom.newUserHostedTournaments[link].reviewer;
				const reviewer = Users.get(name);
				if (reviewer) name = reviewer.name;
				return this.say(name + " is currently the reviewer of " + targetRoom.newUserHostedTournaments[link].hostName + "'s tournament so they must approve or reject it.");
			}

			if (cmd === 'approveuserhostedtournament' || cmd === 'approveuserhostedtour') {
				targetRoom.newUserHostedTournaments[link].approvalStatus = "approved";
				if (targetRoom.newUserHostedTournaments[link].reviewTimer) clearTimeout(targetRoom.newUserHostedTournaments[link].reviewTimer!);
				if (!targetRoom.approvedUserHostedTournaments) targetRoom.approvedUserHostedTournaments = {};
				targetRoom.approvedUserHostedTournaments[link] = targetRoom.newUserHostedTournaments[link];
				delete targetRoom.newUserHostedTournaments[link];
				this.say("You have approved " + targetRoom.approvedUserHostedTournaments[link].hostName + "'s tournament.");
				const host = Users.get(targetRoom.approvedUserHostedTournaments[link].hostName);
				if (host) host.say(user.name + " has approved your tournament! You may now advertise in " + targetRoom.title + ".");
			} else {
				if (targetRoom.newUserHostedTournaments[link].approvalStatus === 'changes-requested') return this.say("Changes have already been requested for " + targetRoom.newUserHostedTournaments[link].hostName + "'s tournament.");
				targetRoom.newUserHostedTournaments[link].approvalStatus = 'changes-requested';
				this.say("You have rejected " + targetRoom.newUserHostedTournaments[link].hostName + "'s tournament. Be sure to PM them the reason(s) so that they can make the necessary changes!");
				const host = Users.get(targetRoom.newUserHostedTournaments[link].hostName);
				if (host) host.say(user.name + " has requested changes for your tournament. Please wait for them to PM you before advertising.");
			}
			Tournaments.showUserHostedTournamentApprovals(targetRoom);
		},
		aliases: ['approveuserhostedtour', 'rejectuserhostedtournament', 'rejectuserhostedtour'],
	},
	removeuserhostedtournament: {
		command(target, room, user) {
			if (!this.isPm(room)) return;
			const targets = target.split(',');
			const targetRoom = Rooms.search(targets[0]);
			if (!targetRoom || !Config.userHostedTournamentRanks || !(targetRoom.id in Config.userHostedTournamentRanks) || !user.hasRank(targetRoom, Config.userHostedTournamentRanks[targetRoom.id].review)) return;
			const link = targets[1].trim();
			if (!targetRoom.newUserHostedTournaments || !(link in targetRoom.newUserHostedTournaments)) return;
			if (user.id !== targetRoom.newUserHostedTournaments[link].reviewer) {
				let name = targetRoom.newUserHostedTournaments[link].reviewer;
				const reviewer = Users.get(name);
				if (reviewer) name = reviewer.name;
				return this.say(name + " is already reviewing " + targetRoom.newUserHostedTournaments[link].hostName + "'s tournament.");
			}
			this.say(targetRoom.newUserHostedTournaments[link].hostName + "'s tournament has been removed.");
			delete targetRoom.newUserHostedTournaments[link];
			Tournaments.showUserHostedTournamentApprovals(targetRoom);
		},
		aliases: ['removeuserhostedtour'],
	},
	viewuserhostedtournaments: {
		command(target, room, user) {
			if (!this.isPm(room)) return;
			const targetRoom = Rooms.search(target);
			if (!targetRoom || !Config.userHostedTournamentRanks || !(targetRoom.id in Config.userHostedTournamentRanks) || !user.hasRank(targetRoom, Config.userHostedTournamentRanks[targetRoom.id].review)) return;

			const html = Tournaments.getUserHostedTournamentApprovalHtml(targetRoom);
			if (!html) return this.say("There are no user-hosted tournaments running in " + targetRoom.title + ".");
			this.sayUhtml('userhosted-tournament-approvals-' + targetRoom.id, html, targetRoom);
		},
		aliases: ['viewuserhostedtours'],
	},

	/**
	 * Storage commands
	 */
	offlinemessage: {
		command(target, room, user) {
			if (!this.isPm(room)) return;
			if (!Config.allowMail) return this.say("Offline messages are not enabled.");
			const targets = target.split(',');
			if (targets.length < 2) return this.say("You must specify a user and a message to send.");
			if (Users.get(targets[0])) return this.say("You can only send messages to offline users.");
			const recipient = targets[0].trim();
			const recipientId = toID(recipient);
			if (recipientId === 'constructor') return;
			if (!Tools.isUsernameLength(recipient)) return this.sayError(['invalidUsernameLength']);
			if (recipientId === user.id || recipientId.startsWith('guest')) return this.say("You must specify a user other than yourself or a guest.");
			const message = targets.slice(1).join(',').trim();
			if (!message.length) return this.say("You must specify a message to send.");
			const maxMessageLength = Storage.getMaxOfflineMessageLength(user, message);
			if (message.length > maxMessageLength) return this.say("Your message cannot exceed " + maxMessageLength + " characters.");
			if (!Storage.storeOfflineMessage(user.name, recipientId, message)) return this.say("Sorry, you have too many messages queued for " + recipient + ".");
			this.say("Your message has been sent to " + recipient + ".");
		},
		aliases: ['mail', 'offlinepm'],
	},
	offlinemessages: {
		command(target, room, user) {
			if (!this.isPm(room)) return;
			if (!Storage.retrieveOfflineMessages(user, true)) return this.say("You do not have any offline messages stored.");
		},
		aliases: ['readofflinemessages', 'checkofflinemessages', 'readmail', 'checkmail'],
	},
	clearofflinemessages: {
		command(target, room, user) {
			if (!this.isPm(room)) return;
			if (!Storage.clearOfflineMessages(user)) return this.say("You do not have any offline messages stored.");
			this.say("Your offline messages were cleared.");
		},
		aliases: ['deleteofflinemessages', 'clearmail', 'deletemail'],
	},
	addbits: {
		command(target, room, user, cmd) {
			if (this.isPm(room) || ((!Config.allowScriptedGames || !Config.allowScriptedGames.includes(room.id)) && (!Config.allowUserHostedGames || !Config.allowUserHostedGames.includes(room.id))) ||
				!user.hasRank(room, 'voice')) return;
			if (target.includes("|")) {
				this.runMultipleTargets("|");
				return;
			}
			const targets = target.split(",");
			const users: string[] = [];
			const removeBits = cmd === 'removebits' || cmd === 'rbits';
			let customBits: number | null = null;
			for (let i = 0; i < targets.length; i++) {
				const id = toID(targets[i]);
				if (!id) continue;
				if (Tools.isInteger(id)) {
					customBits = parseInt(targets[i].trim());
				} else {
					users.push(targets[i]);
				}
			}

			if (!users.length) return this.say("You must specify at least 1 user to receive bits.");

			let bits = 100;
			let bitsLimit = 300;
			if (user.hasRank(room, 'driver')) bitsLimit = 5000;
			if (customBits) {
				if (customBits > bitsLimit) {
					customBits = bitsLimit;
				} else if (customBits < 0) {
					customBits = 0;
				}
				bits = customBits;
			}

			for (let i = 0; i < users.length; i++) {
				const user = Users.get(users[i]);
				if (user) users[i] = user.name;
				if (removeBits) {
					Storage.removePoints(room, users[i], bits, 'manual');
				} else {
					Storage.addPoints(room, users[i], bits, 'manual');
					if (user && user.rooms.has(room)) user.say("You were awarded " + bits + " bits! To see your total amount, use this command: ``" + commandCharacter + "rank " + room.title + "``");
				}
			}

			const userList = Tools.joinList(users);
			if (removeBits) {
				this.say("Removed " + bits + " bits from " + userList + ".");
			} else {
				this.say("Added " + bits + " bits for " + userList + ".");
			}
		},
		aliases: ['abits', 'removebits', 'rbits'],
	},
	eventlink: {
		command(target, room, user) {
			const targets = target.split(',');
			let eventRoom: Room;
			if (this.isPm(room)) {
				const targetRoom = Rooms.search(targets[0]);
				if (!targetRoom) return this.sayError(['invalidBotRoom', targets[0]]);
				targets.shift();
				if (!user.rooms.has(targetRoom)) return this.sayError(['noPmHtmlRoom', targetRoom.title]);
				eventRoom = targetRoom;
			} else {
				if (!user.hasRank(room, 'voice')) return;
				eventRoom = room;
			}

			const database = Storage.getDatabase(eventRoom);
			if (!database.eventInformation) return this.sayError(['noRoomEventInformation', eventRoom.title]);
			const event = toID(targets[0]);
			if (!(event in database.eventInformation)) return this.sayError(['invalidRoomEvent', eventRoom.title]);
			const eventInformation = database.eventInformation[event];
			if (!eventInformation.link) return this.say(database.eventInformation[event].name + " does not have a link stored.");
			this.sayHtml("<b>" + eventInformation.name + "</b>: <a href='" + eventInformation.link.url + "'>" + eventInformation.link.description + "</a>", eventRoom);
		},
		aliases: ['elink'],
	},
	seteventlink: {
		command(target, room, user) {
			if (this.isPm(room) || !user.hasRank(room, 'driver')) return;
			const targets = target.split(',');
			const event = toID(targets[0]);
			if (!event) return this.say("You must specify an event.");
			const url = targets[1].trim();
			if (!url.startsWith('http://') && !url.startsWith('https://')) return this.say("You must specify a valid link.");
			const description = targets.slice(2).join(',').trim();
			if (!description) return this.say("You must include a description for the link.");
			let name = targets[0].trim();
			const database = Storage.getDatabase(room);
			if (!database.eventInformation) database.eventInformation = {};
			if (!(event in database.eventInformation)) {
				database.eventInformation[event] = {name};
			} else {
				name = database.eventInformation[event].name;
			}
			database.eventInformation[event].link = {description, url};
			this.say("The event link and description for " + name + " has been stored.");
		},
		aliases: ['setelink'],
	},
	removeeventlink: {
		command(target, room, user) {
			if (this.isPm(room) || !user.hasRank(room, 'driver')) return;
			const database = Storage.getDatabase(room);
			if (!database.eventInformation) return this.sayError(['noRoomEventInformation', room.title]);
			const event = toID(target);
			if (!event) return this.say("You must specify an event.");
			if (!(event in database.eventInformation)) return this.sayError(['invalidRoomEvent', room.title]);
			if (!database.eventInformation[event].link) return this.say(database.eventInformation[event].name + " does not have a link stored.");
			delete database.eventInformation[event].link;
			this.say("The link for " + database.eventInformation[event].name + " has been removed.");
		},
		aliases: ['removeelink'],
	},
	eventformats: {
		command(target, room, user) {
			const targets = target.split(',');
			let eventRoom: Room;
			if (this.isPm(room)) {
				const targetRoom = Rooms.search(targets[0]);
				if (!targetRoom) return this.sayError(['invalidBotRoom', targets[0]]);
				targets.shift();
				if (!user.rooms.has(targetRoom)) return this.sayError(['noPmHtmlRoom', targetRoom.title]);
				eventRoom = targetRoom;
			} else {
				if (!user.hasRank(room, 'voice')) return;
				eventRoom = room;
			}
			const database = Storage.getDatabase(eventRoom);
			if (!database.eventInformation) return this.sayError(['noRoomEventInformation', eventRoom.title]);
			const event = toID(targets[0]);
			if (!event || !(event in database.eventInformation)) return this.say("You must specify a valid event.");
			const eventInformation = database.eventInformation[event];
			if (!eventInformation.formatIds) return this.say(database.eventInformation[event].name + " does not have any formats stored.");
			const multipleFormats = eventInformation.formatIds.length > 1;
			if (targets.length > 1) {
				if (!Tools.isUsernameLength(targets[1])) return this.say("You must specify a user.");
				const targetUser = toID(targets[1]);
				if (!database.leaderboard) return this.say("There is no leaderboard for the " + eventRoom.title + " room.");
				if (!(targetUser in database.leaderboard)) return this.say(this.sanitizeResponse(targets[1].trim() + " does not have any event points."));
				let eventPoints = 0;
				for (const source in database.leaderboard[targetUser].sources) {
					if (eventInformation.formatIds.includes(source)) eventPoints += database.leaderboard[targetUser].sources[source];
				}
				this.say(database.leaderboard[targetUser].name + " has " + eventPoints + " points in" + (!multipleFormats ? " the" : "") + " " + database.eventInformation[event].name + " format" + (multipleFormats ? "s" : "") + ".");
			} else {
				const formatNames: string[] = [];
				for (let i = 0; i < eventInformation.formatIds.length; i++) {
					const format = Dex.getFormat(eventInformation.formatIds[i]);
					formatNames.push(format ? format.name : eventInformation.formatIds[i]);
				}
				this.say("The format" + (multipleFormats ? "s" : "") + " for " + database.eventInformation[event].name + " " + (multipleFormats ? "are " : "is ") + Tools.joinList(formatNames) + ".");
			}
		},
		aliases: ['eformats'],
	},
	seteventformats: {
		command(target, room, user) {
			if (this.isPm(room) || !user.hasRank(room, 'driver')) return;
			if (!Config.rankedTournaments || !Config.rankedTournaments.includes(room.id)) return this.sayError(['disabledTournamentFeatures', room.title]);
			const targets = target.split(',');
			const event = toID(targets[0]);
			if (!event) return this.say("You must specify an event.");
			if (targets.length === 1) return this.say("You must specify at least 1 format.");
			const formatIds: string[] = [];
			for (let i = 1; i < targets.length; i++) {
				const format = Dex.getFormat(targets[i]);
				if (!format) return this.sayError(['invalidFormat', targets[i]]);
				formatIds.push(format.id);
			}
			let name = targets[0].trim();
			const database = Storage.getDatabase(room);
			if (!database.eventInformation) database.eventInformation = {};
			if (!(event in database.eventInformation)) {
				database.eventInformation[event] = {name};
			} else {
				name = database.eventInformation[event].name;
			}
			database.eventInformation[event].formatIds = formatIds;
			const multipleFormats = formatIds.length > 1;
			this.say("The event format" + (multipleFormats ? "s" : "") + " for " + name + " " + (multipleFormats ? "have" : "has") + " been stored.");
		},
		aliases: ['seteformats'],
	},
	removeeventformats: {
		command(target, room, user) {
			if (this.isPm(room) || !user.hasRank(room, 'driver')) return;
			const targets = target.split(',');
			const event = toID(targets[0]);
			if (!event) return this.say("You must specify an event.");
			const database = Storage.getDatabase(room);
			if (!database.eventInformation) return this.sayError(['noRoomEventInformation', room.title]);
			if (!(event in database.eventInformation)) return this.sayError(['invalidRoomEvent', room.title]);
			if (!database.eventInformation[event].formatIds) return this.say(database.eventInformation[event].name + " does not have any formats stored.");
			delete database.eventInformation[event].formatIds;
			this.say("The formats for " + database.eventInformation[event].name + " have been removed.");
		},
		aliases: ['removeeformats'],
	},
	removeevent: {
		command(target, room, user) {
			if (this.isPm(room) || !user.hasRank(room, 'driver')) return;
			const targets = target.split(',');
			const event = toID(targets[0]);
			if (!event) return this.say("You must specify an event.");
			const database = Storage.getDatabase(room);
			if (!database.eventInformation) return this.sayError(['noRoomEventInformation', room.title]);
			if (!(event in database.eventInformation)) return this.sayError(['invalidRoomEvent', room.title]);
			const name = database.eventInformation[event].name;
			delete database.eventInformation[event];
			this.say("The " + name + " event has been removed.");
		},
	},
	setgreeting: {
		command(target, room, user, cmd) {
			if (!this.isPm(room) || !user.isDeveloper()) return;
			const targets = target.split(',');
			const targetRoom = Rooms.search(targets[0]);
			if (!targetRoom) return this.sayError(['invalidBotRoom', targets[0]]);
			if (!Tools.isUsernameLength(targets[1])) return this.sayError(['invalidUsernameLength']);
			const greeting = targets.slice(2).join(',').trim();
			if (!greeting) return this.say("You must specify a greeting.");
			if ((greeting.charAt(0) === '/' && !greeting.startsWith('/me ') && !greeting.startsWith('/mee ')) || greeting.charAt(0) === '!') return this.say("Greetings cannot be PS! commands.");
			const database = Storage.getDatabase(targetRoom);
			if (!database.botGreetings) database.botGreetings = {};
			const id = toID(targets[1]);
			let duration = 0;
			if (cmd === 'awardgreeting') {
				if (Config.awardedBotGreetingDurations && targetRoom.id in Config.awardedBotGreetingDurations) {
					duration = Config.awardedBotGreetingDurations[targetRoom.id];
				} else {
					duration = AWARDED_BOT_GREETING_DURATION;
				}
			}
			database.botGreetings[id] = {greeting};
			if (duration) database.botGreetings[id].expiration = Date.now() + duration;
			this.say(this.sanitizeResponse(targets[1].trim() + "'s greeting in " + targetRoom.title + (duration ? " (expiring in " + Tools.toDurationString(duration) + ")" : "") + " has been stored."));
		},
		aliases: ['addgreeting', 'awardgreeting'],
	},
	removegreeting: {
		command(target, room, user) {
			if (!this.isPm(room) || !user.isDeveloper()) return;
			const targets = target.split(',');
			const targetRoom = Rooms.search(targets[0]);
			if (!targetRoom) return this.sayError(['invalidBotRoom', targets[0]]);
			const database = Storage.getDatabase(targetRoom);
			if (!database.botGreetings) return this.say(targetRoom.title + " does not have any bot greetings stored.");
			if (!Tools.isUsernameLength(targets[1])) return this.sayError(['invalidUsernameLength']);
			const id = toID(targets[1]);
			if (!(id in database.botGreetings)) return this.say(this.sanitizeResponse(targets[1].trim() + " does not have a greeting stored for " + targetRoom.title + "."));
			delete database.botGreetings[id];
			this.say(this.sanitizeResponse(targets[1].trim() + "'s greeting in " + targetRoom.title + " has been removed."));
		},
	},
	logs: {
		async asyncCommand(target, room, user) {
			if (!this.isPm(room)) return;
			const targets = target.split(",");
			if (targets.length < 3) return this.say("You must specify at least a room, a user, and a start date or phrase.");
			const targetRoom = Rooms.search(targets[0]);
			if (!targetRoom) return this.sayError(['invalidBotRoom', targets[0]]);
			if (!user.isDeveloper() && !user.hasRank(targetRoom, 'driver')) return;
			if (!user.rooms.has(targetRoom)) return this.sayError(['noPmHtmlRoom', targetRoom.title]);
			targets.shift();

			let phrases: string[] | null = null;
			const userParts = targets[0].split("|");
			let userids: string[] | null = null;
			let anyUser = false;
			for (let i = 0; i < userParts.length; i++) {
				if (userParts[i].trim() === '*') {
					anyUser = true;
					continue;
				}
				const id = toID(userParts[i]);
				if (!id) continue;
				if (!Tools.isUsernameLength(userParts[i])) return this.say("You have included an invalid username (" + userParts[0].trim() + ").");
				if (!userids) userids = [];
				userids.push(id);
			}
			targets.shift();

			let autoStartYear = false;
			let autoEndYear = false;
			const date = new Date();
			const currentYear = date.getFullYear();
			const currentMonth = date.getMonth() + 1;
			const currentDate = date.getDate();
			let startDate: number[] = [];
			let endDate: number[] = [];
			for (let i = 0; i < targets.length; i++) {
				if (!toID(targets[i])) continue;
				const target = targets[i].trim();
				if (target.includes("/") && (!startDate.length || !endDate.length)) {
					// startDate-endDate
					if (target.includes("-")) {
						const parts = target.split("-");
						const startExtracted = Tools.toDateArray(parts[0], true);
						const endExtracted = Tools.toDateArray(parts[1]);
						if (startExtracted && endExtracted) {
							startDate = startExtracted;
							endDate = endExtracted;
							if (startDate.length === 2) {
								startDate.unshift(currentYear);
								autoStartYear = true;
							}
							if (endDate.length === 2) {
								endDate.unshift(currentYear);
								autoEndYear = true;
							}
						}
					} else {
						const startExtracted = Tools.toDateArray(target, true);
						if (startExtracted) {
							startDate = startExtracted;
							if (startDate.length === 2) {
								startDate.unshift(currentYear);
								autoStartYear = true;
							}
						}
					}
				} else {
					if (!phrases) phrases = [];
					phrases.push(target.toLowerCase());
				}
			}

			const roomDirectory = path.join(Tools.roomLogsFolder, targetRoom.id);
			let years: string[] = [];
			try {
				years = fs.readdirSync(roomDirectory);
			} catch (e) {
				return this.say("Chat logging is not enabled for " + targetRoom.id + ".");
			}
			const numberYears = years.map(x => parseInt(x));
			const firstLoggedYear = numberYears.sort((a, b) => a - b)[0];
			const days = fs.readdirSync(roomDirectory + "/" + firstLoggedYear);
			const months: Dict<number[]> = {};
			for (let i = 0; i < days.length; i++) {
				if (!days[i].endsWith('.txt')) continue;
				const parts = days[i].split(".")[0].split('-');
				const month = parts[1];
				if (!(month in months)) months[month] = [];
				months[month].push(parseInt(parts[2]));
			}
			const numberMonths = Object.keys(months);
			const firstLoggedMonthString = numberMonths.sort((a, b) => parseInt(a) - parseInt(b))[0];
			const firstLoggedDay = months['' + firstLoggedMonthString].sort((a, b) => a - b)[0];
			const firstLoggedMonth = parseInt(firstLoggedMonthString);
			if (!startDate.length) {
				startDate = [firstLoggedYear, firstLoggedMonth, firstLoggedDay];
			} else {
				if (startDate[0] > currentYear) return this.say("You cannot search past the current year.");
				if (autoStartYear && startDate[0] === currentYear && startDate[1] > currentMonth) startDate[0]--;
				if (startDate[0] === currentYear) {
					if (startDate[1] > currentMonth) return this.say("You cannot search past the current month.");
					if (startDate[1] === currentMonth) {
						if (startDate[2] > currentDate) return this.say("You cannot search past the current day.");
					}
				}

				if (startDate[0] < firstLoggedYear) return this.say("There are no chat logs from before " + firstLoggedYear + ".");
				if (startDate[0] === firstLoggedYear) {
					if (startDate[1] < firstLoggedMonth) return this.say("There are no chat logs from before " + firstLoggedMonth + "/" + firstLoggedYear + ".");
					if (startDate[1] === firstLoggedMonth) {
						if (startDate[2] < firstLoggedDay) return this.say("There are no chat logs from before " + firstLoggedMonth + "/" + firstLoggedDay + "/" + firstLoggedYear + ".");
					}
				}
			}

			if (!endDate.length) {
				endDate = [currentYear, currentMonth, currentDate];
			} else {
				if (endDate[0] > currentYear) return this.say("You cannot search past the current year.");
				if (autoEndYear && endDate[0] === currentYear && endDate[1] > currentMonth) endDate[0]--;
				if (endDate[0] === currentYear) {
					if (endDate[1] > currentMonth) return this.say("You cannot search past the current month.");
					if (endDate[1] === currentMonth) {
						if (endDate[2] > currentDate) return this.say("You cannot search past the current day.");
					}
				}

				if (endDate[0] < firstLoggedYear) return this.say("There are no chat logs from before " + firstLoggedYear + ".");
				if (endDate[0] === firstLoggedYear) {
					if (endDate[1] < firstLoggedMonth) return this.say("There are no chat logs from before " + firstLoggedMonth + "/" + firstLoggedYear + ".");
					if (endDate[1] === firstLoggedMonth) {
						if (endDate[2] < firstLoggedDay) return this.say("There are no chat logs from before " + firstLoggedDay + "/" + firstLoggedMonth + "/" + firstLoggedYear + ".");
					}
				}
			}

			if (startDate[0] > endDate[0]) return this.say("You must enter the search dates in sequential order.");
			if (startDate[0] === endDate[0]) {
				if (startDate[1] > endDate[1]) return this.say("You must enter the search dates in sequential order.");
				if (startDate[1] === endDate[1]) {
					if (startDate[2] > endDate[2]) return this.say("You must enter the search dates in sequential order.");
				}
			}

			if (!userids && !phrases) return this.say("You must include at least one user or phrase in your search.");
			if (anyUser && userids) return this.say("You cannot search for both a specific user and any user.");
			if (phrases) {
				for (let i = 0; i < phrases.length; i++) {
					if (phrases[i].length === 1) return this.say("You cannot search for a single character.");
				}
			}
			if (CommandParser.reloadInProgress) return this.sayError(['reloadInProgress']);

			const userId = user.id;
			if (Storage.workers.logs.requestsByUserid.includes(userId)) return this.say("You can only perform 1 search at a time.");

			const displayStartDate = startDate.slice(1);
			displayStartDate.push(startDate[0]);
			const displayEndDate = endDate.slice(1);
			displayEndDate.push(endDate[0]);
			let text = "Retrieving chat logs from " + displayStartDate.join("/") + " to " + displayEndDate.join("/");
			if (userids) {
				text += " for the user '" + userids.join("|") + "'" + (phrases ? " containing the phrase '" + phrases.join("|") + "'" : "");
			} else if (phrases) {
				text += " containing the phrase '" + phrases.join("|") + "'";
			}
			text += "...";
			this.say(text);
			Storage.workers.logs.requestsByUserid.push(userId);
			const result = await Storage.workers.logs.search({
				endDate,
				phrases,
				roomid: targetRoom.id,
				showCommands: (Config.allowScriptedGames && Config.allowScriptedGames.includes(targetRoom.id)) || (Config.allowUserHostedGames && Config.allowUserHostedGames.includes(targetRoom.id)) ? true : false,
				startDate,
				userids,
			});

			this.sayHtml("<details><summary>Found <b>" + result.totalLines + "</b> line" + (result.totalLines === 1 ? "" : "s") + ":</summary><br>" + result.lines.join("<br />") + "</details>", targetRoom);

			Storage.workers.logs.requestsByUserid.splice(Storage.workers.logs.requestsByUserid.indexOf(userId), 1);
		},
	},
};

export = commands;

/* eslint-enable @typescript-eslint/explicit-function-return-type,@typescript-eslint/no-unused-vars*/