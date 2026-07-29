import { http, createConfig } from 'wagmi'
import { mainnet, arbitrum, polygon, optimism, base } from 'wagmi/chains'
import { walletConnect, injected, coinbaseWallet } from 'wagmi/connectors'

// Arc Network Testnet Configuration
export const arcTestnet = {
  id: 5042002, // Chain ID Oficial
  name: 'Arc Network Testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'USDC',
    symbol: 'USDC',
  },
  rpcUrls: {
    default: { http: ['https://rpc.testnet.arc.network'] },
    public: { http: ['https://rpc.testnet.arc.network'] },
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

// Sonic Testnet Configuration
export const sonicTestnet = {
  id: 64165,
  name: 'Sonic Testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'Sonic',
    symbol: 'S',
  },
  rpcUrls: {
    default: { http: ['https://rpc.testnet.soniclabs.com'] },
    public: { http: ['https://rpc.testnet.soniclabs.com'] },
  },
  blockExplorers: {
    default: { name: 'Sonic Explorer', url: 'https://testnet.soniclabs.com' },
  },
  testnet: true,
}

// WalletConnect Project ID (Load from Env or use Public Fallback for generic testing)
const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || '3a8170812b534d0ff9d794f19a901d64';

export const config = createConfig({
  chains: [arcTestnet, sonicTestnet, mainnet, arbitrum, polygon, optimism, base],
  batch: {
    multicall: { wait: 50, batchSize: 1024 },
  },
  connectors: [
    injected(),
    walletConnect({ projectId, showQrModal: false }), // AppKit gerencia o modal
    coinbaseWallet({ appName: 'ARC Connect' }),
  ],
  transports: {
    // Use our Vercel proxy to avoid CORS — the proxy forwards to rpc.testnet.arc.network server-side
    [arcTestnet.id]: http(import.meta.env.PROD ? '/api/rpc' : 'https://rpc.testnet.arc.network'),
    [sonicTestnet.id]: http(),
    [mainnet.id]: http(),
    [arbitrum.id]: http(),
    [polygon.id]: http(),
    [optimism.id]: http(),
    [base.id]: http(),
  },
})