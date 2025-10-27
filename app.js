// app.js - DEBUGGED VERSION WITH MULTI-ACCOUNT SUPPORT
import { 
    auth, db, onAuthStateChanged, signOut, 
    collection, addDoc, getDocs, query, where, doc, deleteDoc, updateDoc, getDoc, setDoc
} from './firebase-config.js';

let currentUser = null;
let performanceChart = null;
let winLossChart = null;
let marketTypeChart = null;
let editingTradeId = null;
let currentPage = 1;
const tradesPerPage = 10;
let allTrades = [];
let allAffirmations = [];
let editingAffirmationId = null;

// Account Management System
let currentAccountId = null;
let userAccounts = [];

// Currency configuration
const currencySymbols = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    JPY: '¥',
    ZAR: 'R',
    CAD: 'C$',
    AUD: 'A$',
    CHF: 'CHF'
};

const currencyNames = {
    USD: 'US Dollar',
    EUR: 'Euro',
    GBP: 'British Pound',
    JPY: 'Japanese Yen',
    ZAR: 'South African Rand',
    CAD: 'Canadian Dollar',
    AUD: 'Australian Dollar',
    CHF: 'Swiss Franc'
};

// Sample affirmations data
const sampleAffirmations = [
    {
        text: "I trust my trading strategy and execute it with precision and confidence.",
        category: "discipline",
        isFavorite: true,
        isActive: true,
        usageCount: 12,
        lastUsed: new Date().toISOString(),
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        strength: 92
    },
    {
        text: "I am patient and wait for the perfect setups that align with my trading plan.",
        category: "patience",
        isFavorite: false,
        isActive: true,
        usageCount: 8,
        lastUsed: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        strength: 85
    },
    {
        text: "Every trade is an opportunity to learn and improve my skills as a trader.",
        category: "mindset",
        isFavorite: true,
        isActive: true,
        usageCount: 15,
        lastUsed: new Date().toISOString(),
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        strength: 88
    }
];

// Motivational quotes
const motivationalQuotes = [
    "The stock market is a device for transferring money from the impatient to the patient. - Warren Buffett",
    "Risk comes from not knowing what you're doing. - Warren Buffett",
    "The most important quality for an investor is temperament, not intellect. - Warren Buffett",
    "In trading and investing, it's not about being right; it's about making money.",
    "The best investment you can make is in yourself. - Warren Buffett",
    "Time in the market beats timing the market.",
    "Emotion is the enemy of successful trading.",
    "Plan your trade and trade your plan."
];

// ========== ACCOUNT MANAGEMENT SYSTEM (FIRESTORE SYNC) ==========

// Initialize accounts system
async function initializeAccounts() {
    console.log('🔄 Initializing accounts system...');
    await loadUserAccounts();
    setupAccountsDropdown();
    console.log('✅ Accounts system initialized');
}

// Load user accounts from Firestore
async function loadUserAccounts() {
    try {
        if (!currentUser) {
            console.log('❌ No user for accounts');
            return;
        }

        console.log('📁 Loading accounts from Firestore...');
        const q = query(collection(db, 'accounts'), where('userId', '==', currentUser.uid));
        const querySnapshot = await getDocs(q);
        
        const accounts = [];
        querySnapshot.forEach((doc) => {
            accounts.push({ id: doc.id, ...doc.data() });
        });

        // If no accounts found, create default main account
        if (accounts.length === 0) {
            console.log('🆕 Creating default account...');
            const defaultAccount = {
                name: 'Main Account',
                balance: 10000,
                currency: 'USD',
                createdAt: new Date().toISOString(),
                isDefault: true,
                userId: currentUser.uid
            };
            
            const docRef = await addDoc(collection(db, 'accounts'), defaultAccount);
            userAccounts = [{ id: docRef.id, ...defaultAccount }];
            console.log('✅ Default account created with ID:', docRef.id);
        } else {
            userAccounts = accounts;
            console.log('✅ Accounts loaded from Firestore:', userAccounts.length);
        }
        
        // Set current account
        const savedCurrentAccount = localStorage.getItem('currentAccountId');
        currentAccountId = savedCurrentAccount || userAccounts[0].id;
        console.log('🎯 Current account:', currentAccountId);
        
        updateCurrentAccountDisplay();
        
    } catch (error) {
        console.error('❌ Error loading accounts:', error);
        // Fallback to localStorage if Firestore fails
        await loadAccountsFromLocalStorageFallback();
    }
}

// Fallback to localStorage if Firestore fails
async function loadAccountsFromLocalStorageFallback() {
    console.log('🔄 Falling back to localStorage for accounts...');
    const savedAccounts = localStorage.getItem('userAccounts');
    if (savedAccounts) {
        userAccounts = JSON.parse(savedAccounts);
        console.log('📁 Loaded existing accounts from localStorage:', userAccounts.length);
    } else {
        // Create default main account
        userAccounts = [{
            id: 'main',
            name: 'Main Account',
            balance: 10000,
            currency: 'USD',
            createdAt: new Date().toISOString(),
            isDefault: true
        }];
        localStorage.setItem('userAccounts', JSON.stringify(userAccounts));
        console.log('🆕 Created default account in localStorage');
    }
    
    // Set current account
    const savedCurrentAccount = localStorage.getItem('currentAccountId');
    currentAccountId = savedCurrentAccount || userAccounts[0].id;
    console.log('🎯 Current account:', currentAccountId);
    
    updateCurrentAccountDisplay();
}

// Save user accounts to Firestore
async function saveUserAccounts() {
    try {
        if (!currentUser) {
            console.log('❌ No user, saving to localStorage only');
            localStorage.setItem('userAccounts', JSON.stringify(userAccounts));
            return;
        }

        console.log('💾 Saving accounts to Firestore...');
        
        // Update each account in Firestore
        const savePromises = userAccounts.map(async (account) => {
            if (account.id && !account.id.startsWith('local_')) {
                // Update existing account in Firestore
                const accountRef = doc(db, 'accounts', account.id);
                const accountData = { ...account };
                delete accountData.id; // Remove ID from data to be stored
                await setDoc(accountRef, accountData, { merge: true });
            } else {
                // Create new account in Firestore
                const accountData = { ...account };
                if (account.id?.startsWith('local_')) {
                    delete accountData.id; // Remove local ID
                }
                accountData.userId = currentUser.uid;
                
                const docRef = await addDoc(collection(db, 'accounts'), accountData);
                // Update local ID with Firestore ID
                account.id = docRef.id;
            }
        });
        
        await Promise.all(savePromises);
        console.log('✅ Accounts saved to Firestore');
        
        // Also save to localStorage as backup
        localStorage.setItem('userAccounts', JSON.stringify(userAccounts));
        
    } catch (error) {
        console.error('❌ Error saving accounts to Firestore:', error);
        // Fallback to localStorage
        localStorage.setItem('userAccounts', JSON.stringify(userAccounts));
        console.log('📁 Accounts saved to localStorage as fallback');
    }
}

// Setup accounts dropdown functionality
function setupAccountsDropdown() {
    const accountsToggle = document.getElementById('accountsToggle');
    const accountsMenu = document.getElementById('accountsMenu');
    
    if (accountsToggle && accountsMenu) {
        accountsToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            accountsMenu.classList.toggle('hidden');
            renderAccountsList();
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', () => {
            accountsMenu.classList.add('hidden');
        });
        
        // Prevent dropdown from closing when clicking inside
        accountsMenu.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }
}

// Render accounts list in dropdown
function renderAccountsList() {
    const accountsList = document.getElementById('accountsList');
    const mobileAccountsList = document.getElementById('mobileAccountsList');
    
    if (!accountsList && !mobileAccountsList) return;
    
    const accountsHTML = userAccounts.map(account => `
        <div class="p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0 transition-colors duration-200 ${account.id === currentAccountId ? 'bg-blue-50 border-blue-200' : ''}" 
             onclick="switchAccount('${account.id}')">
            <div class="flex justify-between items-center">
                <div class="flex-1">
                    <div class="font-semibold text-gray-800 text-sm">${account.name}</div>
                    <div class="text-xs text-gray-600 mt-1">
                        ${getCurrencySymbol(account.currency)}${account.balance.toLocaleString()} • ${account.currency}
                    </div>
                </div>
                ${account.id === currentAccountId ? '<span class="text-blue-500 text-lg">✓</span>' : ''}
                ${!account.isDefault ? `
                    <button onclick="event.stopPropagation(); deleteAccount('${account.id}')" 
                            class="ml-2 text-red-400 hover:text-red-600 transition-colors duration-200 p-1 rounded">
                        🗑️
                    </button>
                ` : ''}
            </div>
        </div>
    `).join('');
    
    if (accountsList) accountsList.innerHTML = accountsHTML;
    if (mobileAccountsList) mobileAccountsList.innerHTML = accountsHTML;
}

// Update current account display
function updateCurrentAccountDisplay() {
    const currentAccount = getCurrentAccount();
    if (!currentAccount) return;
    
    const currentAccountName = document.getElementById('currentAccountName');
    if (currentAccountName) {
        currentAccountName.textContent = currentAccount.name;
    }
    
    // Update account settings in the form
    updateAccountSettingsForm(currentAccount);
}

// Update account settings form with current account data
function updateAccountSettingsForm(account) {
    const accountSizeInput = document.getElementById('accountSize');
    const accountCurrencySelect = document.getElementById('accountCurrency');
    
    if (accountSizeInput) {
        accountSizeInput.value = account.balance;
    }
    if (accountCurrencySelect) {
        accountCurrencySelect.value = account.currency;
    }
    
    // Update currency display
    updateCurrencyDisplay();
}

// Switch to different account
window.switchAccount = async (accountId) => {
    if (accountId === currentAccountId) return;
    
    console.log('🔄 Switching to account:', accountId);
    
    // Save current account data before switching
    await saveCurrentAccountData();
    
    // Switch account
    currentAccountId = accountId;
    localStorage.setItem('currentAccountId', accountId);
    
    // Update display
    updateCurrentAccountDisplay();
    
    // Load account-specific data
    await loadAccountData();
    
    // Close dropdown
    const accountsMenu = document.getElementById('accountsMenu');
    if (accountsMenu) accountsMenu.classList.add('hidden');
    
    showSuccessMessage(`Switched to ${getCurrentAccount().name}`);
};

// Get current account object
function getCurrentAccount() {
    return userAccounts.find(acc => acc.id === currentAccountId) || userAccounts[0];
}

// Save current account data before switching
async function saveCurrentAccountData() {
    const currentAccount = getCurrentAccount();
    
    // Save account settings
    const accountSizeInput = document.getElementById('accountSize');
    if (accountSizeInput) {
        currentAccount.balance = parseFloat(accountSizeInput.value) || 10000;
    }
    
    const accountCurrencySelect = document.getElementById('accountCurrency');
    if (accountCurrencySelect) {
        currentAccount.currency = accountCurrencySelect.value;
    }
    
    await saveUserAccounts();
}

// Load account-specific data
async function loadAccountData() {
    showLoading();
    console.log('📊 Loading account data for:', currentAccountId);
    
    try {
        // Load trades for current account
        await loadTrades();
        
        // Load affirmations (shared across accounts)
        await loadAffirmations();
        
        // Update all displays
        updateStats(allTrades);
        renderCharts(allTrades);
        calculateAdvancedMetrics(allTrades);
        
        console.log('✅ Account data loaded successfully');
        
    } catch (error) {
        console.error('❌ Error loading account data:', error);
        alert('Error loading account data. Please check console and refresh the page.');
    } finally {
        hideLoading();
    }
}

