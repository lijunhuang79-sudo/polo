import React, { useRef, useEffect } from 'react';
import { PLCState, LogicConfig } from '../types';
import { Fan, ArrowUp, ArrowDown, Car, Box, Thermometer, Zap, Lightbulb, ToggleRight } from 'lucide-react';

interface SubPanelProps {
  plcState: PLCState;
}

// --- 1. PID Panel ---
const PidPanel: React.FC<SubPanelProps> = ({ plcState }) => {
    const historyRef = useRef<number[]>([]);
    const temp = plcState.physics['temp'] || 25.0;
    const isHeaterOn = plcState.outputs['Q0.0'];
    const setpoint = 60.0;
    const heightPercent = Math.min(100, (temp / 100) * 100);

    // Safe Hook usage inside this sub-component
    useEffect(() => {
        historyRef.current.push(temp);
        if (historyRef.current.length > 100) historyRef.current.shift();
    }, [temp]);

    const trendPoints = historyRef.current.map((val, i) => {
        const x = (i / 100) * 100;
        const y = 100 - Math.min(100, Math.max(0, val));
        return `${x},${y}`;
    }).join(' ');

    return (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
           <h2 className="text-xl font-bold text-blue-600 mb-4 flex items-center gap-2"><span>5️⃣</span> PID 恒温控制 </h2>
           <div className="bg-slate-800 rounded-xl p-6 text-white h-72 flex gap-8 items-center relative overflow-hidden">
               {/* Trend Graph */}
               <div className="flex-1 h-full bg-slate-900/50 rounded border border-slate-700 relative overflow-hidden">
                    <div className="absolute top-2 right-2 text-xs text-slate-500">TEMP TREND</div>
                    <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                        <line x1="0" y1="40" x2="100" y2="40" stroke="#22c55e" strokeWidth="0.5" strokeDasharray="2" opacity="0.5" />
                        <polyline points={trendPoints} fill="none" stroke="#22d3ee" strokeWidth="1.5" />
                    </svg>
                    <div className="absolute right-0 top-[40%] text-[10px] text-green-500 bg-slate-900/80 px-1">SP: {setpoint}</div>
               </div>
               {/* Heater Unit */}
               <div className="flex flex-col items-center gap-2">
                   <div className={`w-24 h-32 border-4 border-slate-500 rounded-lg bg-slate-700 flex flex-col justify-end relative shadow-xl transition-colors duration-200 ${isHeaterOn ? 'border-red-400' : 'border-slate-500'}`}>
                       <div className="absolute inset-0 flex items-center justify-center opacity-20">
                           <Zap size={40} />
                       </div>
                       <div className={`w-full h-full transition-opacity duration-100 bg-red-500/60 blur-md absolute ${isHeaterOn ? 'opacity-100' : 'opacity-0'}`}></div>
                       <div className="w-full h-2 border-b-2 border-slate-400 mb-2 z-10 relative"></div>
                       <div className="w-full h-2 border-b-2 border-slate-400 mb-2 z-10 relative"></div>
                       <div className="w-full h-2 border-b-2 border-slate-400 mb-6 z-10 relative"></div>
                       <div className="absolute bottom-2 w-full text-center text-[10px] font-bold bg-black/50 py-1 z-10">HEATER</div>
                   </div>
                   <div className={`text-xs font-bold ${isHeaterOn ? 'text-red-400 animate-pulse' : 'text-slate-500'}`}>
                       {isHeaterOn ? "HEATING" : "OFF"}
                   </div>
               </div>
               {/* Thermometer */}
               <div className="flex flex-col items-center">
                   <div className="w-6 h-40 bg-slate-600 rounded-full border-4 border-slate-500 relative overflow-hidden">
                       <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-1 h-full bg-slate-700"></div>
                       <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-blue-500 via-purple-500 to-red-500 transition-all duration-300 ease-linear" style={{ height: `${heightPercent}%` }}></div>
                   </div>
                   <div className="w-10 h-10 bg-slate-500 rounded-full -mt-3 border-4 border-slate-600 z-10 flex items-center justify-center shadow-lg">
                       <Thermometer size={16} className="text-white" />
                   </div>
                   <div className="mt-2 text-xl font-mono text-cyan-400">{temp.toFixed(1)}°C</div>
               </div>
           </div>
        </div>
    );
};

