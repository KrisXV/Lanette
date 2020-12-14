import type { CommandDefinitions } from "../types/command-parser";
import type { CommandContext } from "../command-parser";
import type { IPluginInterface } from "../types/plugins";
import type { Room } from "../rooms";
import type { IClientMessageTypes, ITournamentMessageTypes } from "../types/client";
import type { ITournamentUpdateJson, ITournamentEndJson } from "../types/tournaments";
import { commandCharacter } from "../config";

const customRulesURL = `https://github.com/smogon/pokemon-showdown/blob/master/config/CUSTOM-RULES.md`;

/* eslint-disable @typescript-eslint/explicit-function-return-type, @typescript-eslint/explicit-module-boundary-types */

export const commands: CommandDefinitions<CommandContext> = {
	eliminationtour: {
		command(target, room, user) {
			const args = target.split(' ');
			if (!args[0] || Tools.toId(args[0]) === 'help') {
				/* eslint-disable max-len */
				let html = `<center><h1><code>${commandCharacter}eliminationtour</code> Help</h1></center>`;
				html += `<h2>Creating a tournament</h2><p>To create a tour, the following conditions must be met:</p><ul>`;
				html += `<li>A Driver (%) or higher or a Host (Hosts can be seen by having a Room Driver (%) type <code>${commandCharacter}hosts</code> in a room).</li>`;
				html += `<li>Unown must be Bot (*) rank.</li><li>Tournaments must be enabled for Moderators (@) or lower.</li></ul>`;
				html += `<p>The syntax to creating a tournament is <code>${commandCharacter}etour [formatid]</code>. You can also optionally add more arguments to simulate the <code>/tour</code> command.`;
				html += `The full syntax is <code>${commandCharacter}etour [formatid], [tournament type (optional)], [player cap (optional)], [rounds (optional)], [name (optional)]</code>.</p>`;
				html += `<ul><li><strong>[formatid]</strong>: This is the format that the tournament is created in (Gen 7 OU, etc.). If you are unsure if a format exists, do <code>/tier [format]</code> and/or ask a staff member.</li>`;
				html += `<li><strong>[tournament type (optional)]</strong>: This is where you decide if you want the tournament to be an <code>elimination (elim for short)</code> tour or a <code>round robin (rr for short)</code> tour. If this is not provided, it defaults to elimination.</li>`;
				html += `<li><strong>[player cap (optional)]</strong>: This is the maximum number of players that are allowed to enter. Defaults to 0 (no player cap).</li>`;
				html += `<li><strong>[rounds (optional)]</strong>: This is the number of rounds that are in a tournament. Defaults to 1. You can go as high as you want, but the bot only has support for sextuple elimination at most (6 rounds).</li>`;
				html += `<li><strong>[name (optional)]</strong>: The name, if provided, will be appended to the tournament upon being created. Defaults to the format's name.</li></ul>`;
				html += `<h2>Tournament configuration</h2>`;
				html += `<p><small>(WIP)</small></p>`;
				/* eslint-enable max-len */

				return (Rooms.get('ruinsofalph') as Room).say(`/sendhtmlpage ${user.id},${commandCharacter}etour guide,${html}`, {dontPrepare: true});
			}
			if (this.isPm(room)) return;
			if (!user.canPerform(room, 'driver') && !user.isHost(room)) return;
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
			const stylizedRulesArray: (k: string[]) => string[] = (rules: string[]) => {
				const sortedRules: string[] = [];
				for (const rule of rules) {
					if (Dex.getFormat(rule)) {
						const format = Dex.getExistingFormat(rule);
						const charAt0 = rule.charAt(0);
						sortedRules.push(`${charAt0 === '!' ? '!' : ''}${format.name}`);
					}
					if (Dex.getTag(rule)) {
						const tag = Dex.getTag(rule)!;
						const charAt0 = rule.charAt(0);
						sortedRules.push(`${charAt0 === '+' ? '+' : (charAt0 === '-' ? '-' : '*')}${tag}`);
					}
					if (Dex.getSpecies(rule)) {
						const species = Dex.getExistingPokemon(rule);
						const charAt0 = rule.charAt(0);
						sortedRules.push(`${charAt0 === '+' ? '+' : (charAt0 === '-' ? '-' : '*')}${species.name}`);
					}
					if (Dex.getEffect(rule)) {
						const effect = Dex.getEffect(rule)!;
						let isAmbiguous = '';
						if (rule.toLowerCase().slice(1).startsWith('move:')) isAmbiguous = 'move: ';
						if (rule.toLowerCase().slice(1).startsWith('item:')) isAmbiguous = 'item: ';
						if (rule.toLowerCase().slice(1).startsWith('ability:')) isAmbiguous = 'ability: ';
						const charAt0 = rule.charAt(0);
						sortedRules.push(`${charAt0 === '+' ? '+' : (charAt0 === '-' ? '-' : '*')}${isAmbiguous}${effect.name}`);
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
				if (!name) return this.say(`Correct syntax: ${commandCharacter}etour name __[name]__`);
				this.say(`/modnote TOUR: renamed by ${user.id}`);
				this.say(`/tour name ${name}`);
				return;
			} else if (['clearname', 'delname'].includes(arg0ID)) {
				this.say(`/modnote TOUR: name cleared by ${user.id}`);
				this.say(`/tour clearname`);
				return;
			} else if (['autostart', 'setautostart', 'as'].includes(arg0ID)) {
				if (!args[1]) return this.say(`Correct syntax: ${commandCharacter}etour autostart __[number | "off"]__`);
				const autostartTimer = parseInt(args[1]);
				if (Tools.toId(args[1]) !== 'off' && isNaN(autostartTimer)) return this.say(`${args[1]} is not a number.`);
				if (Tools.toId(args[1]) === 'off' || autostartTimer === 0) return this.say(`/tour autostart off`);
				this.say(`/modnote TOUR: autostart set by ${user.id}`);
				this.say(`/tour autostart ${autostartTimer}`);
				return;
			} else if (['autodq', 'setautodq', 'adq', 'runautodq'].includes(arg0ID)) {
				if (arg0ID === 'runautodq') return this.say(`/tour runautodq`);
				if (!args[1]) return this.say(`Correct syntax: ${commandCharacter}etour autodq __[number | "off"]__`);
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
					return this.say(`Please provide rules to add. Here is a list: ${customRulesURL}`);
				}
				for (const rule of addedRules.map(r => r.trim())) {
					if (!Dex.getFormat(rule)) {
						return this.say(`Rule '${rule}' not found. [[Here is a list of rules <Here is a list: ${customRulesURL}>]]`);
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
					return this.say(`Please provide rules to add. Here is a list: ${customRulesURL}`);
				}
				for (const rule of removedRules.map(r => r.trim())) {
					if (!Dex.getFormat(rule)) {
						return this.say(`Rule '${rule}' not found. [[Here is a list: <${customRulesURL}>]]`);
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
			} else if (['unban', 'removeban', 'unrestrict'].includes(arg0ID)) {
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
					} else if (db.tourRuleset.includes(`*${unban}`)) {
						const unbanIndex = db.tourRuleset.indexOf(`*${unban}`);
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
			} else if (['restrict', 'addrestriction'].includes(arg0ID)) {
				const restrictionlist = args.slice(1).join(' ').trim().split(',');
				if (!restrictionlist.length) {
					return this.say(`Please provide Pokemon/items/moves/abilities/tiers to ban.`);
				}
				for (const restriction of restrictionlist.map(r => r.trim())) {
					if (Tools.toId(restriction) === 'metronome') {
						return this.say(`Ambiguous ban 'metronome'; preface it with 'move:' or 'item:' (looks like "move:Metronome").`);
					}
					if (
						!Dex.getSpecies(restriction) &&
						!Dex.getEffect(restriction) &&
						!Dex.getTag(restriction)
					) {
						return this.say(`Invalid restriction '${restriction}'`);
					}
					if (db.tourRuleset.includes(`+${restriction}`)) {
						const banIndex = db.tourRuleset.indexOf(`+${restriction}`);
						db.tourRuleset.splice(banIndex, 1);
						Storage.exportDatabase(room.id);
					} else {
						if (db.tourRuleset.includes(`*${restriction}`)) {
							return this.say(`The object ${restriction} is already added.`);
						}
						db.tourRuleset.push(`*${restriction}`);
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
					} else if (['+', '-', '*'].includes(rule.charAt(0))) {
						const slicedRule = rule.substr(1);
						if (slicedRule.includes('+')) {
							const slindex = slicedRule.indexOf('++');
							let split = slicedRule.split('+');
							if (slindex >= 0) split = slicedRule.split('++');
							for (const sp of split.map(x => x.trim())) {
								if (Tools.toId(sp) === 'metronome') {
									const banPrefix = rule.startsWith('-') ? '' : 'un';
									return this.say(`Ambiguous ${banPrefix}ban 'metronome'; preface it with 'move:' or 'item:'.`);
								}
								if (!Dex.getSpecies(sp) && !Dex.getEffect(sp) && !Dex.getTag(sp)) {
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
								const banPrefix = rule.startsWith('-') ? '' : 'un';
								return this.say(`Ambiguous ${banPrefix}ban 'metronome'; preface it with 'move:' or 'item:'.`);
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
					return this.say(`Correct syntax: ${commandCharacter}etour timer __["on" | "off"]__`);
				}
				this.say(`/modnote TOUR: Forcetimer toggled by ${user.id}`);
				this.say(`/tour forcetimer ${Tools.toId(args[1])}`);
				return;
			} else if (['scout', 'scouting'].includes(arg0ID)) {
				if (!args[1] || !['on', 'off'].includes(Tools.toId(args[1]))) {
					return this.say(`Correct syntax: ${commandCharacter}etour scouting __["on" | "off"]__`);
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
					return this.say(`Correct syntax: ${commandCharacter}etour scouting __["on" | "off"]__`);
				}
				this.say(`/modnote TOUR: Modjoin toggled by ${user.id}`);
				if (Tools.toId(args[1]) === 'on') {
					this.say(`/tour modjoin allow`);
				} else {
					this.say(`/tour modjoin disallow`);
				}
				return;
			} else if (['public', 'forcepublic'].includes(arg0ID)) {
				if (!args[1] || !['on', 'off'].includes(Tools.toId(args[1]))) {
					return this.say(`Correct syntax: ${commandCharacter}etour forcepublic __["on" | "off"]__`);
				}
				this.say(`/modnote TOUR: Matches forced public toggled by ${user.id}`);
				if (Tools.toId(args[1]) === 'on') {
					this.say(`/tour forcepublic on`);
				} else {
					this.say(`/tour forcepublic off`);
				}
				return;
			} else if (['cap', 'playercap'].includes(arg0ID)) {
				const arg1Int = parseInt(args[1]);
				if (!args[1] || isNaN(arg1Int)) {
					return this.say(`Correct syntax: ${commandCharacter}etour playercap __[number]__`);
				}
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
					if (isNaN(t2Int)) {
						const cmdFormat = `__[format]__, __["elimination" | "roundrobin"]__, __[player cap]__`;
						return this.say(`Correct syntax: ${commandCharacter}etour ${cmdFormat}`);
					}
					tourcmd += `, ${t2Int}`;
				} else {
					tourcmd += `,`;
				}
				if (targets[3]) {
					const t3Int = parseInt(targets[3]);
					if (isNaN(t3Int)) {
						const cmdFormat = `__[format]__, __["elimination" | "roundrobin"]__, __[player cap]__, __[rounds]__`;
						return this.say(`Correct syntax: ${commandCharacter}etour ${cmdFormat}`);
					}
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

/* eslint-enable @typescript-eslint/explicit-function-return-type,@typescript-eslint/no-unused-vars*/

export class Module implements IPluginInterface {
	name: string = "Elimination Tournaments";

	parseMessage(room: Room, messageType: keyof IClientMessageTypes, messageParts: string[]): true | undefined {
		switch (messageType) {
			case 'tournament': {
				if (!Config.allowTournaments || !Config.allowTournaments.includes(room.id)) return;
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
						const database = Storage.getDatabase(room);
						const globalDB = Storage.getGlobalDatabase();
						if (!format.id.startsWith('gen8')) {
							if (globalDB.privateRooms && !globalDB.privateRooms.includes(room.id)) {
								if (room.id !== 'ruinsofalph') {
									if (room.id === 'oldshark') {
										// (Rooms.get('ruinsofalph') as Room).say(`[Gen ${Tools.toId(messageParts[0])[3]}] (Pure) Hackmons in <<${room.id}>>`);
									} else {
										(Rooms.get('ruinsofalph') as Room).say(`${format.name} in <<${room.id}>>`);
									}
								} else {
									if (format.team) {
										(Rooms.get('randombattles') as Room).say(`${format.name} in <<ruinsofalph>>`);
									}
								}
							}
						}
						if (database.tourRuleset) {
							database.tourRuleset = [];
							Storage.exportDatabase(room.id);
						}

						if (Users.self.hasRank(room, 'bot')) {
							const tourcfg = database.tourcfg;
							if (tourcfg && tourcfg.autodq) {
								let used = tourcfg.autodq.normal;
								if (format.team) used = tourcfg.autodq.randoms;
								if (!['off', 0].includes(used)) {
									room.say(`/tour autodq ${used}`);
								}
							}
							if (tourcfg && tourcfg.autostart) {
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
						if (room.tournament) {
							room.tournament.update(messageArguments.json);
							if (room.tournament.started && room.tournament.getRemainingPlayerCount() <= 4) {
								room.sayCommand('/tour forcepublic on');
							}
						}
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
									if (!database.queuedTournament.time) {
										database.queuedTournament.time = now + Tournaments.queuedTournamentTime;
									}
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
