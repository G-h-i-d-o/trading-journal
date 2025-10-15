// app.js - COMPLETE FIXED VERSION WITH SCREENSHOT FIXES AND NO EDIT BUTTON
import { 
    auth, db, onAuthStateChanged, signOut, 
    collection, addDoc, getDocs, query, where, doc, deleteDoc, updateDoc, getDoc
} from './firebase-config.js';

let currentUser = null;
let performanceChart = null;
let winLossChart = null;
let marketTypeChart = null;
let editingTradeId = null;

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

// Currency utility functions
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
    if (loadingIndicator) loadingIndicator.style.display = 'flex';
}

function hideLoading() {
    const loadingIndicator = document.getElementById('loadingIndicator');
    if (loadingIndicator) loadingIndicator.style.display = 'none';
}

// Tab Management
function setupTabs() {
    const dashboardTab = document.getElementById('dashboardTab');
    const tradesTab = document.getElementById('tradesTab');
    const dashboardContent = document.getElementById('dashboardContent');
    const tradesContent = document.getElementById('tradesContent');

    if (dashboardTab && tradesTab) {
        dashboardTab.addEventListener('click', () => {
            dashboardTab.classList.add('active');
            tradesTab.classList.remove('active');
            dashboardContent.classList.add('active');
            dashboardContent.classList.remove('hidden');
            tradesContent.classList.remove('active');
            tradesContent.classList.add('hidden');
        });

        tradesTab.addEventListener('click', () => {
            tradesTab.classList.add('active');
            dashboardTab.classList.remove('active');
            tradesContent.classList.add('active');
            tradesContent.classList.remove('hidden');
            dashboardContent.classList.remove('active');
            dashboardContent.classList.add('hidden');
        });
    }
}

// Mobile Menu Toggle
function setupMobileMenu() {
    const mobileMenuButton = document.getElementById('mobileMenuButton');
    const mobileMenu = document.getElementById('mobileMenu');
    const mobileUserEmail = document.getElementById('mobile-user-email');

    if (mobileMenuButton && mobileMenu) {
        mobileMenuButton.addEventListener('click', () => {
            mobileMenu.classList.toggle('hidden');
        });

        document.addEventListener('click', (e) => {
            if (!mobileMenu.contains(e.target) && !mobileMenuButton.contains(e.target)) {
                mobileMenu.classList.add('hidden');
            }
        });
    }

    if (mobileUserEmail && currentUser) {
        mobileUserEmail.textContent = currentUser.email;
    }
}

// Authentication
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        document.getElementById('user-email').textContent = user.email;
        showLoading();
        await loadUserSettings();
        await loadTrades();
        setupEventListeners();
        setupTabs();
        setupMobileMenu();
        hideLoading();
    } else {
        window.location.href = 'index.html';
    }
});

window.logout = async () => {
    try {
        await signOut(auth);
    } catch (error) {
        console.error('Logout error:', error);
        alert('Error logging out.');
    }
};

function setupEventListeners() {
    const tradeForm = document.getElementById('tradeForm');
    if (tradeForm) {
        tradeForm.addEventListener('submit', (e) => {
            e.preventDefault();
            if (editingTradeId) {
                updateTrade(editingTradeId, e);
            } else {
                addTrade(e);
            }
        });
    }

    // Account settings listeners
    ['accountSize', 'riskPerTrade', 'leverage'].forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('change', (e) => {
                const value = id === 'accountSize' || id === 'riskPerTrade' ? 
                    parseFloat(e.target.value) : parseInt(e.target.value);
                localStorage.setItem(id, value);
                if (id === 'accountSize') {
                    updateStats();
                    renderCharts();
                }
                updateRiskCalculation();
            });
        }
    });

    // Currency change listener - this sets the base currency
    const accountCurrency = document.getElementById('accountCurrency');
    if (accountCurrency) {
        accountCurrency.addEventListener('change', (e) => {
            const newCurrency = e.target.value;
            localStorage.setItem('accountCurrency', newCurrency);
            
            // Update the account balance label to show the new currency
            updateCurrencyDisplay();
            
            // Refresh all displays with new currency
            updateStats();
            renderCharts();
            updateRiskCalculation();
            loadTrades();
        });
    }

    // Trade form listeners
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
}