// Add Account Modal Functions
window.showAddAccountModal = () => {
    document.getElementById('addAccountModal').classList.remove('hidden');
    document.getElementById('accountName').value = '';
    document.getElementById('accountBalance').value = '10000';
    document.getElementById('accountCurrencySelect').value = 'USD';
    document.getElementById('accountNameCharCount').textContent = '0';
    
    // Close other dropdowns
    document.getElementById('accountsMenu')?.classList.add('hidden');
    document.getElementById('mobileMenu')?.classList.add('hidden');
};

window.closeAddAccountModal = () => {
    document.getElementById('addAccountModal').classList.add('hidden');
};

// Handle add account form submission
function setupAccountModalListeners() {
    const addAccountForm = document.getElementById('addAccountForm');
    if (addAccountForm) {
        addAccountForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const accountName = document.getElementById('accountName').value.trim();
            const accountBalance = parseFloat(document.getElementById('accountBalance').value);
            const accountCurrency = document.getElementById('accountCurrencySelect').value;
            
            if (!accountName) {
                alert('Please enter an account name.');
                return;
            }
            
            if (accountName.length > 50) {
                alert('Account name must be 50 characters or less.');
                return;
            }
            
            // Check if account name already exists
            if (userAccounts.some(acc => acc.name.toLowerCase() === accountName.toLowerCase())) {
                alert('An account with this name already exists. Please choose a different name.');
                return;
            }
            
            const newAccount = {
                name: accountName,
                balance: accountBalance,
                currency: accountCurrency,
                createdAt: new Date().toISOString(),
                isDefault: false,
                userId: currentUser.uid
            };
            
            try {
                // Add to Firestore first
                const docRef = await addDoc(collection(db, 'accounts'), newAccount);
                
                // Add to local state with Firestore ID
                userAccounts.push({
                    id: docRef.id,
                    ...newAccount
                });
                
                await saveUserAccounts();
                
                closeAddAccountModal();
                renderAccountsList();
                showSuccessMessage(`Account "${accountName}" created successfully!`);
                
            } catch (error) {
                console.error('Error creating account:', error);
                alert('Error creating account. Please try again.');
            }
        });
    }

    // Update character count for account name
    const accountNameInput = document.getElementById('accountName');
    if (accountNameInput) {
        accountNameInput.addEventListener('input', function() {
            document.getElementById('accountNameCharCount').textContent = this.value.length;
        });
    }
}

// Delete account function
window.deleteAccount = async (accountId) => {
    const account = userAccounts.find(acc => acc.id === accountId);
    if (!account) return;
    
    if (account.isDefault) {
        alert('Cannot delete the default main account.');
        return;
    }
    
    if (confirm(`Are you sure you want to delete "${account.name}"? This will also delete all trades associated with this account.`)) {
        try {
            // Delete account from Firestore
            if (!accountId.startsWith('local_')) {
                await deleteDoc(doc(db, 'accounts', accountId));
            }
            
            // Delete account from local state
            userAccounts = userAccounts.filter(acc => acc.id !== accountId);
            await saveUserAccounts();
            
            // If deleting current account, switch to main account
            if (currentAccountId === accountId) {
                await switchAccount(userAccounts[0].id);
            }
            
            // Delete account-specific trades from Firestore
            await deleteAccountTrades(accountId);
            
            renderAccountsList();
            showSuccessMessage(`Account "${account.name}" deleted successfully!`);
            
        } catch (error) {
            console.error('Error deleting account:', error);
            alert('Error deleting account. Please try again.');
        }
    }
};

// Delete all trades for a specific account
async function deleteAccountTrades(accountId) {
    try {
        const q = query(
            collection(db, 'trades'), 
            where('userId', '==', currentUser.uid),
            where('accountId', '==', accountId)
        );
        const querySnapshot = await getDocs(q);
        
        const deletePromises = [];
        querySnapshot.forEach((doc) => {
            deletePromises.push(deleteDoc(doc.ref));
        });
        
        await Promise.all(deletePromises);
        console.log(`🗑️ Deleted ${deletePromises.length} trades for account ${accountId}`);
    } catch (error) {
        console.error('Error deleting account trades:', error);
    }
}

// Render accounts list in dropdown
function renderAccountsList() {
    const accountsList = document.getElementById('accountsList');
    const mobileAccountsList = document.getElementById('mobileAccountsList');
    
    if (!accountsList && !mobileAccountsList) return;
    
    const accountsHTML = userAccounts.map(account => `
        <div class="p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0 transition-colors duration-200 ${account.id === currentAccountId ? 'bg-blue-50 border-blue-200' : ''}" 
             onclick="switchAccount('${account.id}')">
            <div class="flex justify-between items-center">
                <div class="flex-1">
                    <div class="font-semibold text-gray-800 text-sm">${account.name}</div>
                    <div class="text-xs text-gray-600 mt-1">
                        ${getCurrencySymbol(account.currency)}${account.balance.toLocaleString()} • ${account.currency}
                    </div>
                </div>
                ${account.id === currentAccountId ? '<span class="text-blue-500 text-lg">✓</span>' : ''}
                ${!account.isDefault ? `
                    <button onclick="event.stopPropagation(); deleteAccount('${account.id}')" 
                            class="ml-2 text-red-400 hover:text-red-600 transition-colors duration-200 p-1 rounded">
                        🗑️
                    </button>
                ` : ''}
            </div>
        </div>
    `).join('');
    
    if (accountsList) accountsList.innerHTML = accountsHTML;
    if (mobileAccountsList) mobileAccountsList.innerHTML = accountsHTML;
}

// Update current account display
function updateCurrentAccountDisplay() {
    const currentAccount = getCurrentAccount();
    if (!currentAccount) return;
    
    const currentAccountName = document.getElementById('currentAccountName');
    if (currentAccountName) {
        currentAccountName.textContent = currentAccount.name;
    }
    
    // Update account settings in the form
    updateAccountSettingsForm(currentAccount);
}

// Update account settings form with current account data
function updateAccountSettingsForm(account) {
    const accountSizeInput = document.getElementById('accountSize');
    const accountCurrencySelect = document.getElementById('accountCurrency');
    
    if (accountSizeInput) {
        accountSizeInput.value = account.balance;
    }
    if (accountCurrencySelect) {
        accountCurrencySelect.value = account.currency;
    }
    
    // Update currency display
    updateCurrencyDisplay();
}

// Switch to different account
window.switchAccount = async (accountId) => {
    if (accountId === currentAccountId) return;
    
    console.log('🔄 Switching to account:', accountId);
    
    // Save current account data before switching
    await saveCurrentAccountData();
    
    // Switch account
    currentAccountId = accountId;
    localStorage.setItem('currentAccountId', accountId);
    
    // Update display
    updateCurrentAccountDisplay();
    
    // Load account-specific data
    await loadAccountData();
    
    // Close dropdown
    const accountsMenu = document.getElementById('accountsMenu');
    if (accountsMenu) accountsMenu.classList.add('hidden');
    
    showSuccessMessage(`Switched to ${getCurrentAccount().name}`);
};

// Get current account object
function getCurrentAccount() {
    return userAccounts.find(acc => acc.id === currentAccountId) || userAccounts[0];
}

// Save current account data before switching
async function saveCurrentAccountData() {
    const currentAccount = getCurrentAccount();
    
    // Save account settings
    const accountSizeInput = document.getElementById('accountSize');
    if (accountSizeInput) {
        currentAccount.balance = parseFloat(accountSizeInput.value) || 10000;
    }
    
    const accountCurrencySelect = document.getElementById('accountCurrency');
    if (accountCurrencySelect) {
        currentAccount.currency = accountCurrencySelect.value;
    }
    
    saveUserAccounts();
}

// Load account-specific data
async function loadAccountData() {
    showLoading();
    console.log('📊 Loading account data for:', currentAccountId);
    
    try {
        // Load trades for current account
        await loadTrades();
        
        // Load affirmations (shared across accounts)
        await loadAffirmations();
        
        // Update all displays
        updateStats(allTrades);
        renderCharts(allTrades);
        calculateAdvancedMetrics(allTrades);
        
        console.log('✅ Account data loaded successfully');
        
    } catch (error) {
        console.error('❌ Error loading account data:', error);
        alert('Error loading account data. Please check console and refresh the page.');
    } finally {
        hideLoading();
    }
}

// Add Account Modal Functions
window.showAddAccountModal = () => {
    document.getElementById('addAccountModal').classList.remove('hidden');
    document.getElementById('accountName').value = '';
    document.getElementById('accountBalance').value = '10000';
    document.getElementById('accountCurrencySelect').value = 'USD';
    document.getElementById('accountNameCharCount').textContent = '0';
    
    // Close other dropdowns
    document.getElementById('accountsMenu')?.classList.add('hidden');
    document.getElementById('mobileMenu')?.classList.add('hidden');
};

window.closeAddAccountModal = () => {
    document.getElementById('addAccountModal').classList.add('hidden');
};

// Handle add account form submission
function setupAccountModalListeners() {
    const addAccountForm = document.getElementById('addAccountForm');
    if (addAccountForm) {
        addAccountForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const accountName = document.getElementById('accountName').value.trim();
            const accountBalance = parseFloat(document.getElementById('accountBalance').value);
            const accountCurrency = document.getElementById('accountCurrencySelect').value;
            
            if (!accountName) {
                alert('Please enter an account name.');
                return;
            }
            
            if (accountName.length > 50) {
                alert('Account name must be 50 characters or less.');
                return;
            }
            
            // Check if account name already exists
            if (userAccounts.some(acc => acc.name.toLowerCase() === accountName.toLowerCase())) {
                alert('An account with this name already exists. Please choose a different name.');
                return;
            }
            
            const newAccount = {
                id: 'account_' + Date.now(),
                name: accountName,
                balance: accountBalance,
                currency: accountCurrency,
                createdAt: new Date().toISOString(),
                isDefault: false
            };
            
            userAccounts.push(newAccount);
            saveUserAccounts();
            
            closeAddAccountModal();
            renderAccountsList();
            showSuccessMessage(`Account "${accountName}" created successfully!`);
        });
    }

    // Update character count for account name
    const accountNameInput = document.getElementById('accountName');
    if (accountNameInput) {
        accountNameInput.addEventListener('input', function() {
            document.getElementById('accountNameCharCount').textContent = this.value.length;
        });
    }
}

// Delete account function
window.deleteAccount = (accountId) => {
    const account = userAccounts.find(acc => acc.id === accountId);
    if (!account) return;
    
    if (account.isDefault) {
        alert('Cannot delete the default main account.');
        return;
    }
    
    if (confirm(`Are you sure you want to delete "${account.name}"? This will also delete all trades associated with this account.`)) {
        // Delete account
        userAccounts = userAccounts.filter(acc => acc.id !== accountId);
        saveUserAccounts();
        
        // If deleting current account, switch to main account
        if (currentAccountId === accountId) {
            switchAccount(userAccounts[0].id);
        }
        
        // Delete account-specific trades from Firestore
        deleteAccountTrades(accountId);
        
        renderAccountsList();
        showSuccessMessage(`Account "${account.name}" deleted successfully!`);
    }
};

