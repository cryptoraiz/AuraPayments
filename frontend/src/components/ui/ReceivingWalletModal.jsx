import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function ReceivingWalletModal({ isOpen, onClose, onSave, initialAddress = '' }) {
  const [address, setAddress] = useState(initialAddress);
  const [error, setError] = useState('');
  const [recentAddresses, setRecentAddresses] = useState([]);

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

  return (
    <AnimatePresence>
      {isOpen && (
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
              <h3 className="text-xl font-bold text-white">Receiving Wallet</h3>
              <button onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-dark-bg text-dark-muted hover:text-white hover:bg-dark-border transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              <p className="text-sm text-dark-muted mb-4">
                Enter the destination address where you want to receive the assets on the target network. Leave blank to send to your connected wallet.
              </p>
              
              <div className="relative">
                <input
                  type="text"
                  placeholder="0x..."
                  value={address}
                  onChange={(e) => { setAddress(e.target.value); setError(''); }}
                  autoFocus
                  className="w-full bg-dark-bg border border-dark-border rounded-xl py-4 px-4 text-white placeholder-dark-muted focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
              
              {error && <p className="text-red-400 text-xs mt-2">{error}</p>}

              {recentAddresses.length > 0 && (
                <div className="mt-4 flex flex-col gap-2">
                  <span className="text-xs font-semibold text-dark-muted uppercase tracking-wider">Recent Addresses</span>
                  <div className="flex flex-col gap-2">
                    {recentAddresses.map((addr) => (
                      <button 
                        key={addr} 
                        onClick={() => { setAddress(addr); setError(''); }}
                        className="flex items-center gap-3 px-3 py-2.5 bg-dark-bg/60 border border-dark-border/60 hover:border-blue-500/50 hover:bg-dark-border/50 rounded-xl transition-all text-left text-xs text-white group"
                      >
                        <div className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0 group-hover:bg-blue-500 transition-colors">
                          <svg className="w-3 h-3 text-blue-400 group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                        </div>
                        <span className="truncate flex-1 tracking-wide">{addr}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="mt-8 flex gap-3">
                <button 
                  onClick={() => { setAddress(''); onSave(''); onClose(); }}
                  className="flex-1 py-3 px-4 rounded-xl font-bold text-white bg-dark-bg border border-dark-border hover:bg-dark-border transition-colors"
                >
                  Clear
                </button>
                <button 
                  onClick={handleSave}
                  className="flex-[2] py-3 px-4 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-500 shadow-[0_0_15px_rgba(37,99,235,0.3)] hover:shadow-[0_0_20px_rgba(37,99,235,0.5)] transition-all"
                >
                  Save Address
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
