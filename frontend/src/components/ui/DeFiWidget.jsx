import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAccount, useBalance, useChainId, useConnect } from 'wagmi';
import { getTokenBySymbol } from '../../config/tokens';
import { getChainById } from '../../config/chains';
import TokenSelectorModal from './TokenSelectorModal';
import NetworkTokenModal from './NetworkTokenModal';
import BridgeModal from './BridgeModal';
import SwapModal from './SwapModal';
import TradeHistoryModal from './TradeHistoryModal';
import WalletModal from './WalletModal';

// ── Config ────────────────────────────────────────────────────────────────────
const SYNTHRA_API  = (import.meta.env.VITE_SYNTHRA_API_BASE || 'https://trading-api.synthra.org').replace(/\/+$/, '');
const SYNTHRA_KEY  = import.meta.env.VITE_SYNTHRA_API_KEY  || '';
const ARC_CHAIN_ID = 5042002;

const API_HEADERS  = { 'content-type': 'application/json', 'x-api-key': SYNTHRA_KEY };

import { toRaw } from '../../utils/chainUtils';

// ── Component ─────────────────────────────────────────────────────────────────
export default function DeFiWidget({ defaultTab = 'swap' }) {
  const { address }   = useAccount();
  const { connect, connectors } = useConnect();
  const navigate = useNavigate();
  const connectedChainId = useChainId();

  const [activeTab, setActiveTab] = useState(defaultTab);
  const [amount,    setAmount]    = useState('');
  
  // ── Swap State ──
  const [tokenIn,  setTokenIn]  = useState(getTokenBySymbol('USDC'));
  const [tokenOut, setTokenOut] = useState(getTokenBySymbol('USDT'));
  
  // ── Bridge State ──
  // Use USDC for both sides initially, but on different mock chains
  const [bridgeChainIn,   setBridgeChainIn]   = useState(getChainById(ARC_CHAIN_ID));
  const [bridgeTokenIn,   setBridgeTokenIn]   = useState(getTokenBySymbol('USDC'));
  const [bridgeChainOut,  setBridgeChainOut]  = useState(getChainById(84532)); // Base Sepolia
  const [bridgeTokenOut,  setBridgeTokenOut]  = useState(getTokenBySymbol('USDC'));

  // ── Modals State ──
  const [isSwapModalOpen, setIsSwapModalOpen] = useState(false);
  const [isBridgeModalOpen, setIsBridgeModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [selectingFor, setSelectingFor] = useState('in'); // 'in' or 'out'
  const [showSettings, setShowSettings] = useState(false);
  const [slippage, setSlippage] = useState('0.5');

  // ── Transaction State ──
  const [quote,            setQuote]            = useState(null);
  const [quoteLoading,     setQuoteLoading]     = useState(false);
  const [quoteError,       setQuoteError]       = useState(null);
  const [swapLoading,      setSwapLoading]      = useState(false);
  const [swapStatus,       setSwapStatus]       = useState('idle');
  const [swapError,        setSwapError]        = useState('');
  const [txHash,           setTxHash]           = useState(null);

  const isWrongChain = address && connectedChainId !== ARC_CHAIN_ID;

  // ── Swap Balances ──
  // USDC on Arc is the NATIVE currency (precompile 0x3600...). When token is USDC,
  // we pass token: undefined so wagmi reads native balance instead of calling balanceOf.
  const isNativeIn  = tokenIn?.address?.toLowerCase()  === '0x3600000000000000000000000000000000000000';
  const isNativeOut = tokenOut?.address?.toLowerCase() === '0x3600000000000000000000000000000000000000';
  const { data: balInData } = useBalance({
    address,
    token: (tokenIn?.isNative || isNativeIn) ? undefined : tokenIn?.address,
    chainId: ARC_CHAIN_ID,
    query: { enabled: !!address, refetchInterval: 10_000, staleTime: 8_000 }
  });
  const { data: balOutData } = useBalance({
    address,
    token: (tokenOut?.isNative || isNativeOut) ? undefined : tokenOut?.address,
    chainId: ARC_CHAIN_ID,
    query: { enabled: !!address, refetchInterval: 10_000, staleTime: 8_000 }
  });
  const fmtInSwap  = balInData  ? Number(balInData.formatted).toFixed(4)  : '0.00';
  const fmtOutSwap = balOutData ? Number(balOutData.formatted).toFixed(4) : '0.00';

  // ── Bridge Balances ──
  const isBridgeNativeIn  = bridgeTokenIn?.address?.toLowerCase()  === '0x3600000000000000000000000000000000000000';
  const isBridgeNativeOut = bridgeTokenOut?.address?.toLowerCase() === '0x3600000000000000000000000000000000000000';
  const { data: bridgeBalInData } = useBalance({
    address,
    token: (bridgeTokenIn?.isNative || isBridgeNativeIn) ? undefined : bridgeTokenIn?.address,
    chainId: bridgeChainIn?.id,
    query: { enabled: !!address, refetchInterval: 10_000, staleTime: 8_000 }
  });
  const { data: bridgeBalOutData } = useBalance({
    address,
    token: (bridgeTokenOut?.isNative || isBridgeNativeOut) ? undefined : bridgeTokenOut?.address,
    chainId: bridgeChainOut?.id,
    query: { enabled: !!address, refetchInterval: 10_000, staleTime: 8_000 }
  });
  const fmtInBridge  = bridgeBalInData  ? Number(bridgeBalInData.formatted).toFixed(4)  : '0.00';
  const fmtOutBridge = bridgeBalOutData ? Number(bridgeBalOutData.formatted).toFixed(4) : '0.00';

  // ── Quote Logic (Swap only for now) ──
  const fetchQuote = useCallback(async () => {
    if (activeTab === 'bridge') {
      // Bridge mockup: 1:1 quote for visual purposes
      if (amount && Number(amount) > 0) {
        setQuote({ amountOutDecimals: amount, routeString: 'CCTP Routing', priceImpact: '0.00' });
        setQuoteError(null);
      } else {
        setQuote(null);
      }
      return;
    }

    const rawAmount = toRaw(amount, tokenIn.decimals);
    if (!rawAmount || !tokenIn || !tokenOut || tokenIn.address === tokenOut.address) {
      setQuote(null);
      setQuoteError(null);
      return;
    }
    if (tokenIn.noSwap || tokenOut.noSwap) {
      setQuoteError('Este token não tem rota de swap disponível na Synthra');
      setQuote(null); return;
    }
    setQuoteLoading(true);
    setQuoteError(null);
    try {
      const res = await fetch(`${SYNTHRA_API}/v1/quote`, {
        method:  'POST',
        headers: API_HEADERS,
        body: JSON.stringify({
          chainId:   ARC_CHAIN_ID,
          tokenIn:   tokenIn.address,
          tokenOut:  tokenOut.address,
          amount:    rawAmount,
          tradeType: 'EXACT_INPUT',
        }),
      });
      if (res.status === 401) throw new Error('API Key inválida (401)');
      if (!res.ok)            throw new Error(`Erro da API: ${res.status}`);
      const data = await res.json();
      if (data.state === 'Not found') throw new Error('Sem liquidez para este par');
      if (data.state !== 'Success')   throw new Error(`Sem rota: ${data.state}`);
      setQuote(data);
    } catch (err) {
      setQuoteError(err.message || 'Falha ao buscar cotação');
      setQuote(null);
    } finally {
      setQuoteLoading(false);
    }
  }, [amount, tokenIn, tokenOut, activeTab]);

  useEffect(() => {
    const t = setTimeout(fetchQuote, 700);
    return () => clearTimeout(t);
  }, [fetchQuote]);

  useEffect(() => {
    setQuote(null); setQuoteError(null); setSwapStatus('idle'); setAmount('');
  }, [activeTab]);

  // ── Smart Selection Handlers ──
  const handleSwapTokenSelect = (token) => {
    if (selectingFor === 'in') {
      if (token.symbol === tokenOut.symbol) {
        // Auto-reverse if same token selected
        setTokenOut(tokenIn);
      }
      setTokenIn(token);
    } else {
      if (token.symbol === tokenIn.symbol) {
        // Auto-reverse if same token selected
        setTokenIn(tokenOut);
      }
      setTokenOut(token);
    }
    setQuote(null);
  };

  const handleBridgeSelection = (selection) => {
    if (selectingFor === 'in') {
      if (selection.chain.id === bridgeChainOut.id) {
         setBridgeChainOut(bridgeChainIn);
         setBridgeTokenOut(bridgeTokenIn);
      }
      setBridgeChainIn(selection.chain);
      setBridgeTokenIn(selection.token);
    } else {
      if (selection.chain.id === bridgeChainIn.id) {
         setBridgeChainIn(bridgeChainOut);
         setBridgeTokenIn(bridgeTokenOut);
      }
      setBridgeChainOut(selection.chain);
      setBridgeTokenOut(selection.token);
    }
    setQuote(null);
  };

  const [isBridgeExecutionModalOpen, setIsBridgeExecutionModalOpen] = useState(false);
  const [isSwapExecutionModalOpen, setIsSwapExecutionModalOpen] = useState(false);

  // ── Swap Execution ─────────────────────────────────────────────────────────
  const handleSwap = async () => {
    if (!address) { 
        setIsWalletModalOpen(true);
        return; 
    }
    if (activeTab === 'bridge') {
      if (bridgeChainIn.id === bridgeChainOut.id) {
         alert('As redes de origem e destino não podem ser as mesmas.');
         return;
      }
      setIsBridgeExecutionModalOpen(true);
      return;
    }
    
    if (isWrongChain)                         { alert('Mude a rede para Arc Testnet (5042002) na sua carteira.'); return; }
    if (!quote)                               { alert('Aguarde a cotação carregar.'); return; }
    const rawAmount = toRaw(amount, tokenIn.decimals);
    if (!rawAmount) return;

    setIsSwapExecutionModalOpen(true);
  };

  // ── UI Helpers ─────────────────────────────────────────────────────────────
  const outputAmount = quote ? parseFloat(Number(quote.amountOutDecimals).toFixed(6)).toString() : '';

  let btnLabel = activeTab === 'swap' ? 'Swap Tokens' : 'Bridge Assets';
  if (!address)                          btnLabel = 'Connect Wallet';
  else if (isWrongChain && activeTab === 'swap') btnLabel = '⚠️ Mude para Arc Testnet';
  else if (swapStatus === 'approving')   btnLabel = '⏳ Aprovando Token...';
  else if (swapStatus === 'swapping')    btnLabel = '⏳ Enviando Transaction...';
  else if (swapStatus === 'success')     btnLabel = '✅ Concluído!';
  else if (swapStatus === 'error')       btnLabel = '❌ Falhou — Tentar Novamente';
  else if (!amount || Number(amount) <= 0) btnLabel = 'Enter an Amount';
  else if (quoteLoading)                 btnLabel = 'Buscando rota...';
  else if (quoteError)                   btnLabel = 'Sem Rota Disponível';

  // Only disable the button if connected AND missing info/wrong chain
  const btnDisabled = address && ((isWrongChain && activeTab === 'swap') || swapLoading || quoteLoading || !quote || !amount || swapStatus === 'success');

  return (
    <div className="w-full max-w-[480px] mx-auto">
      <div className="bg-dark-card border border-dark-border rounded-3xl p-5 shadow-2xl">

        {/* ── Tabs ── */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex gap-1 bg-dark-bg rounded-xl p-1">
            {['swap', 'bridge'].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all capitalize ${activeTab === tab ? 'bg-dark-card text-white shadow-sm' : 'text-dark-muted hover:text-white'}`}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
          <div className="flex gap-2 relative">
            <button onClick={() => setIsHistoryModalOpen(true)} title="Swap & Bridge History"
              className="w-9 h-9 flex items-center justify-center rounded-full bg-dark-bg text-dark-muted hover:text-white hover:bg-dark-border transition-all">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            <button onClick={() => setShowSettings(!showSettings)} title="Slippage Settings" className={`w-9 h-9 flex items-center justify-center rounded-full transition-all ${showSettings ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)]' : 'bg-dark-bg text-dark-muted hover:text-white hover:bg-dark-border'}`}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
            {showSettings && (
              <div className="absolute top-12 right-0 w-64 bg-dark-card border border-dark-border rounded-2xl p-4 shadow-2xl z-50 animate-[fadeIn_0.2s_ease-out]">
                <h4 className="text-white text-sm font-bold mb-3">Transaction Settings</h4>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-dark-muted font-medium mb-2 flex justify-between">
                      <span>Slippage Tolerance</span>
                      <span className="text-blue-400">{slippage}%</span>
                    </label>
                    <div className="flex gap-2">
                      {['0.1', '0.5', '1.0'].map(val => (
                        <button key={val} onClick={() => setSlippage(val)} className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${slippage === val ? 'bg-blue-600 text-white shadow-lg' : 'bg-dark-input text-dark-muted hover:text-white hover:bg-dark-border'}`}>
                          {val}%
                        </button>
                      ))}
                      <input type="text" placeholder="Custom" className="w-16 bg-dark-input border border-dark-border rounded-lg text-center text-xs text-white focus:border-blue-500 outline-none placeholder-dark-muted" />
                    </div>
                  </div>
                  <p className="text-[10px] text-dark-muted pt-2 border-t border-dark-border/50">
                    Slippage settings are auto-optimized for best practices on Arc Testnet.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Swap Interface ── */}
        {activeTab === 'swap' && (
          <div className="flex flex-col gap-1">
            {/* From */}
            <div className="bg-dark-bg/80 border border-dark-border/60 hover:border-dark-border rounded-2xl p-5 h-[124px] flex flex-col justify-between transition-all">
              <div className="text-sm font-medium text-dark-muted mb-3 flex justify-between">
                <span>You pay</span>
                <span className="flex items-center gap-1 text-xs">
                  <svg className="w-3.5 h-3.5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                  {fmtInSwap} {tokenIn.symbol}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <button onClick={() => { setSelectingFor('in'); setIsSwapModalOpen(true); }}
                  className="flex items-center gap-2 bg-dark-card border border-dark-border hover:bg-dark-border/80 transition-all rounded-full py-1.5 px-3 shadow-lg shrink-0 group">
                  <TokenIcon token={tokenIn} size="sm" />
                  <span className="font-bold text-white text-lg tracking-wide">{tokenIn.symbol}</span>
                  <svg className="w-5 h-5 text-dark-muted group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>
                <input type="number" placeholder="0" value={amount}
                  onChange={(e) => { setAmount(e.target.value); setSwapStatus('idle'); setSwapError(''); }}
                  className="w-full bg-transparent text-right text-4xl font-black text-white placeholder-dark-border outline-none tracking-tight min-w-0" />
              </div>
            </div>

            {/* Arrow */}
            <div className="relative h-2 flex items-center justify-center z-10 -my-3">
              <div onClick={() => { 
                  setTokenIn(tokenOut); setTokenOut(tokenIn); 
                  setAmount(''); setQuote(null); setSwapStatus('idle'); 
                }}
                className="absolute w-10 h-10 bg-dark-card border-4 border-dark-bg rounded-xl flex items-center justify-center text-dark-muted hover:text-white transition-all hover:bg-dark-border cursor-pointer shadow-lg hover:rotate-180 duration-500">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
              </div>
            </div>

            {/* To */}
            <div className="bg-dark-bg/80 border border-dark-border/60 hover:border-dark-border rounded-2xl p-5 h-[124px] flex flex-col justify-between transition-all">
              <div className="text-sm font-medium text-dark-muted mb-3 flex justify-between">
                <span>You receive</span>
                <span className="flex items-center gap-1 text-xs">
                  <svg className="w-3.5 h-3.5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                  {fmtOutSwap} {tokenOut.symbol}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <button onClick={() => { setSelectingFor('out'); setIsSwapModalOpen(true); }}
                  className="flex items-center gap-2 bg-dark-card border border-dark-border hover:bg-dark-border/80 transition-all rounded-full py-1.5 px-3 shadow-lg shrink-0 group">
                  <TokenIcon token={tokenOut} size="sm" />
                  <span className="font-bold text-white text-lg tracking-wide">{tokenOut.symbol}</span>
                  <svg className="w-5 h-5 text-dark-muted group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>
                <div className="w-full text-right text-4xl font-black tracking-tight min-w-0">
                  {quoteLoading
                    ? <span className="text-dark-muted text-2xl animate-pulse">...</span>
                    : outputAmount
                      ? <span className="text-white">{outputAmount}</span>
                      : <span className="text-dark-border">0</span>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Bridge Interface ── */}
        {activeTab === 'bridge' && (
          <div className="flex flex-col gap-1">
            {/* From */}
            <div className="bg-dark-bg/80 border border-dark-border/60 hover:border-dark-border rounded-2xl p-5 h-[124px] flex flex-col justify-between transition-all">
              <div className="text-sm font-medium text-dark-muted mb-3 flex justify-between">
                <span>Bridge from</span>
                <span className="flex items-center gap-1 text-xs">
                  <svg className="w-3.5 h-3.5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                  {fmtInBridge} {bridgeTokenIn.symbol}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <button onClick={() => { setSelectingFor('in'); setIsBridgeModalOpen(true); }}
                  className="flex items-center gap-2 bg-dark-card border border-dark-border hover:bg-dark-border/80 transition-all rounded-full py-1.5 px-3 shadow-lg shrink-0 group">
                  <div className="relative flex shrink-0">
                    <TokenIcon token={bridgeTokenIn} size="sm" />
                    <div className="absolute -bottom-1 -right-1">
                       <ChainBadge chain={bridgeChainIn} />
                    </div>
                  </div>
                  <span className="font-bold text-white text-lg tracking-wide">{bridgeTokenIn.symbol}</span>
                  <svg className="w-5 h-5 text-dark-muted group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>
                <input type="number" placeholder="0" value={amount}
                  onChange={(e) => { setAmount(e.target.value); setSwapStatus('idle'); setSwapError(''); }}
                  className="w-full bg-transparent text-right text-4xl font-black text-white placeholder-dark-border outline-none tracking-tight min-w-0" />
              </div>
            </div>

            {/* Arrow */}
            <div className="relative h-2 flex items-center justify-center z-10 -my-3">
              <div onClick={() => { 
                  setBridgeChainIn(bridgeChainOut); setBridgeChainOut(bridgeChainIn); 
                  setBridgeTokenIn(bridgeTokenOut); setBridgeTokenOut(bridgeTokenIn);
                  setAmount(''); setQuote(null); setSwapStatus('idle'); 
                }}
                className="absolute w-10 h-10 bg-dark-card border-4 border-dark-bg rounded-xl flex items-center justify-center text-dark-muted hover:text-white transition-all hover:bg-dark-border cursor-pointer shadow-lg hover:rotate-180 duration-500">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
              </div>
            </div>

            {/* To */}
            <div className="bg-dark-bg/80 border border-dark-border/60 hover:border-dark-border rounded-2xl p-5 h-[124px] flex flex-col justify-between transition-all">
              <div className="text-sm font-medium text-dark-muted mb-3 flex justify-between">
                <span>Bridge to</span>
                <span className="flex items-center gap-1 text-xs">
                  <svg className="w-3.5 h-3.5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                  {fmtOutBridge} {bridgeTokenOut.symbol}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <button onClick={() => { setSelectingFor('out'); setIsBridgeModalOpen(true); }}
                  className="flex items-center gap-2 bg-dark-card border border-dark-border hover:bg-dark-border/80 transition-all rounded-full py-1.5 px-3 shadow-lg shrink-0 group">
                  <div className="relative flex shrink-0">
                    <TokenIcon token={bridgeTokenOut} size="sm" />
                    <div className="absolute -bottom-1 -right-1">
                       <ChainBadge chain={bridgeChainOut} />
                    </div>
                  </div>
                  <span className="font-bold text-white text-lg tracking-wide">{bridgeTokenOut.symbol}</span>
                  <svg className="w-5 h-5 text-dark-muted group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>
                <div className="w-full text-right text-4xl font-black tracking-tight min-w-0">
                  {quoteLoading
                    ? <span className="text-dark-muted text-2xl animate-pulse">...</span>
                    : outputAmount
                      ? <span className="text-white">{outputAmount}</span>
                      : <span className="text-dark-border">0</span>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Route info ── */}
        <div className="mt-4 mb-2 px-4 py-3 bg-dark-bg/60 border border-dark-border/50 rounded-xl flex items-center justify-between shadow-inner">
          <div className="flex flex-col">
            <span className="text-xs font-bold text-dark-muted uppercase tracking-wider">Route</span>
            <span className="text-sm font-black text-white flex items-center mt-0.5">
              {quoteLoading
                ? <span className="text-dark-muted animate-pulse">Searching routes...</span>
                : quoteError
                  ? <span className="text-red-400 text-xs">{quoteError}</span>
                  : quote
                    ? <>
                        <span className="text-xs font-medium">{activeTab === 'bridge' ? 'CCTP Routing' : 'Synthra Router'}</span>
                        <svg className="w-4 h-4 text-green-400 ml-1 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      </>
                    : <span className="text-dark-muted">Enter an amount</span>}
            </span>
          </div>
          {quote && (
            <div className="text-right shrink-0 ml-2">
              <div className="text-xs text-dark-muted">{activeTab === 'bridge' ? 'Bridge Fee' : 'Price Impact'}</div>
              <div className="text-sm font-bold text-green-400">
                {activeTab === 'bridge' ? '~$0.00' : (quote.priceImpact ? `${Number(quote.priceImpact).toFixed(2)}%` : '< 0.01%')}
              </div>
            </div>
          )}
        </div>

        {/* ── Error ── */}
        {swapStatus === 'error' && swapError && (
          <div className="mt-2 px-3 py-2 bg-red-900/30 border border-red-500/40 rounded-xl text-xs text-red-300 break-all">
            ⚠️ {swapError}
          </div>
        )}

        {/* ── Action Button ── */}
        <button onClick={handleSwap} disabled={btnDisabled}
          className={`w-full mt-4 py-4 rounded-2xl transition-all active:scale-[0.98] ${
            !address 
              ? 'bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.05] text-white font-bold text-lg'
              : btnDisabled 
                ? 'bg-white/[0.04] border border-white/[0.05] cursor-not-allowed opacity-60 text-white font-bold text-lg' 
                : 'bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 cursor-pointer shadow-[0_0_20px_rgba(39,117,202,0.3)] hover:shadow-[0_0_25px_rgba(39,117,202,0.5)] text-white font-bold text-lg'
          }`}>
          {btnLabel}
        </button>

        {/* ── Tx hash ── */}
        {txHash && (
          <div className="mt-3 text-center text-xs text-dark-muted">
            Tx: <a href={`https://testnet.arcscan.app/tx/${txHash}`} target="_blank" rel="noopener noreferrer"
              className="text-blue-400 hover:underline">{txHash.slice(0, 12)}...{txHash.slice(-6)}</a>
          </div>
        )}


      </div>

      <TokenSelectorModal
        isOpen={isSwapModalOpen}
        onClose={() => setIsSwapModalOpen(false)}
        onSelect={handleSwapTokenSelect}
        selectedToken={selectingFor === 'in' ? tokenIn : tokenOut}
      />
      
      <NetworkTokenModal
        isOpen={isBridgeModalOpen}
        onClose={() => setIsBridgeModalOpen(false)}
        onSelect={handleBridgeSelection}
        selectedChain={selectingFor === 'in' ? bridgeChainIn : bridgeChainOut}
        selectedToken={selectingFor === 'in' ? bridgeTokenIn : bridgeTokenOut}
      />
      
      <BridgeModal
        isOpen={isBridgeExecutionModalOpen}
        onClose={() => setIsBridgeExecutionModalOpen(false)}
        amount={amount}
        fromChain={bridgeChainIn}
        toChain={bridgeChainOut}
        token={bridgeTokenIn}
        userAddress={address}
        onComplete={() => {
          setIsBridgeExecutionModalOpen(false);
          setAmount('');
        }}
      />

      <SwapModal
        isOpen={isSwapExecutionModalOpen}
        onClose={() => {
          setIsSwapExecutionModalOpen(false);
        }}
        tokenIn={tokenIn}
        tokenOut={tokenOut}
        amountIn={amount}
        amountOut={outputAmount}
        rawAmountIn={toRaw(amount, tokenIn.decimals)}
        userAddress={address}
      />
      <TradeHistoryModal 
        isOpen={isHistoryModalOpen} 
        onClose={() => setIsHistoryModalOpen(false)} 
      />

      <WalletModal
        isOpen={isWalletModalOpen}
        onClose={() => setIsWalletModalOpen(false)}
        connectors={connectors}
        onSelectWallet={(connector) => {
            connect({ connector });
            setIsWalletModalOpen(false);
        }}
      />
    </div>
  );
}

// ── Icons ────────────────────────────────────────────────────────────────────
function TokenIcon({ token, size = 'sm' }) {
  const [imgError, setImgError] = useState(false);
  const dim = size === 'sm' ? 'w-8 h-8' : 'w-10 h-10';

  if (imgError || !token.iconImg) {
    return (
      <div className={`${dim} rounded-full ${token.color || 'bg-gray-600'} flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-inner`}>
        {token.symbol.slice(0, 2)}
      </div>
    );
  }

  return (
    <div className={`${dim} rounded-full overflow-hidden shrink-0 shadow-sm`}>
      <img
        src={token.iconImg}
        alt={token.symbol}
        className="w-full h-full object-contain rounded-full"
        onError={() => setImgError(true)}
      />
    </div>
  );
}

function ChainBadge({ chain }) {
  const [error, setError] = useState(false);
  if (error || !chain?.icon) return null;
  return (
    <div className="w-[14px] h-[14px] rounded-full bg-dark-bg p-[1px] shadow-sm z-10 flex items-center justify-center">
      <img src={chain.icon} alt={chain.name} onError={() => setError(true)} className="w-full h-full rounded-full object-cover" />
    </div>
  );
}