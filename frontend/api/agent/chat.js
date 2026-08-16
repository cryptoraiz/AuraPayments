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
        const { messages, userAddress } = req.body;

        if (!messages || !Array.isArray(messages)) {
            return res.status(400).json({ error: "Messages array is required." });
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: "Gemini API key not configured on server." });
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
                description: "Prepares a token swap/trade transaction. Trigger for requests about swapping, trading, or converting tokens (trocar moedas, fazer swap, comprar token, trade).",
                parameters: {
                    type: "object",
                    properties: {
                        amount: { type: "number", description: "Amount to swap" },
                        fromToken: { type: "string", description: "Source token symbol (e.g. USDC, ETH)" },
                        toToken: { type: "string", description: "Target token symbol (e.g. EURC, WETH)" }
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
                        token: { type: "string", description: "Token to check yields for (e.g., USDC, ETH, EURC, BTC). Default is USDC." }
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
        const model = genAI.getGenerativeModel({ 
            model: "gemini-3.6-flash",
            tools: [{ functionDeclarations: tools }],
            systemInstruction: `You are Aura AI, the official financial co-pilot of Aura Payments.
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
4. CORE CAPABILITIES:
   - Token Swaps on Arc Testnet (USDC, EURC, USDT, etc.)
   - CCTP Cross-chain Bridge (Arc, Base, Arbitrum, Sepolia)
   - Invoice 2.0 (Instant B2B decentralized on-chain billing)
5. TOOL MAPPING:
   - "invoice", "bill", "payment link", "fatura", "cobrança" -> Call \`generate_invoice\`.
   - "swap", "trade", "exchange", "trocar", "comprar" -> Call \`prepare_swap\`.
   - "bridge", "cross-chain", "transfer network", "ponte" -> Call \`prepare_bridge\`.
   - "portfolio", "history", "stats", "desempenho", "estatísticas" -> Call \`get_portfolio_stats\`.
6. You NEVER execute transactions autonomously. You only prepare the transaction parameters for MetaMask confirmation.
7. YIELD & LIQUIDITY DEPOSITS MAINTENANCE RULE:
   - If the user asks to deposit, stake, or invest funds into Aura DEX, Vaults, or any yield pool, apologize and state clearly that the Yield Vaults & Staking module is currently under scheduled maintenance / testnet upgrades for the next phase.
   - Example in PT: "Pedimos desculpas, mas o módulo de depósitos e cofres de rendimento (Aura DEX Vaults) está temporariamente em manutenção para atualizações de contratos. No momento, você pode utilizar normalmente os módulos de Swap, Ponte CCTP e Faturas B2B!"
   - Example in EN: "We apologize, but the Aura DEX Yield Vaults & Staking module is currently undergoing scheduled maintenance for smart contract upgrades. You can freely use Swaps, CCTP Bridges, and B2B Invoices!"
8. RESPONSE FORMATTING: Structure cleanly with bullet points (•), bold text (**bold**), and line breaks (\n\n).`,
        });

        // 3. Formatar o Histórico de Mensagens para o Formato do Gemini
        let formattedHistory = messages.map(msg => {
            let role = msg.role === 'assistant' ? 'model' : msg.role;
            return {
                role: role,
                parts: [{ text: msg.content || " " }]
            };
        });

        // Gemini exige que os papéis se alternem estritamente (user, model, user, model).
        // Vamos agrupar mensagens consecutivas do mesmo papel para evitar o erro 400 da API.
        let mergedHistory = [];
        for (let msg of formattedHistory) {
            if (mergedHistory.length > 0 && mergedHistory[mergedHistory.length - 1].role === msg.role) {
                mergedHistory[mergedHistory.length - 1].parts[0].text += "\n\n" + msg.parts[0].text;
            } else {
                mergedHistory.push(msg);
            }
        }

        // Gemini exige que a primeira mensagem do histórico seja SEMPRE do 'user'.
        while (mergedHistory.length > 0 && mergedHistory[0].role === 'model') {
            mergedHistory.shift();
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

        const isPt = /[ãáàâéêíóôõúç]/i.test(promptText) || /\b(rendimento|rendimentos|fatura|faturas|troca|trocar|ponte|ajuda|quero|preciso|mostrar|carteira|quanto|como)\b/i.test(promptText);

        const chat = model.startChat({
            history: chatHistory,
        });

        const result = await chat.sendMessage(promptText);
        const response = result.response;
        const functionCalls = response.functionCalls();

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
        console.warn("[Gemini Primary Notice - Activating Groq Fallback]:", geminiError.message);

        if (process.env.GROQ_API_KEY) {
            try {
                const groqText = await callGroqFallback(messages, userAddress);
                return res.status(200).json({
                    success: true,
                    message: {
                        role: "assistant",
                        content: groqText
                    }
                });
            } catch (groqError) {
                console.error("[Groq Fallback Error]:", groqError.message);
            }
        }

        return res.status(500).json({ 
            error: "Erro no processamento da Inteligência Artificial.", 
            details: geminiError.message 
        });
    }
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
4. CORE CAPABILITIES:
   - Token Swaps on Arc Testnet (USDC, EURC, USDT, etc.)
   - CCTP Cross-chain Bridge (Arc, Base, Arbitrum, Sepolia)
   - Invoice 2.0 (Instant B2B decentralized on-chain billing)
5. YIELD & LIQUIDITY DEPOSITS MAINTENANCE RULE:
   - If user asks about yield opportunities or to deposit into pools/Aura DEX, explain clearly:
     "⚠️ We apologize, but the Aura DEX Yield Vaults & Staking module is currently undergoing scheduled maintenance and smart contract upgrades for the upcoming phase. Swaps, CCTP Bridges, and B2B Invoices are 100% active!"
6. You NEVER execute transactions autonomously. You only prepare the transaction parameters for MetaMask confirmation.
7. RESPONSE FORMATTING: Structure cleanly with bullet points (•), bold text (**bold**), and line breaks (\\n\\n).`;

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
    return data.choices?.[0]?.message?.content || "Desculpe, não consegui processar a resposta.";
}
