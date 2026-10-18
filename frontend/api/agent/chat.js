import { GoogleGenerativeAI } from "@google/generative-ai";

let genAI = null;

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
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
        const { messages, userAddress, networkName, chainId, usdcBalance } = body;

        if (!messages || !Array.isArray(messages)) {
            return res.status(400).json({ error: "Messages array is required." });
        }

        const activeNetwork = networkName || 'Arc Mainnet';
        const activeChainId = chainId || 5042;
        const usdcBalNum = (usdcBalance !== undefined && usdcBalance !== null) ? Number(usdcBalance) : 0;
        const formattedBalance = usdcBalNum.toFixed(4);
        const isTestnet = activeNetwork.toLowerCase().includes('testnet');
        const isMainnet = !isTestnet;
        const supportedTokensList = isMainnet ? "USDC, EURC, cirBTC" : "USDC, EURC, USDT, cirBTC";

        const lastUserMsg = messages.filter(m => m.role === 'user').pop()?.content || "";
        const prompt = lastUserMsg.trim().toLowerCase();

        // 1. Guardrail: User asks to swap/trade USDT on Arc Mainnet
        if (isMainnet && (prompt.includes('usdt') || prompt.includes('tether'))) {
            const isPt = /troca|trocar|quero|muda|dolar|dólar|pra|para|comprar|fazer|qual|saldo/i.test(messages.map(m=>m.content).join(' '));
            return res.status(200).json({
                success: true,
                engine: "token_guardrail",
                message: {
                    role: "assistant",
                    content: isPt
                        ? `⚠️ O token **USDT** ainda não existe na rede principal (**Arc Mainnet**). Ele está disponível apenas no ambiente de testes (Arc Testnet).\n\n• Tokens disponíveis para troca na Arc Mainnet: **USDC**, **EURC** e **cirBTC**.\n\nDeseja realizar a troca para **EURC** ou **cirBTC**?`
                        : `⚠️ The token **USDT** does not exist on **Arc Mainnet** yet (it is currently only available on Arc Testnet).\n\n• Supported tokens for swap on Arc Mainnet: **USDC**, **EURC**, and **cirBTC**.\n\nWould you like to swap for **EURC** or **cirBTC** instead?`
                },
                action: null
            });
        }

        // 2. Follow-up Check: User sends ONLY an amount (e.g. "15", "15 usdc", "1", "1 dol")
        const singleNumMatch = prompt.match(/^(?:troca|trocar|muda|mudar|swap|use|quero|muda pra|troca pra)?\s*(\d+(?:\.\d+)?)\s*(?:usdc|dol|dolar|dolares|dollars)?$/i);
        if (singleNumMatch) {
            const amount = parseFloat(singleNumMatch[1]);
            const prevContext = findPreviousContext(messages, isTestnet);

            if (prevContext.type === 'bridge') {
                if (prevContext.destination) {
                    const isPt = /troca|quero|muda|dolar|dólar|pra|enviar|ponte|rede|quantos/i.test(messages.map(m=>m.content).join(' '));
                    return res.status(200).json({
                        success: true,
                        engine: "followup_bridge",
                        message: {
                            role: "assistant",
                            content: isPt
                                ? `🌉 **Ponte Cross-Chain (CCTP) Preparada:**\n\n• **Valor:** ${amount} USDC\n• **Destino:** ${prevContext.destination}\n• **Rede de Origem:** ${activeNetwork}\n\nClique no botão abaixo para revisar e iniciar a transferência via bridge.`
                                : `🌉 **Cross-Chain Bridge (CCTP) Prepared:**\n\n• **Amount:** ${amount} USDC\n• **Destination:** ${prevContext.destination}\n• **Source Network:** ${activeNetwork}\n\nPlease click below to review and initiate the liquidity bridge.`,
                            action: {
                                action: "UI_PREPARE_BRIDGE",
                                payload: { amount, destination: prevContext.destination, network: activeNetwork }
                            }
                        },
                        action: {
                            action: "UI_PREPARE_BRIDGE",
                            payload: { amount, destination: prevContext.destination, network: activeNetwork }
                        }
                    });
                } else {
                    const destList = isTestnet 
                        ? "Base Sepolia, Arbitrum Sepolia, Optimism Sepolia, Ethereum Sepolia"
                        : "Base, Arbitrum One, Optimism, Ethereum, Polygon";
                    const isPt = /troca|quero|muda|dolar|dólar|pra|enviar|ponte/i.test(messages.map(m=>m.content).join(' '));
                    return res.status(200).json({
                        success: true,
                        engine: "ask_destination",
                        message: {
                            role: "assistant",
                            content: isPt
                                ? `Perfeito! Para qual rede você deseja enviar os **${amount} USDC** via Circle CCTP?\n\n• Escolha entre: **${destList}**`
                                : `Got it! Which destination network would you like to bridge the **${amount} USDC** to via Circle CCTP?\n\n• Choose from: **${destList}**`
                        },
                        action: null
                    });
                }
            } else {
                const { from, to } = findPreviousSwapTokens(messages, isMainnet);
                if (to) {
                    return res.status(200).json({
                        success: true,
                        engine: "followup_swap",
                        message: {
                            role: "assistant",
                            content: `🔄 **Swap Transaction Prepared:**\n\n• **Swap:** ${amount} ${from}\n• **Receive:** ${to}\n• **Network:** ${activeNetwork}\n\nPlease click below to review quote and execute the swap securely in the Trade terminal.`,
                            action: {
                                action: "UI_PREPARE_SWAP",
                                payload: { amount, from, to, network: activeNetwork }
                            }
                        },
                        action: {
                            action: "UI_PREPARE_SWAP",
                            payload: { amount, from, to, network: activeNetwork }
                        }
                    });
                } else {
                    const tokenOptions = isMainnet ? "**EURC** ou **cirBTC**" : "**EURC**, **USDT** ou **cirBTC**";
                    const tokenOptionsEn = isMainnet ? "**EURC** or **cirBTC**" : "**EURC**, **USDT**, or **cirBTC**";
                    const isPt = /troca|quero|muda|dolar|dólar|pra|para|por|ativo|qual|saldo/i.test(messages.map(m=>m.content).join(' '));
                    return res.status(200).json({
                        success: true,
                        engine: "ask_swap_token",
                        message: {
                            role: "assistant",
                            content: isPt
                                ? `Perfeito! Para qual ativo você gostaria de trocar seus **${amount} USDC**?\n\n• Opções na ${activeNetwork}: ${tokenOptions}`
                                : `Got it! Which token would you like to receive in exchange for your **${amount} USDC**?\n\n• Available options on ${activeNetwork}: ${tokenOptionsEn}`
                        },
                        action: null
                    });
                }
            }
        }

        // 3. Follow-up Check: User sends ONLY a destination network (e.g. "Polygon", "Base", "pra arbitrum", "opt")
        const destMatch = extractDestinationFromText(lastUserMsg, isTestnet);
        const hasAmountInMsg = /\b\d+(?:\.\d+)?\b/.test(lastUserMsg);
        if (destMatch && !hasAmountInMsg) {
            const prevAmount = findPreviousBridgeAmount(messages) || findPreviousAmount(messages);
            if (prevAmount) {
                const isPt = /troca|quero|muda|dolar|dólar|pra|enviar|ponte|rede|quantos/i.test(messages.map(m=>m.content).join(' '));
                return res.status(200).json({
                    success: true,
                    engine: "followup_destination",
                    message: {
                        role: "assistant",
                        content: isPt
                            ? `🌉 **Ponte Cross-Chain (CCTP) Preparada:**\n\n• **Valor:** ${prevAmount} USDC\n• **Destino:** ${destMatch}\n• **Rede de Origem:** ${activeNetwork}\n\nClique no botão abaixo para revisar e iniciar a transferência via bridge.`
                            : `🌉 **Cross-Chain Bridge (CCTP) Prepared:**\n\n• **Amount:** ${prevAmount} USDC\n• **Destination:** ${destMatch}\n• **Source Network:** ${activeNetwork}\n\nPlease click below to review and initiate the liquidity bridge.`,
                        action: {
                            action: "UI_PREPARE_BRIDGE",
                            payload: { amount: prevAmount, destination: destMatch, network: activeNetwork }
                        }
                    },
                    action: {
                        action: "UI_PREPARE_BRIDGE",
                        payload: { amount: prevAmount, destination: destMatch, network: activeNetwork }
                    }
                });
            } else {
                const isPt = /troca|quero|muda|dolar|dólar|pra|enviar|ponte|rede|quantos/i.test(messages.map(m=>m.content).join(' '));
                return res.status(200).json({
                    success: true,
                    engine: "ask_bridge_amount",
                    message: {
                        role: "assistant",
                        content: isPt
                            ? `Perfeito! Quantos USDC você gostaria de enviar para a rede **${destMatch}** via CCTP?`
                            : `Got it! How many USDC would you like to bridge to **${destMatch}** via Circle CCTP?`
                    },
                    action: null
                });
            }
        }

        // 4. Follow-up Check: User sends ONLY a swap target token (e.g. "EURC", "cirBTC", "para eurc")
        const swapTarget = extractSwapTargetToken(lastUserMsg, isMainnet);
        if (swapTarget && !hasAmountInMsg) {
            const prevAmount = findPreviousAmount(messages);
            if (prevAmount) {
                const isPt = /troca|quero|muda|dolar|dólar|pra|para|por|ativo|qual|saldo/i.test(messages.map(m=>m.content).join(' '));
                return res.status(200).json({
                    success: true,
                    engine: "followup_swap_token",
                    message: {
                        role: "assistant",
                        content: isPt
                            ? `🔄 **Transação de Swap Preparada:**\n\n• **Trocar:** ${prevAmount} USDC\n• **Receber:** ${swapTarget}\n• **Rede:** ${activeNetwork}\n\nClique no botão abaixo para conferir a cotação e executar a troca com segurança no terminal de Trade.`
                            : `🔄 **Swap Transaction Prepared:**\n\n• **Swap:** ${prevAmount} USDC\n• **Receive:** ${swapTarget}\n• **Network:** ${activeNetwork}\n\nPlease click below to review quote and execute the swap securely in the Trade terminal.`,
                        action: {
                            action: "UI_PREPARE_SWAP",
                            payload: { amount: prevAmount, from: "USDC", to: swapTarget, network: activeNetwork }
                        }
                    },
                    action: {
                        action: "UI_PREPARE_SWAP",
                        payload: { amount: prevAmount, from: "USDC", to: swapTarget, network: activeNetwork }
                    }
                });
            } else {
                const isPt = /troca|quero|muda|dolar|dólar|pra|para|por|ativo|qual/i.test(messages.map(m=>m.content).join(' '));
                return res.status(200).json({
                    success: true,
                    engine: "ask_swap_amount",
                    message: {
                        role: "assistant",
                        content: isPt
                            ? `Perfeito! Quantos USDC você gostaria de trocar por **${swapTarget}**?`
                            : `Great! How many USDC would you like to swap for **${swapTarget}**?`
                    },
                    action: null
                });
            }
        }

        // 4. TIER 1: OpenAI API (gpt-4o-mini)
        if (process.env.OPENAI_API_KEY) {
            try {
                const openaiResult = await callOpenAIEngine(messages, userAddress, activeNetwork, activeChainId, formattedBalance, usdcBalNum);
                return res.status(200).json({
                    success: true,
                    engine: "aura-core",
                    message: {
                        role: "assistant",
                        content: openaiResult.content,
                        action: openaiResult.action
                    },
                    action: openaiResult.action
                });
            } catch (openaiErr) {
                console.warn("[Aura AI] OpenAI API failed, falling back to Gemini:", openaiErr.message);
            }
        }

        // 5. TIER 2: Google Gemini API (gemini-1.5-flash)
        if (process.env.GEMINI_API_KEY) {
            try {
                const geminiResult = await callGeminiEngine(messages, userAddress, activeNetwork, activeChainId, formattedBalance, usdcBalNum);
                return res.status(200).json({
                    success: true,
                    engine: "aura-core",
                    message: {
                        role: "assistant",
                        content: geminiResult.content,
                        action: geminiResult.action
                    },
                    action: geminiResult.action
                });
            } catch (geminiErr) {
                console.warn("[Aura AI] Gemini API failed:", geminiErr.message);
            }
        }

        // 6. TIER 3: Deterministic Fallback Engine
        const fallbackResult = handleDeterministicIntent(messages, userAddress, activeNetwork, activeChainId, formattedBalance, usdcBalNum);
        return res.status(200).json({
            success: true,
            engine: "deterministic",
            message: {
                role: "assistant",
                content: fallbackResult.content,
                action: fallbackResult.action
            },
            action: fallbackResult.action
        });

    } catch (error) {
        console.error("[Agent Chat Error]:", error);
        return res.status(500).json({ 
            error: "Error processing Artificial Intelligence request.", 
            details: error.message 
        });
    }
}

