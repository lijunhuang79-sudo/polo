import { GeneratedSolution, LogicConfig, IOPoint, HardwareItem } from '../types';
import { generateSolution } from './plcLogic';

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

/** 判断程序代码是否视为“空”（缺失或占位） */
function isCodeEmpty(s: string): boolean {
  if (!s || typeof s !== 'string') return true;
  const t = s.trim();
  if (t.length < 20) return true;
  if (/无\s*STL|无\s*LAD|无\s*SCL|mock|placeholder|todo|请检查|please\s*check|暂无|未生成/i.test(t)) return true;
  return false;
}

/**
 * 结果检查：确保 STL/LAD/SCL 三者均有有效内容，缺则用本地 generateSolution 补全（不改变 io/hardware）。
 */
export function ensureProgramComplete(
  sol: GeneratedSolution,
  logic: LogicConfig,
  scenarioText: string
): GeneratedSolution {
  const needStl = isCodeEmpty(sol.stlCode);
  const needLad = isCodeEmpty(sol.ladCode);
  const needScl = isCodeEmpty(sol.sclCode);
  if (!needStl && !needLad && !needScl) return sol;

  const local = generateSolution(logic, scenarioText);
  return {
    ...sol,
    stlCode: needStl ? local.stlCode : sol.stlCode,
    ladCode: needLad ? local.ladCode : sol.ladCode,
    sclCode: needScl ? local.sclCode : sol.sclCode,
  };
}

/**
 * 结果检查：确保 BOM 与 I/O 清单对应，缺项则按 I/O 推导并合并（不删原有项，只补缺）。
 */
export function ensureBomMatchesIo(io: IOPoint[], hardware: HardwareItem[]): HardwareItem[] {
  const lower = (s: string) => (s ?? '').toLowerCase();
  const hasName = (key: string) => hardware.some((h) => lower(h.name).includes(key));

  const required: HardwareItem[] = [];

  if (!hasName('plc') && !hasName('cpu')) {
    required.push({ name: 'PLC CPU 主机', model: 'CPU 224XP (或同级 S7-1200)', qty: 1, spec: 'DC/DC/DC, 14DI/10DO', note: '核心控制器', required: true });
  }
  if (!hasName('开关电源')) {
    required.push({ name: '开关电源', model: 'LRS-50-24', qty: 1, spec: 'In: 220VAC, Out: 24VDC 2.2A', note: 'PLC及传感器供电', required: true });
  }

  const diCount = io.filter((p) => p.type === 'DI').length;
  const doCount = io.filter((p) => p.type === 'DO').length;

  const buttonLike = io.filter((p) => p.type === 'DI' && /start|stop|btn|按钮|启动|停止|开关/i.test(lower(p.symbol) + lower(p.device))).length;
  const sensorLike = io.filter((p) => p.type === 'DI' && /sens|limit|lmt|感应|限位|光电/i.test(lower(p.symbol) + lower(p.device))).length;
  const contactorLike = io.filter((p) => p.type === 'DO' && /km|接触器|contactor/i.test(lower(p.symbol) + lower(p.device))).length;
  const lampLike = io.filter((p) => p.type === 'DO' && /l_|light|灯|led/i.test(lower(p.symbol) + lower(p.device))).length;

  if (buttonLike > 0 && !hasName('按钮') && !hasName('开关')) {
    required.push({ name: '按钮 (NO/NC)', model: 'LA38-11', qty: Math.max(1, buttonLike), spec: '常开/常闭', note: '启停等输入', required: true });
  }
  if (sensorLike > 0 && !hasName('感应') && !hasName('传感器') && !hasName('限位')) {
    required.push({ name: '传感器/限位开关', model: 'NPN/NO', qty: Math.max(1, sensorLike), spec: '接近/光电', note: '位置或计数反馈', required: false });
  }
  if (contactorLike > 0 && !hasName('接触器')) {
    required.push({ name: '交流接触器', model: 'LC1-D18', qty: Math.max(1, contactorLike), spec: '18A, AC220V Coil', note: '电机/负载控制', required: true });
  }
  if (lampLike > 0 && !hasName('指示灯') && !hasName('灯')) {
    required.push({ name: '指示灯', model: 'AD16-22', qty: Math.max(1, lampLike), spec: '24V', note: '输出状态指示', required: false });
  }

  if (doCount > 0 && !hasName('接触器') && !hasName('继电器') && contactorLike === 0) {
    required.push({ name: '继电器/接触器', model: '参考负载选型', qty: Math.max(1, doCount), spec: '24V 线圈', note: 'DO 驱动', required: false });
  }
  if (!hasName('端子') && !hasName('接线')) {
    required.push({ name: '接线端子排', model: 'UK-2.5B', qty: Math.max(10, diCount + doCount + 4), spec: '2.5mm²', note: 'IO接线', required: false });
  }

  const merged = [...hardware];
  for (const r of required) {
    const exists = merged.some((h) => lower(h.name).includes(lower(r.name).slice(0, 4)));
    if (!exists) merged.push(r);
  }
  return merged;
}
