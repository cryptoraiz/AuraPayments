import { http, createConfig, fallback } from 'wagmi'
import { mainnet, arbitrum, polygon, optimism, base, sepolia, baseSepolia, arbitrumSepolia, optimismSepolia } from 'wagmi/chains'
import { walletConnect, injected, coinbaseWallet } from 'wagmi/connectors'

// Arc Network Mainnet Configuration
export const arcMainnet = {
  id: 5042, // Official Chain ID Arc Mainnet
  name: 'Arc',
  nativeCurrency: {
    decimals: 18,
    name: 'USDC',
    symbol: 'USDC',
  },
  rpcUrls: {
    default: { http: ['https://5042.rpc.thirdweb.com', 'https://rpc.mainnet.arc.io'] },
    public: { http: ['https://5042.rpc.thirdweb.com', 'https://rpc.mainnet.arc.io'] },
  },
  blockExplorers: {
    default: { name: 'Arc Explorer', url: 'https://explorer.arc.io' },
  },
  contracts: {
    multicall3: {
      address: '0xca11bde05977b3631167028862be2a173976ca11',
    },
  },
  testnet: false,
}

// Arc Network Testnet Configuration
export const arcTestnet = {
  id: 5042002, // Official Chain ID Arc Testnet
  name: 'Arc Network Testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'USDC',
    symbol: 'USDC',
  },
  rpcUrls: {
    default: { http: ['https://rpc.testnet.arc.io', 'https://arc-testnet-rpc.publicnode.com', 'https://5042002.rpc.thirdweb.com'] },
    public: { http: ['https://rpc.testnet.arc.io', 'https://arc-testnet-rpc.publicnode.com', 'https://5042002.rpc.thirdweb.com'] },
  },
  blockExplorers: {
    default: { name: 'ArcScan', url: 'https://testnet.arcscan.app' },
  },
  contracts: {
    multicall3: {
      address: '0xca11bde05977b3631167028862be2a173976ca11',
    },
  },
  testnet: true,
}

// WalletConnect Project ID (Load from Env or use Public Fallback for generic testing)
const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || '3a8170812b534d0ff9d794f19a901d64';

export const config = createConfig({
  chains: [arcMainnet, arcTestnet, mainnet, arbitrum, polygon, optimism, base, sepolia, baseSepolia, arbitrumSepolia, optimismSepolia],
  batch: {
    multicall: { wait: 50, batchSize: 1024 },
  },
  connectors: [
    injected(),
    walletConnect({ projectId, showQrModal: false }), // AppKit manages modal
    coinbaseWallet({ appName: 'Aura Payments' }),
  ],
  transports: {
    // Arc Mainnet transport with resilient fallback
    [arcMainnet.id]: fallback([
      http('https://5042.rpc.thirdweb.com'),
      http('https://rpc.mainnet.arc.io'),
    ]),

    // Arc Testnet transport with resilient fallback
    [arcTestnet.id]: fallback([
      http('https://rpc.testnet.arc.io'),
      http('https://arc-testnet-rpc.publicnode.com'),
      http('https://5042002.rpc.thirdweb.com'),
    ]),

    [mainnet.id]: fallback([
      http('https://ethereum-rpc.publicnode.com'),
      http('https://1rpc.io/eth'),
      http('https://rpc.payload.de'),
    ]),
    [arbitrum.id]: fallback([
      http('https://arb1.arbitrum.io/rpc'),
      http('https://arbitrum-one-rpc.publicnode.com'),
    ]),
    [polygon.id]: fallback([
      http('https://polygon-bor-rpc.publicnode.com'),
      http('https://1rpc.io/matic'),
    ]),
    [optimism.id]: fallback([
      http('https://mainnet.optimism.io'),
      http('https://optimism-rpc.publicnode.com'),
    ]),
    [base.id]: fallback([
      http('https://mainnet.base.org'),
      http('https://base-rpc.publicnode.com'),
    ]),
    [sepolia.id]: fallback([
      http('https://ethereum-sepolia-rpc.publicnode.com'),
      http('https://1rpc.io/sepolia'),
    ]),
    [baseSepolia.id]: fallback([
      http('https://sepolia.base.org'),
      http('https://base-sepolia-rpc.publicnode.com'),
    ]),
    [arbitrumSepolia.id]: fallback([
      http('https://sepolia-rollup.arbitrum.io/rpc'),
      http('https://arbitrum-sepolia-rpc.publicnode.com'),
    ]),
    [optimismSepolia.id]: fallback([
      http('https://sepolia.optimism.io'),
      http('https://optimism-sepolia-rpc.publicnode.com'),
    ]),
  },
})
