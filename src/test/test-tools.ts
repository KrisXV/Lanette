import nodeAssert = require('assert');

import { Room } from '../rooms';
import { User } from '../users';

const basePlayerName = 'Mocha Player';

export function getBasePlayerName(): string {
	return basePlayerName;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function assert(condition: any, message?: string | Error | undefined): asserts condition {
	nodeAssert(condition, message);
}

export function assertStrictEqual<T>(actual: T, expected: T, message?: string | Error | undefined): void {
	nodeAssert.strictEqual(actual, expected, message);
}

function checkClientSendQueue(startingSendQueueIndex: number, input: readonly string[]): string[] {
	const expected = input.slice();
	for (let i = startingSendQueueIndex; i < Client.sendQueue.length; i++) {
		if (Client.sendQueue[i] === expected[0]) {
			expected.shift();
		}
	}

	return expected;
}

export function assertClientSendQueue(startingSendQueueIndex: number, input: readonly string[]): void {
	const expected = checkClientSendQueue(startingSendQueueIndex, input);
	assert(expected.length === 0, "Not found in Client's send queue:\n\n" + expected.join("\n"));
}

export async function runCommand(command: string, target: string, room: Room | User, user: User | string): Promise<void> {
	if (typeof user === 'string') user = Users.add(user, toID(user));
	await CommandParser.parse(room, user, Config.commandCharacter + command + (target ? " " + target : ""));
}
