// app.js - COMPLETE WORKING VERSION WITH DERIV INSTRUMENTS, MT4/5 IMPORT, AND ALL IMPROVEMENTS
import { 
    auth, db, storage, onAuthStateChanged, signOut, 
    collection, addDoc, getDocs, query, where, doc, deleteDoc, updateDoc, getDoc, setDoc,
    ref, uploadBytes, getDownloadURL, deleteObject
} from './firebase-config.js';

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

// Account Management System
let currentAccountId = null;
let userAccounts = [];

// Calendar state
let currentCalendarDate = new Date();
let calendarViewType = 'month';

// Loading timeout safety (10 seconds)
let loadingTimeout;
const MAX_LOADING_TIME = 10000; // 10 seconds

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

const DEFAULT_CONFLUENCE_OPTIONS = [
    'Trend Direction',
    'Support/Resistance',
    'Price Action',
    'Volume',
    'Market Structure',
    'Higher Timeframe'
];

// MetaTrader Import Settings
let mtImportSettings = {
    useMTProfit: true,
    includeCommission: false,
    includeSwap: false,
    defaultMood: '',
    autoAddNotes: true
};

// Store pending MT trades for import
let pendingMTTrades = [];
let existingTicketNumbers = new Set();
let importErrors = [];

// MetaTrader symbol to instrument type mapping
const mtSymbolMapping = {
    // Forex pairs
    'EURUSD': 'EUR/USD', 'GBPUSD': 'GBP/USD', 'USDJPY': 'USD/JPY', 'USDCHF': 'USD/CHF',
    'AUDUSD': 'AUD/USD', 'USDCAD': 'USD/CAD', 'NZDUSD': 'NZD/USD', 'EURGBP': 'EUR/GBP',
    'EURJPY': 'EUR/JPY', 'GBPJPY': 'GBP/JPY', 'AUDJPY': 'AUD/JPY', 'AUDCAD': 'AUD/CAD',
    'AUDCHF': 'AUD/CHF', 'AUDNZD': 'AUD/NZD', 'CADJPY': 'CAD/JPY', 'CHFJPY': 'CHF/JPY',
    'EURAUD': 'EUR/AUD', 'EURCAD': 'EUR/CAD', 'EURCHF': 'EUR/CHF', 'EURNZD': 'EUR/NZD',
    'GBPAUD': 'GBP/AUD', 'GBPCAD': 'GBP/CAD', 'GBPCHF': 'GBP/CHF', 'GBPNZD': 'GBP/NZD',
    'NZDCAD': 'NZD/CAD', 'NZDCHF': 'NZD/CHF', 'NZDJPY': 'NZD/JPY',
    'USDZAR': 'USD/ZAR', 'USDMXN': 'USD/MXN', 'USDSGD': 'USD/SGD', 'USDHKD': 'USD/HKD',
    'USDSEK': 'USD/SEK', 'USDNOK': 'USD/NOK',
    
    // Metals/Commodities
    'XAUUSD': 'Gold', 'XAGUSD': 'Silver', 'WTI': 'Oil', 'BRENT': 'Brent',
    'XAUUSD.': 'Gold', 'XAGUSD.': 'Silver', 'GOLD': 'Gold', 'SILVER': 'Silver',
    
    // Indices
    'US30': 'US30', 'US30.': 'US30', 'US30..': 'US30', 'DJ30': 'US30',
    'SPX500': 'SPX500', 'SPX500.': 'SPX500', 'US500': 'SPX500',
    'NAS100': 'NAS100', 'NAS100.': 'NAS100', 'USTEC': 'NAS100', 'US100': 'NAS100',
    'DE30': 'GE30', 'DE30.': 'GE30', 'GER30': 'GE30', 'DE40': 'GE30',
    'UK100': 'FTSE100', 'UK100.': 'FTSE100', 'FTSE': 'FTSE100',
    'JP225': 'NIKKEI225', 'JP225.': 'NIKKEI225', 'JPN225': 'NIKKEI225',
    'AUS200': 'AUS200', 'AUS200.': 'AUS200',
    'ESTX50': 'ESTX50', 'EU50': 'ESTX50',
    'FRA40': 'FRA40', 'FRA40.': 'FRA40',
    
    // Deriv Synthetic Indices
    'Volatility 10 Index': 'Volatility 10 Index',
    'Volatility 25 Index': 'Volatility 25 Index',
    'Volatility 50 Index': 'Volatility 50 Index',
    'Volatility 75 Index': 'Volatility 75 Index',
    'Volatility 100 Index': 'Volatility 100 Index',
    'Volatility 10 (1s) Index': 'Volatility 10 (1s) Index',
    'Volatility 25 (1s) Index': 'Volatility 25 (1s) Index',
    'Volatility 50 (1s) Index': 'Volatility 50 (1s) Index',
    'Volatility 75 (1s) Index': 'Volatility 75 (1s) Index',
    'Volatility 100 (1s) Index': 'Volatility 100 (1s) Index',
    'Volatility 200 Index': 'Volatility 200 Index',
    'Volatility 300 Index': 'Volatility 300 Index',
    'Boom 50 Index': 'Boom 50 Index',
    'Boom 100 Index': 'Boom 100 Index',
    'Boom 300 Index': 'Boom 300 Index',
    'Boom 500 Index': 'Boom 500 Index',
    'Boom 600 Index': 'Boom 600 Index',
    'Boom 900 Index': 'Boom 900 Index',
    'Boom 1000 Index': 'Boom 1000 Index',
    'Crash 50 Index': 'Crash 50 Index',
    'Crash 100 Index': 'Crash 100 Index',
    'Crash 300 Index': 'Crash 300 Index',
    'Crash 500 Index': 'Crash 500 Index',
    'Crash 600 Index': 'Crash 600 Index',
    'Crash 900 Index': 'Crash 900 Index',
    'Crash 1000 Index': 'Crash 1000 Index',
    'Jump 10 Index': 'Jump 10 Index',
    'Jump 25 Index': 'Jump 25 Index',
    'Jump 50 Index': 'Jump 50 Index',
    'Jump 75 Index': 'Jump 75 Index',
    'Jump 100 Index': 'Jump 100 Index',
    'Jump 150 Index': 'Jump 150 Index',
    'Jump 200 Index': 'Jump 200 Index',
    'Range Break 50 Index': 'Range Break 50 Index',
    'Range Break 100 Index': 'Range Break 100 Index',
    'Range Break 200 Index': 'Range Break 200 Index',
    'Step Index': 'Step Index',
    'Step 200 Index': 'Step 200 Index',
    'Step 300 Index': 'Step 300 Index',
    'Step 400 Index': 'Step 400 Index',
    'Step 500 Index': 'Step 500 Index',
    'Bear Market Index': 'Bear Market Index',
    'Bull Market Index': 'Bull Market Index',
    'Drift Switch 10 Index': 'Drift Switch 10 Index',
    'Drift Switch 20 Index': 'Drift Switch 20 Index',
    'Drift Switch 30 Index': 'Drift Switch 30 Index'
};

// Deriv Synthetic Indices Lot Size Configuration
// Data sourced from: https://synthetics.info/lot-sizes-synthetic-indices/
const derivLotSizeConfig = {
    // Volatility Indices
    'Volatility 10 Index': { minLot: 0.5, maxLot: 100, pointValue: 0.001, stdLotDisplay: '0.5' },
    'Volatility 10 (1s) Index': { minLot: 0.5, maxLot: 100, pointValue: 0.001, stdLotDisplay: '0.5' },
    'Volatility 25 Index': { minLot: 0.5, maxLot: 100, pointValue: 0.001, stdLotDisplay: '0.5' },
    'Volatility 25 (1s) Index': { minLot: 0.005, maxLot: 100, pointValue: 0.001, stdLotDisplay: '0.005' },
    'Volatility 50 Index': { minLot: 4, maxLot: 100, pointValue: 0.001, stdLotDisplay: '4.0' },
    'Volatility 50 (1s) Index': { minLot: 0.005, maxLot: 100, pointValue: 0.001, stdLotDisplay: '0.005' },
    'Volatility 75 Index': { minLot: 0.001, maxLot: 100, pointValue: 0.00001, stdLotDisplay: '0.001' },
    'Volatility 75 (1s) Index': { minLot: 0.05, maxLot: 100, pointValue: 0.001, stdLotDisplay: '0.05' },
    'Volatility 100 Index': { minLot: 0.5, maxLot: 100, pointValue: 0.001, stdLotDisplay: '0.5' },
    'Volatility 100 (1s) Index': { minLot: 0.5, maxLot: 100, pointValue: 0.001, stdLotDisplay: '0.5' },
    'Volatility 200 Index': { minLot: 0.5, maxLot: 100, pointValue: 0.001, stdLotDisplay: '0.5' },
    'Volatility 300 Index': { minLot: 0.5, maxLot: 100, pointValue: 0.001, stdLotDisplay: '0.5' },
    
    // Boom & Crash Indices
    'Boom 50 Index': { minLot: 0.2, maxLot: 50, pointValue: 0.001, stdLotDisplay: '0.2' },
    'Boom 100 Index': { minLot: 0.2, maxLot: 50, pointValue: 0.001, stdLotDisplay: '0.2' },
    'Boom 300 Index': { minLot: 1, maxLot: 50, pointValue: 0.001, stdLotDisplay: '1.0' },
    'Boom 500 Index': { minLot: 0.2, maxLot: 50, pointValue: 0.001, stdLotDisplay: '0.2' },
    'Boom 600 Index': { minLot: 0.2, maxLot: 50, pointValue: 0.001, stdLotDisplay: '0.2' },
    'Boom 900 Index': { minLot: 0.2, maxLot: 50, pointValue: 0.001, stdLotDisplay: '0.2' },
    'Boom 1000 Index': { minLot: 0.2, maxLot: 50, pointValue: 0.001, stdLotDisplay: '0.2' },
    'Crash 50 Index': { minLot: 0.2, maxLot: 50, pointValue: 0.001, stdLotDisplay: '0.2' },
    'Crash 100 Index': { minLot: 0.2, maxLot: 50, pointValue: 0.001, stdLotDisplay: '0.2' },
    'Crash 300 Index': { minLot: 0.5, maxLot: 50, pointValue: 0.001, stdLotDisplay: '0.5' },
    'Crash 500 Index': { minLot: 0.2, maxLot: 50, pointValue: 0.001, stdLotDisplay: '0.2' },
    'Crash 600 Index': { minLot: 0.2, maxLot: 50, pointValue: 0.001, stdLotDisplay: '0.2' },
    'Crash 900 Index': { minLot: 0.2, maxLot: 50, pointValue: 0.001, stdLotDisplay: '0.2' },
    'Crash 1000 Index': { minLot: 0.2, maxLot: 50, pointValue: 0.001, stdLotDisplay: '0.2' },
    
    // Step Indices
    'Step Index': { minLot: 0.1, maxLot: 50, pointValue: 0.10, stdLotDisplay: '0.1' },
    'Step 200 Index': { minLot: 0.1, maxLot: 50, pointValue: 0.10, stdLotDisplay: '0.1' },
    'Step 300 Index': { minLot: 0.1, maxLot: 50, pointValue: 0.10, stdLotDisplay: '0.1' },
    'Step 400 Index': { minLot: 0.1, maxLot: 50, pointValue: 0.10, stdLotDisplay: '0.1' },
    'Step 500 Index': { minLot: 0.1, maxLot: 50, pointValue: 0.10, stdLotDisplay: '0.1' },
    
    // Jump Indices
    'Jump 10 Index': { minLot: 0.01, maxLot: 50, pointValue: 0.001, stdLotDisplay: '0.01' },
    'Jump 25 Index': { minLot: 0.01, maxLot: 50, pointValue: 0.001, stdLotDisplay: '0.01' },
    'Jump 50 Index': { minLot: 0.01, maxLot: 50, pointValue: 0.001, stdLotDisplay: '0.01' },
    'Jump 75 Index': { minLot: 0.01, maxLot: 50, pointValue: 0.001, stdLotDisplay: '0.01' },
    'Jump 100 Index': { minLot: 0.01, maxLot: 50, pointValue: 0.001, stdLotDisplay: '0.01' },
    'Jump 150 Index': { minLot: 0.01, maxLot: 50, pointValue: 0.001, stdLotDisplay: '0.01' },
    'Jump 200 Index': { minLot: 0.01, maxLot: 50, pointValue: 0.001, stdLotDisplay: '0.01' },
    
    // Range Break Indices
    'Range Break 50 Index': { minLot: 0.01, maxLot: 50, pointValue: 0.01, stdLotDisplay: '0.01' },
    'Range Break 100 Index': { minLot: 0.01, maxLot: 50, pointValue: 0.01, stdLotDisplay: '0.01' },
    'Range Break 200 Index': { minLot: 0.01, maxLot: 50, pointValue: 0.01, stdLotDisplay: '0.01' },
    
    // Mixed/DEX Indices
    'Bear Market Index': { minLot: 0.01, maxLot: 50, pointValue: 0.01, stdLotDisplay: '0.01' },
    'Bull Market Index': { minLot: 0.01, maxLot: 50, pointValue: 0.01, stdLotDisplay: '0.01' },
    'Drift Switch 10 Index': { minLot: 0.01, maxLot: 50, pointValue: 0.01, stdLotDisplay: '0.01' },
    'Drift Switch 20 Index': { minLot: 0.01, maxLot: 50, pointValue: 0.01, stdLotDisplay: '0.01' },
    'Drift Switch 30 Index': { minLot: 0.01, maxLot: 50, pointValue: 0.01, stdLotDisplay: '0.01' }
};

// Traditional Instruments Standard Lot Configuration
const standardLotConfig = {
    forex: { stdLot: 1.0, minLot: 0.01, display: '1.0 (100,000 units)' },
    indices: { stdLot: 1.0, minLot: 0.1, display: '1.0' },
    commodities: { stdLot: 1.0, minLot: 0.01, display: '1.0 (100 oz for Gold)' },
    smarttrader: { stdLot: 1.0, minLot: 1.0, display: '1.0 (stake amount)' },
    accumulator: { stdLot: 1.0, minLot: 1.0, display: '1.0' }
};

// Function to get lot size information for any instrument
function getLotSizeInfo(symbol, instrumentType = null) {
    if (!instrumentType) {
        instrumentType = getInstrumentType(symbol);
    }
    
    // Check if it's a Deriv synthetic index
    if (derivLotSizeConfig[symbol]) {
        const config = derivLotSizeConfig[symbol];
        return {
            minLot: config.minLot,
            maxLot: config.maxLot,
            stdLotDisplay: config.stdLotDisplay,
            pointValue: config.pointValue,
            description: `Min: ${config.minLot} | Std: ${config.stdLotDisplay} lot(s)`,
            warning: `Minimum lot size is ${config.minLot}. Using smaller lots will result in "Invalid volume" error.`
        };
    }
    
    // Handle traditional instruments
    if (instrumentType === 'forex') {
        return {
            minLot: 0.01,
            maxLot: 100,
            stdLotDisplay: '1.0',
            pointValue: symbol.includes('JPY') ? 0.01 : 0.0001,
            description: 'Std Lot = 100,000 units | Min: 0.01',
            warning: null
        };
    }
    
    if (instrumentType === 'indices') {
        return {
            minLot: 0.1,
            maxLot: 100,
            stdLotDisplay: '1.0',
            pointValue: getPointValue(symbol),
            description: 'Std Lot = 1.0 | Min: 0.1',
            warning: null
        };
    }
    
    if (instrumentType === 'commodities') {
        return {
            minLot: 0.01,
            maxLot: 100,
            stdLotDisplay: '1.0',
            pointValue: symbol === 'Gold' ? 0.01 : (symbol === 'Silver' ? 0.001 : 0.01),
            description: symbol === 'Gold' ? 'Std Lot = 100 oz' : 'Std Lot = 1.0',
            warning: null
        };
    }
    
    // Default fallback
    return {
        minLot: 0.01,
        maxLot: 100,
        stdLotDisplay: '1.0',
        pointValue: 0.0001,
        description: 'Std Lot = 1.0 | Min: 0.01',
        warning: null
    };
}

// Function to update the lot size display when instrument changes
function updateLotSizeDisplay() {
    const symbol = document.getElementById('symbol')?.value;
    const lotSizeInput = document.getElementById('lotSize');
    const lotSizeDisplay = document.querySelector('#lotSize + .pip-display');
    
    if (!symbol || !lotSizeInput || !lotSizeDisplay) return;
    
    const instrumentType = getInstrumentType(symbol);
    const lotInfo = getLotSizeInfo(symbol, instrumentType);
    
    // Update the display text
    let displayText = lotInfo.description;
    
    // Add instrument-specific information
    if (instrumentType === 'synthetic') {
        const config = derivLotSizeConfig[symbol];
        if (config) {
            displayText = `Min Lot: ${config.minLot} | Point Value: $${config.pointValue}/pt`;
            if (config.minLot < 0.01) {
                displayText += ` (micro lots allowed)`;
            }
        }
    } else if (instrumentType === 'forex') {
        displayText = 'Std Lot = 100,000 units | Min: 0.01 | Pip ≈ $10';
    } else if (instrumentType === 'indices') {
        const pointVal = getPointValue(symbol);
        displayText = `Std Lot = 1.0 | Point Value: $${pointVal} | Min: 0.1`;
    } else if (instrumentType === 'commodities') {
        if (symbol === 'Gold') {
            displayText = 'Std Lot = 100 oz | Point Value: $1 | Min: 0.01';
        } else if (symbol === 'Silver') {
            displayText = 'Std Lot = 5,000 oz | Point Value: $5 | Min: 0.01';
        } else {
            displayText = 'Std Lot = 1.0 | Min: 0.01';
        }
    }
    
    lotSizeDisplay.textContent = displayText;
    
    // Set appropriate step and min values for the input
    if (instrumentType === 'synthetic') {
        const config = derivLotSizeConfig[symbol];
        if (config) {
            lotSizeInput.min = config.minLot;
            lotSizeInput.max = config.maxLot;
            lotSizeInput.step = config.minLot < 0.01 ? '0.001' : '0.01';
            
            // Set default to minimum if current value is below minimum
            if (parseFloat(lotSizeInput.value) < config.minLot) {
                lotSizeInput.value = config.minLot;
            }
            
            // Show warning if needed
            if (config.minLot > 0.1) {
                showTemporaryWarning(`⚠️ ${symbol} minimum lot size is ${config.minLot}. Using smaller lots will result in "Invalid volume" error.`, 5000);
            }
        }
    } else {
        lotSizeInput.min = instrumentType === 'indices' ? '0.1' : '0.01';
        lotSizeInput.max = '100';
        lotSizeInput.step = '0.01';
    }
}

// Helper function to show temporary warning
function showTemporaryWarning(message, duration = 3000) {
    const warningDiv = document.createElement('div');
    warningDiv.className = 'fixed bottom-4 right-4 bg-yellow-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 text-sm';
    warningDiv.innerHTML = message;
    document.body.appendChild(warningDiv);
    
    setTimeout(() => {
        warningDiv.remove();
    }, duration);
}

function getDeletedConfluenceOptions() {
    try {
        const raw = localStorage.getItem('deletedConfluenceOptions');
        return raw ? JSON.parse(raw) : [];
    } catch (error) {
        console.warn('Unable to load deleted confluence options:', error);
        return [];
    }
}

function saveDeletedConfluenceOptions(options) {
    localStorage.setItem('deletedConfluenceOptions', JSON.stringify(options));
}

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

// ========== MOBILE VIEWPORT SETUP ==========

function setupMobileViewport() {
    document.addEventListener('touchstart', function() {}, {passive: true});
    
    window.addEventListener('orientationchange', function() {
        setTimeout(() => {
            if (window.visualViewport) {
                document.body.style.height = window.visualViewport.height + 'px';
            }
        }, 150);
    });
    
    function setViewportHeight() {
        let vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty('--vh', `${vh}px`);
    }
    
    setViewportHeight();
    window.addEventListener('resize', setViewportHeight);
    window.addEventListener('orientationchange', setViewportHeight);
}

// ========== LOADING FUNCTIONS ==========

function showLoading() {
    const loadingIndicator = document.getElementById('loadingIndicator');
    if (loadingIndicator) {
        loadingIndicator.style.display = 'flex';
        console.log('[LOADING] Showing loading indicator');
        
        loadingTimeout = setTimeout(() => {
            console.warn('⚠️ Loading timeout reached, forcing hide');
            hideLoading();
        }, MAX_LOADING_TIME);
    }
}

function hideLoading() {
    const loadingIndicator = document.getElementById('loadingIndicator');
    if (loadingIndicator) {
        loadingIndicator.style.display = 'none';
        console.log('[SUCCESS] Hiding loading indicator');
        
        if (loadingTimeout) {
            clearTimeout(loadingTimeout);
        }
    }
}

// ========== DATE HELPER FUNCTIONS ==========

function getCurrentDateTimeString() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    
    return `${year}-${month}-${day}T${hours}:${minutes}`;
}

// ========== ENHANCED METATRADER DATE PARSER ==========

