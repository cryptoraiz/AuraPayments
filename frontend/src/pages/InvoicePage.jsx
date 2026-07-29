import { useState } from 'react';
import PaymentForm from '../components/forms/PaymentForm';
import InvoiceHistory from '../components/ui/InvoiceHistory';

export default function InvoicePage() {
  const [activeTab, setActiveTab] = useState('create'); // 'create' | 'history'
  const [pendingCount, setPendingCount] = useState(0);

  return (
    <section className="flex-1 flex flex-col items-center justify-start pt-4 pb-0 w-full">
      <div className="w-full max-w-4xl mx-auto px-6 flex flex-col items-center">
        <div className="text-center mb-2">
          <h1 className="text-3xl font-bold text-white mb-0">Invoice 2.0</h1>
          <p className="text-dark-muted">Create professional crypto payment links instantly.</p>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 bg-dark-input p-1 rounded-2xl border border-dark-border/50 w-full max-w-sm mb-2">
          <button
            onClick={() => setActiveTab('create')}
            className={`flex-1 py-2 text-sm font-bold rounded-xl transition-all duration-300 ${
              activeTab === 'create' 
                ? 'text-white bg-dark-card shadow-lg ring-1 ring-white/10' 
                : 'text-dark-muted hover:text-gray-300'
            }`}
          >
            Create Invoice
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-bold rounded-xl transition-all duration-300 ${
              activeTab === 'history' 
                ? 'text-white bg-dark-card shadow-lg ring-1 ring-white/10' 
                : 'text-dark-muted hover:text-gray-300'
            }`}
          >
            History & Pending
            {pendingCount > 0 && (
              <span className="w-5 h-5 bg-yellow-500 text-black text-[10px] font-black flex items-center justify-center rounded-full shadow-[0_0_15px_rgba(234,179,8,0.4)] animate-[pulse_2s_ease-in-out_infinite]">
                {pendingCount}
              </span>
            )}
          </button>
        </div>
        
        <div className="flex w-full flex-col items-center min-h-[550px]">
          {/* Both panels stay mounted — CSS visibility swap eliminates re-mount jank */}
          <div
            className="w-full flex justify-center transition-opacity duration-200"
            style={{ display: activeTab === 'create' ? 'flex' : 'none' }}
          >
            <div className="w-full max-w-[540px] relative min-h-[540px] h-auto flex flex-col">
              <div className="flex-1 w-full">
                <PaymentForm theme="modern" />
              </div>
            </div>
          </div>

          <div
            className="w-full flex flex-col h-auto pt-0 transition-opacity duration-200"
            style={{ display: activeTab === 'history' ? 'flex' : 'none' }}
          >
            <InvoiceHistory onUpdateStats={(stats) => setPendingCount(stats.pendingCount)} />
          </div>
        </div>

      </div>
    </section>
  );
}
