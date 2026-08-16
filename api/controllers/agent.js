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

        // 1. Definição das Ferramentas (Function Calling)
        const tools = [
            {
                name: "generate_invoice",
                description: "Gera um link de pagamento B2B (Invoice). Use quando o usuário pedir para gerar uma cobrança ou invoice.",
                parameters: {
                    type: "object",
                    properties: {
                        amount: { type: "number", description: "Valor do invoice em USDC" },
                        clientName: { type: "string", description: "Nome do cliente ou empresa que vai pagar" },
                        description: { type: "string", description: "Descrição do serviço ou produto (opcional)" }
                    },
                    required: ["amount", "clientName"]
                }
            },
            {
                name: "prepare_swap",
                description: "Prepara uma transação de Swap entre duas moedas. Use quando o usuário quiser trocar, fazer swap ou comprar uma moeda com outra.",
                parameters: {
                    type: "object",
                    properties: {
                        amount: { type: "number", description: "Valor a ser trocado" },
                        fromToken: { type: "string", description: "Moeda de origem (ex: USDC, ETH)" },
                        toToken: { type: "string", description: "Moeda de destino (ex: EURC, WETH)" }
                    },
                    required: ["amount", "fromToken", "toToken"]
                }
            },
            {
                name: "prepare_bridge",
                description: "Prepara uma transação CCTP Bridge (ponte) para enviar USDC para outra rede blockchain. Use quando o usuário quiser transferir, mandar ou fazer bridge para outra rede.",
                parameters: {
                    type: "object",
                    properties: {
                        amount: { type: "number", description: "Valor em USDC a ser enviado" },
                        destinationNetwork: { type: "string", description: "Rede de destino (ex: Base, Arbitrum)" }
                    },
                    required: ["amount", "destinationNetwork"]
                }
            },
            {
                name: "find_yields",
                description: "Busca os melhores rendimentos (APY) para USDC ou outras moedas em protocolos DeFi. Use quando o usuário perguntar sobre rendimentos, yield, pools ou onde investir.",
                parameters: {
                    type: "object",
                    properties: {
                        token: { type: "string", description: "Moeda para buscar o rendimento (ex: USDC, ETH, etc. Padrão é USDC)" }
                    },
                    required: ["token"]
                }
            },
            {
                name: "get_portfolio_stats",
                description: "Analisa o histórico de faturas e pagamentos da carteira do usuário. Use quando o usuário perguntar sobre faturamento, ganhos, estatísticas ou transações passadas.",
                parameters: {
                    type: "object",
                    properties: {
                        period: { type: "string", description: "Período para análise (ex: 'today', 'week', 'month', 'all'). Padrão 'week'." }
                    },
                    required: []
                }
            }
        ];

        // 2. Configurar o Modelo e o System Instruction
        const model = genAI.getGenerativeModel({ 
            model: "gemini-1.5-flash", // fast model
            tools: [{ functionDeclarations: tools }],
            systemInstruction: `Você é o Aura AI, um assistente financeiro avançado B2B e DeFi criado pela Aura Payments.
O endereço da carteira (wallet) conectada do usuário atual é: ${userAddress || 'Não conectada'}.
Seu objetivo é ajudar o usuário a navegar pela economia agêntica na blockchain (Arc Testnet e outras redes).

REGRAS ESTABELECIDAS:
1. Sempre que você iniciar uma conversa (ou se o usuário não souber o que fazer), dê de forma resumida e amigável as opções em que você pode ajudar (ex: "Posso ajudar você a gerar uma fatura (invoice), fazer um Swap de moedas ou realizar uma ponte (Bridge) para outra rede").
2. Você tem liberdade para ser descontraído. Se o usuário pedir algo fora do contexto financeiro (como "quero uma pizza"), você pode entrar na brincadeira (ex: "Eu também adoro pizza, principalmente de calabresa! Mas como sou uma inteligência financeira, o máximo que posso fazer é gerar uma fatura para você cobrar o entregador. Vamos fazer um Swap ou Invoice?"). Use jogo de cintura para trazê-lo de volta.
3. Se o pedido for impossível ou totalmente fora do escopo, avise educadamente que infelizmente não pode ajudar com isso.
4. Você NUNCA executa transações de fundos sozinho. Você apenas PREPARA as transações usando as suas ferramentas (functions) para que o usuário assine na MetaMask com segurança.
5. Se o usuário pedir para fazer Swap, Bridge, Invoice, ou buscar rendimentos, use a ferramenta correta IMEDIATAMENTE (Function Call) para processar o pedido.
6. Ao usar a ferramenta 'find_yields', os dados processados serão injetados de volta. Recomende opções de forma concisa.`,
        });

        // 3. Formatar o Histórico de Mensagens para o Formato do Gemini
        const formattedHistory = messages.map(msg => {
            let role = msg.role === 'assistant' ? 'model' : msg.role;
            return {
                role: role,
                parts: [{ text: msg.content || " " }] // Evitar text empty
            };
        });

        // Separar a última mensagem do usuário do histórico (pois ela aciona o gerador)
        const lastMessageIndex = formattedHistory.findLastIndex(m => m.role === 'user');
        
        let chatHistory = [];
        let promptText = "";
        
        if (lastMessageIndex >= 0) {
             chatHistory = formattedHistory.slice(0, lastMessageIndex);
             promptText = formattedHistory[lastMessageIndex].parts[0].text;
        } else {
             return res.status(400).json({ error: "Nenhuma mensagem do usuário encontrada." });
        }

        // Iniciar chat
        const chat = model.startChat({
            history: chatHistory,
        });

        // Enviar a mensagem para o Gemini
        const result = await chat.sendMessage(promptText);
        const response = result.response;
        const functionCalls = response.functionCalls();

        // 4. Lidar com Function Calling
        if (functionCalls && functionCalls.length > 0) {
            const call = functionCalls[0];
            const functionName = call.name;
            const args = call.args;

            console.log(`[Aura AI] Function Call: ${functionName}`, args);

            let actionResponse = {};
            let displayMessage = "";

            if (functionName === "generate_invoice") {
                const shortId = Math.random().toString(36).substring(2, 6).toUpperCase();
                actionResponse = {
                    action: "UI_GENERATE_INVOICE",
                    payload: {
                        amount: args.amount,
                        clientName: args.clientName,
                        description: args.description || "Cobrança gerada via IA",
                        invoiceId: `INV-${shortId}`
                    }
                };
                displayMessage = `Perfeito! Preparei o invoice de **${args.amount} USDC** para **${args.clientName}**. O sistema vai gerar o link de pagamento seguro agora mesmo para você compartilhar!`;
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
                displayMessage = `Entendido! Estou preparando a transação para trocar **${args.amount} ${args.fromToken}** por **${args.toToken}** usando o melhor roteamento na rede. A sua carteira abrirá em breve para você assinar com segurança.`;
            }
            else if (functionName === "prepare_bridge") {
                actionResponse = {
                    action: "UI_PREPARE_BRIDGE",
                    payload: {
                        amount: args.amount,
                        destination: args.destinationNetwork
                    }
                };
                displayMessage = `Excelente! O protocolo Circle CCTP foi acionado. Vou preparar a transação de **${args.amount} USDC** para a rede **${args.destinationNetwork}**. Aguarde a MetaMask para aprovar a ponte.`;
            }
            else if (functionName === "find_yields") {
                // Simulação de retorno de API de yields
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
                displayMessage = `Pesquisei as melhores taxas (APY) para **${args.token || 'USDC'}** hoje! O protocolo nativo **Aura DEX** está pagando **12.50%** (o melhor no momento), mas se preferir redes Layer 2, a **Aave (Arbitrum)** está pagando **7.45%** e o **Compound (Base)** está com **6.80%**. Posso preparar um depósito em algum deles para você?`;
            }
            else if (functionName === "get_portfolio_stats") {
                actionResponse = {
                    action: "SHOW_STATS",
                    payload: { period: args.period }
                };
                displayMessage = `Analisando os dados da carteira ${userAddress ? userAddress.slice(0,6) + '...' : ''}. Nos últimos 7 dias, você recebeu **1.450 USDC** através de 5 faturas pagas e economizou cerca de $12 em taxas de rede operando pela Arc!`;
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
            // Se não chamou função, é uma resposta de texto normal do Gemini
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
            error: "Erro no processamento da Inteligência Artificial.", 
            details: error.message 
        });
    }
}
