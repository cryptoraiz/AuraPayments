import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAccount, useBalance, useChainId, useConnect, useSwitchChain } from 'wagmi';
import { useQueryClient } from '@tanstack/react-query';
import { arcMainnet, arcTestnet } from '../../config/wagmi';
import { useActiveArcChain } from '../../hooks/useActiveArcChain';
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
import { getPendingBridge } from '../../utils/localStorage';
import { BRIDGE_FEE } from '../../config/constants';

// Config 
const SYNTHRA_API      = (import.meta.env.VITE_SYNTHRA_API_BASE || 'https://trading-api.synthra.org').replace(/\/+$/, '');
const SYNTHRA_KEY_TEST = import.meta.env.VITE_SYNTHRA_API_KEY  || '';
const SYNTHRA_KEY_PRD  = import.meta.env.VITE_SYNTHRA_API_PRD  || import.meta.env.VITE_SYNTHRA_API_KEY || '';
const TOWER_API        = (import.meta.env.VITE_TOWER_API_BASE   || 'https://www.tower.exchange').replace(/\/+$/, '');
const TOWER_KEY_TEST   = import.meta.env.VITE_TOWER_API_KEY_TEST || '';
const TOWER_KEY_PRD    = import.meta.env.VITE_TOWER_API_KEY_PRD  || import.meta.env.VITE_TOWER_API_KEY || '';
const UNISWAP_KEY      = import.meta.env.VITE_UNISWAP_API_KEY    || '';
const ARC_CHAIN_ID     = arcMainnet.id;



import { toRaw } from '../../utils/chainUtils';
import { useTokenPrices, formatUsdValue } from '../../hooks/useTokenPrices';
import { fetchUniswapArcQuote } from '../../utils/uniswapArc';

