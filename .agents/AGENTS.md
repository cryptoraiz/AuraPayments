# AGENTS.md — arcpay (arcpay-react / arcpay-appkit)

> Global rules (GEMINI.md) already cover generic protocols (investigation autonomy, surgical file editing,
> modularization, external-brain usage). Do NOT duplicate them here — only project-specific info goes below.
> Account/login info lives in `.agents/PROJECT_CONFIG.md`, not here.

---

## 1. Project Overview
- **What it does:** AuraPay — sistema de invoices e pagamentos cripto Web3 na rede Arc Testnet. O usuário conecta a wallet, cria payment links, recebe/envia USDC e EURC.
- **Tech stack:** React 18 + Vite + TailwindCSS + Framer Motion (frontend) / Supabase (database) / Vercel (hosting)
- **Site:** [www.aurapayments.xyz](https://www.aurapayments.xyz)
- **Status:** Em desenvolvimento (MVP funcional)

---

## 2. Quick Map (where things live)

| Feature / Area | File path | Notes |
|---|---|---|
| Página principal Invoice | `frontend/src/pages/InvoicePage.jsx` | Abas Create/History com CSS display swap (não AnimatePresence) |
| Histórico de transações | `frontend/src/components/ui/InvoiceHistory.jsx` | Polling 5s, filtros, paginação, overlay de settings |
| Formulário de invoice | `frontend/src/components/forms/PaymentForm.jsx` | Cria payment links, salva local + Supabase |
| Dropdown de moeda | `frontend/src/components/ui/CurrencySelect.jsx` | USDC / EURC, whitespace-nowrap corrigido |
| Swap & Bridge (Synthra) | `frontend/src/components/ui/DeFiWidget.jsx` | ver seção 5 |
| Página de pagamento | `frontend/src/pages/PayPage.jsx` | Link público com timer, approve ERC20, status polling |
| Chat de IA | `frontend/src/pages/ArcAIPage.jsx` | Bloqueado sem wallet conectada |
| Tokens suportados | `frontend/src/config/tokens.js` | USDC, EURC, USDT, cirBTC |
| Synthra API Key | `frontend/.env.local` → `VITE_SYNTHRA_API_KEY` | nunca no código |
| Invoices backend | `frontend/src/services/invoiceService.js` | CRUD via Supabase |
| LocalStorage util | `frontend/src/utils/localStorage.js` | CRUD local + blacklist de deletados |
| Notificações hook | `frontend/src/hooks/useInvoiceNotifications.js` | Polling 10s de invoices pendentes |

---

## 3. Business Rules / Known Issues

- **Deploy é manual, não automático:** a integração do GitHub com a Vercel está bloqueada neste projeto. Por isso, o deploy é feito rodando `npx vercel --prod --yes` diretamente na pasta raiz — não é pra esperar o usuário rodar manualmente.
- Antes de qualquer deploy, seguir o Protocolo de Contas do GEMINI.md (checar `PROJECT_CONFIG.md` + `npx vercel whoami`).
- **Conta ativa de deploy:** `launchpad.2024@gmail.com` (Vercel arcpay-appkit)
- **Ghost Transaction Prevention:** se o usuário criou E pagou o mesmo link, aparece apenas em "Sent", não duplica em "Received".
- **Blacklist local:** IDs deletados pelo usuário vão para um array no localStorage; o fetch do backend filtra essa lista para não ressuscitar transações deletadas.
- **Expiração de invoice:** 24h desde o `createdAt` (calculado no frontend por timestamp).
- **Abas Create ↔ History:** ambas as abas ficam **sempre montadas em memória** (CSS `display: none/flex`). Não usar AnimatePresence/re-mount aqui — causa solavanco de reload.

---

## 4. Architecture Decisions

- **2026-07-26** — Engrenagem de configurações separada das abas de filtro. Abre overlay (backdrop-blur) sobre o histórico, não dropdown. Evita quebra de layout em telas menores.
- **2026-07-27** — CurrencySelect usa `whitespace-nowrap` + padding assimétrico (`pl-X pr-10`) para texto não encostar na seta.
- **2026-07-28** — InvoicePage usa CSS `display` swap em vez de AnimatePresence para não re-montar InvoiceHistory a cada troca de aba.
- **2026-07-29** — USDC é moeda nativa do Arc (precompile `0x3600...`). No Portfolio/Swap/Bridge, `useBalance` sem `token` para USDC nativo; evita `balanceOf` duplo. Polling reduzido de 3s→10s (swap/bridge) e 10s→15s (portfolio) para evitar 429 Too Many Requests.

---

## 5. Integração Synthra (Swap & Bridge)
- **API Base:** `https://trading-api.synthra.org`
- **API Key:** salva em `frontend/.env.local` como `VITE_SYNTHRA_API_KEY`
- **Chain ID Arc Testnet:** `5042002`
- **Approval Mode:** `erc20` (Arc usa erc20, NÃO permit2)
- **Tokens:**
  - USDC: `0x3600000000000000000000000000000000000000` (6 dec, precompile Arc)
  - EURC: `0x89b50855aa3be2f677cd6303cec089b5f319d72a` (6 dec)
  - USDT: `0x175cdb1d338945f0d851a741ccf787d343e57952` (18 dec)
  - cirBTC: `0xf0c4a4ce82a5746abaad9425360ab04fbba432bf` (8 dec)
- **Fluxo:** POST /v1/quote → POST /v1/swap → approve ERC20 → eth_sendTransaction
- **Gas:** `arcGasHeadroom()` duplica estimativa com floor 4M (necessário pelo precompile USDC)

---

## 6. Variáveis de Ambiente (obrigatórias no deploy)
```
VITE_SYNTHRA_API_KEY=...
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

---

## 7. Referências e Links Úteis
- [CCTP Transfer USDC from Ethereum to Arc](https://developers.circle.com/cctp/quickstarts/transfer-usdc-ethereum-to-arc)
- [CCTP Supported Chains and Domains](https://developers.circle.com/cctp/concepts/supported-chains-and-domains)
- [Circle Unified Balance Kit (NPM)](https://www.npmjs.com/package/@circle-fin/unified-balance-kit)
- [Circle Assets](https://developers.circle.com/assets)
- [Circle Console Home](https://console.circle.com/home)
- [Circle Build Onchain](https://developers.circle.com/build-onchain)
- [Circle Wallets Overview](https://console.circle.com/wallets/overview)
- [Circle Wallets Modular Configurator](https://console.circle.com/wallets/modular/configurator)
- [Circle Wallets User Configurator](https://console.circle.com/wallets/user/configurator)
- [Circle Agents Services](https://agents.circle.com/services)
- [Arc App Kit Docs](https://docs.arc.io/app-kit)
- [Arc App Kit Bridge](https://docs.arc.io/app-kit/bridge)
- [Arc App Kit Bridge Tokens Across Blockchains](https://docs.arc.io/app-kit/quickstarts/bridge-tokens-across-blockchains)
- [Synthra Developers](https://developers.synthra.org/)
- [Synthra Docs](https://docs.synthra.org/)
- [Synthra API Reference](https://docs.synthra.org/reference)