function parseMTDateTime(dateTimeStr) {
    if (!dateTimeStr) return null;
    
    const clean = dateTimeStr.trim();
    
    const strategies = [
        // Strategy 1: Try standard Date with hyphens
        () => {
            const withHyphens = clean.replace(/\./g, '-').replace(/\//g, '-');
            const date = new Date(withHyphens);
            return !isNaN(date.getTime()) ? date : null;
        },
        // Strategy 2: European format (DD.MM.YYYY HH:mm:ss)
        () => {
            const match = clean.match(/^(\d{2})[.\-\/](\d{2})[.\-\/](\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})$/);
            if (match) {
                return new Date(
                    parseInt(match[3]),
                    parseInt(match[2]) - 1,
                    parseInt(match[1]),
                    parseInt(match[4]),
                    parseInt(match[5]),
                    parseInt(match[6])
                );
            }
            return null;
        },
        // Strategy 3: European format without seconds (DD.MM.YYYY HH:mm)
        () => {
            const match = clean.match(/^(\d{2})[.\-\/](\d{2})[.\-\/](\d{4})\s+(\d{1,2}):(\d{2})$/);
            if (match) {
                return new Date(
                    parseInt(match[3]),
                    parseInt(match[2]) - 1,
                    parseInt(match[1]),
                    parseInt(match[4]),
                    parseInt(match[5]),
                    0
                );
            }
            return null;
        },
        // Strategy 4: ISO-like format (YYYY-MM-DD HH:mm:ss)
        () => {
            const match = clean.match(/^(\d{4})[.\-\/](\d{2})[.\-\/](\d{2})\s+(\d{1,2}):(\d{2}):(\d{2})$/);
            if (match) {
                return new Date(
                    parseInt(match[1]),
                    parseInt(match[2]) - 1,
                    parseInt(match[3]),
                    parseInt(match[4]),
                    parseInt(match[5]),
                    parseInt(match[6])
                );
            }
            return null;
        },
        // Strategy 5: ISO-like without seconds (YYYY-MM-DD HH:mm)
        () => {
            const match = clean.match(/^(\d{4})[.\-\/](\d{2})[.\-\/](\d{2})\s+(\d{1,2}):(\d{2})$/);
            if (match) {
                return new Date(
                    parseInt(match[1]),
                    parseInt(match[2]) - 1,
                    parseInt(match[3]),
                    parseInt(match[4]),
                    parseInt(match[5]),
                    0
                );
            }
            return null;
        },
        // Strategy 6: Date only (DD.MM.YYYY or YYYY-MM-DD)
        () => {
            // Try European date only
            let match = clean.match(/^(\d{2})[.\-\/](\d{2})[.\-\/](\d{4})$/);
            if (match) {
                return new Date(
                    parseInt(match[3]),
                    parseInt(match[2]) - 1,
                    parseInt(match[1]),
                    0, 0, 0
                );
            }
            // Try ISO date only
            match = clean.match(/^(\d{4})[.\-\/](\d{2})[.\-\/](\d{2})$/);
            if (match) {
                return new Date(
                    parseInt(match[1]),
                    parseInt(match[2]) - 1,
                    parseInt(match[3]),
                    0, 0, 0
                );
            }
            return null;
        }
    ];
    
    for (const strategy of strategies) {
        const result = strategy();
        if (result && !isNaN(result.getTime())) {
            return result.toISOString();
        }
    }
    
    console.warn('[MT IMPORT] Could not parse date:', dateTimeStr);
    return null;
}

// ========== ENHANCED SYMBOL MAPPING ==========

function mapMTSymbol(mtSymbol) {
    let cleanSymbol = mtSymbol.trim();
    
    // Remove common MT4/MT5 suffixes
    cleanSymbol = cleanSymbol.replace(/[.]+$/, ''); // Remove trailing dots
    cleanSymbol = cleanSymbol.replace(/\.pro$/i, ''); // Remove .pro
    cleanSymbol = cleanSymbol.replace(/\.ecn$/i, ''); // Remove .ecn
    cleanSymbol = cleanSymbol.replace(/\.std$/i, ''); // Remove .std
    cleanSymbol = cleanSymbol.replace(/[mxic]$/i, ''); // Remove m, x, i, c suffixes
    
    // Check direct mapping
    if (mtSymbolMapping[cleanSymbol]) {
        return mtSymbolMapping[cleanSymbol];
    }
    
    // Check uppercase version
    const upperSymbol = cleanSymbol.toUpperCase();
    if (mtSymbolMapping[upperSymbol]) {
        return mtSymbolMapping[upperSymbol];
    }
    
    // Check without any non-alphanumeric characters
    const alphaOnly = cleanSymbol.replace(/[^a-zA-Z0-9]/g, '');
    if (mtSymbolMapping[alphaOnly]) {
        return mtSymbolMapping[alphaOnly];
    }
    
    return cleanSymbol;
}

// ========== INSTRUMENT TYPE FUNCTIONS ==========

function getInstrumentType(symbol) {
    const volatilityIndices = [
        'Volatility 10 Index', 'Volatility 25 Index', 'Volatility 50 Index', 
        'Volatility 75 Index', 'Volatility 100 Index',
        'Volatility 10 (1s) Index', 'Volatility 25 (1s) Index', 'Volatility 50 (1s) Index',
        'Volatility 75 (1s) Index', 'Volatility 100 (1s) Index',
        'Volatility 200 Index', 'Volatility 300 Index'
    ];
    
    const boomCrashIndices = [
        'Boom 50 Index', 'Boom 100 Index', 'Boom 300 Index', 'Boom 500 Index', 
        'Boom 600 Index', 'Boom 900 Index', 'Boom 1000 Index',
        'Crash 50 Index', 'Crash 100 Index', 'Crash 300 Index', 'Crash 500 Index', 
        'Crash 600 Index', 'Crash 900 Index', 'Crash 1000 Index'
    ];
    
    const jumpIndices = [
        'Jump 10 Index', 'Jump 25 Index', 'Jump 50 Index', 'Jump 75 Index', 
        'Jump 100 Index', 'Jump 150 Index', 'Jump 200 Index'
    ];
    
    const rangeBreakIndices = [
        'Range Break 50 Index', 'Range Break 100 Index', 'Range Break 200 Index'
    ];
    
    const stepIndices = [
        'Step Index', 'Step 200 Index', 'Step 300 Index', 'Step 400 Index', 'Step 500 Index'
    ];
    
    const mixedIndices = [
        'Bear Market Index', 'Bull Market Index', 
        'Drift Switch 10 Index', 'Drift Switch 20 Index', 'Drift Switch 30 Index'
    ];
    
    const syntheticIndices = [
        ...volatilityIndices, ...boomCrashIndices, ...jumpIndices, 
        ...rangeBreakIndices, ...stepIndices, ...mixedIndices
    ];
    
    const forexPairs = [
        'EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CHF', 'AUD/USD', 'USD/CAD', 'NZD/USD',
        'EUR/GBP', 'EUR/JPY', 'GBP/JPY', 'AUD/JPY', 'AUD/CAD', 'AUD/CHF', 'AUD/NZD',
        'CAD/JPY', 'CHF/JPY', 'EUR/AUD', 'EUR/CAD', 'EUR/CHF', 'EUR/NZD',
        'GBP/AUD', 'GBP/CAD', 'GBP/CHF', 'GBP/NZD', 'NZD/CAD', 'NZD/CHF', 'NZD/JPY',
        'USD/MXN', 'USD/ZAR', 'USD/SEK', 'USD/NOK', 'USD/SGD', 'USD/HKD'
    ];
    
    const traditionalIndices = [
        'US30', 'SPX500', 'NAS100', 'GE30', 'FTSE100', 'NIKKEI225',
        'AUS200', 'ESTX50', 'FRA40', 'ESP35', 'HKG50'
    ];
    
    const commodities = ['Gold', 'Silver', 'Oil', 'Brent', 'Natural Gas', 'Palladium', 'Platinum'];
    
    const smartTrader = [
        'Rise/Fall', 'Higher/Lower', 'Touch/No Touch', 'Ends Between/Out',
        'Stays Between/Goes Out', 'Asians', 'Digits', 'Lookbacks',
        'Reset Call/Put', 'Call/Put Spreads', 'Multipliers', 'Even/Odd', 
        'Over/Under', 'Turbos', 'Vanillas'
    ];
    
    const accumulator = ['Accumulator Up', 'Accumulator Down'];

    if (forexPairs.includes(symbol)) return 'forex';
    if (traditionalIndices.includes(symbol)) return 'indices';
    if (syntheticIndices.includes(symbol)) return 'synthetic';
    if (commodities.includes(symbol)) return 'commodities';
    if (smartTrader.includes(symbol)) return 'smarttrader';
    if (accumulator.includes(symbol)) return 'accumulator';
    
    if (symbol.includes('Index')) return 'synthetic';
    
    return 'forex';
}

function getPipSize(symbol) {
    return symbol.includes('JPY') ? 0.01 : 0.0001;
}

function calculatePipsPoints(entry, sl, tp, symbol, type) {
    const instrumentType = getInstrumentType(symbol);
    
    if (instrumentType === 'forex') {
        const pipSize = getPipSize(symbol);
        const slPips = type === 'long' ? (entry - sl) / pipSize : (sl - entry) / pipSize;
        let tpPips = 0;
        if (tp) tpPips = type === 'long' ? (tp - entry) / pipSize : (entry - tp) / pipSize;
        return { risk: Math.abs(slPips), reward: Math.abs(tpPips) };
    } else if (instrumentType === 'synthetic' || instrumentType === 'commodities' || instrumentType === 'indices') {
        const slPoints = type === 'long' ? (entry - sl) : (sl - entry);
        let tpPoints = 0;
        if (tp) tpPoints = type === 'long' ? (tp - entry) : (entry - tp);
        return { risk: Math.abs(slPoints), reward: Math.abs(tpPoints) };
    } else if (instrumentType === 'smarttrader' || instrumentType === 'accumulator') {
        return { risk: 1, reward: 0.8 };
    } else {
        const slPoints = type === 'long' ? (entry - sl) : (sl - entry);
        let tpPoints = 0;
        if (tp) tpPoints = type === 'long' ? (tp - entry) : (entry - tp);
        return { risk: Math.abs(slPoints), reward: Math.abs(tpPoints) };
    }
}

function calculateProfitLoss(entry, exit, lotSize, symbol, type) {
    const instrumentType = getInstrumentType(symbol);
    const pointValue = getPointValue(symbol);
    
    let profit;
    let calculationMethod = '';
    
    if (instrumentType === 'forex') {
        const pipValue = 10 * lotSize;
        const pipSize = getPipSize(symbol);
        const pips = type === 'long' ? (exit - entry) / pipSize : (entry - exit) / pipSize;
        profit = pips * pipValue;
        calculationMethod = `Pips: ${pips.toFixed(2)} × $${pipValue} = $${profit.toFixed(2)}`;
    } else if (instrumentType === 'synthetic' || instrumentType === 'indices' || instrumentType === 'commodities') {
        const points = type === 'long' ? (exit - entry) : (entry - exit);
        profit = points * pointValue * lotSize;
        calculationMethod = `Points: ${points.toFixed(4)} × $${pointValue} × ${lotSize} lot = $${profit.toFixed(2)}`;
        
        // Check if this symbol has been verified
        if (!pointValueOverrides[symbol] && instrumentType === 'synthetic') {
            console.log(`[PnL] Using default point value $${pointValue} for ${symbol}. Verify in Settings > Contract Size Verification.`);
        }
    } else if (instrumentType === 'smarttrader') {
        const payout = 0.80;
        profit = type === 'long' ? (lotSize * payout) : -lotSize;
        calculationMethod = `Binary payout: ${lotSize} × ${payout * 100}% = $${profit.toFixed(2)}`;
    } else if (instrumentType === 'accumulator') {
        const multiplier = 2;
        const points = type === 'long' ? (exit - entry) : (entry - exit);
        profit = points * lotSize * multiplier;
        calculationMethod = `Accumulator: Points ${points.toFixed(4)} × ${lotSize} × ${multiplier} = $${profit.toFixed(2)}`;
    } else {
        const pointValueForSymbol = getPointValue(symbol);
        const points = type === 'long' ? (exit - entry) : (entry - exit);
        profit = points * pointValueForSymbol * lotSize;
        calculationMethod = `Default: Points ${points.toFixed(4)} × $${pointValueForSymbol} × ${lotSize} = $${profit.toFixed(2)}`;
    }
    
    // Log calculation for debugging
    console.log(`[PnL Calc] ${symbol} (${type}): ${calculationMethod}`);
    
    return parseFloat(profit.toFixed(2));
}

window.updateInstrumentType = () => {
    const symbol = document.getElementById('symbol')?.value;
    if (symbol) {
        const instrumentType = getInstrumentType(symbol);
        let displayText = '';
        let badgeClass = '';
        
        switch(instrumentType) {
            case 'forex':
                displayText = 'Forex';
                badgeClass = 'forex-badge';
                break;
            case 'indices':
                displayText = 'Traditional Index';
                badgeClass = 'indices-badge';
                break;
            case 'synthetic':
                displayText = 'Deriv Synthetic';
                badgeClass = 'synthetic-badge';
                break;
            case 'commodities':
                displayText = 'Commodity';
                badgeClass = 'commodities-badge';
                break;
            case 'smarttrader':
                displayText = 'SmartTrader';
                badgeClass = 'smarttrader-badge';
                break;
            case 'accumulator':
                displayText = 'Accumulator';
                badgeClass = 'accumulator-badge';
                break;
            default:
                displayText = 'Forex';
                badgeClass = 'forex-badge';
        }
        
        const displayElement = document.getElementById('instrumentTypeDisplay');
        if (displayElement) {
            // Add point value info for synthetic indices
            let extraInfo = '';
            if (instrumentType === 'synthetic') {
                const config = derivLotSizeConfig[symbol];
                if (config) {
                    extraInfo = `<br><small class="text-xs">Point Value: $${config.pointValue}/pt | Min Lot: ${config.minLot}</small>`;
                }
            }
            displayElement.innerHTML = `<span class="market-type-badge ${badgeClass}">${displayText}</span>${extraInfo}`;
        }
        
        // Update lot size display
        updateLotSizeDisplay();
        
        // Update risk calculation
        updateRiskCalculation();
    }
};

// ========== CALENDAR FUNCTIONS ==========

function setupCalendar() {
    console.log('[CALENDAR] Setting up calendar functionality...');
    
    const prevMonthBtn = document.getElementById('prevMonth');
    const nextMonthBtn = document.getElementById('nextMonth');
    const viewTypeSelect = document.getElementById('viewType');
    const quickNavSelect = document.getElementById('quickNav');
    const applyCustomRangeBtn = document.getElementById('applyCustomRange');
    
    if (prevMonthBtn) prevMonthBtn.addEventListener('click', () => navigateCalendar(-1));
    if (nextMonthBtn) nextMonthBtn.addEventListener('click', () => navigateCalendar(1));
    
    if (viewTypeSelect) {
        viewTypeSelect.addEventListener('change', (e) => {
            calendarViewType = e.target.value;
            renderCalendar();
            document.getElementById('monthView').classList.toggle('hidden', calendarViewType !== 'month');
            document.getElementById('weekView').classList.toggle('hidden', calendarViewType !== 'week');
        });
    }
    
    if (quickNavSelect) quickNavSelect.addEventListener('change', handleQuickNavigation);
    if (applyCustomRangeBtn) applyCustomRangeBtn.addEventListener('click', handleCustomRangeApply);
    
    renderCalendar();
    console.log('[SUCCESS] Calendar setup complete');
}

function handleCustomRangeApply() {
    const startDateInput = document.getElementById('startDate');
    const endDateInput = document.getElementById('endDate');
    
    if (!startDateInput || !endDateInput) return;
    
    const startDate = new Date(startDateInput.value);
    const endDate = new Date(endDateInput.value);
    
    if (!startDateInput.value || !endDateInput.value) {
        alert('Please select both start and end dates.');
        return;
    }
    
    if (startDate > endDate) {
        alert('Start date cannot be after end date.');
        return;
    }
    
    currentCalendarDate = new Date(startDate);
    document.getElementById('customRangeContainer').classList.add('hidden');
    
    const quickNavSelect = document.getElementById('quickNav');
    if (quickNavSelect) quickNavSelect.value = 'current';
    
    renderCalendar();
    
    const startFormatted = startDate.toLocaleDateString();
    const endFormatted = endDate.toLocaleDateString();
    showSuccessMessage(`Calendar showing custom range: ${startFormatted} to ${endFormatted}`);
}

function handleQuickNavigation(e) {
    const value = e.target.value;
    const today = new Date();
    
    switch (value) {
        case 'current':
            currentCalendarDate = new Date();
            document.getElementById('customRangeContainer').classList.add('hidden');
            break;
        case 'lastMonth':
            currentCalendarDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
            document.getElementById('customRangeContainer').classList.add('hidden');
            break;
        case 'last3Months':
            currentCalendarDate = new Date(today.getFullYear(), today.getMonth() - 3, 1);
            document.getElementById('customRangeContainer').classList.add('hidden');
            break;
        case 'custom':
            document.getElementById('customRangeContainer').classList.remove('hidden');
            const startDateInput = document.getElementById('startDate');
            const endDateInput = document.getElementById('endDate');
            if (startDateInput && endDateInput) {
                const thirtyDaysAgo = new Date();
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                startDateInput.value = thirtyDaysAgo.toISOString().split('T')[0];
                endDateInput.value = new Date().toISOString().split('T')[0];
            }
            return;
    }
    
    renderCalendar();
}

function navigateCalendar(direction) {
    if (calendarViewType === 'month') {
        currentCalendarDate.setMonth(currentCalendarDate.getMonth() + direction);
    } else {
        currentCalendarDate.setDate(currentCalendarDate.getDate() + (direction * 7));
    }
    renderCalendar();
}

function renderCalendar() {
    if (calendarViewType === 'month') {
        renderMonthView();
    } else {
        renderWeekView();
    }
    updateCalendarStats();
}

function renderMonthView() {
    const monthGrid = document.getElementById('monthGrid');
    const currentMonthYear = document.getElementById('currentMonthYear');
    
    if (!monthGrid || !currentMonthYear) return;
    
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
    currentMonthYear.textContent = `${monthNames[currentCalendarDate.getMonth()]} ${currentCalendarDate.getFullYear()}`;
    
    const firstDay = new Date(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth(), 1);
    const lastDay = new Date(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth() + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();
    
    const monthTrades = getTradesForMonth(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth());
    
    let calendarHTML = '';
    
    const prevMonthLastDay = new Date(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth(), 0).getDate();
    for (let i = startingDay - 1; i >= 0; i--) {
        const day = prevMonthLastDay - i;
        calendarHTML += createCalendarDay(day, 'other-month', []);
    }
    
    for (let day = 1; day <= daysInMonth; day++) {
        const dayTrades = monthTrades.filter(trade => {
            const tradeDate = new Date(trade.timestamp);
            return tradeDate.getDate() === day;
        });
        calendarHTML += createCalendarDay(day, 'current-month', dayTrades);
    }
    
    const totalCells = 42;
    const remainingCells = totalCells - (startingDay + daysInMonth);
    for (let day = 1; day <= remainingCells; day++) {
        calendarHTML += createCalendarDay(day, 'other-month', []);
    }
    
    monthGrid.innerHTML = calendarHTML;
    
    monthGrid.querySelectorAll('.calendar-day').forEach(dayElement => {
        dayElement.addEventListener('click', handleDayClick);
    });
}

function createCalendarDay(dayNumber, monthType, dayTrades) {
    const today = new Date();
    const isToday = monthType === 'current-month' && 
                   dayNumber === today.getDate() && 
                   currentCalendarDate.getMonth() === today.getMonth() && 
                   currentCalendarDate.getFullYear() === today.getFullYear();
    
    const hasTrades = dayTrades.length > 0;
    const hasProfit = hasTrades && dayTrades.some(trade => trade.profit > 0);
    const hasLoss = hasTrades && dayTrades.some(trade => trade.profit < 0);
    
    let dayClass = 'calendar-day';
    if (monthType === 'other-month') dayClass += ' other-month';
    if (isToday) dayClass += ' today';
    if (hasTrades) dayClass += ' has-trades';
    if (hasLoss && !hasProfit) dayClass += ' has-losses';
    
    const totalProfit = dayTrades.reduce((sum, trade) => sum + trade.profit, 0);
    const profitClass = totalProfit >= 0 ? 'profit' : 'loss';
    
    return `
        <div class="${dayClass}" data-date="${currentCalendarDate.getFullYear()}-${String(currentCalendarDate.getMonth() + 1).padStart(2, '0')}-${String(dayNumber).padStart(2, '0')}">
            <div class="calendar-date">${dayNumber}</div>
            <div class="calendar-trades">
                ${dayTrades.slice(0, 2).map(trade => `
                    <div class="calendar-trade-item ${trade.profit >= 0 ? 'profit' : 'loss'}">
                        ${trade.symbol} ${formatCurrency(trade.profit)}
                    </div>
                `).join('')}
                ${dayTrades.length > 2 ? `<div class="calendar-trade-item">+${dayTrades.length - 2} more</div>` : ''}
            </div>
            ${hasTrades ? `
                <div class="calendar-trade-summary ${profitClass}">
                    Total: ${formatCurrency(totalProfit)}
                </div>
            ` : ''}
        </div>
    `;
}

function renderWeekView() {
    const weekGrid = document.getElementById('weekGrid');
    const currentMonthYear = document.getElementById('currentMonthYear');
    
    if (!weekGrid || !currentMonthYear) return;
    
    const startOfWeek = new Date(currentCalendarDate);
    startOfWeek.setDate(currentCalendarDate.getDate() - currentCalendarDate.getDay());
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    currentMonthYear.textContent = `${monthNames[startOfWeek.getMonth()]} ${startOfWeek.getDate()} - ${monthNames[endOfWeek.getMonth()]} ${endOfWeek.getDate()}, ${endOfWeek.getFullYear()}`;
    
    const weekTrades = getTradesForWeek(startOfWeek);
    
    let weekHTML = '';
    const timeSlots = [];
    
    for (let hour = 8; hour <= 20; hour++) {
        timeSlots.push(`${hour.toString().padStart(2, '0')}:00`);
    }
    
    timeSlots.forEach(time => {
        weekHTML += `<div class="week-time-slot">${time}</div>`;
        
        for (let day = 0; day < 7; day++) {
            const currentDay = new Date(startOfWeek);
            currentDay.setDate(startOfWeek.getDate() + day);
            
            const dayTrades = weekTrades.filter(trade => {
                const tradeDate = new Date(trade.timestamp);
                return tradeDate.getDate() === currentDay.getDate() && 
                       tradeDate.getMonth() === currentDay.getMonth() &&
                       tradeDate.getFullYear() === currentDay.getFullYear() &&
                       tradeDate.getHours() === parseInt(time.split(':')[0]);
            });
            
            weekHTML += `
                <div class="week-day-cell" data-date="${currentDay.toISOString().split('T')[0]}">
                    ${dayTrades.map(trade => `
                        <div class="week-trade-marker ${trade.profit >= 0 ? 'profit' : 'loss'}" 
                             onclick="viewTradeDetails('${trade.id}')"
                             title="${trade.symbol} - ${formatCurrency(trade.profit)}">
                            ${trade.symbol}
                        </div>
                    `).join('')}
                </div>
            `;
        }
    });
    
    weekGrid.innerHTML = weekHTML;
}

function getTradesForMonth(year, month) {
    return allTrades.filter(trade => {
        const tradeDate = new Date(trade.timestamp);
        return tradeDate.getFullYear() === year && tradeDate.getMonth() === month;
    });
}

function getTradesForWeek(startDate) {
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 7);
    
    return allTrades.filter(trade => {
        const tradeDate = new Date(trade.timestamp);
        return tradeDate >= startDate && tradeDate < endDate;
    });
}

