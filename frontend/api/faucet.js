import { ethers } from 'ethers';

const FAUCET_AMOUNT = "100"; 
const ARC_RPC_URL = 'https://rpc.testnet.arc.network';
const USDC_ADDRESS = "0x3600000000000000000000000000000000000000";
const USDC_DECIMALS = 6;

// A simple in-memory cache to prevent spam within the same serverless instance.
// (Vercel serverless functions are stateless, but this helps mitigate rapid bursts on the same instance)
const ipRateLimit = new Map();
const COOLDOWN_MS = 1000 * 60 * 60 * 2; // 2 hours

export default async function handler(req, res) {
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
        
        const delay = (ms) => new Promise(res => setTimeout(res, ms));
        let tx;
        let retries = 3;
        
        while (retries > 0) {
            try {
                console.log(`Attempting to send ${FAUCET_AMOUNT} USDC to ${address}. Retries left: ${retries - 1}`);
                tx = await usdcContract.transfer(address, amountToSend);
                break; // success
            } catch (err) {
                if (err.message && err.message.includes("request limit reached")) {
                    console.log("RPC Rate limit hit, retrying in 1.5s...");
                    retries--;
                    if (retries === 0) throw err;
                    await delay(1500);
                } else {
                    throw err; // other errors
                }
            }
        }

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
        let msg = e.message;
        if (msg.includes("insufficient funds") || msg.includes("transfer amount exceeds balance")) {
            msg = "Faucet is empty! Please notify the team.";
        } else if (msg.includes("request limit reached")) {
            msg = "RPC Rate limit reached. The network is too busy, please try again in a few seconds.";
        }
        return res.status(500).json({ error: msg });
    }
}
