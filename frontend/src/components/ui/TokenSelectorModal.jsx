import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { getAllTokens } from '../../config/tokens';
import { useAccount, useBalance, useChainId } from 'wagmi';
import { arcMainnet, arcTestnet } from '../../config/wagmi';

export default function TokenSelectorModal({ isOpen, onClose, onSelect, selectedToken }) {
  const tokens = getAllTokens();
  const { address } = useAccount();
  const chainId = useChainId();
  const isMainnet = chainId === arcMainnet.id;
  const activeArcChainId = isMainnet ? arcMainnet.id : arcTestnet.id;
  const [search, setSearch] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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

  if (!mounted || typeof document === 'undefined') return null;

  const filtered = tokens.filter(t => {
    const isArcToken = isMainnet 
      ? t.chainId === arcMainnet.id
      : t.chainId === arcTestnet.id;
    if (!isArcToken) return false;
    return t.symbol.toLowerCase().includes(search.toLowerCase()) ||
           t.name.toLowerCase().includes(search.toLowerCase());
  });

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
            className={`bg-dark-card border border-dark-border shadow-2xl overflow-hidden flex flex-col w-full my-auto ${
              isNotebook 
                ? 'max-w-sm max-h-[460px] rounded-2xl' 
                : 'max-w-md max-h-[88dvh] rounded-3xl'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className={`flex items-center justify-between ${isNotebook ? 'px-4 py-2.5' : 'p-5'} border-b border-dark-border/50`}>
              <h3 className={`${isNotebook ? 'text-base' : 'text-xl'} font-bold text-white`}>Select Token</h3>
              <button onClick={onClose}
                className={`${isNotebook ? 'w-7 h-7' : 'w-8 h-8'} flex items-center justify-center rounded-full bg-dark-bg text-dark-muted hover:text-white hover:bg-dark-border transition-colors`}>
                <svg className={`${isNotebook ? 'w-4 h-4' : 'w-5 h-5'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Search */}
            <div className={`${isNotebook ? 'px-3.5 py-2' : 'p-4'} border-b border-dark-border/50`}>
              <div className="relative">
                <svg className={`absolute left-3 top-1/2 -translate-y-1/2 ${isNotebook ? 'w-4 h-4' : 'w-5 h-5'} text-dark-muted`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Search name or paste address"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  autoFocus
                  className={`w-full bg-dark-bg border border-dark-border rounded-xl ${isNotebook ? 'py-1.5 pl-9 pr-3 text-xs' : 'py-3 pl-10 pr-4 text-sm'} text-white placeholder-dark-muted focus:outline-none focus:border-blue-500 transition-colors`}
                />
              </div>
            </div>

            {/* Token List */}
            <div className={`overflow-y-auto ${isNotebook ? 'max-h-[300px] p-1.5' : 'max-h-[50dvh] md:max-h-[400px] p-2'} hide-scrollbar`}>
              {filtered.length === 0 ? (
                <div className={`text-center ${isNotebook ? 'py-5 text-xs' : 'py-8 text-sm'} text-dark-muted`}>No tokens found</div>
              ) : filtered.map((token) => (
                <TokenRow
                  key={token.symbol}
                  token={token}
                  onSelect={() => { onSelect(token); onClose(); }}
                  isSelected={selectedToken?.symbol === token.symbol}
                  userAddress={address}
                  activeArcChainId={activeArcChainId}
                  isMainnet={isMainnet}
                  isNotebook={isNotebook}
                />
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
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
      <img
        src={token.iconImg}
        alt={token.symbol}
        className="w-full h-full object-contain rounded-full"
        onError={() => setImgError(true)}
      />
    </div>
  );
}

function TokenRow({ token, onSelect, isSelected, userAddress, activeArcChainId, isMainnet, isNotebook }) {
  const isNativeUSDC = token.isNative || token.symbol === 'USDC' || token.address?.toLowerCase() === '0x3600000000000000000000000000000000000000';
  const tokenAddress = isNativeUSDC ? undefined : token.address;

  const { data: balanceData } = useBalance({
    address: userAddress,
    token:   tokenAddress,
    chainId: activeArcChainId,
    query: { refetchInterval: 3000 }
  });

  const displayBalance = balanceData 
    ? Number(balanceData.formatted) < 0.01 
      ? Number(balanceData.formatted).toLocaleString('en-US', { maximumFractionDigits: 8 })
      : Number(balanceData.formatted).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })
    : '0.00';

  return (
    <button
      onClick={onSelect}
      className={`w-full flex items-center justify-between ${isNotebook ? 'p-2 rounded-xl' : 'p-3 rounded-2xl'} transition-all duration-200 hover:bg-dark-bg/80 group ${isSelected ? 'bg-blue-500/10 border border-blue-500/20' : 'border border-transparent'}`}
    >
      <div className={`flex items-center ${isNotebook ? 'gap-2.5' : 'gap-3'}`}>
        <TokenIcon token={token} size={isNotebook ? 'sm' : 'md'} />
        <div className="flex flex-col items-start">
          <div className="flex items-center gap-1.5">
            <span className={`font-bold text-white ${isNotebook ? 'text-sm' : 'text-base'} tracking-wide`}>{token.symbol}</span>
            {token.comingSoon ? (
              <span className={`text-[10px] ${isNotebook ? 'px-1.5 py-0' : 'px-2 py-0.5'} bg-amber-500/15 border border-amber-500/30 text-amber-300 rounded-full font-semibold`}>
                Coming Soon
              </span>
            ) : token.noSwap ? (
              <span className={`text-[10px] ${isNotebook ? 'px-1.5 py-0' : 'px-1.5 py-0.5'} bg-yellow-500/20 text-yellow-400 rounded-full font-medium`}>
                Balance only
              </span>
            ) : null}
          </div>
          <span className={`${isNotebook ? 'text-[10px]' : 'text-xs'} text-dark-muted font-medium`}>{token.name}</span>
        </div>
      </div>
      <div className="flex flex-col items-end">
        <span className={`font-semibold text-white ${isNotebook ? 'text-xs sm:text-sm' : 'text-base'}`}>{displayBalance}</span>
        <span className={`${isNotebook ? 'text-[10px]' : 'text-xs'} text-dark-muted font-medium`}>{isMainnet ? 'Arc Native' : 'Testnet Asset'}</span>
      </div>
    </button>
  );
}
