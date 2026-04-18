// deriv-api-service.js - Deriv API Integration Service

class DerivAPIService {
    constructor() {
        this.appId = '1089'; // Deriv's demo app ID
        this.endpoint = 'wss://ws.derivws.com/websockets/v3';
        this.connection = null;
        this.isConnected = false;
        this.messageCallbacks = new Map();
        this.reqId = 0;
        this.activeSymbolsCache = null;
        this.assetIndexCache = null;
    }

    // Connect to Deriv WebSocket API
    async connect() {
        return new Promise((resolve, reject) => {
            if (this.isConnected) {
                resolve();
                return;
            }

            this.connection = new WebSocket(`${this.endpoint}?app_id=${this.appId}`);

            this.connection.onopen = () => {
                console.log('[DERIV API] Connected successfully');
                this.isConnected = true;
                resolve();
            };

            this.connection.onerror = (error) => {
                console.error('[DERIV API] Connection error:', error);
                reject(error);
            };

            this.connection.onmessage = (event) => {
                const data = JSON.parse(event.data);
                this.handleMessage(data);
            };

            this.connection.onclose = () => {
                console.log('[DERIV API] Connection closed');
                this.isConnected = false;
            };
        });
    }

    // Handle incoming messages
    handleMessage(data) {
        if (data.req_id && this.messageCallbacks.has(data.req_id)) {
            const callback = this.messageCallbacks.get(data.req_id);
            callback(data);
            this.messageCallbacks.delete(data.req_id);
        } else if (data.msg_type) {
            console.log('[DERIV API] Message:', data.msg_type);
        }
    }

    // Send a request to the API
    async sendRequest(request) {
        await this.connect();
        
        return new Promise((resolve, reject) => {
            const reqId = ++this.reqId;
            request.req_id = reqId;

            this.messageCallbacks.set(reqId, (response) => {
                if (response.error) {
                    reject(new Error(response.error.message));
                } else {
                    resolve(response);
                }
            });

            // Set timeout
            setTimeout(() => {
                if (this.messageCallbacks.has(reqId)) {
                    this.messageCallbacks.delete(reqId);
                    reject(new Error('Request timeout'));
                }
            }, 10000);

            this.connection.send(JSON.stringify(request));
        });
    }

    // Get active symbols list
    async getActiveSymbols() {
        if (this.activeSymbolsCache) {
            return this.activeSymbolsCache;
        }

        try {
            const response = await this.sendRequest({
                active_symbols: 'brief',
                product_type: 'basic'
            });

            this.activeSymbolsCache = response.active_symbols || [];
            console.log('[DERIV API] Fetched', this.activeSymbolsCache.length, 'active symbols');
            return this.activeSymbolsCache;
        } catch (error) {
            console.error('[DERIV API] Error fetching active symbols:', error);
            return [];
        }
    }

    // Get asset index (includes contract details)
    async getAssetIndex() {
        if (this.assetIndexCache) {
            return this.assetIndexCache;
        }

        try {
            const response = await this.sendRequest({
                asset_index: 1
            });

            this.assetIndexCache = response.asset_index || [];
            console.log('[DERIV API] Fetched asset index');
            return this.assetIndexCache;
        } catch (error) {
            console.error('[DERIV API] Error fetching asset index:', error);
            return [];
        }
    }

    // Get contract specifications for a symbol
    async getContractsForSymbol(symbol) {
        try {
            const response = await this.sendRequest({
                contracts_for: symbol,
                currency: 'USD'
            });

            return response.contracts_for || null;
        } catch (error) {
            console.error('[DERIV API] Error fetching contracts for', symbol, ':', error);
            return null;
        }
    }

    // Get tick stream for real-time prices
    async getTicks(symbol, subscribe = false) {
        try {
            const response = await this.sendRequest({
                ticks: symbol,
                subscribe: subscribe ? 1 : 0
            });

            return response;
        } catch (error) {
            console.error('[DERIV API] Error getting ticks for', symbol, ':', error);
            return null;
        }
    }

    // Subscribe to tick updates
    async subscribeToTicks(symbol, callback) {
        await this.connect();
        
        const request = {
            ticks: symbol,
            subscribe: 1
        };

        // For subscriptions, we need to handle messages differently
        const originalOnMessage = this.connection.onmessage;
        
        this.connection.onmessage = (event) => {
            const data = JSON.parse(event.data);
            
            if (data.tick && data.tick.symbol === symbol) {
                callback(data.tick);
            } else if (data.req_id && this.messageCallbacks.has(data.req_id)) {
                const cb = this.messageCallbacks.get(data.req_id);
                cb(data);
                this.messageCallbacks.delete(data.req_id);
            }
        };

        return this.sendRequest(request);
    }

    // Disconnect
    disconnect() {
        if (this.connection) {
            this.connection.close();
            this.isConnected = false;
            this.connection = null;
        }
    }
}

// Create singleton instance
const derivAPI = new DerivAPIService();

export { derivAPI, DerivAPIService };