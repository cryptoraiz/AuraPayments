import { AppKit } from '@circle-fin/app-kit'
import { createViemAdapterFromProvider } from '@circle-fin/adapter-viem-v2'

// AppKit Singleton (without kitKey - send doesn't need it, only swap)
let _appKit = null

export function getAppKit() {
  if (!_appKit) {
    _appKit = new AppKit()
  }
  return _appKit
}

/**
 * Creates the adapter from window.ethereum (MetaMask, Rabby, etc.)
 * IMPORTANT: createViemAdapterFromProvider is ASYNC
 */
export async function createCircleAdapter() {
  const provider = window.ethereum
  if (!provider) {
    throw new Error('[CircleKit] No wallet found. Please install MetaMask or Rabby.')
  }
  return await createViemAdapterFromProvider({ provider })
}
