// bridge.js
// Handles gasless CCTP bridge execution (paying destination gas on behalf of the user)
// Exposed as a Serverless Function by Vercel automatically at /api/relayer/bridge

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
        const { message, attestation, destinationChainId, dstTransmitter } = req.body || {};

        if (!message || !attestation || !destinationChainId || !dstTransmitter) {
            return res.status(400).json({ error: 'Missing required CCTP bridge parameters' });
        }

        const privateKey = process.env.FAUCET_PRIVATE_KEY ? process.env.FAUCET_PRIVATE_KEY.trim() : null;
        if (!privateKey) {
            console.error('[Relayer] FAUCET_PRIVATE_KEY missing');
            return res.status(500).json({ error: 'Relayer is not configured properly (missing private key)' });
        }

        // RPC Maps for Testnets and Mainnets
        const RPC_MAP = {
            // Testnets
            11155111: 'https://ethereum-sepolia-rpc.publicnode.com', // Ethereum Sepolia
            84532:    'https://sepolia.base.org',                    // Base Sepolia
            421614:   'https://sepolia-rollup.arbitrum.io/rpc',      // Arbitrum Sepolia
            11155420: 'https://sepolia.optimism.io',                 // Optimism Sepolia
            5042002:  'https://rpc.testnet.arc.io',                    // Arc Testnet
            // Mainnets
            8453:     'https://mainnet.base.org',                    // Base Mainnet
            42161:    'https://arb1.arbitrum.io/rpc',                // Arbitrum One
            10:       'https://mainnet.optimism.io',                 // Optimism Mainnet
            1:        'https://eth.llamarpc.com',                    // Ethereum Mainnet
            137:      'https://polygon-rpc.com',                     // Polygon PoS
            5042:     'https://5042.rpc.thirdweb.com',               // Arc Mainnet
        };

        const chainIdNum = Number(destinationChainId);
        const rpcUrl = RPC_MAP[chainIdNum] || RPC_MAP[destinationChainId];
        if (!rpcUrl) {
            return res.status(400).json({ error: `Unsupported destination chain ID: ${destinationChainId}` });
        }

        // Lazy load ethers
        const { ethers } = await import('ethers');

        const provider = new ethers.JsonRpcProvider(rpcUrl);
        const wallet = new ethers.Wallet(privateKey, provider);

        // Minimal ABI for MessageTransmitter
        const transmitterAbi = [
            "function receiveMessage(bytes message, bytes attestation) returns (bool)"
        ];

        const transmitterContract = new ethers.Contract(dstTransmitter, transmitterAbi, wallet);

        // Pre-flight check: Estimate Gas.
        // If this reverts, the attestation might be invalid, or the message was already received.
        try {
            await transmitterContract.receiveMessage.estimateGas(message, attestation);
        } catch (gasErr) {
            console.error('[Relayer] Pre-flight gas estimation failed:', gasErr);
            const errStr = (gasErr.message || '').toLowerCase();
            const fullErrStr = JSON.stringify(gasErr).toLowerCase();
            if (
                errStr.includes('nonce already used') || 
                errStr.includes('already used') || 
                errStr.includes('already minted') || 
                errStr.includes('-39000') ||
                fullErrStr.includes('nonce already used') ||
                fullErrStr.includes('-39000')
            ) {
                return res.status(200).json({ 
                    success: true, 
                    alreadyMinted: true, 
                    message: 'Tokens already minted on destination chain' 
                });
            }
            return res.status(400).json({ 
                error: 'Pre-flight check failed. Message might be invalid.', 
                details: gasErr.message 
            });
        }

        // Send the transaction
        console.log(`[Relayer] Broadcasting receiveMessage to ${dstTransmitter} on chain ${destinationChainId}`);
        const tx = await transmitterContract.receiveMessage(message, attestation);
        
        console.log(`[Relayer] Transaction sent: ${tx.hash}`);

        return res.status(200).json({
            success: true,
            txHash: tx.hash,
            message: 'Bridge transaction broadcasted successfully via Relayer'
        });

    } catch (error) {
        console.error('[Relayer] Error executing bridge:', error);
        return res.status(500).json({ error: 'Internal relayer error', details: error.message });
    }
}
