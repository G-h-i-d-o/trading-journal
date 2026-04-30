// app.js - COMPLETE FULLY FIXED VERSION WITH ALL FEATURES
import { 
    auth, db, storage, onAuthStateChanged, signOut, 
    collection, addDoc, getDocs, query, where, doc, deleteDoc, updateDoc, getDoc, setDoc, onSnapshot,
    ref, uploadBytes, getDownloadURL, deleteObject
} from './firebase-config.js';

// ===== ALL VARIABLE DECLARATIONS =====
let currentUser = null;
let performanceChart = null;
let winLossChart = null;
let marketTypeChart = null;
let confluenceChart = null;
let editingTradeId = null;
let currentPage = 1;
const tradesPerPage = 10;
let allTrades = [];
let allAffirmations = [];
let editingAffirmationId = null;
let pointValueOverrides = {};
let currentAccountId = null;
let userAccounts = [];
let currentCalendarDate = new Date();
let calendarViewType = 'month';
let loadingTimeout;
const MAX_LOADING_TIME = 15000;
let tradesUnsubscribe = null;
let transactions = [];
let editingTransactionId = null;

// Sample affirmations data - WAS MISSING
const sampleAffirmations = [
    {
        text: "I am a disciplined trader who follows my trading plan with precision.",
        category: "discipline",
        isFavorite: true,
        isActive: true,
        usageCount: 0,
        lastUsed: null,
        createdAt: new Date().toISOString(),
        strength: 92
    },
    {
        text: "I trust my analysis and execute trades with confidence.",
        category: "confidence",
        isFavorite: true,
        isActive: true,
        usageCount: 0,
        lastUsed: null,
        createdAt: new Date().toISOString(),
        strength: 88
    },
    {
        text: "I accept losses as part of trading and learn from every trade.",
        category: "mindset",
        isFavorite: false,
        isActive: true,
        usageCount: 0,
        lastUsed: null,
        createdAt: new Date().toISOString(),
        strength: 85
    },
    {
        text: "I manage risk effectively and never risk more than I can afford to lose.",
        category: "risk-management",
        isFavorite: true,
        isActive: true,
        usageCount: 0,
        lastUsed: null,
        createdAt: new Date().toISOString(),
        strength: 95
    },
    {
        text: "Patience is my greatest ally; I wait for the perfect setup.",
        category: "patience",
        isFavorite: false,
        isActive: true,
        usageCount: 0,
        lastUsed: null,
        createdAt: new Date().toISOString(),
        strength: 90
    }
];

// Currency configuration
const currencySymbols = {
    USD: '$', EUR: '€', GBP: '£', JPY: '¥', ZAR: 'R', CAD: 'C$', AUD: 'A$', CHF: 'CHF'
};

const currencyNames = {
    USD: 'US Dollar', EUR: 'Euro', GBP: 'British Pound', JPY: 'Japanese Yen',
    ZAR: 'South African Rand', CAD: 'Canadian Dollar', AUD: 'Australian Dollar',
    CHF: 'Swiss Franc'
};

const DEFAULT_CONFLUENCE_OPTIONS = [
    'Trend Direction', 'Support/Resistance', 'Price Action',
    'Volume', 'Market Structure', 'Higher Timeframe'
];

let mtImportSettings = {
    useMTProfit: true, includeCommission: false, includeSwap: false,
    defaultMood: '', autoAddNotes: true
};

let pendingMTTrades = [];
let existingTicketNumbers = new Set();
let importErrors = [];

const motivationalQuotes = [
    "The stock market is a device for transferring money from the impatient to the patient. - Warren Buffett",
    "Risk comes from not knowing what you're doing. - Warren Buffett",
    "The most important quality for an investor is temperament, not intellect. - Warren Buffett",
    "Plan your trade and trade your plan.",
    "Emotion is the enemy of successful trading."
];

const mtSymbolMapping = {
    'EURUSD': 'EUR/USD', 'GBPUSD': 'GBP/USD', 'USDJPY': 'USD/JPY',
    'XAUUSD': 'Gold', 'US30': 'US30', 'SPX500': 'SPX500', 'NAS100': 'NAS100',
    'Volatility 75 Index': 'Volatility 75 Index', 'Boom 500 Index': 'Boom 500 Index'
};

// Deriv Synthetic Indices Lot Size Configuration
const derivLotSizeConfig = {
    'Volatility 10 Index': { minLot: 0.5, maxLot: 100, pointValue: 0.001, stdLotDisplay: '0.5' },
    'Volatility 25 Index': { minLot: 0.5, maxLot: 100, pointValue: 0.001, stdLotDisplay: '0.5' },
    'Volatility 50 Index': { minLot: 4, maxLot: 100, pointValue: 0.001, stdLotDisplay: '4.0' },
    'Volatility 75 Index': { minLot: 0.001, maxLot: 100, pointValue: 0.00001, stdLotDisplay: '0.001' },
    'Volatility 100 Index': { minLot: 0.5, maxLot: 100, pointValue: 0.001, stdLotDisplay: '0.5' },
    'Boom 500 Index': { minLot: 0.2, maxLot: 50, pointValue: 0.001, stdLotDisplay: '0.2' },
    'Crash 500 Index': { minLot: 0.2, maxLot: 50, pointValue: 0.001, stdLotDisplay: '0.2' }
};

// ========== CORE UTILITY FUNCTIONS ==========

function getPointValue(symbol) {
    if (pointValueOverrides && pointValueOverrides[symbol] !== undefined) {
        return pointValueOverrides[symbol];
    }
    if (derivLotSizeConfig[symbol]) {
        return derivLotSizeConfig[symbol].pointValue;
    }
    const pointValues = {
        'US30': 1, 'SPX500': 50, 'NAS100': 20, 'Gold': 0.01, 'Silver': 0.001
    };
    if (symbol && symbol.includes('/')) {
        return symbol.includes('JPY') ? 0.01 : 0.0001;
    }
    return pointValues[symbol] || 0.0001;
}

function getInstrumentType(symbol) {
    const syntheticIndices = ['Volatility', 'Boom', 'Crash', 'Jump', 'Step', 'Range Break', 'Drift Switch', 'Bear', 'Bull'];
    const forexPairs = ['EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CHF', 'AUD/USD', 'USD/CAD', 'NZD/USD', 'EUR/GBP', 'EUR/JPY', 'GBP/JPY'];
    const traditionalIndices = ['US30', 'SPX500', 'NAS100', 'GE30', 'FTSE100', 'NIKKEI225', 'AUS200', 'ESTX50', 'FRA40'];
    const commodities = ['Gold', 'Silver', 'Oil', 'Brent', 'Natural Gas', 'Palladium', 'Platinum'];
    const smartTraderOptions = ['Rise/Fall', 'Higher/Lower', 'Touch/No Touch', 'Ends Between/Out', 'Stays Between/Goes Out', 'Asians', 'Digits', 'Lookbacks', 'Reset Call/Put', 'Call/Put Spreads', 'Multipliers', 'Even/Odd', 'Over/Under', 'Turbos', 'Vanillas'];
    const accumulatorOptions = ['Accumulator Up', 'Accumulator Down'];
    
    if (syntheticIndices.some(i => symbol?.includes(i))) return 'synthetic';
    if (forexPairs.includes(symbol)) return 'forex';
    if (traditionalIndices.includes(symbol)) return 'indices';
    if (commodities.includes(symbol)) return 'commodities';
    if (smartTraderOptions.includes(symbol)) return 'smarttrader';
    if (accumulatorOptions.includes(symbol)) return 'accumulator';
    return 'forex';
}

function getLotSizeInfo(symbol, instrumentType = null) {
    if (!instrumentType) instrumentType = getInstrumentType(symbol);
    if (derivLotSizeConfig[symbol]) {
        const config = derivLotSizeConfig[symbol];
        return { 
            minLot: config.minLot, 
            maxLot: config.maxLot, 
            stdLotDisplay: config.stdLotDisplay, 
            pointValue: config.pointValue, 
            description: `Min: ${config.minLot} | Std: ${config.stdLotDisplay} lot(s)` 
        };
    }
    return { 
        minLot: 0.01, 
        maxLot: 100, 
        stdLotDisplay: '1.0', 
        pointValue: getPointValue(symbol), 
        description: 'Std Lot = 1.0 | Min: 0.01' 
    };
}

function calculateProfitLoss(entry, exit, lotSize, symbol, type) {
    const instrumentType = getInstrumentType(symbol);
    const pointValue = getPointValue(symbol);
    
    if (instrumentType === 'forex') {
        const pipValue = 10 * lotSize;
        const pipSize = symbol.includes('JPY') ? 0.01 : 0.0001;
        const pips = type === 'long' ? (exit - entry) / pipSize : (entry - exit) / pipSize;
        return parseFloat((pips * pipValue).toFixed(2));
    } else {
        const points = type === 'long' ? (exit - entry) : (entry - exit);
        return parseFloat((points * pointValue * lotSize).toFixed(2));
    }
}

