import React from 'react';
import { IOPoint, PLCState } from '../types';
import { 
  Power, Square, Play, ToggleLeft, ToggleRight, 
  Lightbulb, Fan, Activity, Radio, MousePointerClick, Lock, Zap 
} from 'lucide-react';

interface Props {
  io: IOPoint[];
  plcState: PLCState;
  onToggleInput: (addr: string, isMomentary: boolean, isPressed: boolean) => void;
}

interface DeviceCardProps {
    point: IOPoint;
    isInput: boolean;
    plcState: PLCState;
    lockedInputs: Record<string, boolean>;
    onToggleInput: (addr: string, isMomentary: boolean, isPressed: boolean) => void;
    toggleLock: (addr: string) => void;
}

// Extracted and Memoized Component to prevent re-creation on every parent render
const DeviceCard: React.FC<DeviceCardProps> = React.memo(({ point, isInput, plcState, lockedInputs, onToggleInput, toggleLock }) => {
    const isActive = isInput ? plcState.inputs[point.addr] : plcState.outputs[point.addr];
    const isMomentary = point.isMomentary !== false;
    const isLocked = lockedInputs[point.addr];

    let Icon = Power;
    let colorClass = "text-slate-400";
    let bgClass = "bg-slate-200";
    let activeColor = "bg-green-500 shadow-[0_0_15px_#22c55e]";

    if (isInput) {
        if (point.symbol.includes('STOP') || point.symbol.includes('ESTOP')) {
            Icon = Square;
            bgClass = isActive ? "bg-red-600 translate-y-1 shadow-inner" : "bg-red-500 shadow-lg hover:bg-red-400";
            colorClass = "text-white";
        } else if (point.symbol === 'SW' || point.symbol.includes('SW_')) {
            // 单联开关：拨动式，非点动
            Icon = ToggleRight;
            bgClass = isActive ? "bg-amber-500 shadow-lg border-2 border-amber-400" : "bg-slate-500 shadow border-2 border-slate-600";
            colorClass = "text-white";
        } else if (point.symbol.includes('START') || point.symbol.includes('BTN')) {
            Icon = Play;
            bgClass = isActive ? "bg-green-600 translate-y-1 shadow-inner" : "bg-green-500 shadow-lg hover:bg-green-400";
            colorClass = "text-white";
        } else if (point.symbol.includes('SENS') || point.symbol.includes('LIMIT') || point.symbol.includes('LMT')) {
            Icon = isActive ? ToggleRight : ToggleLeft;
            bgClass = isActive ? "bg-blue-600" : "bg-slate-600";
            colorClass = isActive ? "text-white" : "text-slate-300";
        } else {
            Icon = MousePointerClick;
            bgClass = isActive ? "bg-blue-600 translate-y-1" : "bg-blue-500";
            colorClass = "text-white";
        }
    } else {
        bgClass = "bg-slate-700";
        if (point.symbol.includes('L_COLD') || point.symbol.includes('COLD')) { Icon = Lightbulb; activeColor = "bg-cyan-300 shadow-[0_0_25px_#67e8f9] text-slate-900"; }
        else if (point.symbol.includes('L_WARM') || point.symbol.includes('WARM')) { Icon = Lightbulb; activeColor = "bg-amber-400 shadow-[0_0_25px_#fbbf24]"; }
        else if (point.symbol.includes('L_DAY') || point.symbol.includes('DAY')) { Icon = Lightbulb; activeColor = "bg-white shadow-[0_0_25px_#f8fafc] text-slate-700"; }
        else if (point.symbol.includes('RED')) { Icon = Lightbulb; activeColor = "bg-red-500 shadow-[0_0_20px_#ef4444]"; }
        else if (point.symbol.includes('YEL')) { Icon = Lightbulb; activeColor = "bg-yellow-400 shadow-[0_0_20px_#facc15]"; }
        else if (point.symbol.includes('GRN')) { Icon = Lightbulb; activeColor = "bg-green-500 shadow-[0_0_20px_#22c55e]"; }
        else if (point.symbol.includes('KM')) { Icon = Zap; activeColor = "bg-blue-600 shadow-[0_0_15px_#3b82f6]"; } // Contactors
        else if (point.symbol.includes('M_') || point.symbol.includes('FAN')) { Icon = Fan; activeColor = "bg-cyan-500 shadow-[0_0_20px_#06b6d4] animate-spin-slow"; } // Motors
        else if (point.symbol.includes('V_')) { Icon = Radio; activeColor = "bg-blue-500 shadow-[0_0_20px_#3b82f6]"; }
        else { Icon = Activity; activeColor = "bg-green-500 shadow-[0_0_15px_#22c55e]"; }
    }

    return (
      <div className="relative group min-w-[100px] flex flex-col items-center">
        <div className={`w-20 h-28 rounded-lg border-2 border-slate-600 bg-slate-800 flex flex-col items-center justify-between p-2 shadow-xl transition-all ${isActive ? 'border-slate-500' : ''}`}>
           <div className="w-full flex justify-center mb-1">
              <div className={`w-3 h-3 rounded-full border border-slate-500 ${isActive ? 'bg-yellow-400 shadow-[0_0_8px_#facc15]' : 'bg-slate-900'}`} title="Signal State (24V)"></div>
           </div>
           <div className="flex-1 flex items-center justify-center w-full">
               {isInput ? (
                   <div className="relative">
                       <button
                            onMouseDown={() => isMomentary && !isLocked && onToggleInput(point.addr, true, true)}
                            onMouseUp={() => isMomentary && !isLocked && onToggleInput(point.addr, true, false)}
                            onMouseLeave={() => isMomentary && !isLocked && isActive && onToggleInput(point.addr, true, false)}
                            onClick={() => !isMomentary && onToggleInput(point.addr, false, !isActive)}
                            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-75 ${bgClass} ${colorClass}`}
                            title={`${point.note} (Click to Actuate)`}
                       >
                           <Icon size={20} className={isActive && point.symbol.includes('KM') ? 'animate-spin' : ''} />
                       </button>
                       {isMomentary && (
                           <button 
                             onClick={(e) => { e.stopPropagation(); toggleLock(point.addr); }}
                             className={`absolute -right-2 -bottom-2 w-6 h-6 flex items-center justify-center rounded-full border shadow-sm z-10 ${isLocked ? 'bg-yellow-500 border-yellow-600 text-white' : 'bg-slate-700 border-slate-500 text-slate-400 hover:text-white'}`}
                             title={isLocked ? "已锁定 (Release)" : "锁定按下状态 (Simulate Hold)"}
                           >
                               <Lock size={10} />
                           </button>
                       )}
                   </div>
               ) : (
                   <div className={`w-12 h-12 rounded-full border-2 border-slate-600 flex items-center justify-center transition-all duration-300 ${isActive ? activeColor : 'bg-slate-900 text-slate-600'}`}>
                       <Icon size={24} className={isActive ? 'text-white' : ''} />
                   </div>
               )}
           </div>
           <div className="w-full text-center mt-1">
               <div className="text-[10px] font-mono text-slate-400 leading-tight bg-black/20 rounded px-1">{point.addr}</div>
           </div>
        </div>
        <div className="mt-2 text-center group-hover:-translate-y-1 transition-transform">
            <div className="text-xs font-bold text-slate-700 bg-white border border-slate-200 px-2 py-0.5 rounded shadow-sm inline-block max-w-[100px] truncate">{point.symbol}</div>
            <div className="text-[10px] text-slate-500 mt-0.5 max-w-[100px] truncate" title={point.device}>{point.device}</div>
        </div>
      </div>
    );
});

const SimulationPanel: React.FC<Props> = ({ io, plcState, onToggleInput }) => {
  const inputs = io.filter(i => i.type === 'DI');
  const outputs = io.filter(i => i.type === 'DO');
  
  const [lockedInputs, setLockedInputs] = React.useState<Record<string, boolean>>({});

  const toggleLock = (addr: string) => {
    setLockedInputs(prev => {
      const isLocked = !prev[addr];
      onToggleInput(addr, true, isLocked);
      return { ...prev, [addr]: isLocked };
    });
  };

  return (
    <div className="bg-slate-100 p-6 rounded-lg shadow-sm border border-slate-200">
      <h2 className="text-xl font-bold text-blue-600 mb-6 flex items-center gap-2">
        <span>4️⃣</span> 现场电气柜仿真 (Interactive Panel)
      </h2>
      <div className="flex flex-col gap-8">
        {/* Input Rail */}
        <div className="relative bg-gradient-to-b from-slate-200 to-slate-300 p-4 rounded-xl border border-slate-400 shadow-inner">
             <div className="absolute top-2 left-2 text-xs font-bold text-slate-500 uppercase tracking-widest">Input Rail (DI)</div>
             <div className="flex gap-4 overflow-x-auto pb-2 pt-6 px-2">
                 {inputs.map(p => (
                     <DeviceCard 
                        key={p.addr} 
                        point={p} 
                        isInput={true} 
                        plcState={plcState} 
                        onToggleInput={onToggleInput}
                        lockedInputs={lockedInputs}
                        toggleLock={toggleLock}
                     />
                 ))}
                 {inputs.length === 0 && <div className="text-slate-400 text-sm italic p-4">No Digital Inputs Configured</div>}
             </div>
        </div>

        {/* Output Rail */}
        <div className="relative bg-gradient-to-b from-slate-800 to-slate-900 p-4 rounded-xl border border-slate-700 shadow-inner">
             <div className="absolute top-2 left-2 text-xs font-bold text-slate-400 uppercase tracking-widest">Output Rail (DO)</div>
             <div className="flex gap-4 overflow-x-auto pb-2 pt-6 px-2">
                 {outputs.map(p => (
                     <DeviceCard 
                        key={p.addr} 
                        point={p} 
                        isInput={false} 
                        plcState={plcState} 
                        onToggleInput={onToggleInput}
                        lockedInputs={lockedInputs}
                        toggleLock={toggleLock}
                     />
                 ))}
                 {outputs.length === 0 && <div className="text-slate-600 text-sm italic p-4">No Digital Outputs Configured</div>}
             </div>
        </div>
      </div>
    </div>
  );
};

export default SimulationPanel;