window.viewTradeDetails = (tradeId) => {
    const trade = allTrades.find(t => t.id === tradeId);
    if (trade) {
        alert(`Trade Details:\n\nSymbol: ${trade.symbol}\nType: ${trade.type}\nProfit: ${formatCurrency(trade.profit)}\nDate: ${new Date(trade.timestamp).toLocaleString()}\nNotes: ${trade.notes || 'No notes'}`);
    }
};

function handleDayClick(e) {
    const dayElement = e.currentTarget;
    const dateString = dayElement.getAttribute('data-date');
    
    if (!dateString) return;
    
    document.querySelectorAll('.calendar-day').forEach(day => day.classList.remove('selected'));
    dayElement.classList.add('selected');
    
    showTradesForDate(dateString);
}

function showTradesForDate(dateString) {
    const selectedDayTrades = document.getElementById('selectedDayTrades');
    const selectedDayTitle = document.getElementById('selectedDayTitle');
    const selectedDayDetails = document.getElementById('selectedDayDetails');
    
    if (!selectedDayTrades || !selectedDayTitle || !selectedDayDetails) return;
    
    const date = new Date(dateString + 'T00:00:00');
    const dayTrades = allTrades.filter(trade => {
        const tradeDate = new Date(trade.timestamp);
        return tradeDate.toDateString() === date.toDateString();
    });
    
    selectedDayTitle.textContent = `Trades for ${date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`;
    
    if (dayTrades.length === 0) {
        selectedDayTrades.innerHTML = `
            <div class="text-center text-gray-500 py-4">
                <p>No trades recorded for this day.</p>
            </div>
        `;
    } else {
        selectedDayTrades.innerHTML = dayTrades.map(trade => `
            <div class="trade-item">
                <div class="flex justify-between items-start">
                    <div class="flex-1">
                        <div class="flex justify-between items-center mb-2">
                            <div class="font-semibold">${trade.symbol}</div>
                            <div class="${trade.profit >= 0 ? 'profit' : 'loss'} font-bold">
                                ${formatCurrency(trade.profit)}
                            </div>
                        </div>
                        <div class="text-sm text-gray-600">
                            <div>Type: ${trade.type.toUpperCase()} • ${trade.lotSize} lots</div>
                            <div>Entry: ${trade.entryPrice} • SL: ${trade.stopLoss} • TP: ${trade.takeProfit || 'N/A'}</div>
                            <div>Time: ${new Date(trade.timestamp).toLocaleTimeString()}</div>
                        </div>
                        ${formatConfluenceDetails(trade)}
                    </div>
                </div>
            </div>
        `).join('');
    }
    
    selectedDayDetails.classList.remove('hidden');
}

function updateCalendarStats() {
    const periodTrades = calendarViewType === 'month' ? 
        getTradesForMonth(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth()) :
        getTradesForWeek(new Date(currentCalendarDate));
    
    const periodTradesCount = document.getElementById('periodTradesCount');
    const periodTotalProfit = document.getElementById('periodTotalProfit');
    const periodWinRate = document.getElementById('periodWinRate');
    const periodAvgProfit = document.getElementById('periodAvgProfit');
    
    if (periodTradesCount) periodTradesCount.textContent = periodTrades.length;
    
    if (periodTotalProfit) {
        const totalProfit = periodTrades.reduce((sum, trade) => sum + trade.profit, 0);
        periodTotalProfit.textContent = formatCurrency(totalProfit);
    }
    
    if (periodWinRate) {
        const winningTrades = periodTrades.filter(trade => trade.profit > 0).length;
        const winRate = periodTrades.length > 0 ? (winningTrades / periodTrades.length * 100) : 0;
        periodWinRate.textContent = `${winRate.toFixed(1)}%`;
    }
    
    if (periodAvgProfit) {
        const avgProfit = periodTrades.length > 0 ? 
            periodTrades.reduce((sum, trade) => sum + trade.profit, 0) / periodTrades.length : 0;
        periodAvgProfit.textContent = formatCurrency(avgProfit);
    }
}

// ========== ACCOUNT MANAGEMENT SYSTEM ==========

async function initializeAccounts() {
    console.log('🔄 Initializing accounts system...');
    await loadUserAccounts();
    setupAccountsDropdown();
    console.log('[SUCCESS] Accounts system initialized');
}

async function loadUserAccounts() {
    try {
        if (!currentUser) throw new Error('No authenticated user');

        console.log('📁 Loading accounts from Firestore for user:', currentUser.uid);
        const q = query(collection(db, 'accounts'), where('userId', '==', currentUser.uid));
        const querySnapshot = await getDocs(q);
        
        const accounts = [];
        querySnapshot.forEach((doc) => {
            accounts.push({ id: doc.id, ...doc.data() });
        });

        console.log('[ACCOUNTS] Accounts found in Firestore:', accounts.length);

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
            console.log('[SUCCESS] Default account created with ID:', docRef.id);
        } else {
            userAccounts = accounts;
            console.log('[SUCCESS] Accounts loaded from Firestore:', userAccounts.length);
        }
        
        const savedCurrentAccount = localStorage.getItem('currentAccountId');
        currentAccountId = savedCurrentAccount || userAccounts[0].id;
        
        if (!userAccounts.some(acc => acc.id === currentAccountId)) {
            console.warn('⚠️ Current account ID not found in accounts, using first account');
            currentAccountId = userAccounts[0].id;
            localStorage.setItem('currentAccountId', currentAccountId);
        }
        
        console.log('[ACCOUNT] Current account set to:', currentAccountId);
        updateCurrentAccountDisplay();
        
    } catch (error) {
        console.error('[ERROR] Error loading accounts from Firestore:', error);
        await loadAccountsFromLocalStorageFallback();
    }
}

async function loadAccountsFromLocalStorageFallback() {
    console.log('🔄 Falling back to localStorage for accounts...');
    const savedAccounts = localStorage.getItem('userAccounts');
    if (savedAccounts) {
        userAccounts = JSON.parse(savedAccounts);
        console.log('📁 Loaded existing accounts from localStorage:', userAccounts.length);
    } else {
        userAccounts = [{
            id: 'main_' + Date.now(),
            name: 'Main Account',
            balance: 10000,
            currency: 'USD',
            createdAt: new Date().toISOString(),
            isDefault: true
        }];
        localStorage.setItem('userAccounts', JSON.stringify(userAccounts));
        console.log('🆕 Created default account in localStorage');
    }
    
    const savedCurrentAccount = localStorage.getItem('currentAccountId');
    currentAccountId = savedCurrentAccount || userAccounts[0].id;
    console.log('[ACCOUNT] Current account:', currentAccountId);
    
    updateCurrentAccountDisplay();
}

async function saveUserAccounts() {
    try {
        console.log('[SAVE] Saving accounts to Firestore...');
        
        if (!currentUser) {
            console.log('[ERROR] No user, saving to localStorage only');
            localStorage.setItem('userAccounts', JSON.stringify(userAccounts));
            return;
        }

        const savePromises = userAccounts.map(async (account) => {
            try {
                if (account.id && !account.id.startsWith('local_') && !account.id.startsWith('main_')) {
                    const accountRef = doc(db, 'accounts', account.id);
                    const accountData = { ...account };
                    delete accountData.id;
                    await setDoc(accountRef, accountData, { merge: true });
                    console.log('[SUCCESS] Updated account in Firestore:', account.id);
                } else if (!account.id || account.id.startsWith('local_') || account.id.startsWith('main_')) {
                    const accountData = { ...account };
                    if (account.id?.startsWith('local_') || account.id?.startsWith('main_')) {
                        delete accountData.id;
                    }
                    accountData.userId = currentUser.uid;
                    
                    const docRef = await addDoc(collection(db, 'accounts'), accountData);
                    account.id = docRef.id;
                    console.log('[SUCCESS] Created new account in Firestore:', docRef.id);
                }
            } catch (error) {
                console.error('[ERROR] Error saving individual account:', account.name, error);
                throw error;
            }
        });
        
        await Promise.all(savePromises);
        console.log('[SUCCESS] All accounts saved to Firestore');
        
        localStorage.setItem('userAccounts', JSON.stringify(userAccounts));
        
    } catch (error) {
        console.error('[ERROR] Error saving accounts to Firestore:', error);
        localStorage.setItem('userAccounts', JSON.stringify(userAccounts));
        console.log('📁 Accounts saved to localStorage as fallback');
    }
}

function setupAccountsDropdown() {
    const accountsToggle = document.getElementById('accountsToggle');
    const accountsMenu = document.getElementById('accountsMenu');
    
    if (accountsToggle && accountsMenu) {
        accountsToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            accountsMenu.classList.toggle('hidden');
            renderAccountsList();
        });
        
        document.addEventListener('click', () => accountsMenu.classList.add('hidden'));
        accountsMenu.addEventListener('click', (e) => e.stopPropagation());
    }
}

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

function updateCurrentAccountDisplay() {
    const currentAccount = getCurrentAccount();
    if (!currentAccount) return;
    
    const currentAccountName = document.getElementById('currentAccountName');
    if (currentAccountName) currentAccountName.textContent = currentAccount.name;
    
    updateAccountSettingsForm(currentAccount);
}

function updateAccountSettingsForm(account) {
    const accountSizeInput = document.getElementById('accountSize');
    const accountCurrencySelect = document.getElementById('accountCurrency');
    
    if (accountSizeInput) accountSizeInput.value = account.balance;
    if (accountCurrencySelect) accountCurrencySelect.value = account.currency;
    
    updateCurrencyDisplay();
}

window.switchAccount = async (accountId) => {
    if (accountId === currentAccountId) return;
    
    console.log('🔄 Switching to account:', accountId);
    
    // Clean up trades listener before switching
    if (tradesUnsubscribe) {
        tradesUnsubscribe();
        tradesUnsubscribe = null;
    }
    
    await saveCurrentAccountData();
    
    currentAccountId = accountId;
    localStorage.setItem('currentAccountId', accountId);
    
    updateCurrentAccountDisplay();
    
    // Reload trades with new account
    await loadTrades();
    
    const accountsMenu = document.getElementById('accountsMenu');
    if (accountsMenu) accountsMenu.classList.add('hidden');
    
    showSuccessMessage(`Switched to ${getCurrentAccount().name}`);
};

function getCurrentAccount() {
    return userAccounts.find(acc => acc.id === currentAccountId) || userAccounts[0];
}

async function saveCurrentAccountData() {
    const currentAccount = getCurrentAccount();
    
    const accountSizeInput = document.getElementById('accountSize');
    if (accountSizeInput) currentAccount.balance = parseFloat(accountSizeInput.value) || 10000;
    
    const accountCurrencySelect = document.getElementById('accountCurrency');
    if (accountCurrencySelect) currentAccount.currency = accountCurrencySelect.value;
    
    await saveUserAccounts();
}

async function loadAccountData() {
    showLoading();
    console.log('[ACCOUNTS] Loading account data for:', currentAccountId);
    
    try {
        if (!currentAccountId || !userAccounts.some(acc => acc.id === currentAccountId)) {
            console.warn('⚠️ Invalid current account, resetting to first account');
            currentAccountId = userAccounts[0]?.id;
            localStorage.setItem('currentAccountId', currentAccountId);
            
            if (!currentAccountId) throw new Error('No valid accounts available');
        }

        await loadTrades();
        await loadTransactions();
        
        updateStats(allTrades);
        renderCharts(allTrades);
        calculateAdvancedMetrics(allTrades);
        updateEmotionAnalytics(allTrades);
        // In loadAccountData function, after calculateAdvancedMetrics(allTrades);
        initializeAISuggestions();
        
        console.log('[SUCCESS] Account data loaded successfully');
        
    } catch (error) {
        console.error('[ERROR] Error loading account data:', error);
        
        let errorMessage = 'Error loading account data. ';
        
        if (error.message.includes('No valid accounts')) {
            errorMessage += 'No trading accounts found. Please create an account first.';
        } else if (error.message.includes('network') || error.message.includes('Firestore')) {
            errorMessage += 'Network or database error. Please check your connection.';
        } else {
            errorMessage += `Technical issue: ${error.message}`;
        }
        
        alert(errorMessage);
        throw error;
    } finally {
        hideLoading();
    }
}

window.showAddAccountModal = () => {
    document.getElementById('addAccountModal').classList.remove('hidden');
    document.getElementById('accountName').value = '';
    document.getElementById('accountBalance').value = '10000';
    document.getElementById('accountCurrencySelect').value = 'USD';
    document.getElementById('accountNameCharCount').textContent = '0';
    
    document.getElementById('accountsMenu')?.classList.add('hidden');
    document.getElementById('mobileMenu')?.classList.add('hidden');
};

window.closeAddAccountModal = () => {
    document.getElementById('addAccountModal').classList.add('hidden');
};

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
            
            if (userAccounts.some(acc => acc.name.toLowerCase() === accountName.toLowerCase())) {
                alert('An account with this name already exists. Please choose a different name.');
                return;
            }
            
            const submitButton = addAccountForm.querySelector('button[type="submit"]');
            const originalText = submitButton.innerHTML;
            submitButton.innerHTML = '<div class="loading-spinner"></div> Creating...';
            submitButton.disabled = true;
            
            try {
                const newAccount = {
                    name: accountName,
                    balance: accountBalance,
                    currency: accountCurrency,
                    createdAt: new Date().toISOString(),
                    isDefault: false,
                    userId: currentUser.uid
                };
                
                console.log('🆕 Creating new account:', newAccount);
                
                const docRef = await addDoc(collection(db, 'accounts'), newAccount);
                console.log('[SUCCESS] Account created in Firestore with ID:', docRef.id);
                
                const accountWithId = {
                    id: docRef.id,
                    ...newAccount
                };
                userAccounts.push(accountWithId);
                
                await saveUserAccounts();
                
                closeAddAccountModal();
                renderAccountsList();
                showSuccessMessage(`Account "${accountName}" created successfully!`);
                
            } catch (error) {
                console.error('[ERROR] Error creating account:', error);
                
                let errorMessage = 'Error creating account. ';
                if (error.code === 'permission-denied') {
                    errorMessage += 'Firestore permission denied. Please check your Firestore rules.';
                } else if (error.code === 'unavailable') {
                    errorMessage += 'Network error. Please check your internet connection.';
                } else {
                    errorMessage += `Technical issue: ${error.message}`;
                }
                
                alert(errorMessage);
            } finally {
                submitButton.innerHTML = originalText;
                submitButton.disabled = false;
            }
        });
    }

    const accountNameInput = document.getElementById('accountName');
    if (accountNameInput) {
        accountNameInput.addEventListener('input', function() {
            document.getElementById('accountNameCharCount').textContent = this.value.length;
        });
    }
}

window.deleteAccount = async (accountId) => {
    const account = userAccounts.find(acc => acc.id === accountId);
    if (!account) return;
    
    if (account.isDefault) {
        alert('Cannot delete the default main account.');
        return;
    }
    
    if (confirm(`Are you sure you want to delete "${account.name}"? This will also delete all trades associated with this account.`)) {
        try {
            if (!accountId.startsWith('local_')) {
                await deleteDoc(doc(db, 'accounts', accountId));
            }
            
            userAccounts = userAccounts.filter(acc => acc.id !== accountId);
            await saveUserAccounts();
            
            if (currentAccountId === accountId) {
                await switchAccount(userAccounts[0].id);
            }
            
            await deleteAccountTrades(accountId);
            
            renderAccountsList();
            showSuccessMessage(`Account "${account.name}" deleted successfully!`);
            
        } catch (error) {
            console.error('Error deleting account:', error);
            alert('Error deleting account. Please try again.');
        }
    }
};

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

function showSuccessMessage(message) {
    const successDiv = document.createElement('div');
    successDiv.className = 'fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 transform transition-all duration-300';
    successDiv.innerHTML = message;
    document.body.appendChild(successDiv);
    
    setTimeout(() => successDiv.remove(), 3000);
}

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
        console.log('[USER] User authenticated:', user.email);
        
        try {
            console.log('🔄 Starting account initialization...');
            await initializeAccounts();
            console.log('[SUCCESS] Account initialization complete');
            
            await loadUserSettings();
            console.log('[SUCCESS] User settings loaded');
            
            console.log('🔄 Loading account data...');
            await loadAccountData();
            console.log('[SUCCESS] Account data loaded');
            
            setupEventListeners();
            setupTabs();
            setupMobileMenu();
            setupSidebarCollapse();
            setupAccountModalListeners();
            setupCalendar();
            setupMobileViewport();
            loadPointValueOverrides();
            loadPersonalInfo();
            initTheme();
            setupThemeListeners()
            loadAllPreferences();
            // loadPreferences();
            setupTransactionListeners();
            await loadTransactions();
            // Initialize emotion gauge
            initEmotionGauge();
            
            console.log('🔄 Starting account initialization...');
            await initializeAccounts();
            console.log('✅ All systems initialized successfully');
            
        } catch (error) {
            console.error('❌ Error during initialization:', error);
            const errorMessage = `Error initializing application: ${error.message}. Please refresh the page.`;
            alert(errorMessage);
        } finally {
            hideLoading();
            console.log('🏁 Initialization process completed');
        }
    } else {
        console.log('🚪 No user, redirecting to login');
        window.location.href = 'index.html';
    }
});

window.logout = async () => {
    try {
        // Clean up real-time listeners
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

// ========== EVENT LISTENERS ==========

function setupEventListeners() {
    console.log('🔧 Setting up event listeners...');
    
    document.getElementById('tradeDateTime').value = getCurrentDateTimeString();
    
    const tradeForm = document.getElementById('tradeForm');
    if (tradeForm) {
        tradeForm.addEventListener('submit', (e) => {
            e.preventDefault();
            addTrade(e);
        });
        
        tradeForm.addEventListener('reset', () => {
            setTimeout(() => {
                document.getElementById('tradeDateTime').value = getCurrentDateTimeString();
                updateConfluenceScoreDisplay();
                // Reset emotion gauge to default
                const emotionSlider = document.getElementById('emotionLevel');
                if (emotionSlider) {
                    emotionSlider.value = 50;
                    updateEmotionDisplay(50);
                }
                // Reset exit price field
                const exitPriceField = document.getElementById('exitPrice');
                if (exitPriceField) {
                    exitPriceField.value = '';
                }
            }, 0);
        });
    }

    const confluenceContainer = document.getElementById('confluenceOptions');
    if (confluenceContainer) {
        renderConfluenceOptions();
        confluenceContainer.addEventListener('change', (event) => {
            if (event.target.matches('input[type="checkbox"]')) {
                updateConfluenceScoreDisplay();
            }
        });
        confluenceContainer.addEventListener('click', (event) => {
            const removeButton = event.target.closest('.remove-confluence-option');
            if (removeButton) removeConfluenceOption(removeButton.dataset.option);
        });
    }

    const addConfluenceOptionButton = document.getElementById('addConfluenceOptionButton');
    const newConfluenceOptionInput = document.getElementById('newConfluenceOption');
    if (addConfluenceOptionButton && newConfluenceOptionInput) {
        addConfluenceOptionButton.addEventListener('click', addConfluenceOption);
        newConfluenceOptionInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                addConfluenceOption();
            }
        });
    }

    updateConfluenceScoreDisplay();

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

    const accountCurrency = document.getElementById('accountCurrency');
    if (accountCurrency) {
        accountCurrency.addEventListener('change', async (e) => {
            const newCurrency = e.target.value;
            const currentAccount = getCurrentAccount();
            currentAccount.currency = newCurrency;
            await saveUserAccounts();
            
            localStorage.setItem('accountCurrency', newCurrency);
            updateCurrencyDisplay();
            updateStats(allTrades);
            renderCharts(allTrades);
            updateRiskCalculation();
        });
    }

    ['entryPrice', 'stopLoss', 'takeProfit', 'lotSize', 'direction', 'symbol', 'mood'].forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('input', () => updateRiskCalculation());
            element.addEventListener('change', () => updateRiskCalculation());
        }
    });

    const symbolSelect = document.getElementById('symbol');
    if (symbolSelect) {
        symbolSelect.addEventListener('change', () => {
            updateInstrumentType();
            updateLotSizeDisplay();
        });
    }
    
    updateRiskCalculation();
    setupSidebarCollapse();
    setupAffirmationsEventListeners();
    setupAccountBalanceLock();
    
    console.log('✅ Event listeners setup complete');
}

// ========== TRADING FUNCTIONS WITH REAL-TIME LISTENERS ==========

let tradesUnsubscribe = null; // Add this near top with other global variables