function calculatePipsPoints(entry, sl, tp, symbol, type) {
    const instrumentType = getInstrumentType(symbol);
    if (instrumentType === 'forex') {
        const pipSize = symbol.includes('JPY') ? 0.01 : 0.0001;
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

function getCurrencySymbol(currencyCode = null) {
    const code = currencyCode || document.getElementById('accountCurrency')?.value || 'USD';
    return currencySymbols[code] || '$';
}

function formatCurrency(amount, currencyCode = null) {
    const symbol = getCurrencySymbol(currencyCode);
    const absAmount = Math.abs(amount);
    const formatted = `${symbol}${absAmount.toFixed(2)}`;
    return amount < 0 ? `-${formatted}` : formatted;
}

function showSuccessMessage(message) {
    const successDiv = document.createElement('div');
    successDiv.className = 'fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-fade-in';
    successDiv.innerHTML = message;
    document.body.appendChild(successDiv);
    setTimeout(() => {
        successDiv.style.opacity = '0';
        successDiv.style.transition = 'opacity 0.5s';
        setTimeout(() => successDiv.remove(), 500);
    }, 3000);
}

function showLoading() {
    const loadingIndicator = document.getElementById('loadingIndicator');
    if (loadingIndicator) {
        loadingIndicator.style.display = 'flex';
        if (loadingTimeout) clearTimeout(loadingTimeout);
        loadingTimeout = setTimeout(() => {
            console.warn('⚠️ Loading timeout reached - forcing hide');
            hideLoading();
        }, MAX_LOADING_TIME);
    }
}

function hideLoading() {
    const loadingIndicator = document.getElementById('loadingIndicator');
    if (loadingIndicator) {
        loadingIndicator.style.display = 'none';
    }
    if (loadingTimeout) {
        clearTimeout(loadingTimeout);
        loadingTimeout = null;
    }
}

function getCurrentDateTimeString() {
    const now = new Date();
    return now.toISOString().slice(0, 16);
}

function getCurrentBalance() {
    const currentAccount = getCurrentAccount();
    if (!currentAccount) return 10000;
    const totalPL = allTrades.reduce((sum, trade) => sum + (trade.profit || 0), 0);
    const { netBalance } = calculateNetBalanceFromTransactions();
    return currentAccount.balance + totalPL + netBalance;
}

function getSelectedCurrency() {
    return document.getElementById('accountCurrency')?.value || 'USD';
}

function getMoodEmoji(mood) {
    const moodMap = { 
        'confident': '😊', 'neutral': '😐', 'anxious': '😰', 'greedy': '😈', 
        'fearful': '😨', 'disciplined': '📋', 'impulsive': '⚡' 
    };
    return moodMap[mood] || '';
}

function getEmotionLevel() {
    const slider = document.getElementById('emotionLevel');
    return slider ? parseInt(slider.value) : 50;
}

function getEmotionCategory(value) {
    if (value <= 25) return 'calm';
    if (value <= 50) return 'balanced';
    if (value <= 75) return 'anxious';
    return 'intense';
}

// ========== ACCOUNT MANAGEMENT ==========

async function initializeAccounts() {
    console.log('📊 Initializing accounts...');
    try {
        await loadUserAccounts();
        setupAccountsDropdown();
        console.log('✅ Accounts initialized');
    } catch (error) {
        console.error('❌ Error initializing accounts:', error);
    }
}

async function loadUserAccounts() {
    try {
        if (!currentUser) throw new Error('No authenticated user');
        
        const q = query(collection(db, 'accounts'), where('userId', '==', currentUser.uid));
        const querySnapshot = await getDocs(q);
        const accounts = [];
        querySnapshot.forEach((doc) => accounts.push({ id: doc.id, ...doc.data() }));
        
        if (accounts.length === 0) {
            console.log('📝 Creating default account...');
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
        } else {
            userAccounts = accounts;
        }
        
        const savedCurrentAccount = localStorage.getItem('currentAccountId');
        currentAccountId = savedCurrentAccount && userAccounts.some(acc => acc.id === savedCurrentAccount) 
            ? savedCurrentAccount 
            : userAccounts[0]?.id;
        
        if (currentAccountId) {
            localStorage.setItem('currentAccountId', currentAccountId);
            updateCurrentAccountDisplay();
        }
        
        console.log('✅ Accounts loaded:', userAccounts.length);
    } catch (error) {
        console.error('❌ Error loading accounts:', error);
        // Create fallback
        userAccounts = [{ 
            id: 'default_' + Date.now(), 
            name: 'Main Account', 
            balance: 10000, 
            currency: 'USD', 
            createdAt: new Date().toISOString(), 
            isDefault: true 
        }];
        currentAccountId = userAccounts[0].id;
    }
}

function getCurrentAccount() {
    if (!userAccounts || userAccounts.length === 0) {
        return { name: 'Main Account', balance: 10000, currency: 'USD' };
    }
    return userAccounts.find(acc => acc.id === currentAccountId) || userAccounts[0];
}

function updateCurrentAccountDisplay() {
    const currentAccount = getCurrentAccount();
    if (!currentAccount) return;
    
    const nameEl = document.getElementById('currentAccountName');
    const accountSizeEl = document.getElementById('accountSize');
    const currencyEl = document.getElementById('accountCurrency');
    
    if (nameEl) nameEl.textContent = currentAccount.name;
    if (accountSizeEl) accountSizeEl.value = currentAccount.balance;
    if (currencyEl) currencyEl.value = currentAccount.currency;
}

function setupAccountsDropdown() {
    const toggle = document.getElementById('accountsToggle');
    const menu = document.getElementById('accountsMenu');
    
    if (toggle && menu) {
        toggle.addEventListener('click', (e) => { 
            e.stopPropagation(); 
            menu.classList.toggle('hidden'); 
            renderAccountsList(); 
        });
        document.addEventListener('click', () => menu.classList.add('hidden'));
        menu.addEventListener('click', (e) => e.stopPropagation());
    }
}

function renderAccountsList() {
    const list = document.getElementById('accountsList');
    const mobileList = document.getElementById('mobileAccountsList');
    
    if (!list && !mobileList) return;
    
    const html = userAccounts.map(account => `
        <div class="p-3 hover:bg-gray-50 cursor-pointer border-b ${account.id === currentAccountId ? 'bg-blue-50' : ''}" 
             onclick="window.switchAccount('${account.id}')">
            <div class="flex justify-between items-center">
                <div>
                    <div class="font-semibold text-sm">${account.name}</div>
                    <div class="text-xs text-gray-600">${getCurrencySymbol(account.currency)}${account.balance.toFixed(2)}</div>
                </div>
                ${account.id === currentAccountId ? '<span class="text-blue-500">✓</span>' : ''}
            </div>
        </div>
    `).join('');
    
    if (list) list.innerHTML = html;
    if (mobileList) mobileList.innerHTML = html;
}

async function saveUserAccounts() {
    try {
        if (!currentUser) return;
        for (const account of userAccounts) {
            if (account.id && account.id.startsWith('default_')) continue;
            const accountRef = doc(db, 'accounts', account.id);
            await setDoc(accountRef, account, { merge: true });
        }
    } catch (error) {
        console.error('Error saving accounts:', error);
    }
}

window.switchAccount = async (accountId) => {
    if (accountId === currentAccountId) return;
    
    if (tradesUnsubscribe) { 
        tradesUnsubscribe(); 
        tradesUnsubscribe = null; 
    }
    
    currentAccountId = accountId;
    localStorage.setItem('currentAccountId', accountId);
    updateCurrentAccountDisplay();
    
    showLoading();
    try {
        await loadTrades();
        document.getElementById('accountsMenu')?.classList.add('hidden');
        updateCurrentBalanceDisplay();
        showSuccessMessage('Account switched successfully!');
    } catch (error) {
        console.error('Error switching accounts:', error);
    } finally {
        hideLoading();
    }
};

window.showAddAccountModal = () => {
    const modal = document.getElementById('addAccountModal');
    if (modal) modal.classList.remove('hidden');
    // Reset form
    const nameInput = document.getElementById('accountName');
    const balanceInput = document.getElementById('accountBalance');
    if (nameInput) nameInput.value = '';
    if (balanceInput) balanceInput.value = '10000';
};

window.closeAddAccountModal = () => {
    const modal = document.getElementById('addAccountModal');
    if (modal) modal.classList.add('hidden');
};

// FIXED: Proper add account handler
window.handleAddAccountSubmit = async (e) => {
    if (e) e.preventDefault();
    
    const nameInput = document.getElementById('accountName');
    const balanceInput = document.getElementById('accountBalance');
    const currencyInput = document.getElementById('accountCurrencySelect');
    
    const name = nameInput?.value?.trim();
    const balance = parseFloat(balanceInput?.value);
    const currency = currencyInput?.value || 'USD';
    
    if (!name) { alert('Please enter an account name.'); return; }
    if (!balance || balance <= 0) { alert('Please enter a valid starting balance.'); return; }
    
    try {
        const newAccount = {
            name, balance, currency,
            createdAt: new Date().toISOString(),
            isDefault: false,
            userId: currentUser.uid
        };
        const docRef = await addDoc(collection(db, 'accounts'), newAccount);
        const accountWithId = { id: docRef.id, ...newAccount };
        userAccounts.push(accountWithId);
        renderAccountsList();
        window.closeAddAccountModal();
        showSuccessMessage(`Account "${name}" created successfully!`);
        
        // Reset form
        if (nameInput) nameInput.value = '';
        if (balanceInput) balanceInput.value = '10000';
    } catch (error) {
        console.error('Error adding account:', error);
        alert('Error creating account: ' + error.message);
    }
};

// ========== TRADES MANAGEMENT WITH REAL-TIME LISTENERS ==========

async function loadTrades() {
    return new Promise((resolve, reject) => {
        try {
            console.log('📊 Setting up real-time trades listener...');
            
            if (!currentUser) {
                console.warn('⚠️ No authenticated user');
                resolve();
                return;
            }
            
            if (!currentAccountId) {
                console.warn('⚠️ No currentAccountId, using first account');
                if (userAccounts.length > 0) {
                    currentAccountId = userAccounts[0].id;
                } else {
                    resolve();
                    return;
                }
            }

            // Unsubscribe from previous listener
            if (tradesUnsubscribe) {
                tradesUnsubscribe();
                tradesUnsubscribe = null;
            }

            const q = query(
                collection(db, 'trades'),
                where('userId', '==', currentUser.uid),
                where('accountId', '==', currentAccountId)
            );

            let isFirstSnapshot = true;
            let resolved = false;
            
            // Safety timeout
            const timeoutId = setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    isFirstSnapshot = false;
                    console.warn('⚠️ Trades loading timeout - resolving');
                    hideLoading();
                    resolve();
                }
            }, 8000);
            
            // Set up real-time listener
            tradesUnsubscribe = onSnapshot(q, (querySnapshot) => {
                try {
                    const trades = [];
                    querySnapshot.forEach((doc) => {
                        trades.push({ id: doc.id, ...doc.data() });
                    });

                    // Sort by most recent first
                    trades.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                    
                    allTrades = trades;
                    
                    // Update all UI components
                    setupPagination(trades);
                    updateStats(trades);
                    renderCharts(trades);
                    calculateAdvancedMetrics(trades);
                    updateEmotionAnalytics(trades);
                    generateAISuggestions();
                    
                    // Update calendar if visible
                    if (document.getElementById('calendarContent')?.classList.contains('active')) {
                        renderCalendar();
                    }
                    
                    console.log('✅ Trades updated:', trades.length);
                    
                    // Resolve promise on first snapshot
                    if (!resolved) {
                        resolved = true;
                        isFirstSnapshot = false;
                        clearTimeout(timeoutId);
                        hideLoading();
                        resolve();
                    }
                } catch (error) {
                    console.error('❌ Error processing trades snapshot:', error);
                    if (!resolved) {
                        resolved = true;
                        clearTimeout(timeoutId);
                        hideLoading();
                        resolve();
                    }
                }
            }, (error) => {
                console.error('❌ Error in trades real-time listener:', error);
                if (!resolved) {
                    resolved = true;
                    clearTimeout(timeoutId);
                    hideLoading();
                    resolve();
                }
            });

        } catch (error) {
            console.error('❌ Error setting up trades listener:', error);
            hideLoading();
            resolve();
        }
    });
}

async function addTrade(e) {
    e.preventDefault();
    const submitButton = e.target.querySelector('button[type="submit"]');
    const originalText = submitButton.innerHTML;
    submitButton.innerHTML = '<div class="loading-spinner"></div> Saving...';
    submitButton.disabled = true;

    try {
        const symbol = document.getElementById('symbol')?.value;
        const entryPrice = parseFloat(document.getElementById('entryPrice')?.value);
        const stopLoss = parseFloat(document.getElementById('stopLoss')?.value) || null;
        const takeProfit = parseFloat(document.getElementById('takeProfit')?.value) || null;
        const exitPrice = parseFloat(document.getElementById('exitPrice')?.value) || null;
        const lotSize = parseFloat(document.getElementById('lotSize')?.value);
        const tradeType = document.getElementById('direction')?.value;
        const mood = document.getElementById('mood')?.value || '';
        
        const confluenceOptions = Array.from(
            document.querySelectorAll('#confluenceOptions input[type="checkbox"]:checked')
        ).map(el => el.value);
        
        const totalConfluenceOptions = document.querySelectorAll('#confluenceOptions input[type="checkbox"]').length;
        const confluenceScore = totalConfluenceOptions > 0 ? (confluenceOptions.length / totalConfluenceOptions) * 100 : 0;
        
        const tradeDateTimeInput = document.getElementById('tradeDateTime');
        const selectedDateTime = tradeDateTimeInput.value;
        const tradeTimestamp = selectedDateTime ? new Date(selectedDateTime).toISOString() : new Date().toISOString();
        
        const currentAccount = getCurrentAccount();
        const accountSize = getCurrentBalance();
        const leverage = parseInt(document.getElementById('leverage')?.value) || 50;

        if (!symbol || !entryPrice || !lotSize || !tradeType) {
            alert('Please fill all required fields (Symbol, Entry Price, Size, and Direction)');
            submitButton.innerHTML = originalText;
            submitButton.disabled = false;
            return;
        }

        if (confluenceOptions.length === 0) {
            alert('Please select at least one confluence element before saving the trade.');
            submitButton.innerHTML = originalText;
            submitButton.disabled = false;
            return;
        }

        // SL validation
        if (stopLoss !== null && stopLoss > 0) {
            if (tradeType === 'long' && stopLoss >= entryPrice) {
                alert('For a long position, Stop Loss must be below Entry Price');
                submitButton.innerHTML = originalText;
                submitButton.disabled = false;
                return;
            }
            if (tradeType === 'short' && stopLoss <= entryPrice) {
                alert('For a short position, Stop Loss must be above Entry Price');
                submitButton.innerHTML = originalText;
                submitButton.disabled = false;
                return;
            }
        }

        const instrumentType = getInstrumentType(symbol);
        const actualExitPrice = exitPrice || takeProfit || entryPrice;
        const profit = calculateProfitLoss(entryPrice, actualExitPrice, lotSize, symbol, tradeType);
        const pipPointInfo = calculatePipsPoints(entryPrice, stopLoss, takeProfit, symbol, tradeType);

        // Show confetti for winning trades
        if (profit > 0 && typeof confetti === 'function') {
            confetti({
                particleCount: 100,
                spread: 70,
                origin: { y: 0.6 },
                colors: ['#10b981', '#3b82f6', '#f59e0b', '#ef4444']
            });
        }

        // Screenshot handling
        let beforeScreenshot = '';
        let afterScreenshot = '';

        // Before screenshot
        const beforeUrlInput = document.getElementById('beforeScreenshotUrl');
        const beforeFileInput = document.getElementById('beforeScreenshotFile');
        
        if (beforeUrlInput && beforeUrlInput.style.display !== 'none' && beforeUrlInput.value) {
            beforeScreenshot = beforeUrlInput.value.trim();
        } else if (beforeFileInput && beforeFileInput.files && beforeFileInput.files[0]) {
            beforeScreenshot = await uploadScreenshot(beforeFileInput.files[0], 'before');
        }

        // After screenshot
        const afterUrlInput = document.getElementById('afterScreenshotUrl');
        const afterFileInput = document.getElementById('afterScreenshotFile');
        
        if (afterUrlInput && afterUrlInput.style.display !== 'none' && afterUrlInput.value) {
            afterScreenshot = afterUrlInput.value.trim();
        } else if (afterFileInput && afterFileInput.files && afterFileInput.files[0]) {
            afterScreenshot = await uploadScreenshot(afterFileInput.files[0], 'after');
        }

        const tradeData = {
            symbol, 
            type: tradeType, 
            instrumentType, 
            entryPrice, 
            stopLoss, 
            takeProfit, 
            exitPrice, 
            lotSize,
            mood: mood,
            emotionLevel: getEmotionLevel(),
            beforeScreenshot: beforeScreenshot,
            afterScreenshot: afterScreenshot,
            notes: document.getElementById('notes')?.value || '', 
            confluenceOptions,
            confluenceScore: Number(confluenceScore.toFixed(0)),
            timestamp: tradeTimestamp,
            profit: profit, 
            pipsPoints: pipPointInfo.risk,
            riskAmount: stopLoss ? Math.abs(calculateProfitLoss(entryPrice, stopLoss, lotSize, symbol, tradeType)) : 0,
            riskPercent: stopLoss ? (Math.abs(calculateProfitLoss(entryPrice, stopLoss, lotSize, symbol, tradeType)) / accountSize) * 100 : 0,
            accountSize: accountSize, 
            leverage: leverage, 
            userId: currentUser.uid,
            accountId: currentAccountId
        };

        await addDoc(collection(db, 'trades'), tradeData);
        
        // Reset form
        e.target.reset();
        document.getElementById('tradeDateTime').value = getCurrentDateTimeString();
        
        // Reset screenshot inputs
        const beforeUrl = document.getElementById('beforeScreenshotUrl');
        const beforeFile = document.getElementById('beforeScreenshotFile');
        const afterUrl = document.getElementById('afterScreenshotUrl');
        const afterFile = document.getElementById('afterScreenshotFile');
        if (beforeUrl) beforeUrl.value = '';
        if (beforeFile) beforeFile.value = '';
        if (afterUrl) afterUrl.value = '';
        if (afterFile) afterFile.value = '';
        
        updateUploadStatus('before', '');
        updateUploadStatus('after', '');
        
        // Reset emotion gauge
        const emotionSlider = document.getElementById('emotionLevel');
        if (emotionSlider) {
            emotionSlider.value = 50;
            updateEmotionDisplay(50);
        }
        
        showSuccessMessage('Trade added successfully!');
    } catch (error) {
        console.error('Error adding trade:', error);
        alert('Error adding trade: ' + error.message);
    } finally {
        submitButton.innerHTML = originalText;
        submitButton.disabled = false;
    }
}

