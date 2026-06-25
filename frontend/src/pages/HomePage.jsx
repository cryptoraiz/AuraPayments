import DeFiWidget from '../components/ui/DeFiWidget'

const TickerSet = () => (
  <>
    <span className="text-dark-muted"><span className="text-white">USDC</span> <span className="mx-1">$1.00</span> <span className="text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded-md text-[11px]">+0.01%</span></span>
    <span className="text-dark-muted"><span className="text-white">EURC</span> <span className="mx-1">$1.08</span> <span className="text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded-md text-[11px]">-0.12%</span></span>
    <span className="text-dark-muted"><span className="text-white">ETH</span> <span className="mx-1">$3,450.20</span> <span className="text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded-md text-[11px]">+2.40%</span></span>
    <span className="text-dark-muted"><span className="text-white">BTC</span> <span className="mx-1">$68,200</span> <span className="text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded-md text-[11px]">+1.10%</span></span>
    <span className="text-dark-muted"><span className="text-white">cirBTC</span> <span className="mx-1">$68,250</span> <span className="text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded-md text-[11px]">+1.15%</span></span>
  </>
);

export default function HomePage() {
  return (
    <section className="relative flex-1 flex flex-col items-center justify-center w-full bg-dark-bg overflow-hidden">
      
      {/* Background Depth Effects */}
      <div className="ambient-glow"></div>
      <div className="absolute bottom-0 right-0 w-[50vw] h-[50vw] bg-radial-gradient from-purple-500/5 to-transparent rounded-full blur-3xl pointer-events-none"></div>

      {/* Ticker Tape - Full Width Top Bar */}
      <div className="absolute top-0 left-0 w-full border-b border-dark-border bg-dark-card/80 backdrop-blur-md z-10 hidden md:block">
        <div className="max-w-7xl mx-auto px-6 py-3.5 flex items-center justify-between">
          
          {/* Left: Title */}
          <div className="flex items-center gap-2 text-dark-muted text-[11px] font-black uppercase tracking-widest border-r border-dark-border/50 pr-6">
            <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
            Live Rates
          </div>
          
          {/* Middle: Prices Marquee */}
          <div className="flex flex-1 justify-center overflow-hidden">
            <div className="flex text-sm font-bold tracking-wide animate-marquee whitespace-nowrap min-w-max">
              {/* Metade 1 */}
              <div className="flex gap-10 pr-10">
                <TickerSet /><TickerSet /><TickerSet /><TickerSet />
              </div>
              
              {/* Metade 2 (Cópia exata matemática para o Translate -50%) */}
              <div className="flex gap-10 pr-10">
                <TickerSet /><TickerSet /><TickerSet /><TickerSet />
              </div>
            </div>
          </div>

          {/* Right section removed as requested */}

        </div>
      </div>

      <div className="w-full max-w-7xl mx-auto px-6 flex flex-col items-center relative z-20 mt-12 md:mt-0">
        
        {/* Central Widget */}
        <DeFiWidget />
        
      </div>
    </section>
  )
}
