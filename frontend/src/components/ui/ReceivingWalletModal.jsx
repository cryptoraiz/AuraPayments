import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

export default function ReceivingWalletModal({ isOpen, onClose, onSave, initialAddress = '' }) {
  const [address, setAddress] = useState(initialAddress);
  const [error, setError] = useState('');
  const [recentAddresses, setRecentAddresses] = useState([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setAddress(initialAddress);
      setError('');
      try {
        const saved = JSON.parse(localStorage.getItem('recent_bridge_addresses') || '[]');
        setRecentAddresses(saved);
      } catch (e) {
        setRecentAddresses([]);
      }
    }
  }, [isOpen, initialAddress]);

  const handleSave = () => {
    if (address && !/^0x[a-fA-F0-9]{40}$/i.test(address)) {
      setError('Please enter a valid EVM address (0x...)');
      return;
    }
    setError('');
    if (address) {
      try {
        let saved = JSON.parse(localStorage.getItem('recent_bridge_addresses') || '[]');
        saved = saved.filter(a => a.toLowerCase() !== address.toLowerCase());
        saved.unshift(address);
        saved = saved.slice(0, 3); // Keep top 3
        localStorage.setItem('recent_bridge_addresses', JSON.stringify(saved));
      } catch (e) {}
    }
    onSave(address);
    onClose();
  };

  if (!mounted || typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-md overflow-y-auto"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 15 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="bg-dark-card border border-dark-border rounded-2xl sm:rounded-3xl w-full max-w-md max-h-[90dvh] overflow-y-auto shadow-2xl flex flex-col my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-dark-border/50">
              <h3 className="text-lg sm:text-xl font-bold text-white">Receiving Wallet</h3>
              <button onClick={onClose}
                className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-full bg-dark-bg text-dark-muted hover:text-white hover:bg-dark-border transition-colors">
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="p-4 sm:p-6">
              <p className="text-xs sm:text-sm text-dark-muted mb-4">
                Enter the destination address where you want to receive the assets on the target network. Leave blank to send to your connected wallet.
              </p>
              
              <div className="relative">
                <input
                  type="text"
                  placeholder="0x..."
                  value={address}
                  onChange={(e) => { setAddress(e.target.value); setError(''); }}
                  className="w-full bg-dark-bg border border-dark-border rounded-xl py-2.5 sm:py-3 px-4 text-xs sm:text-sm text-white placeholder-dark-muted focus:outline-none focus:border-blue-500 font-mono transition-colors"
                />
                {address && (
                  <button 
                    onClick={() => setAddress('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-muted hover:text-white"
                  >
                    ✕
                  </button>
                )}
              </div>

              {error && (
                <div className="mt-2 text-xs text-red-400 font-medium">
                  {error}
                </div>
              )}

              {/* Recent Addresses */}
              {recentAddresses.length > 0 && (
                <div className="mt-6">
                  <div className="text-[11px] font-bold text-dark-muted uppercase tracking-wider mb-2">Recent Wallets</div>
                  <div className="flex flex-col gap-1.5">
                    {recentAddresses.map((addr) => (
                      <button
                        key={addr}
                        type="button"
                        onClick={() => { setAddress(addr); setError(''); }}
                        className="w-full flex items-center gap-2 p-2 rounded-xl bg-dark-bg/60 hover:bg-dark-border border border-dark-border/40 text-left text-xs font-mono text-dark-muted hover:text-white transition-all group"
                      >
                        <div className="w-5 h-5 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                          <svg className="w-3 h-3 text-blue-400 group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                        </div>
                        <span className="truncate flex-1 tracking-wide">{addr}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="mt-6 sm:mt-8 flex gap-3">
                <button 
                  onClick={() => { setAddress(''); onSave(''); onClose(); }}
                  className="flex-1 py-2.5 sm:py-3 px-4 rounded-xl font-bold text-xs sm:text-sm text-white bg-dark-bg border border-dark-border hover:bg-dark-border transition-colors"
                >
                  Clear
                </button>
                <button 
                  onClick={handleSave}
                  className="flex-[2] py-2.5 sm:py-3 px-4 rounded-xl font-bold text-xs sm:text-sm text-white bg-blue-600 hover:bg-blue-500 shadow-[0_0_15px_rgba(37,99,235,0.3)] hover:shadow-[0_0_20px_rgba(37,99,235,0.5)] transition-all"
                >
                  Save Address
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
