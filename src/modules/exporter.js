const fs = require('fs').promises;
const path = require('path');
const { createReplayError } = require('../utils/error-handler');

class Exporter {
    constructor(baseDir = './exports') {
        this.baseDir = baseDir;
    }

    /**
     * Export replay results to various formats
     * @param {Object} data - All replay data
     * @param {Object} options - Export options
     * @returns {Promise<Object>} Map of format -> file path
     */
    async export(data, options = {}) {
        const { txHash, replayResult, stateDiff, aiAnalysis, trace } = data;
        const { formats = ['json'], outputDir = this.baseDir } = options;

        if (!txHash) {
            throw createReplayError('Transaction hash required for export');
        }

        // Create export directory
        const exportPath = path.resolve(outputDir, txHash);
        await fs.mkdir(exportPath, { recursive: true });

        const outputs = {};

        // Export JSON report
        if (formats.includes('json') || formats.includes('all')) {
            const jsonFile = path.join(exportPath, 'report.json');
            const jsonContent = this._buildJsonReport(data);
            await fs.writeFile(jsonFile, JSON.stringify(jsonContent, null, 2));
            outputs.json = jsonFile;
            console.log(`📊 JSON report saved: ${jsonFile}`);
        }

        // Export Markdown report
        if (formats.includes('md') || formats.includes('all')) {
            const mdFile = path.join(exportPath, 'report.md');
            const mdContent = this._buildMarkdownReport(data);
            await fs.writeFile(mdFile, mdContent);
            outputs.md = mdFile;
            console.log(`📝 Markdown report saved: ${mdFile}`);
        }

        // Export raw trace data
        if (trace && (formats.includes('trace') || formats.includes('all'))) {
            const traceFile = path.join(exportPath, 'trace.raw.json');
            await fs.writeFile(traceFile, JSON.stringify(trace, null, 2));
            outputs.trace = traceFile;
            console.log(`🔍 Raw trace saved: ${traceFile}`);
        }

        return outputs;
    }

    /**
     * Build structured JSON report
     * @private
     */
    _buildJsonReport({ txHash, replayResult, stateDiff, aiAnalysis, trace }) {
        return {
            metadata: {
                txHash,
                generatedAt: new Date().toISOString(),
                tool: 'ForkTrace',
                version: '1.0.0'
            },
            replay: {
                status: replayResult?.status || 'unknown',
                gasUsed: replayResult?.gasUsed || 0,
                gasLimit: replayResult?.gasLimit || 0,
                logs: replayResult?.logs || [],
                error: replayResult?.error || null,
                modifications: replayResult?.modifications || {}
            },
            stateDiff: stateDiff || {},
            aiAnalysis: {
                available: aiAnalysis?.available || false,
                model: aiAnalysis?.model || null,
                analysis: aiAnalysis?.analysis || null,
                gasAnalysis: aiAnalysis?.gasAnalysis || null,
                timestamp: aiAnalysis?.timestamp || null
            },
            traceStats: trace ? {
                totalSteps: Array.isArray(trace.steps) ? trace.steps.length : 0,
                contractCalls: this._countContractCalls(trace),
                storageWrites: this._countStorageWrites(trace)
            } : null
        };
    }

