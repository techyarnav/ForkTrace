const { spawn } = require('child_process');
const http = require('http');
const net = require('net');

const {
    ANVIL_EXECUTABLE,
    ANVIL_DEFAULT_PORT,
    ANVIL_START_TIMEOUT_MS,
    ANVIL_KILL_TIMEOUT_MS
} = require('../config/constants.js');

const {
    createAnvilError,
    createNetworkError
} = require('../utils/error-handler.js');

function wait(ms) {
    return new Promise(res => setTimeout(res, ms));
}

class AnvilManager {
    constructor(port = ANVIL_DEFAULT_PORT) {
        this.port = port;
        this.proc = null;
        this._killed = false;
    }

    async start(args = []) {
        if (this.process) {
            throw new Error('Anvil is already running');
        }

        console.log('🔨 Starting Anvil with args:', args);

        this.process = spawn('anvil', args, {
            stdio: ['ignore', 'pipe', 'pipe'],
            detached: false
        });

        this.process.stdout.on('data', (data) => {
            const output = data.toString();
            if (process.env.DEBUG) {
                console.log('Anvil stdout:', output);
            }
            if (output.includes('Listening on')) {
                console.log('🎯 Anvil is listening!');
            }
        });

        this.process.stderr.on('data', (data) => {
            console.error('Anvil stderr:', data.toString());
        });

        const maxAttempts = 20;
        const delayMs = 500;

        for (let i = 0; i < maxAttempts; i++) {
            try {
                // Try to connect to Anvil
                const response = await fetch(`http://127.0.0.1:${this.port}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        jsonrpc: '2.0',
                        method: 'eth_blockNumber',
                        params: [],
                        id: 1
                    })
                });

                if (response.ok) {
                    console.log('✅ Anvil is responding on port', this.port);
                    return;
                }
            } catch (e) {
            }

            await new Promise(resolve => setTimeout(resolve, delayMs));
        }

        throw createNetworkError(`Anvil did not respond on port ${this.port} within ${maxAttempts * delayMs}ms`);
    }

    isRunning() {
        return !!(this.proc && !this.proc.killed && !this._killed);
    }

    async kill(force = false) {
        if (!this.proc || this._killed) {
            return;
        }

        this._killed = true;

        try {
            this.proc.kill('SIGINT');
        } catch (_) {
        }

        if (force) {
            try {
                this.proc.kill('SIGKILL');
            } catch (_) {
            }
            return;
        }

        // Wait for graceful shutdown with timeout
        const deadline = Date.now() + ANVIL_KILL_TIMEOUT_MS;

        while (Date.now() < deadline && !this.proc.killed) {
            await wait(100);
        }

        if (!this.proc.killed) {
            try {
                this.proc.kill('SIGKILL');
            } catch (_) {
                // Process might already be dead
            }
        }
    }

    /* ---------- Private methods ---------- */

    _isPortFree() {
        return new Promise((resolve) => {
            const server = net.createServer();

            server.listen(this.port, '127.0.0.1', () => {
                server.close(() => resolve(true));
            });

            server.on('error', () => {
                resolve(false);
            });
        });
    }

    async _waitForRpc() {
        const deadline = Date.now() + ANVIL_START_TIMEOUT_MS;

        while (Date.now() < deadline) {
            if (await this._pingRpc()) {
                return true;
            }
            await wait(200);
        }

        return false;
    }

    _pingRpc() {
        return new Promise((resolve) => {
            const timeout = setTimeout(() => resolve(false), 1000);

            const req = http.request({
                method: 'POST',
                hostname: '127.0.0.1',
                port: this.port,
                path: '/',
                headers: { 'Content-Type': 'application/json' },
                timeout: 1000
            }, (res) => {
                clearTimeout(timeout);
                resolve(res.statusCode === 200);
            });

            req.on('error', () => {
                clearTimeout(timeout);
                resolve(false);
            });

            req.on('timeout', () => {
                clearTimeout(timeout);
                req.destroy();
                resolve(false);
            });

            req.write('{"jsonrpc":"2.0","id":1,"method":"eth_blockNumber","params":[]}');
            req.end();
        });
    }
}

module.exports = AnvilManager;
