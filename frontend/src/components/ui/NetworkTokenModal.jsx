import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { getAllTokens, getTokenBySymbol } from '../../config/tokens';
import { getAllChains, getChainsByMode, getChainById } from '../../config/chains';
import { useAccount, useBalance } from 'wagmi';
import { useActiveArcChain } from '../../hooks/useActiveArcChain';

export default function NetworkTokenModal({ isOpen, onClose, onSelect, selectedChain, selectedToken, selectingFor = 'in' }) {
  const { isMainnet } = useActiveArcChain();
  const chains = useMemo(() => getChainsByMode(isMainnet), [isMainnet]);
  const { address } = useAccount();

  // Initialize directly from selectedChain to prevent re-render flicker on open
  const [activeChain, setActiveChain] = useState(() => {
    if (selectedChain && chains.some(c => c.id === selectedChain.id)) {
      return selectedChain;
    }
    return chains[0] || getChainById(5042);
  });

  const [search, setSearch] = useState('');
  const [networkSearch, setNetworkSearch] = useState('');

  // Notebook / Compact Screen Detection
  const [isNotebook, setIsNotebook] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerHeight <= 850 || (window.innerWidth <= 1536 && window.innerHeight <= 900);
  });

  useEffect(() => {
    const checkNotebook = () => {
      if (typeof window === 'undefined') return;
      setIsNotebook(window.innerHeight <= 850 || (window.innerWidth <= 1536 && window.innerHeight <= 900));
    };
    checkNotebook();
    window.addEventListener('resize', checkNotebook);
    return () => window.removeEventListener('resize', checkNotebook);
  }, []);

  // When modal opens or selectedChain changes from parent, sync activeChain
  useEffect(() => {
    if (isOpen && selectedChain && chains.some(c => c.id === selectedChain.id)) {
      setActiveChain(selectedChain);
    }
  }, [isOpen, selectedChain?.id, chains]);

  // Fallback if current activeChain is not part of the active mode (e.g. mainnet vs testnet toggle)
  useEffect(() => {
    if (activeChain && !chains.some(c => c.id === activeChain.id)) {
      setActiveChain(chains[0] || getChainById(5042));
    }
  }, [chains, activeChain?.id]);

  // Reset internal search filter when closed
  useEffect(() => {
    if (!isOpen) {
      setSearch('');
      setNetworkSearch('');
    }
  }, [isOpen]);

  // Filter networks by search
  const filteredChains = chains.filter(c => c.name.toLowerCase().includes(networkSearch.toLowerCase()));

  // Filter only to USDC for the active chain
  const tokens = getAllTokens().filter(t => {
    if (t.symbol !== 'USDC') return false;
    if (t.chainId) return t.chainId === activeChain?.id;
    return activeChain?.id === 5042 || activeChain?.id === 5042002; // tokens without chainId belong to Arc
  }).filter(t => {
    if (!search) return true;
    return t.symbol.toLowerCase().includes(search.toLowerCase()) ||
           t.name.toLowerCase().includes(search.toLowerCase()) ||
           t.address?.toLowerCase().includes(search.toLowerCase());
  });

  const handleChainClick = (chain) => {
    // If user clicks the currently active chain again, immediately confirm selection
    if (activeChain?.id === chain.id) {
      const token = tokens[0] || getTokenBySymbol('USDC', chain.id);
      if (token) {
        onSelect({ chain, token });
        onClose();
        return;
      }
    }
    setActiveChain(chain);
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm overflow-y-auto"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.98, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.98, opacity: 0, y: 10 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className={`bg-dark-card border border-dark-border shadow-2xl overflow-hidden flex flex-col md:flex-row w-full my-auto ${
              isNotebook 
                ? 'max-w-2xl h-[78dvh] max-h-[460px] rounded-2xl' 
                : 'max-w-3xl h-[85dvh] max-h-[560px] min-h-[380px] rounded-3xl'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Left Sidebar (Networks) */}
            <div className={`w-full ${isNotebook ? 'md:w-[230px]' : 'md:w-[280px]'} max-h-[140px] md:max-h-none bg-dark-bg border-b md:border-b-0 md:border-r border-dark-border/50 flex flex-col flex-shrink-0`}>
              <div className={`${isNotebook ? 'p-2.5' : 'p-4'} border-b border-dark-border/50`}>
                <div className="relative">
                  <svg className={`absolute left-3 top-1/2 -translate-y-1/2 ${isNotebook ? 'w-3.5 h-3.5' : 'w-4 h-4'} text-dark-muted`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Search Network"
                    value={networkSearch}
                    onChange={(e) => setNetworkSearch(e.target.value)}
                    className={`w-full bg-dark-card border border-dark-border rounded-xl ${isNotebook ? 'py-1.5 pl-8 pr-2.5 text-xs' : 'py-2 pl-9 pr-3 text-sm'} text-white placeholder-dark-muted focus:outline-none focus:border-blue-500 transition-colors`}
                  />
                </div>
              </div>
              
              <div className={`flex-1 overflow-y-auto hide-scrollbar ${isNotebook ? 'p-1.5' : 'p-2'} space-y-1`}>
                <div className={`${isNotebook ? 'text-[9px] px-2 mb-1 mt-1' : 'text-[10px] px-3 mb-2 mt-2'} font-bold text-dark-muted uppercase tracking-wider`}>
                  Top Chains
                </div>
                {filteredChains.map((chain) => {
                  const isActive = activeChain?.id === chain.id;
                  const isCurrentSelection = selectedChain?.id === chain.id;
                  return (
                    <button
                      key={chain.id}
                      type="button"
                      onClick={() => handleChainClick(chain)}
                      className={`w-full flex items-center justify-between ${
                        isNotebook ? 'gap-2 px-2.5 py-2 rounded-lg text-xs' : 'gap-3 px-3 py-2.5 rounded-xl text-sm'
                      } transition-all duration-150 font-medium cursor-pointer ${
                        isActive 
                          ? 'bg-blue-600/20 text-white shadow-sm border border-blue-500/40' 
                          : 'text-dark-muted hover:bg-dark-card/60 hover:text-white border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <NetworkIcon chain={chain} size={isNotebook ? 'xs' : 'sm'} />
                        <span className="truncate font-semibold">{chain.name}</span>
                      </div>
                      {isCurrentSelection && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30 shrink-0">
                          In use
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right Panel (Tokens) */}
            <div className="flex-1 flex flex-col bg-dark-card min-w-0">
              <div className={`flex items-center justify-between ${isNotebook ? 'px-4 py-2.5' : 'p-5'} border-b border-dark-border/50`}>
                <div className="flex flex-col">
                  <h3 className={`${isNotebook ? 'text-base' : 'text-xl'} font-bold text-white`}>
                    {selectingFor === 'out' ? 'Exchange to' : 'Exchange from'}
                  </h3>
                  <span className={`${isNotebook ? 'text-[10px]' : 'text-xs'} text-dark-muted font-medium`}>
                    {activeChain?.name ? `Selected Network: ${activeChain.name}` : 'Select Token'}
                  </span>
                </div>
                <button onClick={onClose}
                  className={`${isNotebook ? 'w-7 h-7' : 'w-8 h-8'} flex items-center justify-center rounded-full bg-dark-bg text-dark-muted hover:text-white hover:bg-dark-border transition-colors`}>
                  <svg className={`${isNotebook ? 'w-4 h-4' : 'w-5 h-5'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              <div className={`${isNotebook ? 'px-3.5 py-2' : 'p-4'} border-b border-dark-border/50`}>
                <div className="relative">
                  <svg className={`absolute left-3 top-1/2 -translate-y-1/2 ${isNotebook ? 'w-4 h-4' : 'w-5 h-5'} text-dark-muted`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    placeholder="search token name or paste address"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className={`w-full bg-dark-bg border border-dark-border rounded-xl ${isNotebook ? 'py-1.5 pl-9 pr-3 text-xs' : 'py-3 pl-10 pr-4 text-sm'} text-white placeholder-dark-muted focus:outline-none focus:border-blue-500 transition-colors`}
                  />
                </div>
              </div>

              <div className={`flex-1 overflow-y-auto hide-scrollbar ${isNotebook ? 'p-1.5' : 'p-2'}`}>
                {tokens.length === 0 ? (
                  <div className={`text-center ${isNotebook ? 'py-5 text-xs' : 'py-8 text-sm'} text-dark-muted`}>No tokens found on this network.</div>
                ) : tokens.map((token) => (
                  <TokenRow
                    key={token.symbol}
                    token={token}
                    chain={activeChain}
                    userAddress={address}
                    onSelect={() => { onSelect({ chain: activeChain, token }); onClose(); }}
                    isSelected={selectedToken?.symbol === token.symbol && selectedChain?.id === activeChain.id}
                    isNotebook={isNotebook}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

function NetworkIcon({ chain, size = 'md' }) {
  const [error, setError] = useState(false);
  const dim = size === 'xs' ? 'w-5 h-5' : size === 'sm' ? 'w-6 h-6' : 'w-8 h-8';

  if (error || !chain.icon) {
    return (
      <div className={`${dim} rounded-full ${chain.color || 'bg-blue-600'} flex items-center justify-center text-white text-[9px] font-bold shrink-0`}>
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

function TokenIcon({ token, size = 'md' }) {
  const [imgError, setImgError] = useState(false);
  const dim = size === 'sm' ? 'w-8 h-8' : 'w-10 h-10';

  if (imgError || !token.iconImg) {
    return (
      <div className={`${dim} rounded-full ${token.color || 'bg-gray-600'} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
        {token.symbol.slice(0, 2)}
      </div>
    );
  }
  return (
    <div className={`${dim} rounded-full overflow-hidden shrink-0`}>
      <img src={token.iconImg} alt={token.symbol} className="w-full h-full object-contain rounded-full" onError={() => setImgError(true)} />
    </div>
  );
}

function TokenRow({ token, chain, onSelect, isSelected, userAddress, isNotebook }) {
  // Arc USDC is the native precompile on Arc Mainnet & Testnet
  const isArc = chain?.id === 5042 || chain?.id === 5042002;
  const isNative = token?.isNative || (isArc && (token?.symbol === 'USDC' || token?.address?.toLowerCase() === '0x3600000000000000000000000000000000000000'));

  const { data: balanceData, isLoading } = useBalance({
    address: userAddress,
    token:   isNative ? undefined : token?.address,
    chainId: chain?.id,
    query: {
      enabled: !!userAddress,
      staleTime: 60_000,
      gcTime: 300_000,
      refetchInterval: 10_000,
    }
  });

  const displayBalance = balanceData 
    ? Number(balanceData.formatted) < 0.01
      ? Number(balanceData.formatted).toLocaleString('en-US', { maximumFractionDigits: 8 })
      : Number(balanceData.formatted).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })
    : (isLoading ? '...' : '0.00');

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full flex items-center justify-between ${
        isNotebook ? 'p-2.5 rounded-xl' : 'p-3.5 rounded-2xl'
      } transition-all duration-150 group cursor-pointer ${
        isSelected 
          ? 'bg-blue-500/15 border border-blue-500/40 shadow-sm' 
          : 'bg-dark-bg/40 hover:bg-dark-bg/80 border border-dark-border/40 hover:border-blue-500/30'
      }`}
    >
      <div className={`flex items-center ${isNotebook ? 'gap-2.5' : 'gap-3'}`}>
        <TokenIcon token={token} size={isNotebook ? 'sm' : 'md'} />
        <div className="flex flex-col items-start text-left">
          <div className="flex items-center gap-1.5">
            <span className={`font-bold text-white ${isNotebook ? 'text-sm' : 'text-base'} tracking-wide`}>
              {token.symbol}
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-semibold uppercase">
              {chain?.name}
            </span>
          </div>
          <span className={`${isNotebook ? 'text-[10px]' : 'text-xs'} text-dark-muted font-medium`}>
            {token.name}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex flex-col items-end text-right">
          <span className={`${isNotebook ? 'text-[10px] mb-0.5' : 'text-xs mb-1'} text-blue-400 font-mono opacity-80`}>
            {token.address ? `${token.address.slice(0, 6)}...${token.address.slice(-4)}` : ''}
          </span>
          <div className="flex items-center gap-1.5">
            <span className={`font-semibold text-white ${isNotebook ? 'text-xs sm:text-sm' : 'text-base'}`}>
              {displayBalance}
            </span>
            <span className="text-[10px] text-dark-muted">USDC</span>
          </div>
        </div>
        <div className={`px-2.5 py-1 rounded-lg text-xs font-semibold shrink-0 transition-all ${
          isSelected
            ? 'bg-blue-500 text-white shadow-sm'
            : 'bg-blue-600/20 text-blue-300 group-hover:bg-blue-600 group-hover:text-white border border-blue-500/30'
        }`}>
          {isSelected ? 'Selected' : 'Select'}
        </div>
      </div>
    </button>
  );
}
