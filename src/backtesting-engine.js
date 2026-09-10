export function generateSyntheticCandles({
  symbol = 'EURUSD',
  startDate = '2024-01-01T00:00:00Z',
  totalBars = 60,
  drift = 0.0005,
  volatility = 0.0012,
} = {}) {
  const candles = [];
  const start = new Date(startDate).getTime();
  let previousClose = 1.1;

  for (let index = 0; index < totalBars; index += 1) {
    const timestamp = start + index * 60 * 60 * 1000;
    const change = (drift + (Math.sin(index / 3) * volatility)) * (index % 2 === 0 ? 1 : -1);
    const open = previousClose;
    const close = Math.max(0.0001, open * (1 + change));
    const high = Math.max(open, close) * (1 + volatility * 0.8);
    const low = Math.min(open, close) * (1 - volatility * 0.8);

    candles.push({
      symbol,
      time: new Date(timestamp).toISOString(),
      open,
      high,
      low,
      close,
      volume: 1000 + index * 25,
    });

    previousClose = close;
  }

  return candles;
}

export function buildReplaySeries({
  symbol = 'EURUSD',
  totalBars = 80,
  startDate = '2024-01-01T00:00:00Z',
  drift = 0.0004,
  volatility = 0.001,
} = {}) {
  return generateSyntheticCandles({ symbol, totalBars, startDate, drift, volatility });
}

export function createReplayState({
  candles = [],
  initialCapital = 10000,
  riskPerTrade = 0.1,
  strategy = 'sma-crossover',
} = {}) {
  const safeCandles = Array.isArray(candles) ? candles : [];
  return {
    candles: safeCandles,
    currentIndex: 0,
    playing: false,
    speed: 1,
    initialCapital,
    riskPerTrade,
    strategy,
    trades: [],
    equity: initialCapital,
    summary: {
      netPnL: 0,
      totalTrades: 0,
      returnPct: 0,
      endCapital: initialCapital,
    },
  };
}

export function advanceReplayState(state, steps = 1) {
  if (!state || !Array.isArray(state.candles) || state.candles.length === 0) {
    return state;
  }

  const nextIndex = Math.min(state.candles.length - 1, Math.max(0, state.currentIndex + steps));
  return {
    ...state,
    currentIndex: nextIndex,
  };
}

function calculateSma(values, period) {
  if (values.length < period) {
    return null;
  }

  const sliced = values.slice(-period);
  const sum = sliced.reduce((total, value) => total + value, 0);
  return sum / sliced.length;
}

export function runBacktest({
  candles = [],
  initialCapital = 10000,
  riskPerTrade = 0.1,
  strategy = 'sma-crossover',
} = {}) {
  const safeCandles = Array.isArray(candles) ? candles : [];
  const trades = [];
  let equity = initialCapital;
  let position = null;
  let entryIndex = null;
  let entryPrice = null;
  let entryTime = null;
  let strategyState = { shortTerm: null, longTerm: null };

  const closingTrades = [];

  for (let index = 0; index < safeCandles.length; index += 1) {
    const candle = safeCandles[index];
    const closes = safeCandles.slice(0, index + 1).map((bar) => bar.close);
    const shortSma = calculateSma(closes, 5);
    const longSma = calculateSma(closes, 10);

    strategyState.shortTerm = shortSma;
    strategyState.longTerm = longSma;

    if (!position && strategy === 'sma-crossover' && shortSma !== null && longSma !== null && shortSma > longSma) {
      const riskBudget = initialCapital * riskPerTrade;
      const quantity = Math.max(1, Math.floor(riskBudget / Math.max(candle.close * 0.01, 0.01)));
      position = { type: 'long', quantity, entryPrice: candle.close, entryIndex: index, entryTime: candle.time };
      entryIndex = index;
      entryPrice = candle.close;
      entryTime = candle.time;
      equity -= quantity * candle.close;
      continue;
    }

    if (position && strategy === 'sma-crossover' && shortSma !== null && longSma !== null && shortSma < longSma) {
      const exitPrice = candle.close;
      const grossPnL = (exitPrice - position.entryPrice) * position.quantity;
      const fees = 0;
      const netPnL = grossPnL - fees;
      equity += position.quantity * exitPrice;
      trades.push({
        type: 'long',
        entryIndex,
        exitIndex: index,
        entryPrice,
        exitPrice,
        entryTime,
        exitTime: candle.time,
        quantity: position.quantity,
        grossPnL,
        fees,
        netPnL,
      });
      closingTrades.push({
        equity,
        time: candle.time,
      });
      position = null;
      entryIndex = null;
      entryPrice = null;
      entryTime = null;
    }
  }

  const equityCurve = [];
  let equityTracker = initialCapital;
  for (let index = 0; index < safeCandles.length; index += 1) {
    const candle = safeCandles[index];
    const activeTrade = trades.find((trade) => trade.entryIndex <= index && trade.exitIndex > index);
    const price = candle.close;
    const runtimeEquity = activeTrade ? initialCapital + activeTrade.grossPnL : initialCapital;
    equityTracker = runtimeEquity;
    equityCurve.push({ time: candle.time, equity: equityTracker, price });
  }

  const netPnL = trades.reduce((total, trade) => total + trade.netPnL, 0);
  const summary = {
    startCapital: initialCapital,
    endCapital: equity,
    netPnL,
    totalTrades: trades.length,
    winningTrades: trades.filter((trade) => trade.netPnL > 0).length,
    losingTrades: trades.filter((trade) => trade.netPnL < 0).length,
    totalReturn: ((equity - initialCapital) / initialCapital) * 100,
  };

  return {
    symbol: safeCandles[0]?.symbol || 'EURUSD',
    trades,
    equityCurve,
    summary,
  };
}
