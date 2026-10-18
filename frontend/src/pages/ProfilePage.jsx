import { useState, useEffect, useMemo, useRef } from 'react';
import { useAccount, useBalance, useChainId } from 'wagmi';
import { arcMainnet, arcTestnet } from '../config/wagmi';
import { getAllTokens } from '../config/tokens';
import { motion } from 'framer-motion';
import { useTokenPrices, formatUsdValue } from '../hooks/useTokenPrices';
import { 
  getTradeHistoryByWallet, 
  deleteTrade, 
  getPaymentLinksByWallet, 
  getSentPaymentsByWallet, 
  getBlacklist, 
  addToBlacklist, 
  isTestnetInvoice 
} from '../utils/localStorage';
import { invoiceAPI } from '../services/invoiceService';

const getExplorerUrl = (txHash, chain, currentChainId) => {
  if (!txHash || txHash === 'undefined' || txHash === 'null') return null;
  const c = (chain || '').toLowerCase();
  if (c.includes('base')) return `https://sepolia.basescan.org/tx/${txHash}`;
  if (c.includes('polygon')) return `https://amoy.polygonscan.com/tx/${txHash}`;
  if (c.includes('optimism')) return `https://sepolia-optimism.etherscan.io/tx/${txHash}`;
  if (c.includes('arbitrum')) return `https://sepolia.arbiscan.io/tx/${txHash}`;
  if (c.includes('ethereum')) return `https://sepolia.etherscan.io/tx/${txHash}`;
  if (currentChainId === arcMainnet.id || c.includes('mainnet')) return `https://explorer.arc.io/tx/${txHash}`;
  return `https://testnet.arcscan.app/tx/${txHash}`;
};

const safeDate = (val) => {
  if (!val) return new Date(0);
  if (typeof val === 'number') return new Date(val);
  if (typeof val === 'string' && /^\d+$/.test(val)) return new Date(parseInt(val, 10));
  const d = new Date(val);
  return isNaN(d.getTime()) ? new Date(0) : d;
};

// Portfolio tokens on Arc Mainnet
export const MAINNET_TOKENS = [
  { symbol: 'USDC',   name: 'USD Coin (Arc)',       address: null,                                         decimals: 6, color: 'bg-blue-400',    iconImg: '/tokens/usdc.svg', isNative: true },
  { symbol: 'EURC',   name: 'Euro Coin (Circle)',   address: '0xbEf5f6d51CB62b58e6A8f77868681825C6fe21c1', decimals: 6, color: 'bg-indigo-500',  iconImg: '/tokens/eurc.svg' },
  { symbol: 'cirBTC', name: 'Circle Bitcoin',       address: '0x171A4217b86A807A64eB94757Db6849fb4bDbAA0', decimals: 8, color: 'bg-orange-500', iconImg: '/cirbtc.svg' },
];

// Portfolio tokens on Arc Testnet
export const TESTNET_TOKENS = [
  { symbol: 'USDC',   name: 'USD Coin (Arc)',   address: null,                                               decimals: 18, color: 'bg-blue-400',   iconImg: '/tokens/usdc.svg', isNative: true },
  { symbol: 'USDT',   name: 'Tether USD',       address: '0x175CdB1D338945f0D851A741ccF787D343E57952',       decimals: 18, color: 'bg-green-500',  iconImg: '/tokens/usdt.svg' },
  { symbol: 'EURC',   name: 'Euro Coin',        address: '0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a',       decimals: 6,  color: 'bg-indigo-500', iconImg: '/tokens/eurc.svg' },
  { symbol: 'WUSDC',  name: 'Wrapped USDC',     address: '0x911b4000D3422F482F4062a913885f7b035382Df',       decimals: 18, color: 'bg-blue-500',   iconImg: '/tokens/usdc.svg' },
  { symbol: 'cirBTC', name: 'Circle Bitcoin',   address: '0xf0C4a4CE82A5746AbAAd9425360Ab04fbBA432BF',       decimals: 8,  color: 'bg-orange-500', iconImg: '/cirbtc.svg' },
];

const NetworkBadge = ({ chain }) => {
  const c = (chain || '').toLowerCase();
  
  if (c.includes('invoice')) return (
    <div className="absolute -bottom-1 -right-1 w-[16px] h-[16px] rounded-full border border-dark-bg bg-green-500 flex items-center justify-center shadow-sm">
      <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>
    </div>
  );

  let iconSrc = '/arc-branded.svg';
  let altText = 'Arc';
  let bgClass = 'bg-[#121A2F]';

  if (c.includes('polygon')) {
    iconSrc = '/chains/polygon.svg';
    altText = 'Polygon';
    bgClass = 'bg-white';
  } else if (c.includes('base')) {
    iconSrc = '/chains/base.svg';
    altText = 'Base';
    bgClass = 'bg-white';
  } else if (c.includes('optimism')) {
    iconSrc = '/chains/optimism.svg';
    altText = 'Optimism';
    bgClass = 'bg-white';
  } else if (c.includes('arbitrum')) {
    iconSrc = '/chains/arbitrum.svg';
    altText = 'Arbitrum';
    bgClass = 'bg-[#121A2F]';
  } else if (c.includes('ethereum') || c.includes('sepolia')) {
    iconSrc = '/chains/ethereum.svg';
    altText = 'Ethereum';
    bgClass = 'bg-[#121A2F]';
  }

  return (
    <div className={`absolute -bottom-1 -right-1 w-[16px] h-[16px] rounded-full border border-dark-bg ${bgClass} overflow-hidden p-[2px] flex items-center justify-center shadow-sm`}>
      <img src={iconSrc} alt={altText} className="w-full h-full object-contain rounded-full" />
    </div>
  );
};

