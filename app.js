// app.js
import { 
    auth, db, onAuthStateChanged, signOut, 
    collection, addDoc, getDocs, query, where, doc, deleteDoc, updateDoc, getDoc
} from './firebase-config.js';

let currentUser = null;
let performanceChart = null;
let winLossChart = null;
let marketTypeChart = null;
let editingTradeId = null;

// Show loading indicator
function showLoading() {
    const loadingIndicator = document.getElementById('loadingIndicator');
    if (loadingIndicator) {
        loadingIndicator.style.display = 'flex';
    }
}

// Hide loading indicator
function hideLoading() {
    const loadingIndicator = document.getElementById('loadingIndicator');
    if (loadingIndicator) {
        loadingIndicator.style.display = 'none';
    }
}

// Check authentication state
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        document.getElementById('user-email').textContent = user.email;
        showLoading();
        await loadUserSettings();
        await loadTrades();
        setupEventListeners();
        hideLoading();
    } else {
        window.location.href = 'index.html';
    }
});

// Logout function
window.logout = async () => {
    try {
        await signOut(auth);
    } catch (error) {
        console.error('Logout error:', error);
        alert('Error logging out. Please try again.');
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

    // Account settings
    ['accountSize', 'riskPerTrade', 'accountCurrency', 'leverage'].forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('change', (e) => {
                const value = id === 'accountSize' || id === 'riskPerTrade' ? 
                    parseFloat(e.target.value) : id === 'leverage' ? 
                    parseInt(e.target.value) : e.target.value;
                
                localStorage.setItem(id, value);
                
                if (id === 'accountSize') {
                    updateStats();
                    renderCharts();
                }
                if (id !== 'accountCurrency') {
                    updateRiskCalculation();
                }
            });
        }
    });

    // Real-time risk calculation
    ['entryPrice', 'stopLoss', 'takeProfit', 'lotSize', 'direction', 'symbol'].forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('input', () => updateRiskCalculation());
            element.addEventListener('change', () => updateRiskCalculation());
        }
    });

    // Instrument type display
    const symbolSelect = document.getElementById('symbol');
    if (symbolSelect) {
        symbolSelect.addEventListener('change', updateInstrumentType);
    }

    // Initialize risk calculation
    updateRiskCalculation();
}

function getInstrumentType(symbol) {
    const forexPairs = ['EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CHF', 'AUD/USD', 'USD/CAD', 'NZD/USD'];
    const indices = ['US30', 'SPX500', 'NAS100', 'GE30', 'FTSE100', 'NIKKEI225'];
    
    return forexPairs.includes(symbol) ? 'forex' : indices.includes(symbol) ? 'indices' : 'forex';
}

function getPipSize(symbol) {
    return symbol.includes('JPY') ? 0.01 : 0.0001;
}

function getPointValue(symbol) {
    const pointValues = {
        'US30': 1, 'SPX500': 50, 'NAS100': 20, 
        'GE30': 1, 'FTSE100': 1, 'NIKKEI225': 1
    };
    return pointValues[symbol] || 1;
}

function calculatePipsPoints(entry, sl, tp, symbol, type) {
    const instrumentType = getInstrumentType(symbol);
    
    if (instrumentType === 'forex') {
        const pipSize = getPipSize(symbol);
        const slPips = type === 'long' ? (entry - sl) / pipSize : (sl - entry) / pipSize;
        let tpPips = 0;
        if (tp) {
            tpPips = type === 'long' ? (tp - entry) / pipSize : (entry - tp) / pipSize;
        }
        return { risk: Math.abs(slPips), reward: Math.abs(tpPips) };
    } else {
        const slPoints = type === 'long' ? (entry - sl) : (sl - entry);
        let tpPoints = 0;
        if (tp) {
            tpPoints = type === 'long' ? (tp - entry) : (entry - tp);
        }
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

        // Update risk display
        const riskElements = {
            'pipsRisk': pipPointInfo.risk.toFixed(1) + ' ' + unitType,
            'totalRisk': Math.abs(potentialLoss).toFixed(2),
            'riskPercentage': (Math.abs(potentialLoss) / accountSize * 100).toFixed(2) + '%',
            'riskRewardRatio': riskRewardRatio.toFixed(2),
            'recommendedLotSize': recommendedLotSize
        };

        Object.entries(riskElements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) element.textContent = value;
        });

        // Update pip/point displays
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
        if (displayElement) {
            displayElement.innerHTML = `<span class="market-type-badge ${badgeClass}">${displayText}</span>`;
        }
        updateRiskCalculation();
    }
};