async function callOpenAIEngine(messages, userAddress, activeNetwork, activeChainId, formattedBalance, usdcBalance) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY not configured.");

    const isTestnet = activeNetwork.toLowerCase().includes('testnet');
    const isMainnet = !isTestnet;
    const destNetworks = isTestnet
        ? "Base Sepolia, Arbitrum Sepolia, Optimism Sepolia, Ethereum Sepolia"
        : "Base, Arbitrum One, Optimism, Ethereum, Polygon";
    const supportedTokensList = isMainnet ? "USDC, EURC, cirBTC" : "USDC, EURC, USDT, cirBTC";

    const systemPrompt = `You are Aura AI, the official financial co-pilot of Aura Payments.
Active Network: ${activeNetwork} (Chain ID: ${activeChainId}).
User connected wallet address: ${userAddress || 'Not connected'}.
User Native USDC Balance: ${formattedBalance} USDC.
Your goal is to help users execute swaps, cross-chain CCTP bridges, and create instant B2B on-chain invoices on ${activeNetwork}.

CRITICAL SYSTEM RULES:
1. Always be concise, helpful, objective, and professional.
2. LANGUAGE RULE: Default is ENGLISH. If the user writes in Portuguese (or any other language, such as "quais redes?", "olá", "troca"), YOU MUST RESPOND IN THAT SAME LANGUAGE with 100% natural fluency! Never respond in English to a Portuguese message.
3. OFFICIAL KNOWLEDGE & LINKS:
   - Official Website: https://www.aurapayments.xyz
   - Official X / Twitter: https://x.com/danilo_schrute
4. TOKEN AVAILABILITY RULES BY NETWORK:
   - On Arc Mainnet (Chain ID 5042):
     • Available tokens for trading: USDC (native gas), EURC (Circle Euro), cirBTC (Circle Bitcoin).
     • TOKENS THAT DO NOT EXIST ON ARC MAINNET: USDT, ETH, BTC, SOL, DAI.
     • CRITICAL: USDT is NOT deployed and does NOT exist on Arc Mainnet (it only exists on Arc Testnet).
     • If the user asks to swap, trade, or buy USDT while on Arc Mainnet:
       DO NOT call prepare_swap!
       You MUST explain directly and clearly:
       "⚠️ O token **USDT** ainda não existe / não foi lançado na rede principal (**Arc Mainnet**), estando disponível apenas na Arc Testnet. Na Arc Mainnet, os tokens suportados para negociação são: **USDC**, **EURC** e **cirBTC**."
       (Or in English if user wrote in English: "The token **USDT** does not exist on **Arc Mainnet** yet (it is currently only available on Arc Testnet). Supported tokens on Arc Mainnet are **USDC**, **EURC**, and **cirBTC**.")
   - On Arc Testnet (Chain ID 5042002):
     • Available tokens: USDC, EURC, USDT, cirBTC.
5. BRIDGE DESTINATION SELECTION RULE:
   - Destination networks for ${activeNetwork}: ${destNetworks}.
   - NEVER call prepare_bridge if the destination network has not been explicitly chosen by the user!
   - NEVER guess or auto-fill a destination network (do NOT default to Polygon, Base, etc.).
   - If the user provides an amount (e.g. "15", "10 USDC") but HAS NOT specified a destination network, DO NOT call prepare_bridge. Instead, ask the user:
     "Which destination network would you like to bridge [amount] USDC to? Choose from: ${destNetworks}" (or in Portuguese if message is in PT).
   - ONLY call prepare_bridge when BOTH amount AND destination network are explicitly confirmed by the user.
6. SWAP SELECTION RULE:
   - Supported tokens on ${activeNetwork}: ${supportedTokensList}.
   - Available destination tokens on Arc Mainnet: EURC and cirBTC. (USDT is NOT on Arc Mainnet!).
   - Available destination tokens on Arc Testnet: EURC, USDT, and cirBTC.
   - NEVER call prepare_swap if the user did NOT explicitly specify which token they want to receive (toToken)!
   - NEVER guess or auto-fill a destination token (do NOT default to cirBTC, EURC, or USDT).
   - If the user provides an amount (e.g. "1", "10 USDC") or says they want to swap but HAS NOT specified which token they want to receive, DO NOT call prepare_swap. Instead, ask the user:
     "Which token would you like to receive in exchange for your [amount] USDC? Choose from: ${isMainnet ? 'EURC or cirBTC' : 'EURC, USDT, or cirBTC'}" (or in Portuguese if the user writes in Portuguese).
   - ONLY call prepare_swap when BOTH amount AND destination token (toToken) are explicitly specified or confirmed by the user.
7. BALANCE VERIFICATION:
   - If the user requests to swap or bridge an amount greater than their wallet balance (${formattedBalance} USDC), do NOT call prepare_swap or prepare_bridge. Instead, explain directly that their wallet balance (${formattedBalance} USDC) is insufficient.
8. Structure responses cleanly with bullet points (•), bold text (**bold**), and line breaks.`;

    const openAITools = [
        {
            type: "function",
            function: {
                name: "prepare_swap",
                description: `Prepares an on-chain token swap/trade transaction on ${activeNetwork}. Supported tokens on ${activeNetwork}: ${supportedTokensList}. Trigger ONLY when the user explicitly specified the toToken. DO NOT guess or auto-select toToken. DO NOT trigger if token is not available on ${activeNetwork} (e.g. USDT does not exist on Arc Mainnet).`,
                parameters: {
                    type: "object",
                    properties: {
                        amount: { type: "number", description: "Amount to swap" },
                        fromToken: { type: "string", description: `Source token symbol (${supportedTokensList})` },
                        toToken: { type: "string", description: `Destination token symbol (${supportedTokensList}). User MUST have explicitly requested this token.` }
                    },
                    required: ["amount", "fromToken", "toToken"]
                }
            }
        },
        {
            type: "function",
            function: {
                name: "prepare_bridge",
                description: `Prepares a CCTP cross-chain bridge transaction from ${activeNetwork} to other networks. Trigger ONLY when BOTH the amount and destination network are explicitly chosen by the user. Supported destinations on Mainnet: Base, Arbitrum One, Optimism, Ethereum, Polygon. Supported destinations on Testnet: Base Sepolia, Arbitrum Sepolia, Optimism Sepolia, Ethereum Sepolia.`,
                parameters: {
                    type: "object",
                    properties: {
                        amount: { type: "number", description: "USDC amount to send" },
                        destinationNetwork: { 
                            type: "string", 
                            description: "Explicit destination network chosen by the user. Do not guess." 
                        }
                    },
                    required: ["amount", "destinationNetwork"]
                }
            }
        },
        {
            type: "function",
            function: {
                name: "generate_invoice",
                description: `Generates a B2B payment invoice link on ${activeNetwork}.`,
                parameters: {
                    type: "object",
                    properties: {
                        amount: { type: "number", description: "Invoice amount in USDC" },
                        clientName: { type: "string", description: "Client or company name" },
                        description: { type: "string", description: "Optional description" }
                    },
                    required: ["amount", "clientName"]
                }
            }
        },
        {
            type: "function",
            function: {
                name: "find_yields",
                description: "Searches top DeFi yield pools and APY opportunities.",
                parameters: {
                    type: "object",
                    properties: {
                        token: { type: "string", description: "Token to check yields for (USDC, EURC, USDT, cirBTC). Default USDC." }
                    },
                    required: ["token"]
                }
            }
        },
        {
            type: "function",
            function: {
                name: "get_portfolio_stats",
                description: "Retrieves portfolio performance and 7d revenue stats.",
                parameters: {
                    type: "object",
                    properties: {
                        period: { type: "string", description: "Analysis period ('today', 'week', 'month', 'all')." }
                    },
                    required: []
                }
            }
        }
    ];

    const openAIMessages = [
        { role: "system", content: systemPrompt },
        ...messages.map(m => ({
            role: m.role === 'model' ? 'assistant' : m.role,
            content: m.content || " "
        }))
    ];

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: openAIMessages,
            tools: openAITools,
            tool_choice: "auto",
            temperature: 0.2,
            max_tokens: 1024
        })
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`OpenAI API error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    const choice = data.choices?.[0]?.message;

    if (choice?.tool_calls && choice.tool_calls.length > 0) {
        const toolCall = choice.tool_calls[0];
        const fnName = toolCall.function.name;
        let args = {};
        try {
            args = JSON.parse(toolCall.function.arguments);
        } catch (_) {
            args = {};
        }

        if (fnName === "prepare_swap") {
            const amount = args.amount || 1;
            const from = (args.fromToken || "USDC").toUpperCase();
            const to = (args.toToken || "").toUpperCase();

            // Guardrail: USDT on Arc Mainnet
            if (isMainnet && (to === 'USDT' || from === 'USDT')) {
                const isPt = /troca|quero|muda|dolar|dólar|pra|para/i.test(messages.map(m=>m.content).join(' '));
                return {
                    content: isPt
                        ? `⚠️ O token **USDT** ainda não existe na rede principal (**Arc Mainnet**). Ele está disponível apenas no ambiente de testes (Arc Testnet).\n\n• Tokens disponíveis para troca na Arc Mainnet: **USDC**, **EURC** e **cirBTC**.\n\nDeseja realizar a troca para **EURC** ou **cirBTC**?`
                        : `⚠️ The token **USDT** does not exist on **Arc Mainnet** yet (it is currently only available on Arc Testnet).\n\n• Supported tokens for swap on Arc Mainnet: **USDC**, **EURC**, and **cirBTC**.\n\nWould you like to swap for **EURC** or **cirBTC** instead?`,
                    action: null
                };
            }

            // Verify if user actually specified toToken
            const userSpecifiedToken = hasTargetTokenBeenMentionedByUser(messages);
            if (!to || (!userSpecifiedToken && !extractSwapTargetToken(messages.filter(m=>m.role==='user').pop()?.content))) {
                const tokenOptions = isMainnet ? "**EURC** ou **cirBTC**" : "**EURC**, **USDT** ou **cirBTC**";
                const tokenOptionsEn = isMainnet ? "**EURC** or **cirBTC**" : "**EURC**, **USDT**, or **cirBTC**";
                const isPt = /troca|quero|muda|dolar|dólar|pra|para|por|ativo|qual/i.test(messages.map(m=>m.content).join(' '));
                return {
                    content: isPt
                        ? `Perfeito! Para qual ativo você gostaria de trocar seus **${amount} USDC**?\n\n• Opções na ${activeNetwork}: ${tokenOptions}`
                        : `Got it! Which token would you like to receive in exchange for your **${amount} USDC**?\n\n• Available options on ${activeNetwork}: ${tokenOptionsEn}`,
                    action: null
                };
            }

            return {
                content: `🔄 **Swap Transaction Prepared:**\n\n• **Swap:** ${amount} ${from}\n• **Receive:** ${to}\n• **Network:** ${activeNetwork}\n\nPlease click below to review quote and execute the swap securely in the Trade terminal.`,
                action: {
                    action: "UI_PREPARE_SWAP",
                    payload: { amount, from, to, network: activeNetwork }
                }
            };
        } else if (fnName === "generate_invoice") {
            const shortId = Math.random().toString(36).substring(2, 6).toUpperCase();
            return {
                content: `✅ **B2B Invoice Successfully Generated!**\n\n• **Amount:** ${args.amount || 100} USDC\n• **Client:** ${args.clientName || 'Web3 Client'}\n• **Invoice ID:** INV-${shortId}\n• **Network:** ${activeNetwork}\n\nThe secure payment link is ready to share below!`,
                action: {
                    action: "UI_GENERATE_INVOICE",
                    payload: {
                        amount: args.amount || 100,
                        clientName: args.clientName || "Web3 Client",
                        description: args.description || "B2B Invoice",
                        invoiceId: `INV-${shortId}`,
                        network: activeNetwork
                    }
                }
            };
        } else if (fnName === "prepare_bridge") {
            const dest = args.destinationNetwork;
            if (!dest) {
                return {
                    content: `Which destination network would you like to bridge the ${args.amount || 15} USDC to? (${destNetworks})`,
                    action: null
                };
            }
            return {
                content: `🌉 **Cross-Chain Bridge (CCTP) Prepared:**\n\n• **Amount:** ${args.amount || 15} USDC\n• **Destination:** ${dest}\n• **Source Network:** ${activeNetwork}\n\nPlease click below to review and initiate the liquidity bridge.`,
                action: {
                    action: "UI_PREPARE_BRIDGE",
                    payload: {
                        amount: args.amount || 15,
                        destination: dest,
                        network: activeNetwork
                    }
                }
            };
        } else if (fnName === "find_yields") {
            const token = (args.token || "USDC").toUpperCase();
            const isPt = /pool|rendimento|ganhar|liquidez|lucro|juros|taxa|quero|onde|qual/i.test(messages.map(m=>m.content).join(' '));
            return {
                content: isPt
                    ? `💧 **Piscinas de Liquidez & Rendimento na Arc Network:**\n\nNo ecossistema da **Arc Network**, o rendimento com **${token}** pode ser obtido ao fornecer liquidez em protocolos descentralizados (DEX/AMM):\n\n• **Pares com liquidez ativa na Arc:** **USDC/EURC** e **USDC/cirBTC**\n• **Como funciona:** Provedores de liquidez depositam pares de tokens e recebem participações nas taxas de transação geradas por cada negociação.\n• **No Aura Payments:** Oferecemos a infraestrutura para você executar **Swaps Instantâneos** com a melhor rota, movimentar fundos via **Ponte CCTP (Circle)** com taxa zero e emitir **Faturas B2B**.\n\nDeseja realizar um swap para **EURC** ou **cirBTC** para compor seus pares de liquidez?`
                    : `💧 **Liquidity Pools & Yield on Arc Network:**\n\nOn the **Arc Network**, yield with **${token}** is generated by providing liquidity to decentralized AMM pools:\n\n• **Active Liquidity Pairs on Arc:** **USDC/EURC** and **USDC/cirBTC**\n• **How it works:** Liquidity providers deposit token pairs to earn proportional trading fees from on-chain swaps.\n• **In Aura Payments:** We provide the execution layer for **Instant Swaps**, **Circle CCTP Cross-Chain Bridge** (1:1 native USDC liquidity across 6 networks), and **B2B Invoices**.\n\nWould you like to swap **USDC** for **EURC** or **cirBTC**, or bridge liquidity to another network?`,
                action: null
            };
        } else if (fnName === "get_portfolio_stats") {
            const isPt = /carteira|saldo|portfolio|estatisticas|rendimento|quanto/i.test(messages.map(m=>m.content).join(' '));
            return {
                content: isPt
                    ? `📊 **Resumo da Carteira & Atividade:**\n\n• **Rede Ativa:** ${activeNetwork} (Chain ID: ${activeChainId})\n• **Endereço Conectado:** ${userAddress || 'Nenhuma carteira conectada'}\n• **Saldo Disponível:** ${formattedBalance} USDC\n\nPosso te ajudar a preparar um **Swap**, transferir via **Ponte CCTP** ou emitir uma **Fatura B2B**!`
                    : `📊 **Wallet & Activity Summary:**\n\n• **Active Network:** ${activeNetwork} (Chain ID: ${activeChainId})\n• **Connected Address:** ${userAddress || 'No wallet connected'}\n• **Available Balance:** ${formattedBalance} USDC\n\nI can help you prepare a **Swap**, bridge via **Circle CCTP**, or generate a **B2B Invoice**!`,
                action: null
            };
        }
    }

    const isPt = /troca|quero|muda|dolar|dólar|pra|para|por|ativo|qual|saldo|rede|enviar|ponte|fatura|pool|rendimento|liquidez|ajuda|olá|ola|bom|boa/i.test(messages.map(m=>m.content).join(' '));
    const defaultFallback = isPt
        ? "Olá! Sou o assistente do Aura Payments. Posso te ajudar a realizar swaps on-chain na Arc, transferir USDC via ponte CCTP para outras redes ou gerar faturas B2B. Como posso te ajudar?"
        : "How can I assist you with Aura Payments today?";

    return {
        content: choice?.content || defaultFallback,
        action: null
    };
}

async function callGeminiEngine(messages, userAddress, activeNetwork, activeChainId, formattedBalance, usdcBalance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY not configured.");

    if (!genAI) {
        genAI = new GoogleGenerativeAI(apiKey);
    }

    const isTestnet = activeNetwork.toLowerCase().includes('testnet');
    const isMainnet = !isTestnet;
    const destNetworks = isTestnet
        ? "Base Sepolia, Arbitrum Sepolia, Optimism Sepolia, Ethereum Sepolia"
        : "Base, Arbitrum One, Optimism, Ethereum, Polygon";
    const supportedTokensList = isMainnet ? "USDC, EURC, cirBTC" : "USDC, EURC, USDT, cirBTC";

    const tools = [
        {
            name: "generate_invoice",
            description: `Generates a decentralized B2B payment invoice link on ${activeNetwork}.`,
            parameters: {
                type: "object",
                properties: {
                    amount: { type: "number", description: "Invoice amount in USDC" },
                    clientName: { type: "string", description: "Client or recipient company name" },
                    description: { type: "string", description: "Service or product description (optional)" }
                },
                required: ["amount", "clientName"]
            }
        },
        {
            name: "prepare_swap",
            description: `Prepares an on-chain token swap transaction on ${activeNetwork}. Supported tokens: ${supportedTokensList}. Trigger ONLY when the user explicitly specified the toToken. DO NOT guess or auto-select toToken. DO NOT trigger if token is not available (e.g. USDT does not exist on Arc Mainnet).`,
            parameters: {
                type: "object",
                properties: {
                    amount: { type: "number", description: "Amount to swap" },
                    fromToken: { type: "string", description: `Source token symbol (${supportedTokensList})` },
                    toToken: { type: "string", description: `Destination token symbol (${supportedTokensList}). User MUST have explicitly requested this token.` }
                },
                required: ["amount", "fromToken", "toToken"]
            }
        },
        {
            name: "prepare_bridge",
            description: `Prepares a Circle CCTP bridge transaction to transfer USDC from ${activeNetwork} to connected networks. Trigger ONLY when BOTH the amount AND the destination network are explicitly chosen by the user. Supported destinations on Mainnet: Base, Arbitrum One, Optimism, Ethereum, Polygon. Supported destinations on Testnet: Base Sepolia, Arbitrum Sepolia, Optimism Sepolia, Ethereum Sepolia.`,
            parameters: {
                type: "object",
                properties: {
                    amount: { type: "number", description: "USDC amount to transfer" },
                    destinationNetwork: { type: "string", description: "Destination network (Base, Arbitrum One, Optimism, Ethereum, Polygon on Mainnet; or Base Sepolia, Arbitrum Sepolia, Optimism Sepolia, Ethereum Sepolia on Testnet). Must NOT be guessed." }
                },
                required: ["amount", "destinationNetwork"]
            }
        }
    ];

    const model = genAI.getGenerativeModel({ 
        model: "gemini-1.5-flash",
        tools: [{ functionDeclarations: tools }],
        systemInstruction: `You are Aura AI, the official financial co-pilot of Aura Payments.