// Delete all trades for a specific account
async function deleteAccountTrades(accountId) {
    try {
        const q = query(
            collection(db, 'trades'), 
            where('userId', '==', currentUser.uid),
            where('accountId', '==', accountId)
        );
        const querySnapshot = await getDocs(q);
        
        const deletePromises = [];
        querySnapshot.forEach((doc) => {
            deletePromises.push(deleteDoc(doc.ref));
        });
        
        await Promise.all(deletePromises);
        console.log(`🗑️ Deleted ${deletePromises.length} trades for account ${accountId}`);
    } catch (error) {
        console.error('Error deleting account trades:', error);
    }
}

// ========== UTILITY FUNCTIONS ==========

function getSelectedCurrency() {
    return document.getElementById('accountCurrency')?.value || 'USD';
}

function getCurrencySymbol(currencyCode = null) {
    if (!currencyCode) currencyCode = getSelectedCurrency();
    return currencySymbols[currencyCode] || '$';
}

function formatCurrency(amount, currencyCode = null) {
    if (!currencyCode) currencyCode = getSelectedCurrency();
    const symbol = getCurrencySymbol(currencyCode);
    return `${symbol}${amount.toFixed(2)}`;
}

function showLoading() {
    const loadingIndicator = document.getElementById('loadingIndicator');
    if (loadingIndicator) {
        loadingIndicator.style.display = 'flex';
        console.log('⏳ Showing loading indicator');
    }
}

function hideLoading() {
    const loadingIndicator = document.getElementById('loadingIndicator');
    if (loadingIndicator) {
        loadingIndicator.style.display = 'none';
        console.log('✅ Hiding loading indicator');
    }
}

// Debug function to check current state
window.debugState = () => {
    console.log('=== DEBUG STATE ===');
    console.log('Current User:', currentUser);
    console.log('Current Account ID:', currentAccountId);
    console.log('All Trades:', allTrades);
    console.log('User Accounts:', userAccounts);
    console.log('Current Account:', getCurrentAccount());
    console.log('=== END DEBUG ===');
};

// ========== AUTHENTICATION ==========

onAuthStateChanged(auth, async (user) => {
    console.log('🔐 Auth state changed:', user ? 'User logged in' : 'No user');
    
    if (user) {
        currentUser = user;
        const userEmailElement = document.getElementById('user-email');
        const mobileUserEmailElement = document.getElementById('mobile-user-email');
        
        if (userEmailElement) userEmailElement.textContent = user.email;
        if (mobileUserEmailElement) mobileUserEmailElement.textContent = user.email;
        
        showLoading();
        console.log('👤 User authenticated:', user.email);
        
        try {
            // Initialize accounts system FIRST (now loads from Firestore)
            await initializeAccounts();
            
            // Then load user settings and data
            await loadUserSettings();
            await loadAccountData(); // This will load trades and affirmations
            
            // Setup all event listeners
            setupEventListeners();
            setupTabs();
            setupMobileMenu();
            setupAccountModalListeners();
            
            console.log('✅ All systems initialized successfully');
            
        } catch (error) {
            console.error('❌ Error during initialization:', error);
            alert('Error initializing application. Please check console and refresh the page.');
        } finally {
            hideLoading();
        }
    } else {
        console.log('🚪 No user, redirecting to login');
        window.location.href = 'index.html';
    }
});

// ========== EVENT LISTENERS ==========

function setupEventListeners() {
    console.log('🔧 Setting up event listeners...');
    
    // Trade form listener
    const tradeForm = document.getElementById('tradeForm');
    if (tradeForm) {
        tradeForm.addEventListener('submit', (e) => {
            e.preventDefault();
            addTrade(e);
        });
    }

    // Account settings listeners
    ['riskPerTrade', 'leverage'].forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('change', (e) => {
                const value = id === 'riskPerTrade' ? parseFloat(e.target.value) : parseInt(e.target.value);
                localStorage.setItem(id, value);
                updateRiskCalculation();
            });
        }
    });

    // Currency change listener
    const accountCurrency = document.getElementById('accountCurrency');
    if (accountCurrency) {
        accountCurrency.addEventListener('change', (e) => {
            const newCurrency = e.target.value;
            // Update current account currency
            const currentAccount = getCurrentAccount();
            currentAccount.currency = newCurrency;
            saveUserAccounts();
            
            localStorage.setItem('accountCurrency', newCurrency);
            updateCurrencyDisplay();
            updateStats(allTrades);
            renderCharts(allTrades);
            updateRiskCalculation();
        });
    }

    // Trade form listeners for real-time calculations
    ['entryPrice', 'stopLoss', 'takeProfit', 'lotSize', 'direction', 'symbol', 'mood'].forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('input', () => updateRiskCalculation());
            element.addEventListener('change', () => updateRiskCalculation());
        }
    });

    const symbolSelect = document.getElementById('symbol');
    if (symbolSelect) symbolSelect.addEventListener('change', updateInstrumentType);
    
    updateRiskCalculation();
    setupAffirmationsEventListeners();
    setupAccountBalanceLock();
    
    console.log('✅ Event listeners setup complete');
}

// ========== AFFIRMATIONS FUNCTIONS ==========

function setupAffirmationsEventListeners() {
    const affirmationForm = document.getElementById('affirmationForm');
    if (affirmationForm) {
        affirmationForm.addEventListener('submit', handleAffirmationSubmit);
    }

    const affirmationText = document.getElementById('affirmationText');
    if (affirmationText) {
        affirmationText.addEventListener('input', updateCharCount);
    }

    const categoryFilters = document.querySelectorAll('.category-filter');
    categoryFilters.forEach(filter => {
        filter.addEventListener('click', handleCategoryFilter);
    });

    const searchInput = document.getElementById('searchAffirmations');
    if (searchInput) {
        searchInput.addEventListener('input', handleSearchAffirmations);
    }

    const sortSelect = document.getElementById('sortAffirmations');
    if (sortSelect) {
        sortSelect.addEventListener('change', handleSortAffirmations);
    }
}

async function loadAffirmations() {
    try {
        if (!currentUser) {
            console.log('❌ No user for affirmations');
            return;
        }

        console.log('📖 Loading affirmations...');
        const q = query(collection(db, 'affirmations'), where('userId', '==', currentUser.uid));
        const querySnapshot = await getDocs(q);
        
        const affirmations = [];
        querySnapshot.forEach((doc) => {
            affirmations.push({ id: doc.id, ...doc.data() });
        });

        // If no affirmations found, initialize with sample data
        if (affirmations.length === 0) {
            console.log('📝 No affirmations found, creating sample data...');
            // Add sample affirmations to Firestore
            for (const sampleAffirmation of sampleAffirmations) {
                const affirmationData = {
                    ...sampleAffirmation,
                    userId: currentUser.uid
                };
                await addDoc(collection(db, 'affirmations'), affirmationData);
            }
            // Reload affirmations after adding samples
            await loadAffirmations();
            return;
        }

        allAffirmations = affirmations;
        updateAffirmationStats();
        renderAffirmationsGrid();
        setupDailyAffirmation();
        console.log('✅ Affirmations loaded:', affirmations.length);
    } catch (error) {
        console.error('❌ Error loading affirmations:', error);
        // Fallback to sample data if there's an error
        allAffirmations = [...sampleAffirmations];
        updateAffirmationStats();
        renderAffirmationsGrid();
        setupDailyAffirmation();
    }
}

// ========== TRADING FUNCTIONS ==========

// Modified loadTrades function to be account-specific
async function loadTrades() {
    try {
        console.log('📊 Loading trades for account:', currentAccountId);
        
        if (!currentUser) {
            console.log('❌ No user for trades');
            throw new Error('No authenticated user');
        }

        const q = query(
            collection(db, 'trades'), 
            where('userId', '==', currentUser.uid),
            where('accountId', '==', currentAccountId)
        );
        const querySnapshot = await getDocs(q);
        
        const trades = [];
        querySnapshot.forEach((doc) => {
            trades.push({ id: doc.id, ...doc.data() });
        });

        trades.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        allTrades = trades;
        setupPagination(trades);
        updateStats(trades);
        renderCharts(trades);
        calculateAdvancedMetrics(trades);
        
        console.log('✅ Trades loaded:', trades.length);
        
    } catch (error) {
        console.error('❌ Error loading trades:', error);
        const tradeHistory = document.getElementById('tradeHistory');
        if (tradeHistory) {
            tradeHistory.innerHTML = `
                <div class="text-center text-red-500 py-4">
                    <p>Error loading trades: ${error.message}</p>
                    <button onclick="location.reload()" class="btn bg-blue-500 text-white mt-2">🔄 Refresh</button>
                </div>
            `;
        }
        // Re-throw to be caught by the calling function
        throw error;
    }
}

// Trade CRUD operations
async function addTrade(e) {
    e.preventDefault();
    const submitButton = e.target.querySelector('button[type="submit"]');
    const originalText = submitButton.innerHTML;
    submitButton.innerHTML = '<div class="loading-spinner"></div> Saving...';
    submitButton.disabled = true;

    try {
        const symbol = document.getElementById('symbol')?.value;
        const entryPrice = parseFloat(document.getElementById('entryPrice')?.value);
        const stopLoss = parseFloat(document.getElementById('stopLoss')?.value);
        const takeProfit = parseFloat(document.getElementById('takeProfit')?.value) || null;
        const lotSize = parseFloat(document.getElementById('lotSize')?.value);
        const tradeType = document.getElementById('direction')?.value;
        const mood = document.getElementById('mood')?.value || '';
        const currentAccount = getCurrentAccount();
        const accountSize = currentAccount.balance;
        const leverage = parseInt(document.getElementById('leverage')?.value) || 50;

        if (!symbol || !entryPrice || !stopLoss || !lotSize || !tradeType) {
            alert('Please fill all required fields');
            return;
        }

        const instrumentType = getInstrumentType(symbol);
        const exitPrice = takeProfit || entryPrice;
        const profit = calculateProfitLoss(entryPrice, exitPrice, lotSize, symbol, tradeType);
        const pipPointInfo = calculatePipsPoints(entryPrice, stopLoss, takeProfit, symbol, tradeType);

        const tradeData = {
            symbol, 
            type: tradeType, 
            instrumentType, 
            entryPrice, 
            stopLoss, 
            takeProfit, 
            lotSize,
            mood: mood,
            beforeScreenshot: document.getElementById('beforeScreenshot')?.value || '',
            afterScreenshot: document.getElementById('afterScreenshot')?.value || '',
            notes: document.getElementById('notes')?.value || '', 
            timestamp: new Date().toISOString(),
            profit, 
            pipsPoints: pipPointInfo.risk,
            riskAmount: Math.abs(calculateProfitLoss(entryPrice, stopLoss, lotSize, symbol, tradeType)),
            riskPercent: (Math.abs(calculateProfitLoss(entryPrice, stopLoss, lotSize, symbol, tradeType)) / accountSize) * 100,
            accountSize, 
            leverage, 
            userId: currentUser.uid,
            accountId: currentAccountId
        };

        await addDoc(collection(db, 'trades'), tradeData);
        e.target.reset();
        await loadTrades();
        alert('Trade added successfully!');
    } catch (error) {
        console.error('Error adding trade:', error);
        alert('Error adding trade.');
    } finally {
        submitButton.innerHTML = originalText;
        submitButton.disabled = false;
    }
}

// ========== TAB MANAGEMENT ==========

