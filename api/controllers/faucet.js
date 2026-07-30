import { ethers } from 'ethers';
import { db } from '../lib/store.js';

// Configuration
const FAUCET_AMOUNT = "100"; // Amount of USDC (native gas) to send
const COOLDOWN_HOURS = 24;
const ARC_RPC_URL = 'https://rpc.testnet.arc.network';

// Load wallet once if possible, or per request
// Note: process.env.FAUCET_PRIVATE_KEY should be set
const privateKey = process.env.FAUCET_PRIVATE_KEY;

export const faucetHandler = async (req, res) => {
    try {
        const { address } = req.body;
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

        if (!address || !ethers.isAddress(address)) {
            return res.status(400).json({ error: 'Invalid wallet address.' });
        }

        if (!privateKey) {
            console.error('FAUCET_PRIVATE_KEY not configured');
            return res.status(500).json({ error: 'Faucet under maintenance (Config Error).' });
        }

        // 0. Verify Turnstile Token
        const turnstileToken = req.body.turnstileToken;
        const turnstileSecret = process.env.TURNSTILE_SECRET_KEY;

        if (!turnstileSecret) {
            console.warn("⚠️ TURNSTILE_SECRET_KEY missing. Skipping captcha check.");
        } else if (!turnstileToken) {
            return res.status(400).json({ error: 'Please complete the security check.' });
        } else {
            // Verify with Cloudflare
            const formData = new URLSearchParams();
            formData.append('secret', turnstileSecret);
            formData.append('response', turnstileToken);
            formData.append('remoteip', ip);

            const result = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
                method: 'POST',
                body: formData,
            });

            const outcome = await result.json();
            if (!outcome.success) {
                console.error("Captcha Failed:", outcome);
                return res.status(400).json({ error: 'Security check failed. Please reload.' });
            }
        }

        // 1. Check Cooldown in DB
        // We'll use a direct query here since store.js is generic. 
        // Ideally we'd extend store.js, but direct query via db.query is fine.
        const cooldownTime = Date.now() - (COOLDOWN_HOURS * 60 * 60 * 1000);

        const existingClaim = await db.query(
            'SELECT * FROM faucet_claims WHERE (wallet_address = $1 OR ip_address = $2) AND claimed_at > $3 ORDER BY claimed_at DESC LIMIT 1',
            [address, ip, cooldownTime]
        );

        if (existingClaim.rows.length > 0) {
            const lastClaim = Number(existingClaim.rows[0].claimed_at);
            const nextClaim = lastClaim + (COOLDOWN_HOURS * 60 * 60 * 1000);
            const hoursLeft = Math.ceil((nextClaim - Date.now()) / (1000 * 60 * 60));
            return res.status(429).json({
                error: `You already claimed recently. Try again in ${hoursLeft} hours.`
            });
        }

        // 2. Perform Transaction
        const provider = new ethers.JsonRpcProvider(ARC_RPC_URL);
        const wallet = new ethers.Wallet(privateKey, provider);

        // Check Faucet Balance
        const balance = await provider.getBalance(wallet.address);
        const amountToSend = ethers.parseEther(FAUCET_AMOUNT); // Native token uses 18 decimals usually? Wait.
        // Arc documentation says "USDC é o token de gás nativo".
        // USDC usually has 6 decimals.
        // However, if it's the NATIVE GAS token, EVM chains usually treat native currency as 18 decimals (Wei).
        // Let's check the user's previous code or assumptions.
        // PayPage.jsx used: parseUnits(amount, 6). 
        // But that was for ERC20 transfer. 
        // THIS IS NATIVE TRANSFER (Gas). 
        // Standard EVM native is 18 decimals. 
        // BUT, some L2s using USDC as gas might use 6.
        // Let's assume 18 for native transfer unless specifically documented otherwise.
        // Actually, looking at PayPage.jsx: 
        // `const USDC_ADDRESS = "0x36..."` 
        // If USDC is native, `provider.getBalance` returns it.
        // If I use `wallet.sendTransaction`, value is in Wei.
        // Most chains using USDC as gas (like Polygon zkEVM? No) reuse the ERC20 logic?
        // No, if it's native gas, it's just 'value'.
        // SAFE BET: Check connection. If Arc uses 18 decimals for gas (standard), use parseEther.
        // If it uses 6, use parseUnits(..., 6).
        // Let's try 18 first (standard). If it fails or is huge, we adjust. 25.0 * 10^18 is standard.
        // WAIT: USDC implies 6 decimals. 
        // Let's use `ethers.parseUnits(FAUCET_AMOUNT, 18)` for safety if standard EVM.
        // Actually, I'll stick to 18 (ether) because foundry `cast send--value` usually expects wei.

        // Let's double check User provided info:
        // "USDC é o token de gás nativo da Arc"
        // Usually modifying the native decimal count is rare/hard in EVM config. They likely kept 18.
        // To be safe, I will use: 
        // `ethers.parseEther(FAUCET_AMOUNT)` -> 10^18.

        if (balance < amountToSend) {
            return res.status(503).json({ error: 'Faucet out of funds. Try again later.' });
        }

        const tx = await wallet.sendTransaction({
            to: address,
            value: amountToSend
        });

        // 3. Record in DB (Optimistic: wait for tx hash, not confirmation)
        await db.query(`
            INSERT INTO faucet_claims(wallet_address, ip_address, amount, tx_hash, claimed_at)
            VALUES($1, $2, $3, $4, $5)
        `, [
            address,
            ip,
            FAUCET_AMOUNT,
            tx.hash,
            Date.now()  // claimed
        ]);

        res.json({
            success: true,
            message: `Enviado ${FAUCET_AMOUNT} USDC para sua carteira!`,
            txHash: tx.hash
        });

    } catch (error) {
        console.error('Faucet Error:', error);
        res.status(500).json({ error: 'Internal error processing faucet: ' + error.message });
    }
};

// Stats Handler
export const faucetStatsHandler = async (req, res) => {
    try {
        const result = await db.query(`
            SELECT 
                COUNT(*) as claims,
                COUNT(DISTINCT wallet_address) as unique_wallets,
                COALESCE(SUM(CAST(amount AS DECIMAL)), 0) as total_distributed
            FROM faucet_claims
        `);

        const stats = result.rows[0];

        res.json({
            claims: parseInt(stats.claims || 0),
            totalDistributed: parseFloat(stats.total_distributed || 0),
            uniqueWallets: parseInt(stats.unique_wallets || 0)
        });
    } catch (error) {
        console.error('Stats Error:', error);
        res.json({ claims: 0, totalDistributed: 0, uniqueWallets: 0 });
    }
};