// Add new trade
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
            beforeScreenshot: document.getElementById('beforeScreenshot')?.value || '',
            afterScreenshot: document.getElementById('afterScreenshot')?.value || '',
            notes: document.getElementById('notes')?.value || '',
            timestamp: new Date().toISOString(),
            profit,
            pipsPoints: pipPointInfo.risk,
            riskAmount: Math.abs(calculateProfitLoss(entryPrice, stopLoss, lotSize, symbol, tradeType)),
            riskPercent: (Math.abs(calculateProfitLoss(entryPrice, stopLoss, lotSize, symbol, tradeType)) / accountSize) * 100,
            accountSize: accountSize,
            leverage: leverage,
            userId: currentUser.uid
        };

        await addDoc(collection(db, 'trades'), tradeData);
        
        // Clear form
        e.target.reset();
        
        // Reload trades
        await loadTrades();
        
        alert('Trade added successfully!');
    } catch (error) {
        console.error('Error adding trade:', error);
        alert('Error adding trade. Please try again.');
    } finally {
        submitButton.innerHTML = originalText;
        submitButton.disabled = false;
    }
}

// Update existing trade - FIXED VERSION
async function updateTrade(tradeId, e) {
    console.log('💾 Updating trade:', tradeId);
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
            beforeScreenshot: document.getElementById('beforeScreenshot')?.value || '',
            afterScreenshot: document.getElementById('afterScreenshot')?.value || '',
            notes: document.getElementById('notes')?.value || '',
            timestamp: new Date().toISOString(), // Update timestamp
            profit,
            pipsPoints: pipPointInfo.risk,
            riskAmount: Math.abs(calculateProfitLoss(entryPrice, stopLoss, lotSize, symbol, tradeType)),
            riskPercent: (Math.abs(calculateProfitLoss(entryPrice, stopLoss, lotSize, symbol, tradeType)) / accountSize) * 100,
            accountSize: accountSize,
            leverage: leverage,
            userId: currentUser.uid
        };

        console.log('💾 Updating trade in Firestore:', tradeId, tradeData);
        await updateDoc(doc(db, 'trades', tradeId), tradeData);
        console.log('✅ Trade updated successfully');
        
        // Clear form and reset editing state
        e.target.reset();
        cancelEdit();
        
        // Reload trades
        await loadTrades();
        
        alert('Trade updated successfully!');
    } catch (error) {
        console.error('❌ Error updating trade:', error);
        console.error('Error details:', error.message);
        alert('Error updating trade. Please try again.');
    } finally {
        submitButton.innerHTML = originalText;
        submitButton.disabled = false;
    }
}

// Load trades from Firestore
async function loadTrades() {
    try {
        showLoading();
        const q = query(collection(db, 'trades'), where('userId', '==', currentUser.uid));
        const querySnapshot = await getDocs(q);
        
        const trades = [];
        querySnapshot.forEach((doc) => {
            trades.push({ id: doc.id, ...doc.data() });
        });

        // Sort by timestamp (newest first)
        trades.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        displayTrades(trades);
        updateStats(trades);
        renderCharts(trades);
    } catch (error) {
        console.error('Error loading trades:', error);
        alert('Error loading trades. Please refresh the page.');
    } finally {
        hideLoading();
    }
}

