import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAccount, useConnect, useBalance } from 'wagmi';
import confetti from 'canvas-confetti';
import { useActiveArcChain } from '../hooks/useActiveArcChain';
import { arcMainnet, arcTestnet } from '../config/wagmi';
import WalletModal from '../components/ui/WalletModal';
import SwapModal from '../components/ui/SwapModal';
import BridgeModal from '../components/ui/BridgeModal';
import { getTokenBySymbol } from '../config/tokens';
import { getChainById, getAllChains } from '../config/chains';
import { toRaw } from '../utils/chainUtils';
import { fetchUniswapArcQuote } from '../utils/uniswapArc';
import { motion, AnimatePresence } from 'framer-motion';

export default function ArcAIPage() {
  const navigate = useNavigate();
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { chainId, isMainnet, isTestnet, networkName, explorerUrl, explorerName } = useActiveArcChain();

  const { data: balanceData, refetch: refetchBalance } = useBalance({
    address,
    chainId,
  });
  const currentUsdcBalance = balanceData ? Number(balanceData.formatted) : 0;

  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [isSwapModalOpen, setIsSwapModalOpen] = useState(false);
  const [swapModalData, setSwapModalData] = useState(null);
  const [isBridgeModalOpen, setIsBridgeModalOpen] = useState(false);
  const [bridgeModalData, setBridgeModalData] = useState(null);
  const [copiedHash, setCopiedHash] = useState(null);
  const [executedActions, setExecutedActions] = useState(new Set());
  const [mobileView, setMobileView] = useState('chat'); // 'chat' | 'status'

  // Notebook / Compact Screen Detection (strictly false on desktop monitors)
  const [isNotebook, setIsNotebook] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 1280 || (window.innerHeight < 700 && window.innerWidth < 1440);
  });

  useEffect(() => {
    const checkNotebook = () => {
      if (typeof window === 'undefined') return;
      setIsNotebook(window.innerWidth < 1280 || (window.innerHeight < 700 && window.innerWidth < 1440));
    };
    checkNotebook();
    window.addEventListener('resize', checkNotebook);
    return () => window.removeEventListener('resize', checkNotebook);
  }, []);
  const [activeEngine, setActiveEngine] = useState('Aura Copilot');
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Welcome to Aura Terminal! ⚡ I can prepare cross-chain swaps, bridge tokens across networks via CCTP, or generate instant B2B on-chain invoices. How can I assist you today?' }
  ]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);
  const logsEndRef = useRef(null);
  const [logs, setLogs] = useState([
    "[SYSTEM] Initializing Aura Agent Stack...",
    `[SYSTEM] Connected to ${networkName}.`,
    "[AGENT] Model: Aura Core Engine.",
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
      refetchBalance?.();
    }
  }, [chainId, networkName, refetchBalance]);

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
      "[AGENT] Model: Aura Core Engine.",
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
          body: JSON.stringify({ 
            messages: newMessages, 
            userAddress: address,
            networkName,
            chainId,
            usdcBalance: currentUsdcBalance
          })
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
          body: JSON.stringify({ 
            messages: newMessages, 
            userAddress: address,
            networkName,
            chainId,
            usdcBalance: currentUsdcBalance
          })
        });
        if (prodRes.ok) {
          data = await prodRes.json();
        }
      }

      if (data && data.message) {
        setActiveEngine('Aura Copilot');

        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: data.message.content, 
          action: data.action || null 
        }]);
        
        if (data.action) {
           addLog(`[AGENT] Prepared action: ${data.action.action}`);
        } else {
           addLog(`[AGENT] Response via Aura Core Engine.`);
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

  const handleSwapSuccess = (swapResult) => {
    try {
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    } catch (_) {}

    const hash = swapResult?.hash;
    const fromSymbol = swapResult?.tokenIn?.symbol || swapModalData?.tokenIn?.symbol || 'USDC';
    const toSymbol = swapResult?.tokenOut?.symbol || swapModalData?.tokenOut?.symbol || 'EURC';
    const amtIn = swapResult?.amountIn || swapModalData?.amountIn;
    const amtOut = swapResult?.amountOut || swapModalData?.amountOut;

    addLog(`[AGENT] Swap completed on-chain! ${hash ? `Tx: ${hash.slice(0, 10)}...${hash.slice(-8)}` : 'Confirmed'}`);
    addLog(`[SYSTEM] Balances updated.`);
    refetchBalance?.();

    if (hash) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `🎉 **Swap Executed Successfully!**\n\nSwapped **${amtIn} ${fromSymbol}** for **${amtOut ? `~${amtOut} ` : ''}${toSymbol}** directly on ${networkName}.`,
        txHash: hash
      }]);
    }
  };

  const handleBridgeSuccess = (bridgeResult) => {
    try {
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    } catch (_) {}

    const burnHash = bridgeResult?.burnTxHash || bridgeResult?.receiveTxHash;
    const amt = bridgeResult?.amount || bridgeModalData?.amount;
    const destName = bridgeResult?.toChain?.name || bridgeModalData?.toChain?.name || 'Destination Chain';

    addLog(`[AGENT] CCTP Bridge initiated & verified! ${burnHash ? `Tx: ${burnHash.slice(0, 10)}...${burnHash.slice(-8)}` : ''}`);
    addLog(`[SYSTEM] Cross-chain burn verified by Circle.`);
    refetchBalance?.();

    if (burnHash) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `🌉 **Cross-Chain Bridge Completed!**\n\nBridged **${amt} USDC** from ${networkName} to **${destName}** via Circle CCTP.`,
        txHash: burnHash
      }]);
    } else {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `🌉 **Cross-Chain Bridge Completed!**\n\nBridged **${amt} USDC** from ${networkName} to **${destName}** via Circle CCTP.`
      }]);
    }
  };

  const executeAIAction = async (actionDetails, msgIdx) => {
    if (!isConnected || !address) {
      setIsWalletModalOpen(true);
      return;
    }
    
    if (!actionDetails) return;

    if (actionDetails.action === 'UI_PREPARE_SWAP') {
      const { amount, from, to } = actionDetails.payload || {};
      const swapAmount = Number(amount || 0);

      // Strict balance check for USDC
      if ((!from || from.toUpperCase() === 'USDC') && swapAmount > currentUsdcBalance) {
        addLog(`[SECURITY] Blocked swap: Insufficient balance (${currentUsdcBalance.toFixed(4)} < ${swapAmount} USDC)`);
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `⚠️ **Insufficient Balance:** Your wallet currently has **${currentUsdcBalance.toFixed(4)} USDC**, which is insufficient to swap **${swapAmount} USDC**. Please top up your wallet or enter a lower amount.`
        }]);
        return;
      }

      let tIn = getTokenBySymbol(from || 'USDC', chainId);
      let tOut = getTokenBySymbol(to || 'EURC', chainId);

      if (!tIn || !tOut) {
        const invalidSym = (!tIn ? from : to) || 'Token';
        const validList = isMainnet ? 'USDC, EURC, cirBTC' : 'USDC, EURC, USDT, cirBTC';
        addLog(`[SECURITY] Blocked swap: ${invalidSym} does not exist on ${networkName}`);
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `⚠️ **Token Not Available on ${networkName}:** The token **${invalidSym}** does not exist on **${networkName}** yet.\n\n• Supported tokens for swap on ${networkName}: **${validList}**.`
        }]);
        return;
      }

      if (tIn.symbol.toUpperCase() === tOut.symbol.toUpperCase()) {
        const fallbackOut = isMainnet ? 'EURC' : 'USDT';
        tOut = getTokenBySymbol(fallbackOut, chainId);
      }

      const rawIn = toRaw(amount, tIn.decimals);

      addLog(`[AGENT] Initiating direct swap: ${amount} ${tIn.symbol} -> ${tOut.symbol}...`);

      let quote = null;
      let calculatedOut = '';

      if (isMainnet) {
        try {
          quote = await fetchUniswapArcQuote({
            tokenIn: tIn,
            tokenOut: tOut,
            amountInRaw: rawIn,
            slippage: 0.5
          });
          if (quote?.amountOutFormatted) {
            calculatedOut = quote.amountOutFormatted;
          }
        } catch (qErr) {
          console.warn('[ArcAIPage] Quote fetch error:', qErr);
        }
      }

      setSwapModalData({
        tokenIn: tIn,
        tokenOut: tOut,
        amountIn: String(amount),
        amountOut: calculatedOut,
        rawAmountIn: rawIn,
        quote,
        slippage: '0.5'
      });
      setIsSwapModalOpen(true);
      return;
    }

    if (actionDetails.action === 'UI_PREPARE_BRIDGE') {
      const { amount, destination } = actionDetails.payload || {};
      const bridgeAmount = Number(amount || 0);

      if (bridgeAmount > currentUsdcBalance) {
        addLog(`[SECURITY] Blocked bridge: Insufficient balance (${currentUsdcBalance.toFixed(4)} < ${bridgeAmount} USDC)`);
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `⚠️ **Insufficient Balance:** Your wallet currently has **${currentUsdcBalance.toFixed(4)} USDC**, which is insufficient to bridge **${bridgeAmount} USDC**.`
        }]);
        return;
      }

      const arcChain = getChainById(chainId);
      
      const allChains = getAllChains();
      const rawDest = (destination || '').trim();
      const cleanDest = rawDest
        .toLowerCase()
        .replace(/\b(network|mainnet|sepolia|chain|pos|l1|l2)\b/g, '')
        .trim();

      let matchedChain = allChains.find(c => {
        if (c.isTestnet !== isTestnet || c.id === chainId) return false;
        const cName = c.name.toLowerCase();
        const cKey = c.key.toLowerCase();
        return (
          cName === rawDest.toLowerCase() ||
          cName === cleanDest ||
          cName.includes(cleanDest) ||
          cleanDest.includes(cName) ||
          cKey.includes(cleanDest)
        );
      });

      if (!matchedChain) {
        matchedChain = allChains.find(c => c.isTestnet === isTestnet && c.id !== chainId);
      }

      const bridgeToken = getTokenBySymbol('USDC', chainId);

      addLog(`[AGENT] Initiating CCTP bridge: ${amount} USDC -> ${matchedChain?.name || destination}...`);

      setBridgeModalData({
        amount: String(amount),
        fromChain: arcChain,
        toChain: matchedChain,
        token: bridgeToken
      });
      setIsBridgeModalOpen(true);
      return;
    }

    if (actionDetails.action === 'UI_GENERATE_INVOICE') {
      const { amount, clientName, description } = actionDetails.payload || {};
      addLog(`[USER] Redirecting to Invoice creation for ${clientName}`);
      navigate(`/invoice?amount=${encodeURIComponent(amount || '')}&client=${encodeURIComponent(clientName || '')}&desc=${encodeURIComponent(description || '')}`);
      return;
    }
  };

  const suggestedPrompts = [
    "I want to swap",
    "I want to make a bridge",
    "I need to create an invoice"
  ];

  return (
    <section className={`flex-1 flex flex-col overflow-hidden min-h-0 w-full ${
      isNotebook 
        ? 'pt-0.5 sm:pt-1 pb-1 sm:pb-1.5 px-2 sm:px-3 max-w-[1400px] mx-auto' 
        : 'py-4 md:py-6 px-4 md:px-6 max-w-7xl mx-auto'
    }`}>
      
      {/* Mobile Tab Bar — visible only on phones/small screens */}
      <div className={`${isNotebook ? 'hidden' : 'flex lg:hidden'} mb-2 rounded-xl overflow-hidden border border-dark-border bg-dark-card shrink-0`}>
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
      <div className={`flex-1 min-h-0 flex ${
        isNotebook ? 'gap-2' : 'gap-6'
      } items-stretch overflow-hidden h-full`}>
        
        {/* LEFT COLUMN: Agent Status — hidden on mobile unless mobileView=status, always visible on notebook & desktop */}
        <div className={`${
          isNotebook 
            ? 'flex w-[190px] xl:w-[215px] gap-2' 
            : `${mobileView === 'status' ? 'flex' : 'hidden'} lg:flex w-[280px] gap-6`
        } flex-col h-full overflow-y-auto scrollbar-none pr-0.5 shrink-0`}>
          {/* Agent Identity Card */}
          <div className={`bg-dark-card border border-dark-border ${
            isNotebook ? 'rounded-xl p-2.5' : 'rounded-3xl p-6'
          } shadow-2xl flex flex-col items-center text-center shrink-0`}>
            <div className={`${
              isNotebook ? 'w-10 h-10 mb-1.5' : 'w-20 h-20 mb-4 p-1'
            } rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center shadow-[0_0_30px_rgba(37,99,235,0.3)]`}>
              <div className="w-full h-full bg-dark-bg rounded-full flex items-center justify-center">
                <svg className={`${isNotebook ? 'w-5 h-5' : 'w-10 h-10'} text-blue-500`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
            </div>
            <h2 className={`${isNotebook ? 'text-xs sm:text-sm' : 'text-xl'} font-bold text-white tracking-tight`}>Aura AI</h2>
            <div className={`flex items-center gap-1.5 ${isNotebook ? 'mt-1 px-2 py-0.5' : 'mt-2 px-3 py-1.5'} bg-green-500/10 rounded-full border border-green-500/20`}>
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
              <span className={`${isNotebook ? 'text-[8px]' : 'text-[10px]'} font-black text-green-400 uppercase tracking-widest`}>Agent Online</span>
            </div>
            
            <div className={`w-full h-px bg-dark-border/50 ${isNotebook ? 'my-2' : 'my-6'}`}></div>
            
            <div className={`w-full text-left ${isNotebook ? 'space-y-1.5 text-[11px]' : 'space-y-3 text-sm'}`}>
              <div className="flex justify-between items-center">
                <span className="text-dark-muted font-medium">Model</span>
                <span className="text-white font-bold">{activeEngine}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-dark-muted font-medium">Network</span>
                <span className="text-white font-bold">{networkName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-dark-muted font-medium">Agent Wallet</span>
                <span className={`text-blue-400 font-mono bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20 ${isNotebook ? 'text-[9px]' : 'text-xs'}`}>
                  {address ? `${address.slice(0,6)}...${address.slice(-4)}` : '0x0000...0000'}
                </span>
              </div>
            </div>
          </div>

          {/* Active Modules */}
          <div className={`bg-dark-card border border-dark-border ${
            isNotebook ? 'rounded-xl p-2.5 flex-1 min-h-0 flex flex-col justify-between' : 'rounded-3xl p-6 flex-1 flex flex-col justify-between'
          } shadow-2xl shrink-0`}>
            <h3 className={`${isNotebook ? 'text-[8px] mb-1.5' : 'text-xs mb-4'} font-black text-dark-muted uppercase tracking-widest`}>Active Modules</h3>
            <div className={`${isNotebook ? 'space-y-1.5 flex-1 flex flex-col justify-around' : 'space-y-3'}`}>
              <div className={`flex items-center ${isNotebook ? 'gap-2 p-1.5 rounded-xl' : 'gap-3 p-3 rounded-2xl'} bg-dark-input border border-dark-border/40`}>
                <div className={`${isNotebook ? 'w-6 h-6' : 'w-8 h-8 rounded-xl'} bg-blue-500/10 flex items-center justify-center text-blue-400 shrink-0`}>
                  <svg className={`${isNotebook ? 'w-3.5 h-3.5' : 'w-4 h-4'} animate-[spin_4s_linear_infinite]`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`${isNotebook ? 'text-[11px]' : 'text-xs'} font-bold text-white truncate`}>Smart Routing</div>
                  <div className={`${isNotebook ? 'text-[8px]' : 'text-[10px]'} text-dark-muted truncate`}>Auto-swaps enabled</div>
                </div>
              </div>
              <div className={`flex items-center ${isNotebook ? 'gap-2 p-1.5 rounded-xl' : 'gap-3 p-3 rounded-2xl'} bg-dark-input border border-dark-border/40`}>
                <div className={`${isNotebook ? 'w-6 h-6' : 'w-8 h-8 rounded-xl'} bg-purple-500/10 flex items-center justify-center text-purple-400 shrink-0`}>
                  <svg className={`${isNotebook ? 'w-3.5 h-3.5' : 'w-4 h-4'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`${isNotebook ? 'text-[11px]' : 'text-xs'} font-bold text-white truncate`}>CCTP Protocol</div>
                  <div className={`${isNotebook ? 'text-[8px]' : 'text-[10px]'} text-dark-muted truncate`}>Cross-chain ready</div>
                </div>
              </div>
              <div className={`flex items-center ${isNotebook ? 'gap-2 p-1.5 rounded-xl' : 'gap-3 p-3 rounded-2xl'} bg-dark-input border border-dark-border/40`}>
                <div className={`${isNotebook ? 'w-6 h-6' : 'w-8 h-8 rounded-xl'} bg-emerald-500/10 flex items-center justify-center text-emerald-400 shrink-0`}>
                  <svg className={`${isNotebook ? 'w-3.5 h-3.5' : 'w-4 h-4'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`${isNotebook ? 'text-[11px]' : 'text-xs'} font-bold text-white truncate`}>Invoice Engine</div>
                  <div className={`${isNotebook ? 'text-[8px]' : 'text-[10px]'} text-dark-muted truncate`}>B2B billing active</div>
                </div>
              </div>
            </div>
            <div className={`mt-4 pt-3 border-t border-dark-border/50 ${isNotebook ? 'text-[8px]' : 'text-[10px]'} text-center text-dark-muted`}>
              Auto-Pilot v2.4 Active
            </div>
          </div>
        </div>
        
        {/* CENTER COLUMN: Chat Card — hidden on mobile when showing status */}
        <div className={`${
          isNotebook 
            ? 'flex flex-1 rounded-xl' 
            : `${mobileView === 'status' ? 'hidden' : 'flex'} lg:flex flex-1 rounded-3xl`
        } flex-col bg-dark-card border border-dark-border shadow-2xl overflow-hidden relative min-h-0 h-full`}>
          {/* Header */}
          <div className={`flex items-center justify-between ${
            isNotebook ? 'p-2 sm:p-2.5' : 'p-5'
          } border-b border-dark-border shrink-0`}>
            <div className="flex items-center gap-3">
              <div className={`${
                isNotebook ? 'w-7 h-7' : 'w-10 h-10'
              } rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/20`}>
                <svg className={`${isNotebook ? 'w-3.5 h-3.5' : 'w-5 h-5'} text-white`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <h2 className={`${isNotebook ? 'text-xs sm:text-sm' : 'text-lg'} font-bold text-white leading-none`}>Aura Terminal</h2>
                <span className={`${isNotebook ? 'text-[8px]' : 'text-xs'} font-bold text-dark-muted uppercase tracking-widest mt-0.5 block`}>
                  Interactive Assistant
                </span>
              </div>
            </div>
            
            <button 
              onClick={handleResetChat}
              title="Reset Conversation"
              className={`text-dark-muted hover:text-white transition-all ${
                isNotebook ? 'p-1.5' : 'p-2.5'
              } bg-dark-input hover:bg-dark-border rounded-xl border border-dark-border/50 active:scale-95 duration-200`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            </button>
          </div>

          {/* Chat Area */}
          <div className={`flex-1 overflow-y-auto ${
            isNotebook ? 'p-2.5 sm:p-3 space-y-2' : 'p-6 space-y-4'
          } scrollbar-thin scrollbar-thumb-dark-border scrollbar-track-transparent min-h-0`}>
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl ${
                  isNotebook ? 'p-2.5 sm:p-3' : 'p-4'
                } shadow-lg ${
                  msg.role === 'user' 
                    ? 'bg-blue-600 text-white rounded-tr-sm border border-blue-500' 
                    : 'bg-dark-input border border-dark-border/50 text-dark-text rounded-tl-sm'
                }`}>
                  <div className={`${isNotebook ? 'text-xs' : 'text-sm'} leading-relaxed`}>
                    {msg.content.split('\n').map((line, lIdx) => (
                      <span key={lIdx} className="block mb-1.5 last:mb-0">
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
                    <div className={`${isNotebook ? 'mt-2.5 pt-2.5' : 'mt-4 pt-4'} border-t border-dark-border/50`}>
                      {(() => {
                        const isInsufficient = (msg.action.action === 'UI_PREPARE_SWAP' || msg.action.action === 'UI_PREPARE_BRIDGE') && 
                          Number(msg.action.payload?.amount || 0) > currentUsdcBalance;

                        if (isInsufficient) {
                          return (
                            <div className={`w-full ${isNotebook ? 'py-1.5 px-3 text-[11px]' : 'py-2.5 px-4 text-xs'} bg-red-500/10 border border-red-500/30 text-red-400 font-bold rounded-xl flex items-center justify-center gap-2`}>
                              <svg className="w-4 h-4 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                              </svg>
                              <span>Insufficient Balance ({(currentUsdcBalance >= 0.01 ? (Math.floor(currentUsdcBalance * 100) / 100).toFixed(2) : currentUsdcBalance.toFixed(4))} USDC)</span>
                            </div>
                          );
                        }

                        let buttonLabel = 'Confirm & Execute ➔';
                        if (msg.action.action === 'UI_PREPARE_SWAP') {
                          buttonLabel = `Confirm & Swap (${msg.action.payload?.amount} ${msg.action.payload?.from || 'USDC'}) ➔`;
                        } else if (msg.action.action === 'UI_PREPARE_BRIDGE') {
                          buttonLabel = `Confirm & Bridge (${msg.action.payload?.amount} USDC) ➔`;
                        } else if (msg.action.action === 'UI_GENERATE_INVOICE') {
                          buttonLabel = `Open Invoice Generator ➔`;
                        }

                        return (
                          <button
                            onClick={() => executeAIAction(msg.action, idx)}
                            className={`w-full ${
                              isNotebook ? 'py-2 text-xs' : 'py-2.5 text-sm'
                            } bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold rounded-xl transition-all shadow-[0_0_15px_rgba(37,99,235,0.4)] flex items-center justify-center gap-2 active:scale-[0.98]`}
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            <span>{buttonLabel}</span>
                          </button>
                        );
                      })()}
                    </div>
                  )}

                  {/* Transaction Explorer & Copy Buttons */}
                  {msg.txHash && (
                    <div className={`${isNotebook ? 'mt-2.5 pt-2.5 gap-2' : 'mt-4 pt-3.5 gap-2.5'} border-t border-dark-border/60 flex flex-wrap`}>
                      <a
                        href={`${explorerUrl}/tx/${msg.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`flex-1 min-w-[130px] ${
                          isNotebook ? 'py-1.5 px-2.5 text-[11px]' : 'py-2.5 px-3 text-xs'
                        } bg-blue-600/15 hover:bg-blue-600/25 text-blue-400 border border-blue-500/30 font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 group active:scale-[0.98]`}
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
                        className={`${
                          isNotebook ? 'py-1.5 px-2.5 text-[11px]' : 'py-2.5 px-3.5 text-xs'
                        } bg-dark-bg hover:bg-dark-border/50 text-gray-300 hover:text-white border border-dark-border font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 active:scale-[0.98]`}
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
          <div className={`${isNotebook ? 'p-2 sm:p-2.5' : 'p-4'} border-t border-dark-border bg-dark-bg/90 shrink-0`}>
            <div className="relative flex items-center w-full">
              {!isConnected ? (
                <button
                  onClick={() => setIsWalletModalOpen(true)}
                  className={`w-full ${
                    isNotebook ? 'py-2 sm:py-2.5 text-xs sm:text-sm rounded-xl' : 'py-4 rounded-2xl text-lg'
                  } transition-all active:scale-[0.98] bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.05] text-white font-bold`}
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
                    className={`w-full bg-dark-input border border-dark-border ${
                      isNotebook ? 'rounded-xl py-2 sm:py-2.5 pl-3 pr-10 text-xs' : 'rounded-2xl py-4 pl-5 pr-14 text-sm'
                    } text-white placeholder-dark-muted focus:outline-none focus:border-blue-500/50 transition-all shadow-inner`}
                  />
                  <button 
                    onClick={() => handleSend()}
                    className={`absolute ${
                      isNotebook ? 'right-1.5 p-1.5' : 'right-2 p-2.5'
                    } bg-blue-600 text-white rounded-xl hover:bg-blue-500 transition-all shadow-[0_0_15px_rgba(37,99,235,0.4)] active:scale-95`}
                  >
                    <svg className={`${isNotebook ? 'w-3.5 h-3.5' : 'w-5 h-5'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  </button>
                </>
              )}
            </div>
            <div className={`text-center ${isNotebook ? 'mt-1' : 'mt-3'}`}>
              <span className="text-[9px] text-dark-muted font-bold uppercase tracking-[0.2em] opacity-50">
                Powered by Aura Autonomous Agent Stack
              </span>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Prompts and Logs */}
        <div className={`${
          isNotebook 
            ? 'flex w-[195px] xl:w-[220px] gap-2 overflow-hidden' 
            : 'hidden xl:flex w-[300px] gap-6 overflow-y-auto pr-1'
        } flex-col h-full shrink-0`}>
          {/* Suggested Actions */}
          <div className={`bg-dark-card border border-dark-border ${
            isNotebook ? 'rounded-xl p-2.5' : 'rounded-3xl p-6'
          } shadow-2xl shrink-0`}>
            <h3 className={`${isNotebook ? 'text-[8px] mb-1.5' : 'text-xs mb-4'} font-black text-dark-muted uppercase tracking-widest`}>Suggested Actions</h3>
            <div className={`${isNotebook ? 'space-y-1' : 'space-y-2'}`}>
              {suggestedPrompts.map((prompt, idx) => (
                <button 
                  key={idx}
                  onClick={() => handleSend(prompt)}
                  className={`w-full text-left ${
                    isNotebook ? 'p-1.5 rounded-lg' : 'p-3 rounded-xl'
                  } bg-dark-input border border-dark-border/50 hover:bg-dark-border hover:border-blue-500/30 transition-all group flex items-center justify-between`}
                >
                  <span className={`${isNotebook ? 'text-[10px]' : 'text-xs'} font-bold text-gray-300 group-hover:text-white transition-colors line-clamp-1`}>{prompt}</span>
                  <svg className={`${isNotebook ? 'w-3 h-3' : 'w-4 h-4'} text-dark-muted group-hover:text-blue-400 transition-colors shrink-0 ml-1`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </button>
              ))}
            </div>
          </div>

          {/* Agent Terminal Logs */}
          <div className={`bg-dark-bg border border-dark-border ${
            isNotebook ? 'rounded-xl p-2.5' : 'rounded-3xl p-5'
          } shadow-inner flex-1 min-h-0 flex flex-col overflow-hidden relative`}>
            {/* Terminal Top Bar */}
            <div className={`flex items-center gap-2 ${isNotebook ? 'mb-1.5' : 'mb-4'} shrink-0`}>
              <div className={`${isNotebook ? 'w-2 h-2' : 'w-2.5 h-2.5'} rounded-full bg-red-500/80`}></div>
              <div className={`${isNotebook ? 'w-2 h-2' : 'w-2.5 h-2.5'} rounded-full bg-yellow-500/80`}></div>
              <div className={`${isNotebook ? 'w-2 h-2' : 'w-2.5 h-2.5'} rounded-full bg-green-500/80`}></div>
              <span className={`ml-2 text-[10px] font-mono text-dark-muted`}>agent-logs.sh</span>
            </div>
            
            <div className={`flex-1 min-h-0 overflow-y-auto overflow-x-hidden ${
              isNotebook ? 'space-y-1 text-[8px] sm:text-[9px] pb-6' : 'space-y-2 text-[10px] pb-12'
            } font-mono leading-relaxed scrollbar-none`}>
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
            <div className={`absolute bottom-0 left-0 w-full ${isNotebook ? 'h-6' : 'h-12'} bg-gradient-to-t from-dark-bg to-transparent pointer-events-none`}></div>
          </div>
        </div>

      </div>

      {swapModalData && (
        <SwapModal
          isOpen={isSwapModalOpen}
          onClose={() => {
            setIsSwapModalOpen(false);
            refetchBalance?.();
          }}
          tokenIn={swapModalData.tokenIn}
          tokenOut={swapModalData.tokenOut}
          amountIn={swapModalData.amountIn}
          amountOut={swapModalData.amountOut}
          rawAmountIn={swapModalData.rawAmountIn}
          userAddress={address}
          slippage={swapModalData.slippage || '0.5'}
          quote={swapModalData.quote}
          selectedDEX={isMainnet ? 'uniswap' : 'synthra'}
          onComplete={handleSwapSuccess}
        />
      )}

      {bridgeModalData && (
        <BridgeModal
          isOpen={isBridgeModalOpen}
          onClose={() => {
            setIsBridgeModalOpen(false);
            refetchBalance?.();
          }}
          amount={bridgeModalData.amount}
          fromChain={bridgeModalData.fromChain}
          toChain={bridgeModalData.toChain}
          token={bridgeModalData.token}
          userAddress={address}
          receiverAddress={address}
          onComplete={handleBridgeSuccess}
        />
      )}

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