// Update currency display throughout the app
function updateCurrencyDisplay() {
    const selectedCurrency = getSelectedCurrency();
    const currencySymbol = getCurrencySymbol();
    
    // Update account balance label
    const accountBalanceLabel = document.querySelector('label[for="accountSize"]');
    if (accountBalanceLabel) {
        accountBalanceLabel.textContent = `Account Balance (${currencySymbol})`;
    }
    
    // Update stats labels if they exist
    const balanceStat = document.querySelector('.stat-card:nth-child(4) .text-xs');
    if (balanceStat) {
        balanceStat.textContent = `Balance (${currencySymbol})`;
    }
    
    console.log(`Currency updated to: ${selectedCurrency} (${currencySymbol})`);
}

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
        return pips * pipValue;
    } else {
        const pointValue = getPointValue(symbol) * lotSize;
        const points = type === 'long' ? (exit - entry) : (entry - exit);
        return points * pointValue;
    }
}

function updateRiskCalculation() {
    const symbol = document.getElementById('symbol')?.value;
    const entryPrice = parseFloat(document.getElementById('entryPrice')?.value) || 0;
    const stopLoss = parseFloat(document.getElementById('stopLoss')?.value) || 0;
    const takeProfit = parseFloat(document.getElementById('takeProfit')?.value) || 0;
    const lotSize = parseFloat(document.getElementById('lotSize')?.value) || 0.01;
    const tradeType = document.getElementById('direction')?.value;
    const accountSize = parseFloat(document.getElementById('accountSize')?.value) || 10000;
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
        const accountSize = parseFloat(document.getElementById('accountSize')?.value) || 10000;
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
            userId: currentUser.uid
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

async function updateTrade(tradeId, e) {
    e.preventDefault();
    const submitButton = e.target.querySelector('button[type="submit"]');
    const originalText = submitButton.innerHTML;
    submitButton.innerHTML = '<div class="loading-spinner"></div> Updating...';
    submitButton.disabled = true;

    try {
        const symbol = document.getElementById('symbol')?.value;
        const entryPrice = parseFloat(document.getElementById('entryPrice')?.value);
        const stopLoss = parseFloat(document.getElementById('stopLoss')?.value);
        const takeProfit = parseFloat(document.getElementById('takeProfit')?.value) || null;
        const lotSize = parseFloat(document.getElementById('lotSize')?.value);
        const tradeType = document.getElementById('direction')?.value;
        const mood = document.getElementById('mood')?.value || '';
        const accountSize = parseFloat(document.getElementById('accountSize')?.value) || 10000;
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
            userId: currentUser.uid
        };

        await updateDoc(doc(db, 'trades', tradeId), tradeData);
        e.target.reset();
        cancelEdit();
        await loadTrades();
        alert('Trade updated successfully!');
    } catch (error) {
        console.error('Error updating trade:', error);
        alert('Error updating trade.');
    } finally {
        submitButton.innerHTML = originalText;
        submitButton.disabled = false;
    }
}

