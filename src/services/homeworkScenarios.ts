import type { GeneratedSolution, IOPoint, HardwareItem, LogicConfig, PLCState } from '../types';
import {
  COMPARISON_LAD,
  COMPARISON_SCL,
  COMPARISON_STL,
  CROSS_TRAFFIC_LAD,
  CROSS_TRAFFIC_SCL,
  CROSS_TRAFFIC_STL,
  ENGINE_FAN_LAD,
  ENGINE_FAN_SCL,
  ENGINE_FAN_STL,
  ROBOT_ARM_LAD,
  ROBOT_ARM_SCL,
  ROBOT_ARM_STL,
} from '../data/textbookDesktopPrograms';
import { updateTON } from './simKernel';

const STANDARD_BOM: HardwareItem[] = [
  { name: 'PLC CPU 主机', model: 'S7-1200 CPU 1214C DC/DC/DC', qty: 1, spec: 'DC 24V', note: 'TIA Portal V16 · S7-1200/1500', required: true },
  { name: '开关电源', model: 'LRS-50-24', qty: 1, spec: '24VDC 2.2A', note: 'PLC及现场供电', required: true },
  { name: '微型断路器', model: 'DZ47-63 C6', qty: 1, spec: '6A', note: '总电源保护', required: true },
];

export type HomeworkKind = 'comparisonLights' | 'crossTraffic' | 'robotArm' | 'engineFan';

/** 识别博途 S7-1200/1500 教科书场景 */
export function detectHomeworkKind(scenario: string): HomeworkKind | null {
  const text = scenario;
  if (/比较指令|三组.*灯|绿色.*蓝色.*红色|30\s*秒.*循环|回到第一组/i.test(text)) {
    return 'comparisonLights';
  }
  if (/十字路口|南北.*东西|东西直行|南北直行|SB4|SB5|黄灯.*0\.5/i.test(text)) {
    return 'crossTraffic';
  }
  if (/机械手|工作台\s*[AB]|单周期|单步.*启动|回原位|夹紧.*右行/i.test(text)) {
    return 'robotArm';
  }
  if (/汽油发动机|柴油发动机|发动机组|散热风扇.*延时|风扇.*10\s*秒|TOF/i.test(text)) {
    return 'engineFan';
  }
  return null;
}

export function homeworkLogicFlags(kind: HomeworkKind): Partial<LogicConfig> {
  const base = { scenarioType: 'homework' as const };
  switch (kind) {
    case 'comparisonLights':
      return { ...base, hasComparisonLights: true, hasStartStop: true, hasSequencer: true };
    case 'crossTraffic':
      return { ...base, hasCrossTraffic: true, hasTrafficLight: true, hasStartStop: true };
    case 'robotArm':
      return { ...base, hasRobotArm: true, hasStartStop: true, hasSequencer: true };
    case 'engineFan':
      return { ...base, hasEngineFan: true, hasStartStop: true, hasMotor: true };
  }
}

export function generateHomeworkSolution(kind: HomeworkKind): GeneratedSolution {
  const logicConfig = { ...detectLogicDefaults(), ...homeworkLogicFlags(kind) } as LogicConfig;
  let body: Omit<GeneratedSolution, 'logicConfig'>;
  switch (kind) {
    case 'comparisonLights':
      body = genComparisonLights();
      break;
    case 'crossTraffic':
      body = genCrossTraffic();
      break;
    case 'robotArm':
      body = genRobotArm();
      break;
    case 'engineFan':
      body = genEngineFan();
      break;
  }
  return {
    ...body,
    hardware: [...STANDARD_BOM, ...body.hardware],
    logicConfig,
  };
}

function detectLogicDefaults(): LogicConfig {
  return {
    hasStartStop: false,
    hasInterlock: false,
    hasDelayOn: false,
    hasDoublePressStart: false,
    hasCounting: false,
    hasTrafficLight: false,
    hasSequencer: false,
    hasEmergency: false,
    hasLighting: false,
    hasMotor: false,
    hasPump: false,
    hasStarDelta: false,
    hasGarageDoor: false,
    hasMixingTank: false,
    hasElevator: false,
    hasPID: false,
    scenarioType: 'homework',
  };
}

