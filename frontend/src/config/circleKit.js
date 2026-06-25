import { AppKit } from '@circle-fin/app-kit'
import { createViemAdapterFromProvider } from '@circle-fin/adapter-viem-v2'

// Singleton do AppKit (sem kitKey — send não precisa, só swap)
let _appKit = null

export function getAppKit() {
  if (!_appKit) {
    _appKit = new AppKit()
  }
  return _appKit
}

/**
 * Cria o adapter a partir do window.ethereum (MetaMask, Rabby, etc.)
 * IMPORTANTE: createViemAdapterFromProvider é ASYNC
 */
export async function createCircleAdapter() {
  const provider = window.ethereum
  if (!provider) {
    throw new Error('[CircleKit] Nenhuma carteira encontrada. Instale MetaMask ou Rabby.')
  }
  return await createViemAdapterFromProvider({ provider })
}
