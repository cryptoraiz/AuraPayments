// Token list for Arc Testnet (chainId: 5042002)
// Addresses and pools verified against Synthra trading API
// Pools with liquidity: USDT/WUSDC, WUSDC/EURC, USDT/EURC (via route)

export const TOKENS = [
  // Arc Mainnet Tokens (chainId: 5042)
  {
    symbol:   'USDC',
    name:     'USD Coin (Arc)',
    iconImg:  'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png',
    address:  '0x3600000000000000000000000000000000000000',
    decimals: 6,
    color:    'bg-blue-400',
    chainId:  5042,
    isNative: true,
  },
  {
    symbol:   'EURC',
    name:     'Euro Coin (Circle)',
    iconImg:  'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x1aBaEA1f7C830bD89Acc67eC4af516284b1bC33c/logo.png',
    address:  '0xbEf5f6d51CB62b58e6A8f77868681825C6fe21c1',
    decimals: 6,
    color:    'bg-indigo-500',
    chainId:  5042,
  },
  {
    symbol:   'USYC',
    name:     'Circle USYC (Yield)',
    iconImg:  'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png',
    address:  '0x8a5D989Bbb96929F689B0200f435f53dA42bF490',
    decimals: 6,
    color:    'bg-emerald-500',
    chainId:  5042,
  },

  // Arc Testnet Tokens (chainId: 5042002)
  {
    symbol:   'USDT',
    name:     'Tether USD',
    iconImg:  'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xdAC17F958D2ee523a2206206994597C13D831ec7/logo.png',
    address:  '0x175CdB1D338945f0D851A741ccF787D343E57952',
    decimals: 18,
    color:    'bg-green-500',
    chainId:  5042002,
  },
  {
    symbol:   'EURC',
    name:     'Euro Coin',
    iconImg:  'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x1aBaEA1f7C830bD89Acc67eC4af516284b1bC33c/logo.png',
    address:  '0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a',
    decimals: 6,
    color:    'bg-indigo-500',
    chainId:  5042002,
  },
  {
    symbol:   'WUSDC',
    name:     'Wrapped USDC',
    iconImg:  'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png',
    address:  '0x911b4000D3422F482F4062a913885f7b035382Df',
    decimals: 18,
    color:    'bg-blue-500',
    chainId:  5042002,
  },
  {
    symbol:   'cirBTC',
    name:     'Circle Bitcoin',
    iconImg:  '/cirbtc.svg',
    address:  '0xf0C4a4CE82A5746AbAAd9425360Ab04fbBA432BF',
    decimals: 8,
    color:    'bg-orange-500',
    chainId:  5042002,
  },
  {
    // USDC on Base Sepolia
    symbol:   'USDC',
    name:     'USD Coin',
    iconImg:  'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png',
    address:  '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    decimals: 6,
    color:    'bg-blue-400',
    chainId:  84532, // Base Sepolia
  },
  {
    // USDC on Arbitrum Sepolia
    symbol:   'USDC',
    name:     'USD Coin',
    iconImg:  'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png',
    address:  '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d',
    decimals: 6,
    color:    'bg-blue-400',
    chainId:  421614, // Arbitrum Sepolia
  },
  {
    // USDC on Ethereum Sepolia
    symbol:   'USDC',
    name:     'USD Coin',
    iconImg:  'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png',
    address:  '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    decimals: 6,
    color:    'bg-blue-400',
    chainId:  11155111, // Ethereum Sepolia
  },
  {
    // USDC on Optimism Sepolia
    symbol:   'USDC',
    name:     'USD Coin',
    iconImg:  'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png',
    address:  '0x5fd84259d66Cd46123540766Be93DFE6D43130D7',
    decimals: 6,
    color:    'bg-blue-400',
    chainId:  11155420, // Optimism Sepolia
  },
  {
    // USDC on Base Mainnet
    symbol:   'USDC',
    name:     'USD Coin',
    iconImg:  'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png',
    address:  '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    decimals: 6,
    color:    'bg-blue-400',
    chainId:  8453, // Base Mainnet
  },
  {
    // USDC on Arbitrum One
    symbol:   'USDC',
    name:     'USD Coin',
    iconImg:  'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png',
    address:  '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    decimals: 6,
    color:    'bg-blue-400',
    chainId:  42161, // Arbitrum One
  },
  {
    // USDC on Optimism Mainnet
    symbol:   'USDC',
    name:     'USD Coin',
    iconImg:  'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png',
    address:  '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
    decimals: 6,
    color:    'bg-blue-400',
    chainId:  10, // Optimism Mainnet
  },
  {
    // USDC on Ethereum Mainnet
    symbol:   'USDC',
    name:     'USD Coin',
    iconImg:  'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png',
    address:  '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    decimals: 6,
    color:    'bg-blue-400',
    chainId:  1, // Ethereum Mainnet
  },
  {
    // USDC on Polygon PoS
    symbol:   'USDC',
    name:     'USD Coin',
    iconImg:  'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png',
    address:  '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
    decimals: 6,
    color:    'bg-blue-400',
    chainId:  137, // Polygon Mainnet
  },
];

export function getTokenBySymbol(symbol, chainId) {
  if (chainId) {
    const match = TOKENS.find(t => t.symbol.toUpperCase() === symbol.toUpperCase() && t.chainId === chainId);
    if (match) return match;
  }
  return TOKENS.find(t => t.symbol.toUpperCase() === symbol.toUpperCase()) || TOKENS[0];
}

export function getAllTokens() {
  return TOKENS;
}

export function getSwappableTokens() {
  return TOKENS.filter(t => !t.noSwap);
}
