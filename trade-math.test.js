import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calculateProfitLoss,
  calculateRiskMetrics,
  applyAccountBalanceTransaction,
  recalculateAccountBalanceFromTransactions,
} from './trade-math.js';
import {
  validateLockerRules,
  enforceLockerRuleOnTrade,
} from './trade-locker.js';
import {
  validateTransactionInput,
} from './transaction-validation.js';
import {
  validateAffirmationInput,
} from './affirmation-validation.js';
import {
  validateProfileInput,
  validateObjectivesInput,
  validateAccountSetupInput,
} from './profile-validation.js';

test('calculateProfitLoss for a long EUR/USD trade is correct', () => {
  const result = calculateProfitLoss(1.1000, 1.1050, 1, 'EUR/USD', 'long');
  assert.equal(result, 500);
});

test('calculateProfitLoss for a short EUR/USD trade is correct', () => {
  const result = calculateProfitLoss(1.1000, 1.0950, 1, 'EUR/USD', 'short');
  assert.equal(result, 500);
});

test('calculateProfitLoss for an index trade uses point value and lot size', () => {
  const result = calculateProfitLoss(6500, 6520, 1, 'US30', 'long');
  assert.equal(result, 20);
});

test('risk metrics use absolute risk and reward ratios', () => {
  const result = calculateRiskMetrics(1.1000, 1.0970, 1.1060, 1, 'EUR/USD', 'long');
  assert.deepEqual(result, {
    riskAmount: 300,
    rewardAmount: 600,
    riskPercent: 3,
    rewardRiskRatio: 2,
  });
});

test('account deposits and withdrawals update the balance deterministically', () => {
  assert.equal(applyAccountBalanceTransaction(10000, 'deposit', 250), 10250);
  assert.equal(applyAccountBalanceTransaction(10000, 'withdrawal', 250), 9750);
});

test('withdrawals cannot exceed available balance', () => {
  assert.throws(() => applyAccountBalanceTransaction(100, 'withdrawal', 101), /cannot exceed available balance/i);
});

test('recalculated account balance matches the sum of transactions', () => {
  const transactions = [
    { type: 'deposit', amount: 250 },
    { type: 'withdrawal', amount: 100 },
    { type: 'deposit', amount: 50 },
  ];
  assert.equal(recalculateAccountBalanceFromTransactions(1000, transactions), 1200);
});

test('locker validation flags invalid lock rules', () => {
  const errors = validateLockerRules({ maxLoss: 600, dailyLoss: 300, profitTarget: 600, maxConsecutiveLosses: -1 }, {
    maxLossTarget: 500,
    dailyLossTarget: 250,
    profitTarget: 500,
    tradingDaysTarget: 2,
  });

  assert.ok(errors.includes('Maximum Loss must be less than or equal to your objective max loss.'));
  assert.ok(errors.includes('Daily Loss Limit must be less than or equal to your objective daily loss.'));
  assert.ok(errors.includes('Profit Target must be less than or equal to your objective profit target.'));
  assert.ok(errors.includes('Max Consecutive Losses must be zero or higher.'));
});

test('locker enforcement blocks trades beyond defined limits', () => {
  const account = {
    tradeLocker: {
      enabled: true,
      rules: {
        maxLoss: 100,
        dailyLoss: 50,
        profitTarget: 50,
        maxConsecutiveLosses: 3,
      },
    },
    objectives: {
      maxLossTarget: 500,
      dailyLossTarget: 250,
      profitTarget: 500,
      tradingDaysTarget: 2,
    },
  };

  const blocked = enforceLockerRuleOnTrade({ riskAmount: 150, profit: 80 }, account);
  assert.equal(blocked.allowed, false);
  assert.match(blocked.message, /max loss/i);
});

test('transaction validation reports clear errors without using alerts', () => {
  const invalidAmount = validateTransactionInput({
    amount: 0,
    date: '',
    type: 'deposit',
    currentBalance: 1000,
  });
  assert.equal(invalidAmount.valid, false);
  assert.match(invalidAmount.message, /valid amount/i);

  const invalidWithdrawal = validateTransactionInput({
    amount: 2000,
    date: '2026-08-25',
    type: 'withdrawal',
    currentBalance: 1000,
  });
  assert.equal(invalidWithdrawal.valid, false);
  assert.match(invalidWithdrawal.message, /cannot exceed available balance/i);

  const validDeposit = validateTransactionInput({
    amount: 250,
    date: '2026-08-25',
    type: 'deposit',
    currentBalance: 1000,
  });
  assert.equal(validDeposit.valid, true);
});

test('affirmation validation produces toast-friendly error messages', () => {
  const emptyText = validateAffirmationInput({ text: '', category: 'confidence' });
  assert.equal(emptyText.valid, false);
  assert.match(emptyText.message, /affirmation text/i);

  const tooLong = validateAffirmationInput({
    text: 'A'.repeat(201),
    category: 'confidence',
  });
  assert.equal(tooLong.valid, false);
  assert.match(tooLong.message, /200 characters or less/i);

  const valid = validateAffirmationInput({
    text: 'I can stay calm and focused.',
    category: 'confidence',
  });
  assert.equal(valid.valid, true);
});

test('profile, objective, and account setup validation produce clear errors', () => {
  const emptyProfile = validateProfileInput({ fullName: '' });
  assert.equal(emptyProfile.valid, false);
  assert.match(emptyProfile.message, /full name/i);

  const invalidObjectives = validateObjectivesInput({ maxLoss: NaN, dailyLoss: 200, profitTarget: 300, tradingDays: 0 });
  assert.equal(invalidObjectives.valid, false);
  assert.match(invalidObjectives.message, /valid numbers/i);

  const invalidAccount = validateAccountSetupInput({ balance: 0, currency: 'USD' });
  assert.equal(invalidAccount.valid, false);
  assert.match(invalidAccount.message, /valid balance/i);

  const validAccount = validateAccountSetupInput({ balance: 2500, currency: 'USD', riskPerTrade: 1, leverage: 50 });
  assert.equal(validAccount.valid, true);
});
