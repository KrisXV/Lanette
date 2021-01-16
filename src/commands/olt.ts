import type { BaseCommandDefinitions } from "../types/command-parser";

/* eslint-disable @typescript-eslint/explicit-function-return-type, @typescript-eslint/explicit-module-boundary-types */

export const commands: BaseCommandDefinitions = {
	voice: {
		command(target, room, user) {
			if (this.isPm(room)) return;
			if (room.id !== 'officialladdertournament') return;
			if (!user.canPerform(room, 'driver')) return;
			if (!target || !Tools.isUsernameLength(Tools.toId(target))) return;
			return this.say(`/roomvoice ${target}`);
		},
	},
};

/* eslint-enable */
