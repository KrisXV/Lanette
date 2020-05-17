/**
 * Example commands
 * Lanette - https://github.com/sirDonovan/Lanette
 *
 * Plugins make it easier to have custom commands and
 * modules while rebasing with the main repository.
 *
 * This file shows how to add commands.
 *
 * @license MIT license
 */

import { ICommandDefinition } from "../command-parser";

const commands: Dict<ICommandDefinition> = {
	about: {
        command(target, room, user) {
            if (!this.isPm(room) && !user.hasRank(room, 'voice')) return;
            this.say(Config.username + " code by sirDonovan: https://github.com/sirDonovan/Cassius");
        },
	},
};

exports = commands;