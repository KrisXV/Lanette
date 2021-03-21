import type {BaseCommandDefinitions} from "../types/command-parser";

export const commands: BaseCommandDefinitions = {
	recenttours: {
		command(target, room, user) {
			if (!this.isPm(room) && room.id !== 'othermetas') return;
			room = this.isPm(room) ? Rooms.get('othermetas')! : room;
			const db = Storage.getDatabase(room);
			const lastTourTime = db.lastTournamentTime;
			const usePM = !user.canPerform(room, 'voice') ? `/pm ${user.id},` : ``;
			if (!db.recentTours || !db.recentTours.length) {
				return this.say(`${usePM}There have been no tours recently.`);
			}
			this.say(
				`${usePM}Ended ${lastTourTime ? Tools.toDurationString(Date.now() - lastTourTime) : 'sometime'} ago - ${db.recentTours.join(', ')}`
			);
		}
	},
};
