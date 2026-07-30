// relayer.js
// Handles gasless CCTP bridge execution (paying destination gas on behalf of the user)

export const handleRelayerBridge = async (req, res) => {
    try {
        const { message, attestation, destinationChainId, dstTransmitter } = req.body;

        if (!message || !attestation || !destinationChainId || !dstTransmitter) {
            return res.status(400).json({ error: 'Missing required CCTP bridge parameters' });
        }

        const privateKey = process.env.FAUCET_PRIVATE_KEY ? process.env.FAUCET_PRIVATE_KEY.trim() : null;
        if (!privateKey) {
            console.error('[Relayer] FAUCET_PRIVATE_KEY missing');
            return res.status(500).json({ error: 'Relayer is not configured properly (missing private key)' });
        }

        // RPC Maps for Testnets
        const RPC_MAP = {
            11155111: 'https://ethereum-sepolia-rpc.publicnode.com', // Ethereum Sepolia
            84532:    'https://sepolia.base.org',            // Base Sepolia
            421614:   'https://sepolia-rollup.arbitrum.io/rpc', // Arbitrum Sepolia
            11155420: 'https://sepolia.optimism.io',         // Optimism Sepolia
            5042002:  'https://rpc.testnet.arc.network'      // Arc Testnet
        };

        const rpcUrl = RPC_MAP[destinationChainId];
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
        // This prevents us from losing gas on a reverted transaction.
        try {
            await transmitterContract.receiveMessage.estimateGas(message, attestation);
        } catch (gasErr) {
            console.error('[Relayer] Pre-flight gas estimation failed:', gasErr);
            return res.status(400).json({ 
                error: 'Pre-flight check failed. Message might be invalid or already minted.', 
                details: gasErr.message 
            });
        }

        // Send the transaction
        console.log(`[Relayer] Broadcasting receiveMessage to ${dstTransmitter} on chain ${destinationChainId}`);
        const tx = await transmitterContract.receiveMessage(message, attestation);
        
        console.log(`[Relayer] Transaction sent: ${tx.hash}`);

        // Wait for 1 confirmation to ensure it's mined successfully
        const receipt = await tx.wait(1);

        if (receipt.status === 0) {
            throw new Error('Transaction reverted on chain.');
        }

        return res.status(200).json({
            success: true,
            txHash: receipt.hash,
            message: 'Bridge completed successfully via Relayer'
        });

    } catch (error) {
        console.error('[Relayer] Error executing bridge:', error);
        return res.status(500).json({ error: 'Internal relayer error', details: error.message });
    }
};
