// app.js
import { 
    auth, db, onAuthStateChanged, signOut, 
    collection, addDoc, getDocs, query, where, doc, deleteDoc 
} from './firebase-config.js';

let currentUser = null;
let performanceChart = null;
let winLossChart = null;
let marketTypeChart = null;

// Check authentication state
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        document.getElementById('user-email').textContent = user.email;
        await loadTrades();
        await loadUserSettings();
        setupEventListeners();
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
    }
};

function setupEventListeners() {
    const tradeForm = document.getElementById('tradeForm');
    if (tradeForm) {
        tradeForm.addEventListener('submit', (e) => {
            e.preventDefault();
            addTrade(e);
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

    try {
        await addDoc(collection(db, 'trades'), tradeData);
        
        // Clear form
        e.target.reset();
        
        // Reload trades
        await loadTrades();
        
        alert('Trade added successfully!');
    } catch (error) {
        console.error('Error adding trade:', error);
        alert('Error adding trade. Please try again.');
    }
}

// Load trades from Firestore
async function loadTrades() {
    try {
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
    }
}

// Display trades in table
function displayTrades(trades) {
    const container = document.getElementById('tradeHistory');
    if (!container) return;

    if (trades.length === 0) {
        container.innerHTML = '<p class="text-center">No trades recorded yet.</p>';
        return;
    }

    container.innerHTML = trades.map(trade => {
        const badgeClass = trade.instrumentType === 'forex' ? 'forex-badge' : 'indices-badge';
        const badgeText = trade.instrumentType === 'forex' ? 'FX' : 'IDX';
        const profitClass = trade.profit >= 0 ? 'profit' : 'loss';
        const unitType = trade.instrumentType === 'forex' ? 'pips' : 'points';
        
        return `
        <div class="trade-item">
            <div style="display: flex; justify-content: space-between; align-items: start; flex-wrap: wrap;">
                <div style="flex: 1; min-width: 200px;">
                    <div style="font-weight: bold; font-size: 14px;">
                        ${trade.symbol} <span class="market-type-badge ${badgeClass}">${badgeText}</span>
                        <span class="${profitClass}" style="float: right;">$${trade.profit.toFixed(2)}</span>
                    </div>
                    <div style="font-size: 12px; color: #6b7280;">
                        ${trade.type.toUpperCase()} | ${trade.lotSize} lots<br>
                        Entry: ${trade.entryPrice} | SL: ${trade.stopLoss}<br>
                        ${trade.takeProfit ? `TP: ${trade.takeProfit} | ` : ''}
                        Risk: $${trade.riskAmount.toFixed(2)} (${trade.riskPercent.toFixed(1)}%)<br>
                        <small>${new Date(trade.timestamp).toLocaleDateString()}</small>
                    </div>
                    ${trade.notes ? `<div style="margin-top: 8px; font-style: italic;">${trade.notes}</div>` : ''}
                </div>
                <div>
                    <button onclick="deleteTrade('${trade.id}')" class="text-red-400 hover:text-red-300" style="padding: 8px 12px;">
                        Delete
                    </button>
                </div>
            </div>
        </div>
    `}).join('');
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
            await deleteDoc(doc(db, 'trades', tradeId));
            await loadTrades();
        } catch (error) {
            console.error('Error deleting trade:', error);
            alert('Error deleting trade.');
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
        return;
    }

    const sortedTrades = [...trades].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    const accountSize = parseFloat(document.getElementById('accountSize')?.value) || 10000;
    const dates = sortedTrades.map(t => new Date(t.timestamp).toLocaleDateString());
    
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
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
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
                backgroundColor: ['#10b981', '#ef4444', '#6b7280']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
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
                backgroundColor: ['#3b82f6', '#ec4899']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });
}