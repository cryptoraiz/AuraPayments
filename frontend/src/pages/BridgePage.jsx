import { useState, useEffect } from 'react';
import DeFiWidget from '../components/ui/DeFiWidget';

export default function BridgePage() {
  const [isNotebook, setIsNotebook] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 1280 || (window.innerHeight < 700 && window.innerWidth < 1440);
  });

  useEffect(() => {
    const checkNotebook = () => {
      if (typeof window === 'undefined') return;
      setIsNotebook(window.innerWidth < 1280 || (window.innerHeight < 700 && window.innerWidth < 1440));
    };
    checkNotebook();
    window.addEventListener('resize', checkNotebook);
    return () => window.removeEventListener('resize', checkNotebook);
  }, []);

  return (
    <section className={`flex-1 flex flex-col ${
      isNotebook ? 'overflow-hidden min-h-0' : 'items-center justify-center p-1.5 sm:p-3'
    } w-full`}>
      <div className={`overflow-y-auto flex-1 min-h-0 flex flex-col items-center ${
        isNotebook ? 'justify-start pt-0.5 sm:pt-1 pb-1 sm:pb-1.5 px-2' : ''
      } w-full`}>
        <div className={`w-full max-w-7xl mx-auto flex flex-col items-center ${isNotebook ? 'flex-1 h-full min-h-0' : ''}`}>
          <div className={`text-center ${isNotebook ? 'mb-0.5 shrink-0' : 'mb-1 sm:mb-2'}`}>
            <h1 className={`${isNotebook ? 'text-sm sm:text-base mb-0' : 'text-base sm:text-xl lg:text-2xl font-bold mb-0.5'} text-white`}>Cross-Chain Bridge</h1>
            <p className={`text-dark-muted ${isNotebook ? 'text-[10px]' : 'text-[11px] sm:text-xs'}`}>Move assets seamlessly between networks using Circle's CCTP.</p>
          </div>
          <div className={`w-full flex justify-center items-center ${isNotebook ? 'flex-1 h-full min-h-0' : ''}`}>
            <DeFiWidget defaultTab="bridge" />
          </div>
        </div>
      </div>
    </section>
  );
}
