// Supported chains for the Bridge UI (Mockup + Real ones)
export const CHAINS = [
  {
    id: 5042,
    key: 'ARC_MAINNET',
    name: 'Arc',
    icon: '/arc-branded.svg',
    color: 'bg-blue-600',
    isTestnet: false,
    explorer: 'https://explorer.arc.io'
  },
  {
    id: 5042002,
    key: 'ARC',
    name: 'Arc Testnet',
    icon: '/arc-branded.svg',
    color: 'bg-blue-600',
    isTestnet: true,
    explorer: 'https://testnet.arcscan.app'
  },
  {
    id: 11155111,
    key: 'SEPOLIA',
    name: 'Ethereum Sepolia',
    icon: '/chains/ethereum.svg',
    color: 'bg-indigo-500',
    isTestnet: true,
    explorer: 'https://sepolia.etherscan.io'
  },
  {
    id: 84532,
    key: 'BASE_SEPOLIA',
    name: 'Base Sepolia',
    icon: '/chains/base.svg',
    color: 'bg-blue-500',
    isTestnet: true,
    explorer: 'https://sepolia.basescan.org'
  },
  {
    id: 11155420,
    key: 'OPTIMISM_SEPOLIA',
    name: 'Optimism Sepolia',
    icon: '/chains/optimism.svg',
    color: 'bg-red-500',
    isTestnet: true,
    explorer: 'https://sepolia-optimism.etherscan.io'
  },
  {
    id: 421614,
    key: 'ARBITRUM_SEPOLIA',
    name: 'Arbitrum Sepolia',
    icon: '/chains/arbitrum.svg',
    color: 'bg-blue-400',
    isTestnet: true,
    explorer: 'https://sepolia.arbiscan.io'
  },

  {
    id: 8453,
    key: 'BASE_MAINNET',
    name: 'Base',
    icon: '/chains/base.svg',
    color: 'bg-blue-500',
    isTestnet: false,
    explorer: 'https://basescan.org'
  },
  {
    id: 42161,
    key: 'ARBITRUM_MAINNET',
    name: 'Arbitrum One',
    icon: '/chains/arbitrum.svg',
    color: 'bg-blue-400',
    isTestnet: false,
    explorer: 'https://arbiscan.io'
  },
  {
    id: 10,
    key: 'OPTIMISM_MAINNET',
    name: 'Optimism',
    icon: '/chains/optimism.svg',
    color: 'bg-red-500',
    isTestnet: false,
    explorer: 'https://optimistic.etherscan.io'
  },
  {
    id: 1,
    key: 'ETHEREUM_MAINNET',
    name: 'Ethereum',
    icon: '/chains/ethereum.svg',
    color: 'bg-indigo-500',
    isTestnet: false,
    explorer: 'https://etherscan.io'
  },
  {
    id: 137,
    key: 'POLYGON_MAINNET',
    name: 'Polygon',
    icon: '/chains/polygon.svg',
    color: 'bg-purple-500',
    isTestnet: false,
    explorer: 'https://polygonscan.com'
  },
];

export function getChainById(id) {
  return CHAINS.find((c) => c.id === id) || CHAINS[0];
}

export function getAllChains() {
  return CHAINS;
}

export function getChainsByMode(isMainnet = false) {
  return CHAINS.filter((c) => c.isTestnet === !isMainnet);
}
