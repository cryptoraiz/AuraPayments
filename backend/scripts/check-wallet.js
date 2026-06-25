import { ethers } from 'ethers';
import 'dotenv/config';

// The private key user provided (should be configured in .env)
const PRIVATE_KEY = process.env.FAUCET_PRIVATE_KEY || '';
const RPC_URL = 'https://rpc.testnet.arc.network';

async function main() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

    console.log('🔐 Wallet Address:', wallet.address);

    try {
        const balance = await provider.getBalance(wallet.address);
        console.log('💰 Balance:', ethers.formatEther(balance), 'ETH/USDC');
    } catch (e) {
        console.log('Error checking balance:', e.message);
    }
}

main().catch(console.error);
