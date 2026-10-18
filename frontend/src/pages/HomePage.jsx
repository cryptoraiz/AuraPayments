import DeFiWidget from '../components/ui/DeFiWidget'



export default function HomePage() {
  return (
    <section className="relative flex-1 flex flex-col items-center justify-center overflow-hidden min-h-0 p-4 w-full bg-dark-bg">
      
      {/* Background Depth Effects */}
      <div className="ambient-glow"></div>
      <div className="absolute bottom-0 right-0 w-[50vw] h-[50vw] bg-radial-gradient from-purple-500/5 to-transparent rounded-full blur-3xl pointer-events-none"></div>

      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 flex flex-col items-center relative z-20 overflow-y-auto min-h-0">
        
        {/* Central Widget */}
        <DeFiWidget />
        
      </div>
    </section>
  )
}