// --- 2. Elevator Panel ---
const ElevatorPanel: React.FC<SubPanelProps> = ({ plcState }) => {
    const carPos = plcState.physics['carPos'] || 0;
    const doorPos = plcState.physics['doorPos'] || 0;
    let floor = 1;
    if (carPos > 66) floor = 3; else if (carPos > 33) floor = 2; else floor = 1;
    const isUp = plcState.outputs['Q0.0'];
    const isDown = plcState.outputs['Q0.1'];

    return (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
           <h2 className="text-xl font-bold text-blue-600 mb-4 flex items-center gap-2"><span>5️⃣</span> 3层电梯仿真 </h2>
           <div className="bg-slate-800 rounded-xl p-6 text-white h-96 flex gap-4 overflow-hidden relative">
               <div className="w-40 bg-slate-700 h-full relative border-x-4 border-slate-600 flex flex-col justify-between py-6">
                   <div className="absolute top-[6%] left-0 w-full border-b border-slate-500/50 text-xs text-right pr-1 opacity-50">3F</div>
                   <div className="absolute top-[50%] left-0 w-full border-b border-slate-500/50 text-xs text-right pr-1 opacity-50">2F</div>
                   <div className="absolute top-[94%] left-0 w-full border-b border-slate-500/50 text-xs text-right pr-1 opacity-50">1F</div>
                   <div className="absolute left-2 right-2 h-20 bg-slate-200 border-4 border-slate-400 rounded transition-all duration-75 ease-linear z-10 flex items-center justify-center overflow-hidden shadow-lg" style={{ bottom: `${carPos}%`, marginBottom: '-40px' }}>
                       <div className="absolute inset-0 bg-slate-300"></div>
                       <div className="absolute inset-y-0 left-0 bg-zinc-400 border-r border-zinc-500 transition-all duration-100 ease-linear z-20" style={{ width: `${(100 - doorPos)/2}%` }}></div>
                       <div className="absolute inset-y-0 right-0 bg-zinc-400 border-l border-zinc-500 transition-all duration-100 ease-linear z-20" style={{ width: `${(100 - doorPos)/2}%` }}></div>
                       <div className="relative z-0 text-slate-800 font-bold bg-white px-2 rounded-sm border border-slate-400 opacity-50">{floor}</div>
                   </div>
               </div>
               <div className="flex-1 flex flex-col justify-between py-2">
                   <div className="bg-black p-4 rounded-lg border-2 border-slate-600 text-center shadow-[0_0_20px_rgba(0,0,0,0.5)]">
                       <div className="text-xs text-slate-500 mb-1">FLOOR INDICATOR</div>
                       <div className="text-5xl font-mono text-red-500 font-bold flex items-center justify-center gap-2">
                           {isUp && <ArrowUp size={32} className="animate-bounce" />}
                           {isDown && <ArrowDown size={32} className="animate-bounce" />}
                           {!isUp && !isDown && <span className="w-8"></span>}
                           {floor}
                       </div>
                   </div>
                   <div className="grid grid-cols-1 gap-3 text-sm">
                       <div className={`p-3 rounded flex justify-between items-center transition-colors ${plcState.memory['req_3'] ? 'bg-yellow-600 text-white border border-yellow-400 shadow-[0_0_10px_#ca8a04]' : 'bg-slate-700 text-slate-500'}`}><span className="font-bold">3F CALL</span> {plcState.memory['req_3'] && <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>}</div>
                       <div className={`p-3 rounded flex justify-between items-center transition-colors ${plcState.memory['req_2'] ? 'bg-yellow-600 text-white border border-yellow-400 shadow-[0_0_10px_#ca8a04]' : 'bg-slate-700 text-slate-500'}`}><span className="font-bold">2F CALL</span> {plcState.memory['req_2'] && <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>}</div>
                       <div className={`p-3 rounded flex justify-between items-center transition-colors ${plcState.memory['req_1'] ? 'bg-yellow-600 text-white border border-yellow-400 shadow-[0_0_10px_#ca8a04]' : 'bg-slate-700 text-slate-500'}`}><span className="font-bold">1F CALL</span> {plcState.memory['req_1'] && <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>}</div>
                   </div>
               </div>
           </div>
        </div>
    );
};

