export function validateLockerRules(rules = {}, objectives = {}) {
  const errors = [];
  const safeRules = rules || {};
  const safeObjectives = objectives || {};

  if (Number(safeRules.maxLoss) > Number(safeObjectives.maxLossTarget ?? 500)) {
    errors.push('Maximum Loss must be less than or equal to your objective max loss.');
  }
  if (Number(safeRules.dailyLoss) > Number(safeObjectives.dailyLossTarget ?? 250)) {
    errors.push('Daily Loss Limit must be less than or equal to your objective daily loss.');
  }
  if (Number(safeRules.profitTarget) > Number(safeObjectives.profitTarget ?? 500)) {
    errors.push('Profit Target must be less than or equal to your objective profit target.');
  }
  if (Number(safeRules.maxConsecutiveLosses) < 0) {
    errors.push('Max Consecutive Losses must be zero or higher.');
  }
  return errors;
}

export function enforceLockerRuleOnTrade(trade = {}, account = {}) {
  const locker = account.tradeLocker || {};
  if (!locker.enabled || !locker.rules) return { allowed: true };

  const objectives = account.objectives || {
    maxLossTarget: 500,
    dailyLossTarget: 250,
    profitTarget: 500,
    tradingDaysTarget: 2,
  };

  const validation = validateLockerRules(locker.rules, objectives);
  if (validation.length > 0) {
    return { allowed: false, message: validation.join('\n') };
  }

  if (Number(trade.riskAmount || 0) > Number(locker.rules.maxLoss || 0)) {
    return { allowed: false, message: `Trade risk amount exceeds locker max loss ($${locker.rules.maxLoss}).` };
  }

  if (Number(trade.profit || 0) > Number(locker.rules.profitTarget || 0)) {
    return { allowed: false, message: `Trade profit exceeds locker profit target ($${locker.rules.profitTarget}).` };
  }

  return { allowed: true };
}
