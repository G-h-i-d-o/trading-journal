export function generateSyntheticCandles({
  symbol = 'EURUSD',
  startDate = '2024-01-01T00:00:00Z',
  totalBars = 60,
  drift = 0.0005,
  volatility = 0.0012,
} = {}) {
  const candles = [];
  const start = new Date(startDate).getTime();
  const startingPrices = {
    EURUSD: 1.1,
    USDJPY: 145,
    XAUUSD: 2300,
    US30: 39000,
    NAS100: 18000,
  };
  let previousClose = startingPrices[symbol] || 1.1;

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

const DEFAULT_EXECUTION_CONFIG = {
  riskPerTradeIsPercent: true,
  spreadBps: 1,
  slippageBps: 0.5,
  commissionPerUnit: 0,
  positionRiskFraction: 0.01,
};

const INSTRUMENT_EXECUTION_CONFIG = {
  EURUSD: { tickSize: 0.00001, contractSize: 100000, spreadBps: 0.8 },
  USDJPY: { tickSize: 0.001, contractSize: 100000, spreadBps: 1.2 },
  XAUUSD: { tickSize: 0.01, contractSize: 100, spreadBps: 2 },
  US30: { tickSize: 1, contractSize: 1, spreadBps: 2 },
  NAS100: { tickSize: 1, contractSize: 1, spreadBps: 2 },
};

export function getInstrumentExecutionConfig(symbol, overrides = {}) {
  return {
    ...DEFAULT_EXECUTION_CONFIG,
    ...(INSTRUMENT_EXECUTION_CONFIG[symbol] || {}),
    ...overrides,
  };
}

function getExecutionPrice(price, side, config, isEntry) {
  const spread = price * (config.spreadBps / 10000);
  const slippage = price * (config.slippageBps / 10000);
  const direction = side === 'long' ? 1 : -1;
  const marketAdjustment = isEntry ? direction : -direction;
  return price + (spread / 2 + slippage) * marketAdjustment;
}

function calculatePositionQuantity({ equity, price, riskPerTrade, config }) {
  const riskFraction = config.riskPerTradeIsPercent ? riskPerTrade / 100 : riskPerTrade;
  const riskBudget = Math.max(0, equity) * Math.max(0, riskFraction);
  const notionalPerUnit = Math.max(price * config.positionRiskFraction, config.tickSize || 0.00001);
  return Math.max(0, Math.floor(riskBudget / notionalPerUnit));
}

function calculateTradePnl(position, exitPrice, config) {
  const priceMove = position.side === 'long'
    ? exitPrice - position.entryPrice
    : position.entryPrice - exitPrice;
  const grossPnl = priceMove * position.quantity * (config.contractSize || 1);
  const commission = (position.quantity + position.quantity) * config.commissionPerUnit;
  return { grossPnl, commission, netPnl: grossPnl - commission };
}

function closePosition(position, candle, config, index) {
  const exitPrice = getExecutionPrice(candle.close, position.side, config, false);
  const pnl = calculateTradePnl(position, exitPrice, config);
  return {
    ...position,
    exitIndex: index,
    exitPrice,
    exitTime: candle.time,
    grossPnl: pnl.grossPnl,
    commission: pnl.commission,
    fees: pnl.commission,
    netPnL: pnl.netPnl,
  };
}

function getUnrealizedPnl(position, candle, config) {
  if (!position) return 0;
  const markPrice = getExecutionPrice(candle.close, position.side, config, false);
  return calculateTradePnl(position, markPrice, config).netPnl;
}

export function openReplayPosition({ candle, side, equity, riskPerTrade, execution = {} } = {}) {
  if (!candle || !['long', 'short'].includes(side)) return null;
  const config = getInstrumentExecutionConfig(candle.symbol, execution);
  const quantity = calculatePositionQuantity({ equity, price: candle.close, riskPerTrade, config });
  if (quantity <= 0) return null;
  return {
    side,
    type: side,
    quantity,
    entryPrice: getExecutionPrice(candle.close, side, config, true),
    entryIndex: 0,
    entryTime: candle.time,
    execution: config,
  };
}

export function closeReplayPosition({ position, candle, exitIndex = 0, execution = {} } = {}) {
  if (!position || !candle) return null;
  const config = getInstrumentExecutionConfig(candle.symbol, { ...position.execution, ...execution });
  return closePosition({ ...position }, candle, config, exitIndex);
}

export function calculateReplaySummary({ initialCapital = 0, trades = [], position = null, candle = null, execution = {} } = {}) {
  const realizedPnl = trades.reduce((total, trade) => total + Number(trade.netPnL || 0), 0);
  const openPositionPnl = getUnrealizedPnl(position, candle, getInstrumentExecutionConfig(candle?.symbol, { ...position?.execution, ...execution }));
  const netPnL = realizedPnl + openPositionPnl;
  const endCapital = initialCapital + netPnL;
  const winningTrades = trades.filter((trade) => trade.netPnL > 0).length;
  const losingTrades = trades.filter((trade) => trade.netPnL < 0).length;
  return {
    startCapital: initialCapital,
    endCapital,
    netPnL,
    totalTrades: trades.length,
    winningTrades,
    losingTrades,
    winRate: trades.length ? (winningTrades / trades.length) * 100 : 0,
    totalReturn: initialCapital === 0 ? 0 : ((endCapital - initialCapital) / initialCapital) * 100,
    openPositionPnl,
  };
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

export function calculateMovingAverage(candles, period = 5) {
  if (!Array.isArray(candles) || period < 1) return [];
  const result = [];
  for (let index = period - 1; index < candles.length; index += 1) {
    const window = candles.slice(index - period + 1, index + 1);
    const value = window.reduce((total, candle) => total + Number(candle.close), 0) / period;
    result.push({ time: Math.floor(new Date(candles[index].time).getTime() / 1000), value });
  }
  return result;
}

export function buildReplayMarkers({ trades = [], position = null, candles = [] } = {}) {
  const markers = [];
  trades.forEach((trade) => {
    if (candles[trade.entryIndex]) {
      markers.push({
        time: Math.floor(new Date(candles[trade.entryIndex].time).getTime() / 1000),
        position: trade.side === 'short' ? 'aboveBar' : 'belowBar',
        color: trade.side === 'short' ? '#ef4444' : '#22c55e',
        shape: trade.side === 'short' ? 'arrowDown' : 'arrowUp',
        text: `${trade.side === 'short' ? 'Short' : 'Long'} entry`,
      });
    }
    if (candles[trade.exitIndex]) {
      markers.push({
        time: Math.floor(new Date(candles[trade.exitIndex].time).getTime() / 1000),
        position: trade.side === 'short' ? 'belowBar' : 'aboveBar',
        color: trade.netPnL >= 0 ? '#22c55e' : '#ef4444',
        shape: 'circle',
        text: `Exit ${trade.netPnL >= 0 ? '+' : ''}${Number(trade.netPnL).toFixed(2)}`,
      });
    }
  });
  if (position && candles[position.entryIndex]) {
    markers.push({
      time: Math.floor(new Date(candles[position.entryIndex].time).getTime() / 1000),
      position: position.side === 'short' ? 'aboveBar' : 'belowBar',
      color: position.side === 'short' ? '#f97316' : '#06b6d4',
      shape: position.side === 'short' ? 'arrowDown' : 'arrowUp',
      text: `Open ${position.side}`,
    });
  }
  return markers.sort((left, right) => left.time - right.time);
}

export function runBacktest({
  candles = [],
  initialCapital = 10000,
  riskPerTrade = 0.1,
  strategy = 'sma-crossover',
  execution = {},
} = {}) {
  const safeCandles = Array.isArray(candles) ? candles : [];
  const symbol = safeCandles[0]?.symbol || 'EURUSD';
  const executionConfig = getInstrumentExecutionConfig(symbol, execution);
  const trades = [];
  let cash = initialCapital;
  let position = null;
  let previousShortSma = null;
  let previousLongSma = null;
  const equityCurve = [];

  for (let index = 0; index < safeCandles.length; index += 1) {
    const candle = safeCandles[index];
    const closes = safeCandles.slice(0, index + 1).map((bar) => bar.close);
    const shortSma = calculateSma(closes, 5);
    const longSma = calculateSma(closes, 10);

    const bullishCross = previousShortSma !== null && previousLongSma !== null
      && previousShortSma <= previousLongSma && shortSma !== null && longSma !== null && shortSma > longSma;
    const bearishCross = previousShortSma !== null && previousLongSma !== null
      && previousShortSma >= previousLongSma && shortSma !== null && longSma !== null && shortSma < longSma;

    if (position && strategy === 'sma-crossover' && ((position.side === 'long' && bearishCross) || (position.side === 'short' && bullishCross))) {
      const completedTrade = closePosition(position, candle, executionConfig, index);
      cash += completedTrade.netPnL;
      trades.push(completedTrade);
      position = null;
    }

    if (!position && strategy === 'sma-crossover' && (bullishCross || bearishCross)) {
      const side = bullishCross ? 'long' : 'short';
      const quantity = calculatePositionQuantity({ equity: cash, price: candle.close, riskPerTrade, config: executionConfig });
      if (quantity > 0) {
        position = {
          side,
          type: side,
          quantity,
          entryPrice: getExecutionPrice(candle.close, side, executionConfig, true),
          entryIndex: index,
          entryTime: candle.time,
        };
      }
    }

    const unrealizedPnl = getUnrealizedPnl(position, candle, executionConfig);
    equityCurve.push({ time: candle.time, equity: cash + unrealizedPnl, price: candle.close, unrealizedPnl });
    previousShortSma = shortSma;
    previousLongSma = longSma;
  }

  const lastCandle = safeCandles[safeCandles.length - 1];
  const openPositionPnl = getUnrealizedPnl(position, lastCandle, executionConfig);
  const netPnL = trades.reduce((total, trade) => total + trade.netPnL, 0) + openPositionPnl;
  const endCapital = cash + openPositionPnl;
  const summary = {
    startCapital: initialCapital,
    endCapital,
    netPnL,
    totalTrades: trades.length,
    winningTrades: trades.filter((trade) => trade.netPnL > 0).length,
    losingTrades: trades.filter((trade) => trade.netPnL < 0).length,
    totalReturn: initialCapital === 0 ? 0 : ((endCapital - initialCapital) / initialCapital) * 100,
    openPositionPnl,
  };

  return {
    symbol,
    trades,
    openPosition: position,
    equityCurve,
    summary,
  };
}