// --- 3. Mixing Tank Panel ---
const MixingTankPanel: React.FC<SubPanelProps> = ({ plcState }) => {
    const level = plcState.physics['level'] || 0;
    const isMixing = plcState.outputs['Q0.1'];
    const isFilling = plcState.outputs['Q0.0'];
    const isDraining = plcState.outputs['Q0.2'];
    const mixTimer = plcState.timers['T_MIX'];
    const mixTimeLeft = mixTimer && isMixing ? Math.max(0, Math.ceil((mixTimer.pt - mixTimer.et)/1000)) : 0;
    const liquidColor = isMixing ? 'bg-purple-500/80' : 'bg-cyan-500/80';

    return (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
           <h2 className="text-xl font-bold text-blue-600 mb-4 flex items-center gap-2"><span>5️⃣</span> 混合罐系统 </h2>
           <div className="bg-slate-800 rounded-xl p-6 text-white h-64 flex justify-center items-center relative shadow-inner">
               <div className="w-48 h-56 border-x-4 border-b-4 border-slate-500 rounded-b-3xl relative bg-slate-900/80 backdrop-blur-sm overflow-hidden z-10">
                   <div className="absolute right-0 top-[10%] w-2 h-0.5 bg-slate-500"></div>
                   <div className="absolute right-0 top-[50%] w-2 h-0.5 bg-slate-500"></div>
                   <div className="absolute right-0 top-[90%] w-2 h-0.5 bg-slate-500"></div>
                   <div className={`absolute bottom-0 left-0 right-0 transition-all duration-100 ease-linear shadow-[0_0_20px_inset] ${liquidColor}`} style={{ height: `${level}%` }}>
                       <div className="w-full h-2 bg-white/30 animate-pulse absolute top-0"></div>
                       {isMixing && <div className="absolute bottom-4 left-4 w-2 h-2 bg-white/50 rounded-full animate-ping"></div>}
                   </div>
                   <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1.5 h-[80%] bg-slate-400 origin-top z-20 shadow-lg"></div>
                   <div className={`absolute top-[80%] left-1/2 -translate-x-1/2 w-28 h-6 bg-slate-400 rounded-full z-20 ${isMixing ? 'animate-spin' : ''}`}>
                       <div className="w-2 h-2 bg-slate-600 rounded-full absolute left-2 top-2"></div>
                       <div className="w-2 h-2 bg-slate-600 rounded-full absolute right-2 top-2"></div>
                   </div>
               </div>
               {isFilling && <div className="absolute top-[3.5rem] left-[10.5rem] w-2 h-16 bg-cyan-400 z-10 animate-pulse rounded-full opacity-80"></div>}
               {isDraining && <div className="absolute bottom-[2rem] right-[5rem] w-2 h-10 bg-cyan-400 z-0 animate-pulse rounded-full rotate-12 opacity-80"></div>}
               <div className={`absolute top-6 left-24 w-8 h-8 rounded-full z-20 border-2 border-white flex items-center justify-center shadow-lg transition-colors ${isFilling ? 'bg-green-500' : 'bg-red-500'}`}><span className="text-[10px] font-bold">IN</span></div>
               <div className={`absolute bottom-6 right-24 w-8 h-8 rounded-full z-20 border-2 border-white flex items-center justify-center shadow-lg transition-colors ${isDraining ? 'bg-green-500' : 'bg-red-500'}`}><span className="text-[10px] font-bold">OUT</span></div>
               {isMixing && <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 bg-black/60 px-3 py-1 rounded-full border border-white/20 backdrop-blur-md"><span className="text-xl font-mono font-bold text-white animate-pulse">{mixTimeLeft}s</span></div>}
           </div>
        </div>
    );
};

// --- 4. Star Delta Panel ---
const StarDeltaPanel: React.FC<SubPanelProps> = ({ plcState }) => {
    const main = plcState.outputs['Q0.0'];
    const star = plcState.outputs['Q0.1'];
    const delta = plcState.outputs['Q0.2'];
    const motorAngle = plcState.physics['motorAngle'] || 0;
    
    const isTransition = main && !star && !delta;

    return (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
           <h2 className="text-xl font-bold text-blue-600 mb-4 flex items-center gap-2"><span>5️⃣</span> 星三角电机启动仿真 </h2>
           <div className="bg-slate-800 rounded-xl p-8 flex flex-col gap-8 text-white relative overflow-hidden">
               {/* Circuit Visualization Layer */}
               <div className="absolute inset-0 z-0 opacity-20 pointer-events-none">
                   {/* Main Power Lines */}
                   <div className={`absolute left-[30%] top-0 h-[40%] w-1 ${main ? 'bg-green-400 shadow-[0_0_10px_#4ade80]' : 'bg-slate-600'} transition-colors duration-200`}></div>
                   
                   {/* Star Connection Lines */}
                   <div className={`absolute left-[50%] top-[40%] h-[30%] w-1 ${star ? 'bg-yellow-400 shadow-[0_0_10px_#facc15]' : 'bg-slate-600'} transition-colors duration-200 rotate-45 origin-top`}></div>
                   
                   {/* Delta Connection Lines */}
                   <div className={`absolute left-[50%] top-[40%] h-[30%] w-1 ${delta ? 'bg-cyan-400 shadow-[0_0_10px_#22d3ee]' : 'bg-slate-600'} transition-colors duration-200 -rotate-45 origin-top`}></div>
               </div>

               <div className="flex justify-center items-end gap-8 relative z-10">
                   <div className="flex flex-col items-center">
                       <div className={`w-20 h-24 border-2 rounded bg-slate-700 flex flex-col items-center justify-center transition-all duration-200 ${main ? 'border-green-400 bg-slate-600 shadow-[0_0_15px_#4ade80]' : 'border-slate-500'}`}>
                           <div className="text-2xl font-bold">KM1</div>
                           <div className="text-[10px] text-slate-400">MAIN</div>
                           {main && <div className="w-full h-1 bg-green-500 mt-2 animate-pulse"></div>}
                       </div>
                   </div>
                   <div className="relative -mb-4">
                       <div className="w-36 h-36 rounded-full border-8 border-slate-600 bg-slate-700 flex items-center justify-center shadow-2xl relative overflow-hidden">
                           <Fan size={100} className={`text-slate-400 transition-opacity duration-500 ${main && (star||delta) ? 'opacity-100' : 'opacity-30'}`} style={{ transform: `rotate(${motorAngle}deg)` }} />
                       </div>
                   </div>
                   <div className="flex gap-2">
                       <div className="flex flex-col items-center relative top-8">
                           <div className={`w-16 h-16 border-2 rounded bg-slate-700 flex items-center justify-center transition-all ${star ? 'border-yellow-400 bg-slate-600 shadow-[0_0_15px_#facc15]' : 'border-slate-500'}`}><span className="font-bold text-yellow-400 text-xl">KM2</span></div>
                           <span className="text-[10px] mt-1 text-slate-400">STAR (Y)</span>
                       </div>
                       <div className="flex flex-col items-center relative -top-4">
                           <div className={`w-16 h-16 border-2 rounded bg-slate-700 flex items-center justify-center transition-all ${delta ? 'border-cyan-400 bg-slate-600 shadow-[0_0_15px_#22d3ee]' : 'border-slate-500'}`}><span className="font-bold text-cyan-400 text-xl">KM3</span></div>
                           <span className="text-[10px] mt-1 text-slate-400">DELTA (△)</span>
                       </div>
                   </div>
               </div>
               {main && star && <div className="absolute top-10 left-10 text-xs text-yellow-400 font-mono animate-bounce bg-black/50 px-2 py-1 rounded">⚠️ STARTUP MODE (Y)</div>}
               {main && delta && <div className="absolute top-10 left-10 text-xs text-cyan-400 font-mono animate-pulse bg-black/50 px-2 py-1 rounded">⚡ RUNNING MODE (△)</div>}
               {isTransition && <div className="absolute top-10 left-10 text-xs text-slate-300 font-mono animate-pulse bg-black/50 px-2 py-1 rounded">⏳ SWITCHING...</div>}
               <div className="absolute top-4 right-4 bg-black/40 px-3 py-1 rounded text-xs font-mono text-slate-300">TIMER: {(plcState.timers['T_SD']?.et || 0)/1000}s</div>
           </div>
        </div>
    );
};

// --- 5. Traffic Panel ---
const TrafficPanel: React.FC<SubPanelProps> = ({ plcState }) => {
    const red = plcState.outputs['Q0.0'];
    const yel = plcState.outputs['Q0.1'];
    const grn = plcState.outputs['Q0.2'];
    const time = (plcState.timers['T37']?.et || 0) / 1000;
    const totalTime = 12;

    return (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
           <h2 className="text-xl font-bold text-blue-600 mb-4 flex items-center gap-2"><span>5️⃣</span> 交通路口监控 </h2>
           <div className="bg-slate-800 rounded-xl p-6 text-white h-64 flex justify-center items-center relative overflow-hidden">
               <div className="absolute inset-0 bg-gradient-to-b from-slate-800 to-slate-700"></div>
               <div className="absolute bottom-0 w-full h-24 bg-slate-600 flex items-center justify-center perspective-road">
                   <div className="w-full h-full border-t-4 border-slate-400"></div>
                   <div className="absolute w-4 h-full bg-yellow-500/50 dashed-line"></div>
               </div>
               <div className="absolute right-[calc(33.33%+2rem)] bottom-[7.5rem] bg-black p-3 rounded-lg border-2 border-slate-600 shadow-2xl flex flex-col gap-3 z-10 scale-75 origin-bottom-right">
                   <div className={`w-12 h-12 rounded-full border-4 border-slate-800 transition-all duration-300 ${red ? 'bg-red-500 shadow-[0_0_40px_#ef4444] scale-105' : 'bg-red-950/50'}`}></div>
                   <div className={`w-12 h-12 rounded-full border-4 border-slate-800 transition-all duration-300 ${yel ? 'bg-yellow-400 shadow-[0_0_40px_#facc15] scale-105' : 'bg-yellow-950/50'}`}></div>
                   <div className={`w-12 h-12 rounded-full border-4 border-slate-800 transition-all duration-300 ${grn ? 'bg-green-500 shadow-[0_0_40px_#22c55e] scale-105' : 'bg-green-950/50'}`}></div>
               </div>
               <div className="absolute top-4 left-4 bg-black/40 p-3 rounded backdrop-blur-sm border border-white/10">
                   <div className="text-xs text-slate-300 mb-1">CYCLE TIMER</div>
                   <div className="text-3xl font-mono text-white flex items-baseline gap-2">{time.toFixed(1)} <span className="text-sm text-slate-400">s</span></div>
                   <div className="w-32 h-1 bg-slate-700 mt-2 rounded-full overflow-hidden">
                       <div className="h-full bg-blue-500 transition-all duration-100 ease-linear" style={{ width: `${(time/totalTime)*100}%` }}></div>
                   </div>
               </div>
           </div>
        </div>
    );
};

// --- 6. Counting Panel ---
const CountingPanel: React.FC<SubPanelProps> = ({ plcState }) => {
    const boxPos = plcState.physics['boxPos'] || 0;
    const isMotorOn = plcState.outputs['Q0.0'];
    const isFull = plcState.outputs['Q0.1'];
    const currentCount = plcState.counters['C1']?.cv || 0;
    const targetCount = plcState.counters['C1']?.pv || 10;
    return (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
           <h2 className="text-xl font-bold text-blue-600 mb-4 flex items-center gap-2"><span>5️⃣</span> 自动流水线监控 </h2>
           <div className="bg-slate-800 rounded-xl p-6 text-white h-64 relative flex flex-col items-center justify-center overflow-hidden">
               <div className="w-full h-8 bg-slate-600 rounded mt-10 relative overflow-hidden">
                   <div className={`absolute top-0 left-0 h-full w-[200%] bg-[linear-gradient(45deg,transparent_25%,#ffffff10_25%,#ffffff10_50%,transparent_50%,transparent_75%,#ffffff10_75%,#ffffff10_100%)] bg-[length:20px_20px] ${isMotorOn ? 'animate-move-bg' : ''}`} style={{ animationDuration: '1s', animationIterationCount: 'infinite', animationTimingFunction: 'linear' }}></div>
               </div>
               <div className="absolute bottom-[4.5rem] transition-all duration-75 ease-linear" style={{ left: `${Math.max(0, Math.min(95, boxPos))}%` }}>
                   <div className="w-12 h-12 bg-amber-600 border-2 border-amber-400 rounded flex items-center justify-center shadow-lg relative"><Box size={24} className="text-amber-900" /><span className="absolute -top-6 text-xs text-amber-500 font-bold">ITEM</span></div>
               </div>
               <div className="absolute bottom-[5.5rem] left-1/2 -translate-x-1/2 flex flex-col items-center group">
                   <div className={`w-2 h-8 ${plcState.inputs['I0.2'] ? 'bg-red-500 shadow-[0_0_15px_#ef4444]' : 'bg-slate-500'} transition-colors`}></div>
                   <div className="w-4 h-4 bg-slate-400 rounded-full -mt-2 border-2 border-slate-600"></div>
                   <span className="text-xs text-slate-400 mt-1">PHOTO EYE</span>
               </div>
               <div className="absolute top-4 left-4 flex gap-4">
                   <div className="bg-slate-700 p-3 rounded border border-slate-600 shadow-lg">
                       <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">Total Count</div>
                       <div className="text-3xl font-mono text-cyan-400 font-bold tracking-widest bg-black/30 px-2 rounded">{String(currentCount).padStart(2, '0')} <span className="text-sm text-slate-500">/ {targetCount}</span></div>
                   </div>
                   {isFull && <div className="bg-red-500/20 p-3 rounded border border-red-500 flex flex-col items-center justify-center animate-pulse shadow-[0_0_20px_#ef444450]"><span className="text-red-500 font-bold text-sm">BATCH COMPLETE</span></div>}
               </div>
           </div>
           <style>{`@keyframes move-bg { from { transform: translateX(0); } to { transform: translateX(-20px); } } .animate-move-bg { animation-name: move-bg; }`}</style>
        </div>
    );
};

// --- 7. Garage Panel ---
const GaragePanel: React.FC<SubPanelProps> = ({ plcState }) => {
    const pos = plcState.physics['doorPos'] || 0;
    const heightPercent = 100 - pos;
    const isUp = plcState.outputs['Q0.0'];
    const isDown = plcState.outputs['Q0.1'];
    return (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
           <h2 className="text-xl font-bold text-blue-600 mb-4 flex items-center gap-2"><span>5️⃣</span> 车库门监控 </h2>
           <div className="bg-slate-800 rounded-xl p-6 text-white h-64 relative flex justify-center items-end overflow-hidden shadow-inner">
               <div className="absolute inset-0 bg-slate-900/50"></div>
               <div className="absolute bottom-4 z-0 text-slate-700 scale-150 transform transition-opacity duration-1000" style={{ opacity: pos > 80 ? 1 : 0.2 }}><Car size={80} strokeWidth={1} /></div>
               <div className="absolute inset-0 border-x-[40px] border-t-[20px] border-slate-600 z-10 shadow-2xl"></div>
               <div className="absolute top-[20px] left-[40px] right-[40px] bg-gradient-to-b from-slate-300 via-slate-200 to-slate-400 border-b-8 border-slate-500 z-20 shadow-lg transition-all duration-100 ease-linear flex flex-col justify-end" style={{ height: `${heightPercent*0.8}%` }}>
                   <div className="w-full h-px bg-slate-400 mb-4"></div>
                   <div className="w-full h-px bg-slate-400 mb-4"></div>
               </div>
               <div className="absolute top-8 right-16 z-30 flex flex-col gap-2">
                   <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${isUp ? 'bg-green-500 text-white shadow-lg scale-110' : 'bg-slate-700 text-slate-500'}`}><ArrowUp size={14} className={isUp ? 'animate-bounce' : ''}/> OPENING</div>
                   <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${isDown ? 'bg-green-500 text-white shadow-lg scale-110' : 'bg-slate-700 text-slate-500'}`}><ArrowDown size={14} className={isDown ? 'animate-bounce' : ''} /> CLOSING</div>
               </div>
               <div className={`absolute top-[25px] left-[15px] z-30 w-3 h-3 rounded-full ${pos >= 100 ? 'bg-red-500 shadow-[0_0_10px_#ef4444]' : 'bg-slate-800'}`} title="Limit Up"></div>
               <div className={`absolute bottom-[10px] left-[15px] z-30 w-3 h-3 rounded-full ${pos <= 0 ? 'bg-red-500 shadow-[0_0_10px_#ef4444]' : 'bg-slate-800'}`} title="Limit Down"></div>
           </div>
        </div>
    );
};

