/**
 * EIP-681 Payment URI Generator
 * Standard format: ethereum:<token>@<chainId>/transfer?address=<recipient>&uint256=<amount>
 * Reference: https://eips.ethereum.org/EIPS/eip-681
 */

// Arc Testnet Token Addresses
const TOKEN_ADDRESSES = {
    USDC: '0x3600000000000000000000000000000000000000',
    EURC: '0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a'
};

/**
 * Generate EIP-681 compliant payment URI
 * @param {Object} params - Payment parameters
 * @param {string} params.recipientWallet - Recipient address (0x...)
 * @param {string|number} params.amount - Amount in human-readable format (e.g., "10.50")
 * @param {string} params.currency - Token symbol ("USDC" or "EURC")
 * @param {number} params.chainId - Chain ID (3434555 for Arc Testnet)
 * @returns {string} EIP-681 formatted URI
 */
export function generateEIP681PaymentURI({ recipientWallet, amount, currency, chainId }) {
    const tokenAddress = TOKEN_ADDRESSES[currency] || TOKEN_ADDRESSES.USDC;

    // Convert amount to smallest unit (6 decimals for USDC/EURC)
    const amountInSmallestUnit = Math.floor(parseFloat(amount) * 1e6).toString();

    // EIP-681 format: ethereum:<token>@<chainId>/transfer?address=<to>&uint256=<amount>
    return `ethereum:${tokenAddress}@${chainId}/transfer?address=${recipientWallet}&uint256=${amountInSmallestUnit}`;
}