function genComparisonLights(): Omit<GeneratedSolution, 'logicConfig'> {
  const io: IOPoint[] = [
    { addr: 'I0.0', symbol: 'Start', device: '启动按钮', type: 'DI', spec: 'NO', location: '面板', note: '常开', isMomentary: true },
    { addr: 'I0.1', symbol: 'Stop', device: '停止按钮', type: 'DI', spec: 'NO', location: '面板', note: '停止', isMomentary: true },
    { addr: 'Q0.0', symbol: 'Green', device: '绿色灯组', type: 'DO', spec: 'DC24V', location: '现场', note: '0~9s' },
    { addr: 'Q0.1', symbol: 'Blue', device: '蓝色灯组', type: 'DO', spec: 'DC24V', location: '现场', note: '10~19s' },
    { addr: 'Q0.2', symbol: 'Red', device: '红色灯组', type: 'DO', spec: 'DC24V', location: '现场', note: '20~29s' },
    { addr: 'M0.0', symbol: 'Run', device: '运行标志', type: 'DO', spec: 'Bool', location: '内部', note: '自锁' },
    { addr: 'M0.1', symbol: 'TonFlag', device: '秒计数防重复', type: 'DO', spec: 'Bool', location: '内部', note: '' },
    { addr: 'MW10', symbol: 'T_Sec', device: '秒计数', type: 'TIMER', spec: 'INT 0~29', location: '内部', note: '比较用' },
  ];
  const hardware: HardwareItem[] = [
    { name: '三色指示灯模组', model: 'AD16-22DS', qty: 3, spec: 'DC24V', note: '绿/蓝/红各一组', required: true },
  ];
  return { io, hardware, stlCode: COMPARISON_STL, ladCode: COMPARISON_LAD, sclCode: COMPARISON_SCL };
}

function genCrossTraffic(): Omit<GeneratedSolution, 'logicConfig'> {
  const io: IOPoint[] = [
    { addr: 'I0.0', symbol: 'SB1_Auto', device: '自动控制 SB1', type: 'DI', spec: 'NO', location: '面板', note: '进入自动', isMomentary: true },
    { addr: 'I0.1', symbol: 'SB2_Stop', device: '停止 SB2', type: 'DI', spec: 'NO', location: '面板', note: '全停', isMomentary: true },
    { addr: 'I0.2', symbol: 'SB3_Manual', device: '手动 SB3', type: 'DI', spec: 'NO', location: '面板', note: '进入手动', isMomentary: true },
    { addr: 'I0.3', symbol: 'SB4_EW', device: '东西直行 SB4', type: 'DI', spec: 'NO', location: '面板', note: '手动', isMomentary: true },
    { addr: 'I0.4', symbol: 'SB5_NS', device: '南北直行 SB5', type: 'DI', spec: 'NO', location: '面板', note: '手动', isMomentary: true },
    { addr: 'Q0.0', symbol: 'NS_Red', device: '南北红灯', type: 'DO', spec: 'DC24V', location: '路口', note: '' },
    { addr: 'Q0.1', symbol: 'NS_Yellow', device: '南北黄灯', type: 'DO', spec: 'DC24V', location: '路口', note: 'Flash %M0.5' },
    { addr: 'Q0.2', symbol: 'NS_Green', device: '南北绿灯', type: 'DO', spec: 'DC24V', location: '路口', note: '' },
    { addr: 'Q0.3', symbol: 'EW_Red', device: '东西红灯', type: 'DO', spec: 'DC24V', location: '路口', note: '' },
    { addr: 'Q0.4', symbol: 'EW_Yellow', device: '东西黄灯', type: 'DO', spec: 'DC24V', location: '路口', note: 'Flash %M0.5' },
    { addr: 'Q0.5', symbol: 'EW_Green', device: '东西绿灯', type: 'DO', spec: 'DC24V', location: '路口', note: '' },
    { addr: 'M0.0', symbol: 'AutoMode', device: '自动方式', type: 'DO', spec: 'Bool', location: '内部', note: '' },
    { addr: 'M0.1', symbol: 'ManualMode', device: '手动方式', type: 'DO', spec: 'Bool', location: '内部', note: '' },
    { addr: 'M0.5', symbol: 'Flash', device: '0.5s 闪烁', type: 'DO', spec: 'Bool', location: '内部', note: '时钟 %MB0' },
    { addr: 'MW10', symbol: 'Step', device: '自动步号', type: 'TIMER', spec: 'INT 1~4', location: '内部', note: '' },
  ];
  const hardware: HardwareItem[] = [
    { name: '十字路口信号灯', model: 'RYG×2', qty: 1, spec: 'DC24V', note: '南北+东西', required: true },
  ];
  return { io, hardware, stlCode: CROSS_TRAFFIC_STL, ladCode: CROSS_TRAFFIC_LAD, sclCode: CROSS_TRAFFIC_SCL };
}