// --- 8. Generic Panel ---
const GenericPanel: React.FC<{ plcState: PLCState; logic: LogicConfig }> = ({ plcState, logic }) => {
    const isRunning = plcState.outputs['Q0.0'] || plcState.outputs['Q0.1'];
    const motorAngle = plcState.physics['motorAngle'] || 0;
    let statusText = "STOPPED";
    let statusColor = "text-slate-500";
    let iconColor = "text-slate-600";
    
    if (isRunning) {
        if (logic.hasInterlock) {
            if (plcState.outputs['Q0.0']) { statusText = "FORWARD"; statusColor = "text-green-400"; iconColor = "text-green-500"; }
            else { statusText = "REVERSE"; statusColor = "text-blue-400"; iconColor = "text-blue-500"; }
        } else {
            statusText = "RUNNING"; statusColor = "text-green-400"; iconColor = "text-green-500";
        }
    }
    const isEstop = plcState.inputs['I0.3'] || (logic.hasEmergency && plcState.inputs['I0.2']);

    return (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
          <h2 className="text-xl font-bold text-blue-600 mb-4 flex items-center gap-2"><span>5️⃣</span> 设备仿真监控</h2>
          <div className="bg-slate-800 rounded-xl p-8 text-white shadow-inner flex items-center justify-around relative overflow-hidden">
              <div className="relative flex flex-col items-center">
                  <div className="w-40 h-40 bg-slate-700 rounded-full border-8 border-slate-600 shadow-2xl flex items-center justify-center relative">
                      <Fan size={100} strokeWidth={1.5} className={`transition-colors duration-500 ${iconColor}`} style={{ transform: `rotate(${motorAngle}deg)` }}/>
                      <div className="absolute w-12 h-12 bg-slate-500 rounded-full border-4 border-slate-400 shadow-lg flex items-center justify-center"><div className={`w-3 h-3 rounded-full ${isRunning ? 'bg-green-400 animate-pulse' : 'bg-slate-800'}`}></div></div>
                  </div>
                  <div className="mt-4 bg-black/40 px-4 py-1 rounded-full text-sm font-bold font-mono tracking-wider">RPM: {isRunning ? '1500' : '0'}</div>
              </div>
              <div className="flex flex-col gap-4">
                  <div className="bg-slate-700/50 p-4 rounded-lg w-40 border border-slate-600 backdrop-blur-sm">
                      <div className="text-xs text-slate-400 mb-1">STATUS</div>
                      <div className={`text-xl font-bold ${statusColor}`}>{statusText}</div>
                  </div>
                  {logic.hasDelayOn && (
                      <div className="bg-slate-700/50 p-4 rounded-lg w-40 border border-slate-600 backdrop-blur-sm relative overflow-hidden">
                          <div className="text-xs text-slate-400 mb-1">START DELAY</div>
                          <div className="text-2xl font-mono text-yellow-400">{(plcState.timers['T_DELAY']?.et || 0)/1000}s</div>
                          <div className="absolute bottom-0 left-0 h-1 bg-yellow-500 transition-all duration-75" style={{ width: `${Math.min(100, ((plcState.timers['T_DELAY']?.et || 0) / 3000) * 100)}%` }}></div>
                      </div>
                  )}
                  {logic.hasDoublePressStart && (
                      <div className="bg-slate-700/50 p-4 rounded-lg w-40 border border-amber-500/60 backdrop-blur-sm relative overflow-hidden">
                          <div className="text-xs text-amber-300 mb-1 flex justify-between items-center">
                              <span>双次启动监视</span>
                              <span className="text-[10px] text-amber-200/70">2s~10s 有效</span>
                          </div>
                          <div className="text-sm font-mono text-amber-400 mb-2">
                              {(plcState.memory?.['dbl_step'] ?? 0) === 0 && '状态: 待机'}
                              {(plcState.memory?.['dbl_step'] ?? 0) === 1 && `状态: 等待第2次`}
                              {(plcState.memory?.['dbl_step'] ?? 0) === 2 && '状态: 运行中'}
                          </div>
                          <div className="text-[10px] text-slate-400 mb-1">窗口计时 (0~10s)</div>
                          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden mb-1">
                              <div
                                className="h-full bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 transition-all duration-100"
                                style={{ width: `${Math.min(100, ((plcState.timers?.['T_DBL']?.et ?? 0) / 10000) * 100)}%` }}
                              />
                          </div>
                          <div className="flex justify-between text-[10px] text-slate-500">
                              <span>0s</span>
                              <span>10s</span>
                          </div>
                      </div>
                  )}
                  <div className={`px-4 py-2 rounded-lg font-bold text-center border transition-colors ${isEstop ? 'bg-red-500/20 border-red-500 text-red-500 animate-pulse' : 'bg-green-500/10 border-green-500/30 text-green-500'}`}>{isEstop ? 'EMERGENCY STOP' : 'SYSTEM READY'}</div>
              </div>
          </div>
        </div>
    );
};