// Display trades in table
function displayTrades(trades) {
    const container = document.getElementById('tradeHistory');
    const tradeCount = document.getElementById('tradeCount');
    
    if (!container) return;

    if (trades.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-500 py-4">No trades recorded yet. Add your first trade above!</p>';
        tradeCount.textContent = '0 trades';
        return;
    }

    tradeCount.textContent = `${trades.length} trade${trades.length !== 1 ? 's' : ''}`;
    
    container.innerHTML = trades.map(trade => {
        const badgeClass = trade.instrumentType === 'forex' ? 'forex-badge' : 'indices-badge';
        const badgeText = trade.instrumentType === 'forex' ? 'FX' : 'IDX';
        const profitClass = trade.profit >= 0 ? 'profit' : 'loss';
        const unitType = trade.instrumentType === 'forex' ? 'pips' : 'points';
        
        return `
        <div class="trade-item">
            <div class="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
                <div class="flex-1 min-w-0">
                    <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1 mb-2">
                        <div class="font-semibold text-sm sm:text-base">
                            ${trade.symbol} <span class="market-type-badge ${badgeClass}">${badgeText}</span>
                        </div>
                        <div class="${profitClass} font-bold text-sm sm:text-base">
                            $${trade.profit.toFixed(2)}
                        </div>
                    </div>
                    <div class="text-xs text-gray-600 space-y-1">
                        <div>${trade.type.toUpperCase()} | ${trade.lotSize} lots | Entry: ${trade.entryPrice}</div>
                        <div>SL: ${trade.stopLoss}${trade.takeProfit ? ` | TP: ${trade.takeProfit}` : ''}</div>
                        <div>Risk: $${trade.riskAmount.toFixed(2)} (${trade.riskPercent.toFixed(1)}%)</div>
                        <div class="text-gray-500">${new Date(trade.timestamp).toLocaleDateString()} ${new Date(trade.timestamp).toLocaleTimeString()}</div>
                    </div>
                    ${trade.notes ? `<div class="mt-2 text-xs italic text-gray-700 bg-gray-50 p-2 rounded">${trade.notes}</div>` : ''}
                </div>
                <div class="trade-actions">
                    ${trade.beforeScreenshot ? `
                        <button onclick="viewScreenshot('${trade.beforeScreenshot}')" class="btn-sm bg-blue-500 text-white text-xs">
                            📸 Before
                        </button>
                    ` : ''}
                    ${trade.afterScreenshot ? `
                        <button onclick="viewScreenshot('${trade.afterScreenshot}')" class="btn-sm bg-green-500 text-white text-xs">
                            📸 After
                        </button>
                    ` : ''}
                    <button onclick="editTrade('${trade.id}')" class="btn-sm bg-yellow-500 text-white text-xs">
                        ✏️ Edit
                    </button>
                    <button onclick="deleteTrade('${trade.id}')" class="btn-sm bg-red-500 text-white text-xs">
                        🗑️ Delete
                    </button>
                </div>
            </div>
        </div>
    `}).join('');
}

