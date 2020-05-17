/**
 * Example module
 * Lanette - https://github.com/sirDonovan/Lanette
 *
 * Plugins make it easier to have custom commands and
 * modules while rebasing with the main repository.
 *
 * This file shows how to add a module.
 *
 * @license MIT license
 */

import { ICommandDefinition } from "../command-parser";

const commands: Dict<ICommandDefinition> = {
	about: {
        command(target, room, user) {
            if (!this.isPm(room) && !user.hasRank(room, 'voice')) return;
            this.say("test");
        },
	},
};

export class Plugin {
    name: string;
    data: any;
    commands: Dict<ICommandDefinition>;

	constructor() {
		this.name = "Example";
		this.data = {};
		this.commands = commands;
	}

	onLoad() {
		this.loadData();
	}

	loadData() {
		// initialization that requires the plugin to be in the global namespace
	}
}