import assert from 'node:assert/strict';
import { normalizeAccount, readCachedAccounts, persistAccountCache } from './account-storage.js';
import { ensureToastContainer, showToast } from './ui-feedback.js';

const memory = {};
const storage = {
  getItem(key) {
    return Object.prototype.hasOwnProperty.call(memory, key) ? memory[key] : null;
  },
  setItem(key, value) {
    memory[key] = String(value);
  }
};

const normalized = normalizeAccount({ balance: '', currency: 'BAD', name: '  Test  ', objectives: { profitTarget: 123 } }, 'user-1');
assert.equal(normalized.currency, 'USD');
assert.equal(normalized.balance, 10000);
assert.equal(normalized.name, 'Test');
assert.equal(normalized.objectives.profitTarget, 123);
assert.equal(normalized.userId, 'user-1');

storage.setItem('userAccounts', JSON.stringify([{ name: 'Demo', balance: 3000, currency: 'EUR' }]));
const cached = readCachedAccounts(storage);
assert.equal(cached.length, 1);
assert.equal(cached[0].currency, 'EUR');
assert.equal(cached[0].balance, 3000);

const persistTarget = {
  getItem() { return null; },
  setItem(key, value) {
    console.log('persist called', key, String(value).length);
  }
};
const persisted = persistAccountCache([{ name: 'X', balance: 55 }], persistTarget);
assert.equal(persisted[0].balance, 55);
assert.equal(persisted[0].currency, 'USD');

global.document = {
  body: { appendChild() {} },
  createElement(tag) {
    return {
      tagName: tag,
      className: '',
      textContent: '',
      style: {},
      classList: { add() {}, remove() {} },
      appendChild() {},
      setAttribute() {}
    };
  }
};
global.window = { setTimeout(fn) { fn(); return 1; } };

const container = ensureToastContainer();
assert.ok(container);
assert.equal(container.id, 'global-toast-container');
showToast({ message: 'Saved', type: 'success', duration: 1 });

console.log('smoke-tests: PASS');
