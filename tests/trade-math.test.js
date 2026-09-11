import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calculateProfitLoss,
  calculateRiskMetrics,
  applyAccountBalanceTransaction,
  recalculateAccountBalanceFromTransactions,
} from '../src/trade-math.js';
import {
  validateLockerRules,
  enforceLockerRuleOnTrade,
} from '../src/trade-locker.js';
import {
  validateTransactionInput,
} from '../src/transaction-validation.js';
import {
  validateAffirmationInput,
} from '../src/affirmation-validation.js';
import {
  validateProfileInput,
  validateObjectivesInput,
  validateAccountSetupInput,
} from '../src/profile-validation.js';
import { normalizeScreenshotUrl, isRenderableImageUrl } from '../src/screenshot-utils.js';
import {
  filterTransactions,
  paginateTransactions,
} from '../src/transaction-history.js';
import {
  generateSyntheticCandles,
  runBacktest,
  openReplayPosition,
  closeReplayPosition,
  calculateReplaySummary,
  calculateMovingAverage,
  buildReplayMarkers,
} from '../src/backtesting-engine.js';
import {
  aggregateHistoricalCandles,
  loadHistoricalCandles,
  validateHistoricalCandles,
} from '../src/backtest-data.js';
import {
  getBacktestSessionStorageKey,
  normalizeBacktestSession,
  readBacktestSessions,
  writeBacktestSessions,
} from '../src/backtest-session.js';

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

test('transaction filtering and pagination keep lists concise and predictable', () => {
  const transactions = [
    { id: '1', type: 'deposit', amount: 100 },
    { id: '2', type: 'withdrawal', amount: 50 },
    { id: '3', type: 'deposit', amount: 75 },
    { id: '4', type: 'withdrawal', amount: 30 },
    { id: '5', type: 'deposit', amount: 20 },
    { id: '6', type: 'deposit', amount: 10 },
  ];

  const filteredDeposits = filterTransactions(transactions, 'deposit');
  assert.deepEqual(filteredDeposits.map((tx) => tx.id), ['1', '3', '5', '6']);

  const pageOne = paginateTransactions(transactions, 1, 5);
  assert.equal(pageOne.items.length, 5);
  assert.equal(pageOne.totalPages, 2);
  assert.deepEqual(pageOne.items.map((tx) => tx.id), ['1', '2', '3', '4', '5']);

  const pageTwo = paginateTransactions(transactions, 2, 5);
  assert.deepEqual(pageTwo.items.map((tx) => tx.id), ['6']);
});

test('backtesting engine enforces a no-lookahead trading model and returns deterministic results', () => {
  const candles = generateSyntheticCandles({
    symbol: 'EURUSD',
    startDate: '2024-01-01T00:00:00Z',
    totalBars: 60,
    drift: 0.0005,
    volatility: 0.0012,
  });

  const result = runBacktest({
    candles,
    initialCapital: 10000,
    riskPerTrade: 0.1,
    strategy: 'sma-crossover',
  });

  assert.ok(Array.isArray(result.trades));
  assert.ok(result.summary.totalTrades >= 0);
  assert.ok(Number.isFinite(result.summary.netPnL));
  assert.ok(result.equityCurve.length >= 1);

  result.trades.forEach((trade) => {
    assert.ok(trade.entryIndex < trade.exitIndex, 'trade must not use future candles to exit before entering');
    assert.ok(trade.entryPrice > 0 && trade.exitPrice > 0, 'trade pricing must be valid');
  });
});

test('backtesting execution costs reduce results deterministically', () => {
  const candles = generateSyntheticCandles({
    symbol: 'EURUSD',
    totalBars: 120,
    drift: 0.0008,
    volatility: 0.0015,
  });
  const noCostResult = runBacktest({
    candles,
    initialCapital: 10000,
    riskPerTrade: 1,
    execution: { spreadBps: 0, slippageBps: 0, commissionPerUnit: 0 },
  });
  const costResult = runBacktest({
    candles,
    initialCapital: 10000,
    riskPerTrade: 1,
    execution: { spreadBps: 20, slippageBps: 10, commissionPerUnit: 0.01 },
  });

  assert.equal(costResult.trades.length, noCostResult.trades.length);
  assert.ok(costResult.summary.netPnL <= noCostResult.summary.netPnL);
  assert.ok(costResult.trades.every((trade) => trade.commission >= 0));
});

