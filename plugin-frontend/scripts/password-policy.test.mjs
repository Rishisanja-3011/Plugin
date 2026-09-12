import test from 'node:test';
import assert from 'node:assert/strict';
import { isStrongPassword } from '../src/utils/passwordPolicy.js';
test('matches the server password policy', () => {
  assert.equal(isStrongPassword('Short1!'), false);
  assert.equal(isStrongPassword('LongPassword1'), false);
  assert.equal(isStrongPassword('LongPassword1!'), true);
  assert.equal(isStrongPassword('LongPassword1!' + 'é'.repeat(30)), false);
  assert.equal(isStrongPassword('LongPassword1!' + 'a'.repeat(58)), true);
  assert.equal(isStrongPassword('LongPassword1!' + 'a'.repeat(59)), false);
});
