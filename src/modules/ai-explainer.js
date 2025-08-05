/**
 * AIExplainer - connects to Ollama (or other local LLM) to analyze transaction traces
 * Provides fallback when AI service is unavailable
 */

const axios = require('axios');
const { createAIError } = require('../utils/error-handler');

class AIExplainer {
    constructor(config = {}) {
        this.endpoint = config.endpoint || 'http://localhost:11434';
        this.model = config.model || 'llama3.2';
        this.timeout = config.timeout || 120000; // 2 mins

        this.client = axios.create({
            baseURL: this.endpoint,
            timeout: this.timeout,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }

    /**
     * Analyze transaction trace using AI
     * @param {Object} traceData - Transaction trace object
     * @param {Object} options - Analysis options
     * @returns {Promise<Object>} Analysis result
     */

    async analyzeTrace(traceData, options = {}) {
        try {
            const prompt = this._buildTracePrompt(traceData, options);
            const response = await this._callAI(prompt);

            return {
                available: true,
                analysis: response,
                model: this.model,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.warn('AI analysis unavailable:', error.message);
            return this._getFallbackAnalysis(traceData);
        }
    }

    /**
     * Analyze gas usage patterns
     * @param {Object} traceData - Transaction trace
     * @returns {Promise<Object>} Gas analysis
     */
    async analyzeGasUsage(traceData) {
        try {
            const prompt = this._buildGasPrompt(traceData);
            const response = await this._callAI(prompt);

            return {
                available: true,
                gasAnalysis: response,
                model: this.model
            };
        } catch (error) {
            return this._getFallbackGasAnalysis(traceData);
        }
    }

    /**
     * Check if AI service is available
     * @returns {Promise<boolean>}
     */
    async isAvailable() {
        try {
            const response = await this.client.get('/api/tags');
            return response.status === 200;
        } catch (error) {
            return false;
        }
    }

    /* -------------------- Private Methods -------------------- */

    async _callAI(prompt) {
        const requestBody = {
            model: this.model,
            prompt: prompt,
            stream: false,
            options: {
                temperature: 0.3,
                top_p: 0.9
            }
        };

        const response = await this.client.post('/api/generate', requestBody);

        if (response.data && response.data.response) {
            return response.data.response.trim();
        }

        throw new Error('Invalid AI response format');
    }


    _buildTracePrompt(traceData, options) {
        const includeGas = options.includeGas !== false;
        const includeLogs = options.includeLogs !== false;

        return `You are an **expert Solidity security auditor and performance engineer**.
  
  Analyse the Ethereum transaction below and answer **precisely** in the following sections (use Markdown headings):
  
  1. **High-Level Summary**  
     • What does the transaction attempt?  
     • Did it succeed or fail? If it failed, state **exactly why** (revert reason).
  
  2. **Failure Root-Cause** (skip if status = success)  
     • Pin-point the failing opcode, contract address and function.  
     • Show the decoded revert string or error selector.
  
  3. **Security Risks & Exploit Scenarios**  
     • Re-entrancy, overflow, improper access control, etc.  
     • Rate each risk as *critical*, *high*, *medium*, *low* or *none*.
  
  4. **Gas-Saving & Cost Optimisation Tips**  
     • Provide at least two concrete suggestions with estimated gas savings.
  
  5. **State Changes & Balance Impact**  
     • Summarise balance changes for key addresses affected.
  
  6. **Key Events / Logs**  
     • List meaningful events with decoded parameters.
  
  ---
  Transaction Data:
  ${JSON.stringify(traceData, null, 2)}
  
  Keep the analysis technical but accessible to developers.`;
    }

    _buildGasPrompt(traceData) {
        return `Analyze the gas usage in this Ethereum transaction trace:

${JSON.stringify(traceData, null, 2)}

Focus on:
1. Total gas used vs gas limit
2. Most expensive operations
3. Potential gas optimization opportunities
4. Any inefficient patterns

Provide specific actionable recommendations.`;
    }

    _getFallbackAnalysis(traceData) {
        const gasUsed = traceData.gasUsed || 'unknown';
        const gasLimit = traceData.gasLimit || 'unknown';
        const status = traceData.status === 1 ? 'SUCCESS' : 'FAILED';

        return {
            available: false,
            analysis: `Transaction Analysis (AI Unavailable):

Status: ${status}
Gas Used: ${gasUsed}
Gas Limit: ${gasLimit}

This transaction executed ${status === 'SUCCESS' ? 'successfully' : 'with failure'}. 

AI explanation service is currently unavailable. Consider:
- Reviewing the transaction logs for detailed execution steps
- Checking gas usage efficiency 
- Verifying contract interactions completed as expected

Raw trace data is available for manual analysis.`,
            model: 'fallback',
            timestamp: new Date().toISOString()
        };
    }

    _getFallbackGasAnalysis(traceData) {
        const gasUsed = Number(traceData.gasUsed) || 0;
        const gasLimit = Number(traceData.gasLimit) || 0;
        const gasEfficiency = gasLimit > 0 ? ((gasUsed / gasLimit) * 100).toFixed(2) : 'N/A';

        return {
            available: false,
            gasAnalysis: `Gas Analysis (AI Unavailable):

            
Gas Used: ${gasUsed.toLocaleString()}
Gas Limit: ${gasLimit.toLocaleString()}
Efficiency: ${gasEfficiency}% of limit used

Basic gas metrics available. For detailed optimization suggestions, ensure AI service is running at ${this.endpoint}.`,
            model: 'fallback'
        };
    }
}


module.exports = AIExplainer;