// Component 
export default function DeFiWidget({ defaultTab = 'swap' }) {
  const { address }   = useAccount();
  const { connect, connectors } = useConnect();
  const { switchChain, switchChainAsync } = useSwitchChain();
  const navigate = useNavigate();
  const connectedChainId = useChainId();
  const { isMainnet, isTestnet, chainId: activeArcChainId } = useActiveArcChain();
  const queryClient = useQueryClient();
  const { prices } = useTokenPrices();

  // Resilient Network Switching with Raw Fallback
  const handleSwitchNetwork = async (targetChainId) => {
    if (!targetChainId) return;
    try {
      if (switchChainAsync) {
        await switchChainAsync({ chainId: targetChainId });
      } else {
        await switchChain({ chainId: targetChainId });
      }
      queryClient.invalidateQueries();
    } catch (err) {
      if (err?.code === 4001 || err?.message?.includes('rejected')) return;
      try {
        if (typeof window !== 'undefined' && window.ethereum) {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: `0x${targetChainId.toString(16)}` }],
          });
          queryClient.invalidateQueries();
        }
      } catch (fallbackErr) {
        if (fallbackErr?.code === 4001 || fallbackErr?.message?.includes('rejected')) return;
        console.warn('Network switch failed:', fallbackErr);
      }
    }
  };

  // Invalidate balance caches on network switch
  useEffect(() => {
    queryClient.invalidateQueries();
  }, [connectedChainId, queryClient]);

  const [searchParams] = useSearchParams();
  const queryTab = searchParams.get('tab');
  const queryAmount = searchParams.get('amount');
  const queryFrom = searchParams.get('from');
  const queryTo = searchParams.get('to');

  const [activeTab, setActiveTab] = useState(() => queryTab || defaultTab);
  const [amount,    setAmount]    = useState(() => queryAmount || '');
  
  // Swap State 
  const initialArcId = isMainnet ? arcMainnet.id : arcTestnet.id;
  const initialCounterChainId = isMainnet ? 8453 : 84532;

  const [tokenIn,  setTokenIn]  = useState(() => {
    if (queryFrom) {
      const found = getTokenBySymbol(queryFrom, initialArcId);
      if (found) return found;
    }
    return getTokenBySymbol('USDC', initialArcId);
  });
  const [tokenOut, setTokenOut] = useState(() => {
    if (queryTo) {
      const found = getTokenBySymbol(queryTo, initialArcId);
      if (found) return found;
    }
    return getTokenBySymbol('EURC', initialArcId);
  });
  
  // Bridge State 
  const [bridgeChainIn,   setBridgeChainIn]   = useState(() => getChainById(initialArcId));
  const [bridgeTokenIn,   setBridgeTokenIn]   = useState(() => getTokenBySymbol('USDC', initialArcId));
  const [bridgeChainOut,  setBridgeChainOut]  = useState(() => getChainById(initialCounterChainId));
  const [bridgeTokenOut,  setBridgeTokenOut]  = useState(() => getTokenBySymbol('USDC', initialCounterChainId));

  useEffect(() => {
    if (queryTab && (queryTab === 'swap' || queryTab === 'bridge')) {
      setActiveTab(queryTab);
    }
    if (queryAmount) {
      setAmount(queryAmount);
    }
    if (queryFrom) {
      const foundIn = getTokenBySymbol(queryFrom, initialArcId);
      if (foundIn) setTokenIn(foundIn);
    }
    if (queryTo) {
      const foundOut = getTokenBySymbol(queryTo, initialArcId);
      if (foundOut) setTokenOut(foundOut);
    }
  }, [queryTab, queryAmount, queryFrom, queryTo, initialArcId]);

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
  const [selectedDEX, setSelectedDEX] = useState('uniswap');
  const selectedDEXRef = useRef(selectedDEX);
  useEffect(() => {
    selectedDEXRef.current = selectedDEX;
  }, [selectedDEX]);
  const [isQuotesExpanded, setIsQuotesExpanded] = useState(true);
  const [refreshCountdown, setRefreshCountdown] = useState(12);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const settingsRef = useRef(null);
  const fetchIdRef = useRef(0);
  const [pendingBridge, setPendingBridge] = useState(null);

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

  useEffect(() => {
    if (address) {
      setPendingBridge(getPendingBridge(address));
    } else {
      setPendingBridge(null);
    }

    const handleUpdate = () => {
      if (address) {
        setPendingBridge(getPendingBridge(address));
      }
    };

    window.addEventListener('pending_bridge_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('pending_bridge_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, [address]);

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
  const quoteRef = useRef(quote);
  useEffect(() => {
    quoteRef.current = quote;
  }, [quote]);
  const [quoteLoading,     setQuoteLoading]     = useState(false);
  const [quoteError,       setQuoteError]       = useState(null);
  const [swapLoading,      setSwapLoading]      = useState(false);
  const [swapStatus,       setSwapStatus]       = useState('idle');
  const [swapError,        setSwapError]        = useState('');
  const [txHash,           setTxHash]           = useState(null);

  // Aura Payments Swap supports Arc Mainnet and Arc Testnet
  const isCurrentTestnet = !isMainnet;
  const isCurrentMainnet = isMainnet;
  const activeSwapChainId = isMainnet ? arcMainnet.id : arcTestnet.id;
  const isSupportedArcChain = connectedChainId === activeSwapChainId;
  const isWrongChain = address && !isSupportedArcChain;

  // Swap Balances 
  // USDC on Arc is the NATIVE currency (precompile 0x3600...). When token is USDC,
  // we pass token: undefined so wagmi reads native balance instead of calling balanceOf.
  const isNativeIn  = tokenIn?.isNative || tokenIn?.symbol === 'USDC' || tokenIn?.address?.toLowerCase()  === '0x3600000000000000000000000000000000000000';
  const isNativeOut = tokenOut?.isNative || tokenOut?.symbol === 'USDC' || tokenOut?.address?.toLowerCase() === '0x3600000000000000000000000000000000000000';

  // Sync bridge chains and swap tokens whenever isMainnet or connectedChainId changes
  useEffect(() => {
    const currentArcId = isMainnet ? arcMainnet.id : arcTestnet.id;
    const defaultCounterChainId = isMainnet ? 8453 : 84532; // Base Mainnet on Mainnet, Base Sepolia on Testnet

    setTokenIn(getTokenBySymbol('USDC', currentArcId));
    setTokenOut(getTokenBySymbol('EURC', currentArcId));
    
    // Enforce strict testnet/mainnet segregation on bridge chains
    const expectedTestnet = !isMainnet;
    if (bridgeChainIn?.isTestnet !== expectedTestnet || bridgeChainOut?.isTestnet !== expectedTestnet) {
      setBridgeChainIn(getChainById(currentArcId));
      setBridgeTokenIn(getTokenBySymbol('USDC', currentArcId));
      setBridgeChainOut(getChainById(defaultCounterChainId));
      setBridgeTokenOut(getTokenBySymbol('USDC', defaultCounterChainId));
    }

    queryClient.invalidateQueries();
  }, [isMainnet, connectedChainId, queryClient]);

  // Invariant Guard: Source and Destination networks must NEVER be the same
  useEffect(() => {
    if (bridgeChainIn && bridgeChainOut && bridgeChainIn.id === bridgeChainOut.id) {
      const complementary = isMainnet
        ? (bridgeChainIn.id === arcMainnet.id ? getChainById(8453) : getChainById(arcMainnet.id))
        : (bridgeChainIn.id === arcTestnet.id ? getChainById(84532) : getChainById(arcTestnet.id));
      setBridgeChainOut(complementary);
    }
  }, [bridgeChainIn, bridgeChainOut, isMainnet]);

  const { data: balInData, refetch: refetchBalIn } = useBalance({
    address,
    token: isNativeIn ? undefined : tokenIn?.address,
    chainId: activeSwapChainId,
    query: { enabled: !!address, refetchInterval: 3_000, staleTime: 0 }
  });
  const { data: balOutData, refetch: refetchBalOut } = useBalance({
    address,
    token: isNativeOut ? undefined : tokenOut?.address,
    chainId: activeSwapChainId,
    query: { enabled: !!address, refetchInterval: 3_000, staleTime: 0 }
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

  const { data: bridgeBalInData, refetch: refetchBridgeBalIn } = useBalance({
    address,
    token: (actualTokenIn?.isNative || isBridgeNativeIn) ? undefined : actualTokenIn?.address,
    chainId: bridgeChainIn?.id,
    query: { enabled: !!address, refetchInterval: 5_000, staleTime: 30_000, gcTime: 300_000 }
  });
  const { data: bridgeBalOutData, refetch: refetchBridgeBalOut } = useBalance({
    address,
    token: (actualTokenOut?.isNative || isBridgeNativeOut) ? undefined : actualTokenOut?.address,
    chainId: bridgeChainOut?.id,
    query: { enabled: !!address, refetchInterval: 5_000, staleTime: 30_000, gcTime: 300_000 }
  });
  const fmtInBridge  = formatBalance(bridgeBalInData);
  const fmtOutBridge = formatBalance(bridgeBalOutData);

  // Auto-refresh balances on window focus or when bridge completes
  useEffect(() => {
    const handleRefreshAllBalances = () => {
      refetchBridgeBalIn?.();
      refetchBridgeBalOut?.();
      refetchBalIn?.();
      refetchBalOut?.();
    };
    window.addEventListener('focus', handleRefreshAllBalances);
    window.addEventListener('aura:bridge-complete', handleRefreshAllBalances);
    return () => {
      window.removeEventListener('focus', handleRefreshAllBalances);
      window.removeEventListener('aura:bridge-complete', handleRefreshAllBalances);
    };
  }, [refetchBridgeBalIn, refetchBridgeBalOut, refetchBalIn, refetchBalOut]);

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
  const fetchQuote = useCallback(async (isSilent = false, targetDEX = null) => {
    const currentFetchId = ++fetchIdRef.current;
    const activeDEX = targetDEX || selectedDEXRef.current;

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
      // 1. Guard for upcoming / non-deployed tokens
      if (tokenIn.comingSoon || tokenOut.comingSoon) {
        if (currentFetchId !== fetchIdRef.current) return;
        setQuote(null);
        setQuoteError(`${tokenIn.comingSoon ? tokenIn.symbol : tokenOut.symbol} will be enabled on Arc Mainnet soon.`);
        setQuoteLoading(false);
        setIsRefreshing(false);
        return;
      }

      // 2. Try Uniswap V3 on Arc Mainnet directly via on-chain Quoter
      if (activeDEX === 'uniswap') {
        try {
          const arcUniQuote = await fetchUniswapArcQuote({
            tokenIn,
            tokenOut,
            amountInRaw: rawAmount,
            slippage: Number(slippage || 0.5)
          });
          if (arcUniQuote && arcUniQuote.success) {
            if (currentFetchId !== fetchIdRef.current) return;
            setQuote({
              amountOutDecimals: arcUniQuote.amountOutFormatted,
              amountOutRaw: arcUniQuote.amountOutRaw,
              routeString: arcUniQuote.routeString,
              priceImpact: arcUniQuote.priceImpact,
              fee: arcUniQuote.fee,
              path: arcUniQuote.path,
              isMultihop: arcUniQuote.isMultihop,
              provider: 'uniswap'
            });
            setQuoteLoading(false);
            setIsRefreshing(false);
            setRefreshCountdown(12);
            return;
          }
        } catch (uniErr) {
          console.warn('[Uniswap On-Chain Quote Fallback]', uniErr);
        }

        try {
          const res = await fetch('/api/swap/uniswap/quote', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tokenIn: tokenIn.address,
              tokenOut: tokenOut.address,
              tokenInChainId: activeSwapChainId,
              tokenOutChainId: activeSwapChainId,
              amount: rawAmount,
              swapper: address || '0x0000000000000000000000000000000000000000',
              slippageTolerance: Number(slippage || 0.5)
            })
          });
          const resData = await res.json();
          if (resData?.success && resData?.data?.quote) {
            const outUnits = resData.data.quote.amount || resData.data.quote.output?.amount;
            if (outUnits) {
              const numOut = Number(outUnits) / (10 ** tokenOut.decimals);
              const formattedOut = parseFloat(numOut.toFixed(isStableOut ? 2 : (tokenOut.symbol === 'cirBTC' ? 8 : 4))).toString();
              if (currentFetchId !== fetchIdRef.current) return;
              setQuote({
                amountOutDecimals: formattedOut,
                amountOutRaw: outUnits,
                routeString: 'Uniswap Universal Router (V3)',
                priceImpact: (resData.data.quote.priceImpact || 0).toFixed(2),
                uniswapQuote: resData.data,
                provider: 'uniswap'
              });
              setQuoteLoading(false);
              return;
            }
          }
        } catch (uniErr) {
          console.warn('[Uniswap Quote Fallback]', uniErr);
        }
      }

      // 3. Try Tower Multi-DEX Aggregator if Tower selected
      const activeTowerKey = isCurrentMainnet ? TOWER_KEY_PRD : TOWER_KEY_TEST;
      if (activeDEX === 'tower' && activeTowerKey) {
        try {
          const res = await fetch(`${TOWER_API}/api/public/swap/quote`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': activeTowerKey
            },
            body: JSON.stringify({
              inputToken: tokenIn.address,
              outputToken: tokenOut.address,
              inputAmount: rawAmount,
              slippageTolerance: Math.round(Number(slippage || 0.5) * 100),
              chainId: activeSwapChainId
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
            const numOut = Number(outUnits) / (10 ** decimals);
            const formattedOut = parseFloat(numOut.toFixed(isStableOut ? 2 : (tokenOut.symbol === 'cirBTC' ? 8 : 4))).toString();
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

      // 4. Fallback to Uniswap V3 on-chain quoter if selected DEX didn't return
      try {
        const arcUniQuote = await fetchUniswapArcQuote({
          tokenIn,
          tokenOut,
          amountInRaw: rawAmount,
          slippage: Number(slippage || 0.5)
        });
        if (arcUniQuote && arcUniQuote.success) {
          if (currentFetchId !== fetchIdRef.current) return;
          setQuote({
            amountOutDecimals: arcUniQuote.amountOutFormatted,
            amountOutRaw: arcUniQuote.amountOutRaw,
            routeString: arcUniQuote.routeString,
            priceImpact: arcUniQuote.priceImpact,
            fee: arcUniQuote.fee,
            path: arcUniQuote.path,
            isMultihop: arcUniQuote.isMultihop,
            provider: 'uniswap'
          });
          setQuoteLoading(false);
          setIsRefreshing(false);
          setRefreshCountdown(12);
          return;
        }
      } catch (uniErr) {
        console.warn('[Uniswap Final Fallback]', uniErr);
      }

      if (currentFetchId !== fetchIdRef.current) return;
      setQuote(null);
      setQuoteError(`No liquidity pool found on Uniswap V3 for ${tokenIn.symbol}/${tokenOut.symbol}`);
      setQuoteLoading(false);
      setIsRefreshing(false);
      return;
    }

    try {
      const activeSynthraKey = isCurrentMainnet ? SYNTHRA_KEY_PRD : SYNTHRA_KEY_TEST;
      const res = await fetch(`${SYNTHRA_API}/v1/quote`, {
        method:  'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': activeSynthraKey },
        body: JSON.stringify({
          chainId:   activeSwapChainId,
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
    if (!amount || Number(String(amount).replace(',', '.')) <= 0) {
      setQuote(null);
      setQuoteLoading(false);
      return;
    }
    const hasExistingQuote = Boolean(quoteRef.current);
    if (!hasExistingQuote) {
      setQuoteLoading(true);
    }
    const t = setTimeout(() => fetchQuote(hasExistingQuote), 200);
    return () => clearTimeout(t);
  }, [fetchQuote, activeTab, amount, tokenIn.symbol, tokenOut.symbol]);

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
    setQuote(null);
    setQuoteError(null);
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
    if (amount && Number(amount) > 0) {
      setQuoteLoading(true);
    }
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
        handleSwitchNetwork(selection.chain.id);
      }
    } else {
      if (selection.chain.id === bridgeChainIn.id) {
         setBridgeChainIn(bridgeChainOut);
         setBridgeTokenIn(bridgeTokenOut);
         if (address && connectedChainId && bridgeChainOut.id !== connectedChainId) {
           handleSwitchNetwork(bridgeChainOut.id);
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
        await handleSwitchNetwork(bridgeChainIn.id);
        return;
      }

      if (bridgeChainIn.id === bridgeChainOut.id) {
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
      await handleSwitchNetwork(activeSwapChainId);
      return;
    }

    if (!quote)                               { alert('Please wait for the quote to load.'); return; }
    const rawAmount = toRaw(amount, tokenIn.decimals);
    if (!rawAmount) return;

    setIsSwapExecutionModalOpen(true);
  };

  const getEstimatedTime = (fromId, toId) => {
    // Ethereum L1 requires standard block confirmations (~1-2 minutes via CCTP v2)
    const isEthL1 = fromId === 1 || fromId === 11155111 || toId === 1 || toId === 11155111;
    if (isEthL1) {
      return '~1-2 minutes';
    }
    // Arc Network (sub-second finality) and fast L2s (Base, Arbitrum, Optimism, Polygon)
    return '~20-30 seconds';
  };

  // UI Helpers 
  const activeTokenIn = activeTab === 'bridge' ? bridgeTokenIn : tokenIn;
  const activeTokenOut = activeTab === 'bridge' ? bridgeTokenOut : tokenOut;
  const isStableOut = ['USDC', 'USDT', 'EURC', 'WUSDC'].includes(activeTokenOut.symbol);
  
  const netBridgeAmount = (activeTab === 'bridge' && amount && Number(amount) > 0) 
    ? (BRIDGE_FEE > 0 && Number(amount) > BRIDGE_FEE ? (Number(amount) - BRIDGE_FEE) : Number(amount)) 
    : 0;

  const outputAmount = activeTab === 'bridge'
    ? (amount && Number(amount) > 0 
        ? (netBridgeAmount > 0 
            ? netBridgeAmount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 6, useGrouping: false }) 
            : '0')
        : '')
    : (quote 
        ? Number(quote.amountOutDecimals).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: isStableOut ? 2 : (activeTokenOut.symbol === 'cirBTC' ? 8 : 6), useGrouping: false }) 
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

    const rawList = isCurrentMainnet ? [
      {
        id: 'uniswap',
        name: 'Uniswap V3',
        rawNumeric: baseOut,
        amountOut: outputAmount,
        usdValue: `~$ ${(baseOut * outPrice).toFixed(2)}`,
        logo: '/dex-icons/uniswap.svg'
      },
      {
        id: 'tower',
        name: 'Tower DEX',
        rawNumeric: baseOut * 0.9997,
        amountOut: parseFloat((baseOut * 0.9997).toFixed(isStableOut ? 2 : (activeTokenOut.symbol === 'cirBTC' ? 8 : 4))).toString(),
        usdValue: `~$ ${(baseOut * 0.9997 * outPrice).toFixed(2)}`,
        logo: '/dex-icons/tower.svg'
      },
      {
        id: 'synthra',
        name: 'Synthra DEX',
        rawNumeric: baseOut * 0.9994,
        amountOut: parseFloat((baseOut * 0.9994).toFixed(isStableOut ? 2 : (activeTokenOut.symbol === 'cirBTC' ? 8 : 4))).toString(),
        usdValue: `~$ ${(baseOut * 0.9994 * outPrice).toFixed(2)}`,
        logo: '/dex-icons/synthra.png'
      }
    ] : [
      {
        id: 'uniswap',
        name: 'Uniswap (Universal)',
        rawNumeric: baseOut,
        amountOut: outputAmount,
        usdValue: `~$ ${(baseOut * 1).toFixed(2)}`,
        logo: '/dex-icons/uniswap.svg'
      },
      {
        id: 'tower',
        name: 'Tower Testnet',
        rawNumeric: baseOut * 0.9996,
        amountOut: parseFloat((baseOut * 0.9996).toFixed(isStableOut ? 2 : (activeTokenOut.symbol === 'cirBTC' ? 8 : 4))).toString(),
        usdValue: `~$ ${(baseOut * 1).toFixed(2)}`,
        logo: '/dex-icons/tower.svg'
      },
      {
        id: 'synthra',
        name: 'Synthra Testnet',
        rawNumeric: baseOut * 0.9992,
        amountOut: parseFloat((baseOut * 0.9992).toFixed(isStableOut ? 2 : (activeTokenOut.symbol === 'cirBTC' ? 8 : 4))).toString(),
        usdValue: `~$ ${(baseOut * 1).toFixed(2)}`,
        logo: '/dex-icons/synthra.png'
      }
    ];

    const sorted = [...rawList].sort((a, b) => b.rawNumeric - a.rawNumeric);

    return sorted.map((item, index) => ({
      ...item,
      badge: index === 0 ? 'Best Price' : null,
      badgeColor: index === 0 ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : ''
    }));
  }, [amount, outputAmount, isCurrentMainnet, prices, activeTokenOut, isStableOut]);

  // Keep system automatically locked to the Best Price DEX if current is invalid or unset
  useEffect(() => {
    if (dexQuotes.length > 0) {
      const hasCurrent = dexQuotes.some(q => q.id === selectedDEX);
      if (!hasCurrent) {
        setSelectedDEX(dexQuotes[0].id);
      }
    }
  }, [dexQuotes, selectedDEX]);

  const isBridgeWrongChain = activeTab === 'bridge' && address && connectedChainId && bridgeChainIn && connectedChainId !== bridgeChainIn.id;

  const isBelowMinBridge = activeTab === 'bridge' && BRIDGE_FEE > 0 && amount && Number(amount) > 0 && Number(amount) <= BRIDGE_FEE;

  let btnLabel = activeTab === 'swap' ? 'Swap Tokens' : 'Bridge Assets';
  if (!address)                                        btnLabel = 'Connect Wallet';
  else if (activeTab === 'swap' && isWrongChain)       btnLabel = 'Switch to Arc Network';
  else if (isBridgeWrongChain)                         btnLabel = `Switch to ${bridgeChainIn.name}`;
  else if (swapStatus === 'approving')                 btnLabel = '⏳ Approving Token...';
  else if (swapStatus === 'swapping')                  btnLabel = '⏳ Sending Transaction...';
  else if (swapStatus === 'success')                   btnLabel = '✅ Completed!';
  else if (swapStatus === 'error')                     btnLabel = '❌ Failed - Try Again';
  else if (!amount || Number(amount) <= 0)             btnLabel = 'Enter an Amount';
  else if (isBelowMinBridge)                           btnLabel = `Min. bridge is ${(BRIDGE_FEE + 0.20).toFixed(2)} ${activeTokenIn?.symbol || 'USDC'}`;
  else if (isInsufficientBalance)                      btnLabel = `Insufficient ${activeTokenIn?.symbol || 'USDC'} balance`;
  else if (quoteLoading)                               btnLabel = 'Fetching route...';
  else if (activeTab === 'swap' && (tokenIn.comingSoon || tokenOut.comingSoon)) btnLabel = `${tokenIn.comingSoon ? tokenIn.symbol : tokenOut.symbol} Coming Soon`;
  else if (quoteError)                                 btnLabel = 'No Route Available';

  // Only disable the button if connected AND missing info/wrong chain or insufficient balance
  const btnDisabled = address && (
    (activeTab === 'swap' && isWrongChain) || isBridgeWrongChain
      ? false 
      : (swapLoading || quoteLoading || !quote || !amount || Number(amount) <= 0 || isBelowMinBridge || isInsufficientBalance || swapStatus === 'success')
  );

  return (
    <div className={`flex flex-col ${isNotebook ? 'md:flex-row md:items-stretch' : 'lg:flex-row lg:items-start'} items-center justify-center gap-3 sm:gap-4 lg:gap-5 w-full mx-auto transition-all ${
      activeTab === 'swap' && (quote || quoteLoading || quoteError)
        ? (isNotebook ? 'max-w-4xl' : 'max-w-5xl')
        : (isNotebook ? 'max-w-[420px]' : 'max-w-[480px]')
    } ${isNotebook ? 'flex-1 h-full min-h-0' : ''}`}>
      <div className={`bg-dark-card border border-dark-border shadow-2xl w-full shrink-0 transition-all ${
        isNotebook
          ? 'max-w-[420px] rounded-2xl p-2.5 sm:p-3 flex-1 h-full min-h-0 flex flex-col justify-between overflow-hidden'
          : 'max-w-[480px] rounded-2xl sm:rounded-3xl p-4 sm:p-5'
      }`}>

        {/* Tabs */}
        <div className={`flex items-center justify-between ${isNotebook ? 'mb-1.5' : 'mb-3 sm:mb-4'}`}>
          <div className="flex gap-1 bg-dark-bg rounded-xl p-1">
            {['swap', 'bridge'].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`rounded-lg font-semibold transition-all capitalize ${
                  isNotebook
                    ? 'px-3 py-1 text-xs'
                    : 'px-4 sm:px-5 py-1.5 sm:py-2 text-xs sm:text-sm'
                } ${activeTab === tab ? 'bg-dark-card text-white shadow-sm' : 'text-dark-muted hover:text-white'}`}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
          <div className="flex gap-2 relative" ref={settingsRef}>
            <button onClick={() => setIsHistoryModalOpen(true)} title={activeTab === 'swap' ? 'Swap History' : 'Bridge History'}
              className={`${isNotebook ? 'w-7 h-7' : 'w-9 h-9'} flex items-center justify-center rounded-full bg-dark-bg text-dark-muted hover:text-white hover:bg-dark-border transition-all`}>
              <svg className={`${isNotebook ? 'w-3.5 h-3.5' : 'w-4 h-4'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            <button onClick={() => setShowSettings(!showSettings)} title="Slippage Settings" className={`${isNotebook ? 'w-7 h-7' : 'w-9 h-9'} flex items-center justify-center rounded-full transition-all ${showSettings ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)]' : 'bg-dark-bg text-dark-muted hover:text-white hover:bg-dark-border'}`}>
              <svg className={`${isNotebook ? 'w-3.5 h-3.5' : 'w-4 h-4'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
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

        {/* Pending Bridge Banner */}
        {pendingBridge && (
          <div className={`${isNotebook ? 'mb-2.5 p-2 sm:p-2.5 rounded-xl' : 'mb-4 p-3 rounded-2xl'} bg-gradient-to-r from-blue-900/40 via-sky-900/30 to-blue-900/40 border border-blue-500/30 flex items-center justify-between gap-3 shadow-lg animate-fadeIn`}>
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-ping shrink-0" />
              <div className="truncate">
                <div className="text-white text-xs font-bold truncate">
                  Pending Bridge: {pendingBridge.amount} {pendingBridge.tokenSymbol}
                </div>
                <div className="text-blue-300 text-[11px] truncate">
                  {pendingBridge.fromChainName} ➔ {pendingBridge.toChainName} (Circle CCTP)
                </div>
              </div>
            </div>
            <button
              onClick={() => setIsBridgeExecutionModalOpen(true)}
              className="px-3 py-1.5 bg-[#4A90E2] hover:bg-[#357ABD] text-white text-xs font-bold rounded-xl transition-all shrink-0 shadow-[0_0_10px_rgba(74,144,226,0.5)]"
            >
              Resume / Track
            </button>
          </div>
        )}

        {/* Swap Interface */}
        {activeTab === 'swap' && (
          <div className={`flex flex-col ${isNotebook ? 'gap-1.5' : 'gap-1'}`}>
            {/* From */}
            <div className={`bg-dark-bg/80 border border-dark-border/60 hover:border-dark-border rounded-2xl flex flex-col justify-between transition-all ${
              isNotebook 
                ? 'p-2.5 sm:p-3 min-h-[82px] max-h-[92px]' 
                : 'p-3 sm:p-4 md:p-5 md:pb-6 min-h-[110px] sm:min-h-[130px]'
            }`}>
              <div className={`font-medium text-dark-muted flex justify-between ${isNotebook ? 'text-[11px] mb-1' : 'text-sm mb-3'}`}>
                <span>You pay</span>
              </div>
              <div className="flex items-center justify-between gap-3 sm:gap-4">
                <div className="flex flex-col items-start w-full">
                  <input type="number" placeholder="0" value={amount}
                    onChange={(e) => { setAmount(e.target.value); setSwapStatus('idle'); setSwapError(''); }}
                    className={`w-full bg-transparent text-left font-black text-white placeholder-dark-border outline-none tracking-tight min-w-0 ${
                      isNotebook ? 'text-2xl font-black' : 'text-4xl'
                    }`} />
                  <div className={`${isNotebook ? 'h-3.5 text-[10px] mt-0.5' : 'h-5 text-xs mt-1'} flex items-center font-medium text-dark-muted`}>
                    {inputUsd && inputUsd !== '--' ? `~$ ${inputUsd}` : <span className="invisible">~$ 0.00</span>}
                  </div>
                </div>
                <div className="flex flex-col items-end shrink-0">
                  <button onClick={() => { setSelectingFor('in'); setIsSwapModalOpen(true); }}
                    className={`flex items-center gap-2 bg-dark-card border border-dark-border hover:bg-dark-border/80 transition-all rounded-full shadow-lg group ${
                      isNotebook ? 'py-1 px-2.5' : 'py-1.5 px-3'
                    }`}>
                    <TokenIcon token={tokenIn} size={isNotebook ? 'xs' : 'sm'} />
                    <span className={`font-bold text-white tracking-wide ${isNotebook ? 'text-sm sm:text-base' : 'text-lg'}`}>{tokenIn.symbol}</span>
                    <svg className={`${isNotebook ? 'w-4 h-4' : 'w-5 h-5'} text-dark-muted group-hover:text-white transition-colors`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </button>
                  <span className={`flex items-center gap-1.5 font-semibold cursor-pointer transition-colors ${isNotebook ? 'text-[10px] mt-0.5' : 'text-[11px] mt-2'} ${isInsufficientBalance ? 'text-red-400 font-bold' : 'text-dark-muted hover:text-white'}`}
                    onClick={() => { if (balInData) setAmount(balInData.formatted); }}>
                    Balance: {fmtInSwap} {tokenIn.symbol}
                  </span>
                </div>
              </div>
            </div>

            {/* Arrow */}
            <div className={`relative h-2 flex items-center justify-center z-10 shrink-0 ${isNotebook ? '-my-1' : '-my-3'}`}>
              <div onClick={() => { 
                  const prevOut = quote?.amountOutDecimals;
                  setQuote(null);
                  setQuoteError(null);
                  setTokenIn(tokenOut); 
                  setTokenOut(tokenIn); 
                  if (prevOut && Number(prevOut) > 0) {
                    setAmount(Number(prevOut).toString());
                    setQuoteLoading(true);
                  } else {
                    setAmount('');
                    setQuoteLoading(false);
                  }
                  setSwapStatus('idle'); 
                }}
                className={`absolute bg-dark-card border-4 border-dark-bg rounded-xl flex items-center justify-center text-dark-muted hover:text-white transition-all hover:bg-dark-border cursor-pointer shadow-lg hover:rotate-180 duration-500 ${
                  isNotebook ? 'w-7 h-7' : 'w-10 h-10'
                }`}>
                <svg className={`${isNotebook ? 'w-3.5 h-3.5' : 'w-5 h-5'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
              </div>
            </div>

            {/* To */}
            <div className={`bg-dark-bg/80 border border-dark-border/60 hover:border-dark-border rounded-2xl flex flex-col justify-between transition-all ${
              isNotebook 
                ? 'p-2.5 sm:p-3 min-h-[82px] max-h-[92px]' 
                : 'p-3 sm:p-4 md:p-5 md:pb-6 min-h-[110px] sm:min-h-[130px]'
            }`}>
              <div className={`font-medium text-dark-muted flex justify-between ${isNotebook ? 'text-[11px] mb-1' : 'text-sm mb-3'}`}>
                <span>You receive</span>
              </div>
              <div className="flex items-center justify-between gap-3 sm:gap-4">
                <div className="flex flex-col items-start w-full">
                  <div className={`w-full text-left font-black tracking-tight min-w-0 flex items-center ${
                    isNotebook ? 'text-2xl h-7' : 'text-4xl h-10'
                  }`}>
                    {quoteLoading
                      ? <span className={`text-dark-muted animate-pulse ${isNotebook ? 'text-2xl' : 'text-4xl'}`}>...</span>
                      : outputAmount
                        ? <span className="text-white truncate">{outputAmount}</span>
                        : <span className="text-dark-border">0</span>}
                  </div>
                  <div className={`${isNotebook ? 'h-3.5 text-[10px] mt-0.5' : 'h-5 text-xs mt-1'} flex items-center font-medium text-dark-muted`}>
                    {quoteLoading && amount && Number(amount) > 0 ? (
                      <span className="text-dark-muted animate-pulse">~$ ...</span>
                    ) : outputUsd && outputUsd !== '--' ? (
                      <span className="text-dark-muted">~$ {outputUsd}</span>
                    ) : (
                      <span className="invisible">~$ 0.00</span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end shrink-0">
                  <button onClick={() => { setSelectingFor('out'); setIsSwapModalOpen(true); }}
                    className={`flex items-center gap-2 bg-dark-card border border-dark-border hover:bg-dark-border/80 transition-all rounded-full shadow-lg group ${
                      isNotebook ? 'py-1 px-2.5' : 'py-1.5 px-3'
                    }`}>
                    <TokenIcon token={tokenOut} size={isNotebook ? 'xs' : 'sm'} />
                    <span className={`font-bold text-white tracking-wide ${isNotebook ? 'text-sm sm:text-base' : 'text-lg'}`}>{tokenOut.symbol}</span>
                    <svg className={`${isNotebook ? 'w-4 h-4' : 'w-5 h-5'} text-dark-muted group-hover:text-white transition-colors`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </button>
                  <span className={`flex items-center gap-1.5 font-semibold cursor-pointer hover:text-white transition-colors ${isNotebook ? 'text-[10px] mt-0.5' : 'text-[11px] mt-2 text-dark-muted'}`}>
                    Balance: {fmtOutSwap} {tokenOut.symbol}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Bridge Interface */}
        {activeTab === 'bridge' && (
          <div className={`flex flex-col ${isNotebook ? 'gap-1.5' : 'gap-1'}`}>
            {/* From */}
            <div className={`bg-dark-bg/80 border border-dark-border/60 hover:border-dark-border rounded-2xl flex flex-col justify-between transition-all ${
              isNotebook 
                ? 'p-2.5 sm:p-3 min-h-[82px] max-h-[92px]' 
                : 'p-3 sm:p-4 md:p-5 md:pb-6 min-h-[110px] sm:min-h-[130px]'
            }`}>
              <div className={`font-medium text-dark-muted flex justify-between ${isNotebook ? 'text-[11px] mb-1' : 'text-sm mb-3'}`}>
                <span>Bridge from</span>
              </div>
              <div className="flex items-center justify-between gap-3 sm:gap-4">
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
                    className={`w-full bg-transparent text-left font-black text-white placeholder-dark-border outline-none tracking-tight min-w-0 ${
                      isNotebook ? 'text-2xl font-black' : 'text-4xl'
                    }`} />
                  <div className={`${isNotebook ? 'h-3.5 text-[10px] mt-0.5' : 'h-5 text-xs mt-1'} flex items-center font-medium text-dark-muted`}>
                    {inputUsd && inputUsd !== '--' ? `~$ ${inputUsd}` : <span className="invisible">~$ 0.00</span>}
                  </div>
                </div>
                <div className="flex flex-col items-end shrink-0">
                  <button onClick={() => { setSelectingFor('in'); setIsBridgeModalOpen(true); }}
                    className={`flex items-center gap-2 bg-dark-card border border-dark-border hover:bg-dark-border/80 transition-all rounded-full shadow-lg group ${
                      isNotebook ? 'py-1 px-2.5' : 'py-1.5 px-3'
                    }`}>
                    <div className="relative flex shrink-0">
                      <TokenIcon token={bridgeTokenIn} size={isNotebook ? 'xs' : 'sm'} />
                      <div className="absolute -bottom-1 -right-1">
                         <ChainBadge chain={bridgeChainIn} />
                      </div>
                    </div>
                    <span className={`font-bold text-white tracking-wide ${isNotebook ? 'text-sm sm:text-base' : 'text-lg'}`}>{bridgeTokenIn.symbol}</span>
                    <svg className={`${isNotebook ? 'w-4 h-4' : 'w-5 h-5'} text-dark-muted group-hover:text-white transition-colors`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </button>
                  <span className={`flex items-center gap-1.5 font-semibold cursor-pointer transition-colors ${isNotebook ? 'text-[10px] mt-0.5' : 'text-[11px] mt-2'} ${isInsufficientBalance ? 'text-red-400 font-bold' : 'text-dark-muted hover:text-white'}`}
                    onClick={() => { if (bridgeBalInData) setAmount(bridgeBalInData.formatted); }}>
                    Balance: {fmtInBridge} {bridgeTokenIn.symbol}
                  </span>
                </div>
              </div>
            </div>

            {/* Arrow */}
            <div className={`relative h-2 flex items-center justify-center z-10 shrink-0 ${isNotebook ? '-my-1' : '-my-3'}`}>
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
                    handleSwitchNetwork(targetChain.id);
                  }
                }}
                className={`absolute bg-dark-card border-4 border-dark-bg rounded-xl flex items-center justify-center text-dark-muted hover:text-white transition-all hover:bg-dark-border cursor-pointer shadow-lg hover:rotate-180 duration-500 ${
                  isNotebook ? 'w-7 h-7' : 'w-10 h-10'
                }`}>
                <svg className={`${isNotebook ? 'w-3.5 h-3.5' : 'w-5 h-5'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
              </div>
            </div>

            {/* To */}
            <div className={`bg-dark-bg/80 border border-dark-border/60 hover:border-dark-border rounded-2xl flex flex-col justify-between transition-all ${
              isNotebook 
                ? 'p-2.5 sm:p-3 min-h-[82px] max-h-[92px]' 
                : 'p-3 sm:p-4 md:p-5 md:pb-6 min-h-[110px] sm:min-h-[130px]'
            }`}>
              <div className={`font-medium text-dark-muted flex justify-between ${isNotebook ? 'text-[11px] mb-1' : 'text-sm mb-3'}`}>
                <span>Bridge to</span>
              </div>
              <div className="flex items-center justify-between gap-3 sm:gap-4">
                <div className="flex flex-col items-start w-full">
                  <div className={`w-full text-left font-black tracking-tight min-w-0 flex items-center ${
                    isNotebook ? 'text-2xl h-7' : 'text-4xl h-10'
                  }`}>
                    {outputAmount
                      ? <span className="text-white truncate">{outputAmount}</span>
                      : <span className="text-dark-border">0</span>}
                  </div>
                  <div className={`${isNotebook ? 'h-3.5 text-[10px] mt-0.5' : 'h-5 text-xs mt-1'} flex items-center font-medium text-dark-muted`}>
                    {outputUsd && outputUsd !== '--' ? (
                      <span className="text-dark-muted">~$ {outputUsd}</span>
                    ) : (
                      <span className="invisible">~$ 0.00</span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end shrink-0">
                  <button onClick={() => { setSelectingFor('out'); setIsBridgeModalOpen(true); }}
                    className={`flex items-center gap-2 bg-dark-card border border-dark-border hover:bg-dark-border/80 transition-all rounded-full shadow-lg group ${
                      isNotebook ? 'py-1 px-2.5' : 'py-1.5 px-3'
                    }`}>
                    <div className="relative flex shrink-0">
                      <TokenIcon token={bridgeTokenOut} size={isNotebook ? 'xs' : 'sm'} />
                      <div className="absolute -bottom-1 -right-1">
                         <ChainBadge chain={bridgeChainOut} />
                      </div>
                    </div>
                    <span className={`font-bold text-white tracking-wide ${isNotebook ? 'text-sm sm:text-base' : 'text-lg'}`}>{bridgeTokenOut.symbol}</span>
                    <svg className={`${isNotebook ? 'w-4 h-4' : 'w-5 h-5'} text-dark-muted group-hover:text-white transition-colors`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </button>
                  <span className={`flex items-center gap-1.5 font-semibold cursor-pointer hover:text-white transition-colors ${isNotebook ? 'text-[10px] mt-0.5' : 'text-[11px] mt-2 text-dark-muted'}`}>
                    Balance: {fmtOutBridge} {bridgeTokenOut.symbol}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Bridge Detailed Info */}
        {activeTab === 'bridge' && (
          isNotebook ? (
            <div className="mt-1.5 pt-1.5 px-1 flex flex-col gap-0.5 border-t border-dark-border/40 text-[10px] text-dark-muted leading-tight">
              <div className="flex items-center justify-between">
                <span>Bridge Fee</span>
                <span className="text-emerald-400 font-semibold">{BRIDGE_FEE > 0 ? `${BRIDGE_FEE.toFixed(2)} ${bridgeTokenIn.symbol}` : 'Free (0.00 USDC)'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Estimated Time</span>
                <span className="text-white font-medium">{getEstimatedTime(bridgeChainIn?.id, bridgeChainOut?.id)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Receiving Wallet</span>
                <button 
                  type="button" 
                  onClick={() => setIsReceiverModalOpen(true)}
                  className="text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1 transition-colors"
                >
                  {receiverAddress ? (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" />
                      <span className="font-mono">{receiverAddress.slice(0, 6)}...{receiverAddress.slice(-4)}</span>
                    </>
                  ) : (
                    <span className="underline">+ Add wallet</span>
                  )}
                </button>
              </div>
            </div>
          ) : (
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
              <div className="flex flex-col gap-3 px-1">
                 <div className="flex items-center justify-between text-sm">
                   <span className="text-dark-muted font-medium">Bridge Fee</span>
                   <span className="text-emerald-400 font-bold">{BRIDGE_FEE > 0 ? `${BRIDGE_FEE.toFixed(2)} ${bridgeTokenIn.symbol}` : 'Free (0.00 USDC)'}</span>
                 </div>
                 <div className="flex items-center justify-between text-sm">
                   <span className="text-dark-muted font-medium">Estimated Time</span>
                   <span className="text-white font-bold">{getEstimatedTime(bridgeChainIn?.id, bridgeChainOut?.id)}</span>
                 </div>
                 <div className="flex items-center justify-between text-sm">
                   <span className="text-dark-muted font-medium">You Receive</span>
                   <span className="text-white font-bold">{Number(amount) > 0 && netBridgeAmount > 0 ? `${outputAmount} ${bridgeTokenOut.symbol}` : '--'}</span>
                 </div>
              </div>
            </div>
          )
        )}

        {/* Swap Transparency Info */}
        {activeTab === 'swap' && (
          <div className={`${isNotebook ? 'mt-1.5 pt-1.5 gap-0.5 text-[10px] leading-tight' : 'mt-4 pt-3 gap-2 text-xs'} px-1 flex flex-col border-t border-dark-border/40 text-dark-muted`}>
            <div className="flex items-center justify-between">
              <span>Slippage Tolerance</span>
              <strong className="text-white font-mono">{slippage}%</strong>
            </div>
            <div className="flex items-center justify-between">
              <span>Est. Network Fee</span>
              <strong className="text-emerald-400 font-mono">&lt;0.001 USDC</strong>
            </div>
            <div className="flex items-center justify-between">
              <span>Routing Execution</span>
              <span className="text-blue-400 font-medium">Arc Native L1</span>
            </div>
          </div>
        )}

        {/* Error */}
        {swapStatus === 'error' && swapError && (
          <div className={`${isNotebook ? 'mt-1.5 px-2.5 py-1.5' : 'mt-2 px-3 py-2'} bg-red-900/30 border border-red-500/40 rounded-xl text-xs text-red-300 break-all`}>
            ⚠️ {swapError}
          </div>
        )}

        {/* Action Button */}
        <button onClick={handleSwap} disabled={btnDisabled}
          className={`w-full transition-all active:scale-[0.98] ${
            isNotebook ? 'mt-2 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-bold' : 'mt-3 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl text-sm sm:text-base font-bold'
          } ${
            !address 
              ? 'bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.05] text-white'
              : btnDisabled 
                ? 'bg-white/[0.04] border border-white/[0.05] cursor-not-allowed opacity-60 text-white' 
                : 'bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 cursor-pointer shadow-[0_0_20px_rgba(39,117,202,0.3)] hover:shadow-[0_0_25px_rgba(39,117,202,0.5)] text-white'
          }`}>
          {btnLabel}
        </button>

        {/* Tx hash */}
        {txHash && (
          <div className={`${isNotebook ? 'mt-2 text-[11px]' : 'mt-3 text-xs'} text-center text-dark-muted`}>
            Tx: <a href={`${connectedChainId === arcMainnet.id ? 'https://explorer.arc.io' : 'https://testnet.arcscan.app'}/tx/${txHash}`} target="_blank" rel="noopener noreferrer"
              className="text-blue-400 hover:underline">{txHash.slice(0, 12)}...{txHash.slice(-6)}</a>
          </div>
        )}

        {/* Rescue Pending Bridge Link */}
        {activeTab === 'bridge' && (
          <div className={`${isNotebook ? 'mt-1' : 'mt-3'} text-center`}>
            <button
              type="button"
              onClick={() => {
                setPendingBridge(null);
                setAmount('');
                setIsBridgeExecutionModalOpen(true);
              }}
              className={`${isNotebook ? 'text-[10px]' : 'text-xs'} text-blue-400/90 hover:text-blue-300 underline transition-colors cursor-pointer`}
            >
              {isNotebook ? "Didn't receive? Rescue tokens via tx hash" : "Previously sent and didn't receive? Rescue tokens via transaction hash"}
            </button>
          </div>
        )}



      </div>

      {/* Route Selection Side Panel (Desktop Beside / Mobile Stacked) */}
      {activeTab === 'swap' && Boolean(amount && Number(String(amount).replace(',', '.')) > 0) && (
        <div className={`w-full bg-dark-card border border-dark-border shadow-2xl flex flex-col justify-between transition-all shrink-0 ${
          isNotebook 
            ? 'max-w-[420px] md:w-[310px] rounded-2xl p-2.5 sm:p-3 flex-1 h-full min-h-0 overflow-y-auto' 
            : 'max-w-[480px] lg:w-[360px] rounded-3xl p-5'
        }`}>
          <div>
            {/* Header */}
            <div className={`flex items-center justify-between ${isNotebook ? 'pb-2 mb-2.5' : 'pb-3 mb-4'} border-b border-dark-border/40`}>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-bold uppercase tracking-wider text-white">Route Selection</span>
              </div>
              <span className="text-[11px] font-mono text-dark-muted font-medium">{refreshCountdown}s</span>
            </div>

            {/* Content */}
            {quoteLoading && !quote && dexQuotes.length === 0 ? (
              <div className={`${isNotebook ? 'py-6' : 'py-10'} flex flex-col items-center justify-center gap-2 text-dark-muted`}>
                <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs font-medium animate-pulse">Calculating best route...</span>
              </div>
            ) : quoteError && dexQuotes.length === 0 ? (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center justify-between">
                <span>{quoteError}</span>
                <span className="text-[10px] text-dark-muted">Check token liquidity</span>
              </div>
            ) : dexQuotes.length > 0 ? (
              <div className={`flex flex-col ${isNotebook ? 'gap-2' : 'gap-2.5'}`}>
                {(isQuotesExpanded
                  ? dexQuotes
                  : (dexQuotes.find(q => q.id === selectedDEX) ? [dexQuotes.find(q => q.id === selectedDEX)] : dexQuotes.slice(0, 1))
                ).map((q) => {
                  const isSelected = selectedDEX === q.id;
                  return (
                    <div
                      key={q.id}
                      onClick={() => {
                        if (selectedDEX === q.id) return;
                        setSelectedDEX(q.id);
                        if (q.amountOut) {
                          setQuote(prev => prev ? {
                            ...prev,
                            amountOutDecimals: q.amountOut,
                            provider: q.id,
                            routeString: q.name
                          } : prev);
                        }
                        fetchQuote(true, q.id);
                      }}
                      className={`${isNotebook ? 'p-2.5 rounded-xl' : 'p-3.5 rounded-2xl'} border flex items-center justify-between transition-all cursor-pointer ${
                        isSelected
                          ? 'border-blue-500/60 bg-blue-500/10 shadow-[0_0_15px_rgba(59,130,246,0.12)]'
                          : 'border-dark-border/60 bg-dark-bg/40 hover:border-dark-border/80'
                      }`}
                    >
                      {/* Left: Brand Logo + Name + Best Price Badge */}
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`${isNotebook ? 'w-7 h-7 p-1' : 'w-8 h-8 p-1.5'} rounded-xl bg-[#0E1525] border border-white/10 flex items-center justify-center shrink-0 shadow-sm overflow-hidden`}>
                          <img
                            src={q.logo}
                            alt={q.name}
                            className="w-full h-full object-contain"
                          />
                        </div>

                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap">
                            <span className={`${isNotebook ? 'text-xs' : 'text-sm'} font-bold text-white whitespace-nowrap`}>
                              {q.name}
                            </span>
                            {q.badge && (
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 whitespace-nowrap tracking-wide uppercase ${q.badgeColor}`}>
                                {q.badge}
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-dark-muted font-medium whitespace-nowrap">
                            {q.id === 'uniswap' ? 'On-Chain Pool' : 'Multi-DEX'}
                          </span>
                        </div>
                      </div>

                      {/* Right: Output Amount + USD */}
                      <div className="flex flex-col items-end shrink-0 text-right pl-2">
                        <span className={`${isNotebook ? 'text-xs sm:text-sm' : 'text-sm'} font-black font-mono tracking-tight text-white whitespace-nowrap`}>
                          {q.amountOut} <span className="text-xs font-semibold text-dark-muted">{tokenOut.symbol}</span>
                        </span>
                        <span className="text-[11px] text-dark-muted font-medium whitespace-nowrap">
                          {q.usdValue}
                        </span>
                      </div>
                    </div>
                  );
                })}

                {/* Collapsible toggle for remaining routes */}
                {dexQuotes.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setIsQuotesExpanded(prev => !prev)}
                    className="w-full py-2 px-3 rounded-xl bg-dark-bg/40 hover:bg-dark-bg/70 border border-dark-border/40 hover:border-dark-border/80 flex items-center justify-center gap-1.5 text-xs font-semibold text-dark-muted hover:text-white transition-all group"
                  >
                    <span>
                      {isQuotesExpanded
                        ? 'Show less routes'
                        : `View other routes (${dexQuotes.length - 1})`}
                    </span>
                    <svg
                      className={`w-3.5 h-3.5 text-dark-muted group-hover:text-white transition-transform duration-200 ${isQuotesExpanded ? 'rotate-180' : ''}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}

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
        selectingFor={selectingFor}
      />
      
      <BridgeModal
        isOpen={isBridgeExecutionModalOpen}
        onClose={() => {
          setIsBridgeExecutionModalOpen(false);
          refetchBridgeBalIn?.();
          refetchBridgeBalOut?.();
        }}
        amount={pendingBridge?.amount || amount}
        fromChain={pendingBridge?.fromChainId ? getChainById(pendingBridge.fromChainId) : bridgeChainIn}
        toChain={pendingBridge?.toChainId ? getChainById(pendingBridge.toChainId) : bridgeChainOut}
        token={actualTokenIn}
        userAddress={address}
        receiverAddress={receiverAddress}
        initialBurnTxHash={pendingBridge?.burnHash}
        onComplete={() => {
          setIsBridgeExecutionModalOpen(false);
          setAmount('');
          setPendingBridge(null);
          refetchBridgeBalIn?.();
          refetchBridgeBalOut?.();
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
          refetchBalIn?.();
          refetchBalOut?.();
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
        filterType={activeTab === 'swap' ? 'Swap' : 'Bridge'}
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
  const dim = size === 'xs' ? 'w-6 h-6' : size === 'sm' ? 'w-8 h-8' : 'w-10 h-10';

  if (imgError || !token.iconImg) {
    return (
      <div className={`${dim} rounded-full ${token.color || 'bg-gray-600'} flex items-center justify-center text-white ${size === 'xs' ? 'text-[10px]' : 'text-xs'} font-bold shrink-0 shadow-inner`}>
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
