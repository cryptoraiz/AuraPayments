# Arc Invoice Backend

Backend Node.js para Arc Invoice, utilizando PostgreSQL e Express.

## 🚀 Setup

### 1. Instalar dependências

```bash
cd backend
npm install
```

### 2. Configurar Banco de Dados (PostgreSQL)

1. Crie um banco de dados PostgreSQL local ou na nuvem (ex: Neon.tech, Supabase).
2. Execute o script de criação de tabelas (ver `GUIA_CRIAR_BANCO.md`).
3. Crie um arquivo `.env.local` na pasta backend:

```env
POSTGRES_URL=postgres://user:password@host:port/database
FAUCET_PRIVATE_KEY=sua_private_key_para_faucet
ARC_RPC_URL=https://testnet.arc.io
```

### 3. Rodar localmente

```bash
npm run dev
```

Vai rodar em `http://localhost:5000`

## 📋 API Endpoints

### POST `/api/invoices/create`
Criar um novo invoice

### GET `/api/invoices/[wallet]`
Buscar invoices para uma carteira

### POST `/api/invoices/update`
Atualizar status do invoice (Pago/Cancelado)

### POST `/api/faucet`
Solicitar tokens de teste

## 📦 Estrutura

```
backend/
├── api/
│   ├── invoices/      # Rotas de Invoice
│   └── faucet.js      # Rotas de Faucet
├── lib/
│   └── store.js       # PostgreSQL Connection & Logic
├── server.js          # Express Server Entrypoint
└── package.json
```
