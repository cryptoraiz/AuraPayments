import DeFiWidget from '../components/ui/DeFiWidget'



export default function HomePage() {
  return (
    <section className="relative flex-1 flex flex-col items-center justify-center w-full bg-dark-bg overflow-hidden">
      
      {/* Background Depth Effects */}
      <div className="ambient-glow"></div>
      <div className="absolute bottom-0 right-0 w-[50vw] h-[50vw] bg-radial-gradient from-purple-500/5 to-transparent rounded-full blur-3xl pointer-events-none"></div>



      <div className="w-full max-w-7xl mx-auto px-6 flex flex-col items-center relative z-20 mt-12 md:mt-0">
        
        {/* Central Widget */}
        <DeFiWidget />
        
      </div>
    </section>
  )
}