// --- 三模式灯具 Panel（冷光/暖光/日光，单开关 3 秒内切换）---
const MultiModeLightingPanel: React.FC<SubPanelProps> = ({ plcState }) => {
    const sw = !!plcState.inputs['I0.0'];
    const cold = !!plcState.outputs['Q0.0'];
    const warm = !!plcState.outputs['Q0.1'];
    const day = !!plcState.outputs['Q0.2'];
    const mode = (plcState.memory?.['lighting_mode'] as number) ?? 0;
    const offEt = plcState.timers?.['T_LIGHT_OFF']?.et ?? 0;
    const offSec = (offEt / 1000).toFixed(1);
    const modeLabels = ['冷光', '暖光', '日光'];

    return (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
            <h2 className="text-xl font-bold text-blue-600 mb-4 flex items-center gap-2"><span>5️⃣</span> 三模式灯具（冷/暖/日光）</h2>
            <div className="bg-slate-800 rounded-xl p-6 text-white">
                <div className="flex flex-col sm:flex-row gap-6 items-center justify-center">
                    {/* 单开关 */}
                    <div className="flex flex-col items-center gap-2">
                        <div className={`p-4 rounded-xl border-2 transition-all ${sw ? 'bg-amber-500/20 border-amber-400' : 'bg-slate-700 border-slate-600'}`}>
                            <ToggleRight size={48} className={sw ? 'text-amber-400' : 'text-slate-500'} strokeWidth={2} />
                        </div>
                        <span className="text-sm font-medium">{sw ? '开' : '关'}</span>
                    </div>
                    {/* 三盏灯：仅当前模式亮 + 对应颜色 */}
                    <div className="flex gap-4">
                        <div className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all ${cold ? 'bg-cyan-500/20 border-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.4)]' : 'bg-slate-700/50 border-slate-600'}`}>
                            <Lightbulb size={36} className={cold ? 'text-cyan-300' : 'text-slate-500'} />
                            <span className="text-xs font-medium">冷光</span>
                        </div>
                        <div className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all ${warm ? 'bg-amber-500/20 border-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.4)]' : 'bg-slate-700/50 border-slate-600'}`}>
                            <Lightbulb size={36} className={warm ? 'text-amber-400' : 'text-slate-500'} />
                            <span className="text-xs font-medium">暖光</span>
                        </div>
                        <div className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all ${day ? 'bg-white/20 border-slate-300 shadow-[0_0_20px_rgba(248,250,252,0.4)]' : 'bg-slate-700/50 border-slate-600'}`}>
                            <Lightbulb size={36} className={day ? 'text-white' : 'text-slate-500'} />
                            <span className="text-xs font-medium">日光</span>
                        </div>
                    </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-4 items-center justify-center text-sm">
                    <span className="px-3 py-1.5 rounded-lg bg-slate-700 font-medium">当前模式: {modeLabels[mode]}</span>
                    {!sw && (
                        <span className="px-3 py-1.5 rounded-lg bg-slate-700 text-amber-300">
                            关断 {offSec}s {offEt <= 3000 ? '(3s 内再开切换模式)' : '(超 3s 再开回冷光)'}
                        </span>
                    )}
                </div>
                {!sw && offEt <= 3000 && (
                    <div className="mt-2 w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
                        <div className="h-full bg-amber-500 transition-all duration-100" style={{ width: `${Math.min(100, (offEt / 3000) * 100)}%` }} />
                    </div>
                )}
            </div>
        </div>
    );
};

// --- Main Switcher Component ---
const HmiPanel: React.FC<{ plcState: PLCState; logic: LogicConfig }> = ({ plcState, logic }) => {
  if (logic.hasPID) return <PidPanel plcState={plcState} />;
  if (logic.hasElevator) return <ElevatorPanel plcState={plcState} />;
  if (logic.hasMixingTank) return <MixingTankPanel plcState={plcState} />;
  if (logic.hasStarDelta) return <StarDeltaPanel plcState={plcState} />;
  if (logic.hasTrafficLight) return <TrafficPanel plcState={plcState} />;
  if (logic.hasCounting) return <CountingPanel plcState={plcState} />;
  if (logic.hasGarageDoor) return <GaragePanel plcState={plcState} />;
  if (logic.hasMultiModeLighting) return <MultiModeLightingPanel plcState={plcState} />;
  return <GenericPanel plcState={plcState} logic={logic} />;
};

export default HmiPanel;