// View screenshot in modal
window.viewScreenshot = (url) => {
    const modal = document.getElementById('screenshotModal');
    const image = document.getElementById('screenshotImage');
    
    if (modal && image) {
        image.src = url;
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
}

// Close screenshot modal
window.closeScreenshotModal = () => {
    const modal = document.getElementById('screenshotModal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
}

// Edit trade - FIXED VERSION
window.editTrade = async (tradeId) => {
    console.log('✏️ Editing trade:', tradeId);
    try {
        showLoading();
        
        // Get the specific trade document directly
        const tradeDoc = doc(db, 'trades', tradeId);
        const tradeSnapshot = await getDoc(tradeDoc);
        
        if (tradeSnapshot.exists()) {
            const tradeData = { id: tradeSnapshot.id, ...tradeSnapshot.data() };
            console.log('📄 Trade data loaded for editing:', tradeData);
            
            // Verify this trade belongs to the current user
            if (tradeData.userId !== currentUser.uid) {
                alert('You can only edit your own trades.');
                return;
            }
            
            // Fill form with trade data
            document.getElementById('symbol').value = tradeData.symbol;
            document.getElementById('direction').value = tradeData.type;
            document.getElementById('entryPrice').value = tradeData.entryPrice;
            document.getElementById('stopLoss').value = tradeData.stopLoss;
            document.getElementById('takeProfit').value = tradeData.takeProfit || '';
            document.getElementById('lotSize').value = tradeData.lotSize;
            document.getElementById('beforeScreenshot').value = tradeData.beforeScreenshot || '';
            document.getElementById('afterScreenshot').value = tradeData.afterScreenshot || '';
            document.getElementById('notes').value = tradeData.notes || '';
            
            // Update form title and button
            const formTitle = document.querySelector('#tradeForm .section-title');
            const submitButton = document.querySelector('#tradeForm button[type="submit"]');
            
            if (formTitle) formTitle.textContent = '✏️ Edit Trade';
            if (submitButton) submitButton.innerHTML = '<span id="submitButtonText">💾 Update Trade</span>';
            
            // Set editing state
            editingTradeId = tradeId;
            
            // Update risk calculation and instrument type
            updateRiskCalculation();
            updateInstrumentType();
            
            // Scroll to form
            document.getElementById('tradeForm').scrollIntoView({ behavior: 'smooth' });
            
            console.log('✅ Form populated for editing');
        } else {
            console.error('❌ Trade not found:', tradeId);
            alert('Trade not found. It may have been deleted.');
        }
    } catch (error) {
        console.error('❌ Error loading trade for edit:', error);
        console.error('Error details:', error.message);
        alert('Error loading trade for editing. Please try again.');
    } finally {
        hideLoading();
    }
}

// Cancel edit
function cancelEdit() {
    editingTradeId = null;
    const formTitle = document.querySelector('#tradeForm .section-title');
    const submitButton = document.querySelector('#tradeForm button[type="submit"]');
    
    if (formTitle) formTitle.textContent = '📝 New Trade';
    if (submitButton) submitButton.innerHTML = '<span id="submitButtonText">💾 Save Trade</span>';
    
    console.log('❌ Edit cancelled');
}

// Update statistics
function updateStats(trades) {
    const accountSize = parseFloat(document.getElementById('accountSize')?.value) || 10000;
    
    const stats = {
        'totalTrades': '0',
        'winRate': '0%',
        'totalPL': '$0',
        'currentBalance': `$${accountSize.toFixed(2)}`,
        'recentStats': 'No trades yet',
        'symbolStats': 'No data'
    };

    if (trades.length > 0) {
        const totalTrades = trades.length;
        const winningTrades = trades.filter(t => t.profit > 0).length;
        const winRate = ((winningTrades / totalTrades) * 100).toFixed(1);
        const totalPL = trades.reduce((sum, trade) => sum + trade.profit, 0);
        const currentBalance = accountSize + totalPL;

        stats.totalTrades = totalTrades;
        stats.winRate = `${winRate}%`;
        stats.totalPL = `$${totalPL.toFixed(2)}`;
        stats.currentBalance = `$${currentBalance.toFixed(2)}`;

        // Recent stats
        const recentTrades = trades.slice(0, 3);
        const recentProfit = recentTrades.reduce((sum, trade) => sum + trade.profit, 0);
        stats.recentStats = `Last 3: $${recentProfit.toFixed(2)}`;

        // Symbol stats
        const symbolStats = calculateSymbolStats(trades);
        stats.symbolStats = symbolStats.slice(0, 3).map(stat => 
            `${stat.symbol}: $${stat.totalProfit.toFixed(0)}`
        ).join('<br>');
    }

    // Update all stat elements
    Object.entries(stats).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
            // Add color coding for P&L and Balance
            if (id === 'totalPL') {
                const plValue = parseFloat(value.replace('$', ''));
                element.className = `stat-value ${plValue >= 0 ? 'profit' : 'loss'}`;
            } else if (id === 'currentBalance') {
                const balanceValue = parseFloat(value.replace('$', ''));
                const originalBalance = parseFloat(document.getElementById('accountSize')?.value) || 10000;
                element.className = `stat-value ${balanceValue >= originalBalance ? 'profit' : 'loss'}`;
            }
        }
    });
}

