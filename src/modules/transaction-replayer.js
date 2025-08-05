const AnvilManager = require('./anvil-manager');
const EtherscanClient = require('./etherscan-client');
const { JsonRpcProvider } = require('ethers');
const { ethers } = require('ethers');

const {
    createReplayError,
    createNetworkError
} = require('../utils/error-handler');

const {
    ANVIL_DEFAULT_PORT,
    ETHERSCAN_MAINNET_API_URL
} = require('../config/constants');

const isHexPrefixed = str => typeof str === 'string' && str.startsWith('0x');

class TransactionReplayer {

    constructor(etherscanApiKey, anvilPortOrProvider) {
        this.etherscanApiKey = etherscanApiKey;
        this.etherscan = new EtherscanClient(etherscanApiKey); // Add this line

        if (typeof anvilPortOrProvider === 'number') {
            this.anvilPort = anvilPortOrProvider;
            this.provider = new ethers.JsonRpcProvider(`http://127.0.0.1:${anvilPortOrProvider}`);
        } else {
            this.provider = anvilPortOrProvider;
            this.anvilPort = null;
        }
    }

    async startReplay(txHash) {
        console.log('🔍 startReplay called, provider:', this.provider);
        console.log('🔍 provider type:', typeof this.provider);

        if (!this.provider) {
            throw new Error('Provider not set. Make sure Anvil is running.');
        }

        try {
            const blockNumber = await this.provider.getBlockNumber();
            console.log(`🔗 Connected to provider at block ${blockNumber}`);
        } catch (error) {
            throw new Error(`Failed to connect to provider: ${error.message}`);
        }
    }

    async replayTransaction(txHash, modifications = {}) {
        console.log('🔍 replayTransaction called with:', txHash, modifications);

        try {
            const originalTx = await this.provider.getTransaction(txHash);
            console.log('✅ Original transaction fetched successfully');

            const testPrivateKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'; // First Anvil account
            const wallet = new ethers.Wallet(testPrivateKey, this.provider);
            console.log('✅ Wallet created with address:', wallet.address);

            const modifiedTx = {
                to: originalTx.to,
                value: originalTx.value,
                data: originalTx.data,
                gasLimit: originalTx.gasLimit,
                gasPrice: originalTx.gasPrice,
                // Don't include 'from' - wallet will set this automatically
                // Don't include 'nonce' - let ethers handle this
                ...modifications // Apply any modifications
            };

            console.log('🔍 Modified transaction prepared:', modifiedTx);

            console.log('🔍 About to send transaction...');
            const txResponse = await wallet.sendTransaction(modifiedTx);
            console.log('🔍 Transaction sent, hash:', txResponse.hash);

            console.log('🔍 About to wait for transaction receipt...');
            const receipt = await txResponse.wait();
            console.log('🔍 Transaction receipt:', receipt);

            return {
                status: receipt.status === 1 ? 'success' : 'failed',
                gasUsed: receipt.gasUsed?.toString(),
                logs: receipt.logs || [],
                transactionHash: receipt.transactionHash,
                blockNumber: receipt.blockNumber,
                revertReason: receipt.status === 0 ? 'Transaction reverted' : null
            };

        } catch (error) {
            console.error('🔍 Error in replayTransaction:', error);

            if (error.receipt) {
                return {
                    status: 'failed',
                    gasUsed: error.receipt.gasUsed?.toString(),
                    logs: error.receipt.logs || [],
                    transactionHash: error.receipt.hash,
                    blockNumber: error.receipt.blockNumber,
                    revertReason: error.reason || 'Transaction execution reverted',
                    error: error.shortMessage
                };
            }

            throw error;
        }
    }
    async getAccountState(address) {
        if (!this.provider) throw createReplayError('Replay environment not started');

        const [balance, nonce, code] = await Promise.all([
            this.provider.getBalance(address),
            this.provider.getTransactionCount(address),
            this.provider.getCode(address)
        ]);

        return {
            address,
            balance: balance.toString(),
            nonce,
            isContract: code !== '0x',
            codeSize: code.length > 2 ? (code.length - 2) / 2 : 0
        };
    }

    async staticCall(callData) {
        if (!this.provider) throw createReplayError('Replay environment not started');
        if (!isHexPrefixed(callData.data ?? '0x')) {
            throw createValidationError('callData.data must be 0x-prefixed');
        }
        return this.provider.call(callData);
    }

    async getCurrentBlock() {
        if (!this.provider) throw createReplayError('Replay environment not started');
        const number = await this.provider.getBlockNumber();
        return this.provider.getBlock(number);
    }

    isRunning() {
        return this.anvil.isRunning() && this.provider !== null;
    }

    async cleanup() {
        this.provider = null;
        this.forkBlock = null;
        if (this.anvil.isRunning()) await this.anvil.kill();
    }
}

module.exports = TransactionReplayer;