function setupTabs() {
    const dashboardTab = document.getElementById('dashboardTab');
    const tradesTab = document.getElementById('tradesTab');
    const affirmationsTab = document.getElementById('affirmationsTab');
    const dashboardContent = document.getElementById('dashboardContent');
    const tradesContent = document.getElementById('tradesContent');
    const affirmationsContent = document.getElementById('affirmationsContent');

    function switchToTab(tabName) {
        // Hide all content
        [dashboardContent, tradesContent, affirmationsContent].forEach(content => {
            if (content) {
                content.classList.remove('active');
                content.style.display = 'none';
            }
        });

        // Remove active class from all tabs
        [dashboardTab, tradesTab, affirmationsTab].forEach(tab => {
            if (tab) tab.classList.remove('active');
        });

        // Show selected content and activate tab
        switch(tabName) {
            case 'dashboard':
                if (dashboardContent) {
                    dashboardContent.classList.add('active');
                    dashboardContent.style.display = 'block';
                }
                if (dashboardTab) dashboardTab.classList.add('active');
                break;
            case 'trades':
                if (tradesContent) {
                    tradesContent.classList.add('active');
                    tradesContent.style.display = 'block';
                }
                if (tradesTab) tradesTab.classList.add('active');
                break;
            case 'affirmations':
                if (affirmationsContent) {
                    affirmationsContent.classList.add('active');
                    affirmationsContent.style.display = 'block';
                    loadAffirmations();
                }
                if (affirmationsTab) affirmationsTab.classList.add('active');
                break;
        }
    }

    // Add event listeners
    if (dashboardTab) {
        dashboardTab.addEventListener('click', () => switchToTab('dashboard'));
    }
    if (tradesTab) {
        tradesTab.addEventListener('click', () => switchToTab('trades'));
    }
    if (affirmationsTab) {
        affirmationsTab.addEventListener('click', () => switchToTab('affirmations'));
    }
    
    console.log('✅ Tabs setup complete');
}

// ========== MOBILE MENU ==========

function setupMobileMenu() {
    const mobileMenuButton = document.getElementById('mobileMenuButton');
    const mobileMenu = document.getElementById('mobileMenu');

    if (mobileMenuButton && mobileMenu) {
        mobileMenuButton.addEventListener('click', () => {
            mobileMenu.classList.toggle('hidden');
            renderAccountsList();
        });

        document.addEventListener('click', (e) => {
            if (!mobileMenu.contains(e.target) && !mobileMenuButton.contains(e.target)) {
                mobileMenu.classList.add('hidden');
            }
        });
    }
    
    console.log('✅ Mobile menu setup complete');
}

// ========== ACCOUNT BALANCE LOCK SYSTEM ==========

function setupAccountBalanceLock() {
    const accountSizeInput = document.getElementById('accountSize');
    const lockToggle = document.getElementById('lockToggle');
    const balanceHelp = document.getElementById('balanceHelp');
    
    if (!accountSizeInput || !lockToggle) return;
    
    let isLocked = localStorage.getItem('accountBalanceLocked') === 'true';
    
    function updateLockState() {
        if (isLocked) {
            accountSizeInput.readOnly = true;
            accountSizeInput.classList.add('bg-gray-100', 'cursor-not-allowed');
            lockToggle.innerHTML = '🔒 Locked';
            lockToggle.classList.remove('bg-green-100', 'text-green-600', 'hover:bg-green-200');
            lockToggle.classList.add('bg-blue-100', 'text-blue-600', 'hover:bg-blue-200');
            balanceHelp.textContent = 'Balance is locked to maintain accurate performance tracking';
        } else {
            accountSizeInput.readOnly = false;
            accountSizeInput.classList.remove('bg-gray-100', 'cursor-not-allowed');
            lockToggle.innerHTML = '🔓 Unlocked';
            lockToggle.classList.remove('bg-blue-100', 'text-blue-600', 'hover:bg-blue-200');
            lockToggle.classList.add('bg-green-100', 'text-green-600', 'hover:bg-green-200');
            balanceHelp.textContent = 'Set your initial trading capital - lock after setting';
        }
    }
    
    lockToggle.addEventListener('click', async () => {
        if (isLocked) {
            if (confirm('⚠️ Unlocking account balance may affect your performance metrics.\n\nAre you sure you want to unlock?')) {
                isLocked = false;
                localStorage.setItem('accountBalanceLocked', 'false');
                updateLockState();
                showSuccessMessage('Account balance unlocked. Remember to lock it after changes.');
            }
        } else {
            isLocked = true;
            localStorage.setItem('accountBalanceLocked', 'true');
            
            const currentValue = accountSizeInput.value;
            if (currentValue && currentValue !== '10000') {
                const currentAccount = getCurrentAccount();
                currentAccount.balance = parseFloat(currentValue);
                await saveUserAccounts(); // Save to Firestore
            }
            
            updateLockState();
            showSuccessMessage('Account balance locked! 🔒');
            
            updateStats(allTrades);
            renderCharts(allTrades);
        }
    });
    
    accountSizeInput.addEventListener('blur', async () => {
        if (!isLocked && accountSizeInput.value && accountSizeInput.value !== '10000') {
            const currentAccount = getCurrentAccount();
            currentAccount.balance = parseFloat(accountSizeInput.value);
            await saveUserAccounts(); // Save to Firestore
            updateStats(allTrades);
            renderCharts(allTrades);
        }
    });
    
    updateLockState();
    console.log('✅ Account balance lock setup complete');
}

// ========== UTILITY FUNCTIONS ==========

async function loadUserSettings() {
    const riskPerTrade = localStorage.getItem('riskPerTrade') || 1.0;
    const leverage = localStorage.getItem('leverage') || 50;

    document.getElementById('riskPerTrade').value = riskPerTrade;
    document.getElementById('leverage').value = leverage;
    
    updateCurrencyDisplay();
    console.log('✅ User settings loaded');
}