    /**
     * Build human-readable Markdown report
     * @private
     */
    _buildMarkdownReport({ txHash, replayResult, stateDiff, aiAnalysis }) {
        const lines = [];

        // Header
        lines.push(`# ForkTrace Report for Transaction ${txHash}`);
        lines.push('');
        lines.push(`*Generated on ${new Date().toLocaleString()}*`);
        lines.push('');

        // Replay Summary
        lines.push('## 🔄 Replay Summary');
        lines.push('');
        lines.push(`- **Transaction Hash**: \`${txHash}\``);
        lines.push(`- **Status**: ${replayResult?.status || 'Unknown'}`);
        lines.push(`- **Gas Used**: ${Number(replayResult?.gasUsed || 0).toLocaleString()}`);
        lines.push(`- **Gas Limit**: ${Number(replayResult?.gasLimit || 0).toLocaleString()}`);
        lines.push(`- **Logs Emitted**: ${replayResult?.logs?.length || 0}`);

        if (replayResult?.error) {
            lines.push(`- **Error**: \`${replayResult.error}\``);
        }

        if (replayResult?.modifications && Object.keys(replayResult.modifications).length > 0) {
            lines.push('- **Modifications Applied**:');
            lines.push('```json');
            lines.push(JSON.stringify(replayResult.modifications, null, 2));
            lines.push('```')
        }
        lines.push('');

        // State Diff
        lines.push('## 📊 State Changes');
        lines.push('');

        if (stateDiff && Object.keys(stateDiff).length > 0) {
            lines.push('| Address | Balance Change | Nonce Change | Code Changed |');
            lines.push('|---------|----------------|--------------|--------------|');

            for (const [address, diff] of Object.entries(stateDiff)) {
                const balanceChange = this._formatBalance(diff.balanceChange);
                const nonceChange = diff.nonceChange || 0;
                const codeChanged = diff.codeChanged ? '✅ Yes' : '❌ No';

                lines.push(`| \`${address}\` | ${balanceChange} | ${nonceChange} | ${codeChanged} |`);
            }
        } else {
            lines.push('*No state changes detected.*');
        }
        lines.push('');

        // AI Analysis
        lines.push('## 🤖 AI Analysis');
        lines.push('');

        if (aiAnalysis?.available && aiAnalysis?.analysis) {
            lines.push(`*Analyzed by ${aiAnalysis.model || 'AI model'}*`);
            lines.push('');
            lines.push(aiAnalysis.analysis);

            if (aiAnalysis.gasAnalysis) {
                lines.push('');
                lines.push('### Gas Usage Analysis');
                lines.push('');
                lines.push(aiAnalysis.gasAnalysis);
            }
        } else {
            lines.push('*AI analysis not performed or unavailable.*');
            lines.push('');
            lines.push('To enable AI analysis, use the `--ai` flag and ensure an AI service is running.');
        }

        return lines.join('\n');
    }

    /**
     * Helper methods for data processing
     * @private
     */
    _formatBalance(balanceChange) {
        if (!balanceChange || balanceChange === '0') return '0 ETH';

        const wei = BigInt(balanceChange);
        const eth = Number(wei) / 1e18;

        if (eth > 0) return `+${eth.toFixed(6)} ETH`;
        if (eth < 0) return `${eth.toFixed(6)} ETH`;
        return '0 ETH';
    }

    _countContractCalls(trace) {
        if (!trace?.steps) return 0;
        return trace.steps.filter(step => step.op === 'CALL' || step.op === 'DELEGATECALL').length;
    }

    _countStorageWrites(trace) {
        if (!trace?.steps) return 0;
        return trace.steps.filter(step => step.op === 'SSTORE').length;
    }

    /**
     * List all available exports for a transaction
     * @param {string} txHash - Transaction hash
     * @returns {Promise<Array>} List of export files
     */
    async listExports(txHash) {
        try {
            const exportPath = path.resolve(this.baseDir, txHash);
            const files = await fs.readdir(exportPath);

            return files.map(file => ({
                name: file,
                path: path.join(exportPath, file),
                type: path.extname(file).slice(1) || 'unknown'
            }));
        } catch (error) {
            return [];
        }
    }

    /**
     * Clean up old exports (keep only N most recent)
     * @param {number} keepCount - Number of exports to retain
     */
    async cleanup(keepCount = 10) {
        try {
            const exports = await fs.readdir(this.baseDir);

            if (exports.length <= keepCount) return;

            // Sort by modification time
            const exportsWithStats = await Promise.all(
                exports.map(async (dir) => {
                    const dirPath = path.join(this.baseDir, dir);
                    const stats = await fs.stat(dirPath);
                    return { name: dir, path: dirPath, mtime: stats.mtime };
                })
            );

            exportsWithStats.sort((a, b) => b.mtime - a.mtime);

            // Remove old exports
            const toDelete = exportsWithStats.slice(keepCount);
            for (const { path: dirPath } of toDelete) {
                await fs.rm(dirPath, { recursive: true, force: true });
                console.log(`🗑️  Cleaned up old export: ${dirPath}`);
            }
        } catch (error) {
            console.warn('Failed to cleanup old exports:', error.message);
        }
    }
}

module.exports = Exporter;
