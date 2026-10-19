import { useState, useEffect, useCallback } from 'react';
import { useAccount, useChainId } from 'wagmi';
import { arcMainnet, arcTestnet } from '../config/wagmi';
import { isTestnetChainId } from '../config/chains';

const STORAGE_KEY = 'aura_network_mode';
const EVENT_NAME = 'aura_network_mode_changed';

function getInitialMode() {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'mainnet' || saved === 'testnet') {
      return saved;
    }
    // Infer from wallet if connected
    if (window.ethereum?.chainId) {
      try {
        const id = parseInt(window.ethereum.chainId, 16);
        if (isTestnetChainId(id)) return 'testnet';
      } catch (_) {}
    }
  }
  return 'mainnet';
}

export function useActiveArcChain() {
  const { chain, chainId: accountChainId } = useAccount();
  const wagmiChainId = useChainId();

  const [mode, setModeState] = useState(getInitialMode);

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

  // Listen to cross-component mode change events
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleModeChange = (e) => {
      const nextMode = e.detail;
      if (nextMode === 'mainnet' || nextMode === 'testnet') {
        setModeState(nextMode);
      }
    };
    window.addEventListener(EVENT_NAME, handleModeChange);
    return () => window.removeEventListener(EVENT_NAME, handleModeChange);
  }, []);

  // Listen to provider chainChanged in real-time
  useEffect(() => {
    if (typeof window !== 'undefined' && window.ethereum) {
      const handleChainChanged = (hexChainId) => {
        try {
          const parsed = typeof hexChainId === 'string' ? parseInt(hexChainId, 16) : hexChainId;
          if (!isNaN(parsed)) {
            setWindowChainId(parsed);
            // If wallet explicitly switched to Arc Testnet or Arc Mainnet, update mode
            if (parsed === arcTestnet.id) {
              setNetworkMode('testnet');
            } else if (parsed === arcMainnet.id) {
              setNetworkMode('mainnet');
            }
          }
        } catch (_) {}
      };
      window.ethereum.on?.('chainChanged', handleChainChanged);
      return () => {
        window.ethereum.removeListener?.('chainChanged', handleChainChanged);
      };
    }
  }, []);

  const setNetworkMode = useCallback((nextMode) => {
    if (nextMode !== 'mainnet' && nextMode !== 'testnet') return;
    try {
      localStorage.setItem(STORAGE_KEY, nextMode);
    } catch (_) {}
    setModeState(nextMode);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: nextMode }));
    }
  }, []);

  const toggleNetworkMode = useCallback(() => {
    const next = mode === 'mainnet' ? 'testnet' : 'mainnet';
    setNetworkMode(next);
    return next;
  }, [mode, setNetworkMode]);

  const rawChainId = Number(windowChainId || accountChainId || chain?.id || wagmiChainId || (mode === 'mainnet' ? arcMainnet.id : arcTestnet.id));
  const isMainnet = mode === 'mainnet';
  const isTestnet = mode === 'testnet';
  const chainId = isMainnet ? arcMainnet.id : arcTestnet.id;
  const targetArcChain = isMainnet ? arcMainnet : arcTestnet;
  const networkName = isMainnet ? 'Arc Mainnet' : 'Arc Testnet';
  const explorerUrl = isMainnet ? 'https://explorer.arc.io' : 'https://testnet.arcscan.app';
  const explorerName = isMainnet ? 'Arc Explorer' : 'ArcScan';
  const isWalletOnArc = rawChainId === arcMainnet.id || rawChainId === arcTestnet.id;
  const isWalletAligned = isMainnet ? rawChainId === arcMainnet.id : rawChainId === arcTestnet.id;

  return {
    mode,
    chainId,
    targetArcChain,
    rawChainId,
    isMainnet,
    isTestnet,
    networkName,
    explorerUrl,
    explorerName,
    isWalletOnArc,
    isWalletAligned,
    setNetworkMode,
    toggleNetworkMode,
    setWindowChainId,
  };
}

export default useActiveArcChain;

