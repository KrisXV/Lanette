import { assert, assertStrictEqual } from './../test-tools';

describe("Dex", () => {
	it('should compute all data types properly', () => {
		for (const i in Dex.data.Abilities) {
			assert(Dex.getExistingAbility(i), i);
		}
		for (const i in Dex.data.Formats) {
			assert(Dex.getExistingFormat(i), i);
		}
		for (const i in Dex.data.Items) {
			assert(Dex.getExistingItem(i), i);
		}
		for (const i in Dex.data.Movedex) {
			assert(Dex.getExistingMove(i), i);
		}
		for (const i in Dex.data.Pokedex) {
			assert(Dex.getExistingSpecies(i), i);
		}

		// abilities
		assertStrictEqual(Dex.getDex('gen2').getExistingAbility('Intimidate').isNonstandard, 'Future');
		assert(!Dex.getDex('gen3').getExistingAbility('Intimidate').isNonstandard);

		// items
		assertStrictEqual(Dex.getDex('gen1').getExistingItem('Gold Berry').isNonstandard, 'Future');
		assert(!Dex.getDex('gen2').getExistingItem('Gold Berry').isNonstandard);
		assertStrictEqual(Dex.getDex('gen3').getExistingItem('Gold Berry').isNonstandard, 'Past');

		// pokemon
		assertStrictEqual(Dex.getDex('gen1').getExistingSpecies('Togepi').isNonstandard, 'Future');
		assert(!Dex.getDex('gen2').getExistingSpecies('Togepi').isNonstandard);
		assert(!Dex.getDex('gen4').getExistingSpecies('Pichu-Spiky-Eared').isNonstandard);
		assertStrictEqual(Dex.getDex('gen5').getExistingSpecies('Pichu-Spiky-Eared').isNonstandard, 'Past');

		assertStrictEqual(Dex.getExistingSpecies("Darmanitan").gen, 5);
		assertStrictEqual(Dex.getExistingSpecies("Darmanitan-Zen").gen, 5);
		assertStrictEqual(Dex.getExistingSpecies("Darmanitan-Galar").gen, 8);
		assertStrictEqual(Dex.getExistingSpecies("Darmanitan-Galar-Zen").gen, 8);
		assertStrictEqual(Dex.getExistingSpecies("Greninja").gen, 6);
		// assertStrictEqual(Dex.getExistingSpecies("Ash Greninja").gen, 7);

		let pokemon = Dex.getExistingSpecies('Charizard');
		assert(pokemon.allPossibleMoves.length > Object.keys(pokemon.learnset!).length, pokemon.name);
		pokemon = Dex.getExistingSpecies('Lycanroc-Dusk');
		assert(pokemon.allPossibleMoves.length > Object.keys(pokemon.learnset!).length, pokemon.name);
		pokemon = Dex.getExistingSpecies('Rotom-Frost');
		assert(pokemon.allPossibleMoves.length > Object.keys(pokemon.learnset!).length, pokemon.name);
		// pokemon = Dex.getExistingSpecies('Pikachu-Gmax');
		// assert(pokemon.allPossibleMoves.length > Object.keys(pokemon.learnset!).length, pokemon.name);

		const houndour = Dex.getExistingSpecies('Houndour');
		const houndoomMega = Dex.getExistingSpecies('Houndoom-Mega');
		for (let i = 0; i < houndour.allPossibleMoves.length; i++) {
			assert(houndoomMega.allPossibleMoves.includes(houndour.allPossibleMoves[i]));
		}

		const rattataAlola = Dex.getExistingSpecies('Rattata-Alola');
		const raticateAlola = Dex.getExistingSpecies('Raticate-Alola');
		for (let i = 0; i < rattataAlola.allPossibleMoves.length; i++) {
			assert(raticateAlola.allPossibleMoves.includes(rattataAlola.allPossibleMoves[i]));
		}

		/*
		assertStrictEqual(Dex.getExistingSpecies('Arceus').tier, 'Uber');
		assertStrictEqual(Dex.getExistingSpecies('Arceus-Bug').tier, 'Uber');
		assertStrictEqual(Dex.getExistingSpecies('Lurantis').tier, 'PU');
		assertStrictEqual(Dex.getExistingSpecies('Lurantis-Totem').tier, 'PU');
		*/
		assertStrictEqual(Dex.getDex('gen1').getExistingSpecies('Togetic').tier, 'Illegal');

		// moves
		assertStrictEqual(Dex.getDex('gen6').getExistingMove('Baddy Bad').isNonstandard, 'Future');
		assertStrictEqual(Dex.getDex('gen7').getExistingMove('Baddy Bad').isNonstandard, 'LGPE');

		// other in-game data
		for (let i = 0; i < Dex.data.Badges.length; i++) {
			assert(Dex.data.Badges.indexOf(Dex.data.Badges[i]) === i, "Duplicate badge " + Dex.data.Badges[i]);
		}

		for (let i = 0; i < Dex.data.Characters.length; i++) {
			assert(Dex.data.Characters.indexOf(Dex.data.Characters[i]) === i, "Duplicate Character " + Dex.data.Characters[i]);
		}

		const categoryKeys = Object.keys(Dex.data.Categories);
		for (let i = 0; i < categoryKeys.length; i++) {
			assert(toID(categoryKeys[i]) === categoryKeys[i], categoryKeys[i] + " should be an ID in categories.js");
			assert(categoryKeys.indexOf(categoryKeys[i]) === i, "Duplicate category for " + categoryKeys[i]);
		}
	});
	it('should support OMoTM# aliases', () => {
		assert(Dex.getFormat('omotm'));
		if (Dex.omotms.length > 1) assert(Dex.getFormat('omotm2'));
	});
	it('should return proper values from getEvolutionLines()', () => {
		const pokemon = ['Charmander', 'Charmeleon', 'Charizard'];
		for (let i = 0; i < pokemon.length; i++) {
			const evolutionLines = Dex.getEvolutionLines(Dex.getExistingSpecies(pokemon[i]));
			assertStrictEqual(evolutionLines.length, 1);
			assertStrictEqual(evolutionLines[0].join(","), 'Charmander,Charmeleon,Charizard');
		}

		let evolutionLines = Dex.getEvolutionLines(Dex.getExistingSpecies('Ditto'));
		assertStrictEqual(evolutionLines.length, 1);
		assertStrictEqual(evolutionLines[0].join(','), 'Ditto');

		evolutionLines = Dex.getEvolutionLines(Dex.getExistingSpecies('Gloom'));
		assertStrictEqual(evolutionLines.length, 2);
		assertStrictEqual(evolutionLines[0].join(","), 'Oddish,Gloom,Vileplume');
		assertStrictEqual(evolutionLines[1].join(","), 'Oddish,Gloom,Bellossom');
		evolutionLines = Dex.getEvolutionLines(Dex.getExistingSpecies('Vileplume'));
		assertStrictEqual(evolutionLines.length, 1);
		assertStrictEqual(evolutionLines[0].join(","), 'Oddish,Gloom,Vileplume');
		evolutionLines = Dex.getEvolutionLines(Dex.getExistingSpecies('Bellossom'));
		assertStrictEqual(evolutionLines.length, 1);
		assertStrictEqual(evolutionLines[0].join(","), 'Oddish,Gloom,Bellossom');

		evolutionLines = Dex.getEvolutionLines(Dex.getExistingSpecies('Tyrogue'));
		assertStrictEqual(evolutionLines.length, 3);
		assertStrictEqual(evolutionLines[0].join(","), 'Tyrogue,Hitmonlee');
		assertStrictEqual(evolutionLines[1].join(","), 'Tyrogue,Hitmonchan');
		assertStrictEqual(evolutionLines[2].join(","), 'Tyrogue,Hitmontop');
	});
	it('should return proper values from isEvolutionFamily()', () => {
		assert(Dex.isEvolutionFamily(['Charmander', 'Charmeleon', 'Charizard']));
		assert(Dex.isEvolutionFamily(['Charmander', 'Charmeleon']));
		assert(Dex.isEvolutionFamily(['Charmeleon', 'Charizard']));
		assert(Dex.isEvolutionFamily(['Charmander', 'Charizard']));
		assert(Dex.isEvolutionFamily(['Charmander']));
		assert(Dex.isEvolutionFamily(['Charmeleon']));
		assert(Dex.isEvolutionFamily(['Charizard']));
		assert(!Dex.isEvolutionFamily(['Bulbasaur', 'Charmeleon', 'Charizard']));
		assert(Dex.isEvolutionFamily(['Tyrogue', 'Hitmonlee']));
		assert(Dex.isEvolutionFamily(['Tyrogue', 'Hitmonchan']));
		assert(Dex.isEvolutionFamily(['Tyrogue', 'Hitmontop']));
		assert(!Dex.isEvolutionFamily(['Tyrogue', 'Hitmonlee', 'Hitmonchan']));
		assert(Dex.isEvolutionFamily(['Oddish', 'Gloom', 'Vileplume']));
		assert(Dex.isEvolutionFamily(['Oddish', 'Gloom', 'Bellossom']));
		assert(Dex.isEvolutionFamily(['Oddish', 'Vileplume']));
		assert(Dex.isEvolutionFamily(['Oddish', 'Bellossom']));
	});
	it('should return proper values from getList methods', () => {
		const abilities = Dex.getAbilitiesList().map(x => x.name);
		const items = Dex.getItemsList().map(x => x.name);
		const moves = Dex.getMovesList().map(x => x.name);
		const pokemon = Dex.getSpeciesList().map(x => x.name);

		assert(!abilities.includes(Dex.getExistingAbility('No Ability').name));

		// LGPE/CAP/Glitch/Pokestar
		assert(!abilities.includes(Dex.getExistingAbility('Mountaineer').name));
		assert(!items.includes(Dex.getExistingItem('Crucibellite').name));
		assert(!moves.includes(Dex.getExistingMove('Baddy Bad').name));
		assert(!moves.includes(Dex.getExistingMove('Paleo Wave').name));
		assert(!pokemon.includes(Dex.getExistingSpecies('Pikachu-Starter').name));
		assert(!pokemon.includes(Dex.getExistingSpecies('Voodoom').name));
		assert(!pokemon.includes(Dex.getExistingSpecies('Missingno.').name));
		assert(!pokemon.includes(Dex.getExistingSpecies('Pokestar Smeargle').name));

		// not available in Sword/Shield
		assert(items.includes(Dex.getExistingItem('Abomasite').name));
		assert(moves.includes(Dex.getExistingMove('Aeroblast').name));
		assert(pokemon.includes(Dex.getExistingSpecies('Bulbasaur').name));

		// available in Sword/Shield
		assert(abilities.includes(Dex.getExistingAbility('Intimidate').name));
		assert(items.includes(Dex.getExistingItem('Choice Scarf').name));
		assert(moves.includes(Dex.getExistingMove('Tackle').name));
		assert(pokemon.includes(Dex.getExistingSpecies('Charmander').name));
	});
});
