import { GoogleGenerativeAI } from "@google/generative-ai";

// Cache for the AI model instance
let genAI = null;

export async function handleAgentChat(req, res) {
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

        // 1. Function Calling Tool Declarations
        const tools = [
            {
                name: "generate_invoice",
                description: "Generates a decentralized B2B payment invoice link on Arc Testnet.",
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
                description: "Prepares an on-chain token swap transaction on Arc Testnet. Supported tokens: USDC, EURC, USDT, cirBTC.",
                parameters: {
                    type: "object",
                    properties: {
                        amount: { type: "number", description: "Amount to swap" },
                        fromToken: { type: "string", description: "Source token symbol (USDC, EURC, USDT, cirBTC)" },
                        toToken: { type: "string", description: "Destination token symbol (USDC, EURC, USDT, cirBTC)" }
                    },
                    required: ["amount", "fromToken", "toToken"]
                }
            },
            {
                name: "prepare_bridge",
                description: "Prepares a Circle CCTP bridge transaction to transfer USDC to connected testnets.",
                parameters: {
                    type: "object",
                    properties: {
                        amount: { type: "number", description: "USDC amount to transfer" },
                        destinationNetwork: { type: "string", description: "Destination network (e.g., Base, Arbitrum)" }
                    },
                    required: ["amount", "destinationNetwork"]
                }
            },
            {
                name: "find_yields",
                description: "Searches top DeFi yield pools and APY opportunities on supported networks.",
                parameters: {
                    type: "object",
                    properties: {
                        token: { type: "string", description: "Token to search yield for (default: USDC)" }
                    },
                    required: ["token"]
                }
            },
            {
                name: "get_portfolio_stats",
                description: "Retrieves portfolio performance and 7d revenue summary.",
                parameters: {
                    type: "object",
                    properties: {
                        period: { type: "string", description: "Analysis period ('today', 'week', 'month', 'all'). Default 'week'." }
                    },
                    required: []
                }
            }
        ];

        // 2. Configure Model and System Instruction
        const model = genAI.getGenerativeModel({ 
            model: "gemini-1.5-flash",
            tools: [{ functionDeclarations: tools }],
            systemInstruction: `You are Aura AI, the official financial co-pilot of Aura Payments.
User connected wallet address: ${userAddress || 'Not connected'}.
Your goal is to help users execute swaps, cross-chain CCTP bridges, and create instant B2B on-chain invoices on Arc Testnet.

SYSTEM RULES:
1. Always be concise, helpful, objective, and professional.
2. All explanations and system messages must be in English.
3. Tokens available on Arc Testnet: USDC, EURC, USDT, cirBTC. Note: USDC is native gas.
4. You NEVER execute transactions autonomously. You only prepare the transaction parameters for MetaMask confirmation.
5. RESPONSE FORMATTING: Structure cleanly with bullet points (•), bold text (**bold**), and line breaks.`,
        });

        // 3. Format Message History for Gemini
        const formattedHistory = messages.map(msg => {
            let role = msg.role === 'assistant' ? 'model' : msg.role;
            return {
                role: role,
                parts: [{ text: msg.content || " " }]
            };
        });

        const lastMessageIndex = formattedHistory.findLastIndex(m => m.role === 'user');
        
        let chatHistory = [];
        let promptText = "";
        
        if (lastMessageIndex >= 0) {
             chatHistory = formattedHistory.slice(0, lastMessageIndex);
             promptText = formattedHistory[lastMessageIndex].parts[0].text;
        } else {
             return res.status(400).json({ error: "No user message found in history." });
        }

        // Start chat session
        const chat = model.startChat({
            history: chatHistory,
        });

        // Send message to Gemini
        const result = await chat.sendMessage(promptText);
        const response = result.response;
        const functionCalls = response.functionCalls();

        // 4. Handle Function Calling
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
                        description: args.description || "B2B Invoice",
                        invoiceId: `INV-${shortId}`
                    }
                };
                displayMessage = `✅ **B2B Invoice Successfully Generated!**\n\n• **Amount:** ${args.amount} USDC\n• **Client:** ${args.clientName}\n• **Invoice ID:** INV-${shortId}\n\nThe secure payment link is ready to share below!`;
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
                displayMessage = `🔄 **Swap Transaction Prepared:**\n\n• **Swap:** ${args.amount} ${args.fromToken}\n• **Receive:** ${args.toToken}\n• **Network:** Arc Testnet\n\nPlease confirm in MetaMask below to complete the swap securely.`;
            }
            else if (functionName === "prepare_bridge") {
                actionResponse = {
                    action: "UI_PREPARE_BRIDGE",
                    payload: {
                        amount: args.amount,
                        destination: args.destinationNetwork
                    }
                };
                displayMessage = `🌉 **Cross-Chain Bridge (CCTP) Prepared:**\n\n• **Amount:** ${args.amount} USDC\n• **Destination:** ${args.destinationNetwork} Network\n\nPlease approve the transaction below to initiate liquidity transfer.`;
            }
            else if (functionName === "find_yields") {
                actionResponse = {
                    action: "SHOW_YIELDS",
                    payload: {
                        token: args.token || 'USDC',
                        pools: [
                            { protocol: "Aura DEX", network: "Arc Testnet", apy: "12.50%" },
                            { protocol: "Aave V3", network: "Arbitrum", apy: "7.45%" },
                            { protocol: "Compound", network: "Base", apy: "6.80%" },
                        ]
                    }
                };
                displayMessage = `📊 **Top Yield Opportunities for ${args.token || 'USDC'}:**\n\n• 🚀 **Aura DEX (Arc Testnet):** 12.50% *(Native)*\n• 🔹 **Aave V3 (Base Sepolia):** 8.15%\n• 🟢 **Compound (Arbitrum Sepolia):** 6.40%\n\n⚠️ *Note: The Aura DEX Yield Vaults & Staking module is currently undergoing scheduled maintenance for smart contract upgrades.*`;
            }
            else if (functionName === "get_portfolio_stats") {
                actionResponse = {
                    action: "SHOW_STATS",
                    payload: { period: args.period }
                };
                displayMessage = `💼 **Portfolio Overview:**\n\n• **7-Day Revenue:** 1,450 USDC (5 settled invoices)\n• **Estimated Gas Saved:** ~$12.40 on Arc Network\n• **Status:** Active & Protected`;
            }

            return res.status(200).json({
                success: true,
                message: {
                    role: "assistant",
                    content: displayMessage
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

    } catch (error) {
        console.error("[Agent Chat Error]:", error);
        return res.status(500).json({ 
            error: "Error processing Artificial Intelligence request.", 
            details: error.message 
        });
    }
}