async function loadTrades() {
    try {
        showLoading();
        if (!currentUser) return;

        const q = query(collection(db, 'trades'), where('userId', '==', currentUser.uid));
        const querySnapshot = await getDocs(q);
        
        const trades = [];
        querySnapshot.forEach((doc) => {
            trades.push({ id: doc.id, ...doc.data() });
        });

        trades.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        displayTrades(trades);
        updateStats(trades);
        renderCharts(trades);
        calculateAdvancedMetrics(trades);
    } catch (error) {
        console.error('Error loading trades:', error);
        const tradeHistory = document.getElementById('tradeHistory');
        if (tradeHistory) {
            tradeHistory.innerHTML = `
                <div class="text-center text-red-500 py-4">
                    <p>Error loading trades. Please refresh the page.</p>
                    <button onclick="location.reload()" class="btn bg-blue-500 text-white mt-2">🔄 Refresh</button>
                </div>
            `;
        }
    } finally {
        hideLoading();
    }
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

    if (tradeCount) tradeCount.textContent = `${trades.length} trade${trades.length !== 1 ? 's' : ''}`;
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

// Fixed screenshot viewer function
window.viewScreenshot = (url) => {
    // Validate and clean the URL
    let cleanedUrl = url.trim();
    
    // Add https:// if no protocol is specified
    if (!cleanedUrl.startsWith('http://') && !cleanedUrl.startsWith('https://')) {
        cleanedUrl = 'https://' + cleanedUrl;
    }
    
    // Validate it's a proper URL
    try {
        new URL(cleanedUrl);
    } catch (e) {
        alert('Invalid screenshot URL. Please check the URL format.');
        return;
    }

    const modal = document.getElementById('screenshotModal');
    const image = document.getElementById('screenshotImage');
    
    if (modal && image) {
        // Show loading state
        image.src = '';
        image.alt = 'Loading screenshot...';
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        
        let hasLoaded = false;
        let errorShown = false;
        
        // Set image source with better error handling
        image.onload = function() {
            console.log('Screenshot loaded successfully:', cleanedUrl);
            hasLoaded = true;
            // Clear any previous error state
            image.alt = 'Trade Screenshot';
        };
        
        image.onerror = function() {
            console.error('Failed to load screenshot:', cleanedUrl);
            
            // Only show error if image hasn't loaded and we haven't shown an error yet
            if (!hasLoaded && !errorShown) {
                errorShown = true;
                image.alt = 'Failed to load screenshot. The image may be blocked by CORS policy or the URL may be incorrect.';
                
                // Don't show alert if the image is from a known image hosting service
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
        
        // Set a timeout to handle cases where the image loads but has issues
        setTimeout(() => {
            if (!hasLoaded && !errorShown) {
                console.log('Screenshot loading taking longer than expected:', cleanedUrl);
                // Don't show error immediately, let the natural loading continue
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
        // Clear the image source when closing
        const image = document.getElementById('screenshotImage');
        if (image) {
            image.src = '';
            image.alt = '';
        }
    }
};

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

// Analytics and Metrics
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

function updateStats(trades) {
    const accountSize = parseFloat(document.getElementById('accountSize')?.value) || 10000;
    const stats = {
        'totalTrades': '0', 
        'winRate': '0%', 
        'totalPL': formatCurrency(0), 
        'currentBalance': formatCurrency(accountSize), 
        'recentStats': 'No trades yet', 
        'symbolStats': 'No data'
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

        const recentTrades = trades.slice(0, 3);
        const recentProfit = recentTrades.reduce((sum, trade) => sum + trade.profit, 0);
        stats.recentStats = `Last 3: ${formatCurrency(recentProfit)}`;

        const symbolStats = calculateSymbolStats(trades);
        stats.symbolStats = symbolStats.slice(0, 3).map(stat => 
            `${stat.symbol}: ${formatCurrency(stat.totalProfit)}`
        ).join('<br>');
    }

    Object.entries(stats).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) {
            if (id === 'symbolStats') {
                element.innerHTML = value;
            } else {
                element.textContent = value;
            }
            
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

function calculateSymbolStats(trades) {
    const symbolMap = {};
    trades.forEach(trade => {
        if (!symbolMap[trade.symbol]) symbolMap[trade.symbol] = { trades: [], totalProfit: 0 };
        symbolMap[trade.symbol].trades.push(trade);
        symbolMap[trade.symbol].totalProfit += trade.profit;
    });
    return Object.entries(symbolMap).map(([symbol, data]) => {
        const winningTrades = data.trades.filter(t => t.profit > 0).length;
        const winRate = data.trades.length > 0 ? ((winningTrades / data.trades.length) * 100).toFixed(1) : '0';
        return { symbol, totalProfit: data.totalProfit, winRate };
    }).sort((a, b) => b.totalProfit - a.totalProfit);
}

async function loadUserSettings() {
    const accountSize = localStorage.getItem('accountSize') || 10000;
    const riskPerTrade = localStorage.getItem('riskPerTrade') || 1.0;
    const accountCurrency = localStorage.getItem('accountCurrency') || 'USD';
    const leverage = localStorage.getItem('leverage') || 50;

    document.getElementById('accountSize').value = accountSize;
    document.getElementById('riskPerTrade').value = riskPerTrade;
    document.getElementById('accountCurrency').value = accountCurrency;
    document.getElementById('leverage').value = leverage;
    
    // Update currency display when loading settings
    updateCurrencyDisplay();
}

window.exportTrades = async () => {
    try {
        if (!currentUser) return;
        const q = query(collection(db, 'trades'), where('userId', '==', currentUser.uid));
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
    
    const headers = ['Date', 'Symbol', 'Type', 'Entry', 'SL', 'TP', 'Lots', `Profit (${currencyName})`, `Risk Amount (${currencyName})`, 'Risk %', 'Mood', 'Notes'];
    const csvRows = [headers.join(',')];
    
    trades.forEach(trade => {
        const row = [
            new Date(trade.timestamp).toLocaleDateString(),
            trade.symbol,
            trade.type,
            trade.entryPrice,
            trade.stopLoss,
            trade.takeProfit || '',
            trade.lotSize,
            trade.profit,
            trade.riskAmount,
            trade.riskPercent,
            trade.mood || '',
            `"${(trade.notes || '').replace(/"/g, '""')}"`
        ];
        csvRows.push(row.join(','));
    });
    
    return csvRows.join('\n');
}

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
    
    const accountSize = parseFloat(document.getElementById('accountSize')?.value) || 10000;
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
    console.log('Trading Journal initialized');
});