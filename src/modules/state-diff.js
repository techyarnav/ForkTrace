const { keccak256, getBytes } = require('ethers');
const { createReplayError } = require('../utils/error-handler');

class StateDiff {
    /**
     * @param {ethers.JsonRpcProvider} provider – connected to Anvil or L1/L2 node
     */
    constructor(provider) {
        if (!provider) throw createReplayError('Provider is required for StateDiff');
        this.provider = provider;
    }

    /**
     * Capture minimal state for a set of addresses at a given block-tag.
     *
     * @param {string|number} blockTag – e.g. `latest` or a block number
     * @param {string[]}      addresses
     * @returns {Promise<Object<string, AccountSnapshot>>}
     */
    async captureState(blockTag, addresses) {
        const snapshots = await Promise.all(
            addresses.map((addr) => this.#getAccountSnapshot(addr, blockTag))
        );

        return Object.fromEntries(
            snapshots.map((snap) => [snap.address, snap])
        );
    }

    /**
     * Calculate diff between two block-tags for the provided addresses.
     *
     * result format:
     * {
     *   <address>: {
     *     before:  <AccountSnapshot>,
     *     after:   <AccountSnapshot>,
     *     balanceChange: BigInt,
     *     nonceChange:   number,
     *     codeChanged:   boolean
     *   },
     *   ...
     * }
     */
    async diff(fromBlockTag, toBlockTag, addresses) {
        const [before, after] = await Promise.all([
            this.captureState(fromBlockTag, addresses),
            this.captureState(toBlockTag, addresses)
        ]);

        const result = {};
        for (const addr of addresses) {
            const a = after[addr];
            const b = before[addr];

            result[addr] = {
                before: b,
                after: a,
                balanceChange: BigInt(a.balance) - BigInt(b.balance),
                nonceChange: a.nonce - b.nonce,
                codeChanged: a.codeHash !== b.codeHash
            };
        }
        return result;
    }

    /* ------------------------------------------------------------------
     * PRIVATE HELPERS
     * ---------------------------------------------------------------- */

    /**
     * @typedef {{
     *   address:    string,
     *   balance:    string,  // wei as decimal string
     *   nonce:      number,
     *   codeHash:   string,  // keccak256 hash of byte-code
     *   codeSize:   number    // bytes
     * }} AccountSnapshot
     */

    async #getAccountSnapshot(address, blockTag) {
        const [bal, nonce, code] = await Promise.all([
            this.provider.getBalance(address, blockTag),
            this.provider.getTransactionCount(address, blockTag),
            this.provider.getCode(address, blockTag)
        ]);

        const codeBytes = getBytes(code);
        return {
            address,
            balance: bal.toString(),
            nonce,
            codeHash: code === '0x' ? '0x' : keccak256(code),
            codeSize: codeBytes.length
        };
    }
}

module.exports = StateDiff;
