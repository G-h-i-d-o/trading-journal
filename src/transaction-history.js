export function filterTransactions(transactions = [], filter = 'all') {
  const safeTransactions = Array.isArray(transactions) ? transactions : [];
  const normalizedFilter = String(filter || 'all').toLowerCase();

  if (normalizedFilter === 'all') {
    return [...safeTransactions].sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  const transactionType = normalizedFilter === 'deposit' ? 'deposit' : 'withdrawal';
  return safeTransactions
    .filter((transaction) => String(transaction?.type || '').toLowerCase() === transactionType)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}

export function paginateTransactions(transactions = [], page = 1, perPage = 5) {
  const safeTransactions = Array.isArray(transactions) ? transactions : [];
  const safePage = Math.max(1, Number(page) || 1);
  const safePerPage = Math.max(1, Number(perPage) || 5);
  const totalItems = safeTransactions.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / safePerPage));
  const normalizedPage = Math.min(safePage, totalPages);
  const start = (normalizedPage - 1) * safePerPage;
  const items = safeTransactions.slice(start, start + safePerPage);

  return {
    page: normalizedPage,
    totalPages,
    totalItems,
    items,
    hasNextPage: normalizedPage < totalPages,
    hasPreviousPage: normalizedPage > 1,
  };
}
