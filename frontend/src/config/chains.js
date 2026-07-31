// Supported chains for the Bridge UI (Mockup + Real ones)
export const CHAINS = [
  {
    id: 5042002,
    key: 'ARC',
    name: 'Arc Testnet',
    icon: 'https://cdn.prod.website-files.com/685311a976e7c248b5dfde95/68926aad995d4eae931403a4_arc-favicon-256x256.png',
    color: 'bg-blue-600',
    isTestnet: true,
    explorer: 'https://testnet.arcscan.app'
  },
  {
    id: 11155111,
    key: 'SEPOLIA',
    name: 'Ethereum Sepolia',
    icon: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png',
    color: 'bg-indigo-500',
    isTestnet: true,
    explorer: 'https://sepolia.etherscan.io'
  },
  {
    id: 84532,
    key: 'BASE_SEPOLIA',
    name: 'Base Sepolia',
    icon: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/info/logo.png',
    color: 'bg-blue-500',
    isTestnet: true,
    explorer: 'https://sepolia.basescan.org'
  },
  {
    id: 11155420,
    key: 'OPTIMISM_SEPOLIA',
    name: 'Optimism Sepolia',
    icon: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/optimism/info/logo.png',
    color: 'bg-red-500',
    isTestnet: true,
    explorer: 'https://sepolia-optimism.etherscan.io'
  },
  {
    id: 421614,
    key: 'ARBITRUM_SEPOLIA',
    name: 'Arbitrum Sepolia',
    icon: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/arbitrum/info/logo.png',
    color: 'bg-blue-400',
    isTestnet: true,
    explorer: 'https://sepolia.arbiscan.io'
  },

];

export function getChainById(id) {
  return CHAINS.find((c) => c.id === id) || CHAINS[0];
}

export function getAllChains() {
  return CHAINS;
}
