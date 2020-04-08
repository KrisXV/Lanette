// eslint-disable-next-line @typescript-eslint/camelcase
import child_process = require('child_process');
import https = require('https');
import path = require('path');

import { ICommandDefinition } from "./command-parser";
import { commandCharacter } from './config';
import { Room } from "./rooms";

type ReloadableModule = 'client' | 'commandparser' | 'commands' | 'config' | 'dex' | 'games' | 'storage' | 'tools' | 'tournaments';
const moduleOrder: ReloadableModule[] = ['tools', 'config', 'dex', 'client', 'commandparser', 'commands', 'storage', 'tournaments'];

const AWARDED_BOT_GREETING_DURATION = 60 * 24 * 60 * 60 * 1000;

let reloadInProgress = false;

/* eslint-disable @typescript-eslint/explicit-function-return-type,@typescript-eslint/no-unused-vars*/
const commands: Dict<ICommandDefinition> = {
	shockedlapras: {
		command(target, room, user) {
			if (this.isPm(room) || !user.canPerform(room, 'roomowner')) return;
			if (!Users.self.canPerform(room, 'bot')) return;
			this.sayUhtml(`shockedlapras`, `<img src="https://cdn.discordapp.com/emojis/528403513894502440.png?v=1" alt="shockedlapras" width="20" height="20" />`, room);
			return;
		},
		aliases: ['sl'],
	},
	tourconfig: {
		command(target, room, user) {
			if (this.isPm(room)) return;
			if (!user.canPerform(room, 'moderator')) return;
			if (!Users.self.canPerform(room, 'bot')) return;
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
			if (!Users.self.canPerform(room, 'bot')) return;
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
			if (!Users.self.canPerform(room, 'bot')) return;
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
			if (!Users.self.canPerform(room, 'bot')) return;
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
			if (!Users.self.canPerform(room, 'bot')) return;
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
			if (!Users.self.canPerform(room, 'bot')) return;
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
			if (!Users.self.canPerform(room, 'bot')) return;
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
			if (!Users.self.canPerform(room, 'bot')) return;
			const hosts = Storage.getDatabase(room).hosts;
			if (!hosts || !hosts.length) return this.say(`There are currently no hosts.`);
			let buf = `<psicon pokemon="unown"><br /><details><summary><strong>${room.title}</strong> hosts</summary><ol>`;
			for (const host of hosts.sort()) {
				buf += `<li><span class="username" data-name="${host}" style="white-space:nowrap;">${host.trim()}</span></li>`;
			}
			buf += `</ol></details>`;
			this.sayUhtml('hosts', `<div class="infobox">${buf}</div>`, room);
			/*const prettyHostList = `Hosts for ${room.id}:\n\n${hosts.map((host, index) => `${index + 1}: ${host}`).join('\n')}`;
			Tools.uploadToHastebin(prettyHostList, hastebinUrl => {
				this.say(`**${room.id}** hosts: ${hastebinUrl}`);
			});*/
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
			if (!Users.self.canPerform(room, 'bot')) return;
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
					if (toID(ban) === 'metronome') {
						return this.say(`Ambiguous ban 'metronome'; preface it with 'move:' or 'item:' (looks like "move:Metronome").`);
					}
					if (
						!Dex.getSpecies(ban) &&
						!Dex.getEffect(ban) &&
						!Dex.getTag(ban)
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
					if (toID(unban) === 'metronome') {
						return this.say(`Ambiguous unban 'metronome'; preface it with 'move:' or 'item:' (looks like "move:Metronome").`);
					}
					if (
						!Dex.getSpecies(unban) &&
						!Dex.getEffect(unban) &&
						!Dex.getTag(unban)
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
								if (toID(sp) === 'metronome') {
									return this.say(`Ambiguous ${rule.charAt(0) === '-' ? '' : 'un'}ban 'metronome'; preface it with 'move:' or 'item:' (looks like "move:Metronome").`);
								}
								if (
									!Dex.getSpecies(sp) &&
									!Dex.getEffect(sp) &&
									!Dex.getTag(sp)
								) {
									return this.say(`Invalid section of ${rule.charAt(0) === '-' ? 'ban' : 'unban'} '${rule}': ${sp}`);
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
							if (toID(rule) === 'metronome') {
								return this.say(`Ambiguous ${rule.charAt(0) === '-' ? '' : 'un'}ban 'metronome'; preface it with 'move:' or 'item:' (looks like "move:Metronome").`);
							}
							if (
								!Dex.getSpecies(rule) &&
								!Dex.getEffect(rule) &&
								!Dex.getTag(rule)
							) {
								return this.say(`Invalid ${rule.charAt(0) === '-' ? 'ban' : 'unban'} '${rule}'`);
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
				const formatid = baseFormat.id;
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
			if (!Users.self.canPerform(room, 'bot')) return;
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
			if (!Users.self.canPerform(room, 'bot')) return;
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
			for (const rule of rules.map(r => r.trim())) {
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
						for (const sp of split.map(x => x.trim())) {
							if (toID(sp) === 'metronome') {
								return this.say(`Ambiguous ${rule.charAt(0) === '-' ? '' : 'un'}ban 'metronome'; preface it with 'move:' or 'item:' (looks like "move:Metronome").`);
							}
							if (
								!Dex.getSpecies(sp) &&
								!Dex.getEffect(sp) &&
								!Dex.getTag(sp)
							) {
								return this.say(`Invalid section of ${rule.charAt(0) === '-' ? 'ban' : 'unban'} '${rule}': ${sp}`);
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
						if (
							!Dex.getSpecies(rule) &&
							!Dex.getEffect(rule) &&
							!Dex.getTag(rule)
						) {
							return this.say(`Invalid ${rule.charAt(0) === '-' ? 'ban' : 'unban'} '${rule}'`);
						}
						if (toID(rule) === 'metronome') {
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
	banlists: {
		command(target, room, user) {
			if (this.isPm(room)) return;
			const rules = Dex.getCustomFormatList(room);
			if (!rules) return this.say(`This room has no custom formats.`);
			let buf = ``;
			for (const ruleset of rules) {
				buf += `<details><summary>${ruleset.name}</summary>`;
				buf += `<ul style="list-style-type:none;margin-left:0;padding-left:0;">`;
				buf += `<li><strong>Base Format:</strong> ${ruleset.baseFormat.name}</li>`;
				if (ruleset.addrules.length > 0) {
					buf += `<li><strong>Added rules:</strong> `;
					const addrules = ruleset.addrules.sort();
					const roos: string[] = [];
					for (const j of addrules) {
						const formatName = Dex.getFormat(j) ? Dex.getFormat(j)!.name : toID(j);
						roos.push(formatName);
					}
					buf += `${roos.join(", ")}`;
					buf += `</li>`;
				}
				if (ruleset.remrules.length > 0) {
					buf += `<li><strong>Removed rules:</strong> `;
					const remrules = ruleset.remrules.sort();
					const roos: string[] = [];
					for (const j of remrules) {
						const formatName = Dex.getFormat(j) ? Dex.getFormat(j)!.name : toID(j);
						roos.push(formatName);
					}
					buf += `${roos.join(", ")}`;
					buf += `</li>`;
				}
				if (ruleset.bans.length > 0) {
					buf += `<li><strong>Bans:</strong> `;
					const bans = ruleset.bans.sort();
					const roos: string[] = [];
					for (const j of bans) {
						const banName = Dex.getSpecies(j) ? Dex.getSpecies(j)!.name : Dex.getEffect(j) ?
							Dex.getEffect(j)!.name : Dex.getTag(j) ? Dex.getTag(j)! : toID(j);
						roos.push(banName);
					}
					buf += `${roos.sort().join(", ")}`;
					buf += `</li>`;
				}
				if (ruleset.unbans.length > 0) {
					buf += `<li><strong>Unbans:</strong> `;
					const unbans = ruleset.unbans.sort();
					const roos: string[] = [];
					for (const j of unbans) {
						const unbanName = Dex.getSpecies(j) ? Dex.getSpecies(j)!.name : Dex.getEffect(j) ?
							Dex.getEffect(j)!.name : Dex.getTag(j) ? Dex.getTag(j)! : toID(j);
						roos.push(unbanName);
					}
					buf += `${roos.sort().join(", ")}`;
					buf += `</li>`;
				}
				buf += `</ul>`;
				buf += `</details>`;
				if (user.canPerform(room, 'voice')) {
					return this.sayHtml(buf, Rooms.get('ruinsofalph') as Room);
				} else {
					return (Rooms.get('ruinsofalph') as Room).say(`/pminfobox ${user.id}, ${buf}`);
				}
			}
		},
		aliases: ['rulesets', 'customformats'],
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
			for (const t of targets) {
				const id = toID(t) as ReloadableModule;
				if (id === 'commandparser') {
				}
				const moduleIndex = moduleOrder.indexOf(id);
				if (moduleIndex !== -1) {
					hasModules[moduleIndex] = true;
				} else {
					return this.say(`'${t.trim}' is not a module or cannot be reloaded.`);
				}
			}

			if (reloadInProgress) return this.say("You must wait for the current reload to finish.");
			reloadInProgress = true;

			const modules: ReloadableModule[] = [];
			for (const [i, m] of hasModules.entries()) {
				if (m) modules.push(moduleOrder[i]);
			}

			if (modules.includes('commandparser')) CommandParser.reloadInProgress = true;

			this.say("Running ``tsc``...");
			// eslint-disable-next-line @typescript-eslint/no-var-requires
			await require(path.join(Tools.rootFolder, 'build.js'))(() => {
				for (const m of modules) {
					if (m === 'client') {
						const oldClient = global.Client;
						Tools.uncacheTree('./client');
						// eslint-disable-next-line @typescript-eslint/no-var-requires
						const client: typeof import('./client') = require('./client');
						global.Client = new client.Client();
						Client.onReload(oldClient);
					} else if (m === 'commandparser') {
						Tools.uncacheTree('./command-parser');
						// eslint-disable-next-line @typescript-eslint/no-var-requires
						const commandParser: typeof import('./command-parser') = require('./command-parser');
						global.CommandParser = new commandParser.CommandParser();
					} else if (m === 'commands') {
						Tools.uncacheTree('./commands');
						// eslint-disable-next-line @typescript-eslint/no-var-requires
						global.Commands = CommandParser.loadBaseCommands(require('./commands'));
					} else if (m === 'config') {
						Tools.uncacheTree('./config');
						Tools.uncacheTree('./config-loader');
						// eslint-disable-next-line @typescript-eslint/no-var-requires
						const config: typeof import('./config-example') = require('./config-loader').load(require('./config'));
						global.Config = config;
						Rooms.checkLoggingConfigs();
					} else if (m === 'dex') {
						Tools.uncacheTree('./dex');
						// eslint-disable-next-line @typescript-eslint/no-var-requires
						const dex: typeof import('./dex') = require('./dex');
						global.Dex = new dex.Dex();
					} else if (m === 'storage') {
						const oldStorage = global.Storage;
						Storage.unrefWorkers();
						Tools.uncacheTree('./storage');
						// eslint-disable-next-line @typescript-eslint/no-var-requires
						const storage: typeof import('./storage') = require('./storage');
						global.Storage = new storage.Storage();
						Storage.onReload(oldStorage);
					} else if (m === 'tools') {
						const oldTools = global.Tools;
						Tools.uncacheTree('./tools');
						// eslint-disable-next-line @typescript-eslint/no-var-requires
						const tools: typeof import('./tools') = require('./tools');
						global.Tools = new tools.Tools();
						Tools.onReload(oldTools);
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
};

export = commands;

/* eslint-enable @typescript-eslint/explicit-function-return-type,@typescript-eslint/no-unused-vars*/