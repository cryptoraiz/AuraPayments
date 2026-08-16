# ⚡ Aura Payments — Decentralized Financial Hub on Arc Network

> Non-custodial B2B on-chain invoicing, Synthra-powered swaps, and Circle CCTP cross-chain bridging with an interactive AI terminal on Arc Testnet.

[![Live Application](https://img.shields.io/badge/Live_App-aurapayments.xyz-blue?style=for-the-badge)](https://www.aurapayments.xyz)
[![Built on Arc Network](https://img.shields.io/badge/Built_on-Arc_Testnet-6366f1?style=for-the-badge)](https://www.arc.net)
[![License MIT](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](LICENSE)

---

## 📌 Overview

**Aura Payments** is an all-in-one financial suite built natively for the **Arc Network**. It streamlines corporate billing and decentralized finance operations into a single, unified, 100% non-custodial interface.

- **Live Application:** [https://www.aurapayments.xyz](https://www.aurapayments.xyz)
- **Target Network:** Arc Testnet (Chain ID `5042002`)
- **Native Gas Asset:** USDC

---

## ✨ Core Features & Modules

### 1. 🧾 B2B Invoicing (Invoice 2.0)
- Instant decentralized payment links settled directly in native **USDC** and **EURC**.
- Direct wallet-to-wallet transfers with automated on-chain verification.
- Client-side downloadable **PDF** invoices and payment receipts generated in real time.
- Custom billing metadata (itemized descriptions, client name, and invoice IDs).

### 2. 💱 Token Swaps (Synthra DEX Integration)
- Native integration with **Synthra DEX** smart contracts and liquidity pools on Arc Testnet.
- Instant token swaps between **USDC**, **EURC**, **USDT**, and **cirBTC**.
- Real-time price routing with direct contract execution without intermediaries.

### 3. 🌉 Cross-Chain Bridge (Circle CCTP)
- Native **USDC** transfers between **Arc Testnet** and connected test networks (**Base Sepolia**, **Arbitrum Sepolia**).
- Powered by Circle's official burn-and-mint **CCTP protocol**, avoiding wrapped token security risks.

### 4. 🤖 Aura AI Terminal
- Natural language financial assistant that translates text commands into signed Web3 calls.
- Multi-tier resilient architecture supporting structured function calling.
- Strictly non-custodial: the assistant never holds private keys; it only prepares transaction payloads for user confirmation in MetaMask or WalletConnect.

---

## 🛠️ Technology Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, Vite, Tailwind CSS |
| **State & Animations** | Framer Motion, TanStack Query |
| **Web3 Integration** | Wagmi, Viem, AppKit |
| **DEX Routing** | Synthra Protocol Smart Contracts |
| **Cross-Chain** | Circle CCTP (Cross-Chain Transfer Protocol) |
| **AI Co-pilot** | Multi-tier AI Engine (Gemini / OpenAI / Groq) with structured function calling |
| **PDF Generation** | jsPDF (Client-side) |
| **Deployment** | Vercel (Edge-optimized) |

---

## 🚀 Getting Started (Local Development)

### Prerequisites
- Node.js 18+ or later
- npm or yarn

### 1. Clone the repository
```bash
git clone https://github.com/cryptoraiz/AuraPayments.git
cd AuraPayments/frontend
```

### 2. Install dependencies
```bash
npm install
```

### 3. Configure environment variables
Create a `.env` file in the `frontend/` directory with the following variables:
```env
VITE_ARC_RPC_URL="https://arc-testnet.rpc.caldera.xyz/http"
VITE_CHAIN_ID="5042002"
VITE_WALLETCONNECT_PROJECT_ID="your_walletconnect_project_id"
OPENAI_API_KEY="your_openai_key"
GEMINI_API_KEY="your_gemini_key"
```

### 4. Start the development server
```bash
npm run dev
```

The application will be available at `http://localhost:5173`.

---

## 🔒 Security & Custody

- **100% Non-Custodial:** No private keys, mnemonics, or sensitive credentials are ever transmitted, stored, or managed by servers.
- **Client-Side Signatures:** All transactions are prepared as payloads and signed exclusively within the user's wallet (MetaMask, WalletConnect, etc.).
- **Open Testnet Validation:** Smart contract integrations and client logic are running in open testnet mode on Arc Testnet.

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
