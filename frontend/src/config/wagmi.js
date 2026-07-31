import { http, createConfig } from 'wagmi'
import { mainnet, arbitrum, polygon, optimism, base, sepolia, baseSepolia, arbitrumSepolia, optimismSepolia } from 'wagmi/chains'
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

// WalletConnect Project ID (Load from Env or use Public Fallback for generic testing)
const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || '3a8170812b534d0ff9d794f19a901d64';

export const config = createConfig({
  chains: [arcTestnet, mainnet, arbitrum, polygon, optimism, base, sepolia, baseSepolia, arbitrumSepolia, optimismSepolia],
  batch: {
    multicall: { wait: 50, batchSize: 1024 },
  },
  connectors: [
    injected(),
    walletConnect({ projectId, showQrModal: false }), // AppKit gerencia o modal
    coinbaseWallet({ appName: 'Aura Payments' }),
  ],
  transports: {
    // Use our Vercel proxy to avoid CORS - the proxy forwards to rpc.testnet.arc.network server-side
    [arcTestnet.id]: http(import.meta.env.PROD ? '/api/rpc' : 'https://rpc.testnet.arc.network'),

    [mainnet.id]: http(),
    [arbitrum.id]: http(),
    [polygon.id]: http(),
    [optimism.id]: http(),
    [base.id]: http(),
    [sepolia.id]: http(),
    [baseSepolia.id]: http(),
    [arbitrumSepolia.id]: http(),
    [optimismSepolia.id]: http(),
  },
})
