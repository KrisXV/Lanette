import { ICommandDefinition } from "../command-parser";
import { Player } from "../room-activity";
import { Game } from "../room-game";
import { IGameFile, AchievementsDict } from "../types/games";

const achievements: AchievementsDict = {
	'quickdraw': {name: 'Quick Draw', type: 'first', bits: 1000, description: "be the first to successfully fire each round"},
};

class OctillerysAmbush extends Game {
	fireTime: boolean = false;
	firstFire: Player | false | undefined;
	queue: {source: Player, target: Player}[] = [];
	roundActions = new Map<Player, boolean>();
	shields = new Map<Player, boolean>();

	onStart() {
		this.say("Prepare your Remoraid!");
		this.nextRound();
	}

	onRenamePlayer(player: Player, oldId: string) {
		if (!this.started || player.eliminated) return;
		this.removePlayer(player.name, true);
		this.say(player.name + " was DQed for changing names!");
	}

	onNextRound() {
		this.fireTime = false;
		if (this.round > 1) {
			this.shields.clear();
			let firstFireChecked = false;
			for (let i = 0; i < this.queue.length; i++) {
				if (this.queue[i].source.eliminated) continue;
				const player = this.queue[i].source;
				this.shields.set(player, true);
				const targetPlayer = this.queue[i].target;
				if (this.shields.has(targetPlayer) || targetPlayer.eliminated) continue;

				if (!firstFireChecked) {
					if (this.firstFire === undefined) {
						this.firstFire = player;
					} else {
						if (this.firstFire && this.firstFire !== player) this.firstFire = false;
					}
					firstFireChecked = true;
				}

				this.eliminatePlayer(targetPlayer, "You were hit by " + player.name + "'s Remoraid!");
			}
			if (this.getRemainingPlayerCount() <= 1) return this.end();
		}
		this.roundActions.clear();
		this.queue = [];
		const html = this.getRoundHtml(this.getPlayerNames);
		const uhtmlName = this.uhtmlBaseName + '-round-html';
		this.onUhtml(uhtmlName, html, () => {
			const time = this.sampleOne([8000, 9000, 10000]);
			const text = "**FIRE**";
			this.on(text, () => {
				this.fireTime = true;
				this.timeout = setTimeout(() => this.nextRound(), (3 * 1000) + time);
			});
			this.timeout = setTimeout(() => this.say(text), time);
		});
		this.sayUhtml(uhtmlName, html);
	}

	onEnd() {
		const winner = this.getFinalPlayer();
		if (winner) {
			this.winners.set(winner, 1);
			this.addBits(winner, 250);
			if (this.firstFire === winner) this.unlockAchievement(winner, achievements.quickdraw!);
		}

		this.announceWinners();
	}
}

const commands: Dict<ICommandDefinition<OctillerysAmbush>> = {
	fire: {
		command(target, room, user) {
			if (!(user.id in this.players) || this.players[user.id].eliminated) return false;
			const player = this.players[user.id];
			if (this.roundActions.has(player)) return false;
			this.roundActions.set(player, true);
			if (!this.fireTime) return false;
			const targetPlayer = this.players[Tools.toId(target)];
			if (!targetPlayer || targetPlayer === player) return false;
			this.queue.push({"target": targetPlayer, "source": player});
			return true;
		},
	},
};

export const game: IGameFile<OctillerysAmbush> = {
	achievements,
	aliases: ["octillerys", "oa"],
	category: 'reaction',
	commandDescriptions: [Config.commandCharacter + "fire [player]"],
	commands,
	class: OctillerysAmbush,
	description: "Players await Octillery's <code>FIRE</code> signal to eliminate their opponents with their Remoraid!",
	formerNames: ["Ambush"],
	name: "Octillery's Ambush",
	mascot: "Octillery",
};
