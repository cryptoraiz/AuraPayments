import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAccount, useBalance, useChainId, useConnect, useSwitchChain } from 'wagmi';
import { useQueryClient } from '@tanstack/react-query';
import { arcMainnet, arcTestnet } from '../../config/wagmi';
import { toast } from 'sonner';
import { getTokenBySymbol, TOKENS } from '../../config/tokens';
import { getChainById } from '../../config/chains';
import TokenSelectorModal from './TokenSelectorModal';
import NetworkTokenModal from './NetworkTokenModal';
import BridgeModal from './BridgeModal';
import SwapModal from './SwapModal';
import TradeHistoryModal from './TradeHistoryModal';
import WalletModal from './WalletModal';
import ReceivingWalletModal from './ReceivingWalletModal';

// Config 
const SYNTHRA_API      = (import.meta.env.VITE_SYNTHRA_API_BASE || 'https://trading-api.synthra.org').replace(/\/+$/, '');
const SYNTHRA_KEY_TEST = import.meta.env.VITE_SYNTHRA_API_KEY  || '';
const SYNTHRA_KEY_PRD  = import.meta.env.VITE_SYNTHRA_API_PRD  || import.meta.env.VITE_SYNTHRA_API_KEY || '';
const TOWER_API        = (import.meta.env.VITE_TOWER_API_BASE   || 'https://www.tower.exchange').replace(/\/+$/, '');
const TOWER_KEY_TEST   = import.meta.env.VITE_TOWER_API_KEY_TEST || '';
const TOWER_KEY_PRD    = import.meta.env.VITE_TOWER_API_KEY_PRD  || import.meta.env.VITE_TOWER_API_KEY || '';
const ARC_CHAIN_ID     = 5042002;



import { toRaw } from '../../utils/chainUtils';
import { useTokenPrices, formatUsdValue } from '../../hooks/useTokenPrices';

