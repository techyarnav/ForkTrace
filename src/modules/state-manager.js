const fs = require('fs').promises;
const path = require('path');
const { createReplayError } = require('../utils/error-handler');

class StateManager {
    constructor(provider, options = {}) {
        if (!provider) {
            throw createReplayError('Provider is required for StateManager');
        }

        this.provider = provider;
        this.stateDir = options.stateDir || './anvil-states';
        this.maxStates = options.maxStates || 10;
    }

    /**
     * Save current Anvil state to file
     * @param {string} stateName - Name for the state snapshot
     * @returns {Promise<string>} Path to saved state file
     */
    async saveState(stateName) {
        try {
            await this._ensureStateDir();

            // Get state from Anvil
            const stateData = await this.provider.send('anvil_dumpState', []);

            // Generate filename with timestamp
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `${stateName}-${timestamp}.json`;
            const filepath = path.join(this.stateDir, filename);

            await fs.writeFile(filepath, JSON.stringify(stateData, null, 2));

            await this._cleanupOldStates();

            console.log(`💾 State saved: ${filepath}`);
            return filepath;

        } catch (error) {
            throw createReplayError(`Failed to save state: ${error.message}`, error);
        }
    }

    /**
     * Load Anvil state from file
     * @param {string} filepath - Path to state file
     * @returns {Promise<void>}
     */
    async loadState(filepath) {
        try {
            await fs.access(filepath);

            const stateJson = await fs.readFile(filepath, 'utf8');
            const stateData = JSON.parse(stateJson);

            await this.provider.send('anvil_loadState', [stateData]);

            console.log(`📂 State loaded: ${filepath}`);

        } catch (error) {
            if (error.code === 'ENOENT') {
                throw createReplayError(`State file not found: ${filepath}`);
            }
            throw createReplayError(`Failed to load state: ${error.message}`, error);
        }
    }

    /**
     * List available state files
     * @returns {Promise<Array>} Array of state file info
     */
    async listStates() {
        try {
            await this._ensureStateDir();

            const files = await fs.readdir(this.stateDir);
            const stateFiles = files.filter(file => file.endsWith('.json'));

            const states = await Promise.all(
                stateFiles.map(async (file) => {
                    const filepath = path.join(this.stateDir, file);
                    const stats = await fs.stat(filepath);

                    return {
                        name: file.replace('.json', ''),
                        filepath,
                        size: stats.size,
                        created: stats.birthtime,
                        modified: stats.mtime
                    };
                })
            );

            return states.sort((a, b) => b.created - a.created);

        } catch (error) {
            throw createReplayError(`Failed to list states: ${error.message}`, error);
        }
    }

    /**
     * Delete a state file
     * @param {string} filepath - Path to state file
     * @returns {Promise<void>}
     */
    async deleteState(filepath) {
        try {
            await fs.unlink(filepath);
            console.log(`🗑️  State deleted: ${filepath}`);
        } catch (error) {
            throw createReplayError(`Failed to delete state: ${error.message}`, error);
        }
    }

    /**
     * Create a named checkpoint of current state
     * @param {string} checkpointName - Name for the checkpoint
     * @returns {Promise<string>} Checkpoint filepath
     */
    async createCheckpoint(checkpointName) {
        const sanitizedName = checkpointName.replace(/[^a-zA-Z0-9-_]/g, '_');
        return this.saveState(`checkpoint_${sanitizedName}`);
    }

    /**
     * Restore from a named checkpoint
     * @param {string} checkpointName - Name of the checkpoint
     * @returns {Promise<void>}
     */
    async restoreCheckpoint(checkpointName) {
        const states = await this.listStates();
        const checkpoint = states.find(state =>
            state.name.includes(`checkpoint_${checkpointName}`)
        );

        if (!checkpoint) {
            throw createReplayError(`Checkpoint not found: ${checkpointName}`);
        }

        return this.loadState(checkpoint.filepath);
    }

    async _ensureStateDir() {
        try {
            await fs.access(this.stateDir);
        } catch {
            await fs.mkdir(this.stateDir, { recursive: true });
            console.log(`📁 Created state directory: ${this.stateDir}`);
        }
    }

    async _cleanupOldStates() {
        const states = await this.listStates();

        if (states.length > this.maxStates) {
            const statesToDelete = states.slice(this.maxStates);

            for (const state of statesToDelete) {
                await this.deleteState(state.filepath);
            }
        }
    }
}

module.exports = StateManager;