test('backtesting engine supports short trades and marks open positions to market', () => {
  const candles = [];
  for (let index = 0; index < 30; index += 1) {
    const close = index < 15 ? 100 + index : 115 - ((index - 15) * 0.5);
    candles.push({
      symbol: 'US30',
      time: new Date(Date.UTC(2024, 0, 1, index)).toISOString(),
      open: close,
      high: close + 1,
      low: close - 1,
      close,
      volume: 1000,
    });
  }
  const result = runBacktest({
    candles,
    initialCapital: 10000,
    riskPerTrade: 1,
    execution: { spreadBps: 0, slippageBps: 0 },
  });

  assert.ok(result.equityCurve.every((point) => Number.isFinite(point.equity)));
  assert.ok(result.summary.openPositionPnl !== undefined);
  assert.equal(result.openPosition?.side, 'short');
  assert.equal(result.openPosition?.exitIndex, undefined);
});

test('historical data layer validates, filters, and aggregates timeframe candles', async () => {
  const candles = await loadHistoricalCandles({
    symbol: 'EURUSD',
    timeframe: '4H',
    startDate: '2024-01-01T00:00:00Z',
    totalBars: 12,
  });
  assert.equal(candles.length, 12);
  assert.ok(candles.every((candle) => candle.symbol === 'EURUSD'));

  const normalized = validateHistoricalCandles([
    { symbol: 'US30', time: '2024-01-01T00:00:00Z', open: 100, high: 105, low: 98, close: 103, volume: 10 },
    { symbol: 'US30', time: '2024-01-01T01:00:00Z', open: 103, high: 108, low: 101, close: 106, volume: 12 },
  ]);
  const aggregated = aggregateHistoricalCandles(normalized, '4H');
  assert.equal(aggregated.length, 1);
  assert.deepEqual(aggregated[0], {
    symbol: 'US30',
    time: '2024-01-01T00:00:00.000Z',
    open: 100,
    high: 108,
    low: 98,
    close: 106,
    volume: 22,
  });
});

test('historical data layer rejects invalid OHLCV data', () => {
  assert.throws(() => validateHistoricalCandles([
    { symbol: 'EURUSD', time: '2024-01-01T00:00:00Z', open: 1.1, high: 1.05, low: 1.0, close: 1.02, volume: 1 },
  ]), /invalid ohlc relationship/i);
});

test('manual replay trades share execution accounting with backtest trades', () => {
  const candles = generateSyntheticCandles({ symbol: 'EURUSD', totalBars: 2 });
  const position = openReplayPosition({
    candle: candles[0],
    side: 'long',
    equity: 10000,
    riskPerTrade: 1,
    execution: { spreadBps: 0, slippageBps: 0, commissionPerUnit: 0 },
  });
  assert.ok(position);
  position.entryIndex = 0;
  const trade = closeReplayPosition({
    position,
    candle: candles[1],
    exitIndex: 1,
    execution: { spreadBps: 0, slippageBps: 0, commissionPerUnit: 0 },
  });
  assert.equal(trade.exitIndex, 1);
  assert.equal(trade.entryPrice, candles[0].close);
  assert.equal(trade.exitPrice, candles[1].close);
  const summary = calculateReplaySummary({ initialCapital: 10000, trades: [trade], candle: candles[1] });
  assert.equal(summary.totalTrades, 1);
  assert.equal(summary.netPnL, trade.netPnL);
  assert.equal(summary.endCapital, 10000 + trade.netPnL);
});

