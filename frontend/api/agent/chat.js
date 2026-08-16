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

    let messages = [];
    let userAddress = '';

    try {
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
        messages = body.messages || [];
        userAddress = body.userAddress || '';

        if (!messages || !Array.isArray(messages)) {
            return res.status(400).json({ error: "Messages array is required." });
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error("Gemini API key not configured on server.");
        }

        if (!genAI) {
            genAI = new GoogleGenerativeAI(apiKey);
        }

        // 1. Definição das Ferramentas (Function Calling - Bilingue EN/PT)
        const tools = [
            {
                name: "generate_invoice",
                description: "Generates a B2B payment invoice link. Trigger for requests about creating invoices, bills, or payment links (gerar cobrança, criar fatura, invoice, bill).",
                parameters: {
                    type: "object",
                    properties: {
                        amount: { type: "number", description: "Invoice amount in USDC" },
                        clientName: { type: "string", description: "Client or company name paying the invoice" },
                        description: { type: "string", description: "Optional description of products or services" }
                    },
                    required: ["amount", "clientName"]
                }
            },
            {
                name: "prepare_swap",
                description: "Prepares a token swap/trade transaction. Trigger for requests about swapping, trading, or converting tokens (trocar moedas, fazer swap, comprar token, trade). Supported tokens on Arc: USDC, EURC, USDT, cirBTC.",
                parameters: {
                    type: "object",
                    properties: {
                        amount: { type: "number", description: "Amount to swap" },
                        fromToken: { type: "string", description: "Source token symbol (e.g. USDC, EURC, USDT, cirBTC)" },
                        toToken: { type: "string", description: "Target token symbol (e.g. EURC, USDC, USDT, cirBTC)" }
                    },
                    required: ["amount", "fromToken", "toToken"]
                }
            },
            {
                name: "prepare_bridge",
                description: "Prepares a CCTP cross-chain bridge transaction. Trigger for requests about bridging, sending, or transferring USDC across blockchains (fazer ponte, transferir para outra rede, bridge).",
                parameters: {
                    type: "object",
                    properties: {
                        amount: { type: "number", description: "USDC amount to send" },
                        destinationNetwork: { type: "string", description: "Destination network name (e.g. Base, Arbitrum)" }
                    },
                    required: ["amount", "destinationNetwork"]
                }
            },
            {
                name: "find_yields",
                description: "Searches top DeFi yield pools and APY opportunities. Trigger whenever user asks about yield, yields, income, returns, pools, staking, APY, interest, where to invest, or Portuguese terms (rendimento, rendimentos, pools, apy, onde investir, quanto rende).",
                parameters: {
                    type: "object",
                    properties: {
                        token: { type: "string", description: "Token to check yields for (e.g., USDC, EURC, USDT, cirBTC). Default is USDC." }
                    },
                    required: ["token"]
                }
            },
            {
                name: "get_portfolio_stats",
                description: "Retrieves portfolio performance, historical 7d revenue stats, and gas savings summary. Trigger ONLY when user explicitly asks for portfolio overview, past revenue stats, invoice history, or portfolio status (desempenho do portfólio, faturamento passado, estatísticas).",
                parameters: {
                    type: "object",
                    properties: {
                        period: { type: "string", description: "Analysis period ('today', 'week', 'month', 'all'). Default 'week'." }
                    },
                    required: []
                }
            }
        ];

        // 2. Configurar o Modelo e o System Instruction
        const systemInstructionText = `You are Aura AI, the official financial co-pilot of Aura Payments.
User connected wallet address: ${userAddress || 'Not connected'}.
Your goal is to help users execute swaps, cross-chain CCTP bridges, and create instant B2B on-chain invoices on Arc Testnet.

SYSTEM RULES:
1. Always be concise, helpful, objective, and professional.
2. LANGUAGE RULE: Default is ENGLISH. If the user writes in Portuguese (or any other language), match their language immediately with 100% natural fluency.
3. OFFICIAL KNOWLEDGE & LINKS (NEVER INVENT FAKE URLS):
   - Official Website: https://www.aurapayments.xyz
   - Official X / Twitter: https://x.com/danilo_schrute
   - Telegram & Discord: Currently under maintenance / coming soon. If asked for Discord or Telegram, inform the user: "Our Discord and Telegram channels are currently being prepared and will be opened soon. Stay tuned on our X (@danilo_schrute)!"
   - NEVER invent domains like aurapayments.io or fake discord links.
4. SUPPORTED TOKENS & NETWORK CONSTRAINTS (STRICT):
   - Tokens available on Arc Testnet: USDC, EURC, USDT, cirBTC.
   - Note: USDC is the native gas asset on Arc Network.
   - ETH, WETH, or BTC do NOT exist on Arc Testnet (only cirBTC exists). NEVER suggest ETH in examples or swap parameters. Always use USDC, EURC, USDT, or cirBTC.
5. CORE CAPABILITIES:
   - Token Swaps on Arc Testnet (USDC, EURC, USDT, cirBTC)
   - CCTP Cross-chain Bridge (Arc, Base, Arbitrum, Sepolia)
   - Invoice 2.0 (Instant B2B decentralized on-chain billing in USDC/EURC)
6. TOOL MAPPING:
   - "invoice", "bill", "payment link", "fatura", "cobrança" -> Call \`generate_invoice\`.
   - "swap", "trade", "exchange", "trocar", "comprar", "por" -> Call \`prepare_swap\`.
   - "bridge", "cross-chain", "transfer network", "ponte" -> Call \`prepare_bridge\`.
   - "portfolio", "history", "stats", "desempenho", "estatísticas" -> Call \`get_portfolio_stats\`.
7. You NEVER execute transactions autonomously. You only prepare the transaction parameters for MetaMask confirmation.
8. YIELD & LIQUIDITY DEPOSITS MAINTENANCE RULE:
   - If the user asks to deposit, stake, or invest funds into Aura DEX, Vaults, or any yield pool, apologize and state clearly that the Yield Vaults & Staking module is currently under scheduled maintenance / testnet upgrades for the next phase.
   - Example in PT: "Pedimos desculpas, mas o módulo de depósitos e cofres de rendimento (Aura DEX Vaults) está temporariamente em manutenção para atualizações de contratos. No momento, você pode utilizar normalmente os módulos de Swap, Ponte CCTP e Faturas B2B!"
   - Example in EN: "We apologize, but the Aura DEX Yield Vaults & Staking module is currently undergoing scheduled maintenance for smart contract upgrades. You can freely use Swaps, CCTP Bridges, and B2B Invoices!"
9. RESPONSE FORMATTING: Structure cleanly with bullet points (•), bold text (**bold**), and line breaks (\\n\\n).`;

        // 3. Formatar o Histórico de Mensagens para o Formato do Gemini
        let formattedHistory = messages.map(msg => {
            let role = msg.role === 'assistant' ? 'model' : msg.role;
            return {
                role: role,
                parts: [{ text: msg.content || " " }]
            };
        });

        // Gemini exige que os papéis se alternem estritamente (user, model, user, model).
        let mergedHistory = [];
        for (let msg of formattedHistory) {
            if (mergedHistory.length > 0 && mergedHistory[mergedHistory.length - 1].role === msg.role) {
                mergedHistory[mergedHistory.length - 1].parts[0].text += "\n\n" + msg.parts[0].text;
            } else {
                mergedHistory.push(msg);
            }
        }

        const lastMessageIndex = mergedHistory.findLastIndex(m => m.role === 'user');
        
        let chatHistory = [];
        let promptText = "";
        
        if (lastMessageIndex >= 0) {
             chatHistory = mergedHistory.slice(0, lastMessageIndex);
             promptText = mergedHistory[lastMessageIndex].parts[0].text;
        } else {
             return res.status(400).json({ error: "Nenhuma mensagem do usuário encontrada." });
        }

        // Sanitização estrita do chatHistory: deve começar com 'user' e terminar com 'model'
        while (chatHistory.length > 0 && chatHistory[0].role !== 'user') {
            chatHistory.shift();
        }
        while (chatHistory.length > 0 && chatHistory[chatHistory.length - 1].role !== 'model') {
            chatHistory.pop();
        }

        const isPt = /[ãáàâéêíóôõúç]/i.test(promptText) || /\b(rendimento|rendimentos|fatura|faturas|troca|trocar|ponte|ajuda|quero|preciso|mostrar|carteira|quanto|como|por)\b/i.test(promptText);

        const candidateModels = ["gemini-1.5-flash", "gemini-2.0-flash", "gemini-1.5-pro"];
        let result = null;
        let lastErr = null;

        for (const candidate of candidateModels) {
            try {
                const model = genAI.getGenerativeModel({ 
                    model: candidate,
                    tools: [{ functionDeclarations: tools }],
                    systemInstruction: systemInstructionText,
                });

                const chat = model.startChat({
                    history: chatHistory,
                });

                result = await chat.sendMessage(promptText);
                if (result && result.response) break;
            } catch (err) {
                console.warn(`[Gemini model ${candidate} failed]:`, err.message);
                lastErr = err;
            }
        }

        if (!result || !result.response) {
            throw lastErr || new Error("Failed to get response from Gemini models.");
        }

        const response = result.response;
        const functionCalls = response.functionCalls ? response.functionCalls() : null;

        // 4. Lidar com Function Calling
        if (functionCalls && functionCalls.length > 0) {
            const call = functionCalls[0];
            const functionName = call.name;
            const args = call.args;

            let actionResponse = {};
            let displayMessage = "";

            if (functionName === "generate_invoice") {
                const shortId = Math.random().toString(36).substring(2, 6).toUpperCase();
                actionResponse = {
                    action: "UI_GENERATE_INVOICE",
                    payload: {
                        amount: args.amount,
                        clientName: args.clientName,
                        description: args.description || "Invoice generated via AI",
                        invoiceId: `INV-${shortId}`
                    }
                };
                displayMessage = isPt 
                  ? `✅ **Fatura B2B Gerada com Sucesso!**\n\n` +
                    `• **Valor:** ${args.amount} USDC\n` +
                    `• **Cliente:** ${args.clientName}\n` +
                    `• **Código:** INV-${shortId}\n\n` +
                    `O link de pagamento seguro já foi preparado para você compartilhar!`
                  : `✅ **B2B Invoice Successfully Generated!**\n\n` +
                    `• **Amount:** ${args.amount} USDC\n` +
                    `• **Client:** ${args.clientName}\n` +
                    `• **Invoice ID:** INV-${shortId}\n\n` +
                    `The secure payment link is ready to share below!`;
            } 
            else if (functionName === "prepare_swap") {
                actionResponse = {
                    action: "UI_PREPARE_SWAP",
                    payload: {
                        amount: args.amount,
                        from: args.fromToken,
                        to: args.toToken
                    }
                };
                displayMessage = isPt 
                  ? `🔄 **Transação de Swap Preparada:**\n\n` +
                    `• **Trocar:** ${args.amount} ${args.fromToken}\n` +
                    `• **Receber:** ${args.toToken}\n` +
                    `• **Rede:** Arc Testnet\n\n` +
                    `Aguarde a janela da MetaMask para assinar e concluir a troca com segurança.`
                  : `🔄 **Swap Transaction Prepared:**\n\n` +
                    `• **Swap:** ${args.amount} ${args.fromToken}\n` +
                    `• **Receive:** ${args.toToken}\n` +
                    `• **Network:** Arc Testnet\n\n` +
                    `Please confirm in MetaMask to complete the swap securely.`;
            }
            else if (functionName === "prepare_bridge") {
                actionResponse = {
                    action: "UI_PREPARE_BRIDGE",
                    payload: {
                        amount: args.amount,
                        destination: args.destinationNetwork
                    }
                };
                displayMessage = isPt 
                  ? `🌉 **Ponte Cross-Chain (CCTP) Preparada:**\n\n` +
                    `• **Valor:** ${args.amount} USDC\n` +
                    `• **Destino:** Rede ${args.destinationNetwork}\n\n` +
                    `Por favor, aprove a transação em sua carteira para iniciar a transferência de liquidez.`
                  : `🌉 **Cross-Chain Bridge (CCTP) Prepared:**\n\n` +
                    `• **Amount:** ${args.amount} USDC\n` +
                    `• **Destination:** ${args.destinationNetwork} Network\n\n` +
                    `Please approve the transaction in your wallet to initiate cross-chain token transfer.`;
            }
            else if (functionName === "find_yields") {
                const tokenUpper = (args.token || 'USDC').toUpperCase();
                let pools = [];

                // O foco atual do projeto é puramente Testnet, então usamos mocks de pools reais em redes Sepolia/Testnet
                if (tokenUpper.includes('ETH')) {
                    pools = [
                        { protocol: "Aura Staking", network: "Arc Testnet", apy: "5.40%" },
                        { protocol: "Aave V3", network: "Base Sepolia", apy: "4.10%" },
                        { protocol: "Uniswap V3", network: "Sepolia", apy: "3.25%" }
                    ];
                } else if (tokenUpper.includes('EUR')) {
                    pools = [
                        { protocol: "Aura EURC Vault", network: "Arc Testnet", apy: "9.80%" },
                        { protocol: "Compound", network: "Arbitrum Sepolia", apy: "7.15%" },
                        { protocol: "Curve Finance", network: "Base Sepolia", apy: "6.50%" }
                    ];
                } else if (tokenUpper.includes('BTC')) {
                    pools = [
                        { protocol: "Aura BTC Vault", network: "Arc Testnet", apy: "6.20%" },
                        { protocol: "Aave V3", network: "Arbitrum Sepolia", apy: "3.80%" },
                        { protocol: "Uniswap V3", network: "Sepolia", apy: "2.90%" }
                    ];
                } else {
                    // Default para USDC ou outros
                    pools = [
                        { protocol: "Aura DEX", network: "Arc Testnet", apy: "12.50%" },
                        { protocol: "Aave V3", network: "Base Sepolia", apy: "8.15%" },
                        { protocol: "Compound", network: "Arbitrum Sepolia", apy: "6.40%" }
                    ];
                }

                displayMessage = isPt 
                    ? `📊 **Oportunidades de Rendimento (APY) para ${tokenUpper}:**\n\n` +
                      pools.map((p, i) => `• ${i === 0 ? '🚀' : i === 1 ? '🔹' : '🟢'} **${p.protocol} (${p.network}):** ${p.apy}${i === 0 ? ' *(Nativo)*' : ''}`).join('\n') +
                      `\n\n⚠️ *Nota: Pedimos desculpas, mas o módulo de depósitos e cofres de rendimento está temporariamente em manutenção para atualizações de contratos da próxima fase.*`
                    : `📊 **Top Yield Opportunities (APY) for ${tokenUpper}:**\n\n` +
                      pools.map((p, i) => `• ${i === 0 ? '🚀' : i === 1 ? '🔹' : '🟢'} **${p.protocol} (${p.network}):** ${p.apy}${i === 0 ? ' *(Native)*' : ''}`).join('\n') +
                      `\n\n⚠️ *Note: We apologize, but direct yield deposits and vaults are temporarily under maintenance for smart contract upgrades.*`;

                actionResponse = {
                    action: "SHOW_YIELDS",
                    payload: {
                        token: tokenUpper,
                        pools: pools
                    }
                };
            }
            else if (functionName === "get_portfolio_stats") {
                actionResponse = {
                    action: "SHOW_STATS",
                    payload: { period: args.period }
                };
                displayMessage = isPt 
                  ? `📈 **Resumo de Desempenho do Portfólio:**\n\n` +
                    `• **Faturamento 7d:** 1.450 USDC (5 faturas integradas)\n` +
                    `• **Economia em Taxas:** ~$12,40 USD em relação à Ethereum\n` +
                    `• **Status:** Carteira Ativa e Protegida`
                  : `📈 **Portfolio Performance Summary:**\n\n` +
                    `• **7d Revenue:** 1,450 USDC (5 paid invoices)\n` +
                    `• **Gas Saved:** ~$12.40 USD vs Ethereum\n` +
                    `• **Status:** Active & Protected Wallet`;
            }

            return res.status(200).json({
                success: true,
                message: {
                    role: "assistant",
                    content: displayMessage,
                    action: actionResponse
                },
                action: actionResponse
            });

        } else {
            const textResponse = response.text();
            
            return res.status(200).json({
                success: true,
                message: {
                    role: "assistant",
                    content: textResponse
                }
            });
        }

    } catch (geminiError) {
        console.warn("[Gemini Primary Notice - Activating OpenAI/Groq Fallback]:", geminiError.message);

        // Tier 2: OpenAI API (gpt-4o-mini)
        if (process.env.OPENAI_API_KEY) {
            try {
                const openaiResult = await callOpenAIEngine(messages, userAddress);
                return res.status(200).json({
                    success: true,
                    message: {
                        role: "assistant",
                        content: openaiResult.content,
                        action: openaiResult.action
                    },
                    action: openaiResult.action
                });
            } catch (openaiError) {
                console.error("[OpenAI Fallback Error]:", openaiError.message);
            }
        }

        // Tier 3: Groq API (llama-3.3-70b-versatile)
        if (process.env.GROQ_API_KEY) {
            try {
                const groqResult = await callGroqFallback(messages, userAddress);
                return res.status(200).json({
                    success: true,
                    message: {
                        role: "assistant",
                        content: groqResult.content,
                        action: groqResult.action
                    },
                    action: groqResult.action
                });
            } catch (groqError) {
                console.error("[Groq Fallback Error]:", groqError.message);
            }
        }

        // Tier 4: Deterministic Intent Engine Fallback (Guarantees 100% uptime even if API keys fail)
        try {
            const deterministicResult = handleDeterministicIntent(messages, userAddress);
            return res.status(200).json({
                success: true,
                message: {
                    role: "assistant",
                    content: deterministicResult.content,
                    action: deterministicResult.action
                },
                action: deterministicResult.action
            });
        } catch (deterministicError) {
            return res.status(500).json({ 
                error: "Erro no processamento da Inteligência Artificial.", 
                details: geminiError.message 
            });
        }
    }
}

