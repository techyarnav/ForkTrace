const axios = require('axios');
const {
    ETHERSCAN_MAINNET_API_URL,
    ETHERSCAN_REQUEST_TIMEOUT,
    ETHERSCAN_MAX_RETRIES,
    ETHERSCAN_RETRY_DELAY_MS
} = require('../config/constants.js');

const {
    createNetworkError,
    createEtherscanError
} = require('../utils/error-handler.js');

function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

class EtherscanClient {
    /**
     * @param {string} apiKey – validated Etherscan API key
     */
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.axiosInstance = axios.create({
            baseURL: ETHERSCAN_MAINNET_API_URL,
            timeout: ETHERSCAN_REQUEST_TIMEOUT
        });
    }

    /* ---------- Public API ---------- */

    /** Fetch eth_getTransactionByHash */
    async getTransaction(txHash) {
        return await this._proxyCall('eth_getTransactionByHash', { txhash: txHash });
    }

    /** Fetch eth_getTransactionReceipt */
    async getTransactionReceipt(txHash) {
        return await this._proxyCall('eth_getTransactionReceipt', { txhash: txHash });
    }

    /** Fetch eth_getBlockByNumber (full tx objects = false) */
    async getBlock(blockNumberHex) {
        return await this._proxyCall('eth_getBlockByNumber', {
            tag: blockNumberHex,
            boolean: false
        });
    }

    /**
     * Fetches complete transaction data including receipt and block info
     * @param {string} txHash - Transaction hash
     * @returns {Promise<object>} Complete transaction data
     */
    async getTransactionData(txHash) {
        try {
            // Fetch transaction and receipt in parallel
            const [transaction, receipt] = await Promise.all([
                this.getTransaction(txHash),
                this.getTransactionReceipt(txHash)
            ]);

            if (!transaction) {
                throw createEtherscanError(`Transaction ${txHash} not found`);
            }

            if (!receipt) {
                throw createEtherscanError(`Transaction receipt ${txHash} not found`);
            }

            // Get block information
            const block = await this.getBlock(transaction.blockNumber);

            if (!block) {
                throw createEtherscanError(`Block ${transaction.blockNumber} not found`);
            }

            return {
                transaction,
                receipt,
                block,
                blockNumber: parseInt(transaction.blockNumber, 16)
            };
        } catch (error) {
            if (error.type) {
                throw error; // Re-throw ForkTraceError
            }
            throw createEtherscanError(`Failed to fetch transaction data: ${error.message}`, error);
        }
    }

    /* ---------- Internal Helpers ---------- */

    /**
     * Makes a proxy call with retries/back-off.
     * @param {string} action – Etherscan proxy action
     * @param {object} params – query params specific to the call
     * @private
     */
    async _proxyCall(action, params) {
        const query = {
            module: 'proxy',
            action,
            apikey: this.apiKey,
            ...params
        };

        let attempt = 0;
        let lastError = null;

        while (attempt < ETHERSCAN_MAX_RETRIES) {
            try {
                const { data, status } = await this.axiosInstance.get('/', { params: query });

                // HTTP-level problems
                if (status !== 200) {
                    throw createNetworkError(`HTTP ${status} from Etherscan`);
                }

                // Etherscan proxy returns JSON-RPC style { result, error }
                if (data.error) {
                    throw createEtherscanError(`RPC error: ${data.error.message || 'unknown'}`);
                }
                if (data.result == null) {
                    throw createEtherscanError(
                        `Null result from Etherscan for action ${action} (may be pending or not found)`
                    );
                }

                return data.result;
            } catch (err) {
                lastError = err;
                attempt += 1;

                // Stop retrying on non-retriable errors
                if (
                    err.type === 'VALIDATION_ERROR' ||
                    err.type === 'ETHERSCAN_ERROR' && !/rate limit/i.test(err.message)
                ) {
                    break;
                }

                if (attempt < ETHERSCAN_MAX_RETRIES) {
                    // Exponential back-off
                    const delayMs = ETHERSCAN_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
                    await delay(delayMs);
                }
            }
        }

        // Out of retries
        throw lastError || createEtherscanError('Exceeded maximum retries');
    }
}

module.exports = EtherscanClient;