async function loadTrades() {
    try {
        console.log('[TRADES] Setting up real-time listener for account:', currentAccountId);
        
        if (!currentUser) throw new Error('No authenticated user');
        if (!currentAccountId) {
            console.warn('⚠️ No currentAccountId, using first account');
            currentAccountId = userAccounts[0]?.id;
            if (!currentAccountId) throw new Error('No accounts available');
        }

        // Unsubscribe from previous listener if it exists
        if (tradesUnsubscribe) {
            tradesUnsubscribe();
            tradesUnsubscribe = null;
        }

        const q = query(
            collection(db, 'trades'),
            where('userId', '==', currentUser.uid),
            where('accountId', '==', currentAccountId)
        );

        // Set up real-time listener
        tradesUnsubscribe = onSnapshot(q, (querySnapshot) => {
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
            if (calendarViewType) {
                renderCalendar();
            }
            
            console.log('🔄 Trades updated in real-time:', trades.length);
            
        }, (error) => {
            console.error('❌ Error in trades real-time listener:', error);
            // Show error in UI
            const tradeHistory = document.getElementById('tradeHistory');
            if (tradeHistory && allTrades.length === 0) {
                tradeHistory.innerHTML = `
                    <div class="text-center text-red-500 py-8">
                        <i class="fas fa-exclamation-triangle text-4xl mb-3"></i>
                        <p>Error loading trades: ${error.message}</p>
                        <button onclick="location.reload()" class="mt-4 bg-blue-500 text-white px-4 py-2 rounded">
                            Refresh Page
                        </button>
                    </div>
                `;
            }
        });

        console.log('✅ Real-time trades listener set up successfully');

    } catch (error) {
        console.error('❌ Error setting up trades listener:', error);
        
        const tradeHistory = document.getElementById('tradeHistory');
        if (tradeHistory) {
            tradeHistory.innerHTML = `
                <div class="text-center text-red-500 py-8">
                    <p>Error loading trades: ${error.message}</p>
                    <p class="text-sm text-gray-500 mt-2">Please refresh the page and try again.</p>
                    <button onclick="location.reload()" class="mt-4 bg-blue-500 text-white px-4 py-2 rounded">
                        🔄 Refresh Page
                    </button>
                </div>
            `;
        }
    }
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
        const confluenceOptions = Array.from(document.querySelectorAll('#confluenceOptions input[type="checkbox"]:checked')).map(el => el.value);
        const totalConfluenceOptions = document.querySelectorAll('#confluenceOptions input[type="checkbox"]').length;
        const confluenceScore = totalConfluenceOptions > 0 ? (confluenceOptions.length / totalConfluenceOptions) * 100 : 0;
        
        const tradeDateTimeInput = document.getElementById('tradeDateTime');
        const selectedDateTime = tradeDateTimeInput.value;
        const tradeTimestamp = selectedDateTime ? new Date(selectedDateTime).toISOString() : new Date().toISOString();
        
        const currentAccount = getCurrentAccount();
        const accountSize = getCurrentBalance();
        const leverage = parseInt(document.getElementById('leverage')?.value) || 50;

        if (!symbol || !entryPrice || !lotSize || !tradeType) {
            alert('Please fill all required fields (Entry Price, Size, and Direction are required)');
            return;
        }

        if (confluenceOptions.length === 0) {
            alert('Please select at least one confluence element before saving the trade.');
            return;
        }

        // Add stop loss validation
        if (tradeType === 'long' && stopLoss >= entryPrice) {
            alert('For a long position, Stop Loss must be below Entry Price');
            return;
        }
        if (tradeType === 'short' && stopLoss <= entryPrice) {
            alert('For a short position, Stop Loss must be above Entry Price');
            return;
        }

        const instrumentType = getInstrumentType(symbol);
        // Determine exit price: exitPrice takes priority, then takeProfit, then entryPrice
        const actualExitPrice = exitPrice || takeProfit || entryPrice;
        const profit = calculateProfitLoss(entryPrice, actualExitPrice, lotSize, symbol, tradeType);
        const pipPointInfo = calculatePipsPoints(entryPrice, stopLoss, takeProfit, symbol, tradeType);

        // After a winning trade is added, show confetti
        if (profit > 0) {
            showConfetti();
        }


        // ========== SCREENSHOT HANDLING - FIXED ==========
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
        // ========== END SCREENSHOT HANDLING ==========

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
        
        // Reset upload status displays
        updateUploadStatus('before', '');
        updateUploadStatus('after', '');
        
        // Reset emotion gauge
        const emotionSlider = document.getElementById('emotionLevel');
        if (emotionSlider) {
            emotionSlider.value = 50;
            updateEmotionDisplay(50);
        }
        
        await loadTrades();
        alert('Trade added successfully!');
    } catch (error) {
        console.error('Error adding trade:', error);
        alert('Error adding trade: ' + error.message);
    } finally {
        submitButton.innerHTML = originalText;
        submitButton.disabled = false;
    }
}

function updateConfluenceScoreDisplay() {
    const selected = Array.from(document.querySelectorAll('#confluenceOptions input[type="checkbox"]:checked')).length;
    const total = document.querySelectorAll('#confluenceOptions input[type="checkbox"]').length;
    const score = total > 0 ? Math.round((selected / total) * 100) : 0;
    const display = document.getElementById('confluenceScoreDisplay');
    if (display) display.textContent = `${score}% selected (${selected} of ${total})`;
}

function getCustomConfluenceOptions() {
    try {
        const raw = localStorage.getItem('customConfluenceOptions');
        return raw ? JSON.parse(raw) : [];
    } catch (error) {
        console.warn('Unable to load custom confluence options:', error);
        return [];
    }
}

function saveCustomConfluenceOptions(options) {
    localStorage.setItem('customConfluenceOptions', JSON.stringify(options));
}

function getCurrentConfluenceOptions() {
    const deleted = getDeletedConfluenceOptions();
    const defaultOptions = DEFAULT_CONFLUENCE_OPTIONS.filter(option => !deleted.includes(option));
    const customOptions = getCustomConfluenceOptions();
    const options = [...defaultOptions, ...customOptions];
    if (!options.includes('Market Structure')) options.unshift('Market Structure');
    return options;
}

function renderConfluenceOptions() {
    const container = document.getElementById('confluenceOptions');
    if (!container) return;

    const currentlySelected = Array.from(container.querySelectorAll('input[type="checkbox"]:checked')).map(input => input.value);
    const options = getCurrentConfluenceOptions();
    container.innerHTML = '';

    options.forEach(option => {
        const optionLabel = document.createElement('label');
        optionLabel.className = 'confluence-option';
        optionLabel.dataset.option = option;

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = option;
        checkbox.checked = currentlySelected.includes(option);

        const text = document.createElement('span');
        text.className = 'confluence-option-text';
        text.textContent = option;

        optionLabel.appendChild(checkbox);
        optionLabel.appendChild(text);

        if (option !== 'Market Structure') {
            const removeButton = document.createElement('button');
            removeButton.type = 'button';
            removeButton.className = 'remove-confluence-option';
            removeButton.dataset.option = option;
            removeButton.title = 'Remove this option';
            removeButton.textContent = '✕';
            optionLabel.appendChild(removeButton);
        }

        container.appendChild(optionLabel);
    });
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
    const defaultMatch = DEFAULT_CONFLUENCE_OPTIONS.find(option => option.toLowerCase() === normalizedNewOption);
    if (defaultMatch) {
        const restored = deletedOptions.filter(option => option.toLowerCase() !== normalizedNewOption);
        saveDeletedConfluenceOptions(restored);
    } else {
        const customOptions = getCustomConfluenceOptions();
        customOptions.push(newOption);
        saveCustomConfluenceOptions(customOptions);
    }

    input.value = '';
    renderConfluenceOptions();

    const newCheckbox = Array.from(document.querySelectorAll('#confluenceOptions input[type="checkbox"]')).find(input => input.value === newOption);
    if (newCheckbox) newCheckbox.checked = true;
    updateConfluenceScoreDisplay();
    input.focus();
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

    const selectedList = trade.confluenceOptions.map(option => `<span class="inline-flex items-center rounded-full bg-blue-600/10 text-blue-200 px-2 py-1 text-xs font-medium mr-1 mb-1">${option}</span>`).join('');
    const scoreText = trade.confluenceScore != null ? `${trade.confluenceScore}%` : 'N/A';

    return `
        <div class="mt-3 p-3 bg-gray-800 rounded-lg border border-gray-700 text-sm text-gray-200">
            <div class="font-semibold text-white mb-2">Confluence</div>
            <div class="flex flex-wrap gap-1 mb-2">${selectedList}</div>
            <div class="text-xs text-gray-400">Confluence Score: ${scoreText}</div>
        </div>
    `;
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

        const pipDisplays = {
            'entryPipDisplay': `Entry: ${entryPrice}`,
            'slPipDisplay': stopLoss > 0 ? `SL: ${stopLoss} (${pipPointInfo.risk.toFixed(1)} ${unitType})` : 'SL: Not set',
            'tpPipDisplay': takeProfit ? `TP: ${takeProfit} (${pipPointInfo.reward.toFixed(1)} ${unitType})` : '',
            'exitPipDisplay': ''
        };

        Object.entries(pipDisplays).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) element.textContent = value;
        });
    } else {
        // Reset all displays when no valid data
        const resetElements = ['pipsRisk', 'totalRisk', 'riskPercentage', 'riskRewardRatio', 'recommendedLotSize'];
        resetElements.forEach(id => {
            const element = document.getElementById(id);
            if (element) element.textContent = id === 'recommendedLotSize' ? '0.00' : '0';
        });

        const pipDisplays = ['entryPipDisplay', 'slPipDisplay', 'tpPipDisplay', 'exitPipDisplay'];
        pipDisplays.forEach(id => {
            const element = document.getElementById(id);
            if (element) element.textContent = '';
        });
    }
}

// ========== PAGINATION FUNCTIONS ==========

function setupPagination(trades) {
    allTrades = trades;
    currentPage = 1;
    renderPagination();
    displayTradesPage(currentPage);
}

function displayTradesPage(page) {
    console.log('🔄 Displaying page:', page);
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
    
    console.log('📄 Rendering pagination:', { totalPages, currentPage, totalTrades: allTrades.length });
    
    if (!paginationContainer) {
        console.error('❌ Pagination container not found');
        return;
    }

    if (totalPages <= 1) {
        paginationContainer.innerHTML = '';
        return;
    }

    let paginationHTML = '';
    
    if (currentPage > 1) {
        paginationHTML += `<button type="button" class="pagination-btn pagination-prev" data-page="${currentPage - 1}">← Previous</button>`;
    } else {
        paginationHTML += `<button type="button" class="pagination-btn pagination-disabled" disabled>← Previous</button>`;
    }
    
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
    
    if (currentPage < totalPages) {
        paginationHTML += `<button type="button" class="pagination-btn pagination-next" data-page="${currentPage + 1}">Next →</button>`;
    } else {
        paginationHTML += `<button type="button" class="pagination-btn pagination-disabled" disabled>Next →</button>`;
    }
    
    paginationContainer.innerHTML = paginationHTML;
    attachPaginationEventListeners();
}

