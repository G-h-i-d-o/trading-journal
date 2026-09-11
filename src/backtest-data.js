import { generateSyntheticCandles } from './backtesting-engine.js';

export const BACKTEST_TIMEFRAMES = {
    '1H': 60 * 60 * 1000,
    '4H': 4 * 60 * 60 * 1000,
    '1D': 24 * 60 * 60 * 1000,
};

export function validateHistoricalCandles(candles, { symbol } = {}) {
    if (!Array.isArray(candles)) {
        throw new TypeError('Historical data must be an array of candles.');
    }

    const validated = candles.map((candle, index) => {
        const time = new Date(candle?.time).getTime();
        const open = Number(candle?.open);
        const high = Number(candle?.high);
        const low = Number(candle?.low);
        const close = Number(candle?.close);
        const volume = Number(candle?.volume ?? 0);
        if (!Number.isFinite(time) || !Number.isFinite(open) || !Number.isFinite(high)
            || !Number.isFinite(low) || !Number.isFinite(close) || !Number.isFinite(volume)) {
            throw new Error(`Invalid historical candle at index ${index}.`);
        }
        if (high < Math.max(open, close) || low > Math.min(open, close) || low > high) {
            throw new Error(`Invalid OHLC relationship at index ${index}.`);
        }
        return {
            symbol: candle.symbol || symbol || 'UNKNOWN',
            time: new Date(time).toISOString(),
            open,
            high,
            low,
            close,
            volume: Math.max(0, volume),
        };
    }).sort((left, right) => new Date(left.time) - new Date(right.time));

    for (let index = 1; index < validated.length; index += 1) {
        if (validated[index].time === validated[index - 1].time) {
            throw new Error(`Duplicate historical candle timestamp at index ${index}.`);
        }
    }
    return validated;
}

export function filterHistoricalCandles(candles, { startDate, endDate } = {}) {
    const start = startDate ? new Date(startDate).getTime() : -Infinity;
    const end = endDate ? new Date(endDate).getTime() : Infinity;
    if (!Number.isFinite(start) && start !== -Infinity) throw new Error('Invalid historical start date.');
    if (!Number.isFinite(end) && end !== Infinity) throw new Error('Invalid historical end date.');
    if (end < start) throw new Error('Historical end date must be after the start date.');
    return candles.filter((candle) => {
        const time = new Date(candle.time).getTime();
        return time >= start && time <= end;
    });
}

export function aggregateHistoricalCandles(candles, timeframe = '1H') {
    const timeframeMs = BACKTEST_TIMEFRAMES[timeframe];
    if (!timeframeMs) throw new Error(`Unsupported backtest timeframe: ${timeframe}`);
    if (timeframe === '1H') return [...candles];

    const buckets = new Map();
    candles.forEach((candle) => {
        const timestamp = new Date(candle.time).getTime();
        const bucketTime = Math.floor(timestamp / timeframeMs) * timeframeMs;
        const existing = buckets.get(bucketTime);
        if (!existing) {
            buckets.set(bucketTime, { ...candle, time: new Date(bucketTime).toISOString() });
            return;
        }
        existing.high = Math.max(existing.high, candle.high);
        existing.low = Math.min(existing.low, candle.low);
        existing.close = candle.close;
        existing.volume += candle.volume;
    });
    return [...buckets.values()].sort((left, right) => new Date(left.time) - new Date(right.time));
}

export function createSyntheticHistoricalProvider({
    symbol,
    startDate,
    totalBars,
    timeframe = '1H',
    drift,
    volatility,
} = {}) {
    const timeframeMs = BACKTEST_TIMEFRAMES[timeframe] || BACKTEST_TIMEFRAMES['1H'];
    const baseBars = timeframe === '1H' ? totalBars : totalBars * (timeframeMs / BACKTEST_TIMEFRAMES['1H']);
    return generateSyntheticCandles({ symbol, startDate, totalBars: baseBars, drift, volatility });
}

export async function loadHistoricalCandles({
    provider = 'synthetic',
    symbol = 'EURUSD',
    timeframe = '1H',
    startDate = '2024-01-01T00:00:00Z',
    endDate,
    totalBars = 120,
    drift,
    volatility,
    fetchProvider,
} = {}) {
    let candles;
    if (provider === 'synthetic') {
        candles = createSyntheticHistoricalProvider({ symbol, startDate, totalBars, timeframe, drift, volatility });
    } else if (provider === 'custom' && typeof fetchProvider === 'function') {
        candles = await fetchProvider({ symbol, timeframe, startDate, endDate, totalBars });
    } else {
        throw new Error(`Historical provider "${provider}" is not configured.`);
    }

    const validated = validateHistoricalCandles(candles, { symbol });
    const filtered = filterHistoricalCandles(validated, { startDate, endDate });
    const aggregated = aggregateHistoricalCandles(filtered, timeframe);
    if (aggregated.length < 2) {
        throw new Error('The selected historical range does not contain enough candles.');
    }
    return aggregated;
}
