import fs = require('fs');
import path = require('path');
import stream = require('stream');

const rootFolder = path.resolve(__dirname, '..', '..');
const modulesDir = path.join(__dirname, 'modules');
const moduleTests = fs.readdirSync(modulesDir);
const configFile = path.join(rootFolder, 'built', 'config.js');
const pokedexMiniFile = path.join(rootFolder, 'data', 'pokedex-mini.js');
const pokedexMiniBWFile = path.join(rootFolder, 'data', 'pokedex-mini-bw.js');

// create needed files if running on Travis CI
if (!fs.existsSync(configFile)) {
	fs.writeFileSync(configFile, fs.readFileSync(path.join(rootFolder, 'built', 'config-example.js')));
}
if (!fs.existsSync(pokedexMiniFile)) {
	fs.writeFileSync(pokedexMiniFile, fs.readFileSync(path.join(rootFolder, 'data', 'pokedex-mini-base.js')));
}
if (!fs.existsSync(pokedexMiniBWFile)) {
	fs.writeFileSync(pokedexMiniBWFile, fs.readFileSync(path.join(rootFolder, 'data', 'pokedex-mini-bw-base.js')));
}

// eslint-disable-next-line @typescript-eslint/no-empty-function
const noOp = (): void => {};
const methodsToNoOp = ['appendFile', 'chmod', 'rename', 'rmdir', 'symlink', 'unlink', 'watchFile', 'writeFile'];
for (let i = 0; i < methodsToNoOp.length; i++) {
	// @ts-ignore
	fs[methodsToNoOp[i]] = noOp;
	// @ts-ignore
	fs[methodsToNoOp[i] + 'Sync'] = noOp;
}

Object.assign(fs, {createWriteStream() {
	return new stream.Writable();
}});

try {
	require(path.join(rootFolder, 'built', 'app.js'));
	clearInterval(Storage.globalDatabaseExportInterval);

	require(path.join(__dirname, 'pokemon-showdown'));

	const mochaRoom = Rooms.add('mocha');
	mochaRoom.title = 'Mocha';

	console.log("Loading data for tests...");
	Dex.loadData();

	for (let i = 0; i < moduleTests.length; i++) {
		require(path.join(modulesDir, moduleTests[i]));
	}
} catch (e) {
	console.log(e);
	process.exit(1);
}