function attachPaginationEventListeners() {
    const paginationButtons = document.querySelectorAll('.pagination-btn');
    
    paginationButtons.forEach(button => {
        button.addEventListener('click', function() {
            if (this.disabled) return;
            
            const page = parseInt(this.getAttribute('data-page'));
            console.log('[PAGINATION] Pagination button clicked, going to page:', page);
            
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
                <p class="text-sm mt-2">Start by adding your first trade in the Dashboard tab!</p>
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
                        <div><strong>Risk:</strong> ${trade.stopLoss ? `${formatCurrency(trade.riskAmount)} (${trade.riskPercent.toFixed(1)}%)` : 'N/A'}</div>
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
                        <button onclick="viewScreenshot('${trade.beforeScreenshot}')" 
                                class="btn-sm bg-blue-500 text-white hover:bg-blue-600 transition-colors flex items-center gap-1">
                            <span><i class="fas fa-camera"></i></span> Before
                        </button>
                    ` : ''}
                    ${trade.afterScreenshot ? `
                        <button onclick="viewScreenshot('${trade.afterScreenshot}')" 
                                class="btn-sm bg-green-500 text-white hover:bg-green-600 transition-colors flex items-center gap-1">
                            <span><i class="fas fa-camera"></i></span> After
                        </button>
                    ` : ''}
                    <button onclick="deleteTrade('${trade.id}')" 
                            class="btn-sm bg-red-500 text-white hover:bg-red-600 transition-colors flex items-center gap-1">
                        <span>🗑️</span> Delete
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

window.displayTradesPage = displayTradesPage;

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
            lockToggle.innerHTML = '<i class="fas fa-lock"></i> Locked';
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
                await saveUserAccounts();
            }
            
            updateLockState();
            showSuccessMessage('Account balance locked! <i class="fas fa-lock"></i>');
            
            updateStats(allTrades);
            renderCharts(allTrades);
        }
    });
    
    accountSizeInput.addEventListener('blur', async () => {
        if (!isLocked && accountSizeInput.value && accountSizeInput.value !== '10000') {
            const currentAccount = getCurrentAccount();
            currentAccount.balance = parseFloat(accountSizeInput.value);
            await saveUserAccounts();
            updateStats(allTrades);
            renderCharts(allTrades);
        }
    });
    
    updateLockState();
    console.log('✅ Account balance lock setup complete');
}

// ========== USER SETTINGS ==========

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
    if (accountBalanceLabel) accountBalanceLabel.textContent = `Account Balance (${currencySymbol})`;
    
    const balanceStat = document.querySelector('.stat-card:nth-child(4) .text-xs');
    if (balanceStat) balanceStat.textContent = `Balance (${currencySymbol})`;
}

// ========== TAB MANAGEMENT ==========

function setupTabs() {
    const dashboardTab = document.getElementById('dashboardTab');
    const addTradeTab = document.getElementById('addTradeTab');
    const tradesTab = document.getElementById('tradesTab');
    const affirmationsTab = document.getElementById('affirmationsTab');
    const calendarTab = document.getElementById('calendarTab');
    const settingsTab = document.getElementById('settingsTab');
    const dashboardContent = document.getElementById('dashboardContent');
    const addTradeContent = document.getElementById('addTradeContent');
    const tradesContent = document.getElementById('tradesContent');
    const affirmationsContent = document.getElementById('affirmationsContent');
    const calendarContent = document.getElementById('calendarContent');
    const settingsContent = document.getElementById('settingsContent');

    [dashboardContent, addTradeContent, tradesContent, affirmationsContent, calendarContent, settingsContent].forEach(content => {
        if (content) {
            content.classList.remove('active');
            content.style.display = 'none';
        }
    });

    function switchToTab(tabName) {
        [dashboardContent, addTradeContent, tradesContent, affirmationsContent, calendarContent, settingsContent].forEach(content => {
            if (content) {
                content.classList.remove('active');
                content.style.display = 'none';
            }
        });

        [dashboardTab, addTradeTab, tradesTab, affirmationsTab, calendarTab, settingsTab].forEach(tab => {
            if (tab) tab.classList.remove('active');
        });

        switch(tabName) {
            case 'dashboard':
                if (dashboardContent) {
                    dashboardContent.classList.add('active');
                    dashboardContent.style.display = 'block';
                }
                if (dashboardTab) dashboardTab.classList.add('active');
                break;
            case 'addTrade':
                if (addTradeContent) {
                    addTradeContent.classList.add('active');
                    addTradeContent.style.display = 'block';
                }
                if (addTradeTab) addTradeTab.classList.add('active');
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
            case 'calendar':
                if (calendarContent) {
                    calendarContent.classList.add('active');
                    calendarContent.style.display = 'block';
                    renderCalendar();
                }
                if (calendarTab) calendarTab.classList.add('active');
                break;
            case 'settings':
                if (settingsContent) {
                    settingsContent.classList.add('active');
                    settingsContent.style.display = 'block';
                }
                if (settingsTab) settingsTab.classList.add('active');
                break;
        }
    }

    if (dashboardTab) dashboardTab.addEventListener('click', () => switchToTab('dashboard'));
    if (addTradeTab) addTradeTab.addEventListener('click', () => switchToTab('addTrade'));
    if (tradesTab) tradesTab.addEventListener('click', () => switchToTab('trades'));
    if (affirmationsTab) affirmationsTab.addEventListener('click', () => switchToTab('affirmations'));
    if (calendarTab) calendarTab.addEventListener('click', () => switchToTab('calendar'));
    if (settingsTab) settingsTab.addEventListener('click', () => switchToTab('settings'));
    
    switchToTab('dashboard');
    
    console.log('✅ Tabs setup complete');
}

// ========== MOBILE MENU ==========

function setupMobileMenu() {
    const mobileMenuButton = document.getElementById('mobileMenuButton');
    const mobileMenu = document.getElementById('mobileMenu');

    if (mobileMenuButton && mobileMenu) {
        mobileMenuButton.addEventListener('click', (e) => {
            e.stopPropagation();
            mobileMenu.classList.toggle('hidden');
            renderAccountsList();
            
            if (!mobileMenu.classList.contains('hidden')) {
                document.body.style.overflow = 'hidden';
            } else {
                document.body.style.overflow = 'auto';
            }
        });

        document.addEventListener('click', (e) => {
            if (!mobileMenu.contains(e.target) && !mobileMenuButton.contains(e.target)) {
                mobileMenu.classList.add('hidden');
                document.body.style.overflow = 'auto';
            }
        });

        mobileMenu.addEventListener('click', (e) => {
            if (e.target.tagName === 'BUTTON' || e.target.tagName === 'A') {
                if (!e.target.closest('#mobileAccountsList')) {
                    mobileMenu.classList.add('hidden');
                    document.body.style.overflow = 'auto';
                }
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !mobileMenu.classList.contains('hidden')) {
                mobileMenu.classList.add('hidden');
                document.body.style.overflow = 'auto';
            }
        });
    }
    
    console.log('✅ Mobile menu setup complete');
}

function setupSidebarCollapse() {
    const sidebar = document.getElementById('sidebar');
    const toggle = document.getElementById('sidebarToggle');
    if (!sidebar || !toggle) {
        console.warn('⚠️ Sidebar or toggle button not found');
        return;
    }

    const storedCollapsed = localStorage.getItem('sidebarCollapsed');
    if (storedCollapsed === 'true') {
        document.body.classList.add('sidebar-collapsed');
    }

    function updateToggleIcon() {
        const icon = toggle.querySelector('i');
        if (!icon) return;
        
        const isCollapsed = document.body.classList.contains('sidebar-collapsed');
        
        if (isCollapsed) {
            icon.classList.remove('fa-angle-double-left');
            icon.classList.add('fa-angle-double-right');
            toggle.setAttribute('aria-label', 'Expand sidebar');
            toggle.setAttribute('title', 'Expand sidebar');
        } else {
            icon.classList.remove('fa-angle-double-right');
            icon.classList.add('fa-angle-double-left');
            toggle.setAttribute('aria-label', 'Collapse sidebar');
            toggle.setAttribute('title', 'Collapse sidebar');
        }
    }

    updateToggleIcon();

    const newToggle = toggle.cloneNode(true);
    toggle.parentNode.replaceChild(newToggle, toggle);
    
    newToggle.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const isCollapsed = document.body.classList.contains('sidebar-collapsed');
        
        if (isCollapsed) {
            document.body.classList.remove('sidebar-collapsed');
            localStorage.setItem('sidebarCollapsed', 'false');
        } else {
            document.body.classList.add('sidebar-collapsed');
            localStorage.setItem('sidebarCollapsed', 'true');
        }
        
        updateToggleIcon();
        
        window.dispatchEvent(new CustomEvent('sidebarToggled', { 
            detail: { collapsed: !isCollapsed } 
        }));
        
        console.log('📂 Sidebar collapsed:', !isCollapsed);
    });

    document.querySelectorAll('#sidebar .sidebar-btn').forEach(btn => {
        const label = btn.querySelector('.label');
        if (label && !btn.hasAttribute('title')) {
            btn.setAttribute('title', label.textContent.trim());
        }
    });
    
    console.log('✅ Sidebar collapse setup complete - Initial state:', storedCollapsed === 'true' ? 'collapsed' : 'expanded');
}

// ========== AFFIRMATIONS FUNCTIONS ==========

function setupAffirmationsEventListeners() {
    const affirmationForm = document.getElementById('affirmationForm');
    if (affirmationForm) affirmationForm.addEventListener('submit', handleAffirmationSubmit);

    const affirmationText = document.getElementById('affirmationText');
    if (affirmationText) affirmationText.addEventListener('input', updateCharCount);

    const categoryFilters = document.querySelectorAll('.category-filter');
    categoryFilters.forEach(filter => filter.addEventListener('click', handleCategoryFilter));

    const searchInput = document.getElementById('searchAffirmations');
    if (searchInput) searchInput.addEventListener('input', handleSearchAffirmations);

    const sortSelect = document.getElementById('sortAffirmations');
    if (sortSelect) sortSelect.addEventListener('change', handleSortAffirmations);
}

async function loadAffirmations() {
    try {
        if (!currentUser) return;

        console.log('📖 Loading affirmations...');
        const q = query(collection(db, 'affirmations'), where('userId', '==', currentUser.uid));
        const querySnapshot = await getDocs(q);
        
        const affirmations = [];
        querySnapshot.forEach((doc) => affirmations.push({ id: doc.id, ...doc.data() }));

        if (affirmations.length === 0) {
            console.log('[AFFIRMATIONS] No affirmations found, creating sample data...');
            for (const sampleAffirmation of sampleAffirmations) {
                const affirmationData = { ...sampleAffirmation, userId: currentUser.uid };
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
        console.error('❌ Error loading affirmations:', error);
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
                        <i class="fas fa-copy"></i> Copy
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
        'confidence': 'green', 'discipline': 'purple', 'patience': 'yellow',
        'risk-management': 'red', 'mindset': 'indigo', 'general': 'blue'
    };
    return colors[category] || 'blue';
}

function getCategoryDisplayName(category) {
    const names = {
        'confidence': 'Confidence', 'discipline': 'Discipline', 'patience': 'Patience',
        'risk-management': 'Risk Management', 'mindset': 'Mindset', 'general': 'General'
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
        text, category, isFavorite, isActive,
        usageCount: 0, lastUsed: null,
        createdAt: new Date().toISOString(),
        strength: Math.floor(Math.random() * 20) + 80,
        userId: currentUser.uid
    };
    
    try {
        if (editingAffirmationId) {
            const affirmationRef = doc(db, 'affirmations', editingAffirmationId);
            await updateDoc(affirmationRef, affirmationData);
            
            const index = allAffirmations.findIndex(a => a.id === editingAffirmationId);
            if (index !== -1) allAffirmations[index] = { ...allAffirmations[index], ...affirmationData };
        } else {
            const docRef = await addDoc(collection(db, 'affirmations'), affirmationData);
            const newAffirmation = { id: docRef.id, ...affirmationData };
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

window.useAffirmation = async (id) => {
    try {
        const affirmation = allAffirmations.find(a => a.id === id);
        if (affirmation) {
            const updatedData = {
                usageCount: affirmation.usageCount + 1,
                lastUsed: new Date().toISOString()
            };
            
            const affirmationRef = doc(db, 'affirmations', id);
            await updateDoc(affirmationRef, updatedData);
            
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
            .then(() => showSuccessMessage('Affirmation copied to clipboard! <i class="fas fa-copy"></i>'))
            .catch(() => alert('Failed to copy affirmation.'));
    }
};

window.toggleFavorite = async (id) => {
    try {
        const affirmation = allAffirmations.find(a => a.id === id);
        if (affirmation) {
            const updatedData = { isFavorite: !affirmation.isFavorite };
            const affirmationRef = doc(db, 'affirmations', id);
            await updateDoc(affirmationRef, updatedData);
            affirmation.isFavorite = updatedData.isFavorite;
            renderAffirmationsGrid();
        }
    } catch (error) {
        console.error('Error updating favorite:', error);
        alert('Error updating favorite.');
    }
};

window.deleteAffirmation = async (id) => {
    if (confirm('Are you sure you want to delete this affirmation?')) {
        try {
            await deleteDoc(doc(db, 'affirmations', id));
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
            
            const affirmationRef = doc(db, 'affirmations', randomAffirmation.id);
            await updateDoc(affirmationRef, updatedData);
            
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
            
            const affirmationRef = doc(db, 'affirmations', affirmation.id);
            await updateDoc(affirmationRef, updatedData);
            
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

window.showMotivationalQuote = () => {
    const randomQuote = motivationalQuotes[Math.floor(Math.random() * motivationalQuotes.length)];
    alert(`Motivational Quote:\n\n"${randomQuote}"`);
};

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
    showSuccessMessage('Affirmations exported successfully! <i class="fas fa-upload"></i>');
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

function handleCategoryFilter(e) {
    const category = e.target.dataset.category;
    
    document.querySelectorAll('.category-filter').forEach(btn => btn.classList.remove('active'));
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
    const filteredAffirmations = allAffirmations.filter(a => a.text.toLowerCase().includes(searchTerm));
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

// ========== IMPORT/EXPORT FUNCTIONS ==========

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
                    if (index !== -1 && values[index] !== undefined) return values[index];
                }
                return '';
            };

            const symbol = getValue(['Symbol', 'symbol']);
            const entryPrice = parseFloat(getValue(['Entry', 'entryPrice', 'Entry Price']));
            const stopLoss = parseFloat(getValue(['SL', 'stopLoss', 'Stop Loss']));
            const takeProfit = getValue(['TP', 'takeProfit', 'Take Profit']) ? parseFloat(getValue(['TP', 'takeProfit', 'Take Profit'])) : null;
            const exitPrice = getValue(['Exit Price', 'exitPrice', 'ExitPrice']) ? parseFloat(getValue(['Exit Price', 'exitPrice', 'ExitPrice'])) : null;
            const lotSize = parseFloat(getValue(['Lots', 'lotSize', 'Lot Size']) || '0.01');
            const tradeType = getValue(['Type', 'type']) || 'long';
            const instrumentType = getValue(['InstrumentType', 'instrumentType']) || getInstrumentType(symbol);
            
            let profit = parseFloat(getValue(['Profit', 'profit']) || '0');
            
            if (profit === 0 && symbol && entryPrice) {
                // Use exitPrice if provided, otherwise takeProfit, otherwise entryPrice
                const actualExitPrice = exitPrice || takeProfit || entryPrice;
                profit = calculateProfitLoss(entryPrice, actualExitPrice, lotSize, symbol, tradeType);
            }
            
            const currentAccount = getCurrentAccount();
            
            const trade = {
                symbol, type: tradeType, instrumentType, entryPrice, stopLoss, takeProfit, exitPrice, lotSize,
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
    return values.map(value => {
        const trimmed = value.trim();
        if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
            return trimmed.slice(1, -1).replace(/""/g, '"');
        }
        return trimmed;
    });
}

async function importTradesToFirestore(trades) {
    const importPromises = trades.map(async (trade) => {
        if (trade.symbol && trade.entryPrice && trade.stopLoss) {
            if (trade.profit === 0 && trade.takeProfit) {
                trade.profit = calculateProfitLoss(trade.entryPrice, trade.takeProfit, trade.lotSize, trade.symbol, trade.type);
            }
            
            trade.riskAmount = Math.abs(calculateProfitLoss(trade.entryPrice, trade.stopLoss, trade.lotSize, trade.symbol, trade.type));
            trade.riskPercent = (trade.riskAmount / trade.accountSize) * 100;
            
            const pipPointInfo = calculatePipsPoints(trade.entryPrice, trade.stopLoss, trade.takeProfit, trade.symbol, trade.type);
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
        'Notes', 'AccountSize', 'Leverage', 'Timestamp', 'AccountId', 'MTTicket'
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
            trade.accountId || '',
            trade.mtTicket || ''
        ];
        csvRows.push(row.join(','));
    });
    
    return csvRows.join('\n');
}

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

// ========== METATRADER 4/5 IMPORT FUNCTIONS ==========

async function loadExistingTicketNumbers() {
    try {
        if (!currentUser) return;
        
        const q = query(
            collection(db, 'trades'),
            where('userId', '==', currentUser.uid),
            where('accountId', '==', currentAccountId)
        );
        const querySnapshot = await getDocs(q);
        
        existingTicketNumbers.clear();
        querySnapshot.forEach((doc) => {
            const trade = doc.data();
            if (trade.mtTicket) existingTicketNumbers.add(trade.mtTicket);
        });
        
        console.log('[MT IMPORT] Loaded', existingTicketNumbers.size, 'existing ticket numbers');
    } catch (error) {
        console.error('[MT IMPORT] Error loading existing tickets:', error);
    }
}

function parseCSVLineWithDelimiter(line, delimiter) {
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
        } else if (char === delimiter && !inQuotes) {
            values.push(current);
            current = '';
        } else {
            current += char;
        }
    }

    values.push(current);
    return values.map(value => {
        const trimmed = value.trim();
        if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
            return trimmed.slice(1, -1).replace(/""/g, '"');
        }
        return trimmed;
    });
}

function parseMetaTraderCSV(csvText) {
    const lines = csvText.split('\n').filter(line => line.trim());
    if (lines.length < 2) return [];
    
    const firstLine = lines[0];
    const delimiter = firstLine.includes('\t') ? '\t' : ',';
    
    const headers = firstLine.split(delimiter).map(h => h.trim().replace(/"/g, ''));
    console.log('[MT IMPORT] Headers detected:', headers);
    
    const trades = [];
    
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const values = parseCSVLineWithDelimiter(line, delimiter);
        if (values.length < headers.length) continue;
        
        try {
            const getValue = (possibleNames) => {
                for (const name of possibleNames) {
                    const index = headers.findIndex(h => h === name);
                    if (index !== -1 && values[index] !== undefined) {
                        return values[index].replace(/"/g, '').trim();
                    }
                }
                return '';
            };
            
            const ticket = getValue(['Ticket', 'ticket', 'Order', 'order']);
            const openTime = getValue(['Open Time', 'openTime', 'OpenTime', 'Time']);
            const type = getValue(['Type', 'type', 'Action']).toLowerCase();
            const size = getValue(['Size', 'size', 'Volume', 'volume', 'Lots', 'lots']);
            const item = getValue(['Item', 'item', 'Symbol', 'symbol', 'Instrument']);
            const openPrice = getValue(['Open Price', 'openPrice', 'Open', 'Price']);
            const sl = getValue(['S/L', 'SL', 'Stop Loss', 'stopLoss', 'StopLoss']);
            const tp = getValue(['T/P', 'TP', 'Take Profit', 'takeProfit', 'TakeProfit']);
            const closeTime = getValue(['Close Time', 'closeTime', 'CloseTime']);
            const closePrice = getValue(['Close Price', 'closePrice', 'Close']);
            const commission = getValue(['Commission', 'commission', 'Commis']);
            const swap = getValue(['Swap', 'swap', 'Storage']);
            const profit = getValue(['Profit', 'profit', 'P/L']);
            const comment = getValue(['Comment', 'comment', 'Note']);
            
            if (!ticket) continue;
            
            const openTimeParsed = parseMTDateTime(openTime);
            const closeTimeParsed = parseMTDateTime(closeTime);
            
            if (!openTimeParsed || !closeTimeParsed) {
                console.warn('[MT IMPORT] Skipping trade due to invalid date:', ticket);
                continue;
            }
            
            const mappedSymbol = mapMTSymbol(item);
            const tradeType = type.includes('buy') ? 'long' : 'short';
            
            let finalProfit = parseFloat(profit) || 0;
            
            if (mtImportSettings.useMTProfit) {
                if (mtImportSettings.includeCommission) finalProfit += parseFloat(commission) || 0;
                if (mtImportSettings.includeSwap) finalProfit += parseFloat(swap) || 0;
            } else {
                const exitPrice = parseFloat(closePrice) || 0;
                const entryPriceVal = parseFloat(openPrice) || 0;
                const lotSizeVal = parseFloat(size) || 0.01;
                if (exitPrice > 0 && entryPriceVal > 0) {
                    finalProfit = calculateProfitLoss(entryPriceVal, exitPrice, lotSizeVal, mappedSymbol, tradeType);
                }
            }
            
            const trade = {
                mtTicket: ticket,
                symbol: mappedSymbol,
                type: tradeType,
                instrumentType: getInstrumentType(mappedSymbol),
                entryPrice: parseFloat(openPrice) || 0,
                stopLoss: parseFloat(sl) || 0,
                takeProfit: parseFloat(tp) || null,
                lotSize: parseFloat(size) || 0.01,
                closePrice: parseFloat(closePrice) || 0,
                profit: finalProfit,
                commission: parseFloat(commission) || 0,
                swap: parseFloat(swap) || 0,
                openTime: openTimeParsed,
                closeTime: closeTimeParsed,
                comment: comment || '',
                mood: mtImportSettings.defaultMood,
                beforeScreenshot: '',
                afterScreenshot: '',
                notes: mtImportSettings.autoAddNotes ? `[Imported from MT4/5] ${comment || ''}` : (comment || '')
            };
            
            if (trade.entryPrice > 0 && trade.stopLoss > 0) {
                trade.riskAmount = Math.abs(calculateProfitLoss(
                    trade.entryPrice, trade.stopLoss, trade.lotSize, trade.symbol, trade.type
                ));
                
                const currentAccount = getCurrentAccount();
                trade.riskPercent = (trade.riskAmount / currentAccount.balance) * 100;
                
                const pipPointInfo = calculatePipsPoints(
                    trade.entryPrice, trade.stopLoss, trade.takeProfit, trade.symbol, trade.type
                );
                trade.pipsPoints = pipPointInfo.risk;
            } else {
                trade.riskAmount = Math.abs(trade.profit);
                trade.riskPercent = (trade.riskAmount / getCurrentAccount().balance) * 100;
                trade.pipsPoints = 0;
            }
            
            if (trade.symbol && !isNaN(trade.entryPrice) && trade.entryPrice > 0) {
                trades.push(trade);
            }
            
        } catch (error) {
            console.warn('[MT IMPORT] Error parsing row:', error, line);
        }
    }
    
    return trades;
}

window.importMetaTraderTrades = () => {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.csv,text/csv,text/plain';
    
    fileInput.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        try {
            showLoading();
            
            await loadExistingTicketNumbers();
            
            const text = await file.text();
            const trades = parseMetaTraderCSV(text);
            
            if (trades.length === 0) {
                alert('No valid closed trades found in the MetaTrader export file.\n\nPlease ensure:\n• The file contains closed trades\n• The CSV format is correct\n• Trades have both Open and Close times');
                hideLoading();
                return;
            }
            
            const newTrades = [];
            const duplicates = [];
            
            trades.forEach(trade => {
                if (existingTicketNumbers.has(trade.mtTicket)) {
                    duplicates.push(trade);
                } else {
                    newTrades.push(trade);
                }
            });
            
            pendingMTTrades = newTrades;
            
            showMTImportPreview(newTrades, duplicates, trades.length);
            
        } catch (error) {
            console.error('[MT IMPORT] Error:', error);
            alert('Error parsing MetaTrader file: ' + error.message);
        } finally {
            hideLoading();
        }
    };
    
    fileInput.click();
};
// ========== COMPLETE MT4/5 IMPORT FUNCTIONS ==========

// Optional: Add preview refresh when settings change
function refreshMTImportPreview() {
    if (pendingMTTrades.length > 0) {
        // Recalculate profits based on current settings
        pendingMTTrades.forEach(trade => {
            if (!mtImportSettings.useMTProfit && trade.entryPrice && trade.closePrice) {
                trade.profit = calculateProfitLoss(
                    trade.entryPrice, 
                    trade.closePrice, 
                    trade.lotSize, 
                    trade.symbol, 
                    trade.type
                );
            }
        });
        // Refresh the preview modal if open
        const modal = document.getElementById('mtImportModal');
        if (modal && !modal.classList.contains('hidden')) {
            showMTImportPreview(pendingMTTrades, [], pendingMTTrades.length);
        }
    }
}

function showMTImportPreview(newTrades, duplicates, totalTrades) {
    const modal = document.getElementById('mtImportModal');
    const summaryEl = document.getElementById('mtImportSummary');
    const previewBody = document.getElementById('mtImportPreviewBody');
    const duplicatesWarning = document.getElementById('mtDuplicatesWarning');
    const duplicatesMessage = document.getElementById('mtDuplicatesMessage');
    const statsEl = document.getElementById('mtImportStats');
    const confirmBtn = document.getElementById('mtImportConfirmBtn');
    
    if (!modal) return;
    
    const totalProfit = newTrades.reduce((sum, t) => sum + t.profit, 0);
    const winningTrades = newTrades.filter(t => t.profit > 0).length;
    const losingTrades = newTrades.filter(t => t.profit < 0).length;
    
    summaryEl.innerHTML = `
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
                <div class="text-sm text-gray-500">Total Trades</div>
                <div class="text-2xl font-bold">${newTrades.length}</div>
            </div>
            <div>
                <div class="text-sm text-gray-500">Winning</div>
                <div class="text-2xl font-bold text-green-600">${winningTrades}</div>
            </div>
            <div>
                <div class="text-sm text-gray-500">Losing</div>
                <div class="text-2xl font-bold text-red-600">${losingTrades}</div>
            </div>
            <div>
                <div class="text-sm text-gray-500">Total P/L</div>
                <div class="text-2xl font-bold ${totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}">
                    ${formatCurrency(totalProfit)}
                </div>
            </div>
        </div>
        <div class="mt-4 p-3 bg-purple-50 rounded-lg border border-purple-200">
            <div class="flex flex-wrap gap-4 text-sm">
                <label class="flex items-center">
                    <input type="checkbox" id="mtUseMTProfit" ${mtImportSettings.useMTProfit ? 'checked' : ''}>
                    <span class="ml-2">Use MetaTrader's profit calculation</span>
                </label>
                <label class="flex items-center">
                    <input type="checkbox" id="mtIncludeCommission" ${mtImportSettings.includeCommission ? 'checked' : ''}>
                    <span class="ml-2">Include commission in profit</span>
                </label>
                <label class="flex items-center">
                    <input type="checkbox" id="mtIncludeSwap" ${mtImportSettings.includeSwap ? 'checked' : ''}>
                    <span class="ml-2">Include swap in profit</span>
                </label>
                <label class="flex items-center">
                    <input type="checkbox" id="mtAutoAddNotes" ${mtImportSettings.autoAddNotes ? 'checked' : ''}>
                    <span class="ml-2">Add "Imported from MT4/5" to notes</span>
                </label>
            </div>
        </div>
    `;
    
    const mtUseMTProfitEl = document.getElementById('mtUseMTProfit');
    const mtIncludeCommissionEl = document.getElementById('mtIncludeCommission');
    const mtIncludeSwapEl = document.getElementById('mtIncludeSwap');
    const mtAutoAddNotesEl = document.getElementById('mtAutoAddNotes');

    if (mtUseMTProfitEl) {
        mtUseMTProfitEl.onchange = (e) => {
            mtImportSettings.useMTProfit = e.target.checked;
            recalculateMTPendingTrades();
            showMTImportPreview(pendingMTTrades, duplicates, totalTrades);
        };
    }

    if (mtIncludeCommissionEl) {
        mtIncludeCommissionEl.onchange = (e) => {
            mtImportSettings.includeCommission = e.target.checked;
            recalculateMTPendingTrades();
            showMTImportPreview(pendingMTTrades, duplicates, totalTrades);
        };
    }

    if (mtIncludeSwapEl) {
        mtIncludeSwapEl.onchange = (e) => {
            mtImportSettings.includeSwap = e.target.checked;
            recalculateMTPendingTrades();
            showMTImportPreview(pendingMTTrades, duplicates, totalTrades);
        };
    }

    if (mtAutoAddNotesEl) {
        mtAutoAddNotesEl.onchange = (e) => {
            mtImportSettings.autoAddNotes = e.target.checked;
            pendingMTTrades.forEach(trade => {
                trade.notes = mtImportSettings.autoAddNotes ? `[Imported from MT4/5] ${trade.comment || ''}` : (trade.comment || '');
            });
            showMTImportPreview(pendingMTTrades, duplicates, totalTrades);
        };
    }
    
    if (duplicates.length > 0) {
        duplicatesWarning.classList.remove('hidden');
        duplicatesMessage.textContent = `${duplicates.length} duplicate trade(s) detected and will be skipped.`;
    } else {
        duplicatesWarning.classList.add('hidden');
    }
    
    const previewTrades = newTrades.slice(0, 20);
    previewBody.innerHTML = previewTrades.map(trade => `
        <tr>
            <td class="px-4 py-2 text-sm text-gray-900">${trade.mtTicket}</td>
            <td class="px-4 py-2 text-sm text-gray-900">${trade.symbol}</td>
            <td class="px-4 py-2 text-sm">
                <span class="${trade.type === 'long' ? 'text-green-600' : 'text-red-600'} font-semibold">
                    ${trade.type.toUpperCase()}
                </span>
            </td>
            <td class="px-4 py-2 text-sm text-gray-900">${trade.lotSize}</td>
            <td class="px-4 py-2 text-sm text-gray-900">${trade.entryPrice}</td>
            <td class="px-4 py-2 text-sm text-gray-900">${trade.closePrice}</td>
            <td class="px-4 py-2 text-sm">
                <span class="${trade.profit >= 0 ? 'text-green-600' : 'text-red-600'} font-semibold">
                    ${formatCurrency(trade.profit)}
                </span>
            </td>
            <td class="px-4 py-2 text-sm">
                <span class="text-green-600 bg-green-100 px-2 py-1 rounded-full text-xs font-semibold">
                    Ready
                </span>
            </td>
        </tr>
    `).join('');
    
    if (newTrades.length > 20) {
        previewBody.innerHTML += `
            <tr>
                <td colspan="8" class="px-4 py-3 text-center text-gray-500 text-sm">
                    ... and ${newTrades.length - 20} more trades
                </td>
            </tr>
        `;
    }
    
    statsEl.textContent = `${newTrades.length} trade(s) ready to import (${duplicates.length} duplicate(s) skipped)`;
    
    confirmBtn.disabled = newTrades.length === 0;
    
    modal.classList.remove('hidden');
}

function recalculateMTPendingTrades() {
    pendingMTTrades.forEach(trade => {
        let finalProfit = trade.profit;
        
        if (!mtImportSettings.useMTProfit) {
            const exitPrice = trade.closePrice || 0;
            const entryPrice = trade.entryPrice || 0;
            if (exitPrice > 0 && entryPrice > 0) {
                finalProfit = calculateProfitLoss(entryPrice, exitPrice, trade.lotSize, trade.symbol, trade.type);
            }
        } else {
            finalProfit = trade.profit;
            if (mtImportSettings.includeCommission) finalProfit += trade.commission;
            if (mtImportSettings.includeSwap) finalProfit += trade.swap;
        }
        
        trade.profit = finalProfit;
    });
}

window.closeMTImportModal = () => {
    document.getElementById('mtImportModal').classList.add('hidden');
    pendingMTTrades = [];
    importErrors = [];
};

window.confirmMTImport = async () => {
    if (pendingMTTrades.length === 0) {
        closeMTImportModal();
        return;
    }
    
    const confirmBtn = document.getElementById('mtImportConfirmBtn');
    const originalText = confirmBtn.innerHTML;
    confirmBtn.innerHTML = '<div class="loading-spinner"></div> Importing...';
    confirmBtn.disabled = true;
    
    importErrors = [];
    
    try {
        const currentAccount = getCurrentAccount();
        const leverage = parseInt(localStorage.getItem('leverage') || '50');
        
        let imported = 0;
        let failed = 0;
        const total = pendingMTTrades.length;
        
        for (const trade of pendingMTTrades) {
            try {
                const tradeData = {
                    symbol: trade.symbol,
                    type: trade.type,
                    instrumentType: trade.instrumentType,
                    entryPrice: trade.entryPrice,
                    stopLoss: trade.stopLoss,
                    takeProfit: trade.takeProfit,
                    lotSize: trade.lotSize,
                    mood: trade.mood,
                    beforeScreenshot: trade.beforeScreenshot,
                    afterScreenshot: trade.afterScreenshot,
                    notes: trade.notes,
                    confluenceOptions: [],
                    confluenceScore: 0,
                    timestamp: trade.openTime,
                    profit: trade.profit,
                    pipsPoints: trade.pipsPoints || 0,
                    riskAmount: trade.riskAmount || 0,
                    riskPercent: trade.riskPercent || 0,
                    accountSize: currentAccount.balance,
                    leverage: leverage,
                    userId: currentUser.uid,
                    accountId: currentAccountId,
                    mtTicket: trade.mtTicket,
                    mtCommission: trade.commission,
                    mtSwap: trade.swap,
                    mtCloseTime: trade.closeTime
                };
                
                await addDoc(collection(db, 'trades'), tradeData);
                imported++;
                
                if (imported % 10 === 0) {
                    confirmBtn.innerHTML = `<div class="loading-spinner"></div> Importing ${imported}/${total}...`;
                }
                
            } catch (error) {
                console.error('[MT IMPORT] Error importing trade:', trade.mtTicket, error);
                failed++;
                importErrors.push({
                    ticket: trade.mtTicket,
                    symbol: trade.symbol,
                    error: error.message
                });
            }
        }
        
        await loadTrades();
        
        let message = `✅ Successfully imported ${imported} MetaTrader trade(s)!`;
        if (failed > 0) {
            message += `\n❌ ${failed} trade(s) failed to import.`;
            console.error('[MT IMPORT] Failed trades:', importErrors);
        }
        showSuccessMessage(message);
        
        closeMTImportModal();
        
    } catch (error) {
        console.error('[MT IMPORT] Import error:', error);
        alert('Error importing trades: ' + error.message);
    } finally {
        confirmBtn.innerHTML = originalText;
        confirmBtn.disabled = false;
    }
};

document.addEventListener('click', (e) => {
    const modal = document.getElementById('mtImportModal');
    if (modal && e.target === modal) {
        closeMTImportModal();
    }
});

// ========== SCREENSHOT FUNCTIONS ==========

async function uploadScreenshot(file, type) {
    if (!file) return null;
    
    try {
        updateUploadStatus(type, 'Uploading image...', 'uploading');
        
        // Create a unique filename
        const timestamp = Date.now();
        const fileName = `${type}_screenshot_${timestamp}_${file.name}`;
        const storageRef = ref(storage, `screenshots/${currentUser.uid}/${fileName}`);
        
        // Upload the file
        const snapshot = await uploadBytes(storageRef, file);
        console.log('Uploaded screenshot:', snapshot.ref.fullPath);
        
        // Get the download URL
        const downloadURL = await getDownloadURL(snapshot.ref);
        console.log('Download URL:', downloadURL);
        
        updateUploadStatus(type, 'Image uploaded successfully!', 'success');
        return downloadURL;
        
    } catch (error) {
        console.error('Error uploading screenshot:', error);
        updateUploadStatus(type, 'Upload failed. Please try again.', 'error');
        return null;
    }
}

function updateUploadStatus(type, message, typeClass = '') {
    const statusElement = document.getElementById(`${type}UploadStatus`);
    if (statusElement) {
        statusElement.textContent = message;
        statusElement.className = `upload-status ${typeClass}`;
        if (message) statusElement.style.display = 'block';
    }
}

window.toggleScreenshotInput = (type, inputType) => {
    const urlInput = document.getElementById(`${type}ScreenshotUrl`);
    const fileInput = document.getElementById(`${type}ScreenshotFile`);
    const urlBtn = document.querySelector(`[onclick="toggleScreenshotInput('${type}', 'url')"]`);
    const fileBtn = document.querySelector(`[onclick="toggleScreenshotInput('${type}', 'file')"]`);
    
    if (inputType === 'url') {
        if (urlInput) urlInput.style.display = 'block';
        if (fileInput) fileInput.style.display = 'none';
        if (urlBtn) urlBtn.classList.add('active');
        if (fileBtn) fileBtn.classList.remove('active');
        if (fileInput) fileInput.value = '';
        updateUploadStatus(type, '');
    } else {
        if (urlInput) urlInput.style.display = 'none';
        if (fileInput) fileInput.style.display = 'block';
        if (urlBtn) urlBtn.classList.remove('active');
        if (fileBtn) fileBtn.classList.add('active');
        if (urlInput) urlInput.value = '';
        updateUploadStatus(type, '');
    }
};

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
        
        image.onload = function() {
            console.log('Screenshot loaded successfully:', cleanedUrl);
            image.alt = 'Trade Screenshot';
        };
        
        image.onerror = function() {
            console.error('Failed to load screenshot:', cleanedUrl);
            image.alt = 'Failed to load screenshot. Please check the URL.';
        };
        
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

// ========== ANALYTICS AND STATS FUNCTIONS ==========

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
        const currentBalance = getCurrentBalance();

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

    renderConfluenceChart(trades);
}

function renderConfluenceChart(trades = []) {
    const ctx = document.getElementById('confluenceChart');
    if (!ctx) return;

    if (confluenceChart) confluenceChart.destroy();

    const scoreBuckets = [
        { label: '0-20%', max: 20 },
        { label: '21-40%', max: 40 },
        { label: '41-60%', max: 60 },
        { label: '61-80%', max: 80 },
        { label: '81-100%', max: 100 }
    ];

    const bucketCounts = scoreBuckets.map(bucket => 0);
    const missingCount = trades.filter(t => typeof t.confluenceScore !== 'number').length;

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
                tooltip: { callbacks: { label: function(context) { return `${context.parsed.y} trades`; } } }
            },
            scales: {
                x: { grid: { display: false } },
                y: { beginAtZero: true, ticks: { precision: 0 } }
            }
        }
    });
}

function getMoodEmoji(mood) {
    const moodMap = {
        'confident': '😊', 'neutral': '😐', 'anxious': '😰', 'greedy': '😈',
        'fearful': '😨', 'disciplined': '📋', 'impulsive': '⚡'
    };
    return moodMap[mood] || mood;
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

    const selectedCurrency = getSelectedCurrency();
    const currencySymbol = getCurrencySymbol();

    if (trades.length === 0) {
        performanceChart = new Chart(ctx, {
            type: 'line',
            data: { labels: [], datasets: [{ label: 'Balance', data: [], borderColor: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.1)', fill: true }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
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
        const dateLabel = tradeDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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
                            const idx = context.dataIndex;
                            const balanceStr = `Balance: ${currencySymbol}${context.parsed.y.toFixed(2)}`;
                            if (idx === 0) return balanceStr + ' (Start)';
                            const trade = sortedTrades[idx - 1];
                            if (!trade) return balanceStr;
                            const pl = trade.profit || 0;
                            const sign = pl > 0 ? '+' : '';
                            const plStr = `P/L: ${sign}${currencySymbol}${pl.toFixed(2)}`;
                            return `${balanceStr} — ${plStr}`;
                        }
                    }
                }
            },
            scales: {
                x: { display: true, title: { display: true, text: 'Date' } },
                y: { display: true, title: { display: true, text: `Balance (${currencySymbol})` } }
            },
            onClick: (evt, elements) => {
                if (!elements || elements.length === 0) return;
                const el = elements[0];
                const idx = el.index;
                if (idx === 0) {
                    alert(`Starting balance: ${currencySymbol}${balanceData[0].toFixed(2)}`);
                    return;
                }
                const trade = sortedTrades[idx - 1];
                if (!trade) return;
                const pl = trade.profit || 0;
                const sign = pl > 0 ? '+' : '';
                const date = new Date(trade.timestamp).toLocaleString();
                const symbol = trade.symbol || 'N/A';
                const msg = `Trade: ${symbol}\nDate: ${date}\nP/L: ${sign}${currencySymbol}${pl.toFixed(2)}`;
                alert(msg);
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

    if (labels.length === 0) { labels.push('No Trades'); data.push(1); colors.push('#9ca3af'); }

    marketTypeChart = new Chart(ctx, {
        type: 'pie',
        data: { labels: labels, datasets: [{ data: data, backgroundColor: colors, borderWidth: 2, borderColor: '#ffffff' }] },
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

// ========== AI SUGGESTION SYSTEM ==========

// AI Analysis configuration
const aiConfig = {
    riskThresholds: {
        low: 0.5,
        optimal: 1.0,
        high: 2.0,
        dangerous: 3.0
    },
    winRateThresholds: {
        poor: 30,
        belowAverage: 40,
        average: 50,
        good: 60,
        excellent: 70
    },
    profitFactorThresholds: {
        poor: 0.8,
        breakEven: 1.0,
        good: 1.5,
        excellent: 2.0
    },
    consistencyThresholds: {
        poor: 30,
        average: 50,
        good: 70
    }
};

// Main AI analysis function
function generateAISuggestions() {
    const trades = allTrades;
    
    if (!trades || trades.length === 0) {
        showEmptyAISuggestions();
        return;
    }
    
    // Calculate all metrics
    const metrics = calculateAllMetrics(trades);
    const currentAccount = getCurrentAccount();
    
    // Generate insights
    const primaryInsight = generatePrimaryInsight(metrics, trades);
    const riskInsight = generateRiskInsight(metrics, currentAccount);
    const trendInsight = generateTrendInsight(metrics, trades);
    const recommendations = generateRecommendations(metrics, trades);
    
    // Update UI
    updateAISuggestionsUI(primaryInsight, riskInsight, trendInsight, recommendations, metrics);
}

// Calculate comprehensive metrics
function calculateAllMetrics(trades) {
    const winningTrades = trades.filter(t => t.profit > 0);
    const losingTrades = trades.filter(t => t.profit < 0);
    const breakevenTrades = trades.filter(t => t.profit === 0);
    
    const totalTrades = trades.length;
    const winRate = totalTrades > 0 ? (winningTrades.length / totalTrades) * 100 : 0;
    const lossRate = totalTrades > 0 ? (losingTrades.length / totalTrades) * 100 : 0;
    
    const totalProfit = winningTrades.reduce((sum, t) => sum + t.profit, 0);
    const totalLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.profit, 0));
    const netProfit = totalProfit - totalLoss;
    
    const avgWin = winningTrades.length > 0 ? totalProfit / winningTrades.length : 0;
    const avgLoss = losingTrades.length > 0 ? totalLoss / losingTrades.length : 0;
    
    const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : (totalProfit > 0 ? 999 : 0);
    
    const riskRewardTrades = trades.filter(t => t.takeProfit && t.riskAmount > 0);
    const avgRiskReward = riskRewardTrades.length > 0 ? 
        riskRewardTrades.reduce((sum, t) => {
            const potentialProfit = Math.abs(calculateProfitLoss(
                t.entryPrice, t.takeProfit, t.lotSize, t.symbol, t.type
            ));
            return sum + (potentialProfit / t.riskAmount);
        }, 0) / riskRewardTrades.length : 0;
    
    const avgRiskPercent = trades.length > 0 ? 
        trades.reduce((sum, t) => sum + (t.riskPercent || 0), 0) / trades.length : 0;
    
    const maxDrawdown = calculateMaxDrawdown(trades);
    
    const consecutiveWins = calculateMaxConsecutive(trades, 'win');
    const consecutiveLosses = calculateMaxConsecutive(trades, 'loss');
    
    const expectancy = (winRate / 100) * avgWin - (lossRate / 100) * avgLoss;
    
    const weeklyPerformance = calculateWeeklyPerformance(trades);
    const consistency = weeklyPerformance.length > 0 ?
        (weeklyPerformance.filter(w => w.profit > 0).length / weeklyPerformance.length) * 100 : 0;
    
    // Time-based metrics
    const recentTrades = trades.slice(0, Math.min(10, trades.length));
    const recentWinRate = recentTrades.length > 0 ?
        (recentTrades.filter(t => t.profit > 0).length / recentTrades.length) * 100 : 0;
    
    // Instrument performance
    const instrumentPerformance = analyzeInstrumentPerformance(trades);
    
    // Mood correlation
    const moodCorrelation = analyzeMoodCorrelation(trades);
    
    // Session performance
    const sessionPerformance = analyzeSessionPerformance(trades);
    
    return {
        totalTrades, winRate, lossRate, totalProfit, totalLoss, netProfit,
        avgWin, avgLoss, profitFactor, avgRiskReward, avgRiskPercent,
        maxDrawdown, consecutiveWins, consecutiveLosses, expectancy,
        consistency, recentWinRate, weeklyPerformance,
        winningTradesCount: winningTrades.length,
        losingTradesCount: losingTrades.length,
        breakevenTradesCount: breakevenTrades.length,
        instrumentPerformance,
        moodCorrelation,
        sessionPerformance
    };
}

function calculateMaxDrawdown(trades) {
    if (trades.length === 0) return 0;
    
    const sortedTrades = [...trades].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    const currentAccount = getCurrentAccount();
    let peak = currentAccount.balance;
    let maxDrawdown = 0;
    let currentBalance = peak;
    
    sortedTrades.forEach(trade => {
        currentBalance += trade.profit;
        if (currentBalance > peak) {
            peak = currentBalance;
        }
        const drawdown = ((peak - currentBalance) / peak) * 100;
        if (drawdown > maxDrawdown) {
            maxDrawdown = drawdown;
        }
    });
    
    return maxDrawdown;
}

function calculateMaxConsecutive(trades, type) {
    let maxStreak = 0;
    let currentStreak = 0;
    
    const sortedTrades = [...trades].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    sortedTrades.forEach(trade => {
        const isWin = trade.profit > 0;
        const isLoss = trade.profit < 0;
        
        if ((type === 'win' && isWin) || (type === 'loss' && isLoss)) {
            currentStreak++;
            if (currentStreak > maxStreak) {
                maxStreak = currentStreak;
            }
        } else {
            currentStreak = 0;
        }
    });
    
    return maxStreak;
}

function analyzeInstrumentPerformance(trades) {
    const performance = {};
    
    trades.forEach(trade => {
        if (!performance[trade.symbol]) {
            performance[trade.symbol] = { total: 0, count: 0, wins: 0 };
        }
        performance[trade.symbol].total += trade.profit;
        performance[trade.symbol].count++;
        if (trade.profit > 0) performance[trade.symbol].wins++;
    });
    
    // Find best and worst
    let bestSymbol = null, worstSymbol = null;
    let bestAvg = -Infinity, worstAvg = Infinity;
    
    Object.entries(performance).forEach(([symbol, data]) => {
        const avg = data.total / data.count;
        if (avg > bestAvg && data.count >= 3) {
            bestAvg = avg;
            bestSymbol = symbol;
        }
        if (avg < worstAvg && data.count >= 3) {
            worstAvg = avg;
            worstSymbol = symbol;
        }
    });
    
    return { bestSymbol, bestAvg, worstSymbol, worstAvg, details: performance };
}

function analyzeMoodCorrelation(trades) {
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
    
    let bestMood = null, worstMood = null;
    let bestAvg = -Infinity, worstAvg = Infinity;
    
    Object.entries(moodPerformance).forEach(([mood, data]) => {
        const avg = data.total / data.count;
        if (avg > bestAvg && data.count >= 2) {
            bestAvg = avg;
            bestMood = mood;
        }
        if (avg < worstAvg && data.count >= 2) {
            worstAvg = avg;
            worstMood = mood;
        }
    });
    
    return { bestMood, bestAvg, worstMood, worstAvg };
}

function analyzeSessionPerformance(trades) {
    const sessions = {
        'Asian': { start: 0, end: 8 },
        'London': { start: 8, end: 16 },
        'New York': { start: 13, end: 21 }
    };
    
    const performance = {};
    
    trades.forEach(trade => {
        const hour = new Date(trade.timestamp).getUTCHours();
        
        Object.entries(sessions).forEach(([session, times]) => {
            if (hour >= times.start && hour < times.end) {
                if (!performance[session]) {
                    performance[session] = { total: 0, count: 0, wins: 0 };
                }
                performance[session].total += trade.profit;
                performance[session].count++;
                if (trade.profit > 0) performance[session].wins++;
            }
        });
    });
    
    return performance;
}

// Generate insights
function generatePrimaryInsight(metrics, trades) {
    const { winRate, profitFactor, recentWinRate, consecutiveLosses } = metrics;
    
    // Check for concerning patterns first
    if (consecutiveLosses >= 5) {
        return {
            type: 'warning',
            title: '⚠️ Consecutive Losses Detected',
            message: `You've had ${consecutiveLosses} consecutive losses. Consider taking a break and reviewing your strategy.`,
            action: 'Step away from trading for at least 24 hours. Review your last 10 trades for patterns.'
        };
    }
    
    if (recentWinRate < 30 && metrics.totalTrades >= 10) {
        return {
            type: 'warning',
            title: '📉 Recent Performance Decline',
            message: `Your recent win rate is ${recentWinRate.toFixed(1)}%, down from your overall ${winRate.toFixed(1)}%.`,
            action: 'Reduce position size by 50% until you identify the issue.'
        };
    }
    
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
    
    // Default insight
    return {
        type: 'info',
        title: '📊 Steady Progress',
        message: `Your win rate is ${winRate.toFixed(1)}% with a profit factor of ${profitFactor.toFixed(2)}.`,
        action: 'Focus on improving your risk-reward ratio on losing trades.'
    };
}

function generateRiskInsight(metrics, currentAccount) {
    const { avgRiskPercent, maxDrawdown, avgRiskReward } = metrics;
    
    if (avgRiskPercent > 3.0) {
        return {
            type: 'danger',
            title: '🚨 High Risk Exposure',
            message: `Your average risk of ${avgRiskPercent.toFixed(2)}% per trade is dangerously high.`,
            action: 'Reduce risk to 1-2% maximum per trade to protect your capital.'
        };
    }
    
    if (maxDrawdown > 20) {
        return {
            type: 'warning',
            title: '📉 Significant Drawdown',
            message: `Maximum drawdown of ${maxDrawdown.toFixed(1)}% indicates high volatility.`,
            action: 'Consider reducing position sizes until drawdown recovers to 10%.'
        };
    }
    
    if (avgRiskReward < 1.5) {
        return {
            type: 'warning',
            title: '⚖️ Low Risk-Reward Ratio',
            message: `Your average R:R of ${avgRiskReward.toFixed(2)} makes profitability difficult.`,
            action: 'Aim for trades with at least 1:2 risk-reward ratio.'
        };
    }
    
    if (avgRiskPercent >= 1.0 && avgRiskPercent <= 2.0) {
        return {
            type: 'success',
            title: '✅ Good Risk Management',
            message: `Your average risk of ${avgRiskPercent.toFixed(2)}% per trade is within the optimal range.`,
            action: 'Maintain this discipline and focus on trade selection.'
        };
    }
    
    return {
        type: 'info',
        title: '📋 Risk Profile',
        message: `Average risk: ${avgRiskPercent.toFixed(2)}% | Max drawdown: ${maxDrawdown.toFixed(1)}%`,
        action: 'Track your risk metrics weekly to identify trends.'
    };
}

function generateTrendInsight(metrics, trades) {
    const { consistency, instrumentPerformance, sessionPerformance } = metrics;
    
    // Check consistency
    if (consistency >= 70) {
        return {
            type: 'success',
            title: '📈 High Consistency',
            message: `You've been profitable in ${consistency.toFixed(0)}% of trading weeks.`,
            action: 'This consistency is key to long-term success. Keep doing what works.'
        };
    }
    
    if (consistency < 40 && metrics.totalTrades >= 20) {
        return {
            type: 'warning',
            title: '🔄 Inconsistent Results',
            message: `Only ${consistency.toFixed(0)}% of your trading weeks are profitable.`,
            action: 'Review what differentiates your winning weeks from losing weeks.'
        };
    }
    
    // Check instrument performance
    if (instrumentPerformance.bestSymbol && instrumentPerformance.worstSymbol) {
        const best = instrumentPerformance.bestSymbol;
        const worst = instrumentPerformance.worstSymbol;
        const bestAvg = instrumentPerformance.bestAvg;
        const worstAvg = instrumentPerformance.worstAvg;
        
        if (worstAvg < 0 && Math.abs(worstAvg) > Math.abs(bestAvg)) {
            return {
                type: 'warning',
                title: '🔍 Instrument Selection Issue',
                message: `${worst} is significantly underperforming (avg ${formatCurrency(worstAvg)}).`,
                action: `Consider reducing or eliminating ${worst} from your trading.`
            };
        }
        
        if (bestAvg > 0) {
            return {
                type: 'success',
                title: '💡 Strong Instrument Found',
                message: `${best} is your best performer with avg ${formatCurrency(bestAvg)} per trade.`,
                action: `Consider increasing focus on ${best} setups.`
            };
        }
    }
    
    return {
        type: 'info',
        title: '📊 Trading Patterns',
        message: `Weekly consistency: ${consistency.toFixed(0)}% | ${metrics.totalTrades} total trades`,
        action: 'Continue logging trades to build more data for analysis.'
    };
}

function generateRecommendations(metrics, trades) {
    const recommendations = [];
    
    // Win rate based recommendations
    if (metrics.winRate < 40 && metrics.totalTrades >= 10) {
        recommendations.push({
            priority: 'high',
            category: 'Entry Strategy',
            icon: '🎯',
            text: 'Your win rate is below 40%. Focus on higher probability setups. Wait for confirmation before entering trades.'
        });
    }
    
    // Risk management recommendations
    if (metrics.avgRiskPercent > 2.5) {
        recommendations.push({
            priority: 'critical',
            category: 'Risk Management',
            icon: '⚠️',
            text: `Reduce position size immediately. ${metrics.avgRiskPercent.toFixed(1)}% risk per trade will lead to account blow-up.`
        });
    }
    
    // Risk-Reward recommendations
    if (metrics.avgRiskReward < 1.0 && metrics.totalTrades >= 10) {
        recommendations.push({
            priority: 'high',
            category: 'Trade Management',
            icon: '📐',
            text: `Your average risk-reward is ${metrics.avgRiskReward.toFixed(2)}. You need at least 1:2 R:R to be profitable long-term.`
        });
    }
    
    // Profit factor recommendations
    if (metrics.profitFactor < 1.0 && metrics.totalTrades >= 10) {
        recommendations.push({
            priority: 'critical',
            category: 'Strategy Review',
            icon: '🔴',
            text: `Profit factor of ${metrics.profitFactor.toFixed(2)} means you're losing money. Stop live trading and paper trade until you find an edge.`
        });
    }
    
    // Consecutive losses
    if (metrics.consecutiveLosses >= 4) {
        recommendations.push({
            priority: 'high',
            category: 'Psychology',
            icon: '🧠',
            text: `${metrics.consecutiveLosses} consecutive losses. Take a 24-hour break to reset your mental state.`
        });
    }
    
    // Mood correlation
    if (metrics.moodCorrelation.bestMood && metrics.moodCorrelation.worstMood) {
        const bestMood = getMoodEmoji(metrics.moodCorrelation.bestMood);
        const worstMood = getMoodEmoji(metrics.moodCorrelation.worstMood);
        
        recommendations.push({
            priority: 'medium',
            category: 'Psychology',
            icon: '😊',
            text: `You perform best when ${bestMood} and worst when ${worstMood}. Only trade when you're in your optimal mindset.`
        });
    }
    
    // Expectancy
    if (metrics.expectancy < 0 && metrics.totalTrades >= 20) {
        recommendations.push({
            priority: 'high',
            category: 'Edge Analysis',
            icon: '📉',
            text: `Negative expectancy (${formatCurrency(metrics.expectancy)}). Your strategy needs fundamental changes.`
        });
    } else if (metrics.expectancy > 0) {
        recommendations.push({
            priority: 'low',
            category: 'Scaling',
            icon: '📈',
            text: `Positive expectancy of ${formatCurrency(metrics.expectancy)} per trade. You have an edge - trust your system.`
        });
    }
    
    // Session analysis
    const sessions = metrics.sessionPerformance;
    let bestSession = null, worstSession = null;
    let bestSessionAvg = -Infinity, worstSessionAvg = Infinity;
    
    Object.entries(sessions).forEach(([session, data]) => {
        if (data.count >= 5) {
            const avg = data.total / data.count;
            if (avg > bestSessionAvg) {
                bestSessionAvg = avg;
                bestSession = session;
            }
            if (avg < worstSessionAvg) {
                worstSessionAvg = avg;
                worstSession = session;
            }
        }
    });
    
    if (bestSession && worstSession && bestSession !== worstSession) {
        recommendations.push({
            priority: 'medium',
            category: 'Timing',
            icon: '⏰',
            text: `You perform best during ${bestSession} session and worst during ${worstSession}. Consider focusing on ${bestSession} hours.`
        });
    }
    
    // Add default recommendations if few exist
    if (recommendations.length < 3) {
        recommendations.push({
            priority: 'low',
            category: 'Journaling',
            icon: '📝',
            text: 'Continue logging every trade with detailed notes. More data leads to better insights.'
        });
        
        recommendations.push({
            priority: 'low',
            category: 'Review',
            icon: '🔍',
            text: 'Set aside 30 minutes weekly to review your trades and identify patterns.'
        });
    }
    
    // Sort by priority
    const priorityOrder = { 'critical': 0, 'high': 1, 'medium': 2, 'low': 3 };
    recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
    
    return recommendations.slice(0, 6); // Return top 6 recommendations
}

function showEmptyAISuggestions() {
    document.getElementById('primaryInsightText').innerHTML = `
        <span class="text-gray-500">No trades yet. Add your first trade to get AI insights!</span>
    `;
    document.getElementById('riskInsightText').innerHTML = `
        <span class="text-gray-500">Waiting for trade data...</span>
    `;
    document.getElementById('trendInsightText').innerHTML = `
        <span class="text-gray-500">Waiting for trade data...</span>
    `;
    
    document.getElementById('aiRecommendations').innerHTML = `
        <div class="text-center py-4 text-gray-500">
            <i class="fas fa-chart-bar text-3xl mb-2 opacity-50"></i>
            <p>Add at least 5 trades to receive personalized AI recommendations.</p>
        </div>
    `;
    
    document.getElementById('aiMetricsSummary').innerHTML = '';
}

function updateAISuggestionsUI(primary, risk, trend, recommendations, metrics) {
    // Update primary insight
    const primaryEl = document.getElementById('primaryInsightText');
    const primaryIcon = primary.type === 'success' ? '✅' : (primary.type === 'warning' ? '⚠️' : 'ℹ️');
    primaryEl.innerHTML = `
        <div class="font-semibold text-gray-800">${primaryIcon} ${primary.title}</div>
        <p class="text-sm text-gray-600 mt-1">${primary.message}</p>
        <p class="text-xs text-indigo-600 mt-2"><i class="fas fa-arrow-right mr-1"></i>${primary.action}</p>
    `;
    
    // Update risk insight
    const riskEl = document.getElementById('riskInsightText');
    const riskIcon = risk.type === 'success' ? '✅' : (risk.type === 'danger' ? '🚨' : (risk.type === 'warning' ? '⚠️' : 'ℹ️'));
    riskEl.innerHTML = `
        <div class="font-semibold text-gray-800">${riskIcon} ${risk.title}</div>
        <p class="text-sm text-gray-600 mt-1">${risk.message}</p>
        <p class="text-xs text-red-600 mt-2"><i class="fas fa-arrow-right mr-1"></i>${risk.action}</p>
    `;
    
    // Update trend insight
    const trendEl = document.getElementById('trendInsightText');
    const trendIcon = trend.type === 'success' ? '📈' : (trend.type === 'warning' ? '📉' : '📊');
    trendEl.innerHTML = `
        <div class="font-semibold text-gray-800">${trendIcon} ${trend.title}</div>
        <p class="text-sm text-gray-600 mt-1">${trend.message}</p>
        <p class="text-xs text-green-600 mt-2"><i class="fas fa-arrow-right mr-1"></i>${trend.action}</p>
    `;
    
    // Update recommendations
    const recEl = document.getElementById('aiRecommendations');
    if (recommendations.length > 0) {
        recEl.innerHTML = recommendations.map((rec, index) => {
            const priorityColors = {
                'critical': 'border-red-500 bg-red-50',
                'high': 'border-orange-500 bg-orange-50',
                'medium': 'border-yellow-500 bg-yellow-50',
                'low': 'border-blue-500 bg-blue-50'
            };
            
            return `
                <div class="flex items-start gap-3 p-3 rounded-lg border-l-4 ${priorityColors[rec.priority]}">
                    <span class="text-xl">${rec.icon}</span>
                    <div class="flex-1">
                        <div class="flex items-center gap-2">
                            <span class="text-xs font-semibold text-gray-500 uppercase">${rec.category}</span>
                            <span class="text-xs px-2 py-0.5 rounded-full ${rec.priority === 'critical' ? 'bg-red-200 text-red-800' : (rec.priority === 'high' ? 'bg-orange-200 text-orange-800' : 'bg-gray-200 text-gray-700')}">${rec.priority}</span>
                        </div>
                        <p class="text-sm text-gray-700 mt-1">${rec.text}</p>
                    </div>
                </div>
            `;
        }).join('');
    }
    
    // Update metrics summary
    const summaryEl = document.getElementById('aiMetricsSummary');
    summaryEl.innerHTML = `
        <div class="bg-gray-50 rounded-lg p-2 text-center">
            <span class="font-semibold">${metrics.totalTrades}</span> Trades
        </div>
        <div class="bg-gray-50 rounded-lg p-2 text-center">
            <span class="font-semibold ${metrics.winRate >= 50 ? 'text-green-600' : 'text-orange-600'}">${metrics.winRate.toFixed(1)}%</span> Win Rate
        </div>
        <div class="bg-gray-50 rounded-lg p-2 text-center">
            <span class="font-semibold ${metrics.profitFactor >= 1.5 ? 'text-green-600' : (metrics.profitFactor >= 1.0 ? 'text-yellow-600' : 'text-red-600')}">${metrics.profitFactor.toFixed(2)}</span> Profit Factor
        </div>
        <div class="bg-gray-50 rounded-lg p-2 text-center">
            <span class="font-semibold ${metrics.expectancy >= 0 ? 'text-green-600' : 'text-red-600'}">${formatCurrency(metrics.expectancy)}</span> Expectancy
        </div>
    `;
}

// Refresh AI suggestions
window.refreshAISuggestions = () => {
    showLoading();
    setTimeout(() => {
        generateAISuggestions();
        hideLoading();
        showSuccessMessage('AI analysis refreshed! 🤖');
    }, 500);
};

// Call this after loading trades
function initializeAISuggestions() {
    if (allTrades && allTrades.length > 0) {
        generateAISuggestions();
    } else {
        showEmptyAISuggestions();
    }
}

// ========== DERIV API INTEGRATION & POINT VALUE VERIFICATION ==========

import { derivAPI } from './deriv-api-service.js';

// ========== POINT VALUE OVERRIDES ==========
// Store custom point value overrides for accurate PnL calculations

// Load saved overrides from localStorage
function loadPointValueOverrides() {
    try {
        const stored = localStorage.getItem('pointValueOverrides');
        if (stored) {
            pointValueOverrides = JSON.parse(stored);
            console.log('[POINT VALUE] Loaded overrides:', Object.keys(pointValueOverrides).length);
        }
    } catch (error) {
        console.warn('[POINT VALUE] Error loading overrides:', error);
        pointValueOverrides = {};
    }
}

// Save overrides to localStorage
function savePointValueOverrides() {
    localStorage.setItem('pointValueOverrides', JSON.stringify(pointValueOverrides));
}

// Get point value with override support
function getPointValue(symbol) {
    // Check for manual override first
    if (pointValueOverrides && pointValueOverrides[symbol] !== undefined) {
        return pointValueOverrides[symbol];
    }
    
    // Check Deriv config
    if (derivLotSizeConfig[symbol]) {
        return derivLotSizeConfig[symbol].pointValue;
    }
    
    // Default point values for common instruments
    const pointValues = {
        'US30': 1, 'SPX500': 50, 'NAS100': 20, 'GE30': 1, 'FTSE100': 1,
        'NIKKEI225': 1, 'AUS200': 1, 'ESTX50': 1, 'FRA40': 1,
        'Gold': 0.01, 'Silver': 0.001, 'Oil': 0.01, 'Brent': 0.01
    };
    
    return pointValues[symbol] || 0.0001;
}

// Populate verification symbol select
async function populateVerificationSymbols() {
    const select = document.getElementById('verificationSymbolSelect');
    if (!select) return;
    
    // Get all unique symbols from our configuration
    const symbols = new Set([
        ...Object.keys(derivLotSizeConfig),
        'EUR/USD', 'GBP/USD', 'USD/JPY', 'US30', 'SPX500', 'NAS100',
        'Gold', 'Silver', 'Oil'
    ]);
    
    // Group by type
    const groups = {
        'Deriv Synthetic': [],
        'Forex': [],
        'Indices': [],
        'Commodities': []
    };
    
    symbols.forEach(symbol => {
        const type = getInstrumentType(symbol);
        if (type === 'synthetic') groups['Deriv Synthetic'].push(symbol);
        else if (type === 'forex') groups['Forex'].push(symbol);
        else if (type === 'indices') groups['Indices'].push(symbol);
        else if (type === 'commodities') groups['Commodities'].push(symbol);
    });
    
    let html = '<option value="">Select an instrument...</option>';
    
    Object.entries(groups).forEach(([groupName, groupSymbols]) => {
        if (groupSymbols.length > 0) {
            html += `<optgroup label="${groupName}">`;
            groupSymbols.sort().forEach(symbol => {
                const hasOverride = pointValueOverrides[symbol] !== undefined;
                html += `<option value="${symbol}">${symbol} ${hasOverride ? '🔧' : ''}</option>`;
            });
            html += '</optgroup>';
        }
    });
    
    select.innerHTML = html;
}

// Show verification details for selected symbol
window.showVerificationDetails = () => {
    const symbol = document.getElementById('verificationSymbolSelect')?.value;
    if (!symbol) {
        document.getElementById('verificationDetails').classList.add('hidden');
        return;
    }
    
    const pointValue = getPointValue(symbol);
    const lotInfo = getLotSizeInfo(symbol);
    const hasOverride = pointValueOverrides[symbol] !== undefined;
    
    document.getElementById('currentPointValue').innerHTML = 
        `$${pointValue} ${hasOverride ? '<span class="text-xs text-orange-600 ml-2">(overridden)</span>' : ''}`;
    document.getElementById('currentMinLot').textContent = lotInfo.minLot;
    document.getElementById('currentStdLot').textContent = lotInfo.stdLotDisplay;
    
    document.getElementById('verificationDetails').classList.remove('hidden');
};

// Override point value for a symbol
window.overridePointValue = () => {
    const symbol = document.getElementById('verificationSymbolSelect')?.value;
    const newValue = parseFloat(document.getElementById('overridePointValue')?.value);
    
    if (!symbol) {
        alert('Please select an instrument first');
        return;
    }
    
    if (isNaN(newValue) || newValue <= 0) {
        alert('Please enter a valid positive number');
        return;
    }
    
    pointValueOverrides[symbol] = newValue;
    savePointValueOverrides();
    
    showSuccessMessage(`Point value for ${symbol} updated to $${newValue}`);
    showVerificationDetails();
    populateVerificationSymbols();
};

// Reset point value to default
window.resetPointValue = () => {
    const symbol = document.getElementById('verificationSymbolSelect')?.value;
    
    if (!symbol) {
        alert('Please select an instrument first');
        return;
    }
    
    delete pointValueOverrides[symbol];
    savePointValueOverrides();
    
    document.getElementById('overridePointValue').value = '';
    showSuccessMessage(`Point value for ${symbol} reset to default`);
    showVerificationDetails();
    populateVerificationSymbols();
};

// Calculate test PnL
window.calculateTestPnL = () => {
    const symbol = document.getElementById('verificationSymbolSelect')?.value;
    const entryPrice = parseFloat(document.getElementById('calcEntryPrice')?.value);
    const exitPrice = parseFloat(document.getElementById('calcExitPrice')?.value);
    const lotSize = parseFloat(document.getElementById('calcLotSize')?.value);
    const direction = document.getElementById('calcDirection')?.value;
    
    if (!symbol) {
        alert('Please select an instrument first');
        return;
    }
    
    if (isNaN(entryPrice) || isNaN(exitPrice) || isNaN(lotSize)) {
        alert('Please fill all price and lot size fields');
        return;
    }
    
    const pointValue = getPointValue(symbol);
    const points = direction === 'long' ? (exitPrice - entryPrice) : (entryPrice - exitPrice);
    const pnl = points * pointValue * lotSize;
    
    document.getElementById('calculatedPnL').textContent = formatCurrency(pnl);
    document.getElementById('calculatedPnL').className = `font-bold text-lg ${pnl >= 0 ? 'profit' : 'loss'}`;
    document.getElementById('pointsMovement').textContent = points.toFixed(4);
    document.getElementById('calcResult').classList.remove('hidden');
};

// Fetch contract specifications from Deriv API
window.fetchAllContractSpecs = async () => {
    const resultDiv = document.getElementById('batchFetchResult');
    
    try {
        resultDiv.innerHTML = `
            <div class="bg-blue-50 p-4 rounded-lg">
                <div class="loading-spinner"></div>
                <span class="ml-2">Fetching contract specifications from Deriv API...</span>
            </div>
        `;
        
        // Connect to API
        await derivAPI.connect();
        
        // Get active symbols
        const activeSymbols = await derivAPI.getActiveSymbols();
        
        // Filter for synthetic indices
        const syntheticSymbols = activeSymbols.filter(s => 
            s.symbol.includes('Volatility') || 
            s.symbol.includes('Boom') || 
            s.symbol.includes('Crash') ||
            s.symbol.includes('Jump') ||
            s.symbol.includes('Step') ||
            s.symbol.includes('Range Break')
        );
        
        // Try to get contract details for each
        const results = [];
        for (const symbolInfo of syntheticSymbols.slice(0, 20)) {
            try {
                const contracts = await derivAPI.getContractsForSymbol(symbolInfo.symbol);
                results.push({
                    symbol: symbolInfo.symbol,
                    display: symbolInfo.display_name,
                    contracts: contracts ? 'Available' : 'N/A'
                });
            } catch (e) {
                results.push({
                    symbol: symbolInfo.symbol,
                    display: symbolInfo.display_name,
                    error: e.message
                });
            }
        }
        
        // Display results
        let html = `
            <div class="bg-green-50 p-4 rounded-lg">
                <h5 class="font-semibold mb-2">Fetch Results</h5>
                <p class="text-sm mb-2">Found ${syntheticSymbols.length} synthetic symbols</p>
                <div class="max-h-60 overflow-y-auto">
                    <table class="w-full text-sm">
                        <thead>
                            <tr class="border-b">
                                <th class="py-1 text-left">Symbol</th>
                                <th class="py-1 text-left">Display Name</th>
                                <th class="py-1 text-left">Status</th>
                            </tr>
                        </thead>
                        <tbody>
        `;
        
        results.forEach(r => {
            html += `
                <tr class="border-b">
                    <td class="py-1">${r.symbol}</td>
                    <td class="py-1">${r.display || '-'}</td>
                    <td class="py-1">${r.error ? '❌ Error' : '✅ ' + r.contracts}</td>
                </tr>
            `;
        });
        
        html += `
                        </tbody>
                    </table>
                </div>
                <p class="text-xs text-gray-500 mt-3">
                    <i class="fas fa-info-circle mr-1"></i>
                    Note: The Deriv API provides contract availability but not the point values directly. 
                    Point values must be manually verified or obtained from MT5 symbol specifications.
                </p>
            </div>
        `;
        
        resultDiv.innerHTML = html;
        
    } catch (error) {
        console.error('Error fetching specs:', error);
        resultDiv.innerHTML = `
            <div class="bg-red-50 p-4 rounded-lg text-red-800">
                <i class="fas fa-exclamation-triangle mr-2"></i>
                Error fetching specifications: ${error.message}
            </div>
        `;
    }
};

// Initialize verification tool
function initVerificationTool() {
    loadPointValueOverrides();
    
    // Set up event listeners
    const symbolSelect = document.getElementById('verificationSymbolSelect');
    if (symbolSelect) {
        populateVerificationSymbols();
        symbolSelect.addEventListener('change', showVerificationDetails);
    }
}

// ========== EMOTION GAUGE FUNCTIONS ==========

// Initialize emotion gauge
function initEmotionGauge() {
    const emotionSlider = document.getElementById('emotionLevel');
    const emotionValue = document.getElementById('emotionValue');
    const emotionDescription = document.getElementById('emotionDescription');
    const gaugeFill = document.getElementById('emotionGaugeFill');

    if (!emotionSlider || !emotionValue || !emotionDescription || !gaugeFill) {
        console.warn('Emotion gauge elements not found');
        return;
    }

    // Set initial values
    updateEmotionDisplay(50);

    // Add event listener for slider changes
    emotionSlider.addEventListener('input', function(e) {
        const value = parseInt(e.target.value);
        updateEmotionDisplay(value);
    });
}

// Update emotion gauge display
function updateEmotionDisplay(value) {
    const emotionValue = document.getElementById('emotionValue');
    const emotionDescription = document.getElementById('emotionDescription');
    const gaugeFill = document.getElementById('emotionGaugeFill');

    if (emotionValue) emotionValue.textContent = value;
    if (gaugeFill) gaugeFill.style.width = `${value}%`;

    // Update description based on value
    let description = '';
    if (value <= 20) {
        description = 'Very calm and collected';
    } else if (value <= 40) {
        description = 'Calm and focused';
    } else if (value <= 60) {
        description = 'Balanced emotional state';
    } else if (value <= 80) {
        description = 'Elevated emotions';
    } else {
        description = 'Highly intense emotional state';
    }

    if (emotionDescription) emotionDescription.textContent = description;
}

// Get emotion category from gauge value
function getEmotionCategory(value) {
    if (value <= 25) return 'calm';
    if (value <= 50) return 'balanced';
    if (value <= 75) return 'anxious';
    return 'intense';
}

// Get emotion level from gauge
function getEmotionLevel() {
    const emotionSlider = document.getElementById('emotionLevel');
    return emotionSlider ? parseInt(emotionSlider.value) : 50;
}

// ========== EMOTION ANALYTICS FUNCTIONS ==========

// Update emotion analytics in dashboard
function updateEmotionAnalytics(trades) {
    console.log('[EMOTION] Updating emotion analytics for', trades?.length, 'trades');
    
    if (!trades || trades.length === 0) {
        resetEmotionAnalytics();
        return;
    }

    // Count trades by emotion category (matching HTML IDs)
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
            console.log(`[EMOTION] Trade ${trade.id}: level=${trade.emotionLevel}, category=${category}`);
            if (emotionCounts.hasOwnProperty(category)) {
                emotionCounts[category]++;
                totalTrades++;
            }
        }
    });

    console.log('[EMOTION] Counts:', emotionCounts, 'Total:', totalTrades);

    // Update UI
    const emotions = ['calm', 'balanced', 'anxious', 'intense'];
    emotions.forEach(emotion => {
        const countElement = document.getElementById(`${emotion}Trades`);
        const percentElement = document.getElementById(`${emotion}Percent`);
        
        if (countElement) {
            countElement.textContent = emotionCounts[emotion] || 0;
            console.log(`[EMOTION] Set ${emotion}Trades to ${emotionCounts[emotion] || 0}`);
        }
        if (percentElement) {
            const percent = totalTrades > 0 ? Math.round((emotionCounts[emotion] / totalTrades) * 100) : 0;
            percentElement.textContent = `${percent}%`;
        }
    });

    updateEmotionInsights(emotionCounts, totalTrades, trades);
}

