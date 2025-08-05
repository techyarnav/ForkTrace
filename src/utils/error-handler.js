const chalk = require('chalk');

const createAIError = (message, originalError = null) => 
    new ForkTraceError(message, ErrorTypes.AI_ERROR, originalError);


const ErrorTypes = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  ETHERSCAN_ERROR: 'ETHERSCAN_ERROR',
  ANVIL_ERROR: 'ANVIL_ERROR',
  REPLAY_ERROR: 'REPLAY_ERROR',
  AI_ERROR: 'AI_ERROR',
  EXPORT_ERROR: 'EXPORT_ERROR',
  SYSTEM_ERROR: 'SYSTEM_ERROR',
  AI_ERROR: 'AI_ERROR'

};

/**
 * Custom error class for ForkTrace
 */
class ForkTraceError extends Error {
  constructor(message, type = ErrorTypes.SYSTEM_ERROR, originalError = null) {
    super(message);
    this.name = 'ForkTraceError';
    this.type = type;
    this.originalError = originalError;
    this.timestamp = new Date().toISOString();
  }
}

/**
 * Handles and displays errors in a user-friendly format
 * @param {Error} error - Error to handle
 * @param {boolean} verbose - Whether to show detailed error information
 */
async function handleError(error, verbose = false) {
  console.log(''); // Add spacing
  
  if (error instanceof ForkTraceError) {
    console.error(chalk.red.bold('❌ Error:'), chalk.red(error.message));
    
    // Show specific guidance based on error type
    switch (error.type) {
      case ErrorTypes.VALIDATION_ERROR:
        console.error(chalk.gray('💡 Tip: Check your input format and try again'));
        break;
      case ErrorTypes.NETWORK_ERROR:
        console.error(chalk.gray('💡 Tip: Check your internet connection and try again'));
        break;
      case ErrorTypes.ETHERSCAN_ERROR:
        console.error(chalk.gray('💡 Tip: Verify your Etherscan API key and rate limits'));
        break;
      case ErrorTypes.ANVIL_ERROR:
        console.error(chalk.gray('💡 Tip: Ensure Anvil (Foundry) is installed and accessible'));
        break;
      case ErrorTypes.AI_ERROR:
        console.error(chalk.gray('💡 Tip: Check if Ollama is running (ollama serve)'));
        break;
      default:
        console.error(chalk.gray('💡 Tip: Run with --verbose for more details'));
    }
    
    if (verbose && error.originalError) {
      console.error(chalk.dim('\nOriginal error:'), error.originalError.message);
      if (error.originalError.stack) {
        console.error(chalk.dim(error.originalError.stack));
      }
    }
  } else {
    console.error(chalk.red.bold('❌ Unexpected Error:'), chalk.red(error.message));
    
    if (verbose && error.stack) {
      console.error(chalk.dim('\nStack trace:'));
      console.error(chalk.dim(error.stack));
    }
  }
  
  console.log(''); 
}

/**
 * Creates specific error types
 */
const createValidationError = (message, originalError = null) => 
  new ForkTraceError(message, ErrorTypes.VALIDATION_ERROR, originalError);

const createNetworkError = (message, originalError = null) => 
  new ForkTraceError(message, ErrorTypes.NETWORK_ERROR, originalError);

const createEtherscanError = (message, originalError = null) => 
  new ForkTraceError(message, ErrorTypes.ETHERSCAN_ERROR, originalError);

const createAnvilError = (message, originalError = null) => 
  new ForkTraceError(message, ErrorTypes.ANVIL_ERROR, originalError);

const createReplayError = (message, originalError = null) => 
  new ForkTraceError(message, ErrorTypes.REPLAY_ERROR, originalError);

const createAiError = (message, originalError = null) => 
  new ForkTraceError(message, ErrorTypes.AI_ERROR, originalError);

const createExportError = (message, originalError = null) => 
  new ForkTraceError(message, ErrorTypes.EXPORT_ERROR, originalError);

const createSystemError = (message, originalError = null) => 
  new ForkTraceError(message, ErrorTypes.SYSTEM_ERROR, originalError);

module.exports = {
  ErrorTypes,
  ForkTraceError,
  handleError,
  createValidationError,
  createNetworkError,
  createEtherscanError,
  createAnvilError,
  createReplayError,
  createAiError,
  createExportError,
  createSystemError,
  createAIError
};
