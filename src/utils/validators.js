/**
 * Validates Ethereum transaction hash format
 * @param {string} hash - Transaction hash to validate
 * @returns {boolean} - True if valid, false otherwise
 */
function validateTransactionHash(hash) {
    if (typeof hash !== 'string') {
      return false;
    }
    
    const hashRegex = /^0x[a-fA-F0-9]{64}$/;
    return hashRegex.test(hash);
  }
  
  /**
   * Validates Etherscan API key format
   * @param {string} apiKey - API key to validate
   * @returns {boolean} - True if valid, false otherwise
   */
  function validateEtherscanApiKey(apiKey) {
    if (typeof apiKey !== 'string') {
      return false;
    }
    
    const trimmedKey = apiKey.trim();
    const apiKeyRegex = /^[A-Za-z0-9]{28,40}$/;
    return apiKeyRegex.test(trimmedKey);
  }
  
  /**
   * Validates export format
   * @param {string} format - Export format to validate
   * @returns {boolean} - True if valid, false otherwise
   */
  function validateExportFormat(format) {
    if (typeof format !== 'string') {
      return false;
    }
    
    const validFormats = ['json', 'md'];
    return validFormats.includes(format.toLowerCase());
  }
  
  /**
   * Validates if a string is a valid HTTP/HTTPS URL
   * @param {string} url - URL to validate
   * @returns {boolean} - True if valid, false otherwise
   */
  function validateUrl(url) {
    try {
      const urlObj = new URL(url);
      // Only allow HTTP and HTTPS protocols
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch {
      return false;
    }
  }
  
  /**
   * Validates port number
   * @param {number|string} port - Port to validate
   * @returns {boolean} - True if valid, false otherwise
   */
  function validatePort(port) {
    const portNum = parseInt(port, 10);
    return !isNaN(portNum) && portNum > 0 && portNum <= 65535;
  }
  
  module.exports = {
    validateTransactionHash,
    validateEtherscanApiKey,
    validateExportFormat,
    validateUrl,
    validatePort
  };
  