import { ICommandDefinition } from "../command-parser";
import { IPluginInterface } from "../types/plugins";
import { Room } from "../rooms";
import { IClientMessageTypes, ITournamentMessageTypes } from "../types/client";
import { ITournamentUpdateJson, ITournamentEndJson } from "../types/tournaments";

export const commands: Dict<ICommandDefinition> = {
	tourconfig: {
		command(target, room, user) {
			if (this.isPm(room)) return;
			if (!user.canPerform(room, 'moderator')) return;
			if (!Users.self.canPerform(room, 'bot')) return;
			if (!target) return this.say(`${Config.commandCharacter}econfig autostart/autodq`);
			target = target.trim();
			const args = target.split(' ');
			if (!args[1]) {
				return this.say(`Correct syntax: ${Config.commandCharacter}econfig autostart __[number/"off"]__`);
			}
			const arg1ID = Tools.toId(args[1]);
			const arg1Int = Number(arg1ID);
			if (
				!args[1] ||
				!args[2] ||
				!['randoms', 'normal'].includes(Tools.toId(args[1]))
			) {
				return this.say(`Correct syntax: ${Config.commandCharacter}econfig autodq randoms/normal __[number | "off"]__`);
			}
			const arg2ID = Tools.toId(args[2]);
			const arg2Int = Number(arg2ID);
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
			switch (Tools.toId(args[0])) {
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
				if (Tools.toId(args[1]) === 'randoms') {
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
		return this.say(`Correct syntax: ${Config.commandCharacter}econfig autostart/autodq`);
			}
		},
		aliases: ['econfig'],
	},
	tourhost: {
		command(target, room, user) {
			if (this.isPm(room)) return this.say(`This command can only be used in rooms.`);
			if (!user.canPerform(room, 'driver')) return;
			if (!Users.self.canPerform(room, 'bot')) return;
			if (!target) return this.say(`Correct syntax: ${Config.commandCharacter}host __[user]__`);
			target = target.trim();
			if (!Storage.databases[room.id].hosts) {
				Storage.databases[room.id].hosts = [];
				Storage.exportDatabase(room.id);
			}
			const db = Storage.getDatabase(room).hosts;
			if (target.length > 18) return this.say(`Please provide a real username.`);
			const index = db!.findIndex(host => Tools.toId(host) === Tools.toId(target));
			if (index >= 0) return this.say(`That user is already a host.`);
			db!.push(Tools.toId(target));
			Storage.exportDatabase(room.id);
			this.say(`/modnote ADDHOST: ${Tools.toId(target)} by ${user.id}`);
			return this.say(`User '${target}' successfully added as a host.`);
		},
		aliases: ['addhost'],
	},
	tourdehost: {
		command(target, room, user) {
			if (this.isPm(room)) return this.say(`This command can only be used in rooms.`);
			if (!user.canPerform(room, 'driver')) return;
			if (!Users.self.canPerform(room, 'bot')) return;
			if (!target) return this.say(`Correct syntax: ${Config.commandCharacter}dehost __[user]__`);
			target = target.trim();
			const db = Storage.getDatabase(room).hosts;
			if (!db) return this.say(`There are no hosts.`);
			if (target.length > 18) return this.say(`Please provide a real username.`);
			const index = db.findIndex(host => Tools.toId(host) === Tools.toId(target));
			if (index < 0) return this.say(`That user is not a host.`);
			db.splice(index, 1);
			Storage.exportDatabase(room.id);
			this.say(`/modnote REMOVEHOST: ${Tools.toId(target)} by ${user.id}`);
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
			this.say(`/modnote ${user.name} cleared the host list.`);
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
	eliminationtour: {
		command(target, room, user) {
			if (!this.isPm(room) && !user.canPerform(room, 'driver') && !user.isHost(room)) return;
			const args = target.split(' ');
			if (!args[0] || Tools.toId(args[0]) === 'help') {
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
			const stylizedRulesArray: string[] = (rules: string[]) => {
				const sortedRules: string[] = [];
				for (const rule of rules) {
					if (Dex.getFormat(rule)) {
						const format = Dex.getExistingFormat(rule);
						const charAt0 = rule.charAt(0);
						sortedRules.push(`${charAt0 === '-' ? '-' : ''}${format.name}`);
					}
					if (Dex.getTag(rule)) {
						const tag = Dex.getTag(rule)!;
						const charAt0 = rule.charAt(0);
						sortedRules.push(`${charAt0 === '+' ? '+' : '-'}${tag}`);
					}
					if (Dex.getSpecies(rule)) {
						const species = Dex.getExistingPokemon(rule);
						const charAt0 = rule.charAt(0);
						sortedRules.push(`${charAt0 === '+' ? '+' : '-'}${species.name}`);
					}
					if (Dex.getEffect(rule)) {
						const effect = Dex.getEffect(rule)!;
						let isAmbiguous = '';
						if (rule.toLowerCase().slice(1).startsWith('move:')) isAmbiguous = 'move: ';
						if (rule.toLowerCase().slice(1).startsWith('item:')) isAmbiguous = 'item: ';
						if (rule.toLowerCase().slice(1).startsWith('ability:')) isAmbiguous = 'ability: ';
						const charAt0 = rule.charAt(0);
						sortedRules.push(`${charAt0 === '+' ? '+' : '-'}${isAmbiguous}${effect.name}`);
					}
				}
				return sortedRules.sort();
			};
			const arg0ID = Tools.toId(args[0]);
			if (['start', 'forcestart'].includes(arg0ID)) {
				this.say(`/modnote TOUR: started by ${user.id}`);
				this.say(`/tour start`);
				return;
			} else if (['end', 'forceend'].includes(arg0ID)) {
				this.say(`/modnote TOUR: ended by ${user.id}`);
				this.say('/tour end');
				return;
			} else if (['name', 'setname'].includes(arg0ID)) {
				const name = args.slice(1).join(' ').trim();
				if (!name) return this.say(`Correct syntax: ${Config.commandCharacter}etour name __[name]__`);
				this.say(`/modnote TOUR: renamed by ${user.id}`);
				this.say(`/tour name ${name}`);
				return;
			} else if (['clearname', 'delname'].includes(arg0ID)) {
				this.say(`/modnote TOUR: name cleared by ${user.id}`);
				this.say(`/tour clearname`);
				return;
			} else if (['autostart', 'setautostart', 'as'].includes(arg0ID)) {
				if (!args[1]) return this.say(`Correct syntax: ${Config.commandCharacter}etour autostart __[number | "off"]__`);
				const autostartTimer = parseInt(args[1]);
				if (Tools.toId(args[1]) !== 'off' && isNaN(autostartTimer)) return this.say(`${args[1]} is not a number.`);
				if (Tools.toId(args[1]) === 'off' || autostartTimer === 0) return this.say(`/tour autostart off`);
				this.say(`/modnote TOUR: autostart set by ${user.id}`);
				this.say(`/tour autostart ${autostartTimer}`);
				return;
			} else if (['autodq', 'setautodq', 'adq', 'runautodq'].includes(arg0ID)) {
				if (arg0ID === 'runautodq') return this.say(`/tour runautodq`);
				if (!args[1]) return this.say(`Correct syntax: ${Config.commandCharacter}etour autodq __[number | "off"]__`);
				const autodqTimer = parseInt(args[1]);
				if (Tools.toId(args[1]) !== 'off' && isNaN(autodqTimer)) return this.say(`${args[1]} is not a number.`);
				if (Tools.toId(args[1]) === 'off' || autodqTimer === 0) return this.say(`/tour autodq off`);
				this.say(`/modnote TOUR: autodq set by ${user.id}`);
				this.say(`/tour autodq ${autodqTimer}`);
				return;
			} else if (['dq', 'disqualify'].includes(arg0ID)) {
				const targetUString = args.slice(1).join(' ').trim();
				if (!Tools.isUsernameLength(targetUString)) {
					return this.say(`User '${targetUString}' not found.`);
				}
				this.say(`/modnote TOUR: ${targetUString} disqualified by ${user.id}`);
				this.say(`/tour dq ${targetUString}`);
				return;
			} else if (['addrule'].includes(arg0ID)) {
				const addedRules = args.slice(1).join(' ').trim().split(',');
				if (!addedRules.length) {
					return this.say(`Please provide rules to add. Here is a list: https://github.com/smogon/pokemon-showdown/blob/master/config/CUSTOM-RULES.md`);
				}
				for (const rule of addedRules.map(r => r.trim())) {
					if (!Dex.getFormat(rule)) {
						return this.say(`Rule '${rule}' not found. [[Here is a list of rules <Here is a list: https://github.com/smogon/pokemon-showdown/blob/master/config/CUSTOM-RULES.md>]]`);
					}
					if (db.tourRuleset.includes(`!${rule}`)) {
						const ruleIndex = db.tourRuleset.indexOf(`!${rule}`);
						db.tourRuleset.splice(ruleIndex, 1);
						Storage.exportDatabase(room.id);
					} else {
						if (db.tourRuleset.includes(rule)) {
							return this.say(`The rule ${rule} is already added.`);
						}
						db.tourRuleset.push(rule);
						Storage.exportDatabase(room.id);
					}
				}
				this.say(`/modnote TOUR: Ruleset adjusted by ${user.id}`);
				this.say(`/tour rules ${stylizedRulesArray(db.tourRuleset).join(',')}`);
				return;
			} else if (['delrule', 'removerule'].includes(arg0ID)) {
				const removedRules = args.slice(1).join(' ').trim().split(',');
				if (!removedRules.length) {
					return this.say(`Please provide rules to add. Here is a list: https://github.com/smogon/pokemon-showdown/blob/master/config/CUSTOM-RULES.md`);
				}
				for (const rule of removedRules.map(r => r.trim())) {
					if (!Dex.getFormat(rule)) {
						return this.say(`Rule '${rule}' not found. [[Here is a list of rules <Here is a list: https://github.com/smogon/pokemon-showdown/blob/master/config/CUSTOM-RULES.md>]]`);
					}
					if (db.tourRuleset.includes(rule)) {
						const ruleIndex = db.tourRuleset.indexOf(rule);
						db.tourRuleset.splice(ruleIndex, 1);
						Storage.exportDatabase(room.id);
					} else {
						if (db.tourRuleset.includes(`!${rule}`)) {
							return this.say(`The rule ${rule} is already added.`);
						}
						db.tourRuleset.push(`!${rule}`);
						Storage.exportDatabase(room.id);
					}
				}
				this.say(`/modnote TOUR: Ruleset adjusted by ${user.id}`);
				this.say(`/tour rules ${stylizedRulesArray(db.tourRuleset).join(',')}`);
				return;
			} else if (['ban', 'addban'].includes(arg0ID)) {
				const banlist = args.slice(1).join(' ').trim().split(',');
				if (!banlist.length) {
					return this.say(`Please provide Pokemon/items/moves/abilities/tiers to ban.`);
				}
				for (const ban of banlist.map(r => r.trim())) {
					if (Tools.toId(ban) === 'metronome') {
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
						if (db.tourRuleset.includes(`-${ban}`)) {
							return this.say(`The object ${ban} is already added.`);
						}
						db.tourRuleset.push(`-${ban}`);
						Storage.exportDatabase(room.id);
					}
				}
				this.say(`/modnote TOUR: Ruleset adjusted by ${user.id}`);
				this.say(`/tour rules ${stylizedRulesArray(db.tourRuleset).join(',')}`);
				return;
			} else if (['unban', 'removeban'].includes(arg0ID)) {
				const unbanlist = args.slice(1).join(' ').trim().split(',');
				if (!unbanlist.length) {
					return this.say(`Please provide Pokemon/items/moves/abilities/tags to unban.`);
				}
				for (const unban of unbanlist.map(r => r.trim())) {
					if (Tools.toId(unban) === 'metronome') {
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
						if (db.tourRuleset.includes(`+${unban}`)) {
							return this.say(`The object ${unban} is already added.`);
						}
						db.tourRuleset.push(`+${unban}`);
						Storage.exportDatabase(room.id);
					}
				}
				this.say(`/modnote TOUR: Ruleset adjusted by ${user.id}`);
				this.say(`/tour rules ${stylizedRulesArray(db.tourRuleset).join(',')}`);
				return;
			} else if (['rules'].includes(arg0ID)) {
				const ruleList = args.slice(1).join(' ').trim().split(',');
				if (!ruleList.length) return this.say(`Invalid rule ''`);
				for (const rule of ruleList.map(r => r.trim())) {
					if (rule.startsWith('!')) {
						if (!Dex.getFormat(rule)) return this.say(`Invalid Rule '${rule}'`);
						if (db.tourRuleset.map(Tools.toId).includes(Tools.toId(rule))) {
							db.tourRuleset.splice(db.tourRuleset.map(Tools.toId).indexOf(Tools.toId(rule)), 1);
							Storage.exportDatabase(room.id);
						} else {
							if (db.tourRuleset.map(Tools.toId).includes(Tools.toId(rule))) {
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
								if (Tools.toId(sp) === 'metronome') {
									return this.say(`Ambiguous ${rule.startsWith('-') ? '' : 'un'}ban 'metronome'; preface it with 'move:' or 'item:' (looks like "move:Metronome").`);
								}
								if (
									!Dex.getSpecies(sp) &&
									!Dex.getEffect(sp) &&
									!Dex.getTag(sp)
								) {
									return this.say(`Invalid section of ${rule.startsWith('-') ? 'ban' : 'unban'} '${rule}': ${sp}`);
								}
							}
							if (db.tourRuleset.map(Tools.toId).includes(Tools.toId(rule))) {
								db.tourRuleset.splice(db.tourRuleset.map(Tools.toId).indexOf(Tools.toId(rule)), 1);
								Storage.exportDatabase(room.id);
							} else {
								if (db.tourRuleset.map(Tools.toId).includes(Tools.toId(rule))) {
									return this.say(`${rule} is already in the ruleset.`);
								}
								db.tourRuleset.push(rule);
								Storage.exportDatabase(room.id);
							}
						} else {
							if (Tools.toId(rule) === 'metronome') {
								return this.say(`Ambiguous ${rule.startsWith('-') ? '' : 'un'}ban 'metronome'; preface it with 'move:' or 'item:' (looks like "move:Metronome").`);
							}
							if (
								!Dex.getSpecies(rule) &&
								!Dex.getEffect(rule) &&
								!Dex.getTag(rule)
							) {
								return this.say(`Invalid ${rule.startsWith('-') ? 'ban' : 'unban'} '${rule}'`);
							}
							if (db.tourRuleset.map(Tools.toId).includes(Tools.toId(rule))) {
								db.tourRuleset.splice(db.tourRuleset.map(Tools.toId).indexOf(Tools.toId(rule)), 1);
								Storage.exportDatabase(room.id);
							} else {
								if (db.tourRuleset.map(Tools.toId).includes(Tools.toId(rule))) {
									return this.say(`${rule} is already in the ruleset.`);
								}
								db.tourRuleset.push(rule);
								Storage.exportDatabase(room.id);
							}
						}
					} else {
						if (!Dex.getFormat(rule)) return this.say(`Invalid Rule '${rule}'`);
						if (db.tourRuleset.map(Tools.toId).includes(Tools.toId(rule))) {
							db.tourRuleset.splice(db.tourRuleset.map(Tools.toId).indexOf(Tools.toId(rule)), 1);
							Storage.exportDatabase(room.id);
						} else {
							if (db.tourRuleset.map(Tools.toId).includes(Tools.toId(rule))) {
								return this.say(`${rule} is already in the ruleset.`);
							}
							db.tourRuleset.push(rule);
							Storage.exportDatabase(room.id);
						}
					}
				}
				this.say(`/modnote TOUR: Ruleset adjusted by ${user.id}`);
				this.say(`/tour rules ${stylizedRulesArray(db.tourRuleset).join(',')}`);
				return;
			} else if (['clearrules'].includes(arg0ID)) {
				db.tourRuleset = [];
				Storage.exportDatabase(room.id);
				this.say(`/modnote TOUR: Ruleset cleared by ${user.id}`);
				this.say(`/tour clearrules`);
				return;
			} else if (['viewrules'].includes(arg0ID)) {
				this.say(`!tour viewrules`);
				return;
			} else if (['timer', 'forcetimer'].includes(arg0ID)) {
				if (!args[1] || !['on', 'off'].includes(Tools.toId(args[1]))) {
					return this.say(`Correct syntax: ${Config.commandCharacter}etour timer __["on" | "off"]__`);
				}
				this.say(`/modnote TOUR: Forcetimer toggled by ${user.id}`);
				this.say(`/tour forcetimer ${Tools.toId(args[1])}`);
				return;
			} else if (['scout', 'scouting'].includes(arg0ID)) {
				if (!args[1] || !['on', 'off'].includes(Tools.toId(args[1]))) {
					return this.say(`Correct syntax: ${Config.commandCharacter}etour scouting __["on" | "off"]__`);
				}
				this.say(`/modnote TOUR: Scouting toggled by ${user.id}`);
				if (Tools.toId(args[1]) === 'on') {
					this.say(`/tour scouting allow`);
				} else {
					this.say(`/tour scouting disallow`);
				}
				return;
			} else if (['modjoin'].includes(arg0ID)) {
				if (!args[1] || !['on', 'off'].includes(Tools.toId(args[1]))) {
					return this.say(`Correct syntax: ${Config.commandCharacter}etour scouting __["on" | "off"]__`);
				}
				this.say(`/modnote TOUR: Modjoin toggled by ${user.id}`);
				if (Tools.toId(args[1]) === 'on') {
					this.say(`/tour modjoin allow`);
				} else {
					this.say(`/tour modjoin disallow`);
				}
				return;
			} else if (['cap', 'playercap'].includes(arg0ID)) {
				const arg1Int = parseInt(args[1]);
				if (!args[1] || isNaN(arg1Int)) return this.say(`Correct syntax: ${Config.commandCharacter}etour playercap __[number]__`);
				this.say(`/modnote TOUR: Player cap set to ${arg1Int} by ${user.id}`);
				this.say(`/tour cap ${arg1Int}`);
				return;
			} else if (arg0ID) {
				if (room.tournament) return this.say(`This room currently has a tournament ongoing.`);
				const targets = args.join(' ').trim().split(',');
				const f = targets[0];
				// const format = Dex.getFormat(f) ? Dex.getFormat(f) : Dex.getCustomFormat(f, room) ? Dex.getCustomFormat(f, room) : null;
				const format = Dex.getFormat(f);
				if (!format) return this.say(`Please provide a valid format.`);
				// const baseFormat = 'id' in format ? format : format.baseFormat;
				// const formatid = baseFormat.id;
				const formatid = format.id;
				let tourcmd = `/tour new ${formatid}`;
				if (targets[1] && ['elimination', 'elim', 'roundrobin', 'rr'].includes(Tools.toId(targets[1]))) {
					tourcmd += `, ${Tools.toId(targets[1])}`;
				} else {
					tourcmd += `, elimination`;
				}
				if (targets[2]) {
					const t2Int = parseInt(targets[2]);
					if (isNaN(t2Int)) return this.say(`Correct syntax: ${Config.commandCharacter}etour __[format]__, __["elimination" | "roundrobin"]__, __[player cap]__`);
					tourcmd += `, ${t2Int}`;
				} else {
					tourcmd += `,`;
				}
				if (targets[3]) {
					const t3Int = parseInt(targets[3]);
					if (isNaN(t3Int)) return this.say(`Correct syntax: ${Config.commandCharacter}etour __[format]__, __["elimination" | "roundrobin"]__, __[player cap]__, __[rounds]__`);
					tourcmd += `, ${t3Int}`;
				} else {
					tourcmd += `,`;
				}
				// const name = targets[4] ? targets.slice(4).join(',') : format.name !== baseFormat.name ? format.name.trim() : baseFormat.name.trim();
				const name = targets[4] ? targets.slice(4).join(',') : format.name.trim();
				if (name) {
					tourcmd += `, ${name}`;
				} else {
					tourcmd += `,`;
				}
				this.say(`/modnote TOUR: ${formatid} made by ${user.id}`);
				db.tourRuleset = [];
				Storage.exportDatabase(room.id);
				this.say(tourcmd);
				if (!format.team && room.id === 'ruinsofalph') {
					this.say(`!rfaq ${formatid.slice(0, 4)}samples`);
				}
				/* if (!('id' in format)) {
					db.tourRuleset = db.tourRuleset.concat(format.remrules).concat(format.addrules).concat(format.bans).concat(format.unbans);
					Storage.exportDatabase(room.id);
					this.say(`/tour rules ${db.tourRuleset.join(',')}`);
				} */
				return;
			}
		},
		aliases: ['etour'],
	},
};

export class Module implements IPluginInterface {
	name: string = "Elimination Tournaments";

	parseMessage(room: Room, messageType: keyof IClientMessageTypes, messageParts: string[]): true | undefined {
		switch (messageType) {
			case 'tournament': {
				const type = messageParts[0] as keyof ITournamentMessageTypes;
				messageParts.shift();
				switch (type) {
					case 'create': {
						const msgArguments: ITournamentMessageTypes['create'] = {
							format: Dex.getExistingFormat(messageParts[0]),
							generator: messageParts[1],
							playerCap: parseInt(messageParts[2]),
						};
						const format = msgArguments.format;
						if (!format.id.startsWith('gen8')) {
							if (room.id !== 'ruinsofalph') {
								if (room.id !== 'bof') {
									if (room.id === 'oldshark') {
										// (Rooms.get('ruinsofalph') as Room).say(`[Gen ${Tools.toId(messageParts[0])[3]}] (Pure) Hackmons in <<${room.id}>>`);
									} else {
										(Rooms.get('ruinsofalph') as Room).say(`${format.name} in <<${room.id}>>`);
									}
								}
							} else {
								if (format.team) {
									(Rooms.get('randombattles') as Room).say(`${format.name} in <<ruinsofalph>>`);
								}
							}
						}
						if (Storage.getDatabase(room).tourRuleset) {
							Storage.getDatabase(room).tourRuleset = [];
							Storage.exportDatabase(room.id);
						}

						if (Users.self.hasRank(room, 'bot')) {
							const tourcfg = Storage.getDatabase(room).tourcfg;
							if (!tourcfg) break;
							if (tourcfg.autodq) {
								let used = tourcfg.autodq.normal;
								if (format.team) used = tourcfg.autodq.randoms;
								if (!['off', 0].includes(used)) {
									room.say(`/tour autodq ${used}`);
								}
							}
							if (tourcfg.autostart) {
								const used = tourcfg.autostart;
								if (!['off', 0].includes(used)) {
									room.say(`/tour autostart ${used}`);
								}
							}
						}
						break;
					}

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
						if (!room.tournament) Tournaments.createTournament(room, messageArguments.json);
						if (room.tournament) {
							room.tournament.update(messageArguments.json);
							room.tournament.updateEnd();
							room.tournament.end();
						}
						const database = Storage.getDatabase(room);
						const now = Date.now();
						database.lastTournamentTime = now;

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
								if (Config.randomTournamentTimers && room.id in Config.randomTournamentTimers &&
									Tournaments.canSetRandomTournament(room)) {
									Tournaments.setRandomTournamentTimer(room, Config.randomTournamentTimers[room.id]);
								} else if (room.id in Tournaments.scheduledTournaments) {
									Tournaments.setScheduledTournamentTimer(room);
								}
							}
						}
						break;
					}

					case 'forceend': {
						if (room.tournament) room.tournament.forceEnd();
						break;
					}

					case 'start': {
						if (room.tournament) room.tournament.start();
						break;
					}

					case 'join': {
						if (!room.tournament) return;

						const messageArguments: ITournamentMessageTypes['join'] = {
							username: messageParts[0],
						};
						room.tournament.createPlayer(messageArguments.username);
						break;
					}

					case 'leave':
					case 'disqualify': {
						if (!room.tournament) return;

						const messageArguments: ITournamentMessageTypes['leave'] = {
							username: messageParts[0],
						};
						room.tournament.destroyPlayer(messageArguments.username);
						break;
					}

					case 'battlestart': {
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
			}
		}
	}
}
