import type { BaseCommandDefinitions } from "../types/command-parser";

/* eslint-disable @typescript-eslint/explicit-function-return-type, @typescript-eslint/explicit-module-boundary-types */

export const commands: BaseCommandDefinitions = {
	addprivateroom: {
		command(target, room) {
			if (this.isPm(room)) return;
			const globaldb = Storage.getGlobalDatabase();
			if (globaldb.privateRooms && globaldb.privateRooms.includes(room.id)) {
				return this.say(`This room is already considered private.`);
			}
			if (!globaldb.privateRooms) {
				globaldb.privateRooms = [];
				Storage.exportDatabases();
			}
			globaldb.privateRooms.push(room.id);
			Storage.exportDatabases();
			this.say(`This room is now considered private.`);
			return;
		},
		developerOnly: true,
	},
	removeprivateroom: {
		command(target, room) {
			if (this.isPm(room)) return;
			const globaldb = Storage.getGlobalDatabase();
			if (!globaldb.privateRooms || !globaldb.privateRooms.includes(room.id)) {
				return this.say(`This room isn't considered private.`);
			}
			const roomIndex = globaldb.privateRooms.findIndex(x => Tools.toRoomId(x) === room.id);
			globaldb.privateRooms.splice(roomIndex, 1);
			if (!globaldb.privateRooms.length) delete globaldb.privateRooms;
			Storage.exportDatabases();
			this.say(`This room is no longer considered private.`);
			return;
		},
		developerOnly: true,
	},
};

/* eslint-enable */