function calculateSymbolStats(trades) {
    const symbolMap = {};
    trades.forEach(trade => {
        if (!symbolMap[trade.symbol]) {
            symbolMap[trade.symbol] = { trades: [], totalProfit: 0 };
        }
        symbolMap[trade.symbol].trades.push(trade);
        symbolMap[trade.symbol].totalProfit += trade.profit;
    });

    return Object.entries(symbolMap).map(([symbol, data]) => {
        const winningTrades = data.trades.filter(t => t.profit > 0).length;
        const winRate = data.trades.length > 0 ? ((winningTrades / data.trades.length) * 100).toFixed(1) : '0';
        return { symbol, totalProfit: data.totalProfit, winRate };
    }).sort((a, b) => b.totalProfit - a.totalProfit);
}

// Delete trade
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

// Load user settings
async function loadUserSettings() {
    // Load from localStorage or keep defaults
    const accountSize = localStorage.getItem('accountSize') || 10000;
    const riskPerTrade = localStorage.getItem('riskPerTrade') || 1.0;
    const accountCurrency = localStorage.getItem('accountCurrency') || 'USD';
    const leverage = localStorage.getItem('leverage') || 50;

    document.getElementById('accountSize').value = accountSize;
    document.getElementById('riskPerTrade').value = riskPerTrade;
    document.getElementById('accountCurrency').value = accountCurrency;
    document.getElementById('leverage').value = leverage;
}