Active Network: ${activeNetwork} (Chain ID: ${activeChainId}).
User connected wallet address: ${userAddress || 'Not connected'}.
User Native USDC Balance: ${formattedBalance} USDC.

CRITICAL RULES:
1. Always be concise, helpful, objective, and professional.
2. LANGUAGE RULE: Respond in the user's language (Portuguese if user writes in Portuguese, English if English).
3. TOKEN AVAILABILITY RULE:
   - On Arc Mainnet: USDT does NOT exist! If user asks for USDT, inform them that USDT is not on Arc Mainnet and only USDC, EURC, and cirBTC are available. Do not call prepare_swap for USDT.
4. SWAP SELECTION RULE:
   - NEVER call prepare_swap if the user did NOT explicitly specify which token they want to receive (toToken)!
   - NEVER guess or auto-fill a destination token (do NOT default to cirBTC, EURC, or USDT).
   - If user provides only an amount or asks to swap without specifying the target token, ask which token they want to receive (${isMainnet ? 'EURC or cirBTC' : 'EURC, USDT, or cirBTC'}).
5. BRIDGE RULE: Destination networks for ${activeNetwork}: ${destNetworks}.
   - NEVER call prepare_bridge if destination network has not been explicitly chosen by the user!
   - NEVER guess or auto-fill a destination network.
   - If user provides only an amount (e.g. "15"), ask which destination network they want (${destNetworks}).
