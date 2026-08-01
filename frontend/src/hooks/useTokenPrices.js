import { useState, useEffect, useCallback, useRef } from 'react';

const PYTH_IDS = {
  USDC:   'eaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a', // USDC/USD
  WUSDC:  'eaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a', // USDC/USD
  USDT:   '2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b', // USDT/USD
  EURC:   'a995d00bb36a63cef7fd2c287dc105fc8f3d93779f062f09551b0af3e81ec30b', // EUR/USD
  cirBTC: 'e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43', // BTC/USD
};

/**
 * Returns { prices: { USDC: 1.00, USDT: 1.00, EURC: 1.12, cirBTC: 60000 }, loading, error }
 * Caches for 30 seconds for Pyth Network to be responsive but not spammy.
 */
const cache = { data: null, ts: 0 };
const CACHE_TTL = 30_000; // 30 seconds

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
      // Build Hermes API request (e.g. ?ids[]=id1&ids[]=id2)
      const uniqueIds = [...new Set(Object.values(PYTH_IDS))];
      const params = uniqueIds.map(id => `ids[]=${id}`).join('&');
      const url = `https://hermes.pyth.network/v2/updates/price/latest?${params}`;
      
      const res  = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(`Pyth Network ${res.status}`);
      const data = await res.json();

      // Map Pyth ID → price in USD
      const pythPrices = {};
      if (data && data.parsed) {
        data.parsed.forEach(feed => {
          // Pyth prices are represented as an integer (price) and an exponent (expo)
          const price = Number(feed.price.price);
          const expo = Number(feed.price.expo);
          pythPrices[feed.id] = price * Math.pow(10, expo);
        });
      }

      // Map symbol → Pyth price
      const mapped = {};
      for (const [symbol, pythId] of Object.entries(PYTH_IDS)) {
        mapped[symbol] = pythPrices[pythId] ?? null;
      }

      // Stablecoins fallback (always $1.00 or €1.12 estimate) if Pyth fails to return a specific ID
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
      console.warn('[useTokenPrices] Pyth Network error, using fallbacks:', err.message);
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
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
