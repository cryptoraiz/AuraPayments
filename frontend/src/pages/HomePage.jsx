import { useState, useEffect } from 'react';
import DeFiWidget from '../components/ui/DeFiWidget';

export default function HomePage() {
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
    <section className={`relative flex-1 flex flex-col overflow-hidden min-h-0 w-full bg-dark-bg ${
      isNotebook ? '' : 'items-center justify-center p-2 sm:p-4'
    }`}>
      {/* Background Depth Effects */}
      <div className="ambient-glow"></div>
      <div className="absolute bottom-0 right-0 w-[50vw] h-[50vw] bg-radial-gradient from-purple-500/5 to-transparent rounded-full blur-3xl pointer-events-none"></div>

      <div className={`w-full max-w-7xl mx-auto flex flex-col items-center relative z-20 overflow-y-auto min-h-0 ${
        isNotebook ? 'py-2 px-2 flex-1 justify-center' : 'px-2 sm:px-6 py-1'
      }`}>
        <div className="w-full flex justify-center items-center">
          <DeFiWidget />
        </div>
      </div>
    </section>
  );
}
