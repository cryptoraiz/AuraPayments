import { useState, useCallback, useEffect } from 'react';
import PaymentForm from '../components/forms/PaymentForm';
import InvoiceHistory from '../components/ui/InvoiceHistory';

export default function InvoicePage() {
  const [activeTab, setActiveTab] = useState('create'); // 'create' | 'history'
  const [pendingCount, setPendingCount] = useState(0);

  // Notebook detection - ONLY active on notebook screens, strictly false on desktop monitors
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

  const handleUpdateStats = useCallback((stats) => {
    setPendingCount(prev => prev === stats.pendingCount ? prev : stats.pendingCount);
  }, []);

  return (
    <section className={`flex-1 flex flex-col ${isNotebook ? 'overflow-hidden min-h-0' : 'items-center justify-start pt-4 pb-0'} w-full`}>
      <div className={`overflow-y-auto flex-1 min-h-0 flex flex-col items-center ${
        isNotebook ? 'justify-start pt-0.5 sm:pt-1 pb-1.5 px-2' : 'justify-start pt-2 sm:pt-4 pb-6 px-6'
      } w-full`}>
        <div className={`w-full ${
          isNotebook 
            ? (activeTab === 'create' ? 'max-w-md px-2 flex-1 h-full min-h-0' : 'max-w-2xl px-2 flex-1 h-full min-h-0') 
            : 'max-w-4xl px-6'
        } mx-auto flex flex-col items-center`}>
          <div className={`text-center ${isNotebook ? 'mb-0.5 shrink-0' : 'mb-2'}`}>
            <h1 className={`${isNotebook ? 'text-base sm:text-lg' : 'text-3xl'} font-bold text-white mb-0`}>Invoice 2.0</h1>
            <p className={`text-dark-muted ${isNotebook ? 'text-[10px]' : 'text-sm'}`}>Create professional crypto payment links instantly.</p>
          </div>

          {/* Tabs */}
          <div className={`flex items-center gap-1 bg-dark-input ${
            isNotebook ? 'p-0.5 max-w-[290px] mb-1.5 rounded-xl shrink-0' : 'p-1 max-w-sm mb-4 rounded-2xl'
          } border border-dark-border/50 w-full`}>
            <button
              onClick={() => setActiveTab('create')}
              className={`flex-1 ${isNotebook ? 'py-1 text-xs rounded-lg' : 'py-2 text-sm rounded-xl'} font-bold transition-all duration-300 ${
                activeTab === 'create' 
                  ? 'text-white bg-dark-card shadow-lg ring-1 ring-white/10' 
                  : 'text-dark-muted hover:text-gray-300'
              }`}
            >
              Create Invoice
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex-1 flex items-center justify-center gap-2 ${isNotebook ? 'py-1 text-xs rounded-lg' : 'py-2 text-sm rounded-xl'} font-bold transition-all duration-300 ${
                activeTab === 'history' 
                  ? 'text-white bg-dark-card shadow-lg ring-1 ring-white/10' 
                  : 'text-dark-muted hover:text-gray-300'
              }`}
            >
              History & Pending
              {pendingCount > 0 && (
                <span className={`${isNotebook ? 'w-4 h-4 text-[9px]' : 'w-5 h-5 text-[10px]'} bg-yellow-500 text-black font-black flex items-center justify-center rounded-full shadow-[0_0_15px_rgba(234,179,8,0.4)] animate-[pulse_2s_ease-in-out_infinite]`}>
                  {pendingCount}
                </span>
              )}
            </button>
          </div>
          
          <div className={`flex w-full flex-col items-center ${isNotebook ? 'flex-1 h-full min-h-0' : 'min-h-[550px]'}`}>
            {/* Create tab */}
            <div
              className={`w-full flex justify-center transition-opacity duration-200 ${isNotebook ? 'flex-1 h-full min-h-0' : ''}`}
              style={{ display: activeTab === 'create' ? 'flex' : 'none' }}
            >
              <div className={`w-full ${isNotebook ? 'max-w-[420px] flex-1 h-full min-h-0' : 'max-w-[540px] min-h-[540px] h-auto'} relative flex flex-col`}>
                <div className={`w-full ${isNotebook ? 'flex-1 h-full min-h-0 flex flex-col' : 'flex-1'}`}>
                  <PaymentForm theme="modern" isNotebook={isNotebook} />
                </div>
              </div>
            </div>

            {/* History tab */}
            <div
              className={`w-full flex justify-center transition-opacity duration-200 ${isNotebook ? 'flex-1 h-full min-h-0' : 'h-auto pt-0'}`}
              style={{ display: activeTab === 'history' ? 'flex' : 'none' }}
            >
              <div className={`w-full ${isNotebook ? 'max-w-2xl flex-1 h-full min-h-0 flex flex-col' : 'max-w-4xl'}`}>
                <InvoiceHistory onUpdateStats={handleUpdateStats} isNotebook={isNotebook} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
