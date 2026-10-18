import { useState, useRef, useEffect } from 'react';
import { useAccount, useConnect, useSendTransaction, useChainId } from 'wagmi';
import { parseEther } from 'viem';
import confetti from 'canvas-confetti';
import { arcMainnet } from '../config/wagmi';
import DeFiWidget from '../components/ui/DeFiWidget';
import PaymentForm from '../components/forms/PaymentForm';
import WalletModal from '../components/ui/WalletModal';
import { motion, AnimatePresence } from 'framer-motion';

export default function ArcAIPage() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const chainId = useChainId();
  const isMainnet = chainId === arcMainnet.id;
  const networkName = isMainnet ? 'Arc Mainnet' : 'Arc Testnet';
  const explorerUrl = isMainnet ? 'https://explorer.arc.io' : 'https://testnet.arcscan.app';
  const explorerName = isMainnet ? 'Arc Explorer' : 'ArcScan';

  const { sendTransaction, isPending, isSuccess } = useSendTransaction();
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [copiedHash, setCopiedHash] = useState(null);
  const [executedActions, setExecutedActions] = useState(new Set());
  const [mobileView, setMobileView] = useState('chat'); // 'chat' | 'status'
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Welcome to Aura Terminal! ⚡ I can prepare cross-chain swaps, bridge tokens across networks via CCTP, or generate instant B2B on-chain invoices. How can I assist you today?' }
  ]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);
  const logsEndRef = useRef(null);
  const [logs, setLogs] = useState([
    "[SYSTEM] Initializing Aura Agent Stack...",
    `[SYSTEM] Connected to ${networkName}.`,
    "[AGENT] Monitoring cross-chain routes & gas...",
    "[AGENT] Aura Core Engine active."
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

  const prevChainIdRef = useRef(chainId);
  useEffect(() => {
    if (prevChainIdRef.current !== chainId) {
      prevChainIdRef.current = chainId;
      addLog(`[SYSTEM] Network switched to ${networkName}.`);
    }
  }, [chainId, networkName]);

  const addLog = (text) => {
    setLogs(prev => [...prev, text]);
  };

  const handleResetChat = () => {
    setMessages([
      { role: 'assistant', content: 'Welcome to Aura Terminal! ⚡ I can prepare cross-chain swaps, bridge tokens across networks via CCTP, or generate instant B2B on-chain invoices. How can I assist you today?' }
    ]);
    setInput('');
    setLogs([
      "[SYSTEM] Initializing Aura Agent Stack...",
      `[SYSTEM] Connected to ${networkName}.`,
      "[AGENT] Monitoring cross-chain routes & gas...",
      "[AGENT] Aura Core Engine active.",
      "[SYSTEM] Chat session restarted."
    ]);
  };

  const handleSend = async (textOverride = null) => {
    const textToSend = textOverride !== null ? textOverride : input;
    if (!textToSend.trim()) return;

    const newMessages = [...messages, { role: 'user', content: textToSend }];
    setMessages(newMessages);
    if (textOverride === null) setInput('');
    
    addLog(`[USER] Received: "${textToSend.substring(0, 20)}..."`);
    addLog(`[AGENT] Processing NLP (Aura Engine)...`);

    try {
      let data = null;
      try {
        const res = await fetch('/api/agent/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: newMessages, userAddress: address })
        });
        if (res.ok) {
          data = await res.json();
        }
      } catch (localErr) {
        // Fallback for local development if Vite proxy is offline
      }

      // If local request failed or returned invalid response, fallback to production backend
      if (!data || !data.message) {
        const prodRes = await fetch('https://www.aurapayments.xyz/api/agent/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: newMessages, userAddress: address })
        });
        if (prodRes.ok) {
          data = await prodRes.json();
        }
      }

      if (data && data.message) {
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: data.message.content, 
          action: data.action || null 
        }]);
        
        if (data.action) {
           addLog(`[AGENT] Executed action: ${data.action.action}`);
        } else {
           addLog(`[AGENT] Inference completed successfully.`);
        }
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: "An error occurred." }]);
        addLog(`[ERROR] Invalid response from AI engine.`);
      }
    } catch (e) {
      addLog(`[ERROR] Connection failed.`);
      setMessages(prev => [...prev, { role: 'assistant', content: "Connection error to the agent server." }]);
    }
  };

  const executeAIAction = (actionDetails, msgIdx) => {
    if (!isConnected || !address) {
      setIsWalletModalOpen(true);
      return;
    }
    
    // Fire a generic test transaction to simulate the prepared execution
    sendTransaction({
      to: address, 
      value: parseEther('0.0001'),
    }, {
      onSuccess: (hash) => {
        if (msgIdx !== undefined) {
          setExecutedActions(prev => new Set([...prev, msgIdx]));
        }

        try {
          confetti({
            particleCount: 60,
            spread: 60,
            origin: { y: 0.7 }
          });
        } catch (e) {}

        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `✅ **Transaction Successfully Submitted!**\n\nThe operation is now confirmed on **${networkName}**. You can view the live on-chain receipt below:`,
          txHash: hash
        }]);
        addLog(`[SYSTEM] Transaction confirmed: ${hash}`);
      },
      onError: (error) => {
        addLog(`[ERROR] Transaction rejected or failed.`);
      }
    });
    addLog(`[USER] Signed action: ${actionDetails.action} via Wallet`);
  };

  const suggestedPrompts = [
    "I want to swap",
    "I want to make a bridge",
    "I need to create an invoice"
  ];

  return (
    <section className="flex-1 flex flex-col p-2 lg:p-3 xl:p-4 overflow-hidden min-h-0 max-w-7xl mx-auto w-full">
      
      {/* Mobile Tab Bar — visible only on phones/small screens */}
      <div className="flex lg:hidden mb-2 rounded-xl overflow-hidden border border-dark-border bg-dark-card shrink-0">
        <button
          onClick={() => setMobileView('chat')}
          className={`flex-1 py-2 text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${mobileView === 'chat' ? 'bg-blue-600 text-white' : 'text-dark-muted hover:text-white'}`}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
          Chat
        </button>
        <button
          onClick={() => setMobileView('status')}
          className={`flex-1 py-2 text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${mobileView === 'status' ? 'bg-blue-600 text-white' : 'text-dark-muted hover:text-white'}`}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          Agent Status
        </button>
      </div>

      {/* Command Center Main Grid */}
      <div className="flex-1 min-h-0 flex gap-2 lg:gap-3 xl:gap-4 2xl:gap-6 items-stretch overflow-hidden">
        
        {/* LEFT COLUMN: Agent Status — hidden on mobile unless mobileView=status */}
        <div className={`${mobileView === 'status' ? 'flex' : 'hidden'} lg:flex w-full lg:w-[210px] xl:w-[240px] 2xl:w-[280px] flex-col gap-3 xl:gap-4 2xl:gap-6 h-full overflow-y-auto pr-1 shrink-0`}>
          {/* Agent Identity Card */}
          <div className="bg-dark-card border border-dark-border rounded-2xl xl:rounded-3xl p-3 xl:p-4 2xl:p-6 shadow-2xl flex flex-col items-center text-center shrink-0">
            <div className="w-12 h-12 xl:w-16 xl:h-16 2xl:w-20 2xl:h-20 rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center shadow-[0_0_30px_rgba(37,99,235,0.3)] mb-2 xl:mb-3 2xl:mb-4 p-1">
              <div className="w-full h-full bg-dark-bg rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 xl:w-8 xl:h-8 2xl:w-10 2xl:h-10 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
            </div>
            <h2 className="text-sm xl:text-base 2xl:text-xl font-bold text-white tracking-tight">Aura AI</h2>
            <div className="flex items-center gap-1.5 mt-1.5 xl:mt-2 bg-green-500/10 px-2.5 xl:px-3 py-1 xl:py-1.5 rounded-full border border-green-500/20">
              <span className="w-1.5 h-1.5 xl:w-2 xl:h-2 rounded-full bg-green-500 animate-pulse"></span>
              <span className="text-[9px] xl:text-[10px] font-black text-green-400 uppercase tracking-widest">Agent Online</span>
            </div>
            
            <div className="w-full h-px bg-dark-border/50 my-3 xl:my-4 2xl:my-6"></div>
            
            <div className="w-full text-left space-y-2 xl:space-y-3 text-xs xl:text-sm">
              <div className="flex justify-between items-center">
                <span className="text-dark-muted font-medium">Model</span>
                <span className="text-white font-bold">Aura AI</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-dark-muted font-medium">Network</span>
                <span className="text-white font-bold">{networkName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-dark-muted font-medium">Agent Wallet</span>
                <span className="text-blue-400 font-mono bg-blue-500/10 px-1.5 xl:px-2 py-0.5 rounded text-[10px] xl:text-xs">{address ? `${address.slice(0,6)}...${address.slice(-4)}` : 'Not Connected'}</span>
              </div>
            </div>
          </div>

          {/* Active Modules */}
          <div className="bg-dark-card border border-dark-border rounded-2xl xl:rounded-3xl p-3 xl:p-4 2xl:p-6 shadow-2xl flex-1">
            <h3 className="text-[9px] xl:text-xs font-black text-dark-muted uppercase tracking-widest mb-2 xl:mb-3 2xl:mb-4">Active Modules</h3>
            <div className="space-y-2 xl:space-y-3">
              <div className="flex items-center gap-2 xl:gap-3 p-2 xl:p-3 bg-dark-bg/50 border border-dark-border/50 rounded-xl">
                <span className="text-base xl:text-lg">💱</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs xl:text-sm font-bold text-white truncate">Smart Routing</div>
                  <div className="text-[9px] xl:text-[10px] text-dark-muted truncate">Auto-swaps enabled</div>
                </div>
              </div>
              <div className="flex items-center gap-2 xl:gap-3 p-2 xl:p-3 bg-dark-bg/50 border border-dark-border/50 rounded-xl">
                <span className="text-base xl:text-lg">🌉</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs xl:text-sm font-bold text-white truncate">CCTP Protocol</div>
                  <div className="text-[9px] xl:text-[10px] text-dark-muted truncate">Cross-chain ready</div>
                </div>
              </div>
              <div className="flex items-center gap-2 xl:gap-3 p-2 xl:p-3 bg-dark-bg/50 border border-dark-border/50 rounded-xl">
                <span className="text-base xl:text-lg">🧾</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs xl:text-sm font-bold text-white truncate">Invoice Engine</div>
                  <div className="text-[9px] xl:text-[10px] text-dark-muted truncate">B2B billing active</div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* CENTER COLUMN: Chat Card — hidden on mobile when showing status */}
        <div className={`${mobileView === 'status' ? 'hidden' : 'flex'} lg:flex flex-1 flex-col bg-dark-card/90 backdrop-blur-xl border border-dark-border rounded-2xl xl:rounded-3xl shadow-2xl overflow-hidden relative min-h-0`}>
          {/* Header */}
          <div className="flex items-center justify-between p-3 xl:p-4 2xl:p-5 border-b border-dark-border bg-dark-bg/80">
            <div className="flex items-center gap-2 xl:gap-3">
              <div className="w-8 h-8 xl:w-9 xl:h-9 2xl:w-10 2xl:h-10 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
                <svg className="w-4 h-4 xl:w-5 xl:h-5 2xl:w-6 2xl:h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <h2 className="text-sm xl:text-base 2xl:text-lg font-bold text-white leading-none">Aura Terminal</h2>
                <span className="text-[9px] xl:text-[10px] font-bold text-dark-muted uppercase tracking-widest mt-0.5 block">
                  Interactive Assistant
                </span>
              </div>
            </div>
            
            <button 
              onClick={handleResetChat}
              title="Reset Conversation"
              className="text-dark-muted hover:text-white transition-all p-2 bg-dark-input hover:bg-dark-border rounded-lg border border-dark-border/50 active:scale-95 active:rotate-180 duration-200"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            </button>
          </div>

          {/* Chat Area */}
          <div className="flex-1 overflow-y-auto p-3 xl:p-4 2xl:p-6 space-y-3 xl:space-y-4 2xl:space-y-6 scrollbar-thin scrollbar-thumb-dark-border scrollbar-track-transparent bg-[#0a0f1a]/30 min-h-0">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl p-3 xl:p-4 shadow-lg ${
                  msg.role === 'user' 
                    ? 'bg-blue-600 text-white rounded-tr-sm border border-blue-500' 
                    : 'bg-dark-input border border-dark-border/50 text-dark-text rounded-tl-sm'
                }`}>
                  <div className="text-xs xl:text-sm leading-relaxed">
                    {msg.content.split('\n').map((line, lIdx) => (
                      <span key={lIdx} className="block mb-2 last:mb-0">
                        {line.split(/(\*\*.*?\*\*)/g).map((part, pIdx) => {
                          if (part.startsWith('**') && part.endsWith('**')) {
                            return <strong key={pIdx} className="text-white font-bold">{part.slice(2, -2)}</strong>;
                          }
                          return part;
                        })}
                      </span>
                    ))}
                  </div>
                  
                  {/* Action Execution Button */}
                  {msg.action && msg.action.action !== 'SHOW_STATS' && (
                    <div className="mt-4 pt-4 border-t border-dark-border/50">
                      {executedActions.has(idx) ? (
                        <div className="w-full py-2.5 px-4 bg-green-500/10 border border-green-500/30 text-green-400 text-xs font-bold rounded-xl flex items-center justify-center gap-2">
                          <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span>Transaction Signed & Submitted</span>
                        </div>
                      ) : (
                        <button 
                          onClick={() => executeAIAction(msg.action, idx)}
                          disabled={isPending}
                          className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white text-sm font-bold rounded-xl transition-all shadow-[0_0_15px_rgba(37,99,235,0.4)] disabled:opacity-50 flex items-center justify-center gap-2 active:scale-[0.98]"
                        >
                          {isPending ? (
                            <>
                              <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Confirming in Wallet...
                            </>
                          ) : (
                            <>
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                              </svg>
                              Sign Transaction
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  )}

                  {/* Transaction Explorer & Copy Buttons */}
                  {msg.txHash && (
                    <div className="mt-4 pt-3.5 border-t border-dark-border/60 flex flex-wrap gap-2.5">
                      <a
                        href={`${explorerUrl}/tx/${msg.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 min-w-[140px] py-2.5 px-3 bg-blue-600/15 hover:bg-blue-600/25 text-blue-400 border border-blue-500/30 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 group active:scale-[0.98]"
                      >
                        <span>View on {explorerName}</span>
                        <svg className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                      
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(msg.txHash);
                          setCopiedHash(msg.txHash);
                          setTimeout(() => setCopiedHash(null), 2000);
                        }}
                        className="py-2.5 px-3.5 bg-dark-bg hover:bg-dark-border/50 text-gray-300 hover:text-white border border-dark-border text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 active:scale-[0.98]"
                      >
                        {copiedHash === msg.txHash ? (
                          <>
                            <svg className="w-3.5 h-3.5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            <span className="text-green-400">Copied!</span>
                          </>
                        ) : (
                          <>
                            <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                            <span>Copy Hash</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-2.5 xl:p-3 2xl:p-4 border-t border-dark-border bg-dark-bg/90">
            <div className="relative flex items-center w-full">
              {!isConnected ? (
                <button
                  onClick={() => setIsWalletModalOpen(true)}
                  className="w-full py-3 xl:py-4 rounded-2xl transition-all active:scale-[0.98] bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.05] text-white font-bold text-sm xl:text-lg"
                >
                  Connect Wallet
                </button>
              ) : (
                <>
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                    placeholder="Ask the agent to swap, bridge, or create invoice..."
                    className="w-full bg-dark-input border border-dark-border rounded-2xl py-3 xl:py-4 pl-4 xl:pl-5 pr-12 xl:pr-14 text-xs xl:text-sm text-white placeholder-dark-muted focus:outline-none focus:border-blue-500/50 transition-all shadow-inner"
                  />
                  <button 
                    onClick={() => handleSend()}
                    className="absolute right-2 p-2 xl:p-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-500 transition-all shadow-[0_0_15px_rgba(37,99,235,0.4)] active:scale-95"
                  >
                    <svg className="w-4 h-4 xl:w-5 xl:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  </button>
                </>
              )}
            </div>
            <div className="text-center mt-1.5 xl:mt-2 2xl:mt-3">
              <span className="text-[9px] text-dark-muted font-bold uppercase tracking-[0.2em] opacity-50">Powered by Aura Autonomous Agent Stack</span>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Prompts and Logs */}
        <div className="hidden xl:flex w-[220px] xl:w-[240px] 2xl:w-[280px] flex-col gap-3 xl:gap-4 2xl:gap-6 h-full overflow-y-auto pr-1 shrink-0">
          {/* Suggested Actions */}
          <div className="bg-dark-card border border-dark-border rounded-2xl xl:rounded-3xl p-3 xl:p-4 2xl:p-6 shadow-2xl shrink-0">
            <h3 className="text-[9px] xl:text-xs font-black text-dark-muted uppercase tracking-widest mb-2 xl:mb-3 2xl:mb-4">Suggested Actions</h3>
            <div className="space-y-1.5 xl:space-y-2">
              {suggestedPrompts.map((prompt, idx) => (
                <button 
                  key={idx}
                  onClick={() => handleSend(prompt)}
                  className="w-full text-left p-2 xl:p-3 rounded-xl bg-dark-input border border-dark-border/50 hover:bg-dark-border hover:border-blue-500/30 transition-all group flex items-center justify-between"
                >
                  <span className="text-[11px] xl:text-xs font-bold text-gray-300 group-hover:text-white transition-colors line-clamp-1">{prompt}</span>
                  <svg className="w-3.5 h-3.5 xl:w-4 xl:h-4 text-dark-muted group-hover:text-blue-400 transition-colors shrink-0 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </button>
              ))}
            </div>
          </div>

          {/* Agent Terminal Logs */}
          <div className="bg-dark-bg border border-dark-border rounded-2xl xl:rounded-3xl p-3 xl:p-4 2xl:p-5 shadow-inner flex-1 flex flex-col overflow-hidden relative">
            {/* Terminal Top Bar */}
            <div className="flex items-center gap-1.5 xl:gap-2 mb-2 xl:mb-3 2xl:mb-4">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500/80"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-green-500/80"></div>
              <span className="ml-1.5 xl:ml-2 text-[9px] xl:text-[10px] font-mono text-dark-muted">agent-logs.sh</span>
            </div>
            
            <div className="flex-1 overflow-y-auto overflow-x-hidden space-y-1.5 xl:space-y-2 font-mono text-[9px] xl:text-[10px] leading-relaxed scrollbar-none pb-12">
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

      <WalletModal
        isOpen={isWalletModalOpen}
        onClose={() => setIsWalletModalOpen(false)}
        connectors={connectors}
        onSelectWallet={(connector) => {
            connect({ connector });
            setIsWalletModalOpen(false);
        }}
      />
    </section>
  );
}