// ========== UPLOAD FUNCTIONS ==========

async function uploadScreenshot(file, type) {
    if (!file) return null;
    
    try {
        updateUploadStatus(type, 'Uploading...', 'uploading');
        
        const timestamp = Date.now();
        const fileName = `${type}_screenshot_${timestamp}_${file.name}`;
        const storageRef = ref(storage, `screenshots/${currentUser.uid}/${fileName}`);
        
        const snapshot = await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(snapshot.ref);
        
        updateUploadStatus(type, 'Uploaded!', 'success');
        return downloadURL;
        
    } catch (error) {
        console.error('Error uploading screenshot:', error);
        updateUploadStatus(type, 'Upload failed', 'error');
        return null;
    }
}

function updateUploadStatus(type, message, statusClass = '') {
    const statusElement = document.getElementById(`${type}UploadStatus`);
    if (statusElement) {
        statusElement.textContent = message;
        statusElement.className = `upload-status ${statusClass}`;
        if (message) statusElement.style.display = 'block';
    }
}

window.toggleScreenshotInput = (type, inputType) => {
    const urlInput = document.getElementById(`${type}ScreenshotUrl`);
    const fileInput = document.getElementById(`${type}ScreenshotFile`);
    
    if (inputType === 'url') {
        if (urlInput) urlInput.style.display = 'block';
        if (fileInput) fileInput.style.display = 'none';
        if (fileInput) fileInput.value = '';
    } else {
        if (urlInput) urlInput.style.display = 'none';
        if (fileInput) fileInput.style.display = 'block';
        if (urlInput) urlInput.value = '';
    }
    updateUploadStatus(type, '');
};

window.viewScreenshot = (url) => {
    let cleanedUrl = url.trim();
    
    if (!cleanedUrl.startsWith('http://') && !cleanedUrl.startsWith('https://')) {
        cleanedUrl = 'https://' + cleanedUrl;
    }
    
    const modal = document.getElementById('screenshotModal');
    const image = document.getElementById('screenshotImage');
    
    if (modal && image) {
        image.src = cleanedUrl;
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
};

window.closeScreenshotModal = () => {
    const modal = document.getElementById('screenshotModal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
        const image = document.getElementById('screenshotImage');
        if (image) image.src = '';
    }
};

// ========== DISPLAY FUNCTIONS ==========

function updateStats(trades) {
    const currentAccount = getCurrentAccount();
    if (!currentAccount) return;
    
    const totalTrades = trades.length;
    const winningTrades = trades.filter(t => t.profit > 0).length;
    const winRate = totalTrades > 0 ? ((winningTrades / totalTrades) * 100).toFixed(1) : 0;
    const totalPL = trades.reduce((sum, t) => sum + (t.profit || 0), 0);
    const currentBalance = getCurrentBalance();
    
    const totalTradesEl = document.getElementById('totalTrades');
    const winRateEl = document.getElementById('winRate');
    const totalPLEl = document.getElementById('totalPL');
    const currentBalanceEl = document.getElementById('currentBalance');
    
    if (totalTradesEl) totalTradesEl.textContent = totalTrades;
    if (winRateEl) winRateEl.textContent = `${winRate}%`;
    if (totalPLEl) { 
        totalPLEl.textContent = formatCurrency(totalPL); 
        totalPLEl.className = `stat-value ${totalPL >= 0 ? 'profit' : 'loss'}`; 
    }
    if (currentBalanceEl) { 
        currentBalanceEl.textContent = formatCurrency(currentBalance); 
        currentBalanceEl.className = `stat-value ${currentBalance >= currentAccount.balance ? 'profit' : 'loss'}`; 
    }
}

function setupPagination(trades) {
    allTrades = trades;
    currentPage = 1;
    renderPagination();
    displayTradesPage(currentPage);
}

function displayTradesPage(page) {
    console.log('📄 Displaying page:', page);
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
    
    if (!paginationContainer) {
        console.error('❌ Pagination container not found');
        return;
    }

    if (totalPages <= 1) {
        paginationContainer.innerHTML = '';
        return;
    }

    let paginationHTML = '';
    
    // Previous button
    if (currentPage > 1) {
        paginationHTML += `<button type="button" class="pagination-btn" data-page="${currentPage - 1}">← Previous</button>`;
    } else {
        paginationHTML += `<button type="button" class="pagination-btn pagination-disabled" disabled>← Previous</button>`;
    }
    
    // Page numbers
    const maxPagesToShow = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
    let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);
    
    if (endPage - startPage + 1 < maxPagesToShow) {
        startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }
    
    if (startPage > 1) {
        paginationHTML += `<button type="button" class="pagination-btn" data-page="1">1</button>`;
        if (startPage > 2) paginationHTML += `<span class="pagination-ellipsis">...</span>`;
    }
    
    for (let i = startPage; i <= endPage; i++) {
        if (i === currentPage) {
            paginationHTML += `<span class="pagination-current">${i}</span>`;
        } else {
            paginationHTML += `<button type="button" class="pagination-btn" data-page="${i}">${i}</button>`;
        }
    }
    
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) paginationHTML += `<span class="pagination-ellipsis">...</span>`;
        paginationHTML += `<button type="button" class="pagination-btn" data-page="${totalPages}">${totalPages}</button>`;
    }
    
    // Next button
    if (currentPage < totalPages) {
        paginationHTML += `<button type="button" class="pagination-btn" data-page="${currentPage + 1}">Next →</button>`;
    } else {
        paginationHTML += `<button type="button" class="pagination-btn pagination-disabled" disabled>Next →</button>`;
    }
    
    paginationContainer.innerHTML = paginationHTML;
    
    // Attach event listeners
    paginationContainer.querySelectorAll('.pagination-btn:not([disabled])').forEach(button => {
        button.addEventListener('click', function() {
            const page = parseInt(this.getAttribute('data-page'));
            if (page && page !== currentPage) {
                displayTradesPage(page);
            }
        });
    });
}

function displayTrades(trades) {
    const container = document.getElementById('tradeHistory');
    const tradeCount = document.getElementById('tradeCount');
    
    if (!container) {
        console.error('❌ Trade history container not found');
        return;
    }

    if (trades.length === 0) {
        container.innerHTML = `
            <div class="text-center text-gray-500 py-8">
                <div class="text-4xl mb-4"><i class="fas fa-chart-line"></i></div>
                <p class="text-lg">No trades recorded yet.</p>
                <p class="text-sm mt-2">Start by adding your first trade in the Add Trade tab!</p>
            </div>
        `;
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
        const badgeClass = getBadgeClass(trade.instrumentType);
        const badgeText = getBadgeText(trade.instrumentType);
        const profitClass = trade.profit >= 0 ? 'profit' : 'loss';
        const moodEmoji = getMoodEmoji(trade.mood);
        const emotionDisplay = trade.emotionLevel !== undefined ? 
            `<span class="emotion-indicator" title="Emotional intensity: ${trade.emotionLevel}/100">💭 ${trade.emotionLevel}</span>` : '';
        const tradeDate = new Date(trade.timestamp);
        const dateString = tradeDate.toLocaleDateString();
        const timeString = tradeDate.toLocaleTimeString();
        
        return `
        <div class="trade-item">
            <div class="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
                <div class="flex-1 min-w-0">
                    <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-3">
                        <div class="flex items-center flex-wrap gap-2">
                            <div class="font-semibold text-base">${trade.symbol}</div>
                            <span class="market-type-badge ${badgeClass}">${badgeText}</span>
                            ${moodEmoji ? `<span class="text-lg">${moodEmoji}</span>` : ''}
                            ${emotionDisplay}
                        </div>
                        <div class="${profitClass} font-bold text-lg">
                            ${formatCurrency(trade.profit)}
                        </div>
                    </div>
                    
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-600">
                        <div><strong>Type:</strong> ${trade.type.toUpperCase()} | ${trade.lotSize} lots</div>
                        <div><strong>Entry:</strong> ${trade.entryPrice}</div>
                        <div><strong>Stop Loss:</strong> ${trade.stopLoss || 'N/A'}</div>
                        <div><strong>Take Profit:</strong> ${trade.takeProfit || 'N/A'}</div>
                        <div><strong>Exit Price:</strong> ${trade.exitPrice || 'N/A'}</div>
                        <div><strong>Risk:</strong> ${trade.stopLoss ? `${formatCurrency(trade.riskAmount)} (${(trade.riskPercent ?? 0).toFixed(1)}%)` : 'N/A'}</div>
                        <div><strong>Date:</strong> ${dateString} ${timeString}</div>
                    </div>
                    
                    ${formatConfluenceDetails(trade)}
                    ${trade.notes ? `
                        <div class="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                            <div class="text-xs font-semibold text-gray-700 mb-1">Notes:</div>
                            <div class="text-sm text-gray-600">${trade.notes}</div>
                        </div>
                    ` : ''}
                </div>
                
                <div class="trade-actions flex flex-wrap gap-2 justify-end">
                    ${trade.beforeScreenshot ? `
                        <button onclick="window.viewScreenshot('${trade.beforeScreenshot}')" 
                                class="btn-sm bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 transition-colors text-sm">
                            📷 Before
                        </button>
                    ` : ''}
                    ${trade.afterScreenshot ? `
                        <button onclick="window.viewScreenshot('${trade.afterScreenshot}')" 
                                class="btn-sm bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600 transition-colors text-sm">
                            📷 After
                        </button>
                    ` : ''}
                    <button onclick="window.deleteTrade('${trade.id}')" 
                            class="btn-sm bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 transition-colors text-sm">
                        🗑️ Delete
                    </button>
                </div>
            </div>
        </div>`;
    }).join('');
}

function getBadgeClass(instrumentType) {
    const classes = {
        'forex': 'forex-badge',
        'indices': 'indices-badge',
        'synthetic': 'synthetic-badge',
        'commodities': 'commodities-badge',
        'smarttrader': 'smarttrader-badge',
        'accumulator': 'accumulator-badge'
    };
    return classes[instrumentType] || 'forex-badge';
}

function getBadgeText(instrumentType) {
    const texts = {
        'forex': 'FX',
        'indices': 'IDX',
        'synthetic': 'SYN',
        'commodities': 'CMD',
        'smarttrader': 'SMT',
        'accumulator': 'ACC'
    };
    return texts[instrumentType] || 'FX';
}

