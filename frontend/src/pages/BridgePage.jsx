import DeFiWidget from '../components/ui/DeFiWidget';

export default function BridgePage() {
  return (
    <section className="flex-1 flex flex-col items-center justify-center overflow-hidden min-h-0 p-1.5 sm:p-3">
      <div className="w-full max-w-7xl mx-auto flex flex-col items-center overflow-y-auto min-h-0">
        <div className="text-center mb-1 sm:mb-2">
          <h1 className="text-base sm:text-xl lg:text-2xl font-bold text-white mb-0.5">Cross-Chain Bridge</h1>
          <p className="text-dark-muted text-[11px] sm:text-xs">Move assets seamlessly between networks using Circle's CCTP.</p>
        </div>
        <DeFiWidget defaultTab="bridge" />
      </div>
    </section>
  );
}
