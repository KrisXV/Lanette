import type { BaseCommandDefinitions } from "../types/command-parser";

/* eslint-disable @typescript-eslint/explicit-function-return-type, @typescript-eslint/explicit-module-boundary-types */

export const commands: BaseCommandDefinitions = {
	forceleaveroom: {
		command(target, room, user) {
			/* if (this.isPm(room)) {
				if (!target) return this.say(`Please provide a room name. Syntax: \`\`${Config.commandCharacter}forceleaveroom [room]\`\``);
				if (!Config.rooms || !Config.rooms.length) return;
				const rooms = Config.rooms.map(Tools.toRoomId);
				if (!rooms.includes(Tools.toRoomId(target))) {
					return this.say(`Please provide a room that ${Config.username} is in.`);
				}
				const usedRoom = Rooms.get(Tools.toRoomId(target)) as Room;
				if (!user.canPerform(usedRoom, 'roomowner')) return this.say('Access denied.');
				usedRoom.say(`/leave`);
				this.say('Done.');
				return;
			} else {
				if (!user.canPerform(room, 'roomowner')) return;
				this.say('Adios!');
				this.say('/leave');
				return;
			} */
			if (this.isPm(room) || !user.canPerform(room, 'roomowner')) return;
			this.say('Adios!');
			this.say('/leave');
			return;
		},
	},
};

/* eslint-enable */
