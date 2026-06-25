import DeFiWidget from '../components/ui/DeFiWidget';

export default function SwapPage() {
  return (
    <section className="flex-1 flex flex-col items-center justify-center py-10 w-full">
      <div className="w-full max-w-7xl mx-auto px-6 flex flex-col items-center">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Instant Token Swap</h1>
          <p className="text-dark-muted">Trade tokens securely with zero slippage on the Arc Testnet.</p>
        </div>
        <DeFiWidget defaultTab="swap" />
      </div>
    </section>
  );
}
