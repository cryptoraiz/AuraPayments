import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getAllTokens } from '../../config/tokens';
import { getAllChains } from '../../config/chains';
import { useAccount, useBalance } from 'wagmi';

export default function NetworkTokenModal({ isOpen, onClose, onSelect, selectedChain, selectedToken }) {
  const chains = getAllChains();
  const { address } = useAccount();

  const [activeChain, setActiveChain] = useState(selectedChain || chains[0]);
  const [search, setSearch] = useState('');

  // Filter only to USDC for the active chain
  const tokens = getAllTokens().filter(t => {
    if (t.symbol !== 'USDC') return false;
    if (t.chainId) return t.chainId === activeChain.id;
    return activeChain.id === 5042002; // tokens without chainId belong to Arc
  });

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="bg-dark-card border border-dark-border rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row h-[550px]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Left Sidebar (Networks) */}
          <div className="w-full md:w-[280px] bg-dark-bg border-r border-dark-border/50 flex flex-col flex-shrink-0">
            <div className="p-4 border-b border-dark-border/50">
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Search Network"
                  className="w-full bg-dark-card border border-dark-border rounded-xl py-2 pl-9 pr-3 text-sm text-white placeholder-dark-muted focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto hide-scrollbar p-2">
              <div className="text-[10px] font-bold text-dark-muted uppercase tracking-wider px-3 mb-2 mt-2">Top Chains</div>
              {chains.map((chain) => (
                <button
                  key={chain.id}
                  onClick={() => setActiveChain(chain)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 text-sm font-medium ${
                    activeChain.id === chain.id 
                      ? 'bg-dark-card text-white shadow-sm border border-dark-border/50' 
                      : 'text-dark-muted hover:bg-dark-card/50 hover:text-white border border-transparent'
                  }`}
                >
                  <NetworkIcon chain={chain} size="sm" />
                  {chain.name}
                </button>
              ))}
            </div>
          </div>

          {/* Right Panel (Tokens) */}
          <div className="flex-1 flex flex-col bg-dark-card">
            <div className="flex items-center justify-between p-5 border-b border-dark-border/50">
              <h3 className="text-xl font-bold text-white">Exchange from</h3>
              <button onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-dark-bg text-dark-muted hover:text-white hover:bg-dark-border transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="p-4 border-b border-dark-border/50">
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="search token name or paste address"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-dark-bg border border-dark-border rounded-xl py-3 pl-10 pr-4 text-white placeholder-dark-muted focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto hide-scrollbar p-2">
              {tokens.length === 0 ? (
                <div className="text-center py-8 text-dark-muted text-sm">No tokens found on this network.</div>
              ) : tokens.map((token) => (
                <TokenRow
                  key={token.symbol}
                  token={token}
                  chain={activeChain}
                  userAddress={address}
                  onSelect={() => { onSelect({ chain: activeChain, token }); onClose(); }}
                  isSelected={selectedToken?.symbol === token.symbol && selectedChain?.id === activeChain.id}
                />
              ))}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function NetworkIcon({ chain, size = 'md' }) {
  const [error, setError] = useState(false);
  const dim = size === 'sm' ? 'w-6 h-6' : 'w-8 h-8';

  if (error || !chain.icon) {
    return (
      <div className={`${dim} rounded-full ${chain.color || 'bg-blue-600'} flex items-center justify-center text-white text-[10px] font-bold shrink-0`}>
        {chain.name.slice(0, 2)}
      </div>
    );
  }
  return (
    <div className={`${dim} rounded-full overflow-hidden shrink-0`}>
      <img src={chain.icon} alt={chain.name} onError={() => setError(true)} className="w-full h-full object-contain rounded-full" />
    </div>
  );
}

function TokenIcon({ token }) {
  const [imgError, setImgError] = useState(false);
  if (imgError || !token.iconImg) {
    return (
      <div className="w-10 h-10 rounded-full bg-gray-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
        {token.symbol.slice(0, 2)}
      </div>
    );
  }
  return (
    <div className="w-10 h-10 rounded-full overflow-hidden shrink-0">
      <img src={token.iconImg} alt={token.symbol} className="w-full h-full object-contain rounded-full" onError={() => setImgError(true)} />
    </div>
  );
}

function TokenRow({ token, chain, onSelect, isSelected, userAddress }) {
  // Pass dynamic chainId to wagmi to fetch balance across different networks!
  const { data: balanceData } = useBalance({
    address: userAddress,
    token:   token.isNative ? undefined : token.address,
    chainId: chain.id, 
  });

  const displayBalance = balanceData 
    ? Number(balanceData.formatted) < 0.01
      ? Number(balanceData.formatted).toLocaleString('en-US', { maximumFractionDigits: 8 })
      : Number(balanceData.formatted).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })
    : '0,00';

  return (
    <button
      onClick={onSelect}
      className={`w-full flex items-center justify-between p-3 rounded-2xl transition-all duration-200 hover:bg-dark-bg/80 group ${isSelected ? 'bg-blue-500/10 border border-blue-500/20' : 'border border-transparent'}`}
    >
      <div className="flex items-center gap-3">
        <TokenIcon token={token} />
        <div className="flex flex-col items-start">
          <span className="font-bold text-white text-base tracking-wide">{token.symbol}</span>
          <span className="text-xs text-dark-muted font-medium">{token.name}</span>
        </div>
      </div>
      <div className="flex flex-col items-end text-right">
        {/* Placeholder for balance, showing chain prefix address */}
        <span className="text-xs text-blue-400 font-mono opacity-80 mb-1">{token.address.slice(0, 6)}...{token.address.slice(-4)}</span>
        <div className="flex items-center gap-2">
           <span className="font-semibold text-white">{displayBalance}</span>
        </div>
      </div>
    </button>
  );
}
