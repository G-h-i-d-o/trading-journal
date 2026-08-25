export function validateTransactionInput({ amount, date, type, currentBalance = 0 }) {
  const numericAmount = Number(amount);
  const normalizedType = String(type || '').toLowerCase();

  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    return { valid: false, message: 'Please enter a valid amount.' };
  }

  if (!date) {
    return { valid: false, message: 'Please select a date.' };
  }

  if (normalizedType === 'withdrawal' && numericAmount > Number(currentBalance || 0)) {
    return { valid: false, message: 'Withdrawal amount cannot exceed available balance.' };
  }

  return { valid: true, message: '' };
}