test('backtest sessions are versioned, user-scoped, and sanitized', () => {
  const memory = new Map();
  const storage = {
    getItem(key) { return memory.get(key) ?? null; },
    setItem(key, value) { memory.set(key, String(value)); },
  };
  const session = normalizeBacktestSession({
    id: 'session-1',
    name: '<img src=x onerror=alert(1)>',
    state: {
      candles: [{ symbol: 'EURUSD', time: '2024-01-01T00:00:00Z', open: 1, high: 2, low: 0.5, close: 1.5, volume: 10 }],
      currentIndex: 0,
      initialCapital: 10000,
      trades: [],
    },
    form: { symbol: 'EURUSD', timeframe: '1H', bars: 30 },
  });
  assert.equal(session.name, '<img src=x onerror=alert(1)>');
  assert.equal(writeBacktestSessions([session], storage, 'user-a'), true);
  assert.equal(readBacktestSessions(storage, 'user-a').length, 1);
  assert.equal(readBacktestSessions(storage, 'user-b').length, 0);
  const envelope = JSON.parse(memory.get(getBacktestSessionStorageKey('user-a')));
  assert.equal(envelope.version, 1);
  assert.equal(envelope.sessions[0].name, session.name);
});

test('backtest session storage ignores malformed records and handles corrupt JSON', () => {
  const memory = new Map();
  const storage = {
    getItem(key) { return memory.get(key) ?? null; },
    setItem(key, value) { memory.set(key, String(value)); },
  };
  memory.set(getBacktestSessionStorageKey('user-a'), JSON.stringify({ version: 1, sessions: [{ id: 'bad', name: 'bad' }] }));
  assert.deepEqual(readBacktestSessions(storage, 'user-a'), []);
  memory.set(getBacktestSessionStorageKey('user-a'), '{not-json');
  assert.deepEqual(readBacktestSessions(storage, 'user-a'), []);
});

test('legacy backtest sessions migrate to the user-scoped key', () => {
  const memory = new Map();
  const storage = {
    getItem(key) { return memory.get(key) ?? null; },
    setItem(key, value) { memory.set(key, String(value)); },
    removeItem(key) { memory.delete(key); },
  };
  const legacySession = {
    id: 'legacy-1',
    name: 'Legacy replay',
    state: { candles: [{ symbol: 'EURUSD', time: '2024-01-01T00:00:00Z', open: 1, high: 2, low: 0.5, close: 1.5, volume: 1 }] },
  };
  memory.set('backtestSessions', JSON.stringify([legacySession]));
  assert.equal(readBacktestSessions(storage, 'user-a').length, 1);
  assert.equal(memory.has('backtestSessions'), false);
  assert.equal(memory.has(getBacktestSessionStorageKey('user-a')), true);
});

test('chart helpers build moving averages and replay order markers', () => {
  const candles = generateSyntheticCandles({ symbol: 'EURUSD', totalBars: 6 });
  const movingAverage = calculateMovingAverage(candles, 3);
  assert.equal(movingAverage.length, 4);
  assert.equal(movingAverage[0].time, Math.floor(new Date(candles[2].time).getTime() / 1000));

  const markers = buildReplayMarkers({
    candles,
    trades: [{ side: 'long', entryIndex: 1, exitIndex: 4, netPnL: 12.5 }],
    position: { side: 'short', entryIndex: 5 },
  });
  assert.equal(markers.length, 3);
  assert.equal(markers[0].text, 'Long entry');
  assert.equal(markers[1].text, 'Exit +12.50');
  assert.equal(markers[2].text, 'Open short');
});

test('chart screenshot links normalize across chart providers and preserve share pages', () => {
  const gocharting = normalizeScreenshotUrl('https://gocharting.com/sh/3d8800d5-2686-4a5b-9535-1a0c57910a63');
  assert.equal(gocharting, 'https://gocharting.com/screenshots/3d8800d5-2686-4a5b-9535-1a0c57910a63.png');

  const tradingViewShare = normalizeScreenshotUrl('https://www.tradingview.com/x/abc123/');
  assert.equal(tradingViewShare, 'https://www.tradingview.com/x/abc123/');
  assert.equal(isRenderableImageUrl('https://gocharting.com/screenshots/example.png'), true);
  assert.equal(isRenderableImageUrl('https://www.tradingview.com/x/abc123/'), false);
});