function genRobotArm(): Omit<GeneratedSolution, 'logicConfig'> {
  const io: IOPoint[] = [
    { addr: 'I0.0', symbol: 'SB1_Start', device: '启动 SB1', type: 'DI', spec: 'NO', location: '面板', note: '', isMomentary: true },
    { addr: 'I0.1', symbol: 'SB2_Stop', device: '停止 SB2', type: 'DI', spec: 'NO', location: '面板', note: '', isMomentary: true },
    { addr: 'I0.2', symbol: 'Btn_Up', device: '上升(手动)', type: 'DI', spec: 'NO', location: '面板', note: '', isMomentary: true },
    { addr: 'I0.3', symbol: 'Btn_Down', device: '下降(手动)', type: 'DI', spec: 'NO', location: '面板', note: '', isMomentary: true },
    { addr: 'I0.4', symbol: 'Btn_Left', device: '左行(手动)', type: 'DI', spec: 'NO', location: '面板', note: '', isMomentary: true },
    { addr: 'I0.5', symbol: 'Btn_Right', device: '右行(手动)', type: 'DI', spec: 'NO', location: '面板', note: '', isMomentary: true },
    { addr: 'I0.6', symbol: 'Btn_Clamp', device: '夹紧(手动)', type: 'DI', spec: 'NO', location: '面板', note: '', isMomentary: true },
    { addr: 'I0.7', symbol: 'Btn_Release', device: '放松(手动)', type: 'DI', spec: 'NO', location: '面板', note: '', isMomentary: true },
    { addr: 'I1.0', symbol: 'SA_Manual', device: 'SA 手动', type: 'DI', spec: 'NO', location: '面板', note: '方式选择', isMomentary: false },
    { addr: 'I1.1', symbol: 'SA_Home', device: 'SA 回原位', type: 'DI', spec: 'NO', location: '面板', note: '', isMomentary: false },
    { addr: 'I1.2', symbol: 'SA_SingleStep', device: 'SA 单步', type: 'DI', spec: 'NO', location: '面板', note: '', isMomentary: false },
    { addr: 'I1.3', symbol: 'SA_SingleCyc', device: 'SA 单周期', type: 'DI', spec: 'NO', location: '面板', note: '', isMomentary: false },
    { addr: 'I1.4', symbol: 'SA_Continuous', device: 'SA 连续', type: 'DI', spec: 'NO', location: '面板', note: '', isMomentary: false },
    { addr: 'I2.0', symbol: 'LS_Up', device: '上升到位', type: 'DI', spec: 'NO', location: '机械手', note: '限位', isMomentary: false },
    { addr: 'I2.1', symbol: 'LS_DownA', device: 'A台下降到位', type: 'DI', spec: 'NO', location: '机械手', note: '限位', isMomentary: false },
    { addr: 'I2.2', symbol: 'LS_DownB', device: 'B台下降到位', type: 'DI', spec: 'NO', location: '机械手', note: '限位', isMomentary: false },
    { addr: 'I2.3', symbol: 'LS_Left', device: '左行到位', type: 'DI', spec: 'NO', location: '机械手', note: '原位', isMomentary: false },
    { addr: 'I2.4', symbol: 'LS_Right', device: '右行到位', type: 'DI', spec: 'NO', location: '机械手', note: 'B台', isMomentary: false },
    { addr: 'Q0.0', symbol: 'Out_Up', device: '上升', type: 'DO', spec: 'DC24V', location: '机械手', note: '' },
    { addr: 'Q0.1', symbol: 'Out_Down', device: '下降', type: 'DO', spec: 'DC24V', location: '机械手', note: '' },
    { addr: 'Q0.2', symbol: 'Out_Left', device: '左行', type: 'DO', spec: 'DC24V', location: '机械手', note: '' },
    { addr: 'Q0.3', symbol: 'Out_Right', device: '右行', type: 'DO', spec: 'DC24V', location: '机械手', note: '' },
    { addr: 'Q0.4', symbol: 'Out_Clamp', device: '夹紧', type: 'DO', spec: 'DC24V', location: '机械手', note: '' },
    { addr: 'Q0.5', symbol: 'Out_Release', device: '放松', type: 'DO', spec: 'DC24V', location: '机械手', note: '' },
    { addr: 'M0.0', symbol: 'AutoRun', device: '自动运行', type: 'DO', spec: 'Bool', location: '内部', note: '' },
    { addr: 'M0.3', symbol: 'AtHome', device: '在原位', type: 'DO', spec: 'Bool', location: '内部', note: 'LS_Up∧LS_Left' },
    { addr: 'MW10', symbol: 'Step', device: '步号 0~8', type: 'TIMER', spec: 'INT', location: '内部', note: '' },
    { addr: 'MW12', symbol: 'Mode', device: '工作方式 1~5', type: 'TIMER', spec: 'INT', location: '内部', note: '' },
  ];
  const hardware: HardwareItem[] = [
    { name: '机械手控制单元', model: 'SIMATIC S7-1200', qty: 1, spec: '24VDC', note: '步序+五种方式', required: true },
  ];
  return { io, hardware, stlCode: ROBOT_ARM_STL, ladCode: ROBOT_ARM_LAD, sclCode: ROBOT_ARM_SCL };
}

