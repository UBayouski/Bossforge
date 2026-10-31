import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCommand } from '../commands.mjs';
test('accepts exact build commands regardless of casing and surrounding whitespace', () => {
  assert.equal(parseCommand(' !ARMOR '), 'armor');
  assert.equal(parseCommand('!legs'), 'legs');
  assert.equal(parseCommand('!chaos'), 'chaos');
});
test('ordinary chat and command prefixes cannot accidentally contribute', () => {
  for (const text of ['armor', '!armored', '!legs please', 'hello !chaos', '', '!reset']) assert.equal(parseCommand(text), null);
});