6. BALANCE VERIFICATION: If user wants to swap or bridge more than ${formattedBalance} USDC, explain their balance is insufficient.`
    });

    const formattedHistory = messages.map(msg => ({
        role: msg.role === 'assistant' ? 'model' : msg.role,
        parts: [{ text: msg.content || " " }]
    }));

    const lastMessageIndex = formattedHistory.findLastIndex(m => m.role === 'user');
    let chatHistory = [];
    let promptText = "";

    if (lastMessageIndex >= 0) {
        chatHistory = formattedHistory.slice(0, lastMessageIndex);
        promptText = formattedHistory[lastMessageIndex].parts[0].text;
    } else {
        throw new Error("No user message in history.");
    }

    while (chatHistory.length > 0 && chatHistory[0].role !== 'user') {
        chatHistory.shift();
    }
    while (chatHistory.length > 0 && chatHistory[chatHistory.length - 1].role !== 'model') {
        chatHistory.pop();
    }

    const chat = model.startChat({ history: chatHistory });
    const result = await chat.sendMessage(promptText);
    const response = result.response;
    const functionCalls = response.functionCalls();

    if (functionCalls && functionCalls.length > 0) {
        const call = functionCalls[0];
        const fnName = call.name;
        const args = call.args;

        if (fnName === "prepare_swap") {
            const amount = args.amount || 1;
            const from = (args.fromToken || "USDC").toUpperCase();
            const to = (args.toToken || "").toUpperCase();

            if (isMainnet && (to === 'USDT' || from === 'USDT')) {
                const isPt = /troca|quero|muda|dolar|dólar|pra|para/i.test(messages.map(m=>m.content).join(' '));
                return {
                    content: isPt
                        ? `⚠️ O token **USDT** ainda não existe na rede principal (**Arc Mainnet**). Ele está disponível apenas na Arc Testnet.\n\n• Tokens disponíveis para troca na Arc Mainnet: **USDC**, **EURC** e **cirBTC**.\n\nDeseja realizar a troca para **EURC** ou **cirBTC**?`
                        : `⚠️ The token **USDT** does not exist on **Arc Mainnet** yet (it is only available on Arc Testnet).\n\n• Supported tokens for swap on Arc Mainnet: **USDC**, **EURC**, and **cirBTC**.\n\nWould you like to swap for **EURC** or **cirBTC** instead?`,
                    action: null
                };
            }

            // Verify if user actually specified toToken
            const userSpecifiedToken = hasTargetTokenBeenMentionedByUser(messages);
            if (!to || (!userSpecifiedToken && !extractSwapTargetToken(messages.filter(m=>m.role==='user').pop()?.content))) {
                const tokenOptions = isMainnet ? "**EURC** ou **cirBTC**" : "**EURC**, **USDT** ou **cirBTC**";
                const tokenOptionsEn = isMainnet ? "**EURC** or **cirBTC**" : "**EURC**, **USDT**, or **cirBTC**";
                const isPt = /troca|quero|muda|dolar|dólar|pra|para|por|ativo|qual/i.test(messages.map(m=>m.content).join(' '));
                return {
                    content: isPt
                        ? `Perfeito! Para qual ativo você gostaria de trocar seus **${amount} USDC**?\n\n• Opções na ${activeNetwork}: ${tokenOptions}`
                        : `Got it! Which token would you like to receive in exchange for your **${amount} USDC**?\n\n• Available options on ${activeNetwork}: ${tokenOptionsEn}`,
                    action: null
                };
            }

            return {
                content: `🔄 **Swap Transaction Prepared:**\n\n• **Swap:** ${amount} ${from}\n• **Receive:** ${to}\n• **Network:** ${activeNetwork}\n\nPlease click below to review quote and execute the swap securely in the Trade terminal.`,
                action: {
                    action: "UI_PREPARE_SWAP",
                    payload: { amount, from, to, network: activeNetwork }
                }
            };
        } else if (fnName === "prepare_bridge") {
            const dest = args.destinationNetwork;
            if (!dest) {
                return {
                    content: `Which destination network would you like to bridge the ${args.amount || 15} USDC to? (${destNetworks})`,
                    action: null
                };
            }
            return {
                content: `🌉 **Cross-Chain Bridge (CCTP) Prepared:**\n\n• **Amount:** ${args.amount} USDC\n• **Destination:** ${dest}\n• **Source Network:** ${activeNetwork}\n\nPlease click below to review and initiate the liquidity bridge.`,
                action: {
                    action: "UI_PREPARE_BRIDGE",
                    payload: { amount: args.amount, destination: dest, network: activeNetwork }
                }
            };
        } else if (fnName === "generate_invoice") {
            const shortId = Math.random().toString(36).substring(2, 6).toUpperCase();
            return {
                content: `✅ **B2B Invoice Successfully Generated!**\n\n• **Amount:** ${args.amount} USDC\n• **Client:** ${args.clientName}\n• **Invoice ID:** INV-${shortId}\n\nThe secure payment link is ready to share below!`,
                action: {
                    action: "UI_GENERATE_INVOICE",
                    payload: { amount: args.amount, clientName: args.clientName, description: args.description || "B2B Invoice", invoiceId: `INV-${shortId}` }
                }
            };
        }
    }

    return {
        content: response.text() || "How can I assist you today?",
        action: null
    };
}

function handleDeterministicIntent(messages, userAddress, activeNetwork, activeChainId, formattedBalance, usdcBalance) {
    const lastUserMsg = messages.filter(m => m.role === 'user').pop()?.content || "";
    const prompt = lastUserMsg.trim().toLowerCase();
    const isTestnet = activeNetwork.toLowerCase().includes('testnet');
    const isMainnet = !isTestnet;
    const destNetworks = isTestnet
        ? "Base Sepolia, Arbitrum Sepolia, Optimism Sepolia, Ethereum Sepolia"
        : "Base, Arbitrum One, Optimism, Ethereum, Polygon";

    if (/swap|trade|troca|trocar/i.test(prompt)) {
        if (isMainnet && (prompt.includes('usdt') || prompt.includes('tether'))) {
            const isPt = /troca|quero|muda|dolar|dólar|pra|para/i.test(prompt);
            return {
                content: isPt
                    ? `⚠️ O token **USDT** ainda não existe na rede principal (**Arc Mainnet**). Ele está disponível apenas na Arc Testnet.\n\n• Tokens disponíveis para troca na Arc Mainnet: **USDC**, **EURC** e **cirBTC**.\n\nDeseja realizar a troca para **EURC** ou **cirBTC**?`
                    : `⚠️ The token **USDT** is not yet available on **Arc Mainnet** (it is only deployed on Arc Testnet).\n\n• Available tokens on Arc Mainnet: **USDC**, **EURC**, and **cirBTC**.\n\nWould you like to swap for **EURC** or **cirBTC** instead?`,
                action: null
            };
        }

        const { from, to } = findPreviousSwapTokens(messages, isMainnet);
        const amountMatch = prompt.match(/(\d+(?:\.\d+)?)/);
        const amount = amountMatch ? parseFloat(amountMatch[1]) : findPreviousAmount(messages);

        if (amount && to) {
            return {
                content: `🔄 **Swap Transaction Prepared:**\n\n• **Swap:** ${amount} ${from}\n• **Receive:** ${to}\n• **Network:** ${activeNetwork}\n\nPlease click below to review quote and execute the swap securely in the Trade terminal.`,
                action: {
                    action: "UI_PREPARE_SWAP",
                    payload: { amount, from, to, network: activeNetwork }
                }
            };
        } else if (amount && !to) {
            const tokenOptions = isMainnet ? "**EURC** ou **cirBTC**" : "**EURC**, **USDT** ou **cirBTC**";
            const tokenOptionsEn = isMainnet ? "**EURC** or **cirBTC**" : "**EURC**, **USDT**, or **cirBTC**";
            const isPt = /troca|quero|muda|dolar|dólar|pra|para|por|ativo|qual|saldo/i.test(messages.map(m=>m.content).join(' '));
            return {
                content: isPt
                    ? `Perfeito! Para qual ativo você gostaria de trocar seus **${amount} USDC**?\n\n• Opções na ${activeNetwork}: ${tokenOptions}`
                    : `Got it! Which token would you like to receive in exchange for your **${amount} USDC**?\n\n• Available options on ${activeNetwork}: ${tokenOptionsEn}`,
                action: null
            };
        } else if (!amount && to) {
            const isPt = /troca|quero|muda|dolar|dólar|pra|para|por|ativo|qual/i.test(messages.map(m=>m.content).join(' '));
            return {
                content: isPt
                    ? `Perfeito! Quantos USDC você gostaria de trocar por **${to}**?`
                    : `Great! How many USDC would you like to swap for **${to}**?`,
                action: null
            };
        } else {
            const tokenOptions = isMainnet ? "**EURC** ou **cirBTC**" : "**EURC**, **USDT** ou **cirBTC**";
            const tokenOptionsEn = isMainnet ? "**EURC** or **cirBTC**" : "**EURC**, **USDT**, or **cirBTC**";
            const isPt = /troca|quero|muda|dolar|dólar|pra|para|por|ativo|qual/i.test(messages.map(m=>m.content).join(' '));
            return {
                content: isPt
                    ? `Com o módulo de Trade na ${activeNetwork}, você pode negociar USDC com liquidez direta.\n\n• Tokens disponíveis: ${tokenOptions}\n\nPor favor, informe o valor e o token que deseja receber para prepararmos a troca!`
                    : `With the Trade module on ${activeNetwork}, you can trade USDC with direct liquidity.\n\n• Available tokens: ${tokenOptionsEn}\n\nPlease provide the amount and which token you'd like to receive to prepare your swap!`,
                action: null
            };
        }
    }

    if (/bridge|cctp|ponte|transferir/i.test(prompt)) {
        const dest = extractDestinationFromText(prompt, isTestnet);
        const amountMatch = prompt.match(/(\d+(?:\.\d+)?)\s*(?:usdc|dol|dolar)?/i);
        const amount = amountMatch ? parseFloat(amountMatch[1]) : null;

        if (amount && dest) {
            return {
                content: `🌉 **Cross-Chain Bridge (CCTP) Prepared:**\n\n• **Amount:** ${amount} USDC\n• **Destination:** ${dest}\n• **Source Network:** ${activeNetwork}\n\nPlease click below to review and initiate the liquidity bridge.`,
                action: {
                    action: "UI_PREPARE_BRIDGE",
                    payload: { amount, destination: dest, network: activeNetwork }
                }
            };
        } else if (amount && !dest) {
            return {
                content: `Perfeito! Para qual rede de destino você deseja enviar os **${amount} USDC** via CCTP?\n\n• Escolha entre: **${destNetworks}**`,
                action: null
            };
        } else {
            return {
                content: `Com a ponte CCTP na ${activeNetwork}, você pode transferir USDC com liquidez nativa 1:1.\n\n• **Redes de Destino:** ${destNetworks}\n\nPor favor, informe o valor em USDC e a rede para preparar a transação!`,
                action: null
            };
        }
    }

    const hasPoolContext = messages.some(m => /pool|rendimento|liquidez|yield|ganhar/i.test(m.content || ''));
    if (/pool|liquidez|rendimento|yield|earn|lp\b/i.test(prompt) || (hasPoolContext && /\b(?:usdc|eurc|cirbtc|btc)\b/i.test(prompt))) {
        const tokenMatch = prompt.match(/\b(usdc|eurc|cirbtc|btc)\b/i);
        const token = tokenMatch ? (tokenMatch[1].toUpperCase() === 'BTC' ? 'cirBTC' : tokenMatch[1].toUpperCase()) : "USDC";
        const isPt = /pool|rendimento|ganhar|lucro|juros|taxa|quero|como|onde|qual|ativo/i.test(messages.map(m=>m.content).join(' '));
        return {
            content: isPt
                ? `💧 **Piscinas de Liquidez & Rendimento na Arc Network:**\n\nNo ecossistema da **Arc Network**, o rendimento com **${token}** pode ser obtido ao fornecer liquidez em protocolos descentralizados (DEX/AMM):\n\n• **Pares com liquidez ativa na Arc:** **USDC/EURC** e **USDC/cirBTC**\n• **Como funciona:** Provedores de liquidez depositam pares de tokens e recebem participações nas taxas de transação geradas por cada negociação.\n• **No Aura Payments:** Oferecemos a infraestrutura para você executar **Swaps Instantâneos** com a melhor rota, movimentar fundos via **Ponte CCTP (Circle)** com taxa zero e emitir **Faturas B2B**.\n\nDeseja realizar um swap para **EURC** ou **cirBTC** para compor seus pares de liquidez?`
                : `💧 **Liquidity Pools & Yield on Arc Network:**\n\nOn the **Arc Network**, yield with **${token}** is generated by providing liquidity to decentralized AMM pools:\n\n• **Active Liquidity Pairs on Arc:** **USDC/EURC** and **USDC/cirBTC**\n• **How it works:** Liquidity providers deposit token pairs to earn proportional trading fees from on-chain swaps.\n• **In Aura Payments:** We provide the execution layer for **Instant Swaps**, **Circle CCTP Cross-Chain Bridge** (1:1 native USDC liquidity across 6 networks), and **B2B Invoices**.\n\nWould you like to swap **USDC** for **EURC** or **cirBTC**, or bridge liquidity to another network?`,
            action: null
        };
    }

    return {
        content: `Olá! Sou o assistente financeiro do Aura Payments. Posso te ajudar a realizar swaps, transferências cross-chain via bridge CCTP ou emitir faturas B2B. Como posso te ajudar?`,
        action: null
    };
}

