import DeFiWidget from '../components/ui/DeFiWidget';

export default function SwapPage() {
  return (
    <section className="flex-1 flex flex-col items-center justify-center py-6 sm:py-8 md:py-10 pb-12 w-full">
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 flex flex-col items-center">
        <div className="text-center mb-6 md:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">Instant Token Swap</h1>
          <p className="text-dark-muted text-sm sm:text-base">Trade tokens securely with zero slippage on Arc Network.</p>
        </div>
        <DeFiWidget defaultTab="swap" />
      </div>
    </section>
  );
}
