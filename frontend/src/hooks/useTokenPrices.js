import { useState, useEffect, useCallback, useRef } from 'react';

const COINGECKO_IDS = {
  USDC:   'usd-coin',
  WUSDC:  'usd-coin',
  USDT:   'tether',
  EURC:   'euro-coin',
  cirBTC: 'bitcoin',
};

/**
 * Returns { prices: { USDC: 1.00, USDT: 1.00, EURC: 1.12, cirBTC: 60000 }, loading, error }
 * Caches for 60 seconds to respect CoinGecko free-tier limits.
 */
const cache = { data: null, ts: 0 };
const CACHE_TTL = 60_000; // 60 seconds

export function useTokenPrices() {
  const [prices, setPrices] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);
  const mounted = useRef(true);

  const fetchPrices = useCallback(async () => {
    // Use cache if fresh
    if (cache.data && Date.now() - cache.ts < CACHE_TTL) {
      setPrices(cache.data);
      setLoading(false);
      return;
    }

    try {
      const ids = [...new Set(Object.values(COINGECKO_IDS))].join(',');
      const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`;
      const res  = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
      const data = await res.json();

      // Map symbol → price in USD
      const mapped = {};
      for (const [symbol, geckoId] of Object.entries(COINGECKO_IDS)) {
        mapped[symbol] = data[geckoId]?.usd ?? null;
      }

      // Stablecoins fallback (always $1.00 or €1.12 estimate)
      if (!mapped.USDC)   mapped.USDC  = 1.00;
      if (!mapped.WUSDC)  mapped.WUSDC = 1.00;
      if (!mapped.USDT)   mapped.USDT  = 1.00;

      cache.data = mapped;
      cache.ts   = Date.now();

      if (mounted.current) {
        setPrices(mapped);
        setLoading(false);
        setError(null);
      }
    } catch (err) {
      console.warn('[useTokenPrices] CoinGecko error, using fallbacks:', err.message);
      // Fallback: stablecoins = $1, BTC = null
      const fallback = { USDC: 1.00, WUSDC: 1.00, USDT: 1.00, EURC: null, cirBTC: null };
      if (mounted.current) {
        setPrices(fallback);
        setLoading(false);
        setError(err.message);
      }
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    fetchPrices();
    // Refresh every 60 seconds
    const interval = setInterval(fetchPrices, CACHE_TTL);
    return () => {
      mounted.current = false;
      clearInterval(interval);
    };
  }, [fetchPrices]);

  return { prices, loading, error };
}

/**
 * Convenience: returns the USD value string for a given symbol + balance.
 * e.g. formatUsdValue('USDC', '841.54', prices) → "$841.54"
 */
export function formatUsdValue(symbol, balance, prices) {
  if (!prices || !balance || isNaN(Number(balance))) return '--';
  const price = prices[symbol];
  if (price == null) return '--';
  const value = Number(balance) * price;
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
