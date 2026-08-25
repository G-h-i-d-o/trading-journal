const DEFAULT_ACCOUNT_CURRENCIES = new Set([
    'USD', 'EUR', 'GBP', 'JPY', 'ZAR', 'CAD', 'AUD', 'CHF'
]);

export const DEFAULT_ACCOUNT_OBJECTIVES = {
    maxLossTarget: 500,
    dailyLossTarget: 250,
    profitTarget: 500,
    tradingDaysTarget: 2
};

export function normalizeAccount(account, userId = '', currencyCodes = DEFAULT_ACCOUNT_CURRENCIES) {
    const safeAccount = account || {};
    const hasExplicitBalance = safeAccount.balance !== undefined && safeAccount.balance !== null && String(safeAccount.balance).trim() !== '';
    const safeBalance = hasExplicitBalance && Number.isFinite(Number(safeAccount.balance)) ? Number(safeAccount.balance) : 10000;
    const hasExplicitInitialBalance = safeAccount.initialBalance !== undefined && safeAccount.initialBalance !== null && String(safeAccount.initialBalance).trim() !== '';
    const safeInitialBalance = hasExplicitInitialBalance && Number.isFinite(Number(safeAccount.initialBalance))
        ? Number(safeAccount.initialBalance)
        : safeBalance;

    return {
        id: safeAccount.id || `account_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
        name: String(safeAccount.name || 'Main Account').trim() || 'Main Account',
        balance: safeBalance,
        initialBalance: safeInitialBalance,
        currency: (safeAccount.currency && currencyCodes.has(safeAccount.currency)) ? safeAccount.currency : 'USD',
        createdAt: safeAccount.createdAt || new Date().toISOString(),
        isDefault: Boolean(safeAccount.isDefault),
        userId: safeAccount.userId || userId,
        transactions: Array.isArray(safeAccount.transactions) ? safeAccount.transactions : [],
        objectives: {
            ...DEFAULT_ACCOUNT_OBJECTIVES,
            ...(safeAccount.objectives || {})
        },
        tradeLocker: safeAccount.tradeLocker || {
            enabled: false,
            isLocked: false,
            mtAccountId: '',
            platform: 'MT4',
            rules: {
                maxLoss: 500,
                dailyLoss: 250,
                profitTarget: 500,
                maxConsecutiveLosses: 3
            }
        }
    };
}

export function readCachedAccounts(storage = localStorage) {
    try {
        const raw = storage.getItem('userAccounts');
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.map((account) => normalizeAccount(account));
    } catch (error) {
        console.warn('[ACCOUNTS] Failed to parse cached accounts:', error);
        return [];
    }
}

export function persistAccountCache(accounts, storage = localStorage) {
    const safeAccounts = (accounts || []).map((account) => normalizeAccount(account));
    storage.setItem('userAccounts', JSON.stringify(safeAccounts));
    return safeAccounts;
}