// Update emotion analytics cards
function updateEmotionCards(counts, total) {
    const emotions = ['calm', 'anxious', 'frustrated', 'focused'];
    
    emotions.forEach(emotion => {
        const countElement = document.getElementById(`${emotion}Trades`);
        const percentElement = document.getElementById(`${emotion}Percent`);
        
        if (countElement) countElement.textContent = counts[emotion] || 0;
        if (percentElement) {
            const percent = total > 0 ? Math.round((counts[emotion] / total) * 100) : 0;
            percentElement.textContent = `${percent}%`;
        }
    });
}

// Update emotion insights
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

    // Performance correlation - FIXED: use profit > 0 instead of result property
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

// Reset emotion analytics when no data
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

// ========== WITHDRAWAL & DEPOSIT SYSTEM ==========

// Transaction storage
let transactions = [];
let editingTransactionId = null;

// Load transactions from Firestore
async function loadTransactions() {
    try {
        if (!currentUser || !currentAccountId) return;
        
        console.log('[TRANSACTIONS] Loading transactions for account:', currentAccountId);
        
        const q = query(
            collection(db, 'transactions'),
            where('userId', '==', currentUser.uid),
            where('accountId', '==', currentAccountId)
        );
        
        const querySnapshot = await getDocs(q);
        transactions = [];
        querySnapshot.forEach((doc) => {
            transactions.push({ id: doc.id, ...doc.data() });
        });
        
        // Sort by date (newest first)
        transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        console.log('[TRANSACTIONS] Loaded', transactions.length, 'transactions');
        renderTransactionHistory();
        updateCurrentBalanceDisplay();
        
    } catch (error) {
        console.error('[TRANSACTIONS] Error loading transactions:', error);
    }
}

