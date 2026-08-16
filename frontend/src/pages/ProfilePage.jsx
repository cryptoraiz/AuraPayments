import { useState, useMemo } from 'react';
import { useAccount, useBalance } from 'wagmi';
import { getAllTokens } from '../config/tokens';
import { motion } from 'framer-motion';
import { useTokenPrices, formatUsdValue } from '../hooks/useTokenPrices';
import { getTradeHistoryByWallet } from '../utils/localStorage';

const getExplorerUrl = (txHash, chain) => {
  if (!txHash || txHash === 'undefined' || txHash === 'null') return null;
  const c = (chain || '').toLowerCase();
  if (c.includes('base')) return `https://sepolia.basescan.org/tx/${txHash}`;
  if (c.includes('polygon')) return `https://amoy.polygonscan.com/tx/${txHash}`;
  if (c.includes('optimism')) return `https://sepolia-optimism.etherscan.io/tx/${txHash}`;
  if (c.includes('arbitrum')) return `https://sepolia.arbiscan.io/tx/${txHash}`;
  if (c.includes('ethereum')) return `https://sepolia.etherscan.io/tx/${txHash}`;
  return `https://testnet.arcscan.app/tx/${txHash}`;
};

const ARC_CHAIN_ID = 5042002;

// Portfolio tokens on Arc Testnet
const PORTFOLIO_TOKENS = [
  { symbol: 'USDC',   name: 'USD Coin (Arc)',   address: null,                                               decimals: 18, color: 'bg-blue-400',   iconImg: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png', isNative: true },
  { symbol: 'USDT',   name: 'Tether USD',       address: '0x175CdB1D338945f0D851A741ccF787D343E57952',       decimals: 18, color: 'bg-green-500',  iconImg: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xdAC17F958D2ee523a2206206994597C13D831ec7/logo.png' },
  { symbol: 'EURC',   name: 'Euro Coin',        address: '0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a',       decimals: 6,  color: 'bg-indigo-500', iconImg: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x1aBaEA1f7C830bD89Acc67eC4af516284b1bC33c/logo.png' },
  { symbol: 'WUSDC',  name: 'Wrapped USDC',     address: '0x911b4000D3422F482F4062a913885f7b035382Df',       decimals: 18, color: 'bg-blue-500',   iconImg: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png' },
  { symbol: 'cirBTC', name: 'Circle Bitcoin',   address: '0xf0C4a4CE82A5746AbAAd9425360Ab04fbBA432BF',       decimals: 8,  color: 'bg-orange-500', iconImg: '/cirbtc.svg' },
];

const NetworkBadge = ({ chain }) => {
  const c = (chain || '').toLowerCase();
  
  if (c.includes('arc')) return (
    <div className="absolute -bottom-1 -right-1 w-[16px] h-[16px] rounded-full border border-dark-bg bg-[#121A2F] flex items-center justify-center">
      <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 22h4.5l2.5-5h6l2.5 5H22L12 2zm0 5l2 4H10l2-4z"/></svg>
    </div>
  );
  if (c.includes('polygon')) return (
    <div className="absolute -bottom-1 -right-1 w-[16px] h-[16px] rounded-full border border-dark-bg bg-white flex items-center justify-center">
      <svg className="w-2 h-2 text-[#8247E5]" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.6L4.2 7.1v9L12 20.6l7.8-4.5v-9L12 2.6zm5.8 11.2l-5.8 3.4-5.8-3.4V7.1l5.8-3.4 5.8 3.4v6.7z"/></svg>
    </div>
  );
  if (c.includes('base')) return (
    <div className="absolute -bottom-1 -right-1 w-[16px] h-[16px] rounded-full border border-dark-bg bg-[#0052FF] flex items-center justify-center">
      <svg className="w-2 h-2 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm-3-12a3 3 0 100 6 3 3 0 000-6zm6 0a3 3 0 100 6 3 3 0 000-6z"/></svg>
    </div>
  );
  if (c.includes('optimism')) return (
    <div className="absolute -bottom-1 -right-1 w-[16px] h-[16px] rounded-full border border-dark-bg bg-[#FF0420] flex items-center justify-center">
      <svg className="w-2 h-2 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm1 14H9v-2h4v2zm0-4H9V8h4v4z"/></svg>
    </div>
  );
  if (c.includes('arbitrum')) return (
    <div className="absolute -bottom-1 -right-1 w-[16px] h-[16px] rounded-full border border-dark-bg bg-[#28A0F0] flex items-center justify-center">
      <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 20h20L12 2zm0 4.2l5.5 10H6.5L12 6.2z"/></svg>
    </div>
  );
  if (c.includes('ethereum')) return (
    <div className="absolute -bottom-1 -right-1 w-[16px] h-[16px] rounded-full border border-dark-bg bg-[#627EEA] flex items-center justify-center">
      <svg className="w-2 h-2 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 17.97L4.58 13.62 11.943 24l7.37-10.38-7.372 4.35h.003zM12.056 0L4.69 12.223l7.365 4.354 7.365-4.35L12.056 0z"/></svg>
    </div>
  );
  if (c.includes('invoice')) return (
    <div className="absolute -bottom-1 -right-1 w-[16px] h-[16px] rounded-full border border-dark-bg bg-green-500 flex items-center justify-center">
      <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>
    </div>
  );
  
  return (
    <div className="absolute -bottom-1 -right-1 w-[16px] h-[16px] rounded-full border border-dark-bg bg-zinc-600 flex items-center justify-center">
      <span className="text-[6px] font-bold text-white uppercase">{c.charAt(0)}</span>
    </div>
  );
};

const getTokenIcon = (symbol) => {
  if (!symbol) return 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png';
  const token = PORTFOLIO_TOKENS.find(t => t.symbol?.toUpperCase() === symbol.toUpperCase());
  return token ? token.iconImg : 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png';
};

// Balance Hook using Wagmi multicall
function usePortfolioBalances(address) {
  // USDC = native currency on Arc, so we call useBalance WITHOUT a token address
  const usdc   = useBalance({ address, chainId: ARC_CHAIN_ID, query: { enabled: !!address, refetchInterval: 15_000, staleTime: 10_000 } });
  const usdt   = useBalance({ address, token: '0x175CdB1D338945f0D851A741ccF787D343E57952', chainId: ARC_CHAIN_ID, query: { enabled: !!address, refetchInterval: 15_000, staleTime: 10_000 } });
  const eurc   = useBalance({ address, token: '0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a', chainId: ARC_CHAIN_ID, query: { enabled: !!address, refetchInterval: 15_000, staleTime: 10_000 } });
  const wusdc  = useBalance({ address, token: '0x911b4000D3422F482F4062a913885f7b035382Df', chainId: ARC_CHAIN_ID, query: { enabled: !!address, refetchInterval: 15_000, staleTime: 10_000 } });
  const cirBtc = useBalance({ address, token: '0xf0C4a4CE82A5746AbAAd9425360Ab04fbBA432BF', chainId: ARC_CHAIN_ID, query: { enabled: !!address, refetchInterval: 15_000, staleTime: 10_000 } });

  // Only show skeleton on the very first load (isLoading=true), not on background refetches
  const firstLoad = !!(address && (usdc.isLoading || usdt.isLoading || eurc.isLoading || wusdc.isLoading || cirBtc.isLoading));

  const balances = useMemo(() => [
    usdc.data   ? Number(usdc.data.formatted)   : 0,
    usdt.data   ? Number(usdt.data.formatted)   : 0,
    eurc.data   ? Number(eurc.data.formatted)   : 0,
    wusdc.data  ? Number(wusdc.data.formatted)  : 0,
    cirBtc.data ? Number(cirBtc.data.formatted) : 0,
  ], [usdc.data, usdt.data, eurc.data, wusdc.data, cirBtc.data]);

  return { loading: firstLoad, balances };
}

export default function ProfilePage() {
  const { address, isConnected } = useAccount();
  const [activeTab, setActiveTab] = useState('assets');
  const [avatarUrl, setAvatarUrl] = useState(null);
  const { prices } = useTokenPrices();
  const { loading: balancesLoading, balances } = usePortfolioBalances(address);

  // Compute total portfolio value
  const totalValueNum = useMemo(() => {
    if (!prices) return 0;
    return PORTFOLIO_TOKENS.reduce((sum, token, i) => {
      const bal = balances[i] || 0;
      const price = prices[token.symbol] || 0;
      return sum + bal * price;
    }, 0);
  }, [balances, prices]);

  const totalBalance = prices
    ? `$${totalValueNum.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : '...';

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) setAvatarUrl(URL.createObjectURL(file));
  };

  const activities = getTradeHistoryByWallet(address).map(t => {
    const d = new Date(t.createdAt);
    return {
      ...t,
      dateFormatted: d.toLocaleString('en-US', { month: 'short', day: 'numeric' }),
      timeFormatted: d.toLocaleString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
      time: d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }),
      status: 'Completed'
    };
  }).sort((a, b) => b.createdAt - a.createdAt);

  // Pagination Logic
  const activitiesPerPage = 4;
  const [activityPage, setActivityPage] = useState(1);

  const totalActivityPages = Math.ceil(activities.length / activitiesPerPage);
  
  const paginatedActivities = activities.slice((activityPage - 1) * activitiesPerPage, activityPage * activitiesPerPage);

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
    <section className="flex-1 flex flex-col items-center justify-start py-4 w-full min-h-0">
      <div className="w-full max-w-7xl mx-auto px-4 md:px-6 flex flex-col h-full min-h-0 gap-4 relative z-20">
        
        {/* Profile Header (Total Balance Card) */}
        <div className="bg-dark-card border border-dark-border rounded-3xl p-4 shadow-2xl relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-4 shrink-0">
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
        <div className="grid w-full flex-1 min-h-0 relative">
          <>
            {/* Tab: Assets */}
            <div
              className={`col-start-1 row-start-1 w-full bg-dark-card border border-dark-border rounded-3xl overflow-hidden shadow-2xl flex-col min-h-[480px] ${
                activeTab === 'assets' ? 'flex' : 'hidden'
              }`}
            >
              <div className="grid grid-cols-4 px-6 py-5 border-b border-dark-border/50 text-xs font-bold text-dark-muted uppercase tracking-wider">
                <div className="col-span-2">Asset</div>
                <div className="col-span-1 text-right">Balance</div>
                <div className="col-span-1 text-right pr-2">Value</div>
              </div>
              
              {balancesLoading
                ? PORTFOLIO_TOKENS.map((_, idx) => <SkeletonRow key={idx} />)
                : PORTFOLIO_TOKENS.map((token, idx) => (
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
                    placeholder="Search by token hash/symbol/chain" 
                    className="w-full bg-dark-input border border-dark-border/50 rounded-xl py-2 pl-9 pr-4 text-sm text-white placeholder-dark-muted outline-none focus:border-blue-500/50 transition-colors"
                  />
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

              {paginatedActivities.length === 0 ? <div className="p-6 text-center text-dark-muted">No recent activities found for this wallet</div> : paginatedActivities.map((act, idx) => (
                <div key={idx} className="flex flex-col md:grid md:grid-cols-12 md:items-center px-6 py-4 border-b border-dark-border/30 hover:bg-dark-input/30 transition-colors gap-4 md:gap-4">
                  
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
                      <NetworkBadge chain={act.type === 'Receive' ? 'Invoice' : 'Arc Testnet'} />
                    </div>
                    <div className="flex flex-col">
                      <div className="font-bold text-white text-sm">{act.amountIn || act.amount} {act.tokenIn || act.currency}</div>
                      <div className="text-[11px] text-dark-muted uppercase font-bold tracking-wider">{act.type === 'Receive' ? 'Invoice' : 'Arc Testnet'}</div>
                    </div>
                  </div>

                  {/* Destination */}
                  <div className="md:col-span-3 flex items-center gap-3">
                    {act.type === 'Swap' || act.type === 'Bridge' ? (
                      <>
                        <div className="relative">
                          <img src={getTokenIcon(act.tokenOut || act.tokenIn)} alt="token" className="w-8 h-8 rounded-full" />
                          <NetworkBadge chain={act.toChain || 'Arc Testnet'} />
                        </div>
                        <div className="flex flex-col">
                          <div className="font-bold text-white text-sm">{act.amountOut || act.amountIn} {act.tokenOut || act.tokenIn}</div>
                          <div className="text-[11px] text-dark-muted uppercase font-bold tracking-wider">{act.toChain || 'Arc Testnet'}</div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="relative">
                          <div className="w-8 h-8 rounded-full bg-dark-input border border-dark-border/50 flex items-center justify-center text-dark-muted">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                          </div>
                          <NetworkBadge chain="Arc Testnet" />
                        </div>
                        <div className="flex flex-col max-w-[120px]">
                          <div className="font-bold text-white text-sm truncate">{act.type === 'Send' ? (act.recipientName || 'Wallet') : 'Wallet'}</div>
                          <div className="text-[11px] text-dark-muted uppercase font-bold tracking-wider">{act.type === 'Send' ? 'Arc Testnet' : 'Arc Testnet'}</div>
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
                  <div className="md:col-span-1 flex justify-end items-center mt-2 md:mt-0">
                    {(() => {
                      const hash = act.txHash || act.hash;
                      const chain = act.type === 'Bridge' ? (act.fromChain || 'Arc Testnet') : 'Arc Testnet';
                      const url = getExplorerUrl(hash, chain);
                      return url ? (
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-4 py-1.5 rounded-full border border-dark-border bg-white text-black hover:bg-zinc-200 text-xs font-bold transition-all shadow-md active:scale-95 whitespace-nowrap w-full md:w-auto text-center"
                        >
                          View Details
                        </a>
                      ) : (
                        <span className="px-4 py-1.5 rounded-full border border-dark-border bg-dark-input text-dark-muted text-xs font-bold whitespace-nowrap w-full md:w-auto text-center opacity-50 cursor-not-allowed">
                          No Hash
                        </span>
                      );
                    })()}
                  </div>
                </div>
              ))}

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
                      className="px-3 py-1.5 rounded-lg border border-dark-border bg-dark-input text-white text-xs font-bold hover:bg-dark-border disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      Prev
                    </button>
                    <button 
                      onClick={() => setActivityPage(p => Math.min(totalActivityPages, p + 1))}
                      disabled={activityPage === totalActivityPages}
                      className="px-3 py-1.5 rounded-lg border border-dark-border bg-dark-input text-white text-xs font-bold hover:bg-dark-border disabled:opacity-50 disabled:cursor-not-allowed transition-all"
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
    </section>
  );
}


// AssetRow — receives balance directly from parent (no independent RPC call)
function AssetRow({ token, balance, prices }) {
  const displayBalance = balance > 0 
    ? balance.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })
    : '0,00';
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