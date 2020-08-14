import type { CommandDefinitions } from "../types/command-parser";
import type { CommandContext } from "../command-parser";

/* eslint-disable @typescript-eslint/explicit-function-return-type, @typescript-eslint/explicit-module-boundary-types */

export const commands: CommandDefinitions<CommandContext> = {
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

/* eslint-enable @typescript-eslint/explicit-function-return-type,@typescript-eslint/no-unused-vars*/
