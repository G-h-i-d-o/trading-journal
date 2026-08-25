const DEFAULT_ACCOUNT_SIZE = 10000;

export function getInstrumentType(symbol) {
  const raw = String(symbol || '').trim();
  if (!raw) return 'forex';

  const volatilityIndices = [
    'Volatility 10 Index', 'Volatility 25 Index', 'Volatility 50 Index',
    'Volatility 75 Index', 'Volatility 100 Index',
    'Volatility 10 (1s) Index', 'Volatility 25 (1s) Index', 'Volatility 50 (1s) Index',
    'Volatility 75 (1s) Index', 'Volatility 100 (1s) Index',
    'Volatility 200 Index', 'Volatility 300 Index'
  ];
  const boomCrashIndices = [
    'Boom 50 Index', 'Boom 100 Index', 'Boom 300 Index', 'Boom 500 Index',
    'Boom 600 Index', 'Boom 900 Index', 'Boom 1000 Index',
    'Crash 50 Index', 'Crash 100 Index', 'Crash 300 Index', 'Crash 500 Index',
    'Crash 600 Index', 'Crash 900 Index', 'Crash 1000 Index'
  ];
  const jumpIndices = [
    'Jump 10 Index', 'Jump 25 Index', 'Jump 50 Index', 'Jump 75 Index',
    'Jump 100 Index', 'Jump 150 Index', 'Jump 200 Index'
  ];
  const rangeBreakIndices = [
    'Range Break 50 Index', 'Range Break 100 Index', 'Range Break 200 Index'
  ];
  const stepIndices = [
    'Step Index', 'Step 200 Index', 'Step 300 Index', 'Step 400 Index', 'Step 500 Index'
  ];
  const mixedIndices = [
    'Bear Market Index', 'Bull Market Index',
    'Drift Switch 10 Index', 'Drift Switch 20 Index', 'Drift Switch 30 Index'
  ];
  const syntheticIndices = [
    ...volatilityIndices, ...boomCrashIndices, ...jumpIndices,
    ...rangeBreakIndices, ...stepIndices, ...mixedIndices
  ];
  const forexPairs = [
    'EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CHF', 'AUD/USD', 'USD/CAD', 'NZD/USD',
    'EUR/GBP', 'EUR/JPY', 'GBP/JPY', 'AUD/JPY', 'AUD/CAD', 'AUD/CHF', 'AUD/NZD',
    'CAD/JPY', 'CHF/JPY', 'EUR/AUD', 'EUR/CAD', 'EUR/CHF', 'EUR/NZD',
    'GBP/AUD', 'GBP/CAD', 'GBP/CHF', 'GBP/NZD', 'NZD/CAD', 'NZD/CHF', 'NZD/JPY',
    'USD/MXN', 'USD/ZAR', 'USD/SEK', 'USD/NOK', 'USD/SGD', 'USD/HKD'
  ];
  const traditionalIndices = ['US30', 'SPX500', 'NAS100', 'GE30', 'FTSE100', 'NIKKEI225', 'AUS200', 'ESTX50', 'FRA40', 'ESP35', 'HKG50'];
  const commodities = ['Gold', 'Silver', 'Oil', 'Brent', 'Natural Gas', 'Palladium', 'Platinum'];
  const smartTrader = [
    'Rise/Fall', 'Higher/Lower', 'Touch/No Touch', 'Ends Between/Out',
    'Stays Between/Goes Out', 'Asians', 'Digits', 'Lookbacks',
    'Reset Call/Put', 'Call/Put Spreads', 'Multipliers', 'Even/Odd',
    'Over/Under', 'Turbos', 'Vanillas'
  ];
  const accumulator = ['Accumulator Up', 'Accumulator Down'];

  if (forexPairs.includes(raw)) return 'forex';
  if (traditionalIndices.includes(raw)) return 'indices';
  if (syntheticIndices.includes(raw)) return 'synthetic';
  if (commodities.includes(raw)) return 'commodities';
  if (smartTrader.includes(raw)) return 'smarttrader';
  if (accumulator.includes(raw)) return 'accumulator';
  if (raw.includes('Index')) return 'synthetic';
  return 'forex';
}

export function getPipSize(symbol) {
  return String(symbol || '').includes('JPY') ? 0.01 : 0.0001;
}

export function getPointValue(symbol) {
  const points = {
    US30: 1,
    SPX500: 50,
    NAS100: 20,
    GE30: 5,
    FTSE100: 5,
    NIKKEI225: 100,
    AUS200: 1,
    ESTX50: 5,
    FRA40: 5,
    ESP35: 5,
    HKG50: 1,
    Gold: 100,
    Silver: 5000,
    Oil: 1000,
    Brent: 1000,
    'Natural Gas': 10000,
    Palladium: 1000,
    Platinum: 1000,
  };
  return points[String(symbol || '')] ?? 1;
}

