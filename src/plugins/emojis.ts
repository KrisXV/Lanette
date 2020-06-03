import type { ICommandDefinition } from "../command-parser";
import type { Room } from "../rooms";

export const commands: Dict<ICommandDefinition> = {
	emojiwhitelist: {
		command(target, room, user) {
			const args = target.split(' ');
			const userTarget = args.slice(1).join(' ').trim();
			if (!args[0] || !['add', 'remove', 'roomadd', 'roomremove'].includes(Tools.toId(args[0]))) return;
			if (!userTarget || Tools.toId(userTarget).length > 18) return;
			if (['roomadd', 'roomremove'].includes(Tools.toId(args[0]))) {
				if (this.isPm(room) || !user.canPerform(room, 'roomowner')) {
					return this.say(`/pm ${user.id}, You can't perform that command.`);
				}
				if (!Storage.getDatabase(room).emojiWhitelist) {
					Storage.getDatabase(room).emojiWhitelist = [];
					Storage.exportDatabase(room.id);
				}
				const wl = Storage.getDatabase(room).emojiWhitelist!;
				if (Tools.toId(args[0]) === 'roomadd') {
					if (wl.map(Tools.toId).includes(Tools.toId(userTarget))) {
						return this.say(`The user '${Tools.toId(userTarget)}' is already whitelisted for the room ${room.title}.`);
					}
					wl.push(Tools.toId(userTarget));
					Storage.exportDatabase(room.id);
					return this.say(`Added '${userTarget}' to the emoji whitelist for the room ${room.title}.`);
				} else if (Tools.toId(args[0]) === 'roomremove') {
					const userIndex = wl.findIndex(x => Tools.toId(x) === Tools.toId(userTarget));
					if (userIndex < 0) {
						return this.say(`The user '${Tools.toId(userTarget)}' is already whitelisted for the room ${room.title}.`);
					}
					wl.splice(userIndex, 1);
					Storage.exportDatabase(room.id);
					return this.say(`Removed '${userTarget}' from the emoji whitelist for the room ${room.title}.`);
				}
			}
		},
		aliases: ['ewl'],
	},
	addemoji: {
		command(target, room, user) {
			if (!this.isPm(room)) return;
			const args = target.split(',');
			if (!args.length || !args[0] || !args[1]) return;
			if (!Storage.getGlobalDatabase().emojis) {
				Storage.getGlobalDatabase().emojis = {};
				Storage.exportDatabases();
			}
			const edb = Storage.getGlobalDatabase().emojis!;
			if (Tools.toId(args[0]) in edb) {
				return this.say(`That emoji alreaady exists.`);
			} else {
				edb[Tools.toId(args[0])] = `${args[1].trim()}`;
				Storage.exportDatabases();
				return this.say(`Added emoji ${Tools.toId(args[0])}`);
			}
		},
		developerOnly: true,
	},
	emoji: {
		command(target, room, user) {
			const globalDB = Storage.getGlobalDatabase();
			const emojiDatabase = globalDB.emojis;
			if (!emojiDatabase) return;
			if (!target) return;
			if (this.isPm(room)) {
				if (!Users.self.canPerform(Rooms.get('staff') as Room, 'bot')) return;
				if (!(Tools.toId(target) in emojiDatabase)) return this.say(`That emoji doesn't exist.`);
				let usedEmoji = emojiDatabase[Tools.toId(target)];
				if (Tools.toId(usedEmoji) in emojiDatabase) {
					usedEmoji = emojiDatabase[Tools.toId(usedEmoji)];
				}
				this.sayUhtml(
					`${Tools.toId(usedEmoji)}`,
					`<img src="${usedEmoji.trim()}" alt="${usedEmoji}" width="20" height="20" />`,
					Rooms.get('ruinsofalph') as Room
				);
			} else {
				if (!Users.self.canPerform(room, 'bot')) return;
				if (globalDB.privateRooms && globalDB.privateRooms.includes(room.id)) {
					if (!(Tools.toId(target) in emojiDatabase)) return this.say(`That emoji doesn't exist.`);
					let usedEmoji = emojiDatabase[Tools.toId(target)];
					if (Tools.toId(usedEmoji) in emojiDatabase) {
						usedEmoji = emojiDatabase[Tools.toId(usedEmoji)];
					}
					this.sayUhtml(
						`${Tools.toId(usedEmoji)}`,
						`<img src="${usedEmoji.trim()}" alt="${usedEmoji}" width="20" height="20" />`,
						Rooms.get('ruinsofalph') as Room
					);
					return;
				}
				if (!user.canPerform(room, 'roomowner') && !user.isEmojiWhitelisted(room)) {
					return this.say(`/pm ${user.id}, You don't have permission to do that.`);
				}
				if (!(Tools.toId(target) in emojiDatabase)) return this.say(`That emoji doesn't exist.`);
				let usedEmoji = emojiDatabase[Tools.toId(target)];
				if (Tools.toId(usedEmoji) in emojiDatabase) {
					usedEmoji = emojiDatabase[Tools.toId(usedEmoji)];
				}
				this.sayUhtml(
					`${Tools.toId(usedEmoji)}`,
					`<img src="${usedEmoji.trim()}" alt="${usedEmoji}" width="20" height="20" />`,
					Rooms.get('ruinsofalph') as Room
				);
			}
		},
		aliases: ['e'],
	},
	lips: {
		command(target, room, user) {
			if (!user.canPerform(Rooms.get('staff') as Room, 'roomowner')) return;
			this.sayUhtml(
				'lips for kris',
				`<img src="https://discordapp.com/assets/52854da3ce48e284c9a7cd67532fd313.svg" alt="eye" width="20" height="20" />` +
				`<img src="https://discordapp.com/assets/c1aac731a5d5bab09fc7d177fadc5eef.svg" alt="lips" width="20" height="20" />` +
				`<img src="https://discordapp.com/assets/52854da3ce48e284c9a7cd67532fd313.svg" alt="eye" width="20" height="20" />`,
				Rooms.get('ruinsofalph') as Room
			);
		},
	},
	emojislist: {
		command(target, room, user) {
			let pmRoom: Room;
			let canPerformInRoom = true;
			if (this.isPm(room) || (!user.canPerform(room, 'roomowner') && !user.isEmojiWhitelisted(room))) {
				pmRoom = Rooms.get('ruinsofalph') as Room;
				canPerformInRoom = false;
			} else {
				pmRoom = room;
			}
			const ewl = Storage.getGlobalDatabase().emojis;
			if (!ewl || !Object.keys(ewl).length) {
				return this.say(`${canPerformInRoom ? `` : `/pm ${user.id}, `}There are currently no emojis saved.`);
			}
			let buf = `<div class="infobox infobox-limited"><details><summary>Emojis</summary>`;
			buf += `<ul style="list-style-type:none;margin-left:0;padding-left:0;">`;
			for (const emoji in Object.fromEntries(Object.entries(ewl).sort())) {
				if (!ewl[emoji].startsWith('http')) continue;
				buf += `<li><img src="${ewl[emoji].trim()}" alt="${ewl[emoji]}" width="20" height="20" /> <code>${emoji}</code></li>`;
			}
			buf += `</ul></details>`;
			buf += `<br /><p>`;
			const privateRooms = Storage.getGlobalDatabase().privateRooms || [];
			if (!privateRooms.includes(room.id)) {
				buf += `To use these, you need to be Room Owner (#) or higher in the room it is used`;
				buf += `in or otherwise whitelisted by the Room Owners.`;
				buf += `Room Owners can whitelist users in their room with <code>@ewl roomadd/roomremove [userid]</code>. `;
			}
			buf += `The command to use these in chat is <code>@e [emoji name]</code>.</p>`;
			buf += `</div>`;
			if (canPerformInRoom) {
				this.sayUhtml('unownemojislist', `${buf}`, pmRoom);
			} else {
				pmRoom.pmUhtml(user, 'unownemojislist', buf);
			}
		},
		aliases: ['elist', 'emojilist'],
	},
};