function genEngineFan(): Omit<GeneratedSolution, 'logicConfig'> {
  const io: IOPoint[] = [
    { addr: 'I0.0', symbol: 'GasStart', device: '汽油机启动', type: 'DI', spec: 'NO', location: '面板', note: '', isMomentary: true },
    { addr: 'I0.1', symbol: 'GasStop', device: '汽油机停止', type: 'DI', spec: 'NO', location: '面板', note: '', isMomentary: true },
    { addr: 'I0.2', symbol: 'DieselStart', device: '柴油机启动', type: 'DI', spec: 'NO', location: '面板', note: '', isMomentary: true },
    { addr: 'I0.3', symbol: 'DieselStop', device: '柴油机停止', type: 'DI', spec: 'NO', location: '面板', note: '', isMomentary: true },
    { addr: 'Q0.0', symbol: 'GasEngine', device: '汽油发动机', type: 'DO', spec: 'DC24V', location: '机组', note: '' },
    { addr: 'Q0.1', symbol: 'DieselEngine', device: '柴油发动机', type: 'DO', spec: 'DC24V', location: '机组', note: '' },
    { addr: 'Q0.2', symbol: 'Fan', device: '散热风扇', type: 'DO', spec: 'AC220V', location: '机组', note: 'TOF 10s' },
  ];
  const hardware: HardwareItem[] = [
    { name: '散热风扇', model: '轴流风机', qty: 1, spec: 'AC220V', note: '关断延时10s', required: true },
  ];
  return { io, hardware, stlCode: ENGINE_FAN_STL, ladCode: ENGINE_FAN_LAD, sclCode: ENGINE_FAN_SCL };
}

/** 从 LogicConfig 还原场景类型（仿真用） */
export function homeworkKindFromLogic(logic: LogicConfig): HomeworkKind | null {
  if (logic.hasComparisonLights) return 'comparisonLights';
  if (logic.hasCrossTraffic) return 'crossTraffic';
  if (logic.hasRobotArm) return 'robotArm';
  if (logic.hasEngineFan) return 'engineFan';
  return null;
}

/** 场景 PLC 周期仿真（简化，与桌面逻辑一致的方向） */
export function runHomeworkPlcCycle(
  kind: HomeworkKind,
  state: PLCState,
  dtMs: number,
  getIn: (addr: string) => boolean,
  setOut: (addr: string, val: boolean) => void,
): void {
  switch (kind) {
    case 'comparisonLights':
      runComparisonLights(state, dtMs, getIn, setOut);
      break;
    case 'crossTraffic':
      runCrossTraffic(state, dtMs, getIn, setOut);
      break;
    case 'robotArm':
      runRobotArm(state, dtMs, getIn, setOut);
      break;
    case 'engineFan':
      runEngineFan(state, dtMs, getIn, setOut);
      break;
  }
}

