# ⚡ Aura Payments — Web3 Payment Gateway & Invoicing on Arc Network

> Non-custodial enterprise on-chain invoicing, decentralized checkout, Synthra DEX swaps, and Circle CCTP cross-chain bridging with an interactive AI financial terminal on Arc Mainnet & Testnet.

[![Live Application](https://img.shields.io/badge/Live_App-aurapayments.xyz-blue?style=for-the-badge)](https://www.aurapayments.xyz)
[![Built on Arc Network](https://img.shields.io/badge/Arc_Network-Mainnet_%26_Testnet-6366f1?style=for-the-badge)](https://arc.network)
[![License MIT](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](LICENSE)

---

## 📌 Overview

**Aura Payments** is a financial infrastructure suite built natively for the **Arc Network**. It streamlines Web3 billing, merchant checkout, and decentralized finance operations into a unified, 100% non-custodial interface.

- **Live Application:** [https://www.aurapayments.xyz](https://www.aurapayments.xyz)
- **Supported Networks:** 
  - **Arc Mainnet** (Chain ID `5042`)
  - **Arc Testnet** (Chain ID `5042002`)
- **Native Gas Token:** USDC (instant finality, sub-cent fees)
- **Explorer:** [https://explorer.arc.io](https://explorer.arc.io)

---

## ✨ Core Features & Modules

### 1. 🧾 B2B Invoicing & Merchant Checkout (Invoice 2.0)
- Decentralized payment links settled directly in native **USDC** and **EURC**.
- Direct wallet-to-wallet transfers with automated on-chain verification.
- Client-side downloadable **PDF** invoices and payment receipts generated in real time.
- Custom billing metadata (itemized descriptions, client name, and invoice IDs).

### 2. 📜 Smart Contract Layer (`contracts/AuraPayments.sol`)
- On-chain payment settlement and immutable invoice registry on Arc.
- Transparent event logging (`PaymentProcessed`, `InvoiceCreated`) for institutional accounting.
- Direct payment routing with zero protocol friction.

### 3. 💱 Token Swaps (Synthra DEX Integration)
- Native integration with **Synthra DEX** liquidity pools on Arc.
- Real-time token swaps between **USDC**, **EURC**, **USDT**, and **cirBTC**.
- Direct contract-level execution without intermediaries.

### 4. 🌉 Cross-Chain Bridge (Circle CCTP)
- Native **USDC** transfers between **Arc** and connected EVM networks (**Base**, **Arbitrum**, **Ethereum**).
- Powered by Circle's official burn-and-mint **CCTP protocol**, eliminating wrapped token security risks.

### 5. 🤖 Aura AI Terminal
- Financial assistant that translates natural language commands into verified Web3 transactions.
- Strictly non-custodial: the assistant prepares transaction payloads for explicit user confirmation in MetaMask or WalletConnect.

---

## 🛠️ Technology Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, Vite, Tailwind CSS |
| **State & Animations** | Framer Motion, TanStack Query |
| **Web3 & Wallet** | Wagmi, Viem, AppKit (Reown) |
| **Smart Contracts** | Solidity 0.8.20 (Arc EVM Compatible) |
| **DEX Routing** | Synthra Protocol Smart Contracts |
| **Cross-Chain** | Circle CCTP (Cross-Chain Transfer Protocol) |
| **PDF Generation** | jsPDF (Client-side) |
| **Hosting & CI/CD** | Vercel (Edge Network) |

---

## 📂 Repository Structure

```text
AuraPayments/
├── contracts/               # Solidity Smart Contracts
│   ├── AuraPayments.sol     # Web3 payment gateway & invoice settlement
│   ├── AuraVault.sol        # Multi-asset treasury and liquidity vault
│   └── Faucet.sol           # Arc testnet developer faucet
├── frontend/                # Web Application
│   ├── src/
│   │   ├── components/      # UI components (Navbar, modals, forms)
│   │   ├── config/          # Network, chain and token configurations
│   │   ├── pages/           # Application views (Invoice, Trade, Bridge, Profile)
│   │   └── utils/           # Web3 utilities and PDF receipt generators
│   └── public/              # Static vector assets and icons
├── api/                     # Backend controllers and edge handlers
└── README.md                # Project documentation
```

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

### 3. Start the development server
```bash
npm run dev
```

The application will be available at `http://localhost:5173`.

---

## 🔒 Security & Custody

- **100% Non-Custodial:** No private keys, seed phrases, or sensitive credentials are ever handled by application servers.
- **Client-Side Signatures:** All transactions are constructed in-memory and signed exclusively within the user's connected wallet.
- **Immutable On-Chain Verification:** Settlement and invoices are permanently verifiable on the Arc block explorer.

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