function updateCurrencyDisplay() {
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

function showSuccessMessage(message) {
    const successDiv = document.createElement('div');
    successDiv.className = 'fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 transform transition-all duration-300';
    successDiv.textContent = message;
    document.body.appendChild(successDiv);
    
    setTimeout(() => {
        successDiv.remove();
    }, 3000);
}

// ========== AFFIRMATIONS FUNCTIONS WITH FIRESTORE ==========

function updateAffirmationStats() {
    const total = allAffirmations.length;
    const active = allAffirmations.filter(a => a.isActive).length;
    const favorites = allAffirmations.filter(a => a.isFavorite).length;
    const usedThisWeek = allAffirmations.filter(a => {
        const lastUsed = new Date(a.lastUsed);
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        return lastUsed > weekAgo;
    }).length;

    document.getElementById('totalAffirmations').textContent = total;
    document.getElementById('activeAffirmations').textContent = active;
    document.getElementById('favoriteAffirmations').textContent = favorites;
    document.getElementById('usedThisWeek').textContent = usedThisWeek;
}

function renderAffirmationsGrid(filteredAffirmations = null) {
    const grid = document.getElementById('affirmationsGrid');
    const emptyState = document.getElementById('emptyAffirmations');
    const affirmations = filteredAffirmations || allAffirmations;

    if (affirmations.length === 0) {
        grid.innerHTML = '';
        emptyState.classList.remove('hidden');
        return;
    }

    emptyState.classList.add('hidden');
    
    grid.innerHTML = affirmations.map(affirmation => `
        <div class="affirmation-card bg-gradient-to-br from-white to-gray-50 border-l-4 border-${getCategoryColor(affirmation.category)}-500 p-6 rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300">
            <div class="flex justify-between items-start mb-4">
                <div class="flex-1">
                    <p class="text-lg font-semibold text-gray-800 leading-relaxed">"${affirmation.text}"</p>
                    <div class="flex items-center mt-3 space-x-3">
                        <span class="category-badge bg-${getCategoryColor(affirmation.category)}-100 text-${getCategoryColor(affirmation.category)}-800 px-3 py-1 rounded-full text-xs font-semibold">
                            ${getCategoryDisplayName(affirmation.category)}
                        </span>
                        <div class="flex items-center text-xs text-gray-500">
                            <span class="mr-1">🔥</span>
                            <span>${affirmation.usageCount} uses</span>
                        </div>
                    </div>
                </div>
                <div class="flex space-x-2 ml-4">
                    <button onclick="toggleFavorite('${affirmation.id}')" class="favorite-btn ${affirmation.isFavorite ? 'text-yellow-400' : 'text-gray-300'} hover:text-yellow-600 transition-transform duration-300 hover:scale-125" title="Favorite">
                        ⭐
                    </button>
                </div>
            </div>
            <div class="flex justify-between items-center mt-4 pt-4 border-t border-gray-100">
                <div class="flex space-x-2">
                    <button onclick="useAffirmation('${affirmation.id}')" class="use-btn bg-blue-50 text-blue-600 hover:bg-blue-100 px-4 py-2 rounded-lg font-semibold text-sm transition-all duration-300 hover:scale-105">
                        ✅ Use Now
                    </button>
                    <button onclick="copyAffirmation('${affirmation.id}')" class="copy-btn bg-gray-50 text-gray-600 hover:bg-gray-100 px-4 py-2 rounded-lg font-semibold text-sm transition-all duration-300 hover:scale-105">
                        📋 Copy
                    </button>
                    <button onclick="deleteAffirmation('${affirmation.id}')" class="delete-btn bg-red-50 text-red-600 hover:bg-red-100 px-3 py-2 rounded-lg font-semibold text-sm transition-all duration-300 hover:scale-105">
                        🗑️ Delete
                    </button>
                </div>
                <span class="text-xs text-gray-400">${formatRelativeTime(affirmation.createdAt)}</span>
            </div>
        </div>
    `).join('');
}

function getCategoryColor(category) {
    const colors = {
        'confidence': 'green',
        'discipline': 'purple',
        'patience': 'yellow',
        'risk-management': 'red',
        'mindset': 'indigo',
        'general': 'blue'
    };
    return colors[category] || 'blue';
}

function getCategoryDisplayName(category) {
    const names = {
        'confidence': 'Confidence',
        'discipline': 'Discipline',
        'patience': 'Patience',
        'risk-management': 'Risk Management',
        'mindset': 'Mindset',
        'general': 'General'
    };
    return names[category] || 'General';
}

function formatRelativeTime(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffInDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
    
    if (diffInDays === 0) return 'Today';
    if (diffInDays === 1) return 'Yesterday';
    if (diffInDays < 7) return `${diffInDays} days ago`;
    if (diffInDays < 30) return `${Math.floor(diffInDays / 7)} weeks ago`;
    return `${Math.floor(diffInDays / 30)} months ago`;
}

function setupDailyAffirmation() {
    const dailyAffirmation = getRandomAffirmation();
    if (dailyAffirmation) {
        document.getElementById('dailyAffirmation').textContent = `"${dailyAffirmation.text}"`;
        document.getElementById('dailyAffirmationCategory').textContent = getCategoryDisplayName(dailyAffirmation.category);
        document.getElementById('affirmationStrength').textContent = `${dailyAffirmation.strength}%`;
    }
}

function getRandomAffirmation() {
    const activeAffirmations = allAffirmations.filter(a => a.isActive);
    if (activeAffirmations.length === 0) return null;
    return activeAffirmations[Math.floor(Math.random() * activeAffirmations.length)];
}

// Affirmations Modal Functions
window.addNewAffirmation = () => {
    editingAffirmationId = null;
    document.getElementById('modalTitle').textContent = 'Create New Affirmation';
    document.getElementById('affirmationText').value = '';
    document.getElementById('affirmationCategorySelect').value = 'confidence';
    document.getElementById('isFavorite').checked = false;
    document.getElementById('isActive').checked = true;
    updateCharCount();
    document.getElementById('affirmationModal').classList.remove('hidden');
};

window.closeAffirmationModal = () => {
    document.getElementById('affirmationModal').classList.add('hidden');
};

function updateCharCount() {
    const text = document.getElementById('affirmationText').value;
    document.getElementById('charCount').textContent = text.length;
}

async function handleAffirmationSubmit(e) {
    e.preventDefault();
    
    const text = document.getElementById('affirmationText').value.trim();
    const category = document.getElementById('affirmationCategorySelect').value;
    const isFavorite = document.getElementById('isFavorite').checked;
    const isActive = document.getElementById('isActive').checked;
    
    if (!text) {
        alert('Please enter an affirmation text.');
        return;
    }
    
    if (text.length > 200) {
        alert('Affirmation text must be 200 characters or less.');
        return;
    }
    
    const affirmationData = {
        text,
        category,
        isFavorite,
        isActive,
        usageCount: 0,
        lastUsed: null,
        createdAt: new Date().toISOString(),
        strength: Math.floor(Math.random() * 20) + 80,
        userId: currentUser.uid
    };
    
    try {
        if (editingAffirmationId) {
            // Update existing affirmation in Firestore
            const affirmationRef = doc(db, 'affirmations', editingAffirmationId);
            await updateDoc(affirmationRef, affirmationData);
            
            // Update local state
            const index = allAffirmations.findIndex(a => a.id === editingAffirmationId);
            if (index !== -1) {
                allAffirmations[index] = { ...allAffirmations[index], ...affirmationData };
            }
        } else {
            // Add new affirmation to Firestore
            const docRef = await addDoc(collection(db, 'affirmations'), affirmationData);
            
            // Add to local state with Firestore ID
            const newAffirmation = {
                id: docRef.id,
                ...affirmationData
            };
            allAffirmations.unshift(newAffirmation);
        }
        
        closeAffirmationModal();
        updateAffirmationStats();
        renderAffirmationsGrid();
        showSuccessMessage(editingAffirmationId ? 'Affirmation updated successfully!' : 'Affirmation created successfully!');
    } catch (error) {
        console.error('Error saving affirmation:', error);
        alert('Error saving affirmation. Please try again.');
    }
}

// Affirmation Actions
window.useAffirmation = async (id) => {
    try {
        const affirmation = allAffirmations.find(a => a.id === id);
        if (affirmation) {
            const updatedData = {
                usageCount: affirmation.usageCount + 1,
                lastUsed: new Date().toISOString()
            };
            
            // Update in Firestore
            const affirmationRef = doc(db, 'affirmations', id);
            await updateDoc(affirmationRef, updatedData);
            
            // Update local state
            affirmation.usageCount = updatedData.usageCount;
            affirmation.lastUsed = updatedData.lastUsed;
            
            updateAffirmationStats();
            renderAffirmationsGrid();
            showSuccessMessage('Affirmation marked as used! 💪');
        }
    } catch (error) {
        console.error('Error updating affirmation:', error);
        alert('Error updating affirmation.');
    }
};

window.copyAffirmation = (id) => {
    const affirmation = allAffirmations.find(a => a.id === id);
    if (affirmation) {
        navigator.clipboard.writeText(affirmation.text)
            .then(() => showSuccessMessage('Affirmation copied to clipboard! 📋'))
            .catch(() => alert('Failed to copy affirmation.'));
    }
};

window.toggleFavorite = async (id) => {
    try {
        const affirmation = allAffirmations.find(a => a.id === id);
        if (affirmation) {
            const updatedData = {
                isFavorite: !affirmation.isFavorite
            };
            
            // Update in Firestore
            const affirmationRef = doc(db, 'affirmations', id);
            await updateDoc(affirmationRef, updatedData);
            
            // Update local state
            affirmation.isFavorite = updatedData.isFavorite;
            renderAffirmationsGrid();
        }
    } catch (error) {
        console.error('Error updating favorite:', error);
        alert('Error updating favorite.');
    }
};

// Delete affirmation function
window.deleteAffirmation = async (id) => {
    if (confirm('Are you sure you want to delete this affirmation?')) {
        try {
            // Delete from Firestore
            await deleteDoc(doc(db, 'affirmations', id));
            
            // Remove from local state
            allAffirmations = allAffirmations.filter(a => a.id !== id);
            
            updateAffirmationStats();
            renderAffirmationsGrid();
            showSuccessMessage('Affirmation deleted successfully!');
        } catch (error) {
            console.error('Error deleting affirmation:', error);
            alert('Error deleting affirmation.');
        }
    }
};

// Random Affirmation Modal
window.showRandomAffirmation = () => {
    const randomAffirmation = getRandomAffirmation();
    if (randomAffirmation) {
        document.getElementById('randomAffirmationText').textContent = `"${randomAffirmation.text}"`;
        document.getElementById('randomAffirmationModal').classList.remove('hidden');
    } else {
        alert('No active affirmations available.');
    }
};

window.closeRandomModal = () => {
    document.getElementById('randomAffirmationModal').classList.add('hidden');
};

window.showAnotherRandom = () => {
    const randomAffirmation = getRandomAffirmation();
    if (randomAffirmation) {
        document.getElementById('randomAffirmationText').textContent = `"${randomAffirmation.text}"`;
    }
};

window.useRandomAffirmation = async () => {
    try {
        const randomAffirmation = getRandomAffirmation();
        if (randomAffirmation) {
            const updatedData = {
                usageCount: randomAffirmation.usageCount + 1,
                lastUsed: new Date().toISOString()
            };
            
            // Update in Firestore
            const affirmationRef = doc(db, 'affirmations', randomAffirmation.id);
            await updateDoc(affirmationRef, updatedData);
            
            // Update local state
            randomAffirmation.usageCount = updatedData.usageCount;
            randomAffirmation.lastUsed = updatedData.lastUsed;
            
            updateAffirmationStats();
            closeRandomModal();
            showSuccessMessage('Affirmation marked as used! 💪');
        }
    } catch (error) {
        console.error('Error using random affirmation:', error);
        alert('Error using affirmation.');
    }
};

// Daily Affirmation Functions
window.refreshDailyAffirmation = () => {
    setupDailyAffirmation();
    showSuccessMessage('Daily affirmation refreshed! 🔄');
};

window.markDailyAsUsed = async () => {
    try {
        const dailyAffirmationText = document.getElementById('dailyAffirmation').textContent.replace(/"/g, '').trim();
        const affirmation = allAffirmations.find(a => a.text === dailyAffirmationText);
        if (affirmation) {
            const updatedData = {
                usageCount: affirmation.usageCount + 1,
                lastUsed: new Date().toISOString()
            };
            
            // Update in Firestore
            const affirmationRef = doc(db, 'affirmations', affirmation.id);
            await updateDoc(affirmationRef, updatedData);
            
            // Update local state
            affirmation.usageCount = updatedData.usageCount;
            affirmation.lastUsed = updatedData.lastUsed;
            
            updateAffirmationStats();
            showSuccessMessage('Daily affirmation marked as used! ✅');
        }
    } catch (error) {
        console.error('Error marking daily affirmation:', error);
        alert('Error marking affirmation as used.');
    }
};

window.speakAffirmation = () => {
    const affirmationText = document.getElementById('dailyAffirmation').textContent;
    if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(affirmationText);
        utterance.rate = 0.8;
        utterance.pitch = 1;
        speechSynthesis.speak(utterance);
    } else {
        alert('Text-to-speech is not supported in your browser.');
    }
};

// Motivational Quotes
window.showMotivationalQuote = () => {
    const randomQuote = motivationalQuotes[Math.floor(Math.random() * motivationalQuotes.length)];
    alert(`💡 Motivational Quote:\n\n"${randomQuote}"`);
};

// Export Affirmations
window.exportAffirmations = () => {
    const csv = convertAffirmationsToCSV(allAffirmations);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trading-affirmations-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    showSuccessMessage('Affirmations exported successfully! 📤');
};

function convertAffirmationsToCSV(affirmations) {
    const headers = ['Text', 'Category', 'Favorite', 'Active', 'Usage Count', 'Last Used', 'Created At'];
    const csvRows = [headers.join(',')];
    
    affirmations.forEach(affirmation => {
        const row = [
            `"${affirmation.text.replace(/"/g, '""')}"`,
            affirmation.category,
            affirmation.isFavorite ? 'Yes' : 'No',
            affirmation.isActive ? 'Yes' : 'No',
            affirmation.usageCount,
            affirmation.lastUsed ? new Date(affirmation.lastUsed).toLocaleDateString() : '',
            new Date(affirmation.createdAt).toLocaleDateString()
        ];
        csvRows.push(row.join(','));
    });
    
    return csvRows.join('\n');
}

// Filter and Search Functions
function handleCategoryFilter(e) {
    const category = e.target.dataset.category;
    
    document.querySelectorAll('.category-filter').forEach(btn => {
        btn.classList.remove('active');
    });
    e.target.classList.add('active');
    
    let filteredAffirmations;
    if (category === 'all') {
        filteredAffirmations = allAffirmations;
    } else {
        filteredAffirmations = allAffirmations.filter(a => a.category === category);
    }
    
    renderAffirmationsGrid(filteredAffirmations);
}

function handleSearchAffirmations(e) {
    const searchTerm = e.target.value.toLowerCase();
    const filteredAffirmations = allAffirmations.filter(a => 
        a.text.toLowerCase().includes(searchTerm)
    );
    renderAffirmationsGrid(filteredAffirmations);
}

function handleSortAffirmations(e) {
    const sortBy = e.target.value;
    let sortedAffirmations = [...allAffirmations];
    
    switch (sortBy) {
        case 'newest':
            sortedAffirmations.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            break;
        case 'oldest':
            sortedAffirmations.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
            break;
        case 'most-used':
            sortedAffirmations.sort((a, b) => b.usageCount - a.usageCount);
            break;
        case 'favorites':
            sortedAffirmations.sort((a, b) => b.isFavorite - a.isFavorite);
            break;
    }
    
    renderAffirmationsGrid(sortedAffirmations);
}

// ========== TRADING FUNCTIONS ==========

// Trading calculation functions
function getInstrumentType(symbol) {
    const forexPairs = ['EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CHF', 'AUD/USD', 'USD/CAD', 'NZD/USD'];
    const indices = ['US30', 'SPX500', 'NAS100', 'GE30', 'FTSE100', 'NIKKEI225'];
    return forexPairs.includes(symbol) ? 'forex' : indices.includes(symbol) ? 'indices' : 'forex';
}

function getPipSize(symbol) {
    return symbol.includes('JPY') ? 0.01 : 0.0001;
}

function getPointValue(symbol) {
    const pointValues = {'US30': 1, 'SPX500': 50, 'NAS100': 20, 'GE30': 1, 'FTSE100': 1, 'NIKKEI225': 1};
    return pointValues[symbol] || 1;
}

function calculatePipsPoints(entry, sl, tp, symbol, type) {
    const instrumentType = getInstrumentType(symbol);
    if (instrumentType === 'forex') {
        const pipSize = getPipSize(symbol);
        const slPips = type === 'long' ? (entry - sl) / pipSize : (sl - entry) / pipSize;
        let tpPips = 0;
        if (tp) tpPips = type === 'long' ? (tp - entry) / pipSize : (entry - tp) / pipSize;
        return { risk: Math.abs(slPips), reward: Math.abs(tpPips) };
    } else {
        const slPoints = type === 'long' ? (entry - sl) : (sl - entry);
        let tpPoints = 0;
        if (tp) tpPoints = type === 'long' ? (tp - entry) : (entry - tp);
        return { risk: Math.abs(slPoints), reward: Math.abs(tpPoints) };
    }
}

function calculateProfitLoss(entry, exit, lotSize, symbol, type) {
    const instrumentType = getInstrumentType(symbol);
    
    if (instrumentType === 'forex') {
        const pipValue = 10 * lotSize;
        const pipSize = getPipSize(symbol);
        const pips = type === 'long' ? (exit - entry) / pipSize : (entry - exit) / pipSize;
        const profit = pips * pipValue;
        return parseFloat(profit.toFixed(2));
    } else {
        const pointValue = getPointValue(symbol) * lotSize;
        const points = type === 'long' ? (exit - entry) : (entry - exit);
        const profit = points * pointValue;
        return parseFloat(profit.toFixed(2));
    }
}

function updateRiskCalculation() {
    const symbol = document.getElementById('symbol')?.value;
    const entryPrice = parseFloat(document.getElementById('entryPrice')?.value) || 0;
    const stopLoss = parseFloat(document.getElementById('stopLoss')?.value) || 0;
    const takeProfit = parseFloat(document.getElementById('takeProfit')?.value) || 0;
    const lotSize = parseFloat(document.getElementById('lotSize')?.value) || 0.01;
    const tradeType = document.getElementById('direction')?.value;
    const currentAccount = getCurrentAccount();
    const accountSize = currentAccount.balance;
    const riskPerTrade = parseFloat(document.getElementById('riskPerTrade')?.value) || 1.0;

    if (entryPrice > 0 && stopLoss > 0 && symbol) {
        const pipPointInfo = calculatePipsPoints(entryPrice, stopLoss, takeProfit, symbol, tradeType);
        const potentialProfit = takeProfit ? calculateProfitLoss(entryPrice, takeProfit, lotSize, symbol, tradeType) : 0;
        const potentialLoss = calculateProfitLoss(entryPrice, stopLoss, lotSize, symbol, tradeType);
        const riskRewardRatio = takeProfit && potentialLoss !== 0 ? Math.abs(potentialProfit / potentialLoss) : 0;
        const maxRiskAmount = accountSize * (riskPerTrade / 100);
        const riskPerLot = Math.abs(calculateProfitLoss(entryPrice, stopLoss, 1, symbol, tradeType));
        const recommendedLotSize = riskPerLot > 0 ? (maxRiskAmount / riskPerLot).toFixed(2) : 0;
        const instrumentType = getInstrumentType(symbol);
        const unitType = instrumentType === 'forex' ? 'pips' : 'points';

        const riskElements = {
            'pipsRisk': pipPointInfo.risk.toFixed(1) + ' ' + unitType,
            'totalRisk': formatCurrency(Math.abs(potentialLoss)),
            'riskPercentage': (Math.abs(potentialLoss) / accountSize * 100).toFixed(2) + '%',
            'riskRewardRatio': riskRewardRatio.toFixed(2),
            'recommendedLotSize': recommendedLotSize
        };

        Object.entries(riskElements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) element.textContent = value;
        });

        const pipDisplays = {
            'entryPipDisplay': `Entry: ${entryPrice}`,
            'slPipDisplay': `SL: ${stopLoss} (${pipPointInfo.risk.toFixed(1)} ${unitType})`,
            'tpPipDisplay': takeProfit ? `TP: ${takeProfit} (${pipPointInfo.reward.toFixed(1)} ${unitType})` : ''
        };

        Object.entries(pipDisplays).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) element.textContent = value;
        });
    }
}

