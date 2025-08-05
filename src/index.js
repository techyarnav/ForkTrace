const chalk = require('chalk');
const EtherscanClient = require('./modules/etherscan-client');
const AnvilManager = require('./modules/anvil-manager');
const TransactionReplayer = require('./modules/transaction-replayer');
const StateDiff = require('./modules/state-diff');
const StateManager = require('./modules/state-manager');
const AIExplainer = require('./modules/ai-explainer');
const Exporter = require('./modules/exporter');
const { validateTransactionHash } = require('./utils/validators');
const { createReplayError } = require('./utils/error-handler');
const { getEtherscanApiKey } = require('./utils/cli-prompts');

const createSpinner = (text) => {
    let isSpinning = false;
    return {
        start: (msg) => {
            console.log(chalk.blue(`⏳ ${msg || text}`));
            isSpinning = true;
        },
        succeed: (msg) => {
            if (isSpinning) {
                console.log(chalk.green(`✅ ${msg || text}`));
                isSpinning = false;
            }
        },
        fail: (msg) => {
            if (isSpinning) {
                console.log(chalk.red(`❌ ${msg || text}`));
                isSpinning = false;
            }
        }
    };
};

async function runForkTrace(opts) {
    const { txHash } = opts;

    if (!validateTransactionHash(txHash)) {
        throw createReplayError(`Invalid transaction hash: ${txHash}`);
    }

    const spinner = createSpinner();
    let anvil = null;

    try {
        // Step 1: Get Etherscan API key and fetch transaction
        spinner.start('Fetching transaction data from Etherscan...');
        const apiKey = await getEtherscanApiKey();
        const etherscan = new EtherscanClient(apiKey);
        const txData = await etherscan.getTransactionData(txHash);
        spinner.succeed(`Transaction found in block ${txData.blockNumber}`);

        // Step 2: Start Anvil fork
        const forkBlock = Number(txData.blockNumber) - 1;
        spinner.start(`Starting Anvil fork at block ${forkBlock}...`);
        anvil = new AnvilManager(opts.anvilPort || 8545);

        // Use the actual RPC URL from environment
        const forkUrl = process.env.MAINNET_RPC_URL ||
            'https://eth-mainnet.g.alchemy.com/v2/sdmAOs6w7QnUimdLMwOv7';

        console.log('🌐 Using RPC URL:', forkUrl.substring(0, 50) + '...');

        await anvil.start([
            '--fork-url', forkUrl,
            '--fork-block-number', forkBlock.toString(),
            '--port', (opts.anvilPort || 8545).toString(),
            '--host', '127.0.0.1',
            '--accounts', '10',
            '--balance', '10000',
            '--hardfork', 'london'
        ]);

        spinner.succeed(`Anvil running on port ${anvil.port}`);

        // Step 3: Setup transaction replayer
        console.log('🔍 About to create TransactionReplayer with port:', anvil.port);
        const replayer = new TransactionReplayer(apiKey, anvil.port);
        console.log('🔍 TransactionReplayer created, provider:', replayer.provider);
        console.log('🔍 Provider type:', typeof replayer.provider);

        await replayer.startReplay(txHash);

        // Step 4: Replay transaction (with modifications if provided)
        spinner.start('Replaying transaction...');
        const replayResult = await replayer.replayTransaction(txHash, opts.modifications || {});
        spinner.succeed(`Transaction replayed - Status: ${replayResult.status}, Gas: ${replayResult.gasUsed}`);

        // Step 5: Generate state diff
        spinner.start('Analyzing state changes...');
        const stateDiff = new StateDiff(replayer.provider);
        const stateChanges = await stateDiff.diff(forkBlock, forkBlock + 1, [
            txData.transaction.from,
            txData.transaction.to
        ].filter(Boolean));
        spinner.succeed('State analysis complete');

        // Step 6: AI analysis (if requested)
        let aiAnalysis = null;
        if (opts.ai) {
            spinner.start('Generating AI analysis...');
            try {
                console.log('🔍 Creating AIExplainer with endpoint:', opts.aiEndpoint, 'model:', opts.aiModel);
                const ai = new AIExplainer({
                    endpoint: opts.aiEndpoint,
                    model: opts.aiModel
                });
                console.log('🔍 AIExplainer created, calling analyzeTrace...');
                console.log('🔍 replayResult passed to AI:', replayResult);
                aiAnalysis = await ai.analyzeTrace(replayResult);
                console.log('🔍 AI analysis result:', aiAnalysis);
                const status = aiAnalysis.available ? 'complete' : 'unavailable';
                spinner.succeed(`AI analysis ${status}`);
            } catch (error) {
                console.error('🔍 AI analysis error:', error);
                aiAnalysis = { available: false, analysis: 'AI analysis failed: ' + error.message };
                spinner.fail('AI analysis failed');
            }
        }

        // Step 7: Save state snapshot (if requested)
        if (opts.saveState) {
            spinner.start(`Saving state snapshot: ${opts.saveState}`);
            const stateManager = new StateManager(replayer.provider, {
                stateDir: opts.stateDir
            });
            await stateManager.saveState(opts.saveState);
            spinner.succeed('State snapshot saved');
        }

        // Step 8: Export results (if requested)
        let exported = null;
        if (opts.export) {
            spinner.start('Generating reports...');
            const exporter = new Exporter(opts.outputDir);

            // Convert BigInt values in stateChanges to strings
            const serializedStateChanges = {};
            for (const [address, changes] of Object.entries(stateChanges)) {
                serializedStateChanges[address] = {
                    ...changes,
                    balanceChange: changes.balanceChange?.toString() // Convert BigInt to string
                };
            }

            const exportData = {
                txHash,
                replayResult,
                stateDiff: serializedStateChanges, // Use serialized version
                aiAnalysis,
                trace: replayResult
            };

            exported = await exporter.export(exportData, {
                formats: opts.export.split(','),
                outputDir: opts.outputDir
            });
            spinner.succeed('Reports generated');

            // Show export summary
            console.log(chalk.cyan('\n📁 Export Summary:'));
            Object.entries(exported).forEach(([format, path]) => {
                console.log(chalk.gray(`  ${format}: ${path}`));
            });
        }

        // Step 9: Cleanup
        await anvil.kill();

        // Return summary
        return {
            txHash,
            replayResult,
            stateDiff: stateChanges,
            aiAnalysis,
            exported
        };

    } catch (error) {
        if (anvil) {
            try { await anvil.kill(); } catch (e) { /* ignore */ }
        }
        throw error;
    }
}

module.exports = runForkTrace;
