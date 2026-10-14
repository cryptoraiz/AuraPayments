// frontend/api/swap/uniswap.js
// Vercel Serverless Function proxy for Uniswap Trade API

const UNISWAP_API_BASE = 'https://trade-api.gateway.uniswap.org/v1';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

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

    try {
        const { action = 'quote' } = parsedBody;

        if (action === 'build-tx' || parsedBody.quote) {
            const { quote, userAddress, slippageTolerance = 0.5, permitData, signature } = parsedBody;

            if (quote?.swap || quote?.swapTransaction) {
                return res.status(200).json({
                    success: true,
                    data: {
                        swap: quote.swap || quote.swapTransaction,
                        approval: quote.approval || null
                    }
                });
            }

            const response = await fetch(`${UNISWAP_API_BASE}/swap`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'x-api-key': apiKey.trim()
                },
                body: JSON.stringify({
                    quote: quote?.quote || quote,
                    permitData,
                    signature,
                    userAddress
                })
            });

            const data = await response.json();
            if (!response.ok) {
                return res.status(response.status).json({
                    success: false,
                    error: data.detail || data.message || `Uniswap API error (${response.status})`
                });
            }

            return res.status(200).json({ success: true, data });
        }

        // Default: Quote
        const {
            tokenIn,
            tokenOut,
            tokenInChainId = 5042,
            tokenOutChainId = 5042,
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

        const quotePayload = {
            tokenIn,
            tokenOut,
            tokenInChainId: Number(tokenInChainId),
            tokenOutChainId: Number(tokenOutChainId),
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
                error: data.detail || data.message || `Uniswap API error (${response.status})`
            });
        }

        return res.status(200).json({ success: true, provider: 'uniswap', data });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
}
