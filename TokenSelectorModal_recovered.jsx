import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getAllTokens } from '../../config/tokens';
import { useAccount, useBalance } from 'wagmi';

export default function TokenSelectorModal({ isOpen, onClose, onSelect, selectedToken }) {
  const tokens = getAllTokens();
  const { address } = useAccount();

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
          className="bg-dark-card border border-dark-border rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-dark-border/50">
            <h3 className="text-xl font-bold text-white">Select Token</h3>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-dark-bg text-dark-muted hover:text-white hover:bg-dark-border transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Search */}
          <div className="p-4 border-b border-dark-border/50">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search name or paste address"
                className="w-full bg-dark-bg border border-dark-border rounded-xl py-3 pl-10 pr-4 text-white placeholder-dark-muted focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
          </div>

          {/* Token List */}
          <div className="overflow-y-auto max-h-[400px] p-2 hide-scrollbar">
            {tokens.map((token) => (
              <TokenRow 
                key={token.symbol} 
                token={token} 
                onSelect={() => {
                  onSelect(token);
                  onClose();
                }}
                isSelected={selectedToken?.symbol === token.symbol}
                userAddress={address}
              />
            ))}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function TokenRow({ token, onSelect, isSelected, userAddress }) {
  // Use Wagmi to fetch real balance if address is provided
  const { data: balanceData } = useBalance({
    address: userAddress,
    token: token.isNative ? undefined : token.address,
    watch: true,
  });

  const displayBalance = balanceData ? Number(balanceData.formatted).toFixed(4) : '0.0000';

  return (
    <button
      onClick={onSelect}
      className={`w-full flex items-center justify-between p-3 rounded-2xl transition-all duration-200 hover:bg-dark-bg group ${
        isSelected ? 'opacity-50 cursor-not-allowed' : ''
      }`}
      disabled={isSelected}
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-dark-bg flex items-center justify-center p-[2px] shadow-sm">
          <img src={token.logo} alt={token.symbol} className="w-full h-full object-contain rounded-full bg-white p-0.5" />
        </div>
        <div className="flex flex-col items-start">
          <span className="font-bold text-white text-base tracking-wide">{token.symbol}</span>
          <span className="text-xs text-dark-muted font-medium">{token.name}</span>
        </div>
      </div>
      <div className="flex flex-col items-end">
        <span className="font-semibold text-white">{displayBalance}</span>
        {/* Placeholder USD value for now, as it's a testnet */}
        <span className="text-xs text-dark-muted font-medium">Testnet Asset</span>
      </div>
    </button>
  );
}
