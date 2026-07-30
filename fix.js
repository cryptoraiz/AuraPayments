const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(function(file) {
    file = path.resolve(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) { 
      results = results.concat(walk(file));
    } else { 
      if (file.endsWith('.jsx') || file.endsWith('.js') || file.endsWith('.html')) {
        results.push(file);
      }
    }
  });
  return results;
}

const files = walk(path.join(__dirname, 'frontend'));

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;

  // 1. Arc Connect -> Aura Connect
  if (content.includes('Arc Connect')) {
    content = content.replace(/Arc Connect/g, 'Aura Connect');
    changed = true;
  }
  if (content.includes('Arc connect')) {
    content = content.replace(/Arc connect/g, 'Aura Connect');
    changed = true;
  }

  // 2. Remove white borders from Token icons
  if (content.includes('bg-white p-[1px]')) {
    content = content.replace(/bg-white p-\[1px\]/g, '');
    changed = true;
  }
  if (content.includes('bg-white overflow-hidden shrink-0 p-[1px]')) {
    content = content.replace(/bg-white overflow-hidden shrink-0 p-\[1px\]/g, 'overflow-hidden shrink-0');
    changed = true;
  }
  if (content.includes('bg-white object-contain')) {
    content = content.replace(/bg-white object-contain/g, 'object-contain');
    changed = true;
  }
  // Remove from SwapModal.jsx specifically (or any other place with bg-[#2C2C2E] then bg-white)
  // Actually, SwapModal doesn't have bg-white on the image in my previous check.

  // 3. Fix ArcAIPage.jsx
  if (file.endsWith('ArcAIPage.jsx')) {
    // 3a. Translate agent logs and texts
    content = content.replace(
      /Olá! Eu sou o seu Agente Autônomo alimentado pela Circle. Posso executar swaps cross-chain, pontes \(bridges\) ou gerar faturas B2B. Qual é a sua missão de hoje\?/g,
      "Hello! I am your Autonomous Agent powered by Circle. I can execute cross-chain swaps, bridges or generate B2B invoices. What is your mission today?"
    );
    content = content.replace(/Inicializando Circle Agent Stack.../g, "Initializing Circle Agent Stack...");
    content = content.replace(/Conectado à Arc Testnet./g, "Connected to Arc Testnet.");
    content = content.replace(/Monitorando pools de liquidez USDC.../g, "Monitoring USDC liquidity pools...");
    content = content.replace(/Recebeu:/g, "Received:");
    content = content.replace(/Processando NLP \(Intenção e Entidades\).../g, "Processing NLP (Intent and Entities)...");
    content = content.replace(/Estado alterado para/g, "State changed to");
    content = content.replace(/Não entendi bem. Sou um agente focado em DeFi. Você gostaria que eu realizasse um Swap, uma Bridge ou gerasse uma Fatura\?/g, "I didn't quite catch that. I am a DeFi focused agent. Would you like me to perform a Swap, a Bridge or generate an Invoice?");
    content = content.replace(/Perfeito, já mapeei a melhor rota nas pools. Qual o valor que você deseja trocar\?/g, "Perfect, I've mapped the best route in the pools. What amount do you want to swap?");
    content = content.replace(/Atualmente só consigo trocar USDC por EURC na Arc Testnet. Por favor, confirme esse par./g, "Currently I can only swap USDC for EURC on Arc Testnet. Please confirm this pair.");
    content = content.replace(/Tudo certo! Assinando transação com a Agent Wallet e executando o Swap na blockchain... 🔄 Pronto! Swap realizado com sucesso./g, "All set! Signing transaction with Agent Wallet and executing Swap on the blockchain... 🔄 Done! Swap completed successfully.");
    content = content.replace(/Assinando Payload de Swap.../g, "Signing Swap Payload...");
    content = content.replace(/Transação confirmada na Arc Testnet./g, "Transaction confirmed on Arc Testnet.");
    content = content.replace(/Rede confirmada. Iniciando a queima \(burn\) de USDC na Arc e o mint na rede de destino via Circle CCTP... 🚀 Sucesso! Seus fundos chegaram ao destino./g, "Network confirmed. Initiating USDC burn on Arc and mint on destination network via Circle CCTP... 🚀 Success! Your funds have reached their destination.");
    content = content.replace(/Transferência Cross-Chain executada via CCTP/g, "Cross-Chain transfer executed via CCTP");
    content = content.replace(/Suporto apenas pontes para Base ou Arbitrum. Para qual delas\?/g, "I only support bridges to Base or Arbitrum. To which one?");
    content = content.replace(/Fatura gerada e criptografada com sucesso! 🧾 O link de pagamento B2B é:/g, "Invoice successfully generated and encrypted! 🧾 The B2B payment link is:");
    content = content.replace(/Smart Contract de Escrow criado./g, "Escrow Smart Contract created.");
    content = content.replace(/Fatura armazenada na blockchain./g, "Invoice stored on the blockchain.");
    
    // Fix Suggested Prompts
    content = content.replace(/"Vamos fazer um Swap\?",/g, '"I want to swap",');
    content = content.replace(/"Quero fazer uma Bridge",/g, '"I want to make a bridge",');
    content = content.replace(/"Preciso criar uma Fatura"/g, '"I need to create an invoice"');

    // 3b. Agent Wallet dynamic address
    if (!content.includes('useAccount')) {
      content = content.replace(/import { useState, useRef, useEffect } from 'react';/, "import { useState, useRef, useEffect } from 'react';\nimport { useAccount } from 'wagmi';");
      content = content.replace(/export default function ArcAIPage\(\) {/, "export default function ArcAIPage() {\n  const { address } = useAccount();");
    }
    
    content = content.replace(/0xAgent\.\.\.9A/g, "{address ? `${address.slice(0,6)}...${address.slice(-4)}` : 'Not Connected'}");
    changed = true;
  }

  // 4. Fix ProfilePage.jsx (Remove Fake Items)
  if (file.endsWith('ProfilePage.jsx')) {
    // Empty the arrays
    content = content.replace(/const totalBalance = "[^"]+";/, 'const totalBalance = "$0.00";');
    
    // Let's replace the assets array content completely. We match from `const assets = [` to `];`
    const assetsMatch = content.match(/const assets = \[\s*([\s\S]*?)\s*\];/);
    if (assetsMatch) {
      content = content.replace(assetsMatch[0], 'const assets = [];');
    }
    
    const activitiesMatch = content.match(/const activities = \[\s*([\s\S]*?)\s*\];/);
    if (activitiesMatch) {
      content = content.replace(activitiesMatch[0], 'const activities = [];');
    }
    
    // Hide the list if empty
    content = content.replace(/\{paginatedAssets.map\(\(asset, idx\) => \(/g, '{paginatedAssets.length === 0 ? <div className="p-6 text-center text-dark-muted">No assets found</div> : paginatedAssets.map((asset, idx) => (');
    content = content.replace(/\{paginatedActivities.map\(\(act, idx\) => \(/g, '{paginatedActivities.length === 0 ? <div className="p-6 text-center text-dark-muted">No activities found</div> : paginatedActivities.map((act, idx) => (');

    changed = true;
  }

  if (changed) {
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Updated ${file}`);
  }
}
