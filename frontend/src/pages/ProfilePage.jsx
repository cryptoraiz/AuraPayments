import { useState } from 'react';
import { useAccount } from 'wagmi';
import { motion, AnimatePresence } from 'framer-motion';

export default function ProfilePage() {
  const { address, isConnected } = useAccount();
  const [activeTab, setActiveTab] = useState('assets'); // 'assets' | 'activity'
  const [avatarUrl, setAvatarUrl] = useState(null);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setAvatarUrl(URL.createObjectURL(file));
    }
  };

  // Mock Data
  const totalBalance = "$4,250.80";
  
  const assets = [
    { symbol: 'USDC', name: 'USD Coin', price: '$1.00', balance: '2,500.00', value: '$2,500.00', color: 'bg-[#2775CA]', iconImg: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.svg?v=024' },
    { symbol: 'ETH', name: 'Ethereum', price: '$3,450.20', balance: '0.45', value: '$1,550.20', color: 'bg-[#627EEA]', iconImg: 'https://cryptologos.cc/logos/ethereum-eth-logo.svg?v=024' },
    { symbol: 'EURC', name: 'Euro Coin', price: '$1.08', balance: '185.00', value: '$200.60', color: 'bg-green-500', iconImg: 'https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@1a63530be6e374711a8554f31b17e4cb92c25fa5/svg/color/eur.svg' },
    { symbol: 'WBTC', name: 'Wrapped BTC', price: '$68,200.00', balance: '0.015', value: '$1,023.00', color: 'bg-orange-500', iconImg: 'https://cryptologos.cc/logos/wrapped-bitcoin-wbtc-logo.svg?v=024' },
    { symbol: 'LINK', name: 'Chainlink', price: '$18.90', balance: '45.00', value: '$850.50', color: 'bg-blue-500', iconImg: 'https://cryptologos.cc/logos/chainlink-link-logo.svg?v=024' },
    { symbol: 'USDT', name: 'Tether', price: '$1.00', balance: '8,400.00', value: '$8,400.00', color: 'bg-[#26A17B]', iconImg: 'https://cryptologos.cc/logos/tether-usdt-logo.svg?v=024' },
  ];

  const activities = [
    { id: 1, type: 'Swap', details: 'USDC → ETH', chain: 'Arc Testnet', time: 'May 16, 08:17 AM', status: 'Completed' },
    { id: 2, type: 'Bridge', details: 'USDC → USDC (Base)', chain: 'Cross-chain', time: 'May 16, 08:34 AM', status: 'Completed' },
    { id: 3, type: 'Invoice', details: 'Received from 0x789...', chain: 'Arc Testnet', time: 'May 15, 14:22 PM', status: 'Pending' },
    { id: 4, type: 'Swap', details: 'ETH → USDC', chain: 'Arc Testnet', time: 'May 10, 09:00 AM', status: 'Failed' },
    { id: 5, type: 'Receive', details: 'From 0x442...', chain: 'Arc Testnet', time: 'May 08, 11:30 AM', status: 'Completed' },
    { id: 6, type: 'Send', details: 'To 0x991...', chain: 'Arc Testnet', time: 'May 05, 16:45 PM', status: 'Completed' },
  ];

  // Pagination Logic
  const assetsPerPage = 5;
  const activitiesPerPage = 4;
  const [assetPage, setAssetPage] = useState(1);
  const [activityPage, setActivityPage] = useState(1);

  const totalAssetPages = Math.ceil(assets.length / assetsPerPage);
  const totalActivityPages = Math.ceil(activities.length / activitiesPerPage);
  
  const paginatedAssets = assets.slice((assetPage - 1) * assetsPerPage, assetPage * assetsPerPage);
  const paginatedActivities = activities.slice((activityPage - 1) * activitiesPerPage, activityPage * activitiesPerPage);

  // If wallet is not connected
  if (!isConnected) {
    return (
      <section className="flex-1 flex flex-col items-center justify-center py-10 w-full">
        <div className="w-full max-w-md mx-auto px-6 text-center space-y-6">
          <div className="w-24 h-24 mx-auto bg-dark-input border border-dark-border rounded-full flex items-center justify-center shadow-[0_0_50px_rgba(39,117,202,0.1)]">
            <span className="text-4xl">🔐</span>
          </div>
          <h1 className="text-3xl font-bold text-white">Connect Wallet</h1>
          <p className="text-dark-muted">Connect your wallet to view your portfolio, assets, and transaction history.</p>
        </div>
      </section>
    );
  }

  // Generate gradient for avatar based on address
  const avatarGradient = address 
    ? `linear-gradient(135deg, #${address.slice(2,8)}, #${address.slice(-6)})`
    : 'linear-gradient(135deg, #2563eb, #9333ea)';

  return (
    <section className="flex-1 flex flex-col items-center justify-start pt-4 pb-4 w-full">
      <div className="w-full max-w-7xl mx-auto px-6 space-y-4 relative z-20">
        
        {/* Profile Header (Total Balance Card) */}
        <div className="bg-dark-card border border-dark-border rounded-3xl p-6 shadow-2xl relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Ambient Glow inside card */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
          
          <div className="flex items-center gap-6 z-10">
            {/* Avatar Upload */}
            <div className="relative w-20 h-20 rounded-2xl shadow-lg border-2 border-dark-border/50 p-1 group cursor-pointer">
              <input 
                type="file" 
                accept="image/*" 
                onChange={handleImageUpload} 
                className="absolute inset-0 opacity-0 cursor-pointer z-20"
                title="Change Profile Picture"
              />
              <div 
                className="w-full h-full rounded-xl overflow-hidden relative flex items-center justify-center bg-dark-bg" 
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
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-mono text-dark-muted bg-dark-input px-3 py-1 rounded-full border border-dark-border/50">
                  {address.slice(0, 6)}...{address.slice(-4)}
                </span>
                <span className="flex items-center gap-1 text-xs font-bold text-green-400 bg-green-500/10 px-2 py-1 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></span> Connected
                </span>
              </div>
              <h1 className="text-4xl font-black text-white tracking-tight mt-2">{totalBalance}</h1>
              <span className="text-sm text-dark-muted font-medium">Total Portfolio Value</span>
            </div>
          </div>

          {/* Quick Actions Removidas a pedido do usuário */}
        </div>

        {/* Content Tabs */}
        <div className="flex items-center gap-1 bg-dark-input p-1 rounded-2xl border border-dark-border/50 w-full max-w-sm">
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
        <div className="grid w-full place-items-start">
          <AnimatePresence mode="wait">
            {activeTab === 'assets' && (
              <motion.div
                key="assets"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.2 }}
                className="col-start-1 row-start-1 w-full bg-dark-card border border-dark-border rounded-3xl overflow-hidden shadow-2xl flex flex-col min-h-[480px]"
              >
                <div className="grid grid-cols-4 px-6 py-5 border-b border-dark-border/50 text-xs font-bold text-dark-muted uppercase tracking-wider">
                  <div className="col-span-2">Asset</div>
                  <div className="col-span-1 text-right">Balance</div>
                  <div className="col-span-1 text-right pr-2">Value</div>
                </div>
                
                {paginatedAssets.map((asset, idx) => (
                  <div key={idx} className="grid grid-cols-4 items-center px-6 py-4 border-b border-dark-border/30 hover:bg-dark-input/30 transition-colors cursor-pointer group">
                    <div className="col-span-2 flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full ${asset.color} flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform overflow-hidden p-[2px] bg-dark-bg/20`}>
                        <img src={asset.iconImg} alt={asset.symbol} className="w-full h-full object-contain rounded-full bg-white p-[1px]" />
                      </div>
                      <div>
                        <div className="font-bold text-white text-base">{asset.symbol}</div>
                        <div className="text-xs text-dark-muted">{asset.name}</div>
                      </div>
                    </div>
                    <div className="col-span-1 text-right text-sm text-dark-muted font-medium">
                      {asset.balance}
                    </div>
                    <div className="col-span-1 text-right pr-2">
                      <div className="font-bold text-white">{asset.value}</div>
                    </div>
                  </div>
                ))}
                
                {/* Pagination Controls */}
                {totalAssetPages > 1 && (
                  <div className="mt-auto flex items-center justify-between px-6 py-4 bg-dark-bg/50 border-t border-dark-border/50">
                    <span className="text-xs font-bold text-dark-muted">
                      Page {assetPage} of {totalAssetPages}
                    </span>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setAssetPage(p => Math.max(1, p - 1))}
                        disabled={assetPage === 1}
                        className="px-3 py-1.5 rounded-lg border border-dark-border bg-dark-input text-white text-xs font-bold hover:bg-dark-border disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                      >
                        Prev
                      </button>
                      <button 
                        onClick={() => setAssetPage(p => Math.min(totalAssetPages, p + 1))}
                        disabled={assetPage === totalAssetPages}
                        className="px-3 py-1.5 rounded-lg border border-dark-border bg-dark-input text-white text-xs font-bold hover:bg-dark-border disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'activity' && (
              <motion.div
                key="activity"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.2 }}
                className="col-start-1 row-start-1 w-full bg-dark-card border border-dark-border rounded-3xl overflow-hidden shadow-2xl flex flex-col min-h-[480px]"
              >
                {/* Activity Header simulating search */}
                <div className="px-6 py-5 border-b border-dark-border/50 bg-dark-bg/50">
                  <div className="relative">
                    <svg className="w-4 h-4 text-dark-muted absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input 
                      type="text" 
                      placeholder="Search transactions..." 
                      className="w-full bg-dark-input border border-dark-border/50 rounded-xl py-2 pl-9 pr-4 text-sm text-white placeholder-dark-muted outline-none focus:border-blue-500/50 transition-colors"
                    />
                  </div>
                </div>

                {paginatedActivities.map((act, idx) => (
                  <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between px-6 py-4 border-b border-dark-border/30 hover:bg-dark-input/30 transition-colors gap-4">
                    
                    {/* Left Side: Icon and Type */}
                    <div className="flex items-center gap-4 w-full sm:w-1/3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-dark-input border border-dark-border shadow-inner ${
                        act.type === 'Swap' ? 'text-blue-400' : (act.type === 'Bridge' ? 'text-purple-400' : 'text-green-400')
                      }`}>
                        {act.type === 'Swap' && <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>}
                        {act.type === 'Bridge' && <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>}
                        {act.type === 'Invoice' && <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>}
                        {act.type === 'Receive' && <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>}
                        {act.type === 'Send' && <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>}
                      </div>
                      <div>
                        <div className="font-bold text-white text-base">{act.type}</div>
                        <div className="text-xs text-dark-muted font-medium">{act.time}</div>
                      </div>
                    </div>

                    {/* Middle: Transaction Details */}
                    <div className="w-full sm:w-1/3 text-left sm:text-center">
                      <div className="font-medium text-white text-sm bg-dark-bg/50 inline-block px-3 py-1 rounded-lg border border-dark-border/50">
                        {act.details}
                      </div>
                      <div className="text-[11px] text-dark-muted uppercase font-bold tracking-wider mt-1">
                        {act.chain}
                      </div>
                    </div>

                    {/* Right Side: Status and View Details Button */}
                    <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-1/3">
                      <span className={`text-[10px] sm:text-xs font-bold px-2.5 py-1 rounded-md border ${
                        act.status === 'Completed' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 
                        act.status === 'Pending' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' : 
                        'bg-red-500/10 text-red-400 border-red-500/20'
                      }`}>
                        {act.status}
                      </span>
                      
                      <button className="px-4 py-1.5 rounded-full border border-dark-border bg-dark-bg hover:bg-white hover:text-black text-white text-xs font-bold transition-all shadow-md active:scale-95 whitespace-nowrap">
                        View Details
                      </button>
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
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