export function calculateProfitLoss(entry, exit, lotSize, symbol, type) {
  const normalizedEntry = Number(entry);
  const normalizedExit = Number(exit);
  const normalizedLotSize = Number(lotSize);
  const tradeType = String(type || '').toLowerCase();

  if (!Number.isFinite(normalizedEntry) || !Number.isFinite(normalizedExit) || !Number.isFinite(normalizedLotSize)) {
    throw new Error('Trade values must be finite numbers.');
  }

  const instrumentType = getInstrumentType(symbol);
  const pointValue = getPointValue(symbol);

  let profit;

  if (instrumentType === 'forex') {
    const pipValue = 10 * normalizedLotSize;
    const pipSize = getPipSize(symbol);
    const pips = tradeType === 'long' ? (normalizedExit - normalizedEntry) / pipSize : (normalizedEntry - normalizedExit) / pipSize;
    profit = pips * pipValue;
  } else if (instrumentType === 'synthetic' || instrumentType === 'indices' || instrumentType === 'commodities') {
    const points = tradeType === 'long' ? (normalizedExit - normalizedEntry) : (normalizedEntry - normalizedExit);
    profit = points * pointValue * normalizedLotSize;
  } else if (instrumentType === 'smarttrader') {
    const payout = 0.8;
    profit = tradeType === 'long' ? normalizedLotSize * payout : -normalizedLotSize;
  } else if (instrumentType === 'accumulator') {
    const points = tradeType === 'long' ? (normalizedExit - normalizedEntry) : (normalizedEntry - normalizedExit);
    profit = points * normalizedLotSize * 2;
  } else {
    const points = tradeType === 'long' ? (normalizedExit - normalizedEntry) : (normalizedEntry - normalizedExit);
    profit = points * pointValue * normalizedLotSize;
  }

  return Number(profit.toFixed(2));
}

export function calculateRiskMetrics(entry, stopLoss, takeProfit, lotSize, symbol, type) {
  const tradeType = String(type || '').toLowerCase();
  const accountSize = DEFAULT_ACCOUNT_SIZE;
  const riskAmount = Math.abs(calculateProfitLoss(entry, stopLoss, lotSize, symbol, tradeType));
  const rewardAmount = Math.abs(calculateProfitLoss(entry, takeProfit, lotSize, symbol, tradeType));
  const riskPercent = accountSize > 0 ? (riskAmount / accountSize) * 100 : 0;
  const rewardRiskRatio = riskAmount > 0 ? rewardAmount / riskAmount : 0;

  return {
    riskAmount: Number(riskAmount.toFixed(2)),
    rewardAmount: Number(rewardAmount.toFixed(2)),
    riskPercent: Number(riskPercent.toFixed(2)),
    rewardRiskRatio: Number(rewardRiskRatio.toFixed(2)),
  };
}

export function applyAccountBalanceTransaction(currentBalance, type, amount) {
  const normalizedBalance = Number(currentBalance);
  const normalizedAmount = Number(amount);
  const transactionType = String(type || '').toLowerCase();

  if (!Number.isFinite(normalizedBalance) || !Number.isFinite(normalizedAmount)) {
    throw new Error('Balance and amount must be finite numbers.');
  }

  if (transactionType !== 'deposit' && transactionType !== 'withdrawal') {
    throw new Error('Transaction type must be "deposit" or "withdrawal".');
  }

  if (transactionType === 'withdrawal' && normalizedAmount > normalizedBalance) {
    throw new Error('Withdrawal amount cannot exceed available balance.');
  }

  const nextBalance = transactionType === 'deposit' ? normalizedBalance + normalizedAmount : normalizedBalance - normalizedAmount;
  return Number(nextBalance.toFixed(2));
}

export function recalculateAccountBalanceFromTransactions(startingBalance, transactions = []) {
  const initialBalance = Number(startingBalance);
  if (!Number.isFinite(initialBalance)) {
    throw new Error('Starting balance must be a finite number.');
  }

  return Number(
    (transactions || []).reduce((runningTotal, transaction) => {
      const type = String(transaction?.type || '').toLowerCase();
      const amount = Number(transaction?.amount || 0);

      if (!Number.isFinite(amount)) {
        throw new Error('Transaction amount must be finite.');
      }

      if (type === 'deposit') {
        return runningTotal + amount;
      }
      if (type === 'withdrawal') {
        return runningTotal - amount;
      }
      return runningTotal;
    }, initialBalance).toFixed(2)
  );
}
