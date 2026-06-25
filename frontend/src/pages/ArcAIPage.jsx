import { useState, useRef, useEffect } from 'react';
import DeFiWidget from '../components/ui/DeFiWidget';
import PaymentForm from '../components/forms/PaymentForm';
import { motion, AnimatePresence } from 'framer-motion';

export default function ArcAIPage() {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Olá! Eu sou o seu Agente Autônomo alimentado pela Circle. Posso executar swaps cross-chain, pontes (bridges) ou gerar faturas B2B. Qual é a sua missão de hoje?' }
  ]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);
  const logsEndRef = useRef(null);
  const [logs, setLogs] = useState([
    "[SYSTEM] Inicializando Circle Agent Stack...",
    "[SYSTEM] Conectado à Arc Testnet.",
    "[AGENT] Monitorando pools de liquidez USDC...",
    "[AGENT] Módulo de Fatura 2.0 ativo."
  ]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const addLog = (text) => {
    setLogs(prev => [...prev, text]);
  };

  const [conversationState, setConversationState] = useState('IDLE');

  const handleSend = (textOverride = null) => {
    const textToSend = textOverride !== null ? textOverride : input;
    if (!textToSend.trim()) return;

    const newMessages = [...messages, { role: 'user', content: textToSend }];
    setMessages(newMessages);
    if (textOverride === null) setInput('');
    
    addLog(`[USER] Recebeu: "${textToSend.substring(0, 20)}..."`);
    addLog(`[AGENT] Processando NLP (Intenção e Entidades)...`);

    setTimeout(() => {
      const lowerInput = textToSend.toLowerCase();
      let response = '';

      if (conversationState === 'IDLE') {
        if (lowerInput.includes('swap') || lowerInput.includes('trocar') || lowerInput.includes('trade')) {
          response = 'Excelente escolha! Para começarmos, de qual ativo para qual ativo você quer fazer o swap? (ex: USDC para EURC)';
          setConversationState('AWAITING_SWAP_PAIRS');
          addLog(`[AGENT] Estado alterado para AWAITING_SWAP_PAIRS`);
        } else if (lowerInput.includes('bridge') || lowerInput.includes('ponte') || lowerInput.includes('transferir')) {
          response = 'Ótimo. O protocolo CCTP está pronto. Para qual rede de destino você deseja enviar seus tokens? (ex: Base, Arbitrum)';
          setConversationState('AWAITING_BRIDGE_CHAIN');
          addLog(`[AGENT] Estado alterado para AWAITING_BRIDGE_CHAIN`);
        } else if (lowerInput.includes('invoice') || lowerInput.includes('fatura') || lowerInput.includes('cobrar')) {
          response = 'Vamos gerar essa cobrança. Qual o nome do seu cliente e o valor da fatura? (ex: Alice Crypto, 500 USDC)';
          setConversationState('AWAITING_INVOICE_DETAILS');
          addLog(`[AGENT] Estado alterado para AWAITING_INVOICE_DETAILS`);
        } else {
          response = 'Não entendi completamente. Sou um agente focado em DeFi. Você quer que eu faça um Swap, uma Bridge ou gere uma Fatura?';
        }
      } 
      
      else if (conversationState === 'AWAITING_SWAP_PAIRS') {
        response = 'Perfeito, já mapeei a melhor rota nas pools. Qual o valor que você deseja trocar?';
        setConversationState('AWAITING_SWAP_AMOUNT');
        addLog(`[AGENT] Rota de liquidez encontrada. Aguardando valor.`);
      } 
      
      else if (conversationState === 'AWAITING_SWAP_AMOUNT') {
        response = 'Tudo certo! Assinando transação com a Agent Wallet e executando o Swap na blockchain... 🔄 Pronto! Swap realizado com sucesso.';
        setConversationState('IDLE');
        addLog(`[TX] Assinando Payload de Swap...`);
        addLog(`[TX] Transação confirmada na Arc Testnet.`);
      }

      else if (conversationState === 'AWAITING_BRIDGE_CHAIN') {
        response = 'Rede confirmada. Iniciando a queima (burn) de USDC na Arc e o mint na rede de destino via Circle CCTP... 🌉 Sucesso! Seus fundos chegaram ao destino.';
        setConversationState('IDLE');
        addLog(`[TX] Executando Burn de USDC na rede origem...`);
        addLog(`[TX] Mint de USDC na rede destino concluído.`);
      }

      else if (conversationState === 'AWAITING_INVOICE_DETAILS') {
        response = 'Fatura gerada e criptografada com sucesso! 🧾 O link de pagamento B2B é: https://arcpay.network/pay/inv-8842';
        setConversationState('IDLE');
        addLog(`[AGENT] Smart Contract de Escrow criado.`);
        addLog(`[AGENT] Fatura armazenada na blockchain.`);
      }

      setMessages(prev => [...prev, { role: 'assistant', content: response }]);
    }, 1200);
  };

  const suggestedPrompts = [
    "Vamos fazer um Swap?",
    "Quero fazer uma Bridge",
    "Preciso criar uma Fatura"
  ];

  return (
    <section className="w-full pt-8 pb-6 overflow-hidden flex flex-col h-[calc(100vh-128px)]">
      
      {/* Grid Principal do Command Center */}
      <div className="w-full max-w-7xl mx-auto px-6 h-full flex gap-6 items-stretch">
        
        {/* COLUNA ESQUERDA: Status do Agente */}
        <div className="hidden lg:flex w-[280px] flex-col gap-6 h-full">
          {/* Agent Identity Card */}
          <div className="bg-dark-card border border-dark-border rounded-3xl p-6 shadow-2xl flex flex-col items-center text-center">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center shadow-[0_0_30px_rgba(37,99,235,0.3)] mb-4 p-1">
              <div className="w-full h-full bg-dark-bg rounded-full flex items-center justify-center">
                <svg className="w-10 h-10 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">Arc AI Core</h2>
            <div className="flex items-center gap-1.5 mt-2 bg-green-500/10 px-3 py-1.5 rounded-full border border-green-500/20">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              <span className="text-[10px] font-black text-green-400 uppercase tracking-widest">Agent Online</span>
            </div>
            
            <div className="w-full h-px bg-dark-border/50 my-6"></div>
            
            <div className="w-full text-left space-y-3 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-dark-muted font-medium">Model</span>
                <span className="text-white font-bold">Circle Stack v2</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-dark-muted font-medium">Network</span>
                <span className="text-white font-bold">Arc Testnet</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-dark-muted font-medium">Agent Wallet</span>
                <span className="text-blue-400 font-mono bg-blue-500/10 px-2 py-0.5 rounded text-xs">0xAgent...9A</span>
              </div>
            </div>
          </div>

          {/* Active Modules */}
          <div className="bg-dark-card border border-dark-border rounded-3xl p-6 shadow-2xl flex-1">
            <h3 className="text-xs font-black text-dark-muted uppercase tracking-widest mb-4">Active Modules</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-dark-bg/50 border border-dark-border/50 rounded-xl">
                <span className="text-lg">💱</span>
                <div className="flex-1">
                  <div className="text-sm font-bold text-white">Smart Routing</div>
                  <div className="text-[10px] text-dark-muted">Auto-swaps enabled</div>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-dark-bg/50 border border-dark-border/50 rounded-xl">
                <span className="text-lg">🌉</span>
                <div className="flex-1">
                  <div className="text-sm font-bold text-white">CCTP Protocol</div>
                  <div className="text-[10px] text-dark-muted">Cross-chain ready</div>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-dark-bg/50 border border-dark-border/50 rounded-xl">
                <span className="text-lg">🧾</span>
                <div className="flex-1">
                  <div className="text-sm font-bold text-white">Invoice Engine</div>
                  <div className="text-[10px] text-dark-muted">B2B billing active</div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* COLUNA CENTRAL: O Chat Card */}
        <div className="flex-1 bg-dark-card/90 backdrop-blur-xl border border-dark-border rounded-3xl flex flex-col shadow-2xl overflow-hidden relative h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-dark-border bg-dark-bg/80">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-bold text-white leading-none">Arc Terminal</h2>
                <span className="text-[10px] font-bold text-dark-muted uppercase tracking-widest mt-1 block">
                  Interactive Assistant
                </span>
              </div>
            </div>
            
            <button className="text-dark-muted hover:text-white transition-colors p-2 bg-dark-input rounded-lg border border-dark-border/50">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            </button>
          </div>

          {/* Chat Area */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-dark-border scrollbar-track-transparent bg-[#0a0f1a]/30">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl p-4 shadow-lg ${
                  msg.role === 'user' 
                    ? 'bg-blue-600 text-white rounded-tr-sm border border-blue-500' 
                    : 'bg-dark-input border border-dark-border/50 text-dark-text rounded-tl-sm'
                }`}>
                  <p className="text-sm leading-relaxed">{msg.content}</p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 border-t border-dark-border bg-dark-bg/90">
            <div className="relative flex items-center w-full">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Ask the agent to swap, bridge, or create invoice..."
                className="w-full bg-dark-input border border-dark-border rounded-2xl py-4 pl-5 pr-14 text-sm text-white placeholder-dark-muted focus:outline-none focus:border-blue-500/50 transition-all shadow-inner"
              />
              <button 
                onClick={() => handleSend()}
                className="absolute right-2 p-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-500 transition-all shadow-[0_0_15px_rgba(37,99,235,0.4)] active:scale-95"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
            <div className="text-center mt-3">
              <span className="text-[9px] text-dark-muted font-bold uppercase tracking-[0.2em] opacity-50">Powered by Circle Agent Stack & OpenAI</span>
            </div>
          </div>
        </div>

        {/* COLUNA DIREITA: Prompts e Logs */}
        <div className="hidden xl:flex w-[300px] flex-col gap-6 h-full">
          {/* Suggested Actions */}
          <div className="bg-dark-card border border-dark-border rounded-3xl p-6 shadow-2xl">
            <h3 className="text-xs font-black text-dark-muted uppercase tracking-widest mb-4">Suggested Actions</h3>
            <div className="space-y-2">
              {suggestedPrompts.map((prompt, idx) => (
                <button 
                  key={idx}
                  onClick={() => handleSend(prompt)}
                  className="w-full text-left p-3 rounded-xl bg-dark-input border border-dark-border/50 hover:bg-dark-border hover:border-blue-500/30 transition-all group flex items-center justify-between"
                >
                  <span className="text-xs font-bold text-gray-300 group-hover:text-white transition-colors">{prompt}</span>
                  <svg className="w-4 h-4 text-dark-muted group-hover:text-blue-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </button>
              ))}
            </div>
          </div>

          {/* Agent Terminal Logs */}
          <div className="bg-dark-bg border border-dark-border rounded-3xl p-5 shadow-inner flex-1 flex flex-col overflow-hidden relative">
            {/* Terminal Top Bar */}
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500/80"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-green-500/80"></div>
              <span className="ml-2 text-[10px] font-mono text-dark-muted">agent-logs.sh</span>
            </div>
            
            <div className="flex-1 overflow-y-auto overflow-x-hidden space-y-2 font-mono text-[10px] leading-relaxed scrollbar-none pb-12">
              <AnimatePresence>
                {logs.map((log, idx) => (
                  <motion.div 
                    key={idx}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={`
                      ${log.startsWith('[SYSTEM]') ? 'text-blue-400' : ''}
                      ${log.startsWith('[AGENT]') ? 'text-green-400' : ''}
                      ${log.startsWith('[USER]') ? 'text-purple-400' : ''}
                    `}
                  >
                    <span className="opacity-50 select-none mr-2">{'>'}</span>
                    {log}
                  </motion.div>
                ))}
              </AnimatePresence>
              <div ref={logsEndRef} />
            </div>
            <div className="absolute bottom-0 left-0 w-full h-12 bg-gradient-to-t from-dark-bg to-transparent pointer-events-none"></div>
          </div>
        </div>

      </div>
    </section>
  );
}