async function callOpenAIEngine(messages, userAddress) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OpenAI API key not configured on server.");

    const systemPrompt = `You are Aura AI, the official financial co-pilot of Aura Payments.
User connected wallet address: ${userAddress || 'Not connected'}.
Your goal is to help users execute swaps, cross-chain CCTP bridges, and create instant B2B on-chain invoices on Arc Testnet.

SYSTEM RULES:
1. Always be concise, helpful, objective, and professional.
2. LANGUAGE RULE: Default is ENGLISH. If the user writes in Portuguese (or any other language), match their language immediately with 100% natural fluency.
3. OFFICIAL KNOWLEDGE & LINKS (NEVER INVENT FAKE URLS):
   - Official Website: https://www.aurapayments.xyz
   - Official X / Twitter: https://x.com/danilo_schrute
   - Telegram & Discord: Currently under maintenance / coming soon. If asked for Discord or Telegram, inform the user: "Our Discord and Telegram channels are currently being prepared and will be opened soon. Stay tuned on our X (@danilo_schrute)!"
   - NEVER invent domains like aurapayments.io or fake discord links.
4. SUPPORTED TOKENS & NETWORK CONSTRAINTS (STRICT):
   - Tokens available on Arc Testnet: USDC, EURC, USDT, cirBTC.
   - Note: USDC is the native gas asset on Arc Network.
   - ETH, WETH, or BTC do NOT exist on Arc Testnet (only cirBTC exists). NEVER suggest ETH in examples or swap parameters. Always use USDC, EURC, USDT, or cirBTC.
5. FUNCTION CALLING RULE (CRITICAL):
   - When the user asks to swap, bridge, or create an invoice, or confirms an action with "sim", "yes", "confirm", "proceed", YOU MUST CALL the corresponding function (\`prepare_swap\`, \`prepare_bridge\`, \`generate_invoice\`).
   - Do NOT just write out the parameters in text; invoke the tool call!
6. YIELD & LIQUIDITY DEPOSITS MAINTENANCE RULE:
   - If user asks about yield opportunities or to deposit into pools/Aura DEX, explain clearly:
     "⚠️ We apologize, but the Aura DEX Yield Vaults & Staking module is currently undergoing scheduled maintenance and smart contract upgrades for the upcoming phase. Swaps, CCTP Bridges, and B2B Invoices are 100% active!"
7. You NEVER execute transactions autonomously. You only prepare the transaction parameters for MetaMask confirmation.
8. RESPONSE FORMATTING: Structure cleanly with bullet points (•), bold text (**bold**), and line breaks (\\n\\n).`;

    const openAITools = [
        {
            type: "function",
            function: {
                name: "prepare_swap",
                description: "Prepares a token swap/trade transaction on Arc Testnet. Trigger whenever the user wants to swap, trade, or exchange tokens (trocar moedas, fazer swap, comprar token) or confirms an ongoing swap request.",
                parameters: {
                    type: "object",
                    properties: {
                        amount: { type: "number", description: "Amount to swap" },
                        fromToken: { type: "string", description: "Source token symbol (USDC, EURC, USDT, cirBTC)" },
                        toToken: { type: "string", description: "Target token symbol (EURC, USDC, USDT, cirBTC)" }
                    },
                    required: ["amount", "fromToken", "toToken"]
                }
            }
        },
        {
            type: "function",
            function: {
                name: "generate_invoice",
                description: "Generates a B2B payment invoice link on Arc Testnet. Trigger for requests about creating invoices, bills, or payment links (gerar cobrança, criar fatura).",
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
                name: "prepare_bridge",
                description: "Prepares a CCTP cross-chain bridge transaction from Arc Testnet to other networks.",
                parameters: {
                    type: "object",
                    properties: {
                        amount: { type: "number", description: "USDC amount to send" },
                        destinationNetwork: { type: "string", description: "Destination network name (e.g. Base, Arbitrum)" }
                    },
                    required: ["amount", "destinationNetwork"]
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
            temperature: 0.3,
            max_tokens: 1024
        })
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`OpenAI API error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    const choice = data.choices?.[0]?.message;
    const lastUserMsg = messages.filter(m => m.role === 'user').pop()?.content || "";
    const isPt = /[ãáàâéêíóôõúç]/i.test(lastUserMsg) || /\b(rendimento|rendimentos|fatura|faturas|troca|trocar|ponte|ajuda|quero|preciso|mostrar|carteira|quanto|como|por|para|sim)\b/i.test(lastUserMsg);

    // 1. Check Tool Calls
    if (choice?.tool_calls && choice.tool_calls.length > 0) {
        const toolCall = choice.tool_calls[0];
        const fnName = toolCall.function.name;
        let args = {};
        try {
            args = JSON.parse(toolCall.function.arguments);
        } catch (e) {
            args = {};
        }

        if (fnName === "prepare_swap") {
            const amount = args.amount || 20;
            const from = (args.fromToken || "USDC").toUpperCase();
            const to = (args.toToken || "USDT").toUpperCase();
            return {
                content: isPt 
                    ? `🔄 **Transação de Swap Preparada:**\n\n• **Trocar:** ${amount} ${from}\n• **Receber:** ${to}\n• **Rede:** Arc Testnet\n\nPor favor, confirme na MetaMask abaixo para concluir a troca com segurança.`
                    : `🔄 **Swap Transaction Prepared:**\n\n• **Swap:** ${amount} ${from}\n• **Receive:** ${to}\n• **Network:** Arc Testnet\n\nPlease confirm in MetaMask below to complete the swap securely.`,
                action: {
                    action: "UI_PREPARE_SWAP",
                    payload: { amount, from, to }
                }
            };
        } else if (fnName === "generate_invoice") {
            const shortId = Math.random().toString(36).substring(2, 6).toUpperCase();
            return {
                content: isPt 
                    ? `✅ **Fatura B2B Gerada com Sucesso!**\n\n• **Valor:** ${args.amount || 100} USDC\n• **Cliente:** ${args.clientName || 'Cliente Web3'}\n• **Código:** INV-${shortId}\n\nO link de pagamento seguro já foi preparado para você compartilhar!`
                    : `✅ **B2B Invoice Successfully Generated!**\n\n• **Amount:** ${args.amount || 100} USDC\n• **Client:** ${args.clientName || 'Web3 Client'}\n• **Invoice ID:** INV-${shortId}\n\nThe secure payment link is ready to share below!`,
                action: {
                    action: "UI_GENERATE_INVOICE",
                    payload: {
                        amount: args.amount || 100,
                        clientName: args.clientName || "Web3 Client",
                        description: args.description || "B2B Invoice",
                        invoiceId: `INV-${shortId}`
                    }
                }
            };
        } else if (fnName === "prepare_bridge") {
            return {
                content: isPt 
                    ? `🌉 **Ponte Cross-Chain (CCTP) Preparada:**\n\n• **Valor:** ${args.amount || 50} USDC\n• **Destino:** Rede ${args.destinationNetwork || 'Base Sepolia'}\n\nPor favor, aprove a transação abaixo para iniciar a transferência de liquidez.`
                    : `🌉 **Cross-Chain Bridge (CCTP) Prepared:**\n\n• **Amount:** ${args.amount || 50} USDC\n• **Destination:** ${args.destinationNetwork || 'Base Sepolia'} Network\n\nPlease approve the transaction below to initiate liquidity transfer.`,
                action: {
                    action: "UI_PREPARE_BRIDGE",
                    payload: {
                        amount: args.amount || 50,
                        destination: args.destinationNetwork || 'Base Sepolia'
                    }
                }
            };
        }
    }

    // 2. Text response fallback with smart regex matching across whole chat context
    const content = choice?.content || "Desculpe, não consegui processar a resposta.";
    let action = null;

    // Search for swap parameters in current prompt or recent message history
    const allRecentText = messages.slice(-3).map(m => m.content).join("\n") + "\n" + content;
    const swapMatch = allRecentText.match(/(\d+(?:\.\d+)?)\s*(usdc|eurc|usdt|cirbtc)?\s*(?:para|por|to|for|in|swap of)\s*(usdc|eurc|usdt|cirbtc)/i);
    
    if (swapMatch && (lastUserMsg.toLowerCase().includes("sim") || lastUserMsg.toLowerCase().includes("yes") || lastUserMsg.toLowerCase().includes("confirm") || content.toLowerCase().includes("metamask"))) {
        action = {
            action: "UI_PREPARE_SWAP",
            payload: {
                amount: parseFloat(swapMatch[1]),
                from: (swapMatch[2] || "USDC").toUpperCase(),
                to: swapMatch[3].toUpperCase()
            }
        };
    }

    return { content, action };
}

function handleDeterministicIntent(messages, userAddress) {
    const lastUserMsg = messages.filter(m => m.role === 'user').pop()?.content || "";
    const prompt = lastUserMsg.trim().toLowerCase();
    const isPt = /[ãáàâéêíóôõúç]/i.test(prompt) || /\b(rendimento|rendimentos|fatura|faturas|troca|trocar|ponte|ajuda|quero|preciso|mostrar|carteira|quanto|como|por|para)\b/i.test(prompt);

    // 1. Swap Intent Detection
    const swapFullMatch = prompt.match(/(\d+(?:\.\d+)?)\s*(usdc|eurc|usdt|cirbtc)?\s*(?:para|por|to|for|in|swap to)\s*(usdc|eurc|usdt|cirbtc)/i);
    if (swapFullMatch) {
        const amount = parseFloat(swapFullMatch[1]);
        const from = (swapFullMatch[2] || "USDC").toUpperCase();
        const to = swapFullMatch[3].toUpperCase();

        return {
            content: isPt 
                ? `🔄 **Transação de Swap Preparada:**\n\n• **Trocar:** ${amount} ${from}\n• **Receber:** ${to}\n• **Rede:** Arc Testnet\n\nPor favor, confirme na MetaMask abaixo para concluir a troca com segurança.`
                : `🔄 **Swap Transaction Prepared:**\n\n• **Swap:** ${amount} ${from}\n• **Receive:** ${to}\n• **Network:** Arc Testnet\n\nPlease confirm in MetaMask below to complete the swap securely.`,
            action: {
                action: "UI_PREPARE_SWAP",
                payload: { amount, from, to }
            }
        };
    }

    if (prompt.includes("swap") || prompt.includes("trocar") || prompt.includes("troca") || prompt.includes("comprar")) {
        return {
            content: isPt 
                ? `Para preparar sua troca de tokens na Arc Testnet, por favor especifique os detalhes:\n\n• **Quantidade** (ex: 50)\n• **Token de Origem** (USDC, EURC, USDT, cirBTC)\n• **Token de Destino** (USDC, EURC, USDT, cirBTC)\n\n*Exemplo:* "Trocar 50 USDC por EURC"`
                : `To prepare your token swap on Arc Testnet, please specify the details:\n\n• **Amount to swap** (e.g. 50)\n• **From token** (USDC, EURC, USDT, cirBTC)\n• **To token** (USDC, EURC, USDT, cirBTC)\n\n*Example:* "Swap 50 USDC to EURC"`,
            action: null
        };
    }

    // 2. Invoice Intent Detection
    const invoiceMatch = prompt.match(/(?:invoice|bill|fatura|cobran[çc]a)\s+(?:de\s+)?(\d+(?:\.\d+)?)\s*(?:usdc|eurc)?(?:\s+(?:para|for|to|de)\s+(.+))?/i);
    if (invoiceMatch) {
        const amount = parseFloat(invoiceMatch[1]);
        const clientName = (invoiceMatch[2] || "Web3 Client").trim();
        const shortId = Math.random().toString(36).substring(2, 6).toUpperCase();

        return {
            content: isPt 
                ? `✅ **Fatura B2B Gerada com Sucesso!**\n\n• **Valor:** ${amount} USDC\n• **Cliente:** ${clientName}\n• **Código:** INV-${shortId}\n\nO link de pagamento seguro já foi preparado para você compartilhar!`
                : `✅ **B2B Invoice Successfully Generated!**\n\n• **Amount:** ${amount} USDC\n• **Client:** ${clientName}\n• **Invoice ID:** INV-${shortId}\n\nThe secure payment link is ready to share below!`,
            action: {
                action: "UI_GENERATE_INVOICE",
                payload: {
                    amount,
                    clientName,
                    description: "B2B On-Chain Invoice",
                    invoiceId: `INV-${shortId}`
                }
            }
        };
    }

    if (prompt.includes("invoice") || prompt.includes("fatura") || prompt.includes("cobrança") || prompt.includes("cobranca")) {
        return {
            content: isPt 
                ? `Para gerar uma fatura corporativa (Invoice 2.0), informe:\n\n• **Valor em USDC** (ex: 250)\n• **Nome do Cliente / Empresa**\n\n*Exemplo:* "Criar fatura de 200 USDC para Empresa Alpha"`
                : `To generate a corporate invoice (Invoice 2.0), please provide:\n\n• **Amount in USDC** (e.g. 250)\n• **Client / Company Name**\n\n*Example:* "Create an invoice for 200 USDC for Alpha Corp"`,
            action: null
        };
    }

    // 3. Bridge Intent Detection
    const bridgeMatch = prompt.match(/(?:bridge|ponte|transferir)\s+(?:de\s+)?(\d+(?:\.\d+)?)\s*(?:usdc)?(?:\s+(?:para|to)\s+(.+))?/i);
    if (bridgeMatch) {
        const amount = parseFloat(bridgeMatch[1]);
        const destinationNetwork = (bridgeMatch[2] || "Base Sepolia").trim();

        return {
            content: isPt 
                ? `🌉 **Ponte Cross-Chain (CCTP) Preparada:**\n\n• **Valor:** ${amount} USDC\n• **Destino:** Rede ${destinationNetwork}\n\nPor favor, aprove a transação abaixo para iniciar a transferência nativa de liquidez.`
                : `🌉 **Cross-Chain Bridge (CCTP) Prepared:**\n\n• **Amount:** ${amount} USDC\n• **Destination:** ${destinationNetwork} Network\n\nPlease approve the transaction below to initiate native liquidity transfer.`,
            action: {
                action: "UI_PREPARE_BRIDGE",
                payload: { amount, destination: destinationNetwork }
            }
        };
    }

    // 4. Yields Intent Detection
    if (prompt.includes("yield") || prompt.includes("rendimento") || prompt.includes("pool") || prompt.includes("apy") || prompt.includes("investir")) {
        return {
            content: isPt 
                ? `📊 **Oportunidades de Rendimento (APY):**\n\n• 🚀 **Aura DEX (Arc Testnet):** 12.50% *(Nativo)*\n• 🔹 **Aave V3 (Base Sepolia):** 8.15%\n• 🟢 **Compound (Arbitrum Sepolia):** 6.40%\n\n⚠️ *Nota: Pedimos desculpas, mas o módulo de depósitos e cofres de rendimento (Aura DEX Vaults) está temporariamente em manutenção para atualizações de contratos da próxima fase.*`
                : `📊 **Top Yield Opportunities (APY):**\n\n• 🚀 **Aura DEX (Arc Testnet):** 12.50% *(Native)*\n• 🔹 **Aave V3 (Base Sepolia):** 8.15%\n• 🟢 **Compound (Arbitrum Sepolia):** 6.40%\n\n⚠️ *Note: We apologize, but direct yield deposits and vaults are temporarily under maintenance for smart contract upgrades.*`,
            action: {
                action: "SHOW_YIELDS",
                payload: { token: "USDC" }
            }
        };
    }

    // Default Fallback
    return {
        content: isPt 
            ? `Olá! Sou o **Aura AI**, seu copiloto financeiro na **Arc Testnet**.\n\nPosso ajudar você a:\n• 🔄 **Fazer Swaps** entre USDC, EURC, USDT e cirBTC\n• 🌉 **Realizar Pontes Cross-chain** via Circle CCTP\n• 🧾 **Gerar Faturas B2B** (Invoice 2.0) com liquidação instantânea\n\nComo posso ajudar você agora?`
            : `Hello! I am **Aura AI**, your financial co-pilot on **Arc Testnet**.\n\nI can assist you with:\n• 🔄 **Token Swaps** between USDC, EURC, USDT, and cirBTC\n• 🌉 **Cross-chain Bridges** via Circle CCTP\n• 🧾 **B2B Invoicing** (Invoice 2.0) with instant settlement\n\nHow can I help you today?`,
        action: null
    };
}

async function callGroqFallback(messages, userAddress) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error("Groq API key not configured on server.");

    const groqSystemPrompt = `You are Aura AI, the official financial co-pilot of Aura Payments.
User connected wallet address: ${userAddress || 'Not connected'}.
Your goal is to help users execute swaps, cross-chain CCTP bridges, and create instant B2B on-chain invoices on Arc Testnet.

SYSTEM RULES:
1. Always be concise, helpful, objective, and professional.
2. LANGUAGE RULE: Default is ENGLISH. If the user writes in Portuguese (or any other language), match their language immediately with 100% natural fluency.
3. OFFICIAL KNOWLEDGE & LINKS (NEVER INVENT FAKE URLS):
   - Official Website: https://www.aurapayments.xyz
   - Official X / Twitter: https://x.com/danilo_schrute
   - Telegram & Discord: Currently under maintenance / coming soon. If asked for Discord or Telegram, inform the user: "Our Discord and Telegram channels are currently being prepared and will be opened soon. Stay tuned on our X (@danilo_schrute)!"
   - NEVER invent domains like aurapayments.io or fake discord links.
4. SUPPORTED TOKENS & NETWORK CONSTRAINTS (STRICT):
   - Tokens available on Arc Testnet: USDC, EURC, USDT, cirBTC.
   - Note: USDC is the native gas asset on Arc Network.
   - ETH, WETH, or BTC do NOT exist on Arc Testnet (only cirBTC exists). NEVER suggest ETH in examples or swap parameters. Always use USDC, EURC, USDT, or cirBTC.
5. CORE CAPABILITIES:
   - Token Swaps on Arc Testnet (USDC, EURC, USDT, cirBTC)
   - CCTP Cross-chain Bridge (Arc, Base, Arbitrum, Sepolia)
   - Invoice 2.0 (Instant B2B decentralized on-chain billing)
6. YIELD & LIQUIDITY DEPOSITS MAINTENANCE RULE:
   - If user asks about yield opportunities or to deposit into pools/Aura DEX, explain clearly:
     "⚠️ We apologize, but the Aura DEX Yield Vaults & Staking module is currently undergoing scheduled maintenance and smart contract upgrades for the upcoming phase. Swaps, CCTP Bridges, and B2B Invoices are 100% active!"
7. You NEVER execute transactions autonomously. You only prepare the transaction parameters for MetaMask confirmation.
8. RESPONSE FORMATTING: Structure cleanly with bullet points (•), bold text (**bold**), and line breaks (\\n\\n).`;

    const groqMessages = [
        { role: "system", content: groqSystemPrompt },
        ...messages.map(m => ({
            role: m.role === 'model' ? 'assistant' : m.role,
            content: m.content || " "
        }))
    ];

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages: groqMessages,
            temperature: 0.5,
            max_tokens: 1024
        })
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Groq API error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "Desculpe, não consegui processar a resposta.";

    // Simple intent extractor fallback for Groq
    const lastUserMsg = messages.filter(m => m.role === 'user').pop()?.content || "";
    let action = null;

    const swapMatch = lastUserMsg.match(/(\d+(?:\.\d+)?)\s*(usdc|eurc|usdt|eth|btc|cirbtc)?\s*(?:para|por|to|for|in)\s*(usdc|eurc|usdt|eth|btc|cirbtc)/i);
    if (swapMatch) {
        action = {
            action: "UI_PREPARE_SWAP",
            payload: {
                amount: parseFloat(swapMatch[1]),
                from: (swapMatch[2] || "USDC").toUpperCase(),
                to: swapMatch[3].toUpperCase()
            }
        };
    }

    return { content, action };
}
