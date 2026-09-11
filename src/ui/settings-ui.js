export function switchSettingsTab(tabName, { getCurrentAccount, loadTransactions } = {}) {
    const sectionName = tabName === 'deposits' ? 'funds' : tabName;
    const allTabs = document.querySelectorAll('.settings-section');
    allTabs.forEach((tab) => {
        tab.classList.remove('active');
        tab.classList.add('hidden');
    });

    const allBtns = document.querySelectorAll('.settings-nav-item');
    allBtns.forEach((btn) => btn.classList.remove('active'));

    const tabElement = document.getElementById(`${sectionName}SettingsSection`);
    if (tabElement) {
        tabElement.classList.add('active');
        tabElement.classList.remove('hidden');
    }

    allBtns.forEach((btn) => {
        if (btn.dataset.section === sectionName) {
            btn.classList.add('active');
        }
    });

    if (sectionName === 'funds' && typeof loadTransactions === 'function') {
        loadTransactions();
    }
}

export function showSettingsSection(sectionName, context = {}) {
    switchSettingsTab(sectionName, context);
}

const THEME_STORAGE_KEY = 'appTheme';

function getEffectiveTheme(theme) {
    if (theme === 'system') {
        return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }
    return theme === 'light' ? 'light' : 'dark';
}

export function applyTheme(theme = 'dark') {
    const selectedTheme = ['light', 'dark', 'system'].includes(theme) ? theme : 'dark';
    const effectiveTheme = getEffectiveTheme(selectedTheme);
    document.documentElement.dataset.theme = effectiveTheme;
    document.documentElement.dataset.themePreference = selectedTheme;
    localStorage.setItem(THEME_STORAGE_KEY, selectedTheme);
    updateThemeShortcut(effectiveTheme);
    return selectedTheme;
}

function updateThemeShortcut(effectiveTheme = document.documentElement.dataset.theme) {
    const themeToggle = document.getElementById('sidebarThemeToggle');
    if (!themeToggle) return;
    const isLight = effectiveTheme === 'light';
    const lightIcon = themeToggle.querySelector('.theme-icon-light');
    const darkIcon = themeToggle.querySelector('.theme-icon-dark');
    if (lightIcon) lightIcon.hidden = isLight;
    if (darkIcon) darkIcon.hidden = !isLight;
    const nextTheme = isLight ? 'dark' : 'light';
    themeToggle.title = `Switch to ${nextTheme} mode`;
    themeToggle.setAttribute('aria-label', `Switch to ${nextTheme} mode`);
    const label = themeToggle.querySelector('.label');
    if (label) label.textContent = `${isLight ? 'Dark' : 'Light'} mode`;
}

export function toggleTheme() {
    const currentTheme = document.documentElement.dataset.theme;
    return applyTheme(currentTheme === 'light' ? 'dark' : 'light');
}

export function setupThemeSelect() {
    const themeSelect = document.getElementById('themeSelect');
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY) || 'dark';
    const mediaQuery = window.matchMedia('(prefers-color-scheme: light)');

    applyTheme(savedTheme);
    updateThemeShortcut(document.documentElement.dataset.theme);
    if (!themeSelect) return;

    themeSelect.value = ['light', 'dark', 'system'].includes(savedTheme) ? savedTheme : 'dark';
    themeSelect.addEventListener('change', () => applyTheme(themeSelect.value));

    const handleSystemThemeChange = () => {
        if (document.documentElement.dataset.themePreference === 'system') {
            applyTheme('system');
        }
    };
    if (typeof mediaQuery.addEventListener === 'function') {
        mediaQuery.addEventListener('change', handleSystemThemeChange);
    } else if (typeof mediaQuery.addListener === 'function') {
        mediaQuery.addListener(handleSystemThemeChange);
    }
}

export function openSettingsTab(tabName, context = {}) {
    const settingsTab = document.getElementById('settingsTab');
    const sectionName = tabName === 'deposits' ? 'funds' : tabName;
    if (settingsTab) {
        settingsTab.click();
    }
    setTimeout(() => {
        showSettingsSection(sectionName, context);
    }, 100);
}

export function updateCurrencyDisplay(getSelectedCurrency, getCurrencySymbol) {
    const selectedCurrency = getSelectedCurrency();
    const currencySymbol = getCurrencySymbol();
    const accountBalanceLabel = document.querySelector('label[for="accountSize"]');
    if (accountBalanceLabel) {
        accountBalanceLabel.textContent = `Account Balance (${currencySymbol})`;
    }
    const balanceStat = document.querySelector('.stat-card:nth-child(4) .text-xs');
    if (balanceStat) {
        balanceStat.textContent = `Balance (${currencySymbol})`;
    }
}

export function updateDepositWithdrawalDisplay(account, getCurrencySymbol) {
    const currencySymbol = getCurrencySymbol(account.currency);
    const depositSymbol = document.getElementById('depositCurrencySymbol');
    const withdrawSymbol = document.getElementById('withdrawCurrencySymbol');
    const availableBalanceEl = document.getElementById('availableBalance');

    if (depositSymbol) depositSymbol.textContent = currencySymbol;
    if (withdrawSymbol) withdrawSymbol.textContent = currencySymbol;
    if (availableBalanceEl) {
        availableBalanceEl.textContent = `${currencySymbol}${(account.balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
}

export function setupSettingsTab(context = {}) {
    const nowLocal = new Date().toISOString().slice(0, 16);
    const depositDateInput = document.getElementById('depositDate');
    const withdrawDateInput = document.getElementById('withdrawDate');
    const depositForm = document.getElementById('depositForm');
    const withdrawForm = document.getElementById('withdrawForm');

    if (depositDateInput) depositDateInput.value = nowLocal;
    if (withdrawDateInput) withdrawDateInput.value = nowLocal;

    if (depositForm && typeof context.handleDepositSubmit === 'function') {
        depositForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await context.handleDepositSubmit();
        });
    }

    if (withdrawForm && typeof context.handleWithdrawSubmit === 'function') {
        withdrawForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await context.handleWithdrawSubmit();
        });
    }

    const currentAccount = typeof context.getCurrentAccount === 'function' ? context.getCurrentAccount() : null;
    if (currentAccount) {
        if (typeof context.updateTransactionSummary === 'function') {
            context.updateTransactionSummary(currentAccount);
        }
        if (typeof context.updateAccountSettingsForm === 'function') {
            context.updateAccountSettingsForm(currentAccount);
        }
        if (typeof context.updateDepositWithdrawalDisplay === 'function') {
            context.updateDepositWithdrawalDisplay(currentAccount);
        }
    }

    console.log('✅ Settings tab setup complete');
}
