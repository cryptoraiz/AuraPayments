// Token list for Arc Testnet (chainId: 5042002)
// Addresses and pools verified against Synthra trading API
// Pools with liquidity: USDT/WUSDC, WUSDC/EURC, USDT/EURC (via route)

export const TOKENS = [
  {
    symbol:   'USDT',
    name:     'Tether USD',
    // Reliable trustwallet CDN logo
    iconImg:  'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xdAC17F958D2ee523a2206206994597C13D831ec7/logo.png',
    address:  '0x175CdB1D338945f0D851A741ccF787D343E57952',
    decimals: 18,
    color:    'bg-green-500',
  },
  {
    symbol:   'EURC',
    name:     'Euro Coin',
    iconImg:  'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x1aBaEA1f7C830bD89Acc67eC4af516284b1bC33c/logo.png',
    address:  '0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a',
    decimals: 6,
    color:    'bg-indigo-500',
  },
  {
    symbol:   'WUSDC',
    name:     'Wrapped USDC',
    iconImg:  'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png',
    address:  '0x911b4000D3422F482F4062a913885f7b035382Df',
    decimals: 18,
    color:    'bg-blue-500',
  },
  {
    // USDC precompile do Arc (ERC-20, 6 decimals)
    symbol:   'USDC',
    name:     'USD Coin (Arc)',
    iconImg:  'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png',
    address:  '0x3600000000000000000000000000000000000000',
    decimals: 6,
    color:    'bg-blue-400',
  },
  {
    symbol:   'cirBTC',
    name:     'Circle Bitcoin',
    iconImg:  'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/bitcoin/info/logo.png',
    address:  '0xf0C4a4CE82A5746AbAAd9425360Ab04fbBA432BF',
    decimals: 8,
    color:    'bg-orange-500',
  },
  {
    // USDC da Base Sepolia
    symbol:   'USDC',
    name:     'USD Coin',
    iconImg:  'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png',
    address:  '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    decimals: 6,
    color:    'bg-blue-400',
    chainId:  84532, // Base Sepolia
  },
  {
    // USDC do Arbitrum Sepolia
    symbol:   'USDC',
    name:     'USD Coin',
    iconImg:  'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png',
    address:  '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d',
    decimals: 6,
    color:    'bg-blue-400',
    chainId:  421614, // Arbitrum Sepolia
  },
  {
    // USDC do Ethereum Sepolia
    symbol:   'USDC',
    name:     'USD Coin',
    iconImg:  'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png',
    address:  '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    decimals: 6,
    color:    'bg-blue-400',
    chainId:  11155111, // Ethereum Sepolia
  },
  {
    // USDC do Optimism Sepolia
    symbol:   'USDC',
    name:     'USD Coin',
    iconImg:  'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png',
    address:  '0x5fd84259d66Cd46123540766Be93DFE6D43130D7',
    decimals: 6,
    color:    'bg-blue-400',
    chainId:  11155420, // Optimism Sepolia
  },
  {
    // USDC do Sonic Testnet (Blaze)
    symbol:   'USDC',
    name:     'USD Coin',
    iconImg:  'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png',
    address:  '0xA4879Fed32Ecbef99399e5cbC247E533421C4eC6',
    decimals: 6,
    color:    'bg-blue-400',
    chainId:  64165, // Sonic Testnet
  },
];

export function getTokenBySymbol(symbol) {
  return TOKENS.find(t => t.symbol.toUpperCase() === symbol.toUpperCase()) || TOKENS[0];
}

export function getAllTokens() {
  return TOKENS;
}

export function getSwappableTokens() {
  return TOKENS.filter(t => !t.noSwap);
}
