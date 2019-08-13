import { DefaultGameOption } from "../room-game";
import { Room } from "../rooms";
import { IGameFile } from "../types/games";
import { commandDescriptions, commands as templateCommands, Guessing } from "./templates/guessing";

const name = "Feraligatr's Lost Letters";
const data: Dict<string[]> = {
	"Characters": [],
	"Pokemon": [],
	"Pokemon Abilities": [],
	"Pokemon Items": [],
	"Pokemon Moves": [],
};
const categories = Object.keys(data);
const vowels: string[] = ['a', 'e', 'i', 'o', 'u', 'A', 'E', 'I', 'O', 'U'];
let loadedData = false;

class FeraligatrsLostLetters extends Guessing {
	static loadData(room: Room) {
		if (loadedData) return;
		room.say("Loading data for " + name + "...");

		data["Characters"] = Dex.data.characters.slice();
		data["Pokemon"] = Dex.getPokemonList().map(x => x.species);
		data["Pokemon Abilities"] = Dex.getAbilitiesList().map(x => x.name);
		data["Pokemon Items"] = Dex.getItemsList().map(x => x.name);
		data["Pokemon Moves"] = Dex.getMovesList().map(x => x.name);

		loadedData = true;
	}

	categoryList: string[] = categories.slice();
	defaultOptions: DefaultGameOption[] = ['points'];
	roundTime: number = 10 * 1000;

	onCreate() {
		if (this.variant === 'inverse') {
			this.roundTime = 15 * 1000;
			this.categoryList.splice(this.categoryList.indexOf('characters'), 1);
		}
	}

	onSignups() {
		if (this.isMiniGame) {
			this.nextRound();
		} else {
			if (this.options.freejoin) this.timeout = setTimeout(() => this.nextRound(), 5 * 1000);
		}
	}

	removeLetters(letters: string[], isInverse: boolean): string {
		const newLetters: string[] = [];
		for (let i = 0; i < letters.length; i++) {
			if (letters[i] === ' ') continue;
			if (isInverse) {
				if (vowels.includes(letters[i])) {
					newLetters.push(letters[i]);
				}
			} else {
				if (!vowels.includes(letters[i])) {
					newLetters.push(letters[i]);
				}
			}
		}

		return newLetters.join('');
	}

	setAnswers() {
		const isInverse = this.variant === 'inverse';
		let category = '';
		if (this.roundCategory) {
			category = this.roundCategory;
		} else if (this.variant && !isInverse) {
			category = this.variant;
		} else {
			category = Tools.sampleOne(this.categoryList);
		}
		let answer: string = '';
		let hint: string = '';
		while (!answer) {
			let name = Tools.sampleOne(data[category]);
			if (!name || name.endsWith('-Mega')) continue;
			name = name.trim();
			hint = this.removeLetters(name.split(''), isInverse);
			if (hint.length === name.length || Client.willBeFiltered(hint)) continue;
			answer = name;
		}
		this.answers = [answer];
		for (let i = 0; i < data[category].length; i++) {
			const name = data[category][i].trim();
			if (name === answer) continue;
			if (this.removeLetters(name.split(''), isInverse) === hint) this.answers.push(name);
		}
		this.hint = '[**' + category + '**] __' + hint + '__';
	}
}

export const game: IGameFile<FeraligatrsLostLetters> = {
	aliases: ['feraligatrs', 'fll', 'll'],
	battleFrontierCategory: 'Identification',
	class: FeraligatrsLostLetters,
	commandDescriptions,
	commands: Object.assign({}, templateCommands),
	description: "Players guess the missing vowels to find the answers!",
	formerNames: ["Lost Letters"],
	freejoin: true,
	name,
	mascot: "Feraligatr",
	minigameCommand: 'lostletter',
	minigameCommandAliases: ['lletter'],
	minigameDescription: "Use ``" + Config.commandCharacter + "g`` to guess the answer after finding the missing vowels!",
	variants: [
		{
			name: "Feraligatr's Inverse Lost Letters",
			description: "Players guess the missing consonants to find the answers!",
			variant: "inverse",
		},
		{
			name: "Feraligatr's Pokemon Lost Letters",
			variant: "Pokemon",
		},
		{
			name: "Feraligatr's Move Lost Letters",
			variant: "Pokemon Moves",
			variantAliases: ['move', 'moves'],
		},
		{
			name: "Feraligatr's Item Lost Letters",
			variant: "Pokemon Items",
			variantAliases: ['item', 'items'],
		},
		{
			name: "Feraligatr's Ability Lost Letters",
			variant: "Pokemon Abilities",
			variantAliases: ['ability', 'abilities'],
		},
	],
};