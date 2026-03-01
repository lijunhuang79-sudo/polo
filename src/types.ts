export interface IOPoint {
  addr: string;
  symbol: string;
  device: string;
  type: 'DI' | 'DO' | 'AI' | 'AO' | 'TIMER' | 'COUNTER';
  spec: string;
  location: string;
  note: string;
  value?: boolean | number;
  isMomentary?: boolean;
}

export interface HardwareItem {
  name: string;
  model: string;
  qty: number;
  spec: string;
  note: string;
  required: boolean;
}

export interface LogicConfig {
  hasStartStop: boolean;
  hasInterlock: boolean;
  hasDelayOn: boolean;
  /** 双次启动：需按两次启动且第二次与第一次间隔≥2秒、超过10秒未按第二次则重置 */
  hasDoublePressStart: boolean;
  hasCounting: boolean;
  hasTrafficLight: boolean;
  hasSequencer: boolean;
  hasEmergency: boolean;
  hasLighting: boolean;
  /** 多模式灯具：单开关在3秒内反复切换冷光/暖光/日光等模式 */
  hasMultiModeLighting?: boolean;
  hasMotor: boolean;
  hasPump: boolean;
  hasStarDelta: boolean;
  hasGarageDoor: boolean;
  hasMixingTank: boolean;
  hasElevator: boolean;
  hasPID: boolean;
  scenarioType: 'general' | 'lighting' | 'motor' | 'pump' | 'traffic' | 'door' | 'tank' | 'elevator' | 'pid';
}

export interface PLCState {
  inputs: Record<string, boolean>;
  outputs: Record<string, boolean>;
  memory: Record<string, boolean | number>;
  timers: Record<string, { pt: number; et: number; q: boolean }>;
  counters: Record<string, { pv: number; cv: number; q: boolean }>;
  registers: Record<string, number>;
  physics: Record<string, number>;
}

export interface GeneratedSolution {
  io: IOPoint[];
  hardware: HardwareItem[];
  stlCode: string;
  ladCode: string;
  sclCode: string;
  logicConfig: LogicConfig;
}
