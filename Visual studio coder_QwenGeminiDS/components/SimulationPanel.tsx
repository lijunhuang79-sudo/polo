import React from 'react';

type IoItem = {
  addr: string;
  symbol: string;
  device: string;
  type: string;
  isMomentary?: boolean;
  spec?: string;
  location?: string;
  note?: string;
};

type PLCState = {
  inputs: Record<string, boolean>;
  outputs: Record<string, boolean>;
  [k: string]: unknown;
};

type Props = {
  io: IoItem[];
  plcState: PLCState;
  onToggleInput: (addr: string, isMomentary: boolean, isPressed: boolean) => void;
  onReset?: () => void;
};

const SimulationPanel: React.FC<Props> = ({ io, plcState, onToggleInput }) => {
  const keyOf = (addr: string) => addr.replace(/[._]/g, '_');

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="border rounded-lg p-4 bg-slate-50">
          <h3 className="text-sm font-bold text-slate-600 mb-3">输入 (DI)</h3>
          <div className="flex flex-wrap gap-2">
            {io.filter((i) => i.type === 'DI').map((i) => {
              const key = keyOf(i.addr);
              const on = !!plcState.inputs[key];
              const momentary = !!i.isMomentary;
              return (
                <div key={i.addr} className="flex items-center gap-2">
                  <button
                    type="button"
                    title={i.device}
                    onMouseDown={momentary ? () => onToggleInput(i.addr, true, true) : undefined}
                    onMouseUp={momentary ? () => onToggleInput(i.addr, true, false) : undefined}
                    onMouseLeave={momentary ? () => onToggleInput(i.addr, true, false) : undefined}
                    onClick={!momentary ? () => onToggleInput(i.addr, false, !on) : undefined}
                    className={`px-3 py-1.5 rounded text-sm font-mono font-bold border-2 transition-colors ${
                      on ? 'bg-green-500 border-green-600 text-white' : 'bg-white border-slate-300 text-slate-700'
                    }`}
                  >
                    {i.symbol}
                  </button>
                  <span className="text-xs text-slate-500">{i.addr}</span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="border rounded-lg p-4 bg-slate-50">
          <h3 className="text-sm font-bold text-slate-600 mb-3">输出 (DO)</h3>
          <div className="flex flex-wrap gap-2">
            {io.filter((i) => i.type === 'DO').map((i) => {
              const key = keyOf(i.addr);
              const on = !!plcState.outputs[key];
              return (
                <div key={i.addr} className="flex items-center gap-2">
                  <span
                    className={`inline-block w-4 h-4 rounded-full border-2 ${
                      on ? 'bg-green-500 border-green-600' : 'bg-slate-200 border-slate-400'
                    }`}
                    title={i.device}
                  />
                  <span className="text-sm font-mono font-bold text-slate-700">{i.symbol}</span>
                  <span className="text-xs text-slate-500">{i.addr}</span>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
};

export default SimulationPanel;