window.updateInstrumentType = () => {
    const symbol = document.getElementById('symbol')?.value;
    if (symbol) {
        const instrumentType = getInstrumentType(symbol);
        const displayText = instrumentType === 'forex' ? 'Forex' : 'Index';
        const badgeClass = instrumentType === 'forex' ? 'forex-badge' : 'indices-badge';
        const displayElement = document.getElementById('instrumentTypeDisplay');
        if (displayElement) displayElement.innerHTML = `<span class="market-type-badge ${badgeClass}">${displayText}</span>`;
        updateRiskCalculation();
    }
};

// Pagination functions
function setupPagination(trades) {
    allTrades = trades;
    currentPage = 1;
    renderPagination();
    displayTradesPage(currentPage);
}

function displayTradesPage(page) {
    currentPage = page;
    const startIndex = (page - 1) * tradesPerPage;
    const endIndex = startIndex + tradesPerPage;
    const pageTrades = allTrades.slice(startIndex, endIndex);
    
    displayTrades(pageTrades);
    renderPagination();
}

function renderPagination() {
    const totalPages = Math.ceil(allTrades.length / tradesPerPage);
    const paginationContainer = document.getElementById('pagination');
    
    if (!paginationContainer || totalPages <= 1) {
        if (paginationContainer) paginationContainer.innerHTML = '';
        return;
    }

    let paginationHTML = '';
    
    if (currentPage > 1) {
        paginationHTML += `<button onclick="displayTradesPage(${currentPage - 1})" class="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300">← Previous</button>`;
    }
    
    for (let i = 1; i <= totalPages; i++) {
        if (i === currentPage) {
            paginationHTML += `<span class="px-3 py-1 bg-blue-500 text-white rounded">${i}</span>`;
        } else {
            paginationHTML += `<button onclick="displayTradesPage(${i})" class="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300">${i}</button>`;
        }
    }
    
    if (currentPage < totalPages) {
        paginationHTML += `<button onclick="displayTradesPage(${currentPage + 1})" class="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300">Next →</button>`;
    }
    
    paginationContainer.innerHTML = paginationHTML;
}

function displayTrades(trades) {
    const container = document.getElementById('tradeHistory');
    const tradeCount = document.getElementById('tradeCount');
    if (!container) return;

    if (trades.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-500 py-4">No trades recorded yet.</p>';
        if (tradeCount) tradeCount.textContent = '0 trades';
        return;
    }

    if (tradeCount) {
        const totalTrades = allTrades.length;
        const startIndex = (currentPage - 1) * tradesPerPage + 1;
        const endIndex = Math.min(currentPage * tradesPerPage, totalTrades);
        tradeCount.textContent = `Showing ${startIndex}-${endIndex} of ${totalTrades} trades`;
    }

    container.innerHTML = trades.map(trade => {
        const badgeClass = trade.instrumentType === 'forex' ? 'forex-badge' : 'indices-badge';
        const badgeText = trade.instrumentType === 'forex' ? 'FX' : 'IDX';
        const profitClass = trade.profit >= 0 ? 'profit' : 'loss';
        const moodEmoji = getMoodEmoji(trade.mood);
        
        return `
        <div class="trade-item">
            <div class="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
                <div class="flex-1 min-w-0">
                    <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1 mb-2">
                        <div class="font-semibold text-sm sm:text-base">
                            ${trade.symbol} <span class="market-type-badge ${badgeClass}">${badgeText}</span>
                            ${moodEmoji ? `<span class="ml-1">${moodEmoji}</span>` : ''}
                        </div>
                        <div class="${profitClass} font-bold text-sm sm:text-base">
                            ${formatCurrency(trade.profit)}
                        </div>
                    </div>
                    <div class="text-xs text-gray-600 space-y-1">
                        <div>${trade.type.toUpperCase()} | ${trade.lotSize} lots | Entry: ${trade.entryPrice}</div>
                        <div>SL: ${trade.stopLoss}${trade.takeProfit ? ` | TP: ${trade.takeProfit}` : ''}</div>
                        <div>Risk: ${formatCurrency(trade.riskAmount)} (${trade.riskPercent.toFixed(1)}%)</div>
                        <div class="text-gray-500">${new Date(trade.timestamp).toLocaleDateString()}</div>
                    </div>
                    ${trade.notes ? `<div class="mt-2 text-xs italic text-gray-700 bg-gray-50 p-2 rounded">${trade.notes}</div>` : ''}
                </div>
                <div class="trade-actions">
                    ${trade.beforeScreenshot ? `<button onclick="viewScreenshot('${trade.beforeScreenshot}')" class="btn-sm bg-blue-500 text-white text-xs hover:bg-blue-600 transition-colors">📸 Before</button>` : ''}
                    ${trade.afterScreenshot ? `<button onclick="viewScreenshot('${trade.afterScreenshot}')" class="btn-sm bg-green-500 text-white text-xs hover:bg-green-600 transition-colors">📸 After</button>` : ''}
                    <button onclick="deleteTrade('${trade.id}')" class="btn-sm bg-red-500 text-white text-xs hover:bg-red-600 transition-colors">🗑️ Delete</button>
                </div>
            </div>
        </div>`;
    }).join('');
}

// Import/Export functions
window.importTrades = () => {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.csv';
    
    fileInput.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        try {
            showLoading();
            const text = await file.text();
            const trades = parseCSV(text);
            
            if (trades.length === 0) {
                alert('No valid trades found in the CSV file. Please check the format.');
                return;
            }
            
            const previewText = trades.slice(0, 5).map((trade, i) => 
                `${i + 1}. ${trade.symbol} ${trade.type} - Profit: ${formatCurrency(trade.profit)}`
            ).join('\n');
            
            const extraTrades = trades.length > 5 ? `\n... and ${trades.length - 5} more trades` : '';
            
            if (confirm(`Found ${trades.length} trades:\n\n${previewText}${extraTrades}\n\nImport these trades?`)) {
                await importTradesToFirestore(trades);
                await loadTrades();
                alert(`✅ Successfully imported ${trades.length} trades!\n\nAll trade calculations have been verified and updated.`);
            }
        } catch (error) {
            console.error('Error importing trades:', error);
            alert('❌ Error importing trades. Please check the CSV format and try again.');
        } finally {
            hideLoading();
        }
    };
    
    fileInput.click();
};