window.deleteTrade = async (tradeId) => {
    if (!confirm('Delete this trade? This cannot be undone.')) return;
    try {
        await deleteDoc(doc(db, 'trades', tradeId));
        showSuccessMessage('Trade deleted successfully!');
    } catch (error) {
        console.error('Error deleting trade:', error);
        alert('Error deleting trade: ' + error.message);
    }
};

// ========== CHART FUNCTIONS ==========

function renderCharts(trades = []) {
    renderPerformanceChart(trades);
    renderWinLossChart(trades);
    renderMarketTypeChart(trades);
    renderConfluenceChart(trades);
}

function renderPerformanceChart(trades) {
    const ctx = document.getElementById('performanceChart');
    if (!ctx) return;

    if (performanceChart) performanceChart.destroy();

    if (trades.length === 0) {
        performanceChart = new Chart(ctx, {
            type: 'line',
            data: { 
                labels: [], 
                datasets: [{ 
                    label: 'Balance', 
                    data: [], 
                    borderColor: '#3b82f6', 
                    backgroundColor: 'rgba(59, 130, 246, 0.1)', 
                    fill: true 
                }] 
            },
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
        balance += trade.profit || 0;
        balanceData.push(balance);
        const tradeDate = new Date(trade.timestamp);
        labels.push(tradeDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
    });

    const currencySymbol = getCurrencySymbol();

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
                    callbacks: {
                        label: function(context) {
                            const idx = context.dataIndex;
                            if (idx === 0) return `Balance: ${currencySymbol}${context.parsed.y.toFixed(2)} (Start)`;
                            const trade = sortedTrades[idx - 1];
                            if (!trade) return `Balance: ${currencySymbol}${context.parsed.y.toFixed(2)}`;
                            return `Balance: ${currencySymbol}${context.parsed.y.toFixed(2)} | P/L: ${trade.profit >= 0 ? '+' : ''}${currencySymbol}${trade.profit.toFixed(2)}`;
                        }
                    }
                }
            },
            scales: {
                x: { display: true },
                y: { 
                    display: true, 
                    title: { 
                        display: true, 
                        text: `Balance (${currencySymbol})` 
                    } 
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
            data: { 
                labels: ['No Data'], 
                datasets: [{ data: [1], backgroundColor: ['#9ca3af'] }] 
            },
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
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.label}: ${context.parsed}`;
                        }
                    }
                }
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
            data: { 
                labels: ['No Data'], 
                datasets: [{ data: [1], backgroundColor: ['#9ca3af'] }] 
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
        return;
    }

    const typeCounts = {
        'forex': trades.filter(t => t.instrumentType === 'forex').length,
        'indices': trades.filter(t => t.instrumentType === 'indices').length,
        'synthetic': trades.filter(t => t.instrumentType === 'synthetic').length,
        'commodities': trades.filter(t => t.instrumentType === 'commodities').length,
        'smarttrader': trades.filter(t => t.instrumentType === 'smarttrader').length,
        'accumulator': trades.filter(t => t.instrumentType === 'accumulator').length
    };

    const labels = [];
    const data = [];
    const colors = [];

    if (typeCounts.forex > 0) { labels.push(`Forex (${typeCounts.forex})`); data.push(typeCounts.forex); colors.push('#3b82f6'); }
    if (typeCounts.indices > 0) { labels.push(`Indices (${typeCounts.indices})`); data.push(typeCounts.indices); colors.push('#8b5cf6'); }
    if (typeCounts.synthetic > 0) { labels.push(`Synthetic (${typeCounts.synthetic})`); data.push(typeCounts.synthetic); colors.push('#ec4899'); }
    if (typeCounts.commodities > 0) { labels.push(`Commodities (${typeCounts.commodities})`); data.push(typeCounts.commodities); colors.push('#f59e0b'); }
    if (typeCounts.smarttrader > 0) { labels.push(`SmartTrader (${typeCounts.smarttrader})`); data.push(typeCounts.smarttrader); colors.push('#06b6d4'); }
    if (typeCounts.accumulator > 0) { labels.push(`Accumulator (${typeCounts.accumulator})`); data.push(typeCounts.accumulator); colors.push('#ef4444'); }

    if (labels.length === 0) { 
        labels.push('No Trades'); 
        data.push(1); 
        colors.push('#9ca3af'); 
    }

    marketTypeChart = new Chart(ctx, {
        type: 'pie',
        data: { 
            labels: labels, 
            datasets: [{ 
                data: data, 
                backgroundColor: colors,
                borderWidth: 2,
                borderColor: '#ffffff'
            }] 
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.label}: ${context.parsed}`;
                        }
                    }
                }
            }
        }
    });
}