// Export trades
window.exportTrades = async () => {
    try {
        showLoading();
        const q = query(collection(db, 'trades'), where('userId', '==', currentUser.uid));
        const querySnapshot = await getDocs(q);
        
        const trades = [];
        querySnapshot.forEach((doc) => {
            const trade = doc.data();
            // Remove userId from export for privacy
            const { userId, ...exportTrade } = trade;
            trades.push(exportTrade);
        });

        const accountSize = parseFloat(document.getElementById('accountSize')?.value) || 10000;
        const riskPerTrade = parseFloat(document.getElementById('riskPerTrade')?.value) || 1.0;
        const accountCurrency = document.getElementById('accountCurrency')?.value || 'USD';
        const leverage = parseInt(document.getElementById('leverage')?.value) || 50;

        const exportData = {
            version: "1.0",
            exported: new Date().toISOString(),
            data: {
                trades: trades,
                accountSize: accountSize,
                riskPerTrade: riskPerTrade,
                accountCurrency: accountCurrency,
                leverage: leverage
            }
        };

        const dataStr = JSON.stringify(exportData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `trading-journal-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        
    } catch (error) {
        console.error('Error exporting trades:', error);
        alert('Error exporting trades.');
    } finally {
        hideLoading();
    }
};

// Chart functions
function renderCharts(trades) {
    renderPerformanceChart(trades);
    renderWinLossPieChart(trades);
    renderMarketTypeChart(trades);
}

function renderPerformanceChart(trades) {
    const ctx = document.getElementById('performanceChart')?.getContext('2d');
    if (!ctx) return;

    if (performanceChart) {
        performanceChart.destroy();
    }

    if (!trades || trades.length === 0) {
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.font = '14px Arial';
        ctx.fillStyle = '#666';
        ctx.textAlign = 'center';
        ctx.fillText('Add trades to see your progress', ctx.canvas.width / 2, ctx.canvas.height / 2);
        return;
    }

    const sortedTrades = [...trades].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    const accountSize = parseFloat(document.getElementById('accountSize')?.value) || 10000;
    const dates = sortedTrades.map(t => {
        const date = new Date(t.timestamp);
        return window.innerWidth < 768 ? 
            `${date.getMonth()+1}/${date.getDate()}` : 
            date.toLocaleDateString();
    });
    
    const cumulativeBalance = sortedTrades.reduce((acc, trade, index) => {
        const previousBalance = index === 0 ? accountSize : acc[index - 1];
        acc.push(previousBalance + trade.profit);
        return acc;
    }, []);

    performanceChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: dates,
            datasets: [{
                label: 'Balance',
                data: cumulativeBalance,
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                tension: 0.3,
                fill: true,
                borderWidth: 2,
                pointRadius: window.innerWidth < 768 ? 2 : 3,
                pointHoverRadius: window.innerWidth < 768 ? 4 : 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: window.innerWidth >= 768,
                    position: 'top'
                }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    ticks: {
                        callback: function(value) {
                            if (value >= 1000) {
                                return '$' + (value/1000).toFixed(0) + 'K';
                            }
                            return '$' + value;
                        },
                        maxTicksLimit: window.innerWidth < 768 ? 5 : 8
                    }
                },
                x: {
                    ticks: {
                        maxRotation: window.innerWidth < 768 ? 45 : 0,
                        minRotation: window.innerWidth < 768 ? 45 : 0
                    }
                }
            }
        }
    });
}

function renderWinLossPieChart(trades) {
    const ctx = document.getElementById('winLossChart')?.getContext('2d');
    if (!ctx) return;

    if (winLossChart) {
        winLossChart.destroy();
    }

    if (!trades || trades.length === 0) {
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.font = '12px Arial';
        ctx.fillStyle = '#666';
        ctx.textAlign = 'center';
        ctx.fillText('No data', ctx.canvas.width / 2, ctx.canvas.height / 2);
        return;
    }

    const winningTrades = trades.filter(t => t.profit > 0).length;
    const losingTrades = trades.filter(t => t.profit < 0).length;
    const breakEvenTrades = trades.filter(t => t.profit === 0).length;

    winLossChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: ['Win', 'Loss', 'Even'],
            datasets: [{
                data: [winningTrades, losingTrades, breakEvenTrades],
                backgroundColor: ['#10b981', '#ef4444', '#6b7280'],
                borderWidth: 1,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        boxWidth: 12,
                        font: { size: window.innerWidth < 768 ? 10 : 12 }
                    }
                }
            }
        }
    });
}

function renderMarketTypeChart(trades) {
    const ctx = document.getElementById('marketTypeChart')?.getContext('2d');
    if (!ctx) return;

    if (marketTypeChart) {
        marketTypeChart.destroy();
    }

    if (!trades || trades.length === 0) {
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.font = '12px Arial';
        ctx.fillStyle = '#666';
        ctx.textAlign = 'center';
        ctx.fillText('No data', ctx.canvas.width / 2, ctx.canvas.height / 2);
        return;
    }

    const forexTrades = trades.filter(t => t.instrumentType === 'forex').length;
    const indicesTrades = trades.filter(t => t.instrumentType === 'indices').length;

    marketTypeChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Forex', 'Indices'],
            datasets: [{
                data: [forexTrades, indicesTrades],
                backgroundColor: ['#3b82f6', '#ec4899'],
                borderWidth: 1,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        boxWidth: 12,
                        font: { size: window.innerWidth < 768 ? 10 : 12 }
                    }
                }
            }
        }
    });
}

// Close modal when clicking outside image
document.addEventListener('click', (e) => {
    const modal = document.getElementById('screenshotModal');
    if (e.target === modal) {
        closeScreenshotModal();
    }
});

// Close modal with Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeScreenshotModal();
    }
});