function parseCSV(csvText) {
    const lines = csvText.split('\n').filter(line => line.trim());
    if (lines.length < 2) return [];
    
    const headers = lines[0].split(',').map(h => h.trim());
    const trades = [];
    
    for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        if (values.length !== headers.length) continue;
        
        try {
            const getValue = (possibleHeaders) => {
                for (const header of possibleHeaders) {
                    const index = headers.indexOf(header);
                    if (index !== -1 && values[index] !== undefined) {
                        return values[index];
                    }
                }
                return '';
            };

            const symbol = getValue(['Symbol', 'symbol']);
            const entryPrice = parseFloat(getValue(['Entry', 'entryPrice', 'Entry Price']));
            const stopLoss = parseFloat(getValue(['SL', 'stopLoss', 'Stop Loss']));
            const takeProfit = getValue(['TP', 'takeProfit', 'Take Profit']) ? 
                parseFloat(getValue(['TP', 'takeProfit', 'Take Profit'])) : null;
            const lotSize = parseFloat(getValue(['Lots', 'lotSize', 'Lot Size']) || '0.01');
            const tradeType = getValue(['Type', 'type']) || 'long';
            const instrumentType = getValue(['InstrumentType', 'instrumentType']) || getInstrumentType(symbol);
            
            let profit = parseFloat(getValue(['Profit', 'profit']) || '0');
            
            if (profit === 0 && symbol && entryPrice && stopLoss) {
                const exitPrice = takeProfit || entryPrice;
                profit = calculateProfitLoss(entryPrice, exitPrice, lotSize, symbol, tradeType);
            }
            
            const currentAccount = getCurrentAccount();
            
            const trade = {
                symbol: symbol,
                type: tradeType,
                instrumentType: instrumentType,
                entryPrice: entryPrice,
                stopLoss: stopLoss,
                takeProfit: takeProfit,
                lotSize: lotSize,
                mood: getValue(['Mood', 'mood']) || '',
                beforeScreenshot: getValue(['BeforeScreenshot', 'beforeScreenshot']) || '',
                afterScreenshot: getValue(['AfterScreenshot', 'afterScreenshot']) || '',
                notes: (getValue(['Notes', 'notes']) || '').replace(/""/g, '"'),
                timestamp: getValue(['Timestamp', 'timestamp']) || new Date(getValue(['Date', 'date']) || new Date()).toISOString(),
                profit: profit,
                pipsPoints: parseFloat(getValue(['PipsPoints', 'pipsPoints']) || '0'),
                riskAmount: parseFloat(getValue(['Risk Amount', 'riskAmount', 'RiskAmount']) || '0'),
                riskPercent: parseFloat(getValue(['Risk %', 'riskPercent', 'RiskPercent']) || '0'),
                accountSize: currentAccount.balance,
                leverage: parseInt(getValue(['Leverage', 'leverage']) || localStorage.getItem('leverage') || 50),
                userId: currentUser.uid,
                accountId: currentAccountId
            };
            
            if ((!trade.riskAmount || trade.riskAmount === 0) && symbol && entryPrice && stopLoss) {
                trade.riskAmount = Math.abs(calculateProfitLoss(entryPrice, stopLoss, lotSize, symbol, tradeType));
                trade.riskPercent = (trade.riskAmount / trade.accountSize) * 100;
                
                const pipPointInfo = calculatePipsPoints(entryPrice, stopLoss, takeProfit, symbol, tradeType);
                trade.pipsPoints = pipPointInfo.risk;
            }
            
            if (trade.symbol && !isNaN(trade.entryPrice) && !isNaN(trade.stopLoss)) {
                trades.push(trade);
            }
        } catch (error) {
            console.warn('Skipping invalid trade row:', error, values);
        }
    }
    
    return trades;
}

function parseCSVLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            values.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    
    values.push(current.trim());
    return values;
}

async function importTradesToFirestore(trades) {
    const importPromises = trades.map(async (trade) => {
        if (trade.symbol && trade.entryPrice && trade.stopLoss) {
            if (trade.profit === 0 && trade.takeProfit) {
                trade.profit = calculateProfitLoss(
                    trade.entryPrice, 
                    trade.takeProfit, 
                    trade.lotSize, 
                    trade.symbol, 
                    trade.type
                );
            }
            
            trade.riskAmount = Math.abs(calculateProfitLoss(
                trade.entryPrice, 
                trade.stopLoss, 
                trade.lotSize, 
                trade.symbol, 
                trade.type
            ));
            
            trade.riskPercent = (trade.riskAmount / trade.accountSize) * 100;
            
            const pipPointInfo = calculatePipsPoints(
                trade.entryPrice, 
                trade.stopLoss, 
                trade.takeProfit, 
                trade.symbol, 
                trade.type
            );
            trade.pipsPoints = pipPointInfo.risk;
        }
        
        return addDoc(collection(db, 'trades'), trade);
    });
    
    await Promise.all(importPromises);
}

window.exportTrades = async () => {
    try {
        if (!currentUser) return;
        const q = query(
            collection(db, 'trades'), 
            where('userId', '==', currentUser.uid),
            where('accountId', '==', currentAccountId)
        );
        const querySnapshot = await getDocs(q);
        const trades = [];
        querySnapshot.forEach((doc) => trades.push({ id: doc.id, ...doc.data() }));
        
        const csv = convertToCSV(trades);
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `trading-journal-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Error exporting trades:', error);
        alert('Error exporting trades.');
    }
};

function convertToCSV(trades) {
    const selectedCurrency = getSelectedCurrency();
    const currencyName = currencyNames[selectedCurrency] || 'US Dollar';
    
    const headers = [
        'Date', 'Symbol', 'Type', 'InstrumentType', 'Entry', 'SL', 'TP', 
        'Lots', `Profit (${currencyName})`, `Risk Amount (${currencyName})`, 
        'Risk %', 'PipsPoints', 'Mood', 'BeforeScreenshot', 'AfterScreenshot', 
        'Notes', 'AccountSize', 'Leverage', 'Timestamp', 'AccountId'
    ];
    const csvRows = [headers.join(',')];
    
    trades.forEach(trade => {
        const row = [
            new Date(trade.timestamp).toLocaleDateString(),
            trade.symbol,
            trade.type,
            trade.instrumentType,
            trade.entryPrice,
            trade.stopLoss,
            trade.takeProfit || '',
            trade.lotSize,
            trade.profit,
            trade.riskAmount,
            trade.riskPercent,
            trade.pipsPoints,
            trade.mood || '',
            `"${(trade.beforeScreenshot || '').replace(/"/g, '""')}"`,
            `"${(trade.afterScreenshot || '').replace(/"/g, '""')}"`,
            `"${(trade.notes || '').replace(/"/g, '""')}"`,
            trade.accountSize,
            trade.leverage,
            trade.timestamp,
            trade.accountId || ''
        ];
        csvRows.push(row.join(','));
    });
    
    return csvRows.join('\n');
}

// Delete trade function
window.deleteTrade = async (tradeId) => {
    if (confirm('Are you sure you want to delete this trade?')) {
        try {
            showLoading();
            await deleteDoc(doc(db, 'trades', tradeId));
            await loadTrades();
        } catch (error) {
            console.error('Error deleting trade:', error);
            alert('Error deleting trade.');
        } finally {
            hideLoading();
        }
    }
};

// Screenshot functions
window.viewScreenshot = (url) => {
    let cleanedUrl = url.trim();
    
    if (!cleanedUrl.startsWith('http://') && !cleanedUrl.startsWith('https://')) {
        cleanedUrl = 'https://' + cleanedUrl;
    }
    
    try {
        new URL(cleanedUrl);
    } catch (e) {
        alert('Invalid screenshot URL. Please check the URL format.');
        return;
    }

    const modal = document.getElementById('screenshotModal');
    const image = document.getElementById('screenshotImage');
    
    if (modal && image) {
        image.src = '';
        image.alt = 'Loading screenshot...';
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        
        let hasLoaded = false;
        let errorShown = false;
        
        image.onload = function() {
            console.log('Screenshot loaded successfully:', cleanedUrl);
            hasLoaded = true;
            image.alt = 'Trade Screenshot';
        };
        
        image.onerror = function() {
            console.error('Failed to load screenshot:', cleanedUrl);
            
            if (!hasLoaded && !errorShown) {
                errorShown = true;
                image.alt = 'Failed to load screenshot. The image may be blocked by CORS policy or the URL may be incorrect.';
                
                const knownDomains = ['images.unsplash.com', 'imgur.com', 'i.imgur.com', 'postimg.cc', 'prnt.sc', 'gyazo.com', 'ibb.co'];
                const isKnownDomain = knownDomains.some(domain => cleanedUrl.includes(domain));
                
                if (!isKnownDomain) {
                    setTimeout(() => {
                        if (!hasLoaded) {
                            alert('Failed to load screenshot. This could be due to:\n\n• CORS restrictions (common with some image hosts)\n• The image being deleted or moved\n• Network connectivity issues\n\nTry uploading to a different image hosting service like Imgur.');
                        }
                    }, 1000);
                }
            }
        };
        
        setTimeout(() => {
            if (!hasLoaded && !errorShown) {
                console.log('Screenshot loading taking longer than expected:', cleanedUrl);
            }
        }, 3000);
        
        image.src = cleanedUrl;
    }
};

window.closeScreenshotModal = () => {
    const modal = document.getElementById('screenshotModal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
        const image = document.getElementById('screenshotImage');
        if (image) {
            image.src = '';
            image.alt = '';
        }
    }
};

// Analytics and stats functions
function updateStats(trades) {
    const currentAccount = getCurrentAccount();
    const accountSize = currentAccount.balance;
    const stats = {
        'totalTrades': '0', 
        'winRate': '0%', 
        'totalPL': formatCurrency(0), 
        'currentBalance': formatCurrency(accountSize)
    };

    if (trades && trades.length > 0) {
        const totalTrades = trades.length;
        const winningTrades = trades.filter(t => t.profit > 0).length;
        const winRate = ((winningTrades / totalTrades) * 100).toFixed(1);
        const totalPL = trades.reduce((sum, trade) => sum + trade.profit, 0);
        const currentBalance = accountSize + totalPL;

        stats.totalTrades = totalTrades;
        stats.winRate = `${winRate}%`;
        stats.totalPL = formatCurrency(totalPL);
        stats.currentBalance = formatCurrency(currentBalance);
    }

    Object.entries(stats).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
            
            if (id === 'totalPL') {
                const numericValue = parseFloat(value.replace(/[^0-9.-]+/g, "")) || 0;
                element.className = `stat-value ${numericValue >= 0 ? 'profit' : 'loss'}`;
            } else if (id === 'currentBalance') {
                const numericValue = parseFloat(value.replace(/[^0-9.-]+/g, "")) || 0;
                element.className = `stat-value ${numericValue >= accountSize ? 'profit' : 'loss'}`;
            }
        }
    });
}

function calculateAdvancedMetrics(trades) {
    if (!trades || trades.length === 0) {
        resetAdvancedMetrics();
        return;
    }

    const winningTrades = trades.filter(t => t.profit > 0);
    const losingTrades = trades.filter(t => t.profit < 0);
    const breakevenTrades = trades.filter(t => t.profit === 0);

    const avgWin = winningTrades.length > 0 ? 
        winningTrades.reduce((sum, t) => sum + t.profit, 0) / winningTrades.length : 0;
    const avgLoss = losingTrades.length > 0 ? 
        losingTrades.reduce((sum, t) => sum + t.profit, 0) / losingTrades.length : 0;
    const largestWin = winningTrades.length > 0 ? 
        Math.max(...winningTrades.map(t => t.profit)) : 0;
    const largestLoss = losingTrades.length > 0 ? 
        Math.min(...losingTrades.map(t => t.profit)) : 0;

    const profitFactor = losingTrades.length > 0 ? 
        Math.abs(winningTrades.reduce((sum, t) => sum + t.profit, 0) / 
                losingTrades.reduce((sum, t) => sum + t.profit, 0)) : 
        winningTrades.length > 0 ? 999 : 0;
    
    const expectancy = (winningTrades.length / trades.length) * avgWin + 
                      (losingTrades.length / trades.length) * avgLoss;

    const avgRiskReward = trades.length > 0 ? 
        trades.reduce((sum, trade) => {
            if (trade.takeProfit && trade.riskAmount > 0) {
                const potentialProfit = Math.abs(calculateProfitLoss(
                    trade.entryPrice, 
                    trade.takeProfit, 
                    trade.lotSize, 
                    trade.symbol, 
                    trade.type
                ));
                const riskReward = potentialProfit / trade.riskAmount;
                return sum + riskReward;
            }
            return sum;
        }, 0) / trades.filter(t => t.takeProfit && t.riskAmount > 0).length : 0;

    const weeklyPerformance = calculateWeeklyPerformance(trades);
    const consistency = weeklyPerformance.length > 0 ? 
        (weeklyPerformance.filter(week => week.profit > 0).length / weeklyPerformance.length * 100) : 0;

    updatePerformanceMetrics({
        avgWin, avgLoss, largestWin, largestLoss, 
        profitFactor, expectancy, avgRiskReward, consistency
    });

    calculatePsychologicalMetrics(trades);
    calculateTimeAnalysis(trades);
}