const getTokenIcon = (symbol) => {
  if (!symbol) return '/tokens/usdc.svg';
  const allTokens = [...TESTNET_TOKENS, ...MAINNET_TOKENS];
  const token = allTokens.find(t => t.symbol?.toUpperCase() === symbol.toUpperCase());
  return token ? token.iconImg : '/tokens/usdc.svg';
};

// LocalStorage Cache Helper for instant display with 0ms delay
function getCachedPortfolio(address, isMainnet) {
  if (!address || typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(`aura_portfolio_${address.toLowerCase()}_${isMainnet ? 'main' : 'test'}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setCachedPortfolio(address, isMainnet, data) {
  if (!address || typeof window === 'undefined') return;
  try {
    localStorage.setItem(`aura_portfolio_${address.toLowerCase()}_${isMainnet ? 'main' : 'test'}`, JSON.stringify(data));
  } catch {}
}

// Balance Hook using Wagmi with Instant Cache & Seamless Background Polling
function usePortfolioBalances(address, chainId) {
  const isTestnet = chainId === arcTestnet.id;

  const cached = useMemo(() => getCachedPortfolio(address, !isTestnet), [address, isTestnet]);
  const hasValidCache = !!cached && Array.isArray(cached) && cached.some(v => Number(v) > 0);
  const hasLoadedRef = useRef(hasValidCache);

  // Mainnet balances
  const usdcMainnet    = useBalance({ address, chainId: arcMainnet.id, query: { enabled: !!address && !isTestnet, refetchInterval: 8_000, staleTime: 5_000 } });
  const eurcMainnet    = useBalance({ address, token: '0xbEf5f6d51CB62b58e6A8f77868681825C6fe21c1', chainId: arcMainnet.id, query: { enabled: !!address && !isTestnet, refetchInterval: 8_000, staleTime: 5_000 } });
  const cirbtcMainnet  = useBalance({ address, token: '0x171A4217b86A807A64eB94757Db6849fb4bDbAA0', chainId: arcMainnet.id, query: { enabled: !!address && !isTestnet, refetchInterval: 8_000, staleTime: 5_000 } });

  // Testnet balances
  const usdcTestnet    = useBalance({ address, chainId: arcTestnet.id, query: { enabled: !!address && isTestnet, refetchInterval: 8_000, staleTime: 5_000 } });
  const usdtTestnet    = useBalance({ address, token: '0x175CdB1D338945f0D851A741ccF787D343E57952', chainId: arcTestnet.id, query: { enabled: !!address && isTestnet, refetchInterval: 8_000, staleTime: 5_000 } });
  const eurcTestnet    = useBalance({ address, token: '0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a', chainId: arcTestnet.id, query: { enabled: !!address && isTestnet, refetchInterval: 8_000, staleTime: 5_000 } });
  const wusdcTestnet   = useBalance({ address, token: '0x911b4000D3422F482F4062a913885f7b035382Df', chainId: arcTestnet.id, query: { enabled: !!address && isTestnet, refetchInterval: 8_000, staleTime: 5_000 } });
  const cirbtcTestnet  = useBalance({ address, token: '0xf0C4a4CE82A5746AbAAd9425360Ab04fbBA432BF', chainId: arcTestnet.id, query: { enabled: !!address && isTestnet, refetchInterval: 8_000, staleTime: 5_000 } });

  const balances = useMemo(() => {
    let freshBalances;
    if (!isTestnet) {
      freshBalances = [
        usdcMainnet.data ? Number(usdcMainnet.data.formatted) : (cached?.[0] ?? 0),
        eurcMainnet.data ? Number(eurcMainnet.data.formatted) : (cached?.[1] ?? 0),
        cirbtcMainnet.data ? Number(cirbtcMainnet.data.formatted) : (cached?.[2] ?? 0),
      ];
      if (usdcMainnet.data || eurcMainnet.data || cirbtcMainnet.data) {
        setCachedPortfolio(address, true, freshBalances);
        hasLoadedRef.current = true;
      }
    } else {
      freshBalances = [
        usdcTestnet.data ? Number(usdcTestnet.data.formatted) : (cached?.[0] ?? 0),
        usdtTestnet.data ? Number(usdtTestnet.data.formatted) : (cached?.[1] ?? 0),
        eurcTestnet.data ? Number(eurcTestnet.data.formatted) : (cached?.[2] ?? 0),
        wusdcTestnet.data ? Number(wusdcTestnet.data.formatted) : (cached?.[3] ?? 0),
        cirbtcTestnet.data ? Number(cirbtcTestnet.data.formatted) : (cached?.[4] ?? 0),
      ];
      if (usdcTestnet.data || usdtTestnet.data || eurcTestnet.data || wusdcTestnet.data || cirbtcTestnet.data) {
        setCachedPortfolio(address, false, freshBalances);
        hasLoadedRef.current = true;
      }
    }
    return freshBalances;
  }, [
    isTestnet, cached, address,
    usdcMainnet.data, eurcMainnet.data, cirbtcMainnet.data,
    usdcTestnet.data, usdtTestnet.data, eurcTestnet.data, wusdcTestnet.data, cirbtcTestnet.data
  ]);

  const activeUsdc = isTestnet ? usdcTestnet : usdcMainnet;
  const isInitialLoading = !hasLoadedRef.current && (activeUsdc.isPending || activeUsdc.isLoading);

  return { loading: isInitialLoading, balances };
}

export default function ProfilePage() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const isMainnet = chainId !== arcTestnet.id;
  const currentTokens = isMainnet ? MAINNET_TOKENS : TESTNET_TOKENS;

  const [activeTab, setActiveTab] = useState('assets');
  const [avatarUrl, setAvatarUrl] = useState(null);
  const { prices } = useTokenPrices();
  const { loading: balancesLoading, balances } = usePortfolioBalances(address, chainId);

  // Reliable price resolver with rock-solid fallbacks
  const getTokenPrice = (symbol) => {
    let p = prices?.[symbol];
    if (p != null && !isNaN(p) && Number(p) > 0) return Number(p);
    if (['USDC', 'WUSDC', 'USDT'].includes(symbol)) return 1.0;
    if (symbol === 'EURC') return 1.08;
    if (symbol === 'cirBTC') return 65000;
    return 0;
  };

  // Compute total portfolio value
  const totalValueNum = useMemo(() => {
    return currentTokens.reduce((sum, token, i) => {
      const bal = Number(balances[i] || 0);
      const price = getTokenPrice(token.symbol);
      return sum + (bal * price);
    }, 0);
  }, [currentTokens, balances, prices]);

  const defaultArcLabel = isMainnet ? 'Arc' : 'Arc Testnet';

  const totalBalance = `$${totalValueNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) setAvatarUrl(URL.createObjectURL(file));
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [activitiesList, setActivitiesList] = useState([]);

  const loadActivities = async () => {
    if (!address) {
      setActivitiesList([]);
      return;
    }

    const isCurrentMainnet = Number(chainId) === arcMainnet.id;
    const blacklist = getBlacklist() || [];

    const formatActivities = (backendItems = []) => {
      // 1. Swaps and Bridges from Trade History (Deduplicated by ID and txHash)
      const seenTradeIds = new Set();
      const seenTradeHashes = new Set();
      const uniqueTrades = [];

      (getTradeHistoryByWallet(address, chainId) || []).forEach(t => {
        if (!t) return;
        const id = t.id ? String(t.id) : null;
        const hash = (t.txHash || t.hash) ? String(t.txHash || t.hash).toLowerCase() : null;
        if (id && seenTradeIds.has(id)) return;
        if (hash && seenTradeHashes.has(hash)) return;
        if (id) seenTradeIds.add(id);
        if (hash) seenTradeHashes.add(hash);
        uniqueTrades.push(t);
      });

      const trades = uniqueTrades.map(t => {
        const d = safeDate(t.createdAt);
        const timestamp = d.getTime();
        return {
          ...t,
          createdAt: timestamp,
          dateFormatted: d.toLocaleString('en-US', { month: 'short', day: 'numeric' }),
          timeFormatted: d.toLocaleString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
          time: d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }),
          status: t.status === 'Confirmed' ? 'Completed' : (t.status || 'Completed')
        };
      });

      // 2. Invoices & Payments from Local Storage
      const receivedLocal = getPaymentLinksByWallet(address, chainId) || [];
      const sentLocal = getSentPaymentsByWallet(address, chainId) || [];

      // Merge backend and local received items
      const itemMap = new Map();
      receivedLocal.forEach(loc => {
        if (loc && loc.id) itemMap.set(loc.id, loc);
      });
      backendItems.forEach(bItem => {
        if (!bItem || !bItem.id) return;
        const existing = itemMap.get(bItem.id);
        if (existing) {
          itemMap.set(bItem.id, { ...existing, ...bItem });
        } else {
          itemMap.set(bItem.id, bItem);
        }
      });

      // Format received invoices (created payment requests)
      const invoiceItems = Array.from(itemMap.values())
        .filter(item => {
          if (!item || !item.id) return false;
          if (blacklist.includes(item.id)) return false;
          const isTestnet = isTestnetInvoice(item);
          return isCurrentMainnet ? !isTestnet : isTestnet;
        })
        .map(item => {
          const d = safeDate(item.paidAt || item.createdAt);
          const timestamp = d.getTime();
          const isPaid = item.status === 'paid';
          const isExpired = item.status === 'expired' || (!isPaid && (Date.now() - timestamp > 24 * 60 * 60 * 1000));
          return {
            id: item.id,
            type: 'Receive',
            isInvoice: true,
            amount: item.amount,
            amountIn: item.amount,
            currency: item.currency || 'USDC',
            tokenIn: item.currency || 'USDC',
            status: isPaid ? 'Completed' : (isExpired ? 'Expired' : 'Pending'),
            createdAt: timestamp,
            dateFormatted: d.toLocaleString('en-US', { month: 'short', day: 'numeric' }),
            timeFormatted: d.toLocaleString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
            time: d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }),
            txHash: item.txHash,
            recipientName: item.recipientName || item.description || 'Payment Request',
            fromChain: 'Invoice'
          };
        });

      // Deduplicate sent payments strictly by both txHash and id
      const seenSentIds = new Set();
      const seenSentHashes = new Set();
      const uniqueSent = [];

      sentLocal.forEach(item => {
        if (!item) return;
        const id = item.id ? String(item.id) : null;
        const hash = (item.txHash || item.hash) ? String(item.txHash || item.hash).toLowerCase() : null;
        if (id && seenSentIds.has(id)) return;
        if (hash && seenSentHashes.has(hash)) return;
        if (id) seenSentIds.add(id);
        if (hash) seenSentHashes.add(hash);
        uniqueSent.push(item);
      });

      // Format sent payments
      const sentItems = uniqueSent
        .filter(item => {
          if (!item || !item.id) return false;
          if (blacklist.includes(item.id)) return false;
          const isTestnet = isTestnetInvoice(item);
          return isCurrentMainnet ? !isTestnet : isTestnet;
        })
        .map(item => {
          const d = safeDate(item.paidAt || item.timestamp || item.createdAt);
          const timestamp = d.getTime();
          return {
            id: item.id,
            type: 'Send',
            isInvoice: true,
            amount: item.amount,
            amountIn: item.amount,
            currency: item.currency || 'USDC',
            tokenIn: item.currency || 'USDC',
            status: 'Completed',
            createdAt: timestamp,
            dateFormatted: d.toLocaleString('en-US', { month: 'short', day: 'numeric' }),
            timeFormatted: d.toLocaleString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
            time: d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }),
            txHash: item.txHash,
            recipientName: item.recipientName || 'Payment Sent',
            fromChain: isCurrentMainnet ? 'Arc' : 'Arc Testnet'
          };
        });

      // Cross-deduplicate across trades, sent items and invoices:
      // If any items share the same non-empty txHash, keep only one
      const seenGlobalHashes = new Set();
      const seenGlobalSendIds = new Set();
      const rawMerged = [...trades, ...sentItems, ...invoiceItems];
      const allMerged = [];

      for (const act of rawMerged) {
        const hash = (act.txHash || act.hash) ? String(act.txHash || act.hash).toLowerCase() : null;
        if (hash && hash !== 'undefined' && hash !== 'null') {
          if (seenGlobalHashes.has(hash)) continue;
          seenGlobalHashes.add(hash);
        }
        if (act.id && act.type === 'Send') {
          const sendKey = `send_${act.id}`;
          if (seenGlobalSendIds.has(sendKey)) continue;
          seenGlobalSendIds.add(sendKey);
        }
        allMerged.push(act);
      }

      // Merge and sort stably (newest first, then by type, then by id)
      return allMerged.sort((a, b) => {
        const timeA = safeDate(a.createdAt).getTime();
        const timeB = safeDate(b.createdAt).getTime();
        const diff = timeB - timeA;
        if (diff !== 0) return diff;
        const typeDiff = (a.type || '').localeCompare(b.type || '');
        if (typeDiff !== 0) return typeDiff;
        return String(a.id || '').localeCompare(String(b.id || ''));
      });
    };

    // 1. Instant local render (0ms delay)
    setActivitiesList(formatActivities([]));

    // 2. Fetch backend in background and update
    try {
      const backendInvoices = await invoiceAPI.getByWallet(address);
      if (Array.isArray(backendInvoices) && backendInvoices.length > 0) {
        const formattedBackend = backendInvoices.map(inv => ({
          id: inv.id,
          creatorAddress: inv.fromWallet,
          recipientName: inv.recipientName || 'Payment Request',
          recipientWallet: inv.recipientWallet,
          amount: inv.amount,
          currency: inv.currency,
          description: inv.description,
          status: inv.status,
          createdAt: inv.createdAt,
          paidAt: inv.paidAt,
          txHash: inv.txHash,
          payer: inv.payer,
          chainId: inv.chainId,
          network: inv.network,
          isBackend: true
        }));
        setActivitiesList(formatActivities(formattedBackend));
      }
    } catch (err) {
      console.warn('[ProfilePage] Backend invoice fetch fallback:', err);
    }
  };

  useEffect(() => {
    loadActivities();
    window.addEventListener('storage', loadActivities);
    window.addEventListener('invoice_updated', loadActivities);
    window.addEventListener('pending_bridge_updated', loadActivities);
    window.addEventListener('aura:bridge-complete', loadActivities);
    return () => {
      window.removeEventListener('storage', loadActivities);
      window.removeEventListener('invoice_updated', loadActivities);
      window.removeEventListener('pending_bridge_updated', loadActivities);
      window.removeEventListener('aura:bridge-complete', loadActivities);
    };
  }, [address, chainId]);

  const handleDeleteActivity = (activityId) => {
    deleteTrade(activityId);
    addToBlacklist([activityId]);
    setActivitiesList(prev => prev.filter(t => t.id !== activityId));
  };

  const [activityTypeFilter, setActivityTypeFilter] = useState('all');

  const filteredActivities = useMemo(() => {
    let list = activitiesList;
    if (activityTypeFilter === 'swap') {
      list = list.filter(act => act.type?.toLowerCase() === 'swap');
    } else if (activityTypeFilter === 'bridge') {
      list = list.filter(act => act.type?.toLowerCase() === 'bridge');
    } else if (activityTypeFilter === 'payment') {
      list = list.filter(act => act.type?.toLowerCase() === 'receive' || act.type?.toLowerCase() === 'send' || act.type?.toLowerCase() === 'invoice');
    }

    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase().trim();
    return list.filter(act => 
      (act.tokenIn && act.tokenIn.toLowerCase().includes(q)) ||
      (act.tokenOut && act.tokenOut.toLowerCase().includes(q)) ||
      (act.currency && act.currency.toLowerCase().includes(q)) ||
      (act.fromChain && act.fromChain.toLowerCase().includes(q)) ||
      (act.toChain && act.toChain.toLowerCase().includes(q)) ||
      (act.type && act.type.toLowerCase().includes(q)) ||
      (act.recipientName && act.recipientName.toLowerCase().includes(q)) ||
      (act.txHash && act.txHash.toLowerCase().includes(q)) ||
      (act.hash && act.hash.toLowerCase().includes(q))
    );
  }, [activitiesList, activityTypeFilter, searchQuery]);

  // Pagination Logic (strictly 4 items per page)
  const activitiesPerPage = 4;
  const [activityPage, setActivityPage] = useState(1);

  useEffect(() => {
    setActivityPage(1);
  }, [searchQuery, activityTypeFilter]);

  const totalActivityPages = Math.max(1, Math.ceil(filteredActivities.length / activitiesPerPage));

  useEffect(() => {
    if (activityPage > totalActivityPages && totalActivityPages > 0) {
      setActivityPage(totalActivityPages);
    } else if (activityPage < 1) {
      setActivityPage(1);
    }
  }, [activityPage, totalActivityPages]);

  const paginatedActivities = useMemo(() => {
    const start = (activityPage - 1) * activitiesPerPage;
    return filteredActivities.slice(start, start + activitiesPerPage);
  }, [filteredActivities, activityPage, activitiesPerPage]);

  // If wallet is not connected
  if (!isConnected) {
    return (
      <section className="flex-1 flex flex-col items-center justify-center py-20 w-full">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="w-full max-w-md mx-auto px-6 text-center space-y-8"
        >
          <motion.div 
            animate={{ 
              y: [0, -15, 0],
              boxShadow: [
                "0 0 50px rgba(39,117,202,0.1)",
                "0 0 80px rgba(39,117,202,0.3)",
                "0 0 50px rgba(39,117,202,0.1)"
              ]
            }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className="w-32 h-32 mx-auto bg-gradient-to-br from-dark-input to-dark-bg border border-dark-border rounded-full flex items-center justify-center relative group"
          >
            <div className="absolute inset-0 rounded-full bg-blue-500/10 blur-xl group-hover:bg-blue-500/20 transition-all duration-500"></div>
            <span className="text-6xl relative z-10 drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]">🔐</span>
          </motion.div>
          <div className="space-y-3">
            <h1 className="text-4xl font-black text-white tracking-tight">Connect Wallet</h1>
            <p className="text-dark-muted text-lg leading-relaxed">Connect your wallet to view your portfolio, assets, and transaction history.</p>
          </div>
        </motion.div>
      </section>
    );
  }

  // Generate gradient for avatar based on address
  const avatarGradient = address 
    ? `linear-gradient(135deg, #${address.slice(2,8)}, #${address.slice(-6)})`
    : 'linear-gradient(135deg, #2563eb, #9333ea)';

  return (
    <section className="flex-1 flex flex-col overflow-hidden min-h-0 w-full">
      <div className="overflow-y-auto flex-1 min-h-0 flex flex-col items-center justify-start py-2 sm:py-3 md:py-5 pb-8">
      <div className="w-full max-w-7xl mx-auto px-4 md:px-6 flex flex-col gap-4 relative z-20">
        
        {/* Profile Header (Total Balance Card) */}
        <div className="bg-dark-card border border-dark-border rounded-2xl sm:rounded-3xl p-3.5 sm:p-4 shadow-2xl relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-4 shrink-0">
          {/* Ambient Glow inside card */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
          
          <div className="flex items-center gap-6 z-10">
            {/* Avatar Upload */}
            <div className="relative w-16 h-16 rounded-xl shadow-lg border-2 border-dark-border/50 p-1 group cursor-pointer">
              <input 
                type="file" 
                accept="image/*" 
                onChange={handleImageUpload} 
                className="absolute inset-0 opacity-0 cursor-pointer z-20"
                title="Change Profile Picture"
              />
              <div 
                className="w-full h-full rounded-lg overflow-hidden relative flex items-center justify-center bg-dark-bg" 
                style={!avatarUrl ? { background: avatarGradient } : {}}
              >
                {avatarUrl && (
                  <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
                )}
                
                {/* Hover Camera Icon */}
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
              </div>
            </div>
            {/* Info */}
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-sm font-mono text-dark-muted bg-dark-input px-3 py-1 rounded-full border border-dark-border/50">
                  {address.slice(0, 6)}...{address.slice(-4)}
                </span>
                <span className="flex items-center gap-1 text-xs font-bold text-green-400 bg-green-500/10 px-2 py-1 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></span> Connected
                </span>
              </div>
              {balancesLoading ? (
                <div className="h-9 w-48 bg-dark-border/40 rounded-lg animate-pulse mt-1 mb-1"></div>
              ) : (
                <h1 className="text-3xl font-black text-white tracking-tight mt-1">{totalBalance}</h1>
              )}
              <span className="text-xs text-dark-muted font-medium">Total Portfolio Value</span>
            </div>
          </div>
        </div>

        {/* Content Tabs */}
        <div className="flex items-center gap-1 bg-dark-input p-1 rounded-2xl border border-dark-border/50 w-full max-w-sm shrink-0">
          <button
            onClick={() => setActiveTab('assets')}
            className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all duration-300 ${
              activeTab === 'assets' 
                ? 'text-white bg-dark-card shadow-lg shadow-black/20 ring-1 ring-white/10' 
                : 'text-dark-muted hover:text-gray-300'
            }`}
          >
            My Assets
          </button>
          <button
            onClick={() => setActiveTab('activity')}
            className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all duration-300 ${
              activeTab === 'activity' 
                ? 'text-white bg-dark-card shadow-lg shadow-black/20 ring-1 ring-white/10' 
                : 'text-dark-muted hover:text-gray-300'
            }`}
          >
            Activity History
          </button>
        </div>

        {/* Tab Content */}
        <div className="grid w-full flex-1 relative">
          <>
            {/* Tab: Assets */}
            <div
              className={`col-start-1 row-start-1 w-full bg-dark-card border border-dark-border rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl flex-col min-h-0 flex-1 ${
                activeTab === 'assets' ? 'flex' : 'hidden'
              }`}
            >
              <div className="grid grid-cols-4 px-6 py-5 border-b border-dark-border/50 text-xs font-bold text-dark-muted uppercase tracking-wider">
                <div className="col-span-2">Asset</div>
                <div className="col-span-1 text-right">Balance</div>
                <div className="col-span-1 text-right pr-2">Value</div>
              </div>
              
              {balancesLoading
                ? currentTokens.map((_, idx) => <SkeletonRow key={idx} />)
                : currentTokens.map((token, idx) => (
                    <AssetRow key={idx} token={token} balance={balances[idx] || 0} prices={prices} />
                  ))
              }
            </div>

            {/* Tab: Activity */}
            <div
              className={`col-start-1 row-start-1 w-full bg-dark-card border border-dark-border rounded-3xl overflow-hidden shadow-2xl flex-col min-h-[480px] ${
                activeTab === 'activity' ? 'flex' : 'hidden'
              }`}
            >
              {/* Activity Header simulating search & Table Head */}
              <div className="px-6 py-5 border-b border-dark-border/50 bg-dark-bg/50 flex flex-col gap-4">
                <div className="relative">
                  <svg className="w-4 h-4 text-dark-muted absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input 
                    type="text" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by token hash/symbol/chain" 
                    className="w-full bg-dark-input border border-dark-border/50 rounded-xl py-2 pl-9 pr-4 text-sm text-white placeholder-dark-muted outline-none focus:border-blue-500/50 transition-colors"
                  />
                </div>

                {/* Filter Pills */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  {[
                    { id: 'all', label: 'All Activities' },
                    { id: 'swap', label: 'Swaps' },
                    { id: 'bridge', label: 'Bridges' },
                    { id: 'payment', label: 'Invoices & Payments' },
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActivityTypeFilter(tab.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                        activityTypeFilter === tab.id
                          ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                          : 'bg-dark-input text-dark-muted hover:text-white hover:bg-dark-border'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
                
                {/* Desktop Table Header */}
                <div className="hidden md:grid grid-cols-12 gap-4 text-xs font-bold text-dark-muted uppercase tracking-wider pt-2">
                  <div className="col-span-2">Type</div>
                  <div className="col-span-3">Source</div>
                  <div className="col-span-3">Destination</div>
                  <div className="col-span-1">Status</div>
                  <div className="col-span-2 text-center">Date</div>
                  <div className="col-span-1 text-right">Action</div>
                </div>
              </div>

              {paginatedActivities.length === 0 ? (
                <div className="p-12 text-center text-dark-muted flex-1 flex items-center justify-center">
                  {searchQuery ? 'No activities match your search' : 'No recent activities found for this wallet'}
                </div>
              ) : (
                <div key={`activity_${activityTypeFilter}_page_${activityPage}`} className="flex-1 flex flex-col divide-y divide-dark-border/30">
                  {paginatedActivities.map((act, idx) => {
                    const actKey = `${act.type || 'act'}_${act.id || ''}_${act.txHash || act.hash || ''}_${idx}`;
                    return (
                      <div key={actKey} className="flex flex-col md:grid md:grid-cols-12 md:items-center px-6 py-4 hover:bg-dark-input/30 transition-colors gap-4 md:gap-4">
                        
                        {/* Left Side: Icon and Type */}
                        <div className="md:col-span-2 flex items-center justify-between md:justify-start w-full">
                          <div className="flex items-center gap-3">
                            {act.type === 'Swap' && <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>}
                            {act.type === 'Bridge' && <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>}
                            {act.type === 'Receive' && <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>}
                            {act.type === 'Send' && <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>}
                            <div className="font-bold text-white text-base md:text-sm">{act.type}</div>
                          </div>
                          {/* Mobile Date */}
                          <div className="md:hidden text-xs text-dark-muted font-medium">{act.time}</div>
                        </div>

                        {/* Source */}
                        <div className="md:col-span-3 flex items-center gap-3">
                          <div className="relative">
                            <img src={getTokenIcon(act.tokenIn || act.currency)} alt="token" className="w-8 h-8 rounded-full" />
                            <NetworkBadge chain={act.type === 'Receive' ? 'Invoice' : (act.fromChain || defaultArcLabel)} />
                          </div>
                          <div className="flex flex-col">
                            <div className="font-bold text-white text-sm">{act.amountIn || act.amount} {act.tokenIn || act.currency}</div>
                            <div className="text-[11px] text-dark-muted uppercase font-bold tracking-wider">{act.type === 'Receive' ? 'Invoice' : (act.fromChain || defaultArcLabel)}</div>
                          </div>
                        </div>

                        {/* Destination */}
                        <div className="md:col-span-3 flex items-center gap-3">
                          {act.type === 'Swap' || act.type === 'Bridge' ? (
                            <>
                              <div className="relative">
                                <img src={getTokenIcon(act.tokenOut || act.tokenIn)} alt="token" className="w-8 h-8 rounded-full" />
                                <NetworkBadge chain={act.toChain || defaultArcLabel} />
                              </div>
                              <div className="flex flex-col">
                                <div className="font-bold text-white text-sm">{act.amountOut || act.amountIn} {act.tokenOut || act.tokenIn}</div>
                                <div className="text-[11px] text-dark-muted uppercase font-bold tracking-wider">{act.toChain || defaultArcLabel}</div>
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="relative">
                                <div className="w-8 h-8 rounded-full bg-dark-input border border-dark-border/50 flex items-center justify-center text-dark-muted">
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                </div>
                              </div>
                              <div className="flex flex-col max-w-[140px]">
                                <div className="font-bold text-white text-sm truncate">{act.type === 'Send' ? (act.recipientName || 'Wallet') : (act.recipientName || 'Payment Request')}</div>
                                <div className="text-[11px] text-dark-muted uppercase font-bold tracking-wider">{act.type === 'Receive' ? 'Client' : 'Recipient'}</div>
                              </div>
                            </>
                          )}
                        </div>

                        {/* Status */}
                        <div className="md:col-span-1 flex items-center justify-between md:justify-start mt-2 md:mt-0">
                          <span className="md:hidden text-xs font-bold text-dark-muted">Status</span>
                          <span className={`text-[10px] sm:text-xs font-bold px-3 py-1 rounded-full border ${
                            act.status === 'Completed' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 
                            act.status === 'Pending' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' : 
                            'bg-red-500/10 text-red-400 border-red-500/20'
                          }`}>
                            {act.status === 'Completed' ? 'Successful' : act.status}
                          </span>
                        </div>

                        {/* Desktop Date */}
                        <div className="hidden md:flex md:col-span-2 flex-col items-center justify-center">
                          <div className="font-bold text-white text-sm text-center">{act.dateFormatted}</div>
                          <div className="text-[11px] text-dark-muted font-medium text-center">{act.timeFormatted}</div>
                        </div>

                        {/* Action */}
                        <div className="md:col-span-1 flex justify-end items-center gap-2 mt-2 md:mt-0">
                          {(() => {
                            const hash = act.txHash || act.hash;
                            const chain = act.type === 'Bridge' ? (act.fromChain || defaultArcLabel) : defaultArcLabel;
                            const url = getExplorerUrl(hash, chain, chainId);
                            if (url) {
                              return (
                                <a
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-3 py-1.5 rounded-full border border-dark-border bg-white text-black hover:bg-zinc-200 text-xs font-bold transition-all shadow-md active:scale-95 whitespace-nowrap text-center cursor-pointer"
                                >
                                  View Details
                                </a>
                              );
                            }
                            if (act.isInvoice && act.id) {
                              return (
                                <a
                                  href={`/pay/${act.id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-3 py-1.5 rounded-full border border-dark-border bg-white text-black hover:bg-zinc-200 text-xs font-bold transition-all shadow-md active:scale-95 whitespace-nowrap text-center cursor-pointer"
                                >
                                  View Link
                                </a>
                              );
                            }
                            return (
                              <span className="px-3 py-1.5 rounded-full border border-dark-border bg-dark-input text-dark-muted text-xs font-bold whitespace-nowrap text-center opacity-50 cursor-not-allowed">
                                No Hash
                              </span>
                            );
                          })()}
                          <button
                            onClick={() => handleDeleteActivity(act.id)}
                            title="Delete activity"
                            className="p-1.5 rounded-lg text-dark-muted hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0 cursor-pointer"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Pagination Controls */}
              {totalActivityPages > 1 && (
                <div className="mt-auto flex items-center justify-between px-6 py-4 bg-dark-bg/50 border-t border-dark-border/50">
                  <span className="text-xs font-bold text-dark-muted">
                    Page {activityPage} of {totalActivityPages}
                  </span>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setActivityPage(p => Math.max(1, p - 1))}
                      disabled={activityPage === 1}
                      className="px-3 py-1.5 rounded-lg border border-dark-border bg-dark-input text-white text-xs font-bold hover:bg-dark-border disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
                    >
                      Prev
                    </button>
                    <button 
                      onClick={() => setActivityPage(p => Math.min(totalActivityPages, p + 1))}
                      disabled={activityPage === totalActivityPages}
                      className="px-3 py-1.5 rounded-lg border border-dark-border bg-dark-input text-white text-xs font-bold hover:bg-dark-border disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        </div>
      </div>
      </div>
    </section>
  );
}


// AssetRow — receives balance directly from parent (no independent RPC call)
function AssetRow({ token, balance, prices }) {
  const isCirBtc = token.symbol === 'cirBTC';
  const displayBalance = balance > 0 
    ? balance.toLocaleString('en-US', { 
        minimumFractionDigits: isCirBtc ? 4 : 2, 
        maximumFractionDigits: isCirBtc ? 8 : 4 
      })
    : (isCirBtc ? '0.0000' : '0.00');
  const usdValue = formatUsdValue(token.symbol, balance > 0 ? balance : 0, prices);

  return (
    <div className="grid grid-cols-4 items-center px-6 py-4 border-b border-dark-border/30 hover:bg-dark-input/30 transition-colors cursor-pointer group">
      <div className="col-span-2 flex items-center gap-4">
        <div className="w-10 h-10 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
          {token.iconImg ? (
            <img src={token.iconImg} alt={token.symbol} className="w-full h-full object-contain rounded-full" />
          ) : (
            <div className={`w-full h-full rounded-full ${token.color || 'bg-gray-700'} flex items-center justify-center text-white font-bold text-xs`}>
              {token.symbol.slice(0, 2)}
            </div>
          )}
        </div>
        <div>
          <div className="font-bold text-white text-base">{token.symbol}</div>
          <div className="text-xs text-dark-muted">{token.name}</div>
        </div>
      </div>
      <div className="col-span-1 text-right text-sm text-dark-muted font-medium">
        {displayBalance}
      </div>
      <div className="col-span-1 text-right pr-2">
        <div className="font-bold text-white">{usdValue}</div>
      </div>
    </div>
  );
}

// SkeletonRow — shown while the single multicall is loading
function SkeletonRow() {
  return (
    <div className="grid grid-cols-4 items-center px-6 py-4 border-b border-dark-border/30 animate-pulse">
      <div className="col-span-2 flex items-center gap-4">
        <div className="w-10 h-10 rounded-full bg-dark-border/40"></div>
        <div className="space-y-2">
          <div className="h-4 bg-dark-border/40 rounded w-16"></div>
          <div className="h-3 bg-dark-border/40 rounded w-24"></div>
        </div>
      </div>
      <div className="col-span-1 flex justify-end">
        <div className="h-4 bg-dark-border/40 rounded w-20"></div>
      </div>
      <div className="col-span-1 flex justify-end pr-2">
        <div className="h-4 bg-dark-border/40 rounded w-16"></div>
      </div>
    </div>
  );
}