function runComparisonLights(
  state: PLCState,
  dtMs: number,
  getIn: (a: string) => boolean,
  setOut: (a: string, val: boolean) => void,
): void {
  const start = getIn('I0.0');
  const stop = getIn('I0.1');
  if (start) state.memory['M0.0'] = true;
  if (stop) state.memory['M0.0'] = false;
  const run = !!state.memory['M0.0'];
  let sec = (state.registers['MW10'] as number) ?? 0;
  if (run) {
    updateTON(state.timers, 'T_SEC', true, 1000, dtMs);
    if (state.timers['T_SEC']?.q) {
      sec += 1;
      state.timers['T_SEC'] = { pt: 1000, et: 0, q: false };
    }
    if (sec >= 30) sec = 0;
    setOut('Q0.0', sec < 10);
    setOut('Q0.1', sec >= 10 && sec < 20);
    setOut('Q0.2', sec >= 20 && sec < 30);
  } else {
    setOut('Q0.0', false);
    setOut('Q0.1', false);
    setOut('Q0.2', false);
    sec = 0;
    state.timers['T_SEC'] = { pt: 1000, et: 0, q: false };
  }
  state.registers['MW10'] = sec;
}

function runCrossTraffic(
  state: PLCState,
  dtMs: number,
  getIn: (a: string) => boolean,
  setOut: (a: string, val: boolean) => void,
): void {
  const flash = Math.floor(Date.now() / 500) % 2 === 0;
  state.memory['M0.5'] = flash;

  const stop = getIn('I0.1');
  if (stop) {
    state.memory['M0.0'] = false;
    state.memory['M0.1'] = false;
    state.memory['step'] = 0;
    for (const q of ['Q0.0', 'Q0.1', 'Q0.2', 'Q0.3', 'Q0.4', 'Q0.5']) setOut(q, false);
    return;
  }
  if (getIn('I0.0')) {
    state.memory['M0.0'] = true;
    state.memory['M0.1'] = false;
    if (!state.memory['step']) state.memory['step'] = 1;
  }
  if (getIn('I0.2')) {
    state.memory['M0.1'] = true;
    state.memory['M0.0'] = false;
    state.memory['step'] = 0;
    for (const q of ['Q0.0', 'Q0.1', 'Q0.2', 'Q0.3', 'Q0.4', 'Q0.5']) setOut(q, false);
  }
  if (state.memory['M0.1']) {
    for (const q of ['Q0.0', 'Q0.1', 'Q0.2', 'Q0.3', 'Q0.4', 'Q0.5']) setOut(q, false);
    if (getIn('I0.3')) {
      setOut('Q0.0', true);
      setOut('Q0.5', true);
    } else if (getIn('I0.4')) {
      setOut('Q0.2', true);
      setOut('Q0.3', true);
    }
    return;
  }
  if (!state.memory['M0.0']) return;
  let step = (state.memory['step'] as number) || 1;
  const pts = [8000, 3000, 8000, 3000];
  const tKey = `T_STEP${step}`;
  updateTON(state.timers, tKey, true, pts[step - 1] ?? 3000, dtMs);
  for (const q of ['Q0.0', 'Q0.1', 'Q0.2', 'Q0.3', 'Q0.4', 'Q0.5']) setOut(q, false);
  if (step === 1) {
    setOut('Q0.0', true);
    setOut('Q0.5', true);
  } else if (step === 2) {
    setOut('Q0.0', true);
    if (flash) setOut('Q0.4', true);
  } else if (step === 3) {
    setOut('Q0.2', true);
    setOut('Q0.3', true);
  } else if (step === 4) {
    setOut('Q0.3', true);
    if (flash) setOut('Q0.1', true);
  }
  if (state.timers[tKey]?.q) {
    state.timers[tKey] = { pt: pts[step - 1], et: 0, q: false };
    step = step >= 4 ? 1 : step + 1;
    state.memory['step'] = step;
  }
}

function decodeRobotMode(getIn: (a: string) => boolean): number {
  if (getIn('I1.0')) return 1;
  if (getIn('I1.1')) return 2;
  if (getIn('I1.2')) return 3;
  if (getIn('I1.3')) return 4;
  if (getIn('I1.4')) return 5;
  return 1;
}

