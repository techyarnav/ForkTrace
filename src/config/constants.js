module.exports = {
    /* ---------- Anvil ---------- */
    ANVIL_EXECUTABLE: 'anvil',
    ANVIL_DEFAULT_PORT: 8545,
    ANVIL_START_TIMEOUT_MS: 8_000,   // wait max 8 s for JSON-RPC to respond
    ANVIL_KILL_TIMEOUT_MS: 3_000,    // give 3 s to exit before force-kill

    ETHERSCAN_MAINNET_API_URL: 'https://api.etherscan.io/api',
    ETHERSCAN_REQUEST_TIMEOUT: 15_000,
    ETHERSCAN_MAX_RETRIES: 3,
    ETHERSCAN_RETRY_DELAY_MS: 100,

    /* ---------- Replay ---------- */
    REPLAY_TIMEOUT_MS: 30_000,
    MAX_REPLAY_ATTEMPTS: 3,

    /* AI Service */
    AI_DEFAULT_ENDPOINT: 'http://localhost:11434',
    AI_DEFAULT_MODEL: 'llama3.2',
    AI_TIMEOUT_MS: 30_000,

    /* State Management */
    DEFAULT_STATE_DIR: './anvil-states',
    MAX_SAVED_STATES: 10,

    /* Export System */
    DEFAULT_EXPORT_DIR: './exports',
    SUPPORTED_EXPORT_FORMATS: ['json', 'md', 'trace', 'all'],
    MAX_EXPORT_HISTORY: 50

};