function extractDestinationFromText(text, isTestnet = false) {
    if (!text || typeof text !== 'string') return null;
    const lower = text.toLowerCase().trim();
    if (/\b(?:polygon|matic|poly|pol)\b/i.test(lower)) return isTestnet ? 'Base Sepolia' : 'Polygon';
    if (/\b(?:optimism|optimistic|opt|op|op\s*mainnet)\b/i.test(lower)) return isTestnet ? 'Optimism Sepolia' : 'Optimism';
    if (/\b(?:arbitrum|arb|arbitrum\s*one|arb1)\b/i.test(lower)) return isTestnet ? 'Arbitrum Sepolia' : 'Arbitrum One';
    if (/\b(?:ethereum|ether|eth|sepolia)\b/i.test(lower)) return isTestnet ? 'Ethereum Sepolia' : 'Ethereum';
    if (/\b(?:base)\b/i.test(lower)) return isTestnet ? 'Base Sepolia' : 'Base';
    return null;
}

function extractSwapTargetToken(text, isMainnet = true) {
    if (!text || typeof text !== 'string') return null;
    const lower = text.toLowerCase().trim();
    if (/\b(?:cirbtc|circle\s*btc|circle\s*bitcoin|btc|bitcoin)\b/i.test(lower)) return "CIRBTC";
    if (/\b(?:eurc|euro|euros|eur)\b/i.test(lower)) return "EURC";
    if (/\b(?:usdt|tether)\b/i.test(lower)) return "USDT";
    if (/\b(?:para|pra|por|to|for|into)\s*usdc\b/i.test(lower)) return "USDC";
    return null;
}