function runRobotArm(
  state: PLCState,
  dtMs: number,
  getIn: (a: string) => boolean,
  setOut: (a: string, val: boolean) => void,
): void {
  const mode = decodeRobotMode(getIn);
  state.registers['MW12'] = mode;
  const atHome = getIn('I2.0') && getIn('I2.3');
  state.memory['M0.3'] = atHome;

  if (getIn('I0.1')) state.memory['StopReq'] = true;
  for (const q of ['Q0.0', 'Q0.1', 'Q0.2', 'Q0.3', 'Q0.4', 'Q0.5']) setOut(q, false);

  if (state.memory['StopReq']) {
    if (!getIn('I2.0')) setOut('Q0.0', true);
    else if (!getIn('I2.3')) setOut('Q0.2', true);
    else {
      state.memory['StopReq'] = false;
      state.memory['AutoRun'] = false;
      state.memory['step'] = 0;
    }
    return;
  }

  if (mode === 1) {
    state.memory['AutoRun'] = false;
    setOut('Q0.0', getIn('I0.2') && !getIn('I0.3'));
    setOut('Q0.1', getIn('I0.3') && !getIn('I0.2'));
    setOut('Q0.2', getIn('I0.4') && !getIn('I0.5'));
    setOut('Q0.3', getIn('I0.5') && !getIn('I0.4'));
    setOut('Q0.4', getIn('I0.6'));
    setOut('Q0.5', getIn('I0.7'));
    return;
  }

  if (getIn('I0.0') && !state.memory['AutoRun']) {
    if ((mode >= 3 && mode <= 5 && atHome) || (mode === 2 && !atHome)) {
      state.memory['AutoRun'] = true;
      if (!state.memory['step']) state.memory['step'] = 1;
    }
  }

  if (!state.memory['AutoRun']) return;

  if (mode === 2) {
    if (!getIn('I2.0')) setOut('Q0.0', true);
    else if (!getIn('I2.3')) setOut('Q0.2', true);
    else state.memory['AutoRun'] = false;
    return;
  }

  let step = (state.memory['step'] as number) || 1;
  const outs: Record<number, string> = {
    1: 'Q0.1', 2: 'Q0.4', 3: 'Q0.0', 4: 'Q0.3', 5: 'Q0.1', 6: 'Q0.5', 7: 'Q0.0', 8: 'Q0.2',
  };
  if (outs[step]) setOut(outs[step], true);

  const stepDone =
    (step === 1 && getIn('I2.1')) ||
    (step === 2 && (state.timers['T_CLAMP']?.q || false)) ||
    (step === 3 && getIn('I2.0')) ||
    (step === 4 && getIn('I2.4')) ||
    (step === 5 && getIn('I2.2')) ||
    (step === 6 && (state.timers['T_REL']?.q || false)) ||
    (step === 7 && getIn('I2.0')) ||
    (step === 8 && getIn('I2.3'));

  if (step === 2) updateTON(state.timers, 'T_CLAMP', getIn('I0.6') || !!state.outputs['Q0.4'], 1000, dtMs);
  if (step === 6) updateTON(state.timers, 'T_REL', getIn('I0.7') || !!state.outputs['Q0.5'], 1000, dtMs);

  if (stepDone) {
    if (mode === 5 && step === 8) step = 1;
    else if (mode === 4 && step === 8) {
      step = 0;
      state.memory['AutoRun'] = false;
    } else if (mode === 3) {
      step = step < 8 ? step + 1 : 0;
      state.memory['AutoRun'] = false;
    } else if (step < 8) step += 1;
    state.timers['T_CLAMP'] = { pt: 1000, et: 0, q: false };
    state.timers['T_REL'] = { pt: 1000, et: 0, q: false };
  }
  state.memory['step'] = step;
}

function runEngineFan(
  state: PLCState,
  dtMs: number,
  getIn: (a: string) => boolean,
  setOut: (a: string, val: boolean) => void,
): void {
  let gas = !!state.outputs['Q0.0'];
  let diesel = !!state.outputs['Q0.1'];
  if (getIn('I0.0') && !getIn('I0.1')) gas = true;
  if (getIn('I0.1')) gas = false;
  if (getIn('I0.2') && !getIn('I0.3')) diesel = true;
  if (getIn('I0.3')) diesel = false;
  setOut('Q0.0', gas);
  setOut('Q0.1', diesel);
  const engineOn = gas || diesel;
  if (engineOn) {
    setOut('Q0.2', true);
    state.timers['T_FAN'] = { pt: 10000, et: 0, q: false };
  } else {
    const t = state.timers['T_FAN'] || { pt: 10000, et: 0, q: false };
    t.et += dtMs;
    setOut('Q0.2', t.et < t.pt);
    state.timers['T_FAN'] = t;
  }
}
