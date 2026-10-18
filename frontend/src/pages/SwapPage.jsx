import DeFiWidget from '../components/ui/DeFiWidget';

export default function SwapPage() {
  return (
    <section className="flex-1 flex flex-col items-center justify-center overflow-hidden min-h-0 p-2 sm:p-4">
      <div className="w-full max-w-7xl mx-auto flex flex-col items-center overflow-y-auto min-h-0">
        <div className="text-center mb-1.5 sm:mb-3 lg:mb-4">
          <h1 className="text-lg sm:text-2xl lg:text-3xl font-bold text-white mb-0.5 sm:mb-1">Instant Token Swap</h1>
          <p className="text-dark-muted text-xs sm:text-sm">Trade tokens securely with zero slippage on Arc Network.</p>
        </div>
        <DeFiWidget defaultTab="swap" />
      </div>
    </section>
  );
}
