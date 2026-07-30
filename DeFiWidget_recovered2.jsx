Created At: 2026-07-19T11:19:43Z
Completed At: 2026-07-19T11:19:43Z
File Path: `file:///C:/ProjetosVS/PROJETO_WEB/arcpay-appkit/frontend/src/components/ui/DeFiWidget.jsx`
Total Lines: 508
Total Bytes: 29678
Showing lines 1 to 508
The following code has been modified to include a line number before every line, in the format: <line_number>: <original_line>. Please note that any changes targeting the original code should remove the line number, colon, and leading space.
1: import { useState } from 'react';
2: import { motion, AnimatePresence } from 'framer-motion';
3: import { useAccount, useBalance, useSendTransaction } from 'wagmi';
4: import { toast } from 'sonner';
5: import { getTokenBySymbol } from '../../config/tokens';
6: import TokenSelectorModal from './TokenSelectorModal';
7: 
8: export default function DeFiWidget({ defaultTab = 'swap' }) {
9:   const [activeTab, setActiveTab] = useState(defaultTab); // 'swap' or 'bridge'
10:   const [amount, setAmount] = useState('');
11:   const [txState, setTxState] = useState({ status: 'idle', hash: null });
12:   const [showHistory, setShowHistory] = useState(false);
13:   const [showSettings, setShowSettings] = useState(false);
14:   const [isNetworkModalOpen, setIsNetworkModalOpen] = useState(false);
15:   const [slippage, setSlippage] = useState('0.5');
16:   
17:   const BRIDGE_NETWORKS = [
18:     { name: 'Base', logo: 'https://avatars.githubusercontent.com/u/108554348?s=200&v=4' },
19:     { name: 'Ethereum', logo: 'https://cryptologos.cc/logos/ethereum-eth-logo.svg?v=024' },
20:     { name: 'Arbitrum', logo: 'https://cryptologos.cc/logos/arbitrum-arb-logo.svg?v=024' },
21:     { name: 'Optimism', logo: 'https://cryptologos.cc/logos/optimism-ethereum-op-logo.svg?v=024' },
22:     { name: 'Sonic Testnet', logo: 'https://cryptologos.cc/logos/fantom-ftm-logo.svg?v=024' }
23:   ];
24: 
25:   const [destNetwork, setDestNetwork] = useState(BRIDGE_NETWORKS[0]);
26:   const [bridgeStep, setBridgeStep] = useState(0);
27:   
28:   // Token State
29:   const [tokenIn, setTokenIn] = useState(getTokenBySymbol('USDC'));
30:   const [tokenOut, setTokenOut] = useState(getTokenBySymbol('EURC'));
31:   
32:   // Modal State
33:   const [isModalOpen, setIsModalOpen] = useState(false);
34:   const [modalSide, setModalSide] = useState('in'); // 'in' or 'out'
35:   
36:   // Wagmi State
37:   const { address } = useAccount();
38:   const { data: balanceData } = useBalance({
39:     address,
40:     token: tokenIn.isNative ? undefined : tokenIn.address,
41:     watch: true,
42:   });
43: 
44:   const formattedBalance = balanceData ? Number(balanceData.formatted) : 0;
45:   const inputAmount = Number(amount) || 0;
46:   const hasInsufficientBalance = inputAmount > formattedBalance;
47:   
48:   // Real Price calculation for Stables MVP
49:   const getPrice = (symbol) => symbol === 'EURC' ? 1.08 : 1.00;
50:   const priceIn = getPrice(tokenIn.symbol);
51:   const priceOut = getPrice(tokenOut.symbol);
52: 
53:   // Conversion rate calculation
54:   const conversionRate = priceIn / priceOut;
55:   const simulatedOutput = amount ? (inputAmount * conversionRate * 0.995).toFixed(4) : '';
56: 
57:   const usdValueIn = amount ? `$${(inputAmount * priceIn).toFixed(2)}` : '$0.00';
58:   const usdValueOut = simulatedOutput ? `$${(simulatedOutput * priceOut).toFixed(2)}` : '$0.00';
59: 
60:   const handleOpenModal = (side) => {
61:     setModalSide(side);
62:     setIsModalOpen(true);
63:   };
64: 
65:   const handleSelectToken = (token) => {
66:     if (modalSide === 'in') {
67:       if (activeTab === 'swap' && token.symbol === tokenOut.symbol) {
68:         setTokenOut(tokenIn);
69:       }
70:       setTokenIn(token);
71:     } else {
72:       if (activeTab === 'swap' && token.symbol === tokenIn.symbol) {
73:         setTokenIn(tokenOut);
74:       }
75:       setTokenOut(token);
76:     }
77:   };
78: 
79:   const handleSwitchTokens = () => {
80:     const temp = tokenIn;
81:     setTokenIn(tokenOut);
82:     setTokenOut(temp);
83:   };
84: 
85:   const { sendTransactionAsync } = useSendTransaction();
86: 
87:   const handleAction = async () => {
88:     try {
89:       if (activeTab === 'swap') {
90:         setTxState({ status: 'pending', hash: null });
91:         const txHash = await sendTransactionAsync({
92:           to: tokenIn.address,
93:           value: 0n,
94:         });
95:         setTxState({ status: 'success', hash: txHash });
96:       } else {
97:         // CCTP Bridge Simulation Flow
98:         setTxState({ status: 'pending', hash: null });
99:         setBridgeStep(1); // Approve
100:         
101:         // Wait for user signature
102:         const txHash = await sendTransactionAsync({
103:           to: tokenIn.address, // Envia para o endereço do token para simular uma interação com contrato
104:           value: 0n,
105:         });
106:         
107:         setBridgeStep(2); // Burning
108:         await new Promise(r => setTimeout(r, 2000));
109:         
110:         setBridgeStep(3); // Circle Attestation
111:         await new Promise(r => setTimeout(r, 3000));
112:         
113:         setBridgeStep(4); // Minting
114:         await new Promise(r => setTimeout(r, 2000));
115:         
116:         setBridgeStep(5); // Done
117:         setTxState({ status: 'success', hash: txHash });
118:       }
119:     } catch (error) {
120:       setTxState({ status: 'idle', hash: null });
121:       setBridgeStep(0);
122:       if (error.message?.toLowerCase().includes('reject')) {
123:         toast.error('Transaction rejected by user.', { style: { background: '#1a1f2e', color: '#f87171', border: '1px solid rgba(248,113,113,0.2)' } });
124:       } else {
125:         toast.error('Transaction failed.', { style: { background: '#1a1f2e', color: '#f87171', border: '1px solid rgba(248,113,113,0.2)' } });
126:         console.error(error);
127:       }
128:     }
129:   };
130: 
131:   return (
132:     <div className="w-full max-w-[480px] mx-auto">
133:       {/* Widget Container */}
134:       <div className="bg-dark-card border border-dark-border rounded-3xl p-4 shadow-2xl relative overflow-hidden min-h-[460px] flex flex-col">
135:         
136:         {/* Success / Progress Overlay */}
137:         {(txState.status === 'success' || (activeTab === 'bridge' && bridgeStep > 0)) && (
138:           <div className="absolute inset-0 z-50 bg-dark-card/95 backdrop-blur-md flex flex-col items-center justify-center p-6 animate-[fadeIn_0.3s_ease-out]">
139:             
140:             {/* CCTP Progress Tracker */}
141:             {activeTab === 'bridge' && bridgeStep < 5 && txState.status === 'pending' ? (
142:               <div className="w-full max-w-sm flex flex-col items-center">
143:                 <div className="w-16 h-16 rounded-full bg-blue-500/20 border-2 border-blue-500 border-t-transparent animate-spin mb-6"></div>
144:                 <h3 className="text-2xl font-black text-white mb-8 tracking-tight">CCTP Bridge</h3>
145:                 
146:                 <div className="w-full space-y-5">
147:                   {[
148:                     { step: 1, title: 'Approve USDC', desc: 'Confirming in wallet' },
149:                     { step: 2, title: 'Burn on Arc Testnet', desc: 'Sending transaction' },
150:                     { step: 3, title: 'Circle Attestation', desc: 'Waiting for Iris API' },
151:                     { step: 4, title: `Mint on ${destNetwork.name}`, desc: 'Releasing funds' }
152:                   ].map((s) => (
153:                     <div key={s.step} className="flex items-center gap-4">
154:                       <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-colors ${bridgeStep > s.step ? 'bg-green-500 text-white' : bridgeStep === s.step ? 'bg-blue-500 text-white animate-pulse' : 'bg-dark-input text-dark-muted'}`}>
155:                         {bridgeStep > s.step ? <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg> : s.step}
156:                       </div>
157:                       <div className="flex flex-col">
158:                         <span className={`text-sm font-bold ${bridgeStep >= s.step ? 'text-white' : 'text-dark-muted'}`}>{s.title}</span>
159:                         <span className={`text-[10px] uppercase tracking-wider ${bridgeStep === s.step ? 'text-blue-400' : 'text-dark-muted/50'}`}>{bridgeStep > s.step ? 'Completed' : s.desc}</span>
160:                       </div>
161:                     </div>
162:                   ))}
163:                 </div>
164:               </div>
165:             ) : (
166:               /* Success State */
167:               <>
168:                 <div className="w-24 h-24 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center mb-6 animate-[bounce_1s_infinite]">
169:                   <svg className="w-12 h-12 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
170:                 </div>
171:                 <h3 className="text-2xl font-black text-white mb-2 text-center tracking-tight">
172:                   {activeTab === 'bridge' ? 'Bridge Successful!' : 'Swap Confirmed!'}
173:                 </h3>
174:                 <p className="text-dark-muted text-center mb-8 font-medium">
175:                   {activeTab === 'bridge' 
176:                     ? `Your ${amount} ${tokenIn.symbol} arrived on ${destNetwork.name}.` 
177:                     : `Successfully swapped ${amount} ${tokenIn.symbol} to ${simulatedOutput} ${tokenOut.symbol}.`}
178:                 </p>
179:                 
180:                 <div className="w-full space-y-3">
181:                   <a 
182:                     href={`https://testnet.arcscan.app/tx/${txState.hash}`}
183:                     target="_blank" rel="noreferrer"
184:                     className="w-full py-4 rounded-xl font-bold text-white bg-dark-input border border-dark-border hover:border-blue-500/50 hover:bg-dark-border transition-all flex items-center justify-center gap-2"
185:                   >
186:                     View on Arc Explorer
187:                     <svg className="w-4 h-4 text-dark-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
188:                   </a>
189:                   
190:                   <button 
191:                     onClick={() => {
192:                       setTxState({ status: 'idle', hash: null });
193:                       setBridgeStep(0);
194:                       setAmount('');
195:                     }}
196:                     className="w-full py-4 rounded-xl font-bold text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 transition-all flex items-center justify-center"
197:                   >
198:                     Close
199:                   </button>
200:                 </div>
201:               </>
202:             )}
203:           </div>
204:         )}
205: 
206:         {/* History Overlay */}
207:         <AnimatePresence>
208:           {showHistory && (
209:             <motion.div 
210:               initial={{ opacity: 0, scale: 0.95 }}
211:               animate={{ opacity: 1, scale: 1 }}
212:               exit={{ opacity: 0, scale: 0.95 }}
213:               className="absolute inset-0 z-40 bg-dark-card/95 backdrop-blur-xl flex flex-col p-6 border-b border-dark-border/50"
214:             >
215:               <div className="flex justify-between items-center mb-6">
216:                 <h3 className="text-xl font-bold text-white flex items-center gap-2">
217:                   <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
218:                   Activity History
219:                 </h3>
220:                 <button onClick={() => setShowHistory(false)} className="text-dark-muted hover:text-white p-2 rounded-lg hover:bg-dark-input transition-colors">
221:                   <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
222:                 </button>
223:               </div>
224:               <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin scrollbar-thumb-dark-border flex flex-col items-center justify-center min-h-[200px]">
225:                 <svg className="w-12 h-12 text-dark-muted/30 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
226:                 <div className="text-sm font-bold text-dark-muted">No recent transactions</div>
227:               </div>
228:             </motion.div>
229:           )}
230:         </AnimatePresence>
231:         
232:         {/* Settings Overlay */}
233:         <AnimatePresence>
234:           {showSettings && (
235:             <motion.div 
236:               initial={{ opacity: 0, scale: 0.95 }}
237:               animate={{ opacity: 1, scale: 1 }}
238:               exit={{ opacity: 0, scale: 0.95 }}
239:               className="absolute inset-0 z-40 bg-dark-card/95 backdrop-blur-xl flex flex-col p-6 border-b border-dark-border/50"
240:             >
241:               <div className="flex justify-between items-center mb-8">
242:                 <h3 className="text-xl font-bold text-white flex items-center gap-2">
243:                   <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
244:                   Transaction Settings
245:                 </h3>
246:                 <button onClick={() => setShowSettings(false)} className="text-dark-muted hover:text-white p-2 rounded-lg hover:bg-dark-input transition-colors">
247:                   <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
248:                 </button>
249:               </div>
250:               
251:               <div className="space-y-8">
252:                 <div>
253:                   <div className="flex items-center gap-1 mb-4">
254:                     <span className="text-sm font-bold text-white">Slippage Tolerance</span>
255:                     <svg className="w-4 h-4 text-dark-muted cursor-help" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
256:                   </div>
257:                   <div className="flex gap-2">
258:                     {['0.1', '0.5', '1.0'].map(val => (
259:                       <button
260:                         key={val}
261:                         onClick={() => setSlippage(val)}
262:                         className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${slippage === val ? 'bg-blue-600 text-white shadow-lg' : 'bg-dark-input border border-dark-border text-dark-muted hover:border-blue-500/50 hover:text-white'}`}
263:                       >
264:                         {val}%
265:                       </button>
266:                     ))}
267:                     <div className="relative flex-[1.5]">
268:                       <input 
269:                         type="number" 
270:                         value={!['0.1', '0.5', '1.0'].includes(slippage) ? slippage : ''}
271:                         onChange={(e) => setSlippage(e.target.value)}
272:                         placeholder="Custom" 
273:                         className={`w-full py-3 px-4 pr-7 rounded-xl text-sm font-bold text-right outline-none transition-all ${!['0.1', '0.5', '1.0'].includes(slippage) && slippage ? 'bg-blue-600/10 border border-blue-500/30 text-blue-400 focus:border-blue-500' : 'bg-dark-input border border-dark-border text-white placeholder-dark-muted focus:border-blue-500/50'}`}
274:                       />
275:                       <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold ${!['0.1', '0.5', '1.0'].includes(slippage) && slippage ? 'text-blue-400' : 'text-dark-muted'}`}>%</span>
276:                     </div>
277:                   </div>
278:                 </div>
279: 
280:                 <div>
281:                   <div className="text-sm font-bold text-white mb-4">Transaction Deadline</div>
282:                   <div className="flex items-center gap-3">
283:                     <input type="number" defaultValue="20" className="w-24 py-3 px-4 bg-dark-input border border-dark-border rounded-xl text-sm text-white font-bold text-center outline-none focus:border-blue-500/50 transition-colors" />
284:                     <span className="text-sm font-bold text-dark-muted">minutes</span>
285:                   </div>
286:                 </div>
287:               </div>
288:             </motion.div>
289:           )}
290:         </AnimatePresence>
291: 
292:         {/* Network Selector Modal */}
293:         <AnimatePresence>
294:           {isNetworkModalOpen && (
295:             <motion.div 
296:               initial={{ opacity: 0, scale: 0.95 }}
297:               animate={{ opacity: 1, scale: 1 }}
298:               exit={{ opacity: 0, scale: 0.95 }}
299:               className="absolute inset-0 z-[60] bg-dark-card/95 backdrop-blur-xl flex flex-col p-6 border-b border-dark-border/50"
300:             >
301:               <div className="flex justify-between items-center mb-6">
302:                 <h3 className="text-xl font-bold text-white">Select Destination</h3>
303:                 <button onClick={() => setIsNetworkModalOpen(false)} className="text-dark-muted hover:text-white p-2 rounded-lg hover:bg-dark-input transition-colors">
304:                   <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
305:                 </button>
306:               </div>
307:               <div className="flex-1 overflow-y-auto space-y-2 pr-2 scrollbar-thin scrollbar-thumb-dark-border">
308:                 {BRIDGE_NETWORKS.map((net) => (
309:                   <button
310:                     key={net.name}
311:                     onClick={() => {
312:                       setDestNetwork(net);
313:                       setIsNetworkModalOpen(false);
314:                     }}
315:                     className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all ${destNetwork.name === net.name ? 'bg-blue-600/10 border-blue-500/50' : 'bg-dark-bg border-dark-border hover:border-blue-500/30'}`}
316:                   >
317:                     <div className="flex items-center gap-3">
318:                       <img src={net.logo} alt={net.name} className="w-8 h-8 rounded-full" />
319:                       <span className="text-sm font-bold text-white">{net.name}</span>
320:                     </div>
321:                     {destNetwork.name === net.name && (
322:                       <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
323:                     )}
324:                   </button>
325:                 ))}
326:               </div>
327:             </motion.div>
328:           )}
329:         </AnimatePresence>
330:         
331:         {/* Header Tabs - Segmented Control (Relay Style) */}
332:         <div className="flex items-center justify-between mb-8">
333:           <div className="flex bg-dark-input p-1 rounded-2xl border border-dark-border/50">
334:             <button
335:               onClick={() => setActiveTab('swap')}
336:               className={`relative px-6 py-2.5 text-sm font-bold rounded-xl transition-all duration-300 ${
337:                 activeTab === 'swap' 
338:                   ? 'text-white bg-dark-card shadow-lg shadow-black/20 ring-1 ring-white/10' 
339:                   : 'text-dark-muted hover:text-gray-300'
340:               }`}
341:             >
342:               Swap
343:             </button>
344:             <button
345:               onClick={() => setActiveTab('bridge')}
346:               className={`relative px-6 py-2.5 text-sm font-bold rounded-xl transition-all duration-300 ${
347:                 activeTab === 'bridge' 
348:                   ? 'text-white bg-dark-card shadow-lg shadow-black/20 ring-1 ring-white/10' 
349:                   : 'text-dark-muted hover:text-gray-300'
350:               }`}
351:             >
352:               Bridge
353:             </button>
354:           </div>
355:           
356:           {/* Action Icons (Settings, Refresh, History) */}
357:           <div className="flex items-center gap-3 text-dark-muted">
358:             <button onClick={() => setShowHistory(true)} className="hover:text-white transition-colors" title="Activity History">
359:               <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
360:                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
361:               </svg>
362:             </button>
363:             <button onClick={() => setShowSettings(true)} className="hover:text-white transition-colors" title="Settings">
364:               <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
365:                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
366:               </svg>
367:             </button>
368:           </div>
369:         </div>
370: 
371:         {/* Input FROM */}
372:         <div className={`bg-dark-bg/80 border rounded-2xl p-5 transition-all focus-within:shadow-[0_0_15px_rgba(39,117,202,0.1)] ${hasInsufficientBalance ? 'border-red-500/50 focus-within:border-red-500/80' : 'border-dark-border/60 hover:border-dark-border focus-within:border-blue-500/50'}`}>
373:           <div className="flex justify-between text-sm font-medium text-dark-muted mb-3">
374:             <span>{activeTab === 'swap' ? 'You pay' : 'Burn on Arc Testnet'}</span>
375:             <span 
376:               className="cursor-pointer hover:text-white transition-colors"
377:               onClick={() => setAmount(formattedBalance.toString())}
378:             >
379:               Balance: {formattedBalance.toFixed(4)}
380:             </span>
381:           </div>
382:           <div className="flex items-center justify-between gap-4">
383:             {/* Token Selector Pill */}
384:             <button onClick={() => handleOpenModal('in')} className="flex items-center gap-2 bg-dark-card border border-dark-border hover:bg-dark-border/80 hover:scale-105 transition-all rounded-full py-1.5 px-3 shadow-lg whitespace-nowrap">
385:               <div className="w-7 h-7 rounded-full bg-dark-bg flex items-center justify-center text-white shadow-inner overflow-hidden">
386:                 <img src={tokenIn.logo} alt={tokenIn.symbol} className="w-full h-full object-contain rounded-full" />
387:               </div>
388:               <span className="font-bold text-white text-lg tracking-wide">{tokenIn.symbol}</span>
389:               <svg className="w-5 h-5 text-dark-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
390:                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
391:               </svg>
392:             </button>
393:             
394:             {/* Large Number Input */}
395:             <input
396:               type="number"
397:               placeholder="0.0"
398:               value={amount}
399:               onChange={(e) => setAmount(e.target.value)}
400:               className={`w-full bg-transparent text-right text-4xl font-black placeholder-dark-border outline-none tracking-tight ${hasInsufficientBalance ? 'text-red-400' : 'text-white'}`}
401:             />
402:           </div>
403:           <div className="flex justify-end mt-2 text-sm text-dark-muted font-medium">
404:             {usdValueIn}
405:           </div>
406:         </div>
407: 
408:         {/* Switch Direction Button */}
409:         <div className="relative h-1 flex items-center justify-center z-10 my-2">
410:           <div onClick={handleSwitchTokens} className="absolute w-12 h-12 bg-dark-card border-[6px] border-dark-bg rounded-xl flex items-center justify-center text-dark-muted hover:text-white transition-all hover:bg-dark-border cursor-pointer shadow-lg hover:rotate-180 duration-500">
411:             <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
412:               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
413:             </svg>
414:           </div>
415:         </div>
416: 
417:         {/* Input TO */}
418:         <div className="bg-dark-bg/80 border border-dark-border/60 hover:border-dark-border rounded-2xl p-5 transition-all">
419:           <div className="text-sm font-medium text-dark-muted mb-3 flex items-center justify-between">
420:             <span>{activeTab === 'swap' ? 'You receive' : 'Mint on'}</span>
421:             {activeTab === 'bridge' && (
422:               <button onClick={() => setIsNetworkModalOpen(true)} className="flex items-center gap-1.5 bg-dark-input hover:bg-dark-border border border-dark-border/50 py-1 px-2.5 rounded-lg transition-all active:scale-95 shadow-sm">
423:                 <img src={destNetwork.logo} alt={destNetwork.name} className="w-4 h-4 rounded-full" />
424:                 <span className="text-white font-bold text-xs">{destNetwork.name}</span>
425:                 <svg className="w-3 h-3 text-dark-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
426:               </button>
427:             )}
428:           </div>
429:           <div className="flex items-center justify-between gap-4">
430:             {/* Token Selector Pill */}
431:             <button onClick={() => handleOpenModal('out')} className="flex items-center gap-2 bg-dark-card border border-dark-border hover:bg-dark-border/80 hover:scale-105 transition-all rounded-full py-1.5 px-3 shadow-lg whitespace-nowrap">
432:               <div className="w-7 h-7 rounded-full bg-dark-bg flex items-center justify-center text-white shadow-inner overflow-hidden">
433:                 <img src={tokenOut.logo} alt={tokenOut.symbol} className="w-full h-full object-contain rounded-full" />
434:               </div>
435:               <span className="font-bold text-white text-lg tracking-wide">{tokenOut.symbol}</span>
436:               <svg className="w-5 h-5 text-dark-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
437:                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
438:               </svg>
439:             </button>
440:             
441:             {/* Large Number Output */}
442:             <input
443:               type="number"
444:               placeholder="0.0"
445:               value={simulatedOutput}
446:               disabled
447:               className="w-full bg-transparent text-right text-4xl font-black text-white placeholder-dark-border outline-none cursor-not-allowed tracking-tight"
448:             />
449:           </div>
450:           <div className="flex justify-end mt-2 text-sm text-dark-muted font-medium">
451:             {usdValueOut}
452:           </div>
453:         </div>
454: 
455:         {/* Main Action Button */}
456:         {!address ? (
457:            <button 
458:              onClick={(e) => { e.preventDefault(); window.dispatchEvent(new Event('open-wallet-modal')); }}
459:              className="w-full mt-4 bg-blue-600/10 border border-blue-500/20 text-blue-400 hover:bg-blue-600/20 transition-all font-bold text-lg py-4 rounded-2xl active:scale-[0.98]"
460:            >
461:             Connect Wallet
462:            </button>
463:         ) : txState.status === 'pending' && activeTab === 'swap' ? (
464:           <button disabled className="w-full mt-4 bg-blue-600/50 text-white font-bold text-lg py-4 rounded-2xl cursor-not-allowed transition-all shadow-inner flex items-center justify-center gap-2">
465:             <svg className="animate-spin w-5 h-5 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
466:             Confirming in Wallet...
467:           </button>
468:         ) : hasInsufficientBalance ? (
469:           <button disabled className="w-full mt-4 bg-red-500/20 text-red-500 font-bold text-lg py-4 rounded-2xl cursor-not-allowed transition-all border border-red-500/30">
470:             Insufficient {tokenIn.symbol} balance
471:           </button>
472:         ) : !amount ? (
473:           <button disabled className="w-full mt-4 bg-dark-input text-dark-muted font-bold text-lg py-4 rounded-2xl cursor-not-allowed transition-all">
474:             Enter an amount
475:           </button>
476:         ) : (
477:           <button 
478:             onClick={handleAction}
479:             className="w-full mt-4 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold text-lg py-4 rounded-2xl transition-all shadow-[0_0_20px_rgba(39,117,202,0.3)] hover:shadow-[0_0_25px_rgba(39,117,202,0.5)] active:scale-[0.98]"
480:           >
481:             {activeTab === 'bridge' ? 'Bridge via CCTP' : `Approve ${tokenIn.symbol}`}
482:           </button>
483:         )}
484: 
485:         {/* Pro Features / Details */}
486:         {address && (
487:           <div className="mt-5 flex flex-col gap-2.5 text-xs font-medium px-4 py-3 bg-dark-bg/30 rounded-2xl border border-dark-border/40">
488:           <div className="flex items-center justify-between">
489:             <span onClick={() => setShowSettings(true)} className="text-dark-muted hover:text-white transition-colors cursor-pointer flex items-center gap-1 group">
490:               Slippage Tolerance
491:               <svg className="w-3 h-3 text-dark-muted group-hover:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13l-3 3m0 0l-3-3m3 3V8m0 13a9 9 0 110-18 9 9 0 010 18z" /></svg>
492:             </span>
493:             <span className="text-blue-400 font-bold">{slippage}%</span>
494:           </div>
495:         </div>
496:         )}
497:       </div>
498: 
499:       <TokenSelectorModal 
500:         isOpen={isModalOpen}
501:         onClose={() => setIsModalOpen(false)}
502:         onSelect={handleSelectToken}
503:         selectedToken={modalSide === 'in' ? tokenIn : tokenOut}
504:       />
505:     </div>
506:   );
507: }
508: 
The above content shows the entire, complete file contents of the requested file.
