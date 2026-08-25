export const currencySymbols = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    JPY: '¥',
    ZAR: 'R',
    CAD: 'C$',
    AUD: 'A$',
    CHF: 'CHF'
};

export function getSelectedCurrency() {
    const el = typeof document !== 'undefined' ? document.getElementById('accountCurrency') : null;
    return el ? el.value : 'USD';
}

export function getCurrencySymbol(currencyCode = null) {
    const code = currencyCode || getSelectedCurrency();
    return currencySymbols[code] || '$';
}

export function formatCurrency(amount, currencyCode = null) {
    const numericAmount = Number(amount ?? 0);
    const code = currencyCode || getSelectedCurrency();
    const symbol = getCurrencySymbol(code);
    return `${symbol}${numericAmount.toFixed(2)}`;
}
