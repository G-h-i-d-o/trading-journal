export const BACKTEST_SESSION_SCHEMA_VERSION = 1;
export const BACKTEST_SESSION_STORAGE_KEY = 'backtestSessions';

function isObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function safeNumber(value, fallback = 0) {
    return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function normalizeCandle(candle) {
    if (!isObject(candle) || typeof candle.time !== 'string') return null;
    const time = new Date(candle.time);
    if (Number.isNaN(time.getTime())) return null;
    const open = safeNumber(candle.open, NaN);
    const high = safeNumber(candle.high, NaN);
    const low = safeNumber(candle.low, NaN);
    const close = safeNumber(candle.close, NaN);
    if (![open, high, low, close].every(Number.isFinite)) return null;
    return {
        symbol: typeof candle.symbol === 'string' ? candle.symbol.slice(0, 32) : 'UNKNOWN',
        time: time.toISOString(),
        open,
        high,
        low,
        close,
        volume: Math.max(0, safeNumber(candle.volume)),
    };
}

export function normalizeBacktestSession(session) {
    if (!isObject(session)) return null;
    const state = isObject(session.state) ? session.state : {};
    const candles = Array.isArray(state.candles) ? state.candles.map(normalizeCandle).filter(Boolean) : [];
    if (!candles.length) return null;
    const trades = Array.isArray(state.trades) ? state.trades.filter(isObject).map((trade) => ({
        side: trade.side === 'short' ? 'short' : 'long',
        type: trade.type === 'short' ? 'short' : 'long',
        quantity: Math.max(0, safeNumber(trade.quantity)),
        entryPrice: safeNumber(trade.entryPrice),
        exitPrice: safeNumber(trade.exitPrice),
        entryIndex: Math.max(0, Math.floor(safeNumber(trade.entryIndex))),
        exitIndex: Math.max(0, Math.floor(safeNumber(trade.exitIndex))),
        entryTime: typeof trade.entryTime === 'string' ? trade.entryTime : '',
        exitTime: typeof trade.exitTime === 'string' ? trade.exitTime : '',
        grossPnl: safeNumber(trade.grossPnl),
        commission: Math.max(0, safeNumber(trade.commission ?? trade.fees)),
        fees: Math.max(0, safeNumber(trade.fees ?? trade.commission)),
        netPnL: safeNumber(trade.netPnL),
    })) : [];
    const position = isObject(state.position) ? {
        side: state.position.side === 'short' ? 'short' : 'long',
        type: state.position.type === 'short' ? 'short' : 'long',
        quantity: Math.max(0, safeNumber(state.position.quantity)),
        entryPrice: safeNumber(state.position.entryPrice),
        entryIndex: Math.max(0, Math.floor(safeNumber(state.position.entryIndex))),
        entryTime: typeof state.position.entryTime === 'string' ? state.position.entryTime : '',
    } : null;
    const form = isObject(session.form) ? session.form : {};
    const id = typeof session.id === 'string' && session.id.length <= 100 ? session.id : null;
    if (!id) return null;
    return {
        id,
        name: typeof session.name === 'string' && session.name.trim() ? session.name.trim().slice(0, 50) : 'Untitled replay',
        state: {
            candles,
            currentIndex: Math.min(candles.length - 1, Math.max(0, Math.floor(safeNumber(state.currentIndex)))),
            playing: false,
            speed: Math.max(0.1, safeNumber(state.speed, 1)),
            initialCapital: Math.max(0, safeNumber(state.initialCapital, 10000)),
            riskPerTrade: Math.max(0, safeNumber(state.riskPerTrade, 0.1)),
            strategy: typeof state.strategy === 'string' ? state.strategy.slice(0, 40) : 'manual-replay',
            symbol: typeof state.symbol === 'string' ? state.symbol.slice(0, 32) : candles[0].symbol,
            timeframe: typeof state.timeframe === 'string' ? state.timeframe.slice(0, 8) : '1H',
            provider: typeof state.provider === 'string' ? state.provider.slice(0, 32) : 'synthetic',
            startDate: typeof state.startDate === 'string' ? state.startDate : candles[0].time,
            endDate: typeof state.endDate === 'string' ? state.endDate : '',
            position,
            trades,
            execution: {},
            summary: isObject(state.summary) ? {
                startCapital: safeNumber(state.summary.startCapital, safeNumber(state.initialCapital, 10000)),
                endCapital: safeNumber(state.summary.endCapital, safeNumber(state.initialCapital, 10000)),
                netPnL: safeNumber(state.summary.netPnL),
                totalTrades: trades.length,
                winningTrades: Math.max(0, Math.floor(safeNumber(state.summary.winningTrades))),
                losingTrades: Math.max(0, Math.floor(safeNumber(state.summary.losingTrades))),
                totalReturn: safeNumber(state.summary.totalReturn),
                openPositionPnl: safeNumber(state.summary.openPositionPnl),
            } : undefined,
        },
        form: {
            symbol: typeof form.symbol === 'string' ? form.symbol.slice(0, 32) : candles[0].symbol,
            timeframe: typeof form.timeframe === 'string' ? form.timeframe.slice(0, 8) : '1H',
            provider: typeof form.provider === 'string' ? form.provider.slice(0, 32) : 'synthetic',
            startDate: typeof form.startDate === 'string' ? form.startDate : '',
            endDate: typeof form.endDate === 'string' ? form.endDate : '',
            bars: Math.max(30, Math.min(500, Math.floor(safeNumber(form.bars, candles.length)))),
            capital: Math.max(0, safeNumber(form.capital, 10000)),
            risk: Math.max(0, safeNumber(form.risk, 0.1)),
        },
        updatedAt: typeof session.updatedAt === 'string' ? session.updatedAt : new Date().toISOString(),
    };
}

export function getBacktestSessionStorageKey(userId = 'anonymous') {
    const safeUserId = String(userId || 'anonymous').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100);
    return `${BACKTEST_SESSION_STORAGE_KEY}:${safeUserId}`;
}

export function readBacktestSessions(storage = globalThis.localStorage, userId = 'anonymous') {
    const scopedKey = getBacktestSessionStorageKey(userId);
    const rawScoped = storage?.getItem(scopedKey);
    const rawLegacy = storage?.getItem(BACKTEST_SESSION_STORAGE_KEY);
    const raw = rawScoped ?? rawLegacy;
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        const records = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.sessions) ? parsed.sessions : []);
        const normalized = records.map(normalizeBacktestSession).filter(Boolean);
        if (!rawScoped && rawLegacy && storage && normalized.length) {
            if (writeBacktestSessions(normalized, storage, userId)) {
                try {
                    storage.removeItem?.(BACKTEST_SESSION_STORAGE_KEY);
                } catch {
                    // Legacy cleanup is best effort.
                }
            }
        }
        return normalized;
    } catch {
        return [];
    }
}

export function writeBacktestSessions(sessions, storage = globalThis.localStorage, userId = 'anonymous') {
    const normalized = (Array.isArray(sessions) ? sessions : []).map(normalizeBacktestSession).filter(Boolean);
    const envelope = {
        version: BACKTEST_SESSION_SCHEMA_VERSION,
        sessions: normalized,
        updatedAt: new Date().toISOString(),
    };
    try {
        storage.setItem(getBacktestSessionStorageKey(userId), JSON.stringify(envelope));
        return true;
    } catch {
        return false;
    }
}
