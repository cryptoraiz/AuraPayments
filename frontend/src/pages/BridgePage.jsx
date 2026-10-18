import DeFiWidget from '../components/ui/DeFiWidget';

export default function BridgePage() {
  return (
    <section className="flex-1 flex flex-col items-center justify-center overflow-hidden min-h-0 p-4">
      <div className="w-full max-w-7xl mx-auto flex flex-col items-center overflow-y-auto">
        <div className="text-center mb-2 sm:mb-4 lg:mb-6">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white mb-1">Cross-Chain Bridge</h1>
          <p className="text-dark-muted text-xs sm:text-sm">Move assets seamlessly between networks using Circle's CCTP.</p>
        </div>
        <DeFiWidget defaultTab="bridge" />
      </div>
    </section>
  );
}
