import { useState, useEffect } from 'react';
import { useAccount, useChainId } from 'wagmi';
import { arcMainnet, arcTestnet } from '../config/wagmi';

export function useActiveArcChain() {
  const { chain, chainId: accountChainId } = useAccount();
  const wagmiChainId = useChainId();

  const [windowChainId, setWindowChainId] = useState(() => {
    if (typeof window !== 'undefined' && window.ethereum?.chainId) {
      try {
        const id = parseInt(window.ethereum.chainId, 16);
        return isNaN(id) ? null : id;
      } catch (_) {
        return null;
      }
    }
    return null;
  });

  useEffect(() => {
    if (typeof window !== 'undefined' && window.ethereum) {
      const handleChainChanged = (hexChainId) => {
        try {
          const parsed = typeof hexChainId === 'string' ? parseInt(hexChainId, 16) : hexChainId;
          if (!isNaN(parsed)) {
            setWindowChainId(parsed);
          }
        } catch (_) {}
      };
      window.ethereum.on?.('chainChanged', handleChainChanged);
      return () => {
        window.ethereum.removeListener?.('chainChanged', handleChainChanged);
      };
    }
  }, []);

  // Priority: window.ethereum real-time chain > account.chainId > chain.id > wagmiChainId > arcMainnet.id
  const rawChainId = Number(windowChainId || accountChainId || chain?.id || wagmiChainId || arcMainnet.id);
  const isTestnet = rawChainId === arcTestnet.id;
  const isMainnet = !isTestnet;
  const chainId = isTestnet ? arcTestnet.id : arcMainnet.id;
  const networkName = isTestnet ? 'Arc Testnet' : 'Arc Mainnet';
  const explorerUrl = isTestnet ? 'https://testnet.arcscan.app' : 'https://explorer.arc.io';
  const explorerName = isTestnet ? 'ArcScan' : 'Arc Explorer';

  return {
    chainId,
    rawChainId,
    isMainnet,
    isTestnet,
    networkName,
    explorerUrl,
    explorerName,
    setWindowChainId,
  };
}

export default useActiveArcChain;
