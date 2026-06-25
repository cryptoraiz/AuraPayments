import { useState } from 'react';
import { motion } from 'framer-motion';

export default function FaucetPage() {
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleClaim = () => {
    if (!address) return;
    setError('');

    // Mock 24h cooldown check via localStorage
    const lastClaim = localStorage.getItem(`faucet_claim_${address.toLowerCase()}`);
    if (lastClaim) {
      const timePassed = Date.now() - parseInt(lastClaim);
      const hours24 = 24 * 60 * 60 * 1000;
      if (timePassed < hours24) {
        const timeLeft = Math.ceil((hours24 - timePassed) / (60 * 60 * 1000));
        setError(`Limit reached. Please wait ${timeLeft} hours before claiming again.`);
        return;
      }
    }

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setSuccess(true);
      localStorage.setItem(`faucet_claim_${address.toLowerCase()}`, Date.now().toString());
      setTimeout(() => setSuccess(false), 3000);
      setAddress('');
    }, 1500);
  };

  return (
    <section className="flex-1 flex flex-col items-center justify-start pt-16 pb-6 w-full bg-dark-bg overflow-hidden relative">
      
      {/* Background Depth Effects */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="w-full max-w-5xl mx-auto px-6 relative z-10 flex flex-col items-center">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-black text-white mb-3 tracking-tight">Testnet Faucets</h1>
          <p className="text-dark-muted max-w-lg mx-auto">Get test tokens to experiment with Arc Connect. Choose our internal high-speed faucet or use the official Arc network faucet.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full">
          
          {/* Card 1: Internal ArcPay Faucet */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-dark-card border border-blue-500/30 rounded-3xl p-8 shadow-[0_0_40px_rgba(37,99,235,0.15)] relative overflow-hidden flex flex-col"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/20 rounded-full blur-3xl"></div>
            
            <div className="flex items-center gap-4 mb-6 relative z-10">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center shadow-lg">
                <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">Arc Connect Faucet</h2>
                <span className="text-xs font-bold text-blue-400 uppercase tracking-widest">Internal Liquidity</span>
              </div>
            </div>
            
            <p className="text-sm text-dark-muted mb-8 relative z-10">
              Directly request <strong className="text-white">100 USDC</strong> to your wallet for testing invoices and swaps on our platform. Limit of 1 request per 24 hours.
            </p>

            <div className="space-y-4 mt-auto relative z-10">
              <div>
                <label className="text-xs font-bold text-dark-muted uppercase tracking-wider mb-2 block">Wallet Address</label>
                <input 
                  type="text" 
                  value={address}
                  onChange={(e) => {
                    setAddress(e.target.value);
                    if (error) setError('');
                  }}
                  placeholder="0x..." 
                  className={`w-full bg-dark-bg border ${error ? 'border-red-500/50 focus:border-red-500' : 'border-dark-border focus:border-blue-500/50'} rounded-xl py-3 px-4 text-white placeholder-dark-border outline-none transition-all shadow-inner`}
                />
                {error && <p className="text-xs text-red-400 font-medium mt-2 flex items-center gap-1"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>{error}</p>}
              </div>
              
              <button 
                onClick={handleClaim}
                disabled={loading || !address}
                className={`w-full py-4 rounded-xl font-bold text-white transition-all shadow-lg flex items-center justify-center gap-2 ${
                  success ? 'bg-green-600' : loading ? 'bg-blue-600/50 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 hover:shadow-blue-500/25 active:scale-95'
                }`}
              >
                {loading ? (
                  <>
                    <svg className="animate-spin w-5 h-5 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    Processing...
                  </>
                ) : success ? (
                  <>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    Tokens Sent!
                  </>
                ) : (
                  'Claim Tokens'
                )}
              </button>
            </div>
          </motion.div>

          {/* Card 2: Official Arc Faucet */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-dark-card border border-dark-border rounded-3xl p-8 shadow-xl relative overflow-hidden flex flex-col group hover:border-purple-500/30 transition-colors"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl group-hover:bg-purple-500/20 transition-colors"></div>
            
            <div className="flex items-center gap-4 mb-6 relative z-10">
              <div className="w-14 h-14 rounded-2xl bg-dark-bg border border-dark-border flex items-center justify-center shadow-inner group-hover:border-purple-500/50 transition-colors">
                <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">Circle Official Faucet</h2>
                <span className="text-xs font-bold text-dark-muted uppercase tracking-widest group-hover:text-purple-400 transition-colors">External Network</span>
              </div>
            </div>
            
            <p className="text-sm text-dark-muted mb-8 relative z-10">
              Need base testnet tokens or USDC/EURC from the official source? Head over to the official Circle Foundation faucet to claim native tokens.
            </p>

            <div className="mt-auto relative z-10">
              <a 
                href="https://faucet.circle.com/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="w-full py-4 rounded-xl font-bold text-white bg-dark-input border border-dark-border hover:bg-dark-border transition-all flex items-center justify-center gap-2 group-hover:border-purple-500/50"
              >
                Go to Circle Faucet
                <svg className="w-4 h-4 text-dark-muted group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
              </a>
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  );
}