function renderConfluenceChart(trades = []) {
    const ctx = document.getElementById('confluenceChart');
    if (!ctx) return;

    if (confluenceChart) confluenceChart.destroy();

    if (trades.length === 0) {
        confluenceChart = new Chart(ctx, {
            type: 'bar',
            data: { 
                labels: ['No Data'], 
                datasets: [{ data: [0], backgroundColor: ['#9ca3af'] }] 
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
        return;
    }

    const scoreBuckets = [
        { label: '0-20%', max: 20 },
        { label: '21-40%', max: 40 },
        { label: '41-60%', max: 60 },
        { label: '61-80%', max: 80 },
        { label: '81-100%', max: 100 }
    ];

    const bucketCounts = scoreBuckets.map(() => 0);

    trades.forEach(trade => {
        if (typeof trade.confluenceScore !== 'number') return;
        const score = trade.confluenceScore;
        const bucketIndex = scoreBuckets.findIndex(bucket => score <= bucket.max);
        if (bucketIndex >= 0) bucketCounts[bucketIndex]++;
    });

    confluenceChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: scoreBuckets.map(bucket => bucket.label),
            datasets: [{
                label: 'Trades by Confluence Score',
                data: bucketCounts,
                backgroundColor: ['#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe', '#dbeafe'],
                borderColor: '#1d4ed8',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.parsed.y} trades`;
                        }
                    }
                }
            },
            scales: {
                x: { grid: { display: false } },
                y: { 
                    beginAtZero: true, 
                    ticks: { precision: 0 } 
                }
            }
        }
    });
}

// ========== ADVANCED METRICS ==========

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

    const riskRewardTrades = trades.filter(t => t.takeProfit && t.riskAmount > 0);
    const avgRiskReward = riskRewardTrades.length > 0 ? 
        riskRewardTrades.reduce((sum, trade) => {
            const potentialProfit = Math.abs(calculateProfitLoss(
                trade.entryPrice, trade.takeProfit, trade.lotSize, trade.symbol, trade.type
            ));
            return sum + (potentialProfit / trade.riskAmount);
        }, 0) / riskRewardTrades.length : 0;

    const weeklyPerformance = calculateWeeklyPerformance(trades);
    const consistency = weeklyPerformance.length > 0 ? 
        (weeklyPerformance.filter(week => week.profit > 0).length / weeklyPerformance.length * 100) : 0;

    updatePerformanceMetrics({
        avgWin, avgLoss, largestWin, largestLoss, 
        profitFactor, expectancy, avgRiskReward, consistency
    });

    calculatePsychologicalMetrics(trades);
    calculateConfluenceMetrics(trades);
    calculateTimeAnalysis(trades);
}

function resetAdvancedMetrics() {
    const metrics = {
        'avgWin': '$0.00',
        'avgLoss': '$0.00',
        'largestWin': '$0.00',
        'largestLoss': '$0.00',
        'profitFactor': '0.00',
        'expectancy': '$0.00',
        'avgRiskReward': '0.00',
        'consistency': '0%',
        'bestMood': '-',
        'worstMood': '-',
        'disciplineScore': '0%',
        'riskAdherence': '0%',
        'avgConfluenceScore': '0%',
        'confluenceCoverage': '0%',
        'bestDay': '-',
        'bestInstrument': '-',
        'avgDuration': '-',
        'tradesPerMonth': '0',
        'worstDay': '-',
        'worstInstrument': '-'
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
        if (element) {
            element.textContent = value;
            if (id === 'avgWin' || id === 'largestWin') element.className = 'metric-value profit';
            else if (id === 'avgLoss' || id === 'largestLoss') element.className = 'metric-value loss';
        }
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

    document.getElementById('bestMood').innerHTML = bestMood;
    document.getElementById('worstMood').innerHTML = worstMood;
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

function calculateConfluenceMetrics(trades) {
    const validTrades = trades.filter(t => typeof t.confluenceScore === 'number');
    const avgConfluenceScore = validTrades.length > 0 ?
        validTrades.reduce((sum, t) => sum + t.confluenceScore, 0) / validTrades.length : 0;
    const coverage = trades.length > 0 ? (validTrades.length / trades.length) * 100 : 0;

    const avgConfluenceEl = document.getElementById('avgConfluenceScore');
    const coverageEl = document.getElementById('confluenceCoverage');

    if (avgConfluenceEl) avgConfluenceEl.textContent = `${avgConfluenceScore.toFixed(0)}%`;
    if (coverageEl) coverageEl.textContent = `${coverage.toFixed(0)}%`;
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
    let worstDay = '-';
    let worstDayProfit = Infinity;

    Object.entries(dayPerformance).forEach(([day, data]) => {
        const avgProfit = data.total / data.count;
        if (avgProfit > bestDayProfit) {
            bestDayProfit = avgProfit;
            bestDay = day;
        }
        if (avgProfit < worstDayProfit) {
            worstDayProfit = avgProfit;
            worstDay = day;
        }
    });

    let bestInstrument = '-';
    let bestInstrumentProfit = -Infinity;
    let worstInstrument = '-';
    let worstInstrumentProfit = Infinity;

    Object.entries(instrumentPerformance).forEach(([symbol, data]) => {
        const avgProfit = data.total / data.count;
        if (avgProfit > bestInstrumentProfit) {
            bestInstrumentProfit = avgProfit;
            bestInstrument = symbol;
        }
        if (avgProfit < worstInstrumentProfit) {
            worstInstrumentProfit = avgProfit;
            worstInstrument = symbol;
        }
    });

    const monthlyTrades = trades.length / (getTradingMonths(trades) || 1);

    document.getElementById('bestDay').textContent = bestDay;
    document.getElementById('worstDay').textContent = worstDay;
    document.getElementById('bestInstrument').textContent = bestInstrument;
    document.getElementById('worstInstrument').textContent = worstInstrument;
    document.getElementById('avgDuration').textContent = 'Intraday';
    document.getElementById('tradesPerMonth').textContent = monthlyTrades.toFixed(1);
}

function getTradingMonths(trades) {
    if (trades.length < 2) return 1;
    const firstTrade = new Date(trades[trades.length - 1].timestamp);
    const lastTrade = new Date(trades[0].timestamp);
    return (lastTrade - firstTrade) / (1000 * 60 * 60 * 24 * 30.44);
}

// ========== EMOTION ANALYTICS ==========

function updateEmotionAnalytics(trades) {
    if (!trades || trades.length === 0) {
        resetEmotionAnalytics();
        return;
    }

    const emotionCounts = {
        calm: 0,
        balanced: 0,
        anxious: 0,
        intense: 0
    };
    let totalTrades = 0;

    trades.forEach(trade => {
        if (trade.emotionLevel !== undefined && trade.emotionLevel !== null) {
            const category = getEmotionCategory(trade.emotionLevel);
            if (emotionCounts.hasOwnProperty(category)) {
                emotionCounts[category]++;
                totalTrades++;
            }
        }
    });

    const emotions = ['calm', 'balanced', 'anxious', 'intense'];
    emotions.forEach(emotion => {
        const countElement = document.getElementById(`${emotion}Trades`);
        const percentElement = document.getElementById(`${emotion}Percent`);
        
        if (countElement) countElement.textContent = emotionCounts[emotion] || 0;
        if (percentElement) {
            const percent = totalTrades > 0 ? Math.round((emotionCounts[emotion] / totalTrades) * 100) : 0;
            percentElement.textContent = `${percent}%`;
        }
    });

    updateEmotionInsights(emotionCounts, totalTrades, trades);
}

function resetEmotionAnalytics() {
    const emotions = ['calm', 'balanced', 'anxious', 'intense'];
    emotions.forEach(emotion => {
        const countElement = document.getElementById(`${emotion}Trades`);
        const percentElement = document.getElementById(`${emotion}Percent`);
        if (countElement) countElement.textContent = '0';
        if (percentElement) percentElement.textContent = '0%';
    });
    const insightsElement = document.getElementById('emotionInsights');
    if (insightsElement) {
        insightsElement.textContent = 'No emotion data available yet. Start tracking your emotional state with each trade!';
    }
}

function updateEmotionInsights(counts, total, trades) {
    const insightsElement = document.getElementById('emotionInsights');
    if (!insightsElement) return;

    if (total === 0) {
        insightsElement.textContent = 'No emotion data available yet. Start tracking your emotional state with each trade!';
        return;
    }

    let insights = [];
    const calmPercent = Math.round((counts.calm / total) * 100);
    const anxiousPercent = Math.round((counts.anxious / total) * 100);
    const intensePercent = Math.round((counts.intense / total) * 100);

    if (calmPercent >= 60) {
        insights.push('✅ Excellent! You maintain calm in most trades.');
    } else if (anxiousPercent >= 40) {
        insights.push('⚠️ Consider developing techniques to reduce anxiety during trading.');
    }

    if (intensePercent >= 30) {
        insights.push('🔥 High emotional intensity detected. Consider taking breaks between trades.');
    }

    const profitableTrades = trades.filter(t => t.profit > 0 && t.emotionLevel !== undefined);
    const losingTrades = trades.filter(t => t.profit < 0 && t.emotionLevel !== undefined);

    if (profitableTrades.length > 0 && losingTrades.length > 0) {
        const avgProfitEmotion = profitableTrades.reduce((sum, t) => sum + t.emotionLevel, 0) / profitableTrades.length;
        const avgLossEmotion = losingTrades.reduce((sum, t) => sum + t.emotionLevel, 0) / losingTrades.length;
        
        if (avgProfitEmotion < avgLossEmotion) {
            insights.push('📉 Lower emotion levels correlate with better performance.');
        } else if (avgProfitEmotion > avgLossEmotion) {
            insights.push('📈 Higher emotional intensity may be affecting your results.');
        }
    }

    if (insights.length === 0) {
        insights.push('💡 Keep tracking emotions to identify patterns in your trading psychology.');
    }

    insightsElement.textContent = insights.join(' ');
}

// ========== EMOTION GAUGE ==========

function initEmotionGauge() {
    const emotionSlider = document.getElementById('emotionLevel');
    if (emotionSlider) {
        emotionSlider.addEventListener('input', function(e) {
            updateEmotionDisplay(parseInt(e.target.value));
        });
        updateEmotionDisplay(50);
    }
}

function updateEmotionDisplay(value) {
    const emotionValue = document.getElementById('emotionValue');
    const emotionDescription = document.getElementById('emotionDescription');
    const gaugeFill = document.getElementById('emotionGaugeFill');

    if (emotionValue) emotionValue.textContent = value;
    if (gaugeFill) gaugeFill.style.width = `${value}%`;

    let description = '';
    if (value <= 20) description = 'Very calm and collected';
    else if (value <= 40) description = 'Calm and focused';
    else if (value <= 60) description = 'Balanced emotional state';
    else if (value <= 80) description = 'Elevated emotions';
    else description = 'Highly intense emotional state';

    if (emotionDescription) emotionDescription.textContent = description;
}

// ========== AI SUGGESTION SYSTEM ==========

function generateAISuggestions() {
    const trades = allTrades;
    
    if (!trades || trades.length === 0) {
        showEmptyAISuggestions();
        return;
    }
    
    const metrics = calculateAllMetrics(trades);
    const currentAccount = getCurrentAccount();
    
    const primaryInsight = generatePrimaryInsight(metrics, trades);
    const riskInsight = generateRiskInsight(metrics, currentAccount);
    const trendInsight = generateTrendInsight(metrics, trades);
    const recommendations = generateRecommendations(metrics, trades);
    
    updateAISuggestionsUI(primaryInsight, riskInsight, trendInsight, recommendations, metrics);
}

function calculateAllMetrics(trades) {
    const winningTrades = trades.filter(t => t.profit > 0);
    const losingTrades = trades.filter(t => t.profit < 0);
    
    const totalTrades = trades.length;
    const winRate = totalTrades > 0 ? (winningTrades.length / totalTrades) * 100 : 0;
    const totalProfit = winningTrades.reduce((sum, t) => sum + t.profit, 0);
    const totalLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.profit, 0));
    const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : (totalProfit > 0 ? 999 : 0);
    const avgWin = winningTrades.length > 0 ? totalProfit / winningTrades.length : 0;
    const avgLoss = losingTrades.length > 0 ? totalLoss / losingTrades.length : 0;
    const expectancy = (winRate / 100) * avgWin - ((100 - winRate) / 100) * avgLoss;
    
    const weeklyPerformance = calculateWeeklyPerformance(trades);
    const consistency = weeklyPerformance.length > 0 ?
        (weeklyPerformance.filter(w => w.profit > 0).length / weeklyPerformance.length) * 100 : 0;
    
    return {
        totalTrades, winRate, totalProfit, totalLoss, profitFactor, avgWin, avgLoss, expectancy, consistency,
        winningTradesCount: winningTrades.length,
        losingTradesCount: losingTrades.length
    };
}

function generatePrimaryInsight(metrics, trades) {
    const { winRate, profitFactor } = metrics;
    
    if (profitFactor >= 2.0 && winRate >= 50) {
        return {
            type: 'success',
            title: '🏆 Excellent Performance',
            message: `Your profit factor of ${profitFactor.toFixed(2)} and ${winRate.toFixed(1)}% win rate shows strong trading discipline.`,
            action: 'Consider gradually increasing position size while maintaining risk rules.'
        };
    }
    
    if (winRate >= 60) {
        return {
            type: 'success',
            title: '🎯 High Win Rate',
            message: `Your ${winRate.toFixed(1)}% win rate is excellent. Focus on maintaining your edge.`,
            action: 'Document what\'s working well in your current strategy.'
        };
    }
    
    return {
        type: 'info',
        title: '📊 Steady Progress',
        message: `Your win rate is ${winRate.toFixed(1)}% with a profit factor of ${profitFactor.toFixed(2)}.`,
        action: 'Focus on improving your risk-reward ratio on losing trades.'
    };
}

function generateRiskInsight(metrics, currentAccount) {
    return {
        type: 'info',
        title: '📋 Risk Profile',
        message: `Profit Factor: ${metrics.profitFactor.toFixed(2)} | Expectancy: ${formatCurrency(metrics.expectancy)}`,
        action: 'Track your risk metrics weekly to identify trends.'
    };
}

function generateTrendInsight(metrics, trades) {
    return {
        type: 'info',
        title: '📊 Trading Patterns',
        message: `Weekly consistency: ${metrics.consistency.toFixed(0)}% | ${metrics.totalTrades} total trades`,
        action: 'Continue logging trades to build more data for analysis.'
    };
}

function generateRecommendations(metrics, trades) {
    const recommendations = [];
    
    if (metrics.winRate < 40 && metrics.totalTrades >= 10) {
        recommendations.push({
            priority: 'high',
            category: 'Entry Strategy',
            icon: '🎯',
            text: 'Your win rate is below 40%. Focus on higher probability setups.'
        });
    }
    
    if (metrics.profitFactor < 1.0 && metrics.totalTrades >= 10) {
        recommendations.push({
            priority: 'critical',
            category: 'Strategy Review',
            icon: '🔴',
            text: `Profit factor of ${metrics.profitFactor.toFixed(2)} means you're losing money. Review your strategy.`
        });
    }
    
    if (metrics.expectancy < 0 && metrics.totalTrades >= 20) {
        recommendations.push({
            priority: 'high',
            category: 'Edge Analysis',
            icon: '📉',
            text: `Negative expectancy (${formatCurrency(metrics.expectancy)}). Your strategy needs changes.`
        });
    }
    
    if (recommendations.length < 3) {
        recommendations.push({
            priority: 'low',
            category: 'Journaling',
            icon: '📝',
            text: 'Continue logging every trade with detailed notes.'
        });
        
        recommendations.push({
            priority: 'low',
            category: 'Review',
            icon: '🔍',
            text: 'Set aside 30 minutes weekly to review your trades.'
        });
    }
    
    const priorityOrder = { 'critical': 0, 'high': 1, 'medium': 2, 'low': 3 };
    recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
    
    return recommendations.slice(0, 6);
}

function showEmptyAISuggestions() {
    document.getElementById('primaryInsightText').innerHTML = '<span class="text-gray-500">No trades yet. Add your first trade!</span>';
    document.getElementById('riskInsightText').innerHTML = '<span class="text-gray-500">Waiting for trade data...</span>';
    document.getElementById('trendInsightText').innerHTML = '<span class="text-gray-500">Waiting for trade data...</span>';
    
    const recEl = document.getElementById('aiRecommendations');
    if (recEl) recEl.innerHTML = '<div class="text-center py-4 text-gray-500"><p>Add at least 5 trades for recommendations.</p></div>';
}

function updateAISuggestionsUI(primary, risk, trend, recommendations, metrics) {
    const primaryEl = document.getElementById('primaryInsightText');
    if (primaryEl) primaryEl.innerHTML = `
        <div class="font-semibold text-gray-800">${primary.type === 'success' ? '✅' : 'ℹ️'} ${primary.title}</div>
        <p class="text-sm text-gray-600 mt-1">${primary.message}</p>
        <p class="text-xs text-indigo-600 mt-2">→ ${primary.action}</p>
    `;
    
    const riskEl = document.getElementById('riskInsightText');
    if (riskEl) riskEl.innerHTML = `
        <div class="font-semibold text-gray-800">ℹ️ ${risk.title}</div>
        <p class="text-sm text-gray-600 mt-1">${risk.message}</p>
        <p class="text-xs text-red-600 mt-2">→ ${risk.action}</p>
    `;
    
    const trendEl = document.getElementById('trendInsightText');
    if (trendEl) trendEl.innerHTML = `
        <div class="font-semibold text-gray-800">📊 ${trend.title}</div>
        <p class="text-sm text-gray-600 mt-1">${trend.message}</p>
        <p class="text-xs text-green-600 mt-2">→ ${trend.action}</p>
    `;
    
    const recEl = document.getElementById('aiRecommendations');
    if (recEl && recommendations.length > 0) {
        recEl.innerHTML = recommendations.map(rec => {
            const colors = {
                'critical': 'border-red-500 bg-red-50',
                'high': 'border-orange-500 bg-orange-50',
                'medium': 'border-yellow-500 bg-yellow-50',
                'low': 'border-blue-500 bg-blue-50'
            };
            return `
                <div class="flex items-start gap-3 p-3 rounded-lg border-l-4 ${colors[rec.priority]}">
                    <span class="text-xl">${rec.icon}</span>
                    <div class="flex-1">
                        <span class="text-xs font-semibold text-gray-500 uppercase">${rec.category}</span>
                        <p class="text-sm text-gray-700 mt-1">${rec.text}</p>
                    </div>
                </div>
            `;
        }).join('');
    }
}

window.refreshAISuggestions = () => {
    showLoading();
    setTimeout(() => {
        generateAISuggestions();
        hideLoading();
        showSuccessMessage('AI analysis refreshed! 🤖');
    }, 500);
};

// ========== CONFLUENCE FUNCTIONS ==========

function getCurrentConfluenceOptions() {
    const deleted = [];
    try {
        const raw = localStorage.getItem('deletedConfluenceOptions');
        if (raw) deleted.push(...JSON.parse(raw));
    } catch(e) {}
    
    const defaultOptions = DEFAULT_CONFLUENCE_OPTIONS.filter(option => !deleted.includes(option));
    const customOptions = [];
    try {
        const raw = localStorage.getItem('customConfluenceOptions');
        if (raw) customOptions.push(...JSON.parse(raw));
    } catch(e) {}
    
    return [...new Set([...defaultOptions, ...customOptions])];
}

function getCustomConfluenceOptions() {
    try {
        const raw = localStorage.getItem('customConfluenceOptions');
        return raw ? JSON.parse(raw) : [];
    } catch (error) {
        return [];
    }
}

function saveCustomConfluenceOptions(options) {
    localStorage.setItem('customConfluenceOptions', JSON.stringify(options));
}

function getDeletedConfluenceOptions() {
    try {
        const raw = localStorage.getItem('deletedConfluenceOptions');
        return raw ? JSON.parse(raw) : [];
    } catch (error) {
        return [];
    }
}

function saveDeletedConfluenceOptions(options) {
    localStorage.setItem('deletedConfluenceOptions', JSON.stringify(options));
}

function renderConfluenceOptions() {
    const container = document.getElementById('confluenceOptions');
    if (!container) return;

    const currentlySelected = Array.from(
        container.querySelectorAll('input[type="checkbox"]:checked')
    ).map(input => input.value);
    
    const options = getCurrentConfluenceOptions();
    container.innerHTML = '';

    options.forEach(option => {
        const optionLabel = document.createElement('label');
        optionLabel.className = 'confluence-option';
        optionLabel.style.cssText = 'display:block;margin:6px 0;cursor:pointer;';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = option;
        checkbox.checked = currentlySelected.includes(option);
        checkbox.style.cssText = 'margin-right:8px;';

        const text = document.createElement('span');
        text.textContent = option;

        optionLabel.appendChild(checkbox);
        optionLabel.appendChild(text);

        if (option !== 'Market Structure') {
            const removeButton = document.createElement('button');
            removeButton.type = 'button';
            removeButton.textContent = '✕';
            removeButton.style.cssText = 'margin-left:8px;color:red;border:none;background:none;cursor:pointer;font-size:12px;';
            removeButton.addEventListener('click', () => removeConfluenceOption(option));
            optionLabel.appendChild(removeButton);
        }

        container.appendChild(optionLabel);
    });
}

function updateConfluenceScoreDisplay() {
    const selected = Array.from(
        document.querySelectorAll('#confluenceOptions input[type="checkbox"]:checked')
    ).length;
    const total = document.querySelectorAll('#confluenceOptions input[type="checkbox"]').length;
    const score = total > 0 ? Math.round((selected / total) * 100) : 0;
    const display = document.getElementById('confluenceScoreDisplay');
    if (display) display.textContent = `${score}% selected (${selected} of ${total})`;
}

function addConfluenceOption() {
    const input = document.getElementById('newConfluenceOption');
    if (!input) return;

    const newOption = input.value.trim();
    if (!newOption) {
        alert('Please enter a confluence option name.');
        return;
    }

    const normalizedNewOption = newOption.toLowerCase();
    const existingOptions = getCurrentConfluenceOptions();
    if (existingOptions.some(option => option.toLowerCase() === normalizedNewOption)) {
        alert('This option already exists.');
        return;
    }

    const deletedOptions = getDeletedConfluenceOptions();
    const defaultMatch = DEFAULT_CONFLUENCE_OPTIONS.find(
        option => option.toLowerCase() === normalizedNewOption
    );
    
    if (defaultMatch) {
        const restored = deletedOptions.filter(
            option => option.toLowerCase() !== normalizedNewOption
        );
        saveDeletedConfluenceOptions(restored);
    } else {
        const customOptions = getCustomConfluenceOptions();
        customOptions.push(newOption);
        saveCustomConfluenceOptions(customOptions);
    }

    input.value = '';
    renderConfluenceOptions();
    updateConfluenceScoreDisplay();
}

function removeConfluenceOption(option) {
    if (!option || option === 'Market Structure') return;

    const customOptions = getCustomConfluenceOptions();
    if (customOptions.includes(option)) {
        const updatedCustom = customOptions.filter(item => item !== option);
        saveCustomConfluenceOptions(updatedCustom);
    } else if (DEFAULT_CONFLUENCE_OPTIONS.includes(option)) {
        const deleted = getDeletedConfluenceOptions();
        if (!deleted.includes(option)) {
            deleted.push(option);
            saveDeletedConfluenceOptions(deleted);
        }
    }

    renderConfluenceOptions();
    updateConfluenceScoreDisplay();
}

function formatConfluenceDetails(trade) {
    if (!trade?.confluenceOptions || trade.confluenceOptions.length === 0) return '';

    const selectedList = trade.confluenceOptions.map(option => 
        `<span class="inline-flex items-center rounded-full bg-blue-100 text-blue-800 px-2 py-1 text-xs font-medium mr-1 mb-1">${option}</span>`
    ).join('');
    
    const scoreText = trade.confluenceScore != null ? `${trade.confluenceScore}%` : 'N/A';

    return `
        <div class="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
            <div class="font-semibold text-gray-700 text-xs mb-2">Confluence</div>
            <div class="flex flex-wrap gap-1 mb-1">${selectedList}</div>
            <div class="text-xs text-gray-500">Score: ${scoreText}</div>
        </div>
    `;
}

// ========== AFFIRMATIONS FUNCTIONS ==========

async function loadAffirmations() {
    try {
        if (!currentUser) return;

        const q = query(collection(db, 'affirmations'), where('userId', '==', currentUser.uid));
        const querySnapshot = await getDocs(q);
        
        const affirmations = [];
        querySnapshot.forEach((doc) => affirmations.push({ id: doc.id, ...doc.data() }));

        if (affirmations.length === 0) {
            console.log('Creating sample affirmations...');
            for (const sample of sampleAffirmations) {
                const affirmationData = { ...sample, userId: currentUser.uid };
                await addDoc(collection(db, 'affirmations'), affirmationData);
            }
            await loadAffirmations();
            return;
        }

        allAffirmations = affirmations;
        updateAffirmationStats();
        renderAffirmationsGrid();
        setupDailyAffirmation();
        console.log('✅ Affirmations loaded:', affirmations.length);
    } catch (error) {
        console.error('Error loading affirmations:', error);
        allAffirmations = [...sampleAffirmations];
        updateAffirmationStats();
        renderAffirmationsGrid();
        setupDailyAffirmation();
    }
}

function updateAffirmationStats() {
    const total = allAffirmations.length;
    const active = allAffirmations.filter(a => a.isActive).length;
    const favorites = allAffirmations.filter(a => a.isFavorite).length;
    const usedThisWeek = allAffirmations.filter(a => {
        const lastUsed = new Date(a.lastUsed);
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        return lastUsed > weekAgo;
    }).length;

    const totalEl = document.getElementById('totalAffirmations');
    const activeEl = document.getElementById('activeAffirmations');
    const favEl = document.getElementById('favoriteAffirmations');
    const usedEl = document.getElementById('usedThisWeek');
    
    if (totalEl) totalEl.textContent = total;
    if (activeEl) activeEl.textContent = active;
    if (favEl) favEl.textContent = favorites;
    if (usedEl) usedEl.textContent = usedThisWeek;
}

function renderAffirmationsGrid(filteredAffirmations = null) {
    const grid = document.getElementById('affirmationsGrid');
    const emptyState = document.getElementById('emptyAffirmations');
    const affirmations = filteredAffirmations || allAffirmations;

    if (!grid) return;

    if (affirmations.length === 0) {
        grid.innerHTML = '';
        if (emptyState) emptyState.classList.remove('hidden');
        return;
    }

    if (emptyState) emptyState.classList.add('hidden');
    
    grid.innerHTML = affirmations.map(affirmation => `
        <div class="affirmation-card bg-white border-l-4 border-purple-500 p-6 rounded-2xl shadow-sm">
            <p class="text-lg font-semibold text-gray-800 leading-relaxed">"${affirmation.text}"</p>
            <div class="flex items-center mt-3 space-x-3">
                <span class="text-xs bg-purple-100 text-purple-800 px-3 py-1 rounded-full">
                    ${getCategoryDisplayName(affirmation.category)}
                </span>
                <span class="text-xs text-gray-500">🔥 ${affirmation.usageCount} uses</span>
            </div>
            <div class="flex space-x-2 mt-4">
                <button onclick="window.useAffirmation('${affirmation.id}')" 
                        class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold">
                    ✅ Use Now
                </button>
                <button onclick="window.copyAffirmation('${affirmation.id}')" 
                        class="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm">
                    📋 Copy
                </button>
                <button onclick="window.deleteAffirmation('${affirmation.id}')" 
                        class="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm">
                    🗑️ Delete
                </button>
            </div>
        </div>
    `).join('');
}

function getCategoryDisplayName(category) {
    const names = {
        'confidence': 'Confidence', 'discipline': 'Discipline', 'patience': 'Patience',
        'risk-management': 'Risk Management', 'mindset': 'Mindset', 'general': 'General'
    };
    return names[category] || 'General';
}

function setupDailyAffirmation() {
    const dailyAffirmation = getRandomAffirmation();
    if (dailyAffirmation) {
        const dailyEl = document.getElementById('dailyAffirmation');
        const categoryEl = document.getElementById('dailyAffirmationCategory');
        const strengthEl = document.getElementById('affirmationStrength');
        
        if (dailyEl) dailyEl.textContent = `"${dailyAffirmation.text}"`;
        if (categoryEl) categoryEl.textContent = getCategoryDisplayName(dailyAffirmation.category);
        if (strengthEl) strengthEl.textContent = `${dailyAffirmation.strength}%`;
    }
}

function getRandomAffirmation() {
    const activeAffirmations = allAffirmations.filter(a => a.isActive);
    if (activeAffirmations.length === 0) return null;
    return activeAffirmations[Math.floor(Math.random() * activeAffirmations.length)];
}

// Expose affirmation functions to window
window.addNewAffirmation = () => {
    editingAffirmationId = null;
    document.getElementById('modalTitle').textContent = 'Create New Affirmation';
    document.getElementById('affirmationText').value = '';
    document.getElementById('affirmationCategorySelect').value = 'confidence';
    document.getElementById('isFavorite').checked = false;
    document.getElementById('isActive').checked = true;
    document.getElementById('charCount').textContent = '0';
    document.getElementById('affirmationModal').classList.remove('hidden');
};

window.closeAffirmationModal = () => {
    document.getElementById('affirmationModal').classList.add('hidden');
};

window.useAffirmation = async (id) => {
    try {
        const affirmation = allAffirmations.find(a => a.id === id);
        if (affirmation) {
            const updatedData = {
                usageCount: affirmation.usageCount + 1,
                lastUsed: new Date().toISOString()
            };
            await updateDoc(doc(db, 'affirmations', id), updatedData);
            affirmation.usageCount = updatedData.usageCount;
            affirmation.lastUsed = updatedData.lastUsed;
            updateAffirmationStats();
            renderAffirmationsGrid();
            showSuccessMessage('Affirmation marked as used! 💪');
        }
    } catch (error) {
        console.error('Error using affirmation:', error);
        alert('Error updating affirmation.');
    }
};

window.copyAffirmation = (id) => {
    const affirmation = allAffirmations.find(a => a.id === id);
    if (affirmation) {
        navigator.clipboard.writeText(affirmation.text)
            .then(() => showSuccessMessage('Copied to clipboard!'))
            .catch(() => alert('Failed to copy.'));
    }
};

window.toggleFavorite = async (id) => {
    try {
        const affirmation = allAffirmations.find(a => a.id === id);
        if (affirmation) {
            const updatedData = { isFavorite: !affirmation.isFavorite };
            await updateDoc(doc(db, 'affirmations', id), updatedData);
            affirmation.isFavorite = updatedData.isFavorite;
            renderAffirmationsGrid();
        }
    } catch (error) {
        console.error('Error:', error);
    }
};

window.deleteAffirmation = async (id) => {
    if (confirm('Delete this affirmation?')) {
        try {
            await deleteDoc(doc(db, 'affirmations', id));
            allAffirmations = allAffirmations.filter(a => a.id !== id);
            updateAffirmationStats();
            renderAffirmationsGrid();
            showSuccessMessage('Affirmation deleted!');
        } catch (error) {
            console.error('Error:', error);
            alert('Error deleting affirmation.');
        }
    }
};

window.showRandomAffirmation = () => {
    const randomAffirmation = getRandomAffirmation();
    if (randomAffirmation) {
        document.getElementById('randomAffirmationText').textContent = `"${randomAffirmation.text}"`;
        document.getElementById('randomAffirmationModal').classList.remove('hidden');
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
            await updateDoc(doc(db, 'affirmations', randomAffirmation.id), {
                usageCount: randomAffirmation.usageCount + 1,
                lastUsed: new Date().toISOString()
            });
            randomAffirmation.usageCount++;
            randomAffirmation.lastUsed = new Date().toISOString();
            updateAffirmationStats();
            window.closeRandomModal();
            showSuccessMessage('Affirmation used! 💪');
        }
    } catch (error) {
        console.error('Error:', error);
    }
};

