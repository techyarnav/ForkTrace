#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const runForkTrace = require('../src/index.js');
const { validateTransactionHash } = require('../src/utils/validators.js');
const { handleError } = require('../src/utils/error-handler.js');

const program = new Command();

program
  .name('fork-trace')
  .description('Replay Ethereum mainnet transactions using Anvil with AI-powered analysis')
  .version('1.0.0')
  .argument('<txHash>', 'Ethereum transaction hash to replay')
  
  /* Core options */
  .option('--anvil-port <port>', 'port for Anvil instance', 8545)
  .option('--mod <json>', 'modify transaction fields (JSON)', (value) => {
    try {
      return JSON.parse(value);
    } catch (err) {
      console.error(chalk.red('Error: --mod must be valid JSON'));
      process.exit(1);
    }
  })
  
  /* AI options */
  .option('--ai', 'enable AI-powered transaction analysis (requires ollama)')
  .option('--ai-endpoint <url>', 'AI service endpoint', process.env.AI_ENDPOINT || 'http://localhost:11434')
  .option('--ai-model <name>', 'AI model name', process.env.AI_MODEL || 'tinyllama:chat')
  
  /* Export options */
  .option('--export <formats>', 'export formats (comma-separated): json,md,trace,all', (value) => {
    const valid = ['json', 'md', 'trace', 'all'];
    const formats = value.split(',');
    const invalid = formats.filter(f => !valid.includes(f));
    if (invalid.length > 0) {
      console.error(chalk.red(`Error: Invalid export format(s): ${invalid.join(', ')}`));
      console.error(chalk.gray(`Valid formats: ${valid.join(', ')}`));
      process.exit(1);
    }
    return value;
  })
  .option('--output-dir <dir>', 'export directory', './exports')
  
  /* State management */
  .option('--save-state <name>', 'save Anvil state snapshot with this name')
  .option('--state-dir <dir>', 'directory for state snapshots', './anvil-states')
  
  /* Misc */
  .option('--no-color', 'disable colored output')
  
  .addHelpText('after', `
Examples:
  $ fork-trace 0x1234...abcd
  $ fork-trace 0x1234...abcd --export json,md
  $ fork-trace 0x1234...abcd --ai --export all
  $ fork-trace 0x1234...abcd --mod '{"value":"0"}' --save-state before-mod
  $ fork-trace 0x1234...abcd --anvil-port 8546 --output-dir ./reports
  
Prerequisites:
  - Anvil (from Foundry toolkit)
  - Etherscan API key in environment: ETHERSCAN_API_KEY
  - Ollama running locally (optional, for AI analysis)
`);

if (!process.argv.slice(2).length) {
  program.outputHelp();
  process.exit(0);
}

program.action(async (txHash, options) => {
  if (options.noColor) chalk.level = 0;
  
  console.log(chalk.cyan.bold('\n🔍 ForkTrace - Ethereum Transaction Replay Tool\n'));
  
  try {
    if (!validateTransactionHash(txHash)) {
      console.error(chalk.red('Error: Invalid transaction hash format'));
      console.error(chalk.gray('Expected: 0x followed by 64 hexadecimal characters'));
      process.exit(1);
    }

    const opts = {
      txHash,
      anvilPort: Number(options.anvilPort),
      modifications: options.mod,
      ai: options.ai,
      aiEndpoint: options.aiEndpoint,
      aiModel: options.aiModel,
      export: options.export,
      outputDir: options.outputDir,
      saveState: options.saveState,
      stateDir: options.stateDir
    };

    await runForkTrace(opts);
    
    console.log(chalk.green('\n✓ All done!'));
    
  } catch (error) {
    console.error(chalk.red(`\n✖ ${error.message}`));
    if (process.env.DEBUG) {
      console.error(chalk.gray(error.stack));
    }
    await handleError(error);
    process.exit(1);
  }
});

process.on('unhandledRejection', async (reason, promise) => {
  console.error(chalk.red('\n💥 Unhandled Rejection at:'), promise);
  console.error(chalk.red('Reason:'), reason);
  await handleError(reason);
  process.exit(1);
});

process.on('uncaughtException', async (error) => {
  console.error(chalk.red('\n💥 Uncaught Exception:'), error);
  await handleError(error);
  process.exit(1);
});

process.on('SIGINT', () => {
  console.log(chalk.yellow('\n\n⚡ Received SIGINT. Shutting down gracefully...'));
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log(chalk.yellow('\n\n⚡ Received SIGTERM. Shutting down gracefully...'));
  process.exit(0);
});

program.parse(process.argv);
