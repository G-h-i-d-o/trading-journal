export function validateProfileInput({ fullName }) {
  if (!String(fullName || '').trim()) {
    return { valid: false, message: 'Full Name is required.' };
  }

  return { valid: true, message: '' };
}

export function validateObjectivesInput({ maxLoss, dailyLoss, profitTarget, tradingDays }) {
  const checks = [
    Number(maxLoss),
    Number(dailyLoss),
    Number(profitTarget),
    Number(tradingDays),
  ];

  if (checks.some((value) => !Number.isFinite(value))) {
    return { valid: false, message: 'Please fill all fields with valid numbers.' };
  }

  return { valid: true, message: '' };
}

export function validateAccountSetupInput({ balance, currency, riskPerTrade, leverage }) {
  const numericBalance = Number(balance);

  if (!Number.isFinite(numericBalance) || numericBalance <= 0) {
    return { valid: false, message: 'Please enter a valid balance.' };
  }

  if (!currency) {
    return { valid: false, message: 'Please select a currency.' };
  }

  if (riskPerTrade !== undefined && !Number.isFinite(Number(riskPerTrade))) {
    return { valid: false, message: 'Please enter a valid risk per trade.' };
  }

  if (leverage !== undefined && !Number.isFinite(Number(leverage))) {
    return { valid: false, message: 'Please enter a valid leverage.' };
  }

  return { valid: true, message: '' };
}
