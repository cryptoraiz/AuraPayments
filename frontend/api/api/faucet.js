const { ethers } = require('ethers');

const FAUCET_AMOUNT = "100"; 
const ARC_RPC_URL = 'https://rpc.testnet.arc.network';
const USDC_ADDRESS = "0x3600000000000000000000000000000000000000";
const USDC_DECIMALS = 18;

// A simple in-memory cache to prevent spam within the same serverless instance.
// (Vercel serverless functions are stateless, but this helps mitigate rapid bursts on the same instance)
const ipRateLimit = new Map();
const COOLDOWN_MS = 1000 * 60 * 60 * 2; // 2 hours

module.exports = async function handler(req, res) {
    // CORS Setup
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { address } = req.body;
        const ip = req.headers['x-forwarded-for'] || '0.0.0.0';

        if (!address || !ethers.isAddress(address)) {
            return res.status(400).json({ error: 'Valid wallet address required' });
        }

        const privateKey = process.env.FAUCET_PRIVATE_KEY ? process.env.FAUCET_PRIVATE_KEY.trim() : null;
        if (!privateKey) {
            console.error("FAUCET_PRIVATE_KEY is missing in Environment Variables");
            return res.status(500).json({ error: 'Faucet Backend Configuration Missing' });
        }

        // Basic Rate Limiting
        const lastClaim = ipRateLimit.get(ip) || ipRateLimit.get(address);
        if (lastClaim && (Date.now() - lastClaim) < COOLDOWN_MS) {
            return res.status(429).json({ error: 'Cooldown active. Try again later.' });
        }

        const provider = new ethers.JsonRpcProvider(ARC_RPC_URL);
        const wallet = new ethers.Wallet(privateKey, provider);
        
        const usdcAbi = ["function transfer(address to, uint256 amount) returns (bool)"];
        const usdcContract = new ethers.Contract(USDC_ADDRESS, usdcAbi, wallet);

        const amountToSend = ethers.parseUnits(FAUCET_AMOUNT, USDC_DECIMALS);
        
        console.log(`Sending ${FAUCET_AMOUNT} USDC to ${address}...`);
        
        const tx = await usdcContract.transfer(address, amountToSend);

        // Update rate limits
        ipRateLimit.set(ip, Date.now());
        ipRateLimit.set(address, Date.now());

        return res.status(200).json({
            success: true,
            message: `Sent ${FAUCET_AMOUNT} USDC to your wallet!`,
            txHash: tx.hash
        });

    } catch (e) {
        console.error('Faucet Processing Error:', e);
        // Clean up error message if it's an internal revert
        let msg = e.message;
        if (msg.includes("insufficient funds") || msg.includes("transfer amount exceeds balance")) {
            msg = "Faucet is empty! Please notify the team.";
        }
        return res.status(500).json({ error: msg });
    }
}