function hasTargetTokenBeenMentionedByUser(messages) {
    if (!messages || !Array.isArray(messages)) return null;
    for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];
        if (msg.role === 'user') {
            const token = extractSwapTargetToken(msg.content);
            if (token) return token;
        }
    }
    return null;
}

function findPreviousBridgeDestination(messages, isTestnet = false) {
    if (!messages || !Array.isArray(messages)) return null;
    for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];
        if (msg.role === 'user') {
            const extracted = extractDestinationFromText(msg.content, isTestnet);
            if (extracted) return extracted;
        } else if (msg.action?.payload?.destination) {
            const clean = extractDestinationFromText(msg.action.payload.destination, isTestnet);
            if (clean) return clean;
        } else if (msg.role === 'assistant') {
            const txt = msg.content || '';
            const isOptionsList = txt.includes('•') || txt.includes('Escolha entre') || txt.includes('Choose from');
            if (!isOptionsList) {
                const singleTarget = extractDestinationFromText(txt, isTestnet);
                if (singleTarget) return singleTarget;
            }
        }
    }
    return null;
}

function findPreviousBridgeAmount(messages) {
    for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];
        if (msg.role === 'user') {
            const m = msg.content.match(/\b(\d+(?:\.\d+)?)\s*(?:usdc|dol|dolar|dolares|dollars)?\b/i);
            if (m) return parseFloat(m[1]);
        } else if (msg.action?.payload?.amount) {
            return Number(msg.action.payload.amount);
        }
    }
    return null;
}