// Save transaction to Firestore
async function saveTransaction(transaction) {
    try {
        if (!currentUser || !currentAccountId) {
            throw new Error('User or account not authenticated');
        }
        
        const transactionData = {
            ...transaction,
            userId: currentUser.uid,
            accountId: currentAccountId,
            createdAt: new Date().toISOString()
        };
        
        let docRef;
        if (transaction.id) {
            docRef = doc(db, 'transactions', transaction.id);
            await updateDoc(docRef, transactionData);
        } else {
            docRef = await addDoc(collection(db, 'transactions'), transactionData);
            transactionData.id = docRef.id;
        }
        
        console.log('[TRANSACTIONS] Saved transaction:', transactionData);
        return transactionData;
        
    } catch (error) {
        console.error('[TRANSACTIONS] Error saving transaction:', error);
        throw error;
    }
}

// Delete transaction
async function deleteTransaction(transactionId) {
    if (!confirm('Are you sure you want to delete this transaction?')) return;
    
    try {
        await deleteDoc(doc(db, 'transactions', transactionId));
        transactions = transactions.filter(t => t.id !== transactionId);
        renderTransactionHistory();
        updateCurrentBalanceDisplay();
        showSuccessMessage('Transaction deleted successfully');
    } catch (error) {
        console.error('[TRANSACTIONS] Error deleting transaction:', error);
        alert('Error deleting transaction');
    }
}

