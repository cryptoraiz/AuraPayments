// api/controllers/uniswap.js
// Handles Uniswap Trade API routing (quotes and swap execution transactions)

const UNISWAP_API_BASE = 'https://trade-api.gateway.uniswap.org/v1';

export const handleUniswapQuote = async (req, res) => {
    try {
        const parsedBody = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
        const chainId = Number(parsedBody.tokenInChainId || 5042);

        // On Arc Mainnet, Uniswap executes directly on-chain via SwapRouter02 and QuoterV2
        if (chainId === 5042) {
            return res.status(200).json({
                success: true,
                provider: 'uniswap',
                isArcOnChain: true,
                message: 'Uniswap V3 on Arc Mainnet routes directly on-chain.'
            });
        }

        const apiKey = process.env.UNISWAP_API_KEY || process.env.VITE_UNISWAP_API_KEY || '';
        if (!apiKey) {
            return res.status(200).json({
                success: false,
                configured: false,
                error: 'Uniswap Trading API key is not configured for non-Arc cross-chain queries.'
            });
        }

        const {
            tokenIn,
            tokenOut,
            tokenInChainId,
            tokenOutChainId,
            amount,
            swapper,
            slippageTolerance = 0.5
        } = parsedBody;

        if (!tokenIn || !tokenOut || !amount) {
            return res.status(400).json({
                success: false,
                error: 'Missing required parameters: tokenIn, tokenOut, amount'
            });
        }

        const inputChainId = Number(tokenInChainId || chainId);
        const destinationChainId = Number(tokenOutChainId || inputChainId);

        const quotePayload = {
            tokenIn,
            tokenOut,
            tokenInChainId: inputChainId,
            tokenOutChainId: destinationChainId,
            amount: String(amount),
            type: "EXACT_INPUT",
            swapper: swapper || "0x0000000000000000000000000000000000000000",
            slippageTolerance: Number(slippageTolerance || 0.5)
        };

        const response = await fetch(`${UNISWAP_API_BASE}/quote`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'x-api-key': apiKey.trim()
            },
            body: JSON.stringify(quotePayload)
        });

        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json({
                success: false,
                error: data.detail || data.message || `Uniswap API error (${response.status})`,
                raw: data
            });
        }

        // Format and normalize the response for the frontend
        return res.status(200).json({
            success: true,
            provider: 'uniswap',
            data
        });
    } catch (err) {
        console.error('[Uniswap Quote Error]', err);
        return res.status(500).json({
            success: false,
            error: err.message || 'Internal server error while fetching Uniswap quote'
        });
    }
};

export const handleUniswapBuildTx = async (req, res) => {
    try {
        const parsedBody = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
        const { quote, userAddress, slippageTolerance = 0.5, permitData, signature } = parsedBody;

        if (!quote) {
            return res.status(400).json({
                success: false,
                error: 'Missing required quote payload'
            });
        }

        // If the quote already contains the swap transaction, return it directly
        if (quote.swap || quote.swapTransaction) {
            return res.status(200).json({
                success: true,
                data: {
                    swap: quote.swap || quote.swapTransaction,
                    approval: quote.approval || null
                }
            });
        }

        const apiKey = process.env.UNISWAP_API_KEY || process.env.VITE_UNISWAP_API_KEY || '';
        if (!apiKey) {
            return res.status(200).json({
                success: false,
                configured: false,
                error: 'Uniswap API key is optional. Swaps on Arc Mainnet execute natively on-chain.'
            });
        }


        const swapPayload = {
            quote: quote.quote || quote,
            permitData,
            signature,
            userAddress
        };

        const response = await fetch(`${UNISWAP_API_BASE}/swap`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'x-api-key': apiKey.trim()
            },
            body: JSON.stringify(swapPayload)
        });

        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json({
                success: false,
                error: data.detail || data.message || `Uniswap Swap API error (${response.status})`,
                raw: data
            });
        }

        return res.status(200).json({
            success: true,
            data
        });
    } catch (err) {
        console.error('[Uniswap Build Tx Error]', err);
        return res.status(500).json({
            success: false,
            error: err.message || 'Internal server error while building Uniswap swap transaction'
        });
    }
};
