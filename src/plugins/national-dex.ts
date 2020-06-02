import { IPluginInterface } from "../types/plugins";
import { ICommandDefinition } from "../command-parser";
import { commandCharacter } from "../config";

const stylizedRulesArray = (rules: string[]) => {
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

export const commands: Dict<ICommandDefinition> = {
	nationaldexuu: {
		command(target, room, user) {
			if (this.isPm(room) || room.id !== 'nationaldex' || !user.canPerform(room, 'driver')) return;
			if (!target) {
				return this.say(`/pm ${user.id}, Correct syntax: \`\`${commandCharacter}nduu ban/unban/addrule/remrule -ban, +unban, added rule, !removed rule\`\``);
			}
			const args = target.split(` `);
			if (!args[0] || !['ban', 'unban', 'addrule', 'remrule', 'clearbans', 'viewbans'].includes(Tools.toId(args[0]))) {
				return this.say(`/pm ${user.id}, Correct syntax: \`\`${commandCharacter}nduu ban/unban/addrule/remrule -ban, +unban, added rule, !removed rule\`\``);
			}
			const db = Storage.getDatabase(room);
			if (!db.nationalDexUUBL) {
				db.nationalDexUUBL = [];
				Storage.exportDatabase(room.id);
			}
			const bl = args.slice(1).join(' ').trim().split(',');
			if (Tools.toId(args[0]) === 'clearbans') {
				db.nationalDexUUBL = [];
				Storage.exportDatabase(room.id);
				return this.say(`National Dex UU bans cleared.`);
			}
			if (Tools.toId(args[0]) === 'viewbans') {
				return this.sayHtml(`${db.nationalDexUUBL.map(x => {
					x = Tools.toId(x);
					if (x.endsWith('base')) x = x.replace('base', '');
					if (Dex.getSpecies(x)) x = `<psicon pokemon="${Dex.getSpecies(x)!.id}" />`;
					if (Dex.getItem(x)) x = `<psicon item="${Dex.getItem(x)!.name}" />`;
					if (Dex.getTag(x)) x = `${Dex.getTag(x)}`;
					if (Dex.getFormat(x)) x = `${Dex.getFormat(x)!.name}`;
					if (Dex.getEffect(x) && !Dex.getItem(x)) x = `${Dex.getEffect(x)!.name}`;
					return x;
				}).join(`&nbsp;`)}`, room);
			}
			if (Tools.toId(args[0]) === 'ban') {
				for (const ban of bl.map(x => x.trim())) {
					if (ban.includes('+') || ban.includes('++')) {
						const splitban = ban.includes('++') ? ban.split('++') : ban.split('+');
						let br = '';
						for (const sb of splitban) {
							if (Tools.toId(sb) === 'metronome') {
								br = `Ambiguous ban 'metronome'; preface it with 'move:' or 'item:' (looks like "move:Metronome").`;
								break;
							}
							const trimmedBan = sb.endsWith('-Base') ? sb.replace('-Base', '') : sb;
							if (!Dex.getSpecies(trimmedBan) && !Dex.getEffect(trimmedBan) && !Dex.getTag(trimmedBan)) {
								br = `Invalid section of ban ${ban}: '${sb}'`;
								break;
							}
						}
						if (br) return this.say(br);
						if (db.nationalDexUUBL.includes(`+${ban}`)) {
							const index = db.nationalDexUUBL.indexOf(`+${ban}`);
							db.nationalDexUUBL.splice(index, 1);
							Storage.exportDatabase(room.id);
						} else {
							db.nationalDexUUBL.push(`-${ban}`);
							Storage.exportDatabase(room.id);
						}
					} else {
						if (Tools.toId(ban) === 'metronome') {
							return this.say(`Ambiguous ban 'metronome'; preface it with 'move:' or 'item:' (looks like "move:Metronome").`);
						}
						const trimmedBan = ban.endsWith('-Base') ? ban.replace('-Base', '') : ban;
						if (!Dex.getSpecies(trimmedBan) && !Dex.getEffect(trimmedBan) && !Dex.getTag(trimmedBan)) {
							return this.say(`Invalid ban '${trimmedBan}'`);
						}
						if (db.nationalDexUUBL.includes(`+${ban}`)) {
							const index = db.nationalDexUUBL.indexOf(`+${ban}`);
							db.nationalDexUUBL.splice(index, 1);
							Storage.exportDatabase(room.id);
						} else {
							db.nationalDexUUBL.push(`-${ban}`);
							Storage.exportDatabase(room.id);
						}
					}
				}
				return this.say(`National Dex UU banlist updated.`);
			}
			if (Tools.toId(args[0]) === 'unban') {
				for (const unban of bl.map(x => x.trim())) {
					if (unban.includes('+') || unban.includes('++')) {
						const splitban = unban.includes('++') ? unban.split('++') : unban.split('+');
						let br = '';
						for (const sb of splitban) {
							if (Tools.toId(sb) === 'metronome') {
								br = `Ambiguous ban 'metronome'; preface it with 'move:' or 'item:' (looks like "move:Metronome").`;
								break;
							}
							if (!Dex.getSpecies(sb) && !Dex.getEffect(sb) && !Dex.getTag(sb)) {
								br = `Invalid section of unban ${unban}: '${sb}'`;
								break;
							}
						}
						if (br) return this.say(br);
						if (db.nationalDexUUBL.includes(`-${unban}`)) {
							const index = db.nationalDexUUBL.indexOf(`-${unban}`);
							db.nationalDexUUBL.splice(index, 1);
							Storage.exportDatabase(room.id);
						} else {
							db.nationalDexUUBL.push(`+${unban}`);
							Storage.exportDatabase(room.id);
						}
					} else {
						if (Tools.toId(unban) === 'metronome') {
							return this.say(`Ambiguous ban 'metronome'; preface it with 'move:' or 'item:' (looks like "move:Metronome").`);
						}
						if (!Dex.getSpecies(unban) && !Dex.getEffect(unban) && !Dex.getTag(unban)) {
							return this.say(`Invalid unban '${unban}'`);
						}
						if (db.nationalDexUUBL.includes(`-${unban}`)) {
							const index = db.nationalDexUUBL.indexOf(`-${unban}`);
							db.nationalDexUUBL.splice(index, 1);
							Storage.exportDatabase(room.id);
						} else {
							db.nationalDexUUBL.push(`+${unban}`);
							Storage.exportDatabase(room.id);
						}
					}
				}
				return this.say(`National Dex UU banlist updated.`);
			}
			if (Tools.toId(args[0]) === 'addrule') {
				for (const rule of bl.map(x => x.trim())) {
					if (!Dex.getFormat(rule)) {
						return this.say(`Invalid rule '${rule}'`);
					}
					if (db.nationalDexUUBL.includes(`!${rule}`)) {
						const index = db.nationalDexUUBL.indexOf(`!${rule}`);
						db.nationalDexUUBL.splice(index, 1);
						Storage.exportDatabase(room.id);
					} else {
						db.nationalDexUUBL.push(`${rule}`);
						Storage.exportDatabase(room.id);
					}
				}
				return this.say(`National Dex UU banlist updated.`);
			}
			if (Tools.toId(args[0]) === 'remrule') {
				for (const rule of bl.map(x => x.trim())) {
					if (!Dex.getFormat(rule)) {
						return this.say(`Invalid rule '${rule}'`);
					}
					if (db.nationalDexUUBL.includes(`${rule}`)) {
						const index = db.nationalDexUUBL.indexOf(`${rule}`);
						db.nationalDexUUBL.splice(index, 1);
						Storage.exportDatabase(room.id);
					} else {
						db.nationalDexUUBL.push(`!${rule}`);
						Storage.exportDatabase(room.id);
					}
				}
				return this.say(`National Dex UU banlist updated.`);
			}
		},
		aliases: ['nduu'],
	},
};

/*
export class Module implements IPluginInterface {
	schedule: string[] = ['natdexuu', 'natdexuu', 'natdex', 'natdex', 'natdex', 'natdexuu'];
	name: string = "National Dex";
	times: number[] = [14, 15, 16, 17, 18];
	last: number = 0;
	official() {
		const room = Rooms.get('nationaldex');
		const now = new Date(Date.now());
		if (!room) return;
		const db = Storage.getDatabase(room);
		if (!db.lastTour) {
			db.lastTour = 0;
			Storage.exportDatabase(room.id);
		}
		if (this.last === -1) return;
		this.last = db.lastTour;
		const next = (this.last + 1) % this.times.length;
		const mins = now.getMinutes();
		if (mins > 10) return;
		const hours = now.getHours();
		if (hours === this.times[next]) {
			if (room.tournament) return;
			this.last = next;
			db.lastTour = this.last;
			Storage.exportDatabase(room.id);
			const type = this.schedule[next];
			if (type === 'natdex') {
				room.say(`/tour new natdex, elim`);
				room.say(`/wall This is an official tournament!`);
				room.say(`.official`);
				room.say(`!rfaq samples`);
				if (db.tourcfg) {
					if (!['off', 0].includes(db.tourcfg.autostart)) room.say(`/tour autostart ${db.tourcfg.autostart}`);
					if (!['off', 0].includes(db.tourcfg.autodq.normal)) room.say(`/tour autodq ${db.tourcfg.autodq}`);
				}
			} else {
				room.say(`/tour new natdex, elim`);
				if (db.nationalDexUUBL) room.say(`/tour rules ${stylizedRulesArray(db.nationalDexUUBL).join(', ')}`);
				room.say(`!rfaq National Dex UU`);
				if (db.tourcfg) {
					if (!['off', 0].includes(db.tourcfg.autostart)) room.say(`/tour autostart ${db.tourcfg.autostart}`);
					if (!['off', 0].includes(db.tourcfg.autodq.normal)) room.say(`/tour autodq ${db.tourcfg.autodq}`);
				}
			}
		}
	}
}
*/