// Calculate net balance from transactions
function calculateNetBalanceFromTransactions() {
    let totalDeposits = 0;
    let totalWithdrawals = 0;
    
    transactions.forEach(transaction => {
        if (transaction.type === 'deposit') {
            totalDeposits += transaction.amount;
        } else if (transaction.type === 'withdraw') {
            totalWithdrawals += transaction.amount;
        }
    });
    
    return {
        totalDeposits,
        totalWithdrawals,
        netBalance: totalDeposits - totalWithdrawals
    };
}

// Get current balance including initial, trading P/L, and transactions
function getCurrentBalance() {
    const currentAccount = getCurrentAccount();
    const totalPL = allTrades.reduce((sum, trade) => sum + trade.profit, 0);
    const { netBalance } = calculateNetBalanceFromTransactions();
    return currentAccount.balance + totalPL + netBalance;
}

// Update current account balance based on transactions
async function updateCurrentBalanceFromTransactions() {
    const { netBalance } = calculateNetBalanceFromTransactions();
    const currentAccount = getCurrentAccount();
    
    if (currentAccount) {
        currentAccount.balance = netBalance;
        await saveUserAccounts();
        
        // Update UI
        const accountSizeInput = document.getElementById('accountSize');
        if (accountSizeInput && !accountSizeInput.readOnly) {
            accountSizeInput.value = netBalance.toFixed(2);
        }
        
        updateStats(allTrades);
        renderCharts(allTrades);
    }
    
    return netBalance;
}

// Update balance display in funds section
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

// Render transaction history
function renderTransactionHistory() {
    const container = document.getElementById('transactionHistory');
    if (!container) return;
    
    if (transactions.length === 0) {
        container.innerHTML = `
            <div class="text-center text-gray-500 py-8">
                <i class="fas fa-receipt text-4xl mb-2 opacity-50"></i>
                <p>No transactions yet</p>
                <p class="text-sm">Add your first deposit or withdrawal</p>
            </div>
        `;
        return;
    }
    
    const currentAccount = getCurrentAccount();
    const currencySymbol = getCurrencySymbol(currentAccount?.currency);
    
    container.innerHTML = transactions.map(transaction => `
        <div class="transaction-item transaction-${transaction.type} p-4 bg-white rounded-xl border border-gray-200 hover:shadow-md transition-all duration-200">
            <div class="flex justify-between items-start">
                <div class="flex-1">
                    <div class="flex items-center gap-2 mb-2">
                        <span class="text-lg ${transaction.type === 'deposit' ? 'text-green-500' : 'text-red-500'}">
                            ${transaction.type === 'deposit' ? '💰' : '🏦'}
                        </span>
                        <span class="font-semibold capitalize">${transaction.type}</span>
                        ${transaction.description ? `<span class="text-sm text-gray-500">- ${transaction.description}</span>` : ''}
                    </div>
                    <div class="text-sm text-gray-500">
                        <i class="far fa-calendar-alt mr-1"></i> ${new Date(transaction.date).toLocaleString()}
                    </div>
                </div>
                <div class="text-right">
                    <div class="transaction-amount ${transaction.type} font-bold text-lg">
                        ${transaction.type === 'deposit' ? '+' : '-'} ${currencySymbol}${transaction.amount.toFixed(2)}
                    </div>
                    <button onclick="deleteTransaction('${transaction.id}')" class="text-xs text-red-500 hover:text-red-700 mt-1">
                        <i class="fas fa-trash-alt"></i> Delete
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

// Open deposit modal
window.openDepositModal = () => {
    const modal = document.getElementById('depositModal');
    const depositDate = document.getElementById('depositDate');
    if (depositDate) {
        depositDate.value = getCurrentDateTimeString();
    }
    
    const currentAccount = getCurrentAccount();
    const currencySymbol = getCurrencySymbol(currentAccount?.currency);
    const depositSymbol = document.getElementById('depositCurrencySymbol');
    if (depositSymbol) depositSymbol.textContent = currencySymbol;
    
    if (modal) modal.classList.remove('hidden');
};

// Close deposit modal
window.closeDepositModal = () => {
    const modal = document.getElementById('depositModal');
    if (modal) modal.classList.add('hidden');
    document.getElementById('depositForm')?.reset();
};

// Open withdraw modal
window.openWithdrawModal = () => {
    const currentAccount = getCurrentAccount();
    const currencySymbol = getCurrencySymbol(currentAccount?.currency);
    const withdrawSymbol = document.getElementById('withdrawCurrencySymbol');
    if (withdrawSymbol) withdrawSymbol.textContent = currencySymbol;
    
    updateCurrentBalanceDisplay();
    
    const modal = document.getElementById('withdrawModal');
    const withdrawDate = document.getElementById('withdrawDate');
    if (withdrawDate) {
        withdrawDate.value = getCurrentDateTimeString();
    }
    
    if (modal) modal.classList.remove('hidden');
};

// Close withdraw modal
window.closeWithdrawModal = () => {
    const modal = document.getElementById('withdrawModal');
    if (modal) modal.classList.add('hidden');
    document.getElementById('withdrawForm')?.reset();
};

// Handle deposit form submission
document.addEventListener('DOMContentLoaded', () => {
    const depositForm = document.getElementById('depositForm');
    if (depositForm) {
        depositForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const amount = parseFloat(document.getElementById('depositAmount')?.value);
            const description = document.getElementById('depositDescription')?.value || '';
            const date = document.getElementById('depositDate')?.value || new Date().toISOString();
            
            if (!amount || amount <= 0) {
                alert('Please enter a valid deposit amount');
                return;
            }
            
            const submitBtn = depositForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerHTML;
            submitBtn.innerHTML = '<div class="loading-spinner"></div> Processing...';
            submitBtn.disabled = true;
            
            try {
                const transaction = {
                    type: 'deposit',
                    amount: amount,
                    description: description,
                    date: new Date(date).toISOString()
                };
                
                await saveTransaction(transaction);
                await loadTransactions();
                updateStats(allTrades);
                updateCurrentBalanceDisplay();
                
                closeDepositModal();
                showSuccessMessage(`Successfully deposited ${getCurrencySymbol()}${amount.toFixed(2)}!`);
                
                // Refresh trades to update stats
                await loadTrades();
                
            } catch (error) {
                console.error('Error processing deposit:', error);
                alert('Error processing deposit: ' + error.message);
            } finally {
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;
            }
        });
    }
    
    const withdrawForm = document.getElementById('withdrawForm');
    if (withdrawForm) {
        withdrawForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const amount = parseFloat(document.getElementById('withdrawAmount')?.value);
            const description = document.getElementById('withdrawDescription')?.value || '';
            const date = document.getElementById('withdrawDate')?.value || new Date().toISOString();
            const currentAccount = getCurrentAccount();
            
            if (!amount || amount <= 0) {
                alert('Please enter a valid withdrawal amount');
                return;
            }
            
            if (amount > getCurrentBalance()) {
                alert(`Insufficient funds. Available balance: ${getCurrencySymbol()}${getCurrentBalance().toFixed(2)}`);
                return;
            }
            
            const submitBtn = withdrawForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerHTML;
            submitBtn.innerHTML = '<div class="loading-spinner"></div> Processing...';
            submitBtn.disabled = true;
            
            try {
                const transaction = {
                    type: 'withdraw',
                    amount: amount,
                    description: description,
                    date: new Date(date).toISOString()
                };
                
                await saveTransaction(transaction);
                await loadTransactions();
                updateStats(allTrades);
                updateCurrentBalanceDisplay();
                
                closeWithdrawModal();
                showSuccessMessage(`Successfully withdrew ${getCurrencySymbol()}${amount.toFixed(2)}!`);
                
                // Refresh trades to update stats
                await loadTrades();
                
            } catch (error) {
                console.error('Error processing withdrawal:', error);
                alert('Error processing withdrawal: ' + error.message);
            } finally {
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;
            }
        });
    }
});

// Export transactions to CSV
window.exportTransactions = () => {
    if (transactions.length === 0) {
        alert('No transactions to export');
        return;
    }
    
    const currentAccount = getCurrentAccount();
    const currencySymbol = getCurrencySymbol(currentAccount?.currency);
    
    const headers = ['Date', 'Type', 'Amount', 'Description'];
    const csvRows = [headers.join(',')];
    
    transactions.forEach(transaction => {
        const row = [
            new Date(transaction.date).toLocaleString(),
            transaction.type,
            `${transaction.type === 'deposit' ? '+' : '-'}${currencySymbol}${transaction.amount.toFixed(2)}`,
            `"${(transaction.description || '').replace(/"/g, '""')}"`
        ];
        csvRows.push(row.join(','));
    });
    
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transactions-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    showSuccessMessage('Transactions exported successfully!');
};

// Settings section navigation
window.showSettingsSection = (section) => {
    // Hide all sections
    document.querySelectorAll('.settings-section').forEach(sec => {
        sec.classList.remove('active');
    });
    
    // Remove active class from all nav buttons
    document.querySelectorAll('.settings-nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Show selected section
    const selectedSection = document.getElementById(`${section}SettingsSection`);
    if (selectedSection) {
        selectedSection.classList.add('active');
    }
    
    // Add active class to clicked button
    const clickedBtn = document.querySelector(`.settings-nav-btn[data-section="${section}"]`);
    if (clickedBtn) {
        clickedBtn.classList.add('active');
    }
    
    // Load specific section data
    if (section === 'funds') {
        updateCurrentBalanceDisplay();
        renderTransactionHistory();
    } else if (section === 'verification') {
        if (typeof populateVerificationSymbols === 'function') {
            populateVerificationSymbols();
        }
    }
};

// Update the initializeAccounts function to include transaction loading
// Find the initializeAccounts function and add this line after loading accounts:
// await loadTransactions();

// Also update loadAccountData to include transactions
// In loadAccountData function, add: await loadTransactions();

// Update savePersonalInfo function
window.savePersonalInfo = () => {
    const fullName = document.getElementById('fullName')?.value || '';
    const displayName = document.getElementById('displayName')?.value || '';
    const experienceLevel = document.getElementById('experienceLevel')?.value || '';
    
    localStorage.setItem('userFullName', fullName);
    localStorage.setItem('userDisplayName', displayName);
    localStorage.setItem('userExperienceLevel', experienceLevel);
    
    showSuccessMessage('Personal information saved!');
    
    const btn = document.querySelector('#personalSettingsSection .bg-blue-500');
    if (btn) {
        const originalText = btn.textContent;
        btn.textContent = 'Saved!';
        setTimeout(() => btn.textContent = originalText, 1500);
    }
};

// Load saved personal info
function loadPersonalInfo() {
    const fullName = localStorage.getItem('userFullName') || '';
    const displayName = localStorage.getItem('userDisplayName') || '';
    const experienceLevel = localStorage.getItem('userExperienceLevel') || 'intermediate';
    
    const fullNameInput = document.getElementById('fullName');
    const displayNameInput = document.getElementById('displayName');
    const experienceSelect = document.getElementById('experienceLevel');
    
    if (fullNameInput) fullNameInput.value = fullName;
    if (displayNameInput) displayNameInput.value = displayName;
    if (experienceSelect) experienceSelect.value = experienceLevel;
}

// Load preferences
function loadPreferences() {
    const compactView = localStorage.getItem('compactView') === 'true';
    const confettiEnabled = localStorage.getItem('confettiEnabled') !== 'false';
    const autoSave = localStorage.getItem('autoSave') !== 'false';
    const defaultView = localStorage.getItem('defaultTradeView') || 'list';
    
    const compactToggle = document.getElementById('compactViewToggle');
    const confettiToggle = document.getElementById('confettiToggle');
    const autoSaveToggle = document.getElementById('autoSaveToggle');
    const defaultViewSelect = document.getElementById('defaultTradeView');
    
    if (compactToggle) compactToggle.checked = compactView;
    if (confettiToggle) confettiToggle.checked = confettiEnabled;
    if (autoSaveToggle) autoSaveToggle.checked = autoSave;
    if (defaultViewSelect) defaultViewSelect.value = defaultView;
    
    // Add event listeners for preferences
    if (compactToggle) {
        compactToggle.addEventListener('change', (e) => {
            localStorage.setItem('compactView', e.target.checked);
            location.reload();
        });
    }
    
    if (confettiToggle) {
        confettiToggle.addEventListener('change', (e) => {
            localStorage.setItem('confettiEnabled', e.target.checked);
        });
    }
    
    if (autoSaveToggle) {
        autoSaveToggle.addEventListener('change', (e) => {
            localStorage.setItem('autoSave', e.target.checked);
        });
    }
    
    if (defaultViewSelect) {
        defaultViewSelect.addEventListener('change', (e) => {
            localStorage.setItem('defaultTradeView', e.target.value);
        });
    }
}

// ========== THEME MANAGEMENT SYSTEM ==========

// ========== WORKING THEME MANAGEMENT SYSTEM ==========

// Initialize theme on page load
function initTheme() {
    console.log('[THEME] Initializing theme system...');
    
    // Get saved theme preference
    let savedTheme = localStorage.getItem('themePreference');
    
    // Validate saved theme
    if (!savedTheme || !['light', 'dark', 'system'].includes(savedTheme)) {
        savedTheme = 'light';
        localStorage.setItem('themePreference', savedTheme);
    }
    
    // Apply theme
    applyTheme(savedTheme);
    
    // Update theme selector in settings
    const themeSelect = document.getElementById('themeSelect');
    if (themeSelect) {
        themeSelect.value = savedTheme;
    }
    
    console.log('[THEME] Theme initialized to:', savedTheme);
}

// Apply theme to document
function applyTheme(themeName) {
    console.log('[THEME] Applying theme:', themeName);
    
    // Remove existing theme classes
    document.body.classList.remove('light-theme', 'dark-theme');
    
    if (themeName === 'system') {
        // Check system preference
        const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (isDarkMode) {
            document.body.classList.add('dark-theme');
            document.body.classList.remove('light-theme');
        } else {
            document.body.classList.add('light-theme');
            document.body.classList.remove('dark-theme');
        }
        
        // Listen for system preference changes
        if (window.themeMediaListener) {
            window.themeMediaListener.removeEventListener('change', handleSystemThemeChange);
        }
        window.themeMediaListener = window.matchMedia('(prefers-color-scheme: dark)');
        window.themeMediaListener.addEventListener('change', handleSystemThemeChange);
        
    } else if (themeName === 'dark') {
        document.body.classList.add('dark-theme');
        document.body.classList.remove('light-theme');
    } else {
        document.body.classList.add('light-theme');
        document.body.classList.remove('dark-theme');
    }
    
    // Update any theme-dependent UI elements
    updateThemeIcon(themeName);
}

// Handle system theme changes
function handleSystemThemeChange(e) {
    const currentTheme = localStorage.getItem('themePreference');
    if (currentTheme === 'system') {
        if (e.matches) {
            document.body.classList.add('dark-theme');
            document.body.classList.remove('light-theme');
        } else {
            document.body.classList.add('light-theme');
            document.body.classList.remove('dark-theme');
        }
        console.log('[THEME] System theme changed to:', e.matches ? 'dark' : 'light');
    }
}

// Handle theme change from select dropdown
function handleThemeChangeFromSelect(event) {
    const newTheme = event.target.value;
    console.log('[THEME] Theme changed to:', newTheme);
    
    applyTheme(newTheme);
    localStorage.setItem('themePreference', newTheme);
    
    // Show success message
    showSuccessMessage(`Theme changed to ${getThemeDisplayName(newTheme)}`);
}

// Get display name for theme
function getThemeDisplayName(themeName) {
    const names = {
        'light': 'Light',
        'dark': 'Dark',
        'system': 'System Default'
    };
    return names[themeName] || 'Light';
}

// Update theme icon in sidebar (if exists)
function updateThemeIcon(themeName) {
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        const iconSpan = themeToggle.querySelector('.icon i');
        if (iconSpan) {
            if (themeName === 'dark') {
                iconSpan.className = 'fas fa-moon';
            } else if (themeName === 'light') {
                iconSpan.className = 'fas fa-sun';
            } else {
                // System - check current effective theme
                const isDark = document.body.classList.contains('dark-theme');
                iconSpan.className = isDark ? 'fas fa-moon' : 'fas fa-sun';
            }
        }
    }
}

// Toggle between light and dark (for sidebar button)
function toggleTheme() {
    const currentTheme = localStorage.getItem('themePreference') || 'light';
    let newTheme;
    
    if (currentTheme === 'light') {
        newTheme = 'dark';
    } else if (currentTheme === 'dark') {
        newTheme = 'light';
    } else {
        // If system, check current effective theme
        const isDark = document.body.classList.contains('dark-theme');
        newTheme = isDark ? 'light' : 'dark';
    }
    
    applyTheme(newTheme);
    localStorage.setItem('themePreference', newTheme);
    
    // Update select dropdown if it exists
    const themeSelect = document.getElementById('themeSelect');
    if (themeSelect) {
        themeSelect.value = newTheme;
    }
    
    showSuccessMessage(`Theme changed to ${getThemeDisplayName(newTheme)}`);
}

// Setup theme event listeners
function setupThemeListeners() {
    console.log('[THEME] Setting up theme listeners...');
    
    const themeSelect = document.getElementById('themeSelect');
    if (themeSelect) {
        // Remove existing listener to avoid duplicates
        const newSelect = themeSelect.cloneNode(true);
        themeSelect.parentNode.replaceChild(newSelect, themeSelect);
        
        // Add new listener
        newSelect.addEventListener('change', handleThemeChangeFromSelect);
        console.log('[THEME] Theme select listener attached');
    } else {
        console.warn('[THEME] Theme select element not found');
    }
    
    // Also look for theme toggle button in sidebar
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        const newToggle = themeToggle.cloneNode(true);
        themeToggle.parentNode.replaceChild(newToggle, themeToggle);
        newToggle.addEventListener('click', toggleTheme);
        console.log('[THEME] Theme toggle button listener attached');
    }
}

// Load all preferences including theme
function loadAllPreferences() {
    console.log('[PREFERENCES] Loading all preferences...');
    
    // Theme is handled by initTheme, but ensure select is synced
    const savedTheme = localStorage.getItem('themePreference') || 'light';
    const themeSelect = document.getElementById('themeSelect');
    if (themeSelect && themeSelect.value !== savedTheme) {
        themeSelect.value = savedTheme;
    }
    
    // Load other preferences
    const compactView = localStorage.getItem('compactView') === 'true';
    const confettiEnabled = localStorage.getItem('confettiEnabled') !== 'false';
    const autoSave = localStorage.getItem('autoSave') !== 'false';
    const defaultView = localStorage.getItem('defaultTradeView') || 'list';
    
    const compactToggle = document.getElementById('compactViewToggle');
    const confettiToggle = document.getElementById('confettiToggle');
    const autoSaveToggle = document.getElementById('autoSaveToggle');
    const defaultViewSelect = document.getElementById('defaultTradeView');
    
    if (compactToggle) compactToggle.checked = compactView;
    if (confettiToggle) confettiToggle.checked = confettiEnabled;
    if (autoSaveToggle) autoSaveToggle.checked = autoSave;
    if (defaultViewSelect) defaultViewSelect.value = defaultView;
    
    // Apply compact view if enabled
    if (compactView) {
        document.body.classList.add('compact-view');
    } else {
        document.body.classList.remove('compact-view');
    }
    
    // Setup preference listeners
    setupPreferenceListeners();
    
    console.log('[PREFERENCES] Preferences loaded:', { compactView, confettiEnabled, autoSave, defaultView });
}

// Setup preference event listeners
function setupPreferenceListeners() {
    const compactToggle = document.getElementById('compactViewToggle');
    const confettiToggle = document.getElementById('confettiToggle');
    const autoSaveToggle = document.getElementById('autoSaveToggle');
    const defaultViewSelect = document.getElementById('defaultTradeView');
    
    if (compactToggle) {
        const newToggle = compactToggle.cloneNode(true);
        compactToggle.parentNode.replaceChild(newToggle, compactToggle);
        newToggle.addEventListener('change', (e) => {
            localStorage.setItem('compactView', e.target.checked);
            if (e.target.checked) {
                document.body.classList.add('compact-view');
            } else {
                document.body.classList.remove('compact-view');
            }
            showSuccessMessage(e.target.checked ? 'Compact view enabled' : 'Compact view disabled');
        });
    }
    
    if (confettiToggle) {
        const newToggle = confettiToggle.cloneNode(true);
        confettiToggle.parentNode.replaceChild(newToggle, confettiToggle);
        newToggle.addEventListener('change', (e) => {
            localStorage.setItem('confettiEnabled', e.target.checked);
            showSuccessMessage(e.target.checked ? 'Confetti enabled' : 'Confetti disabled');
        });
    }
    
    if (autoSaveToggle) {
        const newToggle = autoSaveToggle.cloneNode(true);
        autoSaveToggle.parentNode.replaceChild(newToggle, autoSaveToggle);
        newToggle.addEventListener('change', (e) => {
            localStorage.setItem('autoSave', e.target.checked);
            showSuccessMessage(e.target.checked ? 'Auto-save enabled' : 'Auto-save disabled');
        });
    }
    
    if (defaultViewSelect) {
        const newSelect = defaultViewSelect.cloneNode(true);
        defaultViewSelect.parentNode.replaceChild(newSelect, defaultViewSelect);
        newSelect.addEventListener('change', (e) => {
            localStorage.setItem('defaultTradeView', e.target.value);
            showSuccessMessage(`Default view set to ${e.target.value}`);
        });
    }
}

// Show confetti for winning trades
function showConfetti() {
    const confettiEnabled = localStorage.getItem('confettiEnabled') !== 'false';
    if (!confettiEnabled) return;
    
    // Check if canvas-confetti is available
    if (typeof confetti === 'function') {
        confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#10b981', '#3b82f6', '#f59e0b', '#ef4444']
        });
    } else {
        // Simple fallback
        console.log('[CONFETTI] Winning trade! 🎉');
    }
}

// ========== INITIALIZATION ==========

document.addEventListener('DOMContentLoaded', function() {
    console.log('Trading Journal with Deriv Instruments, MT4/5 Import, and All Improvements initialized');
    hideLoading();
    initVerificationTool();
});