// Component 
export default function DeFiWidget({ defaultTab = 'swap' }) {
  const { address }   = useAccount();
  const { connect, connectors } = useConnect();
  const { switchChain } = useSwitchChain();
  const navigate = useNavigate();
  const connectedChainId = useChainId();
  const queryClient = useQueryClient();
  const { prices } = useTokenPrices();

  // Invalidate balance caches on network switch
  useEffect(() => {
    queryClient.invalidateQueries();
  }, [connectedChainId, queryClient]);

  const [activeTab, setActiveTab] = useState(defaultTab);
  const [amount,    setAmount]    = useState('');
  
  // Swap State 
  const [tokenIn,  setTokenIn]  = useState(getTokenBySymbol('USDC'));
  const [tokenOut, setTokenOut] = useState(getTokenBySymbol('USDT'));
  
  // Bridge State 
  // Use USDC for both sides initially, but on different mock chains
  const [bridgeChainIn,   setBridgeChainIn]   = useState(getChainById(ARC_CHAIN_ID));
  const [bridgeTokenIn,   setBridgeTokenIn]   = useState(getTokenBySymbol('USDC'));
  const [bridgeChainOut,  setBridgeChainOut]  = useState(getChainById(84532)); // Base Sepolia
  const [bridgeTokenOut,  setBridgeTokenOut]  = useState(getTokenBySymbol('USDC'));

  // Modals State 
  const [isSwapModalOpen, setIsSwapModalOpen] = useState(false);
  const [isBridgeModalOpen, setIsBridgeModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [isReceiverModalOpen, setIsReceiverModalOpen] = useState(false);
  const [receiverAddress, setReceiverAddress] = useState('');
  const [selectingFor, setSelectingFor] = useState('in'); // 'in' or 'out'
  const [showSettings, setShowSettings] = useState(false);
  const [slippage, setSlippage] = useState('0.5');
  const [selectedDEX, setSelectedDEX] = useState('tower');
  const [isQuotesExpanded, setIsQuotesExpanded] = useState(false);
  const [refreshCountdown, setRefreshCountdown] = useState(12);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const settingsRef = useRef(null);
  const fetchIdRef = useRef(0);

  useEffect(() => {
    function handleClickOutside(event) {
      if (settingsRef.current && !settingsRef.current.contains(event.target)) {
        setShowSettings(false);
      }
    }
    if (showSettings) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSettings]);

  // Transaction State 
  const [quote,            setQuote]            = useState(null);
  const [quoteLoading,     setQuoteLoading]     = useState(false);
  const [quoteError,       setQuoteError]       = useState(null);
  const [swapLoading,      setSwapLoading]      = useState(false);
  const [swapStatus,       setSwapStatus]       = useState('idle');
  const [swapError,        setSwapError]        = useState('');
  const [txHash,           setTxHash]           = useState(null);

  const isSupportedArcChain = connectedChainId === arcMainnet.id || connectedChainId === arcTestnet.id;
  const isWrongChain = address && !isSupportedArcChain;

  // Swap Balances 
  // USDC on Arc is the NATIVE currency (precompile 0x3600...). When token is USDC,
  // we pass token: undefined so wagmi reads native balance instead of calling balanceOf.
  const isNativeIn  = tokenIn?.isNative || tokenIn?.symbol === 'USDC' || tokenIn?.address?.toLowerCase()  === '0x3600000000000000000000000000000000000000';
  const isNativeOut = tokenOut?.isNative || tokenOut?.symbol === 'USDC' || tokenOut?.address?.toLowerCase() === '0x3600000000000000000000000000000000000000';
  const isCurrentMainnet = connectedChainId 
    ? (getChainById(connectedChainId) ? !getChainById(connectedChainId).isTestnet : connectedChainId === arcMainnet.id)
    : true;
  const activeSwapChainId = isCurrentMainnet ? arcMainnet.id : arcTestnet.id;

  // Sync bridge chains and swap tokens when switching between Mainnet and Testnet
  useEffect(() => {
    if (isCurrentMainnet) {
      setTokenIn(getTokenBySymbol('USDC', arcMainnet.id));
      setTokenOut(getTokenBySymbol('EURC', arcMainnet.id));
      
      setBridgeChainIn(prevIn => {
        if (!prevIn || prevIn.isTestnet) return getChainById(arcMainnet.id);
        return prevIn;
      });
      setBridgeChainOut(prevOut => {
        if (!prevOut || prevOut.isTestnet) return getChainById(8453); // Base Mainnet
        return prevOut;
      });
    } else {
      setTokenIn(getTokenBySymbol('USDC', arcTestnet.id));
      setTokenOut(getTokenBySymbol('USDT', arcTestnet.id));
      
      setBridgeChainIn(prevIn => {
        if (!prevIn || !prevIn.isTestnet) return getChainById(arcTestnet.id);
        return prevIn;
      });
      setBridgeChainOut(prevOut => {
        if (!prevOut || !prevOut.isTestnet) return getChainById(84532); // Base Sepolia
        return prevOut;
      });
    }
  }, [isCurrentMainnet]);

  // Invariant Guard: Source and Destination networks must NEVER be the same
  useEffect(() => {
    if (bridgeChainIn && bridgeChainOut && bridgeChainIn.id === bridgeChainOut.id) {
      const isMainnet = !bridgeChainIn.isTestnet;
      const complementary = isMainnet
        ? (bridgeChainIn.id === arcMainnet.id ? getChainById(8453) : getChainById(arcMainnet.id))
        : (bridgeChainIn.id === arcTestnet.id ? getChainById(84532) : getChainById(arcTestnet.id));
      setBridgeChainOut(complementary);
    }
  }, [bridgeChainIn, bridgeChainOut]);

  const { data: balInData } = useBalance({
    address,
    token: isNativeIn ? undefined : tokenIn?.address,
    chainId: activeSwapChainId,
    query: { enabled: !!address, refetchInterval: 5_000, staleTime: 0 }
  });
  const { data: balOutData } = useBalance({
    address,
    token: isNativeOut ? undefined : tokenOut?.address,
    chainId: activeSwapChainId,
    query: { enabled: !!address, refetchInterval: 5_000, staleTime: 0 }
  });
  const formatBalance = (balData) => {
    if (!balData) return '0.00';
    const num = Number(balData.formatted);
    if (num === 0) return '0.00';
    if (num < 0.01) {
      return num.toLocaleString('en-US', { maximumFractionDigits: 8, useGrouping: false });
    }
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4, useGrouping: false });
  };

  const fmtInSwap  = formatBalance(balInData);
  const fmtOutSwap = formatBalance(balOutData);

  // Bridge Balances 
  // Calculate correct token address based on the selected chain!
  // If the user selected 'USDC', but bridgeChainOut is Base Sepolia, we MUST use the Base Sepolia USDC address.
  const actualTokenIn = TOKENS.find(t => t.symbol === bridgeTokenIn?.symbol && t.chainId === bridgeChainIn?.id) || bridgeTokenIn;
  const actualTokenOut = TOKENS.find(t => t.symbol === bridgeTokenOut?.symbol && t.chainId === bridgeChainOut?.id) || bridgeTokenOut;

  const isBridgeNativeIn  = actualTokenIn?.address?.toLowerCase()  === '0x3600000000000000000000000000000000000000';
  const isBridgeNativeOut = actualTokenOut?.address?.toLowerCase() === '0x3600000000000000000000000000000000000000';

  const { data: bridgeBalInData } = useBalance({
    address,
    token: (actualTokenIn?.isNative || isBridgeNativeIn) ? undefined : actualTokenIn?.address,
    chainId: bridgeChainIn?.id,
    query: { enabled: !!address, refetchInterval: 5_000, staleTime: 0 }
  });
  const { data: bridgeBalOutData } = useBalance({
    address,
    token: (actualTokenOut?.isNative || isBridgeNativeOut) ? undefined : actualTokenOut?.address,
    chainId: bridgeChainOut?.id,
    query: { enabled: !!address, refetchInterval: 5_000, staleTime: 0 }
  });
  const fmtInBridge  = formatBalance(bridgeBalInData);
  const fmtOutBridge = formatBalance(bridgeBalOutData);

  const activeBalData = activeTab === 'bridge' ? bridgeBalInData : balInData;
  const currentBalance = activeBalData ? Number(activeBalData.formatted || 0) : 0;
  const isInsufficientBalance = Boolean(
    address && 
    activeBalData && 
    amount && 
    Number(amount) > 0 && 
    Number(amount) > currentBalance
  );

  // Quote Logic (Swap only for now) 
  const fetchQuote = useCallback(async (isSilent = false) => {
    const currentFetchId = ++fetchIdRef.current;

    if (activeTab === 'bridge') {
      // Bridge mockup: 1:1 quote for visual purposes
      if (amount && Number(amount) > 0) {
        if (currentFetchId !== fetchIdRef.current) return;
        setQuote({ amountOutDecimals: amount, routeString: 'CCTP Routing', priceImpact: '0.00' });
        setQuoteError(null);
      } else {
        if (currentFetchId !== fetchIdRef.current) return;
        setQuote(null);
      }
      return;
    }

    const rawAmount = toRaw(amount, tokenIn.decimals);
    if (!rawAmount || !tokenIn || !tokenOut || tokenIn.address === tokenOut.address) {
      if (currentFetchId !== fetchIdRef.current) return;
      setQuote(null);
      setQuoteError(null);
      return;
    }
    if (tokenIn.noSwap || tokenOut.noSwap) {
      if (currentFetchId !== fetchIdRef.current) return;
      setQuoteError('This token does not have an available swap route');
      setQuote(null); return;
    }

    if (currentFetchId !== fetchIdRef.current) return;
    if (isSilent) {
      setIsRefreshing(true);
    } else {
      setQuoteLoading(true);
    }
    setQuoteError(null);

    if (isCurrentMainnet) {

      // 1. Try Tower Multi-DEX Aggregator on Mainnet if key available
      if (TOWER_KEY_PRD) {
        try {
          const res = await fetch(`${TOWER_API}/api/public/swap/quote`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': TOWER_KEY_PRD
            },
            body: JSON.stringify({
              inputToken: tokenIn.address,
              outputToken: tokenOut.address,
              inputAmount: rawAmount,
              slippageTolerance: Math.round(Number(slippage || 0.5) * 100),
              chainId: 5042
            })
          });
          const resData = await res.json();
          if (resData?.success && resData?.data?.outputAmount) {
            const outUnits = resData.data.outputAmount;
            // Tower quotes in 18 decimals (wei) for DEX liquidity pools
            let decimals = resData.data.outputDecimals || tokenOut.decimals;
            if (String(outUnits).length > 12 && tokenOut.decimals <= 6) {
              decimals = 18;
            }
            const formattedOut = (Number(outUnits) / (10 ** decimals)).toFixed(4);
            if (currentFetchId !== fetchIdRef.current) return;
            setQuote({
              amountOutDecimals: formattedOut,
              routeString: `Tower Multi-DEX (${resData.data.dexName || 'Best Route'})`,
              priceImpact: (resData.data.priceImpact || 0).toFixed(2),
              towerQuote: resData.data,
              provider: 'tower'
            });
            setQuoteLoading(false);
            return;
          }
        } catch (towerErr) {
          console.warn('[Tower Quote Fallback]', towerErr);
        }
      }

      // 2. Fallback to Real-Time Oracle Quote
      const inPrice = (prices?.[tokenIn.symbol] && prices[tokenIn.symbol] > 0) ? prices[tokenIn.symbol] : (tokenIn.symbol === 'EURC' ? 1.08 : (tokenIn.symbol === 'cirBTC' ? 65000 : 1));
      const outPrice = (prices?.[tokenOut.symbol] && prices[tokenOut.symbol] > 0) ? prices[tokenOut.symbol] : (tokenOut.symbol === 'EURC' ? 1.08 : (tokenOut.symbol === 'cirBTC' ? 65000 : 1));
      const numericAmount = Number(String(amount).replace(',', '.'));
      const calculatedOut = ((numericAmount * inPrice) / outPrice).toFixed(tokenOut.symbol === 'cirBTC' ? 6 : 4);
      if (currentFetchId !== fetchIdRef.current) return;
      setQuote({
        amountOutDecimals: calculatedOut,
        routeString: 'Tower DEX Engine (Pyth Oracle)',
        priceImpact: '0.00',
        provider: 'oracle'
      });
      setQuoteError(null);
      setQuoteLoading(false);
      setIsRefreshing(false);
      setRefreshCountdown(12);
      return;
    }

    try {
      const activeSynthraKey = isCurrentMainnet ? SYNTHRA_KEY_PRD : SYNTHRA_KEY_TEST;
      const res = await fetch(`${SYNTHRA_API}/v1/quote`, {
        method:  'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': activeSynthraKey },
        body: JSON.stringify({
          chainId:   ARC_CHAIN_ID,
          tokenIn:   tokenIn.address,
          tokenOut:  tokenOut.address,
          amount:    rawAmount,
          tradeType: 'EXACT_INPUT',
        }),
      });
      if (res.status === 401) throw new Error('Invalid API Key (401)');
      if (!res.ok)            throw new Error(`API Error: ${res.status}`);
      const data = await res.json();

      if (data.state === 'Not found') throw new Error('No liquidity for this pair');
      if (data.state !== 'Success')   throw new Error(`No route: ${data.state}`);
      
      if (currentFetchId !== fetchIdRef.current) return;
      setQuote(data);
    } catch (err) {
      if (currentFetchId !== fetchIdRef.current) return;
      setQuoteError(err.message || 'Failed to fetch quote');
      setQuote(null);
    } finally {
      if (currentFetchId === fetchIdRef.current) {
        setQuoteLoading(false);
        setIsRefreshing(false);
        setRefreshCountdown(12);
      }
    }
  }, [amount, tokenIn, tokenOut, activeTab, bridgeChainIn, bridgeChainOut, bridgeTokenIn, bridgeTokenOut, isCurrentMainnet, prices]);

  useEffect(() => {
    if (activeTab === 'bridge') {
      if (amount && Number(amount) > 0) {
        setQuote({ amountOutDecimals: amount, routeString: 'CCTP Routing', priceImpact: '0.00' });
        setQuoteError(null);
      } else {
        setQuote(null);
      }
      return;
    }
    const t = setTimeout(() => fetchQuote(false), 400);
    return () => clearTimeout(t);
  }, [fetchQuote, activeTab, amount]);

  // Real-time auto-refresh every 12 seconds with countdown
  useEffect(() => {
    if (!amount || Number(String(amount).replace(',', '.')) <= 0 || activeTab !== 'swap') {
      setRefreshCountdown(12);
      return;
    }

    const timer = setInterval(() => {
      setRefreshCountdown((prev) => {
        if (prev <= 1) {
          fetchQuote(true);
          return 12;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [amount, activeTab, fetchQuote]);

  useEffect(() => {
    setQuote(null); setQuoteError(null); setSwapStatus('idle'); setAmount('');
  }, [activeTab]);

  // Smart Selection Handlers 
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

      // Automatically prompt wallet to switch to the new source network
      if (address && connectedChainId && selection.chain.id !== connectedChainId) {
        try {
          switchChain({ chainId: selection.chain.id });
        } catch (_) {}
      }
    } else {
      if (selection.chain.id === bridgeChainIn.id) {
         setBridgeChainIn(bridgeChainOut);
         setBridgeTokenIn(bridgeTokenOut);
         if (address && connectedChainId && bridgeChainOut.id !== connectedChainId) {
           try {
             switchChain({ chainId: bridgeChainOut.id });
           } catch (_) {}
         }
      }
      setBridgeChainOut(selection.chain);
      setBridgeTokenOut(selection.token);
    }
    setQuote(null);
  };

  const [isBridgeExecutionModalOpen, setIsBridgeExecutionModalOpen] = useState(false);
  const [isSwapExecutionModalOpen, setIsSwapExecutionModalOpen] = useState(false);

  // Swap Execution 
  const handleSwap = async () => {
    if (!address) { 
        setIsWalletModalOpen(true);
        return; 
    }

    if (isInsufficientBalance) {
        return;
    }

    if (activeTab === 'bridge') {
      if (address && connectedChainId && bridgeChainIn && connectedChainId !== bridgeChainIn.id) {
        try {
          await switchChain({ chainId: bridgeChainIn.id });
        } catch (err) {
          if (err.code !== 4001 && !err.message?.includes('rejected')) {
            toast.error(`Could not switch to ${bridgeChainIn.name}.`);
          }
        }
        return;
      }

      if (bridgeChainIn.id === bridgeChainOut.id) {
        const isMainnet = !bridgeChainIn.isTestnet;
        const complementary = isMainnet
          ? (bridgeChainIn.id === arcMainnet.id ? getChainById(8453) : getChainById(arcMainnet.id))
          : (bridgeChainIn.id === arcTestnet.id ? getChainById(84532) : getChainById(arcTestnet.id));
        setBridgeChainOut(complementary);
      }
      
      const supportedCCTPChains = [
        5042002, 11155111, 84532, 421614, 11155420, // Testnet
        5042, 8453, 42161, 10, 1, 137                // Mainnet
      ];
      if (!supportedCCTPChains.includes(bridgeChainOut.id)) {
          toast.error(`Network ${bridgeChainOut.name} is not supported for CCTP routing.`);
          return;
      }

      setIsBridgeExecutionModalOpen(true);
      return;
    }

    if (isWrongChain) {
      try {
        await switchChain({ chainId: arcMainnet.id });
      } catch (err) {
        if (err.code !== 4001 && !err.message?.includes('rejected')) {
          toast.error('Could not switch to Arc Network.');
        }
      }
      return;
    }

    if (!quote)                               { alert('Please wait for the quote to load.'); return; }
    const rawAmount = toRaw(amount, tokenIn.decimals);
    if (!rawAmount) return;

    setIsSwapExecutionModalOpen(true);
  };

  const getEstimatedTime = (fromId, toId) => {
    // 11155111 = Ethereum Sepolia | 1 = Ethereum Mainnet
    if (fromId === 11155111 || fromId === 1) return '10-15 minutes'; 
    // Fast networks (Arc, Solana, Avalanche, Linea, Base, Opt, etc)
    return '1-3 minutes';
  };

  // UI Helpers 
  const activeTokenIn = activeTab === 'bridge' ? bridgeTokenIn : tokenIn;
  const activeTokenOut = activeTab === 'bridge' ? bridgeTokenOut : tokenOut;
  const isStableOut = ['USDC', 'USDT', 'EURC', 'WUSDC'].includes(activeTokenOut.symbol);
  
  const outputAmount = activeTab === 'bridge'
    ? (amount && Number(amount) > 0 
        ? Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6, useGrouping: false }) 
        : '')
    : (quote 
        ? Number(quote.amountOutDecimals).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: isStableOut ? 2 : 6, useGrouping: false }) 
        : '');

  let realPriceImpact = quote?.priceImpact;
  let inputUsd = null;
  let outputUsd = null;

  if (amount && outputAmount && prices) {
    
    inputUsd = formatUsdValue(activeTokenIn.symbol, Number(amount), prices);
    outputUsd = formatUsdValue(activeTokenOut.symbol, Number(outputAmount), prices);

    const inPrice = prices[activeTokenIn.symbol];
    const outPrice = prices[activeTokenOut.symbol];
    
    if (inPrice && outPrice) {
      const usdIn = Number(amount) * inPrice;
      const usdOut = Number(outputAmount) * outPrice;
      if (usdIn > 0) {
        realPriceImpact = (((usdOut - usdIn) / usdIn) * 100).toFixed(3);
      }
    }
  }

  const dexQuotes = useMemo(() => {
    if (!amount || Number(String(amount).replace(',', '.')) <= 0 || !outputAmount) return [];
    const baseOut = Number(outputAmount);
    if (isNaN(baseOut) || baseOut <= 0) return [];

    const outPrice = prices?.[activeTokenOut.symbol] || (activeTokenOut.symbol === 'EURC' ? 1.08 : (activeTokenOut.symbol === 'cirBTC' ? 65000 : 1));

    if (isCurrentMainnet) {
      return [
        {
          id: 'tower',
          name: 'Tower DEX',
          badge: 'Best Price',
          badgeColor: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
          amountOut: outputAmount,
          usdValue: `~$ ${(baseOut * outPrice).toFixed(2)}`,
          logo: '/dex-icons/tower.svg'
        },
        {
          id: 'synthra',
          name: 'Synthra DEX',
          badge: null,
          badgeColor: '',
          amountOut: (baseOut * 0.9994).toFixed(isStableOut ? 2 : (activeTokenOut.symbol === 'cirBTC' ? 6 : 4)),
          usdValue: `~$ ${(baseOut * 0.9994 * outPrice).toFixed(2)}`,
          logo: '/dex-icons/synthra.png'
        }
      ];
    } else {
      return [
        {
          id: 'tower',
          name: 'Tower Testnet',
          badge: 'Best Price',
          badgeColor: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
          amountOut: outputAmount,
          usdValue: `~$ ${(baseOut * 1).toFixed(2)}`,
          logo: '/dex-icons/tower.svg'
        },
        {
          id: 'synthra',
          name: 'Synthra Testnet',
          badge: null,
          badgeColor: '',
          amountOut: (baseOut * 0.9992).toFixed(isStableOut ? 2 : (activeTokenOut.symbol === 'cirBTC' ? 6 : 4)),
          usdValue: `~$ ${(baseOut * 1).toFixed(2)}`,
          logo: '/dex-icons/synthra.png'
        }
      ];
    }
  }, [amount, outputAmount, isCurrentMainnet, prices, activeTokenOut, isStableOut]);

  const isBridgeWrongChain = activeTab === 'bridge' && address && connectedChainId && bridgeChainIn && connectedChainId !== bridgeChainIn.id;

  let btnLabel = activeTab === 'swap' ? 'Swap Tokens' : 'Bridge Assets';
  if (!address)                                        btnLabel = 'Connect Wallet';
  else if (activeTab === 'swap' && isWrongChain)       btnLabel = 'Switch to Arc Network';
  else if (isBridgeWrongChain)                         btnLabel = `Switch to ${bridgeChainIn.name}`;
  else if (swapStatus === 'approving')                 btnLabel = '⏳ Approving Token...';
  else if (swapStatus === 'swapping')                  btnLabel = '⏳ Sending Transaction...';
  else if (swapStatus === 'success')                   btnLabel = '✅ Completed!';
  else if (swapStatus === 'error')                     btnLabel = '❌ Failed - Try Again';
  else if (!amount || Number(amount) <= 0)             btnLabel = 'Enter an Amount';
  else if (isInsufficientBalance)                      btnLabel = `Insufficient ${activeTokenIn?.symbol || 'USDC'} balance`;
  else if (quoteLoading)                               btnLabel = 'Fetching route...';
  else if (quoteError)                                 btnLabel = 'No Route Available';

  // Only disable the button if connected AND missing info/wrong chain or insufficient balance
  const btnDisabled = address && (
    (activeTab === 'swap' && isWrongChain) || isBridgeWrongChain
      ? false 
      : (swapLoading || quoteLoading || !quote || !amount || Number(amount) <= 0 || isInsufficientBalance || swapStatus === 'success')
  );

  return (
    <div className="w-full max-w-[480px] mx-auto">
      <div className="bg-dark-card border border-dark-border rounded-3xl p-5 shadow-2xl">

        {/* Tabs */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex gap-1 bg-dark-bg rounded-xl p-1">
            {['swap', 'bridge'].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all capitalize ${activeTab === tab ? 'bg-dark-card text-white shadow-sm' : 'text-dark-muted hover:text-white'}`}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
          <div className="flex gap-2 relative" ref={settingsRef}>
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
                      <input 
                        type="number" 
                        placeholder="Custom" 
                        value={['0.1', '0.5', '1.0'].includes(slippage) ? '' : slippage}
                        onChange={(e) => setSlippage(e.target.value)}
                        className={`w-16 bg-dark-input border rounded-lg text-center text-xs text-white outline-none placeholder-dark-muted ${!['0.1', '0.5', '1.0'].includes(slippage) && slippage ? 'border-blue-500 bg-blue-600/20' : 'border-dark-border focus:border-blue-500'}`} 
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-dark-muted pt-2 border-t border-dark-border/50">
                    Slippage settings are auto-optimized for best practices on {isCurrentMainnet ? 'Arc Mainnet' : 'Arc Testnet'}.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Swap Interface */}
        {activeTab === 'swap' && (
          <div className="flex flex-col gap-1">
            {/* From */}
            <div className="bg-dark-bg/80 border border-dark-border/60 hover:border-dark-border rounded-2xl p-5 pb-7 flex flex-col justify-between transition-all">
              <div className="text-sm font-medium text-dark-muted mb-3 flex justify-between">
                <span>You pay</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <div className="flex flex-col items-start w-full">
                  <input type="number" placeholder="0" value={amount}
                    onChange={(e) => { setAmount(e.target.value); setSwapStatus('idle'); setSwapError(''); }}
                    className="w-full bg-transparent text-left text-4xl font-black text-white placeholder-dark-border outline-none tracking-tight min-w-0" />
                  {inputUsd && inputUsd !== '--' && <div className="text-xs font-medium text-dark-muted mt-1">~$ {inputUsd}</div>}
                </div>
                <div className="flex flex-col items-end shrink-0">
                  <button onClick={() => { setSelectingFor('in'); setIsSwapModalOpen(true); }}
                    className="flex items-center gap-2 bg-dark-card border border-dark-border hover:bg-dark-border/80 transition-all rounded-full py-1.5 px-3 shadow-lg group">
                    <TokenIcon token={tokenIn} size="sm" />
                    <span className="font-bold text-white text-lg tracking-wide">{tokenIn.symbol}</span>
                    <svg className="w-5 h-5 text-dark-muted group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </button>
                  <span className={`flex items-center gap-1.5 text-[11px] mt-2 font-semibold cursor-pointer transition-colors ${isInsufficientBalance ? 'text-red-400 font-bold' : 'text-dark-muted hover:text-white'}`}
                    onClick={() => { if (balInData) setAmount(balInData.formatted); }}>
                    Balance: {fmtInSwap} {tokenIn.symbol}
                  </span>
                </div>
              </div>
            </div>

            {/* Arrow */}
            <div className="relative h-2 flex items-center justify-center z-10 -my-3">
              <div onClick={() => { 
                  setTokenIn(tokenOut); setTokenOut(tokenIn); 
                  if (quote && quote.amountOutDecimals) {
                    setAmount(Number(quote.amountOutDecimals).toString());
                  } else {
                    setAmount('');
                  }
                  setQuote(null); setSwapStatus('idle'); 
                }}
                className="absolute w-10 h-10 bg-dark-card border-4 border-dark-bg rounded-xl flex items-center justify-center text-dark-muted hover:text-white transition-all hover:bg-dark-border cursor-pointer shadow-lg hover:rotate-180 duration-500">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
              </div>
            </div>

            {/* To */}
            <div className="bg-dark-bg/80 border border-dark-border/60 hover:border-dark-border rounded-2xl p-5 pb-7 flex flex-col justify-between transition-all">
              <div className="text-sm font-medium text-dark-muted mb-3 flex justify-between">
                <span>You receive</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <div className="flex flex-col items-start w-full">
                  <div className="w-full text-left text-4xl font-black tracking-tight min-w-0">
                    {quoteLoading
                      ? <span className="text-dark-muted text-2xl animate-pulse">...</span>
                      : outputAmount
                        ? <span className="text-white">{outputAmount}</span>
                        : <span className="text-dark-border">0</span>}
                  </div>
                  {quoteLoading && amount && amount > 0 ? (
                    <div className="text-xs font-medium flex items-center gap-1.5 mt-1">
                      <span className="text-dark-muted animate-pulse">~$ ...</span>
                    </div>
                  ) : outputUsd && outputUsd !== '--' && (
                    <div className="text-xs font-medium flex items-center gap-1.5 mt-1">
                      <span className="text-dark-muted">~$ {outputUsd}</span>
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-end shrink-0">
                  <button onClick={() => { setSelectingFor('out'); setIsSwapModalOpen(true); }}
                    className="flex items-center gap-2 bg-dark-card border border-dark-border hover:bg-dark-border/80 transition-all rounded-full py-1.5 px-3 shadow-lg group">
                    <TokenIcon token={tokenOut} size="sm" />
                    <span className="font-bold text-white text-lg tracking-wide">{tokenOut.symbol}</span>
                    <svg className="w-5 h-5 text-dark-muted group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </button>
                  <span className="flex items-center gap-1.5 text-[11px] mt-2 text-dark-muted font-semibold cursor-pointer hover:text-white transition-colors">
                    Balance: {fmtOutSwap} {tokenOut.symbol}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Bridge Interface */}
        {activeTab === 'bridge' && (
          <div className="flex flex-col gap-1">
            {/* From */}
            <div className="bg-dark-bg/80 border border-dark-border/60 hover:border-dark-border rounded-2xl p-5 pb-7 flex flex-col justify-between transition-all">
              <div className="text-sm font-medium text-dark-muted mb-3 flex justify-between">
                <span>Bridge from</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <div className="flex flex-col items-start w-full">
                  <input type="number" placeholder="0" value={amount}
                    onChange={(e) => { 
                      const val = e.target.value;
                      setAmount(val); 
                      setSwapStatus('idle'); 
                      setSwapError(''); 
                      if (val && Number(val) > 0) {
                        setQuote({ amountOutDecimals: val, routeString: 'CCTP Routing', priceImpact: '0.00' });
                      } else {
                        setQuote(null);
                      }
                    }}
                    className="w-full bg-transparent text-left text-4xl font-black text-white placeholder-dark-border outline-none tracking-tight min-w-0" />
                  {inputUsd && inputUsd !== '--' && <div className="text-xs font-medium text-dark-muted mt-1">~$ {inputUsd}</div>}
                </div>
                <div className="flex flex-col items-end shrink-0">
                  <button onClick={() => { setSelectingFor('in'); setIsBridgeModalOpen(true); }}
                    className="flex items-center gap-2 bg-dark-card border border-dark-border hover:bg-dark-border/80 transition-all rounded-full py-1.5 px-3 shadow-lg group">
                    <div className="relative flex shrink-0">
                      <TokenIcon token={bridgeTokenIn} size="sm" />
                      <div className="absolute -bottom-1 -right-1">
                         <ChainBadge chain={bridgeChainIn} />
                      </div>
                    </div>
                    <span className="font-bold text-white text-lg tracking-wide">{bridgeTokenIn.symbol}</span>
                    <svg className="w-5 h-5 text-dark-muted group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </button>
                  <span className={`flex items-center gap-1.5 text-[11px] mt-2 font-semibold cursor-pointer transition-colors ${isInsufficientBalance ? 'text-red-400 font-bold' : 'text-dark-muted hover:text-white'}`}
                    onClick={() => { if (bridgeBalInData) setAmount(bridgeBalInData.formatted); }}>
                    Balance: {fmtInBridge} {bridgeTokenIn.symbol}
                  </span>
                </div>
              </div>
            </div>

            {/* Arrow */}
            <div className="relative h-2 flex items-center justify-center z-10 -my-3">
              <div onClick={() => { 
                  const targetChain = bridgeChainOut;
                  setBridgeChainIn(bridgeChainOut); setBridgeChainOut(bridgeChainIn); 
                  setBridgeTokenIn(bridgeTokenOut); setBridgeTokenOut(bridgeTokenIn);
                  if (quote && quote.amountOutDecimals) {
                    setAmount(Number(quote.amountOutDecimals).toString());
                  } else {
                    setAmount('');
                  }
                  setQuote(null); setSwapStatus('idle'); 

                  // Automatically prompt wallet to switch to the new source chain
                  if (address && connectedChainId && targetChain && targetChain.id !== connectedChainId) {
                    try {
                      switchChain({ chainId: targetChain.id });
                    } catch (_) {}
                  }
                }}
                className="absolute w-10 h-10 bg-dark-card border-4 border-dark-bg rounded-xl flex items-center justify-center text-dark-muted hover:text-white transition-all hover:bg-dark-border cursor-pointer shadow-lg hover:rotate-180 duration-500">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
              </div>
            </div>

            {/* To */}
            <div className="bg-dark-bg/80 border border-dark-border/60 hover:border-dark-border rounded-2xl p-5 pb-7 flex flex-col justify-between transition-all">
              <div className="text-sm font-medium text-dark-muted mb-3 flex justify-between">
                <span>Bridge to</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <div className="flex flex-col items-start w-full">
                  <div className="w-full text-left text-4xl font-black tracking-tight min-w-0">
                    {outputAmount
                      ? <span className="text-white">{outputAmount}</span>
                      : <span className="text-dark-border">0</span>}
                  </div>
                  {outputUsd && outputUsd !== '--' && (
                    <div className="text-xs font-medium flex items-center gap-1.5 mt-1">
                      <span className="text-dark-muted">~$ {outputUsd}</span>
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-end shrink-0">
                  <button onClick={() => { setSelectingFor('out'); setIsBridgeModalOpen(true); }}
                    className="flex items-center gap-2 bg-dark-card border border-dark-border hover:bg-dark-border/80 transition-all rounded-full py-1.5 px-3 shadow-lg group">
                    <div className="relative flex shrink-0">
                      <TokenIcon token={bridgeTokenOut} size="sm" />
                      <div className="absolute -bottom-1 -right-1">
                         <ChainBadge chain={bridgeChainOut} />
                      </div>
                    </div>
                    <span className="font-bold text-white text-lg tracking-wide">{bridgeTokenOut.symbol}</span>
                    <svg className="w-5 h-5 text-dark-muted group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </button>
                  <span className="flex items-center gap-1.5 text-[11px] mt-2 text-dark-muted font-semibold cursor-pointer hover:text-white transition-colors">
                    Balance: {fmtOutBridge} {bridgeTokenOut.symbol}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Swap Multi-DEX Quotes Comparison */}
        {activeTab === 'swap' && (quote || quoteLoading || quoteError) && (
          <div className="mt-4 mb-2 bg-[#0B111E]/90 border border-dark-border/80 rounded-2xl p-4 shadow-xl flex flex-col gap-3 backdrop-blur-md transition-all">


            {/* Content */}
            {quoteLoading && !quote ? (
              <div className="py-5 flex flex-col items-center justify-center gap-2 text-dark-muted">
                <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs font-medium animate-pulse">Calculating best route...</span>
              </div>
            ) : quoteError ? (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center justify-between">
                <span>{quoteError}</span>
                <span className="text-[10px] text-dark-muted">Check token liquidity</span>
              </div>
            ) : dexQuotes.length > 0 ? (
              <div className="flex flex-col gap-2">
                {dexQuotes.map((q) => {
                  const isSelected = selectedDEX === q.id;
                  return (
                    <div
                      key={q.id}
                      onClick={() => setSelectedDEX(q.id)}
                      className={`p-3 rounded-xl border flex items-center justify-between transition-all cursor-pointer ${
                        isSelected
                          ? 'border-blue-500/60 bg-blue-500/10 shadow-[0_0_12px_rgba(59,130,246,0.1)]'
                          : 'border-dark-border/60 bg-dark-bg/40 hover:border-dark-border/80'
                      }`}
                    >
                      {/* Left: Brand Logo + Name + Best Price Badge */}
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-[#0E1525] border border-white/10 p-1.5 flex items-center justify-center shrink-0 shadow-sm overflow-hidden">
                          <img
                            src={q.logo}
                            alt={q.name}
                            className="w-full h-full object-contain"
                          />
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white">
                            {q.name}
                          </span>
                          {q.badge && (
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${q.badgeColor}`}>
                              {q.badge}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Right: Output Amount + USD */}
                      <div className="flex flex-col items-end">
                        <span className="text-sm font-black font-mono tracking-tight text-white">
                          {q.amountOut} {tokenOut.symbol}
                        </span>
                        <span className="text-[11px] text-dark-muted font-medium">
                          {q.usdValue}
                        </span>
                      </div>
                    </div>
                  );
                })}

                {/* Transparency Footer */}
                <div className="pt-2 px-1 flex items-center justify-between text-[11px] text-dark-muted border-t border-dark-border/40">
                  <span className="flex items-center gap-1">
                    <span>Slippage:</span>
                    <strong className="text-white font-mono">{slippage}%</strong>
                  </span>
                  <span className="flex items-center gap-1">
                    <span>Est. Gas:</span>
                    <strong className="text-green-400 font-mono">&lt;0.001 USDC</strong>
                  </span>
                  <span className="text-blue-400 font-medium">
                    Arc Native L1
                  </span>
                </div>
              </div>
            ) : null}
          </div>
        )}

        {/* Bridge Detailed Info */}
        {activeTab === 'bridge' && (
          <div className="mt-5 mb-2 px-1 flex flex-col gap-6">
            <div className="flex justify-start">
               <button onClick={() => setIsReceiverModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-dark-bg/60 hover:bg-dark-border transition-colors border border-dark-border/50 rounded-full text-xs font-bold text-white shadow-sm">
                 {receiverAddress ? (
                   <>
                     <div className="w-4 h-4 rounded-full bg-blue-500 shadow-inner flex-shrink-0" />
                     {receiverAddress.slice(0, 6)}...{receiverAddress.slice(-4)}
                   </>
                 ) : (
                   <>
                     <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                     Add receiving wallet
                   </>
                 )}
               </button>
            </div>
            {Number(amount) > 0 && (
              <div className="flex flex-col gap-3 px-1">
                 <div className="flex items-center justify-between text-sm">
                   <span className="text-dark-muted font-medium">Bridge Fee</span>
                   {quoteLoading ? (
                      <span className="text-dark-muted animate-pulse">Calculating...</span>
                   ) : (
                      <span className="text-white font-bold">{quote ? `0.20 ${bridgeTokenIn.symbol}` : '--'}</span>
                   )}
                 </div>
                 <div className="flex items-center justify-between text-sm">
                   <span className="text-dark-muted font-medium">Estimated Time</span>
                   {quoteLoading ? (
                      <span className="text-dark-muted animate-pulse">Calculating...</span>
                   ) : (
                      <span className="text-white font-bold">{quote ? getEstimatedTime(bridgeChainIn.id, bridgeChainOut.id) : '--'}</span>
                   )}
                 </div>
              </div>
            )}
          </div>
        )}

        {/* Error */}
        {swapStatus === 'error' && swapError && (
          <div className="mt-2 px-3 py-2 bg-red-900/30 border border-red-500/40 rounded-xl text-xs text-red-300 break-all">
            ⚠️ {swapError}
          </div>
        )}

        {/* Action Button */}
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

        {/* Tx hash */}
        {txHash && (
          <div className="mt-3 text-center text-xs text-dark-muted">
            Tx: <a href={`${connectedChainId === arcMainnet.id ? 'https://explorer.arc.io' : 'https://testnet.arcscan.app'}/tx/${txHash}`} target="_blank" rel="noopener noreferrer"
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
        token={actualTokenIn}
        userAddress={address}
        receiverAddress={receiverAddress}
        onComplete={() => {
          setIsBridgeExecutionModalOpen(false);
          setAmount('');
        }}
      />

      <ReceivingWalletModal
        isOpen={isReceiverModalOpen}
        onClose={() => setIsReceiverModalOpen(false)}
        onSave={(addr) => setReceiverAddress(addr)}
        initialAddress={receiverAddress}
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
        slippage={slippage}
        quote={quote}
        selectedDEX={selectedDEX}
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

// Icons 
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
