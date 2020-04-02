function arrayToRoomIds(array: string[]): string[] {
	return array.map(x => Tools.toRoomId(x));
}

function arrayToIds(array: string[]): string[] {
	return array.map(x => toID(x));
}

function objectKeysToRoomId<T>(object: Dict<T>): Dict<T> {
	for (const i in object) {
		const id = Tools.toRoomId(i);
		if (id !== i) {
			object[id] = object[i];
			delete object[i];
		}
	}

	return object;
}

function stringObjectToRoomIds(object: Dict<string>): Dict<string> {
	for (const i in object) {
		object[i] = Tools.toRoomId(object[i]);
	}

	return object;
}

function stringArrayObjectToRoomIds(object: Dict<string[]>): Dict<string[]> {
	for (const i in object) {
		object[i] = arrayToRoomIds(object[i]);
	}

	return object;
}

function stringArrayObjectToIds(object: Dict<string[]>): Dict<string[]> {
	for (const i in object) {
		object[i] = arrayToIds(object[i]);
	}

	return object;
}

export function load(config: typeof Config): typeof Config {
	if (global.tempConfig && config.tempConfig) {
		Object.assign(config, config.tempConfig);
	}

	if (config.developers) config.developers = config.developers.map(x => toID(x));

	if (config.rooms) config.rooms = config.rooms.map(x => Tools.toRoomId(x));
	if (config.roomAliases) config.roomAliases = objectKeysToRoomId(stringObjectToRoomIds(config.roomAliases));

	if (config.awardedBotGreetingDurations) objectKeysToRoomId(config.awardedBotGreetingDurations);

	return config;
}