window.refreshDailyAffirmation = () => {
    setupDailyAffirmation();
    showSuccessMessage('Daily affirmation refreshed! 🔄');
};

window.markDailyAsUsed = async () => {
    try {
        const dailyText = document.getElementById('dailyAffirmation').textContent.replace(/"/g, '').trim();
        const affirmation = allAffirmations.find(a => a.text === dailyText);
        if (affirmation) {
            await updateDoc(doc(db, 'affirmations', affirmation.id), {
                usageCount: affirmation.usageCount + 1,
                lastUsed: new Date().toISOString()
            });
            affirmation.usageCount++;
            affirmation.lastUsed = new Date().toISOString();
            updateAffirmationStats();
            showSuccessMessage('Daily affirmation marked as used! ✅');
        }
    } catch (error) {
        console.error('Error:', error);
    }
};

window.speakAffirmation = () => {
    const affirmationText = document.getElementById('dailyAffirmation').textContent;
    if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(affirmationText);
        utterance.rate = 0.8;
        speechSynthesis.speak(utterance);
    }
};

window.showMotivationalQuote = () => {
    const randomQuote = motivationalQuotes[Math.floor(Math.random() * motivationalQuotes.length)];
    alert(`Motivational Quote:\n\n"${randomQuote}"`);
};