function resetAdvancedMetrics() {
    const metrics = {
        'avgWin': formatCurrency(0),
        'avgLoss': formatCurrency(0),
        'largestWin': formatCurrency(0),
        'largestLoss': formatCurrency(0),
        'profitFactor': '0.00',
        'expectancy': formatCurrency(0),
        'avgRiskReward': '0.00',
        'consistency': '0%',
        'bestMood': '-',
        'worstMood': '-',
        'disciplineScore': '0%',
        'riskAdherence': '0%',
        'bestDay': '-',
        'bestInstrument': '-',
        'avgDuration': '-',
        'tradesPerMonth': '0'
    };

    Object.entries(metrics).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) element.textContent = value;
    });

    const moodPerformance = document.getElementById('moodPerformance');
    if (moodPerformance) moodPerformance.textContent = 'No data yet';
}

function updatePerformanceMetrics(metrics) {
    const performanceElements = {
        'avgWin': formatCurrency(metrics.avgWin),
        'avgLoss': formatCurrency(metrics.avgLoss),
        'largestWin': formatCurrency(metrics.largestWin),
        'largestLoss': formatCurrency(metrics.largestLoss),
        'profitFactor': metrics.profitFactor.toFixed(2),
        'expectancy': formatCurrency(metrics.expectancy),
        'avgRiskReward': metrics.avgRiskReward.toFixed(2),
        'consistency': `${metrics.consistency.toFixed(1)}%`
    };

    Object.entries(performanceElements).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) element.textContent = value;
    });
}

function calculatePsychologicalMetrics(trades) {
    const moodPerformance = {};
    trades.forEach(trade => {
        if (trade.mood) {
            if (!moodPerformance[trade.mood]) {
                moodPerformance[trade.mood] = { total: 0, count: 0, wins: 0 };
            }
            moodPerformance[trade.mood].total += trade.profit;
            moodPerformance[trade.mood].count++;
            if (trade.profit > 0) moodPerformance[trade.mood].wins++;
        }
    });

    let bestMood = '-';
    let worstMood = '-';
    let bestMoodProfit = -Infinity;
    let worstMoodProfit = Infinity;

    Object.entries(moodPerformance).forEach(([mood, data]) => {
        const avgProfit = data.total / data.count;
        if (avgProfit > bestMoodProfit) {
            bestMoodProfit = avgProfit;
            bestMood = getMoodEmoji(mood);
        }
        if (avgProfit < worstMoodProfit) {
            worstMoodProfit = avgProfit;
            worstMood = getMoodEmoji(mood);
        }
    });

    const riskAdherence = calculateRiskAdherence(trades);
    const disciplineScore = Math.min(100, riskAdherence * 100);

    document.getElementById('bestMood').textContent = bestMood;
    document.getElementById('worstMood').textContent = worstMood;
    document.getElementById('disciplineScore').textContent = `${disciplineScore.toFixed(0)}%`;
    document.getElementById('riskAdherence').textContent = `${riskAdherence.toFixed(1)}%`;

    const moodPerformanceText = Object.entries(moodPerformance)
        .map(([mood, data]) => 
            `${getMoodEmoji(mood)}: ${formatCurrency(data.total/data.count)} (${((data.wins/data.count)*100).toFixed(0)}% WR)`
        )
        .join(', ');
    
    const moodPerformanceElement = document.getElementById('moodPerformance');
    if (moodPerformanceElement) {
        moodPerformanceElement.textContent = moodPerformanceText || 'No mood data recorded';
    }
}

function getMoodEmoji(mood) {
    const emojiMap = {
        'confident': '😊', 'neutral': '😐', 'anxious': '😰',
        'greedy': '😈', 'fearful': '😨', 'disciplined': '🎯', 'impulsive': '⚡'
    };
    return emojiMap[mood] || mood;
}

function calculateRiskAdherence(trades) {
    if (trades.length === 0) return 0;
    
    const acceptableRiskRange = [0.5, 2.0];
    const withinRiskTrades = trades.filter(trade => {
        const riskPercent = trade.riskPercent || 0;
        return riskPercent >= acceptableRiskRange[0] && riskPercent <= acceptableRiskRange[1];
    });
    
    return (withinRiskTrades.length / trades.length) * 100;
}

function calculateTimeAnalysis(trades) {
    if (trades.length === 0) return;

    const dayPerformance = {};
    const instrumentPerformance = {};

    trades.forEach(trade => {
        const tradeDate = new Date(trade.timestamp);
        const day = tradeDate.toLocaleDateString('en', { weekday: 'short' });
        if (!dayPerformance[day]) dayPerformance[day] = { total: 0, count: 0 };
        dayPerformance[day].total += trade.profit;
        dayPerformance[day].count++;

        const symbol = trade.symbol;
        if (!instrumentPerformance[symbol]) instrumentPerformance[symbol] = { total: 0, count: 0 };
        instrumentPerformance[symbol].total += trade.profit;
        instrumentPerformance[symbol].count++;
    });

    let bestDay = '-';
    let bestDayProfit = -Infinity;
    Object.entries(dayPerformance).forEach(([day, data]) => {
        const avgProfit = data.total / data.count;
        if (avgProfit > bestDayProfit) {
            bestDayProfit = avgProfit;
            bestDay = day;
        }
    });

    let bestInstrument = '-';
    let bestInstrumentProfit = -Infinity;
    Object.entries(instrumentPerformance).forEach(([symbol, data]) => {
        const avgProfit = data.total / data.count;
        if (avgProfit > bestInstrumentProfit) {
            bestInstrumentProfit = avgProfit;
            bestInstrument = symbol;
        }
    });

    const monthlyTrades = trades.length / (getTradingMonths(trades) || 1);

    document.getElementById('bestDay').textContent = bestDay;
    document.getElementById('bestInstrument').textContent = bestInstrument;
    document.getElementById('avgDuration').textContent = 'Intraday';
    document.getElementById('tradesPerMonth').textContent = monthlyTrades.toFixed(1);
}

function calculateWeeklyPerformance(trades) {
    const weeklyData = {};
    trades.forEach(trade => {
        const tradeDate = new Date(trade.timestamp);
        const weekKey = `${tradeDate.getFullYear()}-W${Math.ceil((tradeDate.getDate() + 6) / 7)}`;
        if (!weeklyData[weekKey]) weeklyData[weekKey] = 0;
        weeklyData[weekKey] += trade.profit;
    });
    
    return Object.entries(weeklyData).map(([week, profit]) => ({ week, profit }));
}

function getTradingMonths(trades) {
    if (trades.length < 2) return 1;
    const firstTrade = new Date(trades[trades.length - 1].timestamp);
    const lastTrade = new Date(trades[0].timestamp);
    return (lastTrade - firstTrade) / (1000 * 60 * 60 * 24 * 30.44);
}

// Chart functions
function renderCharts(trades = []) {
    renderPerformanceChart(trades);
    renderWinLossChart(trades);
    renderMarketTypeChart(trades);
}

function renderPerformanceChart(trades) {
    const ctx = document.getElementById('performanceChart');
    if (!ctx) return;

    if (performanceChart) performanceChart.destroy();

    const selectedCurrency = getSelectedCurrency();
    const currencySymbol = getCurrencySymbol();

    if (trades.length === 0) {
        performanceChart = new Chart(ctx, {
            type: 'line',
            data: { labels: [], datasets: [{ label: 'Balance', data: [], borderColor: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.1)', fill: true }] },
            options: { 
                responsive: true, 
                maintainAspectRatio: false, 
                plugins: { legend: { display: false } } 
            }
        });
        return;
    }

    const sortedTrades = [...trades].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    const currentAccount = getCurrentAccount();
    const accountSize = currentAccount.balance;
    let balance = accountSize;
    const balanceData = [balance];
    const labels = ['Start'];

    sortedTrades.forEach((trade) => {
        balance += trade.profit;
        balanceData.push(balance);
        
        const tradeDate = new Date(trade.timestamp);
        const dateLabel = tradeDate.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric'
        });
        labels.push(dateLabel);
    });

    performanceChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Account Balance',
                data: balanceData,
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { 
                    mode: 'index', 
                    intersect: false,
                    callbacks: {
                        label: function(context) {
                            return `Balance: ${currencySymbol}${context.parsed.y.toFixed(2)}`;
                        }
                    }
                }
            },
            scales: {
                x: { 
                    display: true, 
                    title: { display: true, text: 'Date' }
                },
                y: { 
                    display: true, 
                    title: { display: true, text: `Balance (${currencySymbol})` } 
                }
            }
        }
    });
}

function renderWinLossChart(trades) {
    const ctx = document.getElementById('winLossChart');
    if (!ctx) return;

    if (winLossChart) winLossChart.destroy();

    if (trades.length === 0) {
        winLossChart = new Chart(ctx, {
            type: 'doughnut',
            data: { labels: ['No Data'], datasets: [{ data: [1], backgroundColor: ['#9ca3af'] }] },
            options: { responsive: true, maintainAspectRatio: false }
        });
        return;
    }

    const wins = trades.filter(t => t.profit > 0).length;
    const losses = trades.filter(t => t.profit < 0).length;
    const breakeven = trades.filter(t => t.profit === 0).length;

    winLossChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: [`Wins (${wins})`, `Losses (${losses})`, `Breakeven (${breakeven})`],
            datasets: [{
                data: [wins, losses, breakeven],
                backgroundColor: ['#10b981', '#ef4444', '#6b7280'],
                borderWidth: 2,
                borderColor: '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' },
                tooltip: { callbacks: { label: function(context) { return `${context.label}: ${context.parsed}`; } } }
            }
        }
    });
}

function renderMarketTypeChart(trades) {
    const ctx = document.getElementById('marketTypeChart');
    if (!ctx) return;

    if (marketTypeChart) marketTypeChart.destroy();

    if (trades.length === 0) {
        marketTypeChart = new Chart(ctx, {
            type: 'pie',
            data: { labels: ['No Data'], datasets: [{ data: [1], backgroundColor: ['#9ca3af'] }] },
            options: { responsive: true, maintainAspectRatio: false }
        });
        return;
    }

    const forexTrades = trades.filter(t => t.instrumentType === 'forex');
    const indicesTrades = trades.filter(t => t.instrumentType === 'indices');

    marketTypeChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: [`Forex (${forexTrades.length})`, `Indices (${indicesTrades.length})`],
            datasets: [{
                data: [forexTrades.length, indicesTrades.length],
                backgroundColor: ['#3b82f6', '#8b5cf6'],
                borderWidth: 2,
                borderColor: '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' },
                tooltip: { callbacks: { label: function(context) { return `${context.label}: ${context.parsed}`; } } }
            }
        }
    });
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('Trading Journal with Multi-Account Support initialized');
});