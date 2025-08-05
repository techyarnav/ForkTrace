const inquirer = require('inquirer');
const chalk = require('chalk');

// Check if running in non-interactive environment
const isNonInteractive = () => {
  return process.env.CI || 
         process.env.NODE_ENV === 'test' ||
         !process.stdin.isTTY ||
         process.env.ETHERSCAN_API_KEY_PROMPT === 'false';
};

const promptForEtherscanApiKey = async () => {
  if (isNonInteractive()) {
    throw new Error('ETHERSCAN_API_KEY required but not provided and running in non-interactive mode');
  }

  console.log(chalk.yellow('🔑 Etherscan API Key Required'));
  console.log(chalk.gray('Get your free API key at: https://etherscan.io/apis\n'));

  const questions = [
    {
      type: 'password',
      name: 'apiKey',
      message: 'Enter your Etherscan API key:',
      mask: '*',
      validate: (input) => {
        if (!input || input.length < 10) {
          return 'Please enter a valid API key';
        }
        return true;
      }
    }
  ];

  try {
    const answers = await inquirer.prompt(questions);
    return answers.apiKey.trim();
  } catch (error) {
    if (error.isTtyError) {
      throw new Error('Cannot prompt for API key in this environment. Please set ETHERSCAN_API_KEY environment variable.');
    }
    throw error;
  }
};

const getEtherscanApiKey = async () => {
  const envKey = process.env.ETHERSCAN_API_KEY;
  
  if (envKey && envKey.length > 10) {
    console.log(chalk.green('✅ Using Etherscan API key from environment variable'));
    return envKey;
  }

  if (envKey && envKey.length <= 10) {
    console.log(chalk.yellow('⚠️  Invalid API key in environment variable, prompting for new one...'));
  }

  return await promptForEtherscanApiKey();
};

module.exports = {
  getEtherscanApiKey,
  promptForEtherscanApiKey
};