window.exportAffirmations = () => {
    const csv = allAffirmations.map(a => 
        `"${a.text.replace(/"/g, '""')}",${a.category},${a.isFavorite ? 'Yes' : 'No'},${a.isActive ? 'Yes' : 'No'},${a.usageCount}`
    ).join('\n');
    const blob = new Blob(['Text,Category,Favorite,Active,Usage\n' + csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `affirmations-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showSuccessMessage('Affirmations exported!');
};

// ========== RISK CALCULATION ==========

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

    if (entryPrice > 0 && symbol) {
        const pipPointInfo = calculatePipsPoints(entryPrice, stopLoss, takeProfit, symbol, tradeType);
        const potentialProfit = takeProfit ? calculateProfitLoss(entryPrice, takeProfit, lotSize, symbol, tradeType) : 0;
        const potentialLoss = stopLoss > 0 ? calculateProfitLoss(entryPrice, stopLoss, lotSize, symbol, tradeType) : 0;
        const riskRewardRatio = takeProfit && potentialLoss !== 0 ? Math.abs(potentialProfit / potentialLoss) : 0;
        const maxRiskAmount = accountSize * (riskPerTrade / 100);
        const riskPerLot = stopLoss > 0 ? Math.abs(calculateProfitLoss(entryPrice, stopLoss, 1, symbol, tradeType)) : 0;
        const recommendedLotSize = riskPerLot > 0 ? (maxRiskAmount / riskPerLot).toFixed(2) : 0;
        const instrumentType = getInstrumentType(symbol);
        const unitType = instrumentType === 'forex' ? 'pips' : 'points';

        const riskElements = {
            'pipsRisk': stopLoss > 0 ? pipPointInfo.risk.toFixed(1) + ' ' + unitType : 'N/A',
            'totalRisk': stopLoss > 0 ? formatCurrency(Math.abs(potentialLoss)) : '$0.00',
            'riskPercentage': stopLoss > 0 ? (Math.abs(potentialLoss) / accountSize * 100).toFixed(2) + '%' : '0.00%',
            'riskRewardRatio': riskRewardRatio.toFixed(2),
            'recommendedLotSize': recommendedLotSize
        };

        Object.entries(riskElements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) element.textContent = value;
        });
    }
}

// ========== EXPORT/IMPORT FUNCTIONS ==========

async function exportTradesFunc() {
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
        
        const headers = ['Date', 'Symbol', 'Type', 'Entry', 'SL', 'TP', 'Lots', 'Profit', 'Notes'];
        const csvRows = [headers.join(',')];
        
        trades.forEach(trade => {
            csvRows.push([
                new Date(trade.timestamp).toLocaleDateString(),
                trade.symbol,
                trade.type,
                trade.entryPrice,
                trade.stopLoss || '',
                trade.takeProfit || '',
                trade.lotSize,
                trade.profit,
                `"${(trade.notes || '').replace(/"/g, '""')}"`
            ].join(','));
        });
        
        const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `trades-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        showSuccessMessage('Trades exported!');
    } catch (error) {
        console.error('Export error:', error);
        alert('Error exporting trades.');
    }
}

async function importTradesFunc() {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.csv';
    
    fileInput.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        try {
            showLoading();
            const text = await file.text();
            const lines = text.split('\n').filter(line => line.trim());
            if (lines.length < 2) {
                alert('No valid data found in the CSV file.');
                hideLoading();
                return;
            }
            
            const headers = lines[0].split(',').map(h => h.trim());
            let imported = 0;
            
            for (let i = 1; i < lines.length; i++) {
                const values = parseCSVLine(lines[i]);
                if (values.length < 7) continue;
                
                try {
                    const symbol = values[1] || 'Unknown';
                    const tradeType = (values[2] || 'long').toLowerCase();
                    const entryPrice = parseFloat(values[3]) || 0;
                    const stopLoss = parseFloat(values[4]) || null;
                    const takeProfit = parseFloat(values[5]) || null;
                    const lotSize = parseFloat(values[6]) || 0.01;
                    const profit = parseFloat(values[7]) || 0;
                    
                    await addDoc(collection(db, 'trades'), {
                        symbol,
                        type: tradeType,
                        instrumentType: getInstrumentType(symbol),
                        entryPrice,
                        stopLoss,
                        takeProfit,
                        lotSize,
                        profit,
                        notes: values[8] || '',
                        userId: currentUser.uid,
                        accountId: currentAccountId,
                        timestamp: new Date().toISOString(),
                        accountSize: getCurrentAccount().balance,
                        riskAmount: 0,
                        riskPercent: 0,
                        confluenceOptions: [],
                        confluenceScore: 0
                    });
                    imported++;
                } catch (err) {
                    console.warn('Skipping row:', err);
                }
            }
            
            showSuccessMessage(`Imported ${imported} trades!`);
        } catch (error) {
            console.error('Import error:', error);
            alert('Error importing trades.');
        } finally {
            hideLoading();
        }
    };
    
    fileInput.click();
}

function parseCSVLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            values.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    values.push(current);
    return values.map(v => v.trim().replace(/^"|"$/g, ''));
}

async function importMetaTraderTradesFunc() {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.csv';
    
    fileInput.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        try {
            showLoading();
            const text = await file.text();
            const lines = text.split('\n').filter(line => line.trim());
            if (lines.length < 2) {
                alert('No valid data found.');
                hideLoading();
                return;
            }
            
            let imported = 0;
            for (let i = 1; i < lines.length; i++) {
                const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
                if (values.length < 8) continue;
                
                try {
                    const symbol = values[0] || 'Unknown';
                    const type = (values[1] || '').toLowerCase().includes('buy') ? 'long' : 'short';
                    
                    await addDoc(collection(db, 'trades'), {
                        symbol,
                        type,
                        instrumentType: getInstrumentType(symbol),
                        entryPrice: parseFloat(values[2]) || 0,
                        stopLoss: parseFloat(values[3]) || 0,
                        takeProfit: parseFloat(values[4]) || 0,
                        lotSize: parseFloat(values[5]) || 0.01,
                        profit: parseFloat(values[6]) || 0,
                        notes: '[Imported from MT4/5] ' + (values[7] || ''),
                        userId: currentUser.uid,
                        accountId: currentAccountId,
                        timestamp: new Date().toISOString(),
                        accountSize: getCurrentAccount().balance,
                        riskAmount: 0,
                        riskPercent: 0,
                        confluenceOptions: [],
                        confluenceScore: 0
                    });
                    imported++;
                } catch (err) {
                    console.warn('Skipping row:', err);
                }
            }
            
            showSuccessMessage(`Imported ${imported} MetaTrader trades!`);
        } catch (error) {
            console.error('Import error:', error);
            alert('Error importing MetaTrader trades.');
        } finally {
            hideLoading();
        }
    };
    
    fileInput.click();
}

// ========== TRANSACTIONS ==========

function calculateNetBalanceFromTransactions() {
    let deposits = 0;
    let withdrawals = 0;
    
    transactions.forEach(transaction => {
        if (transaction.type === 'deposit') {
            deposits += transaction.amount;
        } else if (transaction.type === 'withdraw') {
            withdrawals += transaction.amount;
        }
    });
    
    return {
        totalDeposits: deposits,
        totalWithdrawals: withdrawals,
        netBalance: deposits - withdrawals
    };
}

function updateCurrentBalanceDisplay() {
    const balance = getCurrentBalance();
    const currentAccount = getCurrentAccount();
    const currencySymbol = getCurrencySymbol(currentAccount?.currency);
    
    const balanceElement = document.getElementById('fundsCurrentBalance');
    if (balanceElement) {
        balanceElement.textContent = `${currencySymbol}${balance.toFixed(2)}`;
    }
    
    const availableBalanceElement = document.getElementById('availableBalance');
    if (availableBalanceElement) {
        availableBalanceElement.textContent = `${currencySymbol}${balance.toFixed(2)}`;
    }
}

function renderTransactionHistory() {
    const container = document.getElementById('transactionHistory');
    if (!container) return;
    
    if (transactions.length === 0) {
        container.innerHTML = `
            <div class="text-center text-gray-500 py-8">
                <p>No transactions yet</p>
            </div>
        `;
        return;
    }
    
    const currentAccount = getCurrentAccount();
    const currencySymbol = getCurrencySymbol(currentAccount?.currency);
    
    container.innerHTML = transactions.map(transaction => `
        <div class="transaction-item p-4 bg-white rounded-xl border mb-2">
            <div class="flex justify-between items-start">
                <div>
                    <span class="font-semibold capitalize">${transaction.type}</span>
                    <div class="text-sm text-gray-500">${new Date(transaction.date).toLocaleString()}</div>
                </div>
                <div class="font-bold ${transaction.type === 'deposit' ? 'text-green-600' : 'text-red-600'}">
                    ${transaction.type === 'deposit' ? '+' : '-'} ${currencySymbol}${transaction.amount.toFixed(2)}
                </div>
            </div>
        </div>
    `).join('');
}

// ========== TRANSACTION MODALS ==========

window.openDepositModal = () => {
    const modal = document.getElementById('depositModal');
    const depositDate = document.getElementById('depositDate');
    if (depositDate) depositDate.value = getCurrentDateTimeString();
    
    const currentAccount = getCurrentAccount();
    const currencySymbol = getCurrencySymbol(currentAccount?.currency);
    const depositSymbol = document.getElementById('depositCurrencySymbol');
    if (depositSymbol) depositSymbol.textContent = currencySymbol;
    
    if (modal) modal.classList.remove('hidden');
};

window.closeDepositModal = () => {
    const modal = document.getElementById('depositModal');
    if (modal) modal.classList.add('hidden');
    const form = document.getElementById('depositForm');
    if (form) form.reset();
};

window.openWithdrawModal = () => {
    const modal = document.getElementById('withdrawModal');
    const withdrawDate = document.getElementById('withdrawDate');
    if (withdrawDate) withdrawDate.value = getCurrentDateTimeString();
    
    const currentAccount = getCurrentAccount();
    const currencySymbol = getCurrencySymbol(currentAccount?.currency);
    const withdrawSymbol = document.getElementById('withdrawCurrencySymbol');
    if (withdrawSymbol) withdrawSymbol.textContent = currencySymbol;
    
    updateCurrentBalanceDisplay();
    
    if (modal) modal.classList.remove('hidden');
};

window.closeWithdrawModal = () => {
    const modal = document.getElementById('withdrawModal');
    if (modal) modal.classList.add('hidden');
    const form = document.getElementById('withdrawForm');
    if (form) form.reset();
};

// ========== SETTINGS ==========

window.showSettingsSection = (section) => {
    document.querySelectorAll('.settings-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.settings-nav-btn').forEach(b => b.classList.remove('active'));
    
    const sectionMap = {
        'general': 'generalSettingsSection',
        'funds': 'fundsSettingsSection',
        'verification': 'verificationSettingsSection',
        'personal': 'personalSettingsSection',
        'preferences': 'preferencesSettingsSection'
    };
    
    const sectionEl = document.getElementById(sectionMap[section]);
    if (sectionEl) sectionEl.classList.add('active');
    
    const btn = document.querySelector(`.settings-nav-btn[data-section="${section}"]`);
    if (btn) btn.classList.add('active');
    
    if (section === 'funds') {
        updateCurrentBalanceDisplay();
        renderTransactionHistory();
    }
};

// ========== THEME ==========

function initTheme() {
    const savedTheme = localStorage.getItem('themePreference') || 'light';
    document.body.classList.add(savedTheme === 'dark' ? 'dark-theme' : 'light-theme');
    const themeSelect = document.getElementById('themeSelect');
    if (themeSelect) themeSelect.value = savedTheme;
}

function setupThemeListeners() {
    const themeSelect = document.getElementById('themeSelect');
    if (themeSelect) {
        themeSelect.addEventListener('change', (e) => {
            const newTheme = e.target.value;
            document.body.classList.remove('light-theme', 'dark-theme');
            document.body.classList.add(newTheme === 'dark' ? 'dark-theme' : 'light-theme');
            localStorage.setItem('themePreference', newTheme);
            showSuccessMessage('Theme updated!');
        });
    }
}

// ========== CALENDAR ==========

function setupCalendar() {
    const prevBtn = document.getElementById('prevMonth');
    const nextBtn = document.getElementById('nextMonth');
    
    if (prevBtn) prevBtn.addEventListener('click', () => {
        currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
        renderCalendar();
    });
    
    if (nextBtn) nextBtn.addEventListener('click', () => {
        currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
        renderCalendar();
    });
    
    renderCalendar();
}

function renderCalendar() {
    const grid = document.getElementById('monthGrid');
    const title = document.getElementById('currentMonthYear');
    
    if (!grid || !title) return;
    
    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    title.textContent = `${monthNames[currentCalendarDate.getMonth()]} ${currentCalendarDate.getFullYear()}`;
    
    const firstDay = new Date(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth(), 1).getDay();
    const daysInMonth = new Date(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth() + 1, 0).getDate();
    
    let html = '';
    // Previous month padding
    for (let i = 0; i < firstDay; i++) {
        html += '<div class="calendar-day other-month"></div>';
    }
    
    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${currentCalendarDate.getFullYear()}-${String(currentCalendarDate.getMonth()+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        const dayTrades = allTrades.filter(t => {
            const tDate = new Date(t.timestamp);
            return tDate.getFullYear() === currentCalendarDate.getFullYear() && 
                   tDate.getMonth() === currentCalendarDate.getMonth() && 
                   tDate.getDate() === d;
        });
        
        const totalProfit = dayTrades.reduce((s, t) => s + (t.profit || 0), 0);
        
        html += `
            <div class="calendar-day ${dayTrades.length ? 'has-trades' : ''}">
                <div class="calendar-date">${d}</div>
                ${dayTrades.length > 0 ? `<div class="text-xs ${totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}">${formatCurrency(totalProfit)}</div>` : ''}
            </div>
        `;
    }
    
    grid.innerHTML = html;
}

// ========== SETUP EVENT LISTENERS ==========

function setupEventListeners() {
    console.log('🔧 Setting up event listeners...');
    
    // Set default trade datetime
    const tradeDateTime = document.getElementById('tradeDateTime');
    if (tradeDateTime) tradeDateTime.value = getCurrentDateTimeString();
    
    // Trade form
    const tradeForm = document.getElementById('tradeForm');
    if (tradeForm) {
        tradeForm.addEventListener('submit', addTrade);
        tradeForm.addEventListener('reset', () => {
            setTimeout(() => {
                document.getElementById('tradeDateTime').value = getCurrentDateTimeString();
                updateEmotionDisplay(50);
                updateRiskCalculation();
            }, 0);
        });
    }
    
    // Confluence options
    renderConfluenceOptions();
    document.getElementById('confluenceOptions')?.addEventListener('change', updateConfluenceScoreDisplay);
    
    // Add confluence button
    document.getElementById('addConfluenceOptionButton')?.addEventListener('click', addConfluenceOption);
    
    // Risk inputs
    ['entryPrice', 'stopLoss', 'takeProfit', 'lotSize', 'direction', 'symbol'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', updateRiskCalculation);
            el.addEventListener('change', updateRiskCalculation);
        }
    });
    
    // Symbol change
    document.getElementById('symbol')?.addEventListener('change', function() {
        updateInstrumentTypeDisplay(this.value);
    });
    
    // Emotion gauge
    initEmotionGauge();
    
    // Tabs
    setupTabs();
    
    // Mobile menu
    setupMobileMenu();
    
    // Calendar
    setupCalendar();
    
    // Theme
    initTheme();
    setupThemeListeners();
    
    // Affirmation form
    document.getElementById('affirmationForm')?.addEventListener('submit', handleAffirmationSubmit);
    
    // Add account form - FIXED
    document.getElementById('addAccountForm')?.addEventListener('submit', window.handleAddAccountSubmit);
    
    // Deposit form
    document.getElementById('depositForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const amount = parseFloat(document.getElementById('depositAmount')?.value);
        const description = document.getElementById('depositDescription')?.value || '';
        const date = document.getElementById('depositDate')?.value || new Date().toISOString();
        
        if (!amount || amount <= 0) {
            alert('Please enter a valid deposit amount');
            return;
        }
        
        transactions.push({
            id: Date.now().toString(),
            type: 'deposit',
            amount,
            description,
            date: new Date(date).toISOString()
        });
        
        window.closeDepositModal();
        showSuccessMessage(`Deposited ${formatCurrency(amount)}!`);
        updateCurrentBalanceDisplay();
        updateStats(allTrades);
    });
    
    // Withdraw form
    document.getElementById('withdrawForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const amount = parseFloat(document.getElementById('withdrawAmount')?.value);
        const description = document.getElementById('withdrawDescription')?.value || '';
        const date = document.getElementById('withdrawDate')?.value || new Date().toISOString();
        
        if (!amount || amount <= 0) {
            alert('Please enter a valid withdrawal amount');
            return;
        }
        
        if (amount > getCurrentBalance()) {
            alert('Insufficient funds');
            return;
        }
        
        transactions.push({
            id: Date.now().toString(),
            type: 'withdraw',
            amount,
            description,
            date: new Date(date).toISOString()
        });
        
        window.closeWithdrawModal();
        showSuccessMessage(`Withdrew ${formatCurrency(amount)}!`);
        updateCurrentBalanceDisplay();
        updateStats(allTrades);
    });
    
    // Account balance lock
    setupAccountBalanceLock();
    
    // Account currency change
    document.getElementById('accountCurrency')?.addEventListener('change', function() {
        const currentAccount = getCurrentAccount();
        if (currentAccount) {
            currentAccount.currency = this.value;
            saveUserAccounts();
        }
        updateStats(allTrades);
        renderCharts(allTrades);
        updateRiskCalculation();
    });
    
    // Risk per trade change
    document.getElementById('riskPerTrade')?.addEventListener('change', function() {
        localStorage.setItem('riskPerTrade', this.value);
        updateRiskCalculation();
    });
    
    // Leverage change
    document.getElementById('leverage')?.addEventListener('change', function() {
        localStorage.setItem('leverage', this.value);
        updateRiskCalculation();
    });
    
    updateConfluenceScoreDisplay();
    updateRiskCalculation();
    
    // Switch to dashboard by default
    switchTab('dashboard');
    
    console.log('✅ Event listeners setup complete');
}

function setupTabs() {
    const tabs = {
        'dashboardTab': 'dashboardContent',
        'addTradeTab': 'addTradeContent',
        'tradesTab': 'tradesContent',
        'affirmationsTab': 'affirmationsContent',
        'calendarTab': 'calendarContent',
        'settingsTab': 'settingsContent'
    };
    
    Object.entries(tabs).forEach(([tabId, contentId]) => {
        const tab = document.getElementById(tabId);
        if (tab) {
            tab.addEventListener('click', () => {
                const tabName = tabId.replace('Tab', '');
                switchTab(tabName);
            });
        }
    });
}

function switchTab(tabName) {
    // Hide all content
    document.querySelectorAll('.tab-content').forEach(c => {
        c.classList.remove('active');
        c.style.display = 'none';
    });
    
    // Deactivate all tabs
    document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
    
    // Show selected content
    const contentMap = {
        'dashboard': 'dashboardContent',
        'addTrade': 'addTradeContent',
        'trades': 'tradesContent',
        'affirmations': 'affirmationsContent',
        'calendar': 'calendarContent',
        'settings': 'settingsContent'
    };
    
    const contentId = contentMap[tabName];
    const content = document.getElementById(contentId);
    const tab = document.getElementById(tabName + 'Tab');
    
    if (content) {
        content.classList.add('active');
        content.style.display = 'block';
    }
    if (tab) tab.classList.add('active');
    
    // Load specific tab data
    if (tabName === 'affirmations') loadAffirmations();
    if (tabName === 'calendar') renderCalendar();
}

function setupMobileMenu() {
    const btn = document.getElementById('mobileMenuButton');
    const menu = document.getElementById('mobileMenu');
    
    if (btn && menu) {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            menu.classList.toggle('hidden');
            renderAccountsList();
        });
        document.addEventListener('click', () => menu.classList.add('hidden'));
        menu.addEventListener('click', (e) => e.stopPropagation());
    }
}

function setupAccountBalanceLock() {
    const accountSizeInput = document.getElementById('accountSize');
    const lockToggle = document.getElementById('lockToggle');
    
    if (!accountSizeInput || !lockToggle) return;
    
    let isLocked = localStorage.getItem('accountBalanceLocked') === 'true';
    
    function updateLockState() {
        accountSizeInput.readOnly = isLocked;
        if (isLocked) {
            lockToggle.innerHTML = '🔒 Locked';
            lockToggle.className = 'text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded';
        } else {
            lockToggle.innerHTML = '🔓 Unlocked';
            lockToggle.className = 'text-xs bg-green-100 text-green-600 px-2 py-1 rounded';
        }
    }
    
    lockToggle.addEventListener('click', () => {
        isLocked = !isLocked;
        localStorage.setItem('accountBalanceLocked', isLocked.toString());
        updateLockState();
        
        if (!isLocked) {
            showSuccessMessage('Balance unlocked - changes will affect metrics');
        } else {
            showSuccessMessage('Balance locked');
        }
    });
    
    updateLockState();
}

function updateInstrumentTypeDisplay(symbol) {
    const display = document.getElementById('instrumentTypeDisplay');
    if (!display) return;
    
    const instrumentType = getInstrumentType(symbol);
    const badges = {
        'forex': '<span class="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">Forex</span>',
        'indices': '<span class="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">Indices</span>',
        'synthetic': '<span class="text-xs bg-pink-100 text-pink-800 px-2 py-1 rounded">Synthetic</span>',
        'commodities': '<span class="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">Commodities</span>',
        'smarttrader': '<span class="text-xs bg-cyan-100 text-cyan-800 px-2 py-1 rounded">SmartTrader</span>',
        'accumulator': '<span class="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">Accumulator</span>'
    };
    
    display.innerHTML = badges[instrumentType] || '';
}

function handleAffirmationSubmit(e) {
    e.preventDefault();
    
    const text = document.getElementById('affirmationText').value.trim();
    const category = document.getElementById('affirmationCategorySelect').value;
    
    if (!text) {
        alert('Please enter an affirmation text.');
        return;
    }
    
    if (text.length > 200) {
        alert('Text must be 200 characters or less.');
        return;
    }
    
    const affirmationData = {
        text, category,
        isFavorite: document.getElementById('isFavorite').checked,
        isActive: document.getElementById('isActive').checked,
        usageCount: 0,
        lastUsed: null,
        createdAt: new Date().toISOString(),
        strength: Math.floor(Math.random() * 20) + 80,
        userId: currentUser.uid
    };
    
    // Use async wrapper
    (async () => {
        try {
            if (editingAffirmationId) {
                await updateDoc(doc(db, 'affirmations', editingAffirmationId), affirmationData);
                const index = allAffirmations.findIndex(a => a.id === editingAffirmationId);
                if (index !== -1) allAffirmations[index] = { ...allAffirmations[index], ...affirmationData };
            } else {
                const docRef = await addDoc(collection(db, 'affirmations'), affirmationData);
                allAffirmations.unshift({ id: docRef.id, ...affirmationData });
            }
            
            window.closeAffirmationModal();
            updateAffirmationStats();
            renderAffirmationsGrid();
            showSuccessMessage(editingAffirmationId ? 'Affirmation updated!' : 'Affirmation created!');
        } catch (error) {
            console.error('Error saving affirmation:', error);
            alert('Error saving affirmation.');
        }
    })();
}

// ========== AUTH INITIALIZATION ==========

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        
        // Update email displays
        const userEmail = document.getElementById('user-email');
        const mobileEmail = document.getElementById('mobile-user-email');
        if (userEmail) userEmail.textContent = user.email;
        if (mobileEmail) mobileEmail.textContent = user.email;
        
        showLoading();
        try {
            console.log('🔐 User authenticated:', user.email);
            await loadUserAccounts();
            console.log('✅ Accounts loaded');
            await loadTrades();
            console.log('✅ Trades listener set up');
            
            setupEventListeners();
            console.log('✅ Event listeners set up');
            
            await loadAffirmations();
            console.log('✅ Affirmations loaded');
            
            loadPointValueOverrides();
            updateCurrentBalanceDisplay();
            
            console.log('✅ App fully initialized');
        } catch (error) {
            console.error('❌ Init error:', error);
            alert('Error initializing app. Please refresh the page.');
        } finally {
            hideLoading();
        }
    } else {
        window.location.href = 'index.html';
    }
});

// ========== LOGOUT ==========

window.logout = async () => {
    try {
        if (tradesUnsubscribe) {
            tradesUnsubscribe();
            tradesUnsubscribe = null;
        }
        await signOut(auth);
    } catch (error) {
        console.error('Logout error:', error);
        alert('Error logging out.');
    }
};

// ========== EXPORT/IMPORT (window references) ==========

window.exportTrades = exportTradesFunc;
window.importTrades = importTradesFunc;
window.importMetaTraderTrades = importMetaTraderTradesFunc;

// ========== LOAD SETTINGS ==========

function loadPointValueOverrides() {
    try {
        const stored = localStorage.getItem('pointValueOverrides');
        if (stored) pointValueOverrides = JSON.parse(stored);
    } catch(e) {
        pointValueOverrides = {};
    }
}

// ========== INITIALIZATION ==========

console.log('✅ app.js fully loaded - all functions defined');
console.log('📋 Features: Account Management, Real-time Trades, Charts, AI Suggestions, Affirmations, Calendar, Import/Export, MT4/5 Import, Transactions');