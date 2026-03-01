import { GeneratedSolution, LogicConfig, IOPoint, HardwareItem } from '../types';

const DEFAULT_LOGIC: LogicConfig = {
  hasStartStop: false,
  hasInterlock: false,
  hasDelayOn: false,
  hasDoublePressStart: false,
  hasCounting: false,
  hasTrafficLight: false,
  hasSequencer: false,
  hasEmergency: false,
  hasLighting: false,
  hasMultiModeLighting: false,
  hasMotor: false,
  hasPump: false,
  hasStarDelta: false,
  hasGarageDoor: false,
  hasMixingTank: false,
  hasElevator: false,
  hasPID: false,
  scenarioType: 'general',
};

function isObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function isNonEmptyArray(v: unknown): v is unknown[] {
  return Array.isArray(v) && v.length > 0;
}

function isString(v: unknown): v is string {
  return typeof v === 'string';
}

/**
 * 校验并规范化 AI 返回的 GeneratedSolution。
 * 若结构严重缺失则返回 { valid: false }，并尽量补全 logicConfig/io 等避免运行时崩溃。
 */
export function validateAndNormalizeSolution(raw: unknown): { valid: true; sol: GeneratedSolution } | { valid: false; error: string } {
  if (!isObject(raw)) {
    return { valid: false, error: 'AI 返回的不是有效对象' };
  }

  let io = raw.io;
  if (!Array.isArray(io)) io = [];
  const ioList: IOPoint[] = io.map((item: unknown) => {
    if (!isObject(item)) return { addr: 'I0.0', symbol: 'START', device: '启动', type: 'DI' as const, spec: '', location: '', note: '' };
    return {
      addr: isString(item.addr) ? item.addr : 'I0.0',
      symbol: isString(item.symbol) ? item.symbol : 'X',
      device: isString(item.device) ? item.device : '',
      type: (item.type === 'DO' || item.type === 'AI' || item.type === 'AO' || item.type === 'TIMER' || item.type === 'COUNTER') ? item.type : 'DI',
      spec: isString(item.spec) ? item.spec : '',
      location: isString(item.location) ? item.location : '',
      note: isString(item.note) ? item.note : '',
      isMomentary: item.type === 'DI' ? true : undefined,
    };
  });

  let hardware = raw.hardware;
  if (!Array.isArray(hardware)) hardware = [];
  const hwList: HardwareItem[] = hardware.map((item: unknown) => {
    if (!isObject(item)) return { name: 'PLC', model: '', qty: 1, spec: '', note: '', required: true };
    return {
      name: isString(item.name) ? item.name : '设备',
      model: isString(item.model) ? item.model : '',
      qty: typeof item.qty === 'number' ? item.qty : 1,
      spec: isString(item.spec) ? item.spec : '',
      note: isString(item.note) ? item.note : '',
      required: item.required === true,
    };
  });

  const stlCode = isString(raw.stlCode) ? raw.stlCode : '// 无 STL 代码';
  const ladCode = isString(raw.ladCode) ? raw.ladCode : '// 无 LAD 代码';
  const sclCode = isString(raw.sclCode) ? raw.sclCode : '// 无 SCL 代码';

  let logicConfig: LogicConfig = { ...DEFAULT_LOGIC };
  if (isObject(raw.logicConfig)) {
    const l = raw.logicConfig as Record<string, unknown>;
    const scenarioType = l.scenarioType;
    const allowed: LogicConfig['scenarioType'][] = ['general', 'lighting', 'motor', 'pump', 'traffic', 'door', 'tank', 'elevator', 'pid'];
    logicConfig = {
      hasStartStop: !!l.hasStartStop,
      hasInterlock: !!l.hasInterlock,
      hasDelayOn: !!l.hasDelayOn,
      hasDoublePressStart: !!l.hasDoublePressStart,
      hasCounting: !!l.hasCounting,
      hasTrafficLight: !!l.hasTrafficLight,
      hasSequencer: !!l.hasSequencer,
      hasEmergency: !!l.hasEmergency,
      hasLighting: !!l.hasLighting,
      hasMultiModeLighting: !!l.hasMultiModeLighting,
      hasMotor: !!l.hasMotor,
      hasPump: !!l.hasPump,
      hasStarDelta: !!l.hasStarDelta,
      hasGarageDoor: !!l.hasGarageDoor,
      hasMixingTank: !!l.hasMixingTank,
      hasElevator: !!l.hasElevator,
      hasPID: !!l.hasPID,
      scenarioType: (typeof scenarioType === 'string' && allowed.includes(scenarioType as LogicConfig['scenarioType'])) ? scenarioType as LogicConfig['scenarioType'] : 'general',
    };
  }

  const sol: GeneratedSolution = {
    io: ioList.length > 0 ? ioList : [
      { addr: 'I0.0', symbol: 'START', device: '启动', type: 'DI', spec: '', location: '', note: '', isMomentary: true },
      { addr: 'I0.1', symbol: 'STOP', device: '停止', type: 'DI', spec: '', location: '', note: '', isMomentary: true },
      { addr: 'Q0.0', symbol: 'KM1', device: '输出', type: 'DO', spec: '', location: '', note: '' },
    ],
    hardware: hwList.length > 0 ? hwList : [{ name: 'PLC', model: 'CPU 224XP', qty: 1, spec: '', note: '', required: true }],
    stlCode,
    ladCode,
    sclCode,
    logicConfig,
  };

  const valid = (Array.isArray(raw.io) && raw.io.length > 0) || (isString(raw.stlCode) && raw.stlCode.length > 20);
  return valid ? { valid: true, sol } : { valid: false, error: 'AI 返回的 io 或程序内容缺失，已用本地方案兜底' };
}