function findPreviousAmount(messages) {
    if (!messages || !Array.isArray(messages)) return null;
    for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];
        if (msg.role === 'user') {
            const m = msg.content.match(/\b(\d+(?:\.\d+)?)\s*(?:usdc|dol|dolar|dolares|dollars)?\b/i);
            if (m) {
                const val = parseFloat(m[1]);
                if (val !== 5042 && val !== 5042002) return val;
            }
        } else if (msg.action?.payload?.amount) {
            return Number(msg.action.payload.amount);
        }
    }
    return null;
}

function findPreviousSwapTokens(messages, isMainnet = true) {
    let from = "USDC";
    let to = null;
    for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];
        if (msg.action?.payload) {
            const p = msg.action.payload;
            if (p.from && p.to) {
                const targetTo = (isMainnet && p.to.toUpperCase() === 'USDT') ? null : p.to.toUpperCase();
                if (targetTo) {
                    return { from: p.from.toUpperCase(), to: targetTo };
                }
            }
        }
        if (msg.role === 'user') {
            const txt = msg.content || "";
            const pairMatch = txt.match(/\b(usdc|eurc|usdt|cirbtc)\s*(?:para|por|to|for|in|swap to|->)\s*(usdc|eurc|usdt|cirbtc)\b/i);
            if (pairMatch) {
                const targetTo = (isMainnet && pairMatch[2].toUpperCase() === 'USDT') ? null : pairMatch[2].toUpperCase();
                return { from: pairMatch[1].toUpperCase(), to: targetTo };
            }
            const singleTarget = extractSwapTargetToken(txt, isMainnet);
            if (singleTarget) {
                const targetTo = (isMainnet && singleTarget === 'USDT') ? null : singleTarget;
                return { from: "USDC", to: targetTo };
            }
        }
    }
    return { from, to };
}

function findPreviousContext(messages, isTestnet = false) {
    if (!messages || !Array.isArray(messages)) return { type: 'swap' };
    const prevBridgeDest = findPreviousBridgeDestination(messages, isTestnet);
    if (prevBridgeDest) {
        return { 
            type: 'bridge', 
            destination: prevBridgeDest 
        };
    }
    for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];
        const txt = msg.content || "";
        const isBridge = msg.action?.action === 'UI_PREPARE_BRIDGE' || 
            /bridge|cctp|ponte|transferir|enviar/i.test(txt);
        if (isBridge) {
            return { 
                type: 'bridge', 
                destination: prevBridgeDest 
            };
        }
        if (msg.action?.action === 'UI_PREPARE_SWAP' || /swap|trade|troca|cirbtc|eurc/i.test(txt)) {
            return { type: 'swap' };
        }
    }
    return { type: 'swap' };
}
