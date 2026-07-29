import { motion } from 'framer-motion';
import { useAccount } from 'wagmi';

export default function FaucetPage() {
  const { address, isConnected } = useAccount();

  return (
    <section className="flex-1 flex flex-col items-center justify-start pt-16 pb-6 w-full bg-dark-bg overflow-hidden relative">
      
      {/* Background Depth Effects */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="w-full max-w-3xl mx-auto px-6 relative z-10 flex flex-col items-center">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-black text-white mb-3 tracking-tight">Testnet Faucets</h1>
          <p className="text-dark-muted max-w-lg mx-auto">
            Get test tokens to experiment with Arc Connect. Acesse o faucet oficial da rede abaixo.
          </p>
          {isConnected && (
            <div className="mt-4 inline-flex items-center gap-2 bg-dark-card border border-dark-border px-4 py-2 rounded-full">
              <span className="text-xs text-dark-muted font-mono">Sua carteira:</span>
              <span className="text-xs font-bold text-white font-mono">{address?.slice(0, 6)}...{address?.slice(-4)}</span>
              <button
                onClick={() => navigator.clipboard.writeText(address)}
                title="Copiar endereço"
                className="text-dark-muted hover:text-white transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
            </div>
          )}
        </div>

        <div className="flex justify-center w-full">
          <div className="w-full max-w-md">
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
      </div>
    </section>
  );
}
