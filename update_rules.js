const fs = require('fs');
const file = 'C:\\Users\\Danilo\\.gemini\\GEMINI.md';

const textToAppend = `\n\n**VESTÍGIOS DE IA:**
- O código deve ser 100% livre de marcadores que entreguem que foi gerado por IA (ex: travesões exagerados, comentários estilizados como \`// ───\`, assinaturas de IA, etc).

**Gatilho: "Vestigios de IA"**
Sempre que eu disser "Vestigios de IA" ou "Vestígios de IA", a IA DEVE realizar uma varredura completa (grep_search) em todos os arquivos relevantes do projeto em busca de traços, comentários estilizados, separadores exagerados, e removê-los completamente, garantindo um código limpo e com aspecto estritamente humano e profissional.
`;

fs.appendFileSync(file, textToAppend, 'utf8');
console.log('Regras globais atualizadas com sucesso!');
