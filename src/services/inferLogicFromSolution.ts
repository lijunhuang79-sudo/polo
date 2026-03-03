import type { LogicConfig, IOPoint } from '../types';

/**
 * 从 AI 返回的 I/O 表与程序代码中推断应使用的 HMI 预设类型（LogicConfig 子集），
 * 用于在 AI 未返回或未填全 logicConfig 时，仍能正确驱动「设备仿真监控」区块。
 * 不增加任何 token，纯本地规则推断。
 */
export function inferLogicFromSolution(
  io: IOPoint[],
  stlCode?: string,
  sclCode?: string
): Partial<LogicConfig> {
  const code = [stlCode ?? '', sclCode ?? ''].join('\n').toLowerCase();
  const symbols = io.map((p) => (p.symbol ?? '').toLowerCase()).join(' ');
  const devices = io.map((p) => (p.device ?? '').toLowerCase()).join(' ');
  const notes = io.map((p) => (p.note ?? '').toLowerCase()).join(' ');
  const combined = [symbols, devices, notes, code].join(' ');

  // 红绿灯：存在红/黄/绿相关符号或设备，且代码中常有定时/周期
  const hasTrafficLight =
    /\b(red|yel|grn|l_red|l_yel|l_grn|红灯|黄灯|绿灯|交通|信号)\b/i.test(combined) &&
    (/\b(t37|ton|timer|周期|定时|秒)\b/i.test(combined) || /q0\.0|q0\.1|q0\.2/i.test(combined));

  // 电梯：楼层按钮、平层感应、上行/下行接触器
  const hasElevator =
    /\b(btn_1f|btn_2f|btn_3f|sens_1f|sens_2f|sens_3f|km_up|km_down|cmd_door|外呼|平层|上行|下行)\b/i.test(combined) ||
    /\b(req_1|req_2|req_3|m0\.1|m0\.2|m0\.3)\b/i.test(code);

  // 混合罐：液位、搅拌、进/出
  const hasMixingTank =
    /\b(level|液位|混合|搅拌|t_mix|进|出|in|out|fill|drain)\b/i.test(combined) ||
    (/\blevel\b/i.test(combined) && /\b(q0\.0|q0\.1|q0\.2)\b/i.test(combined));

  // 星三角：KM1/KM2/KM3 或 Y/Δ 降压
  const hasStarDelta =
    /\b(km1|km2|km3|km_1|km_2|km_3|星三角|y.*delta|降压)\b/i.test(combined);

  // 计数/流水线
  const hasCounting =
    /\b(ctu|count|counting|计数|流水线|传送带|conveyor|满箱|光电)\b/i.test(combined) ||
    /\b(cv|pv|ct\d+)\b/i.test(code);

  // 车库/卷帘门
  const hasGarageDoor =
    /\b(garage|door|gate|卷帘|车库|升降门|open|close)\b/i.test(combined);

  // 三模式灯具：冷/暖/日光 单开关切换
  const hasMultiModeLighting =
    /\b(l_cold|l_warm|l_day|冷光|暖光|日光)\b/i.test(combined) &&
    (/\blighting_mode|t_light_off\b/i.test(combined) || io.some((p) => /i0\.0|sw/i.test((p.symbol ?? '').toLowerCase())));

  // PID/恒温
  const hasPID =
    /\b(pid|temp|temperature|恒温|加热|heater|setpoint|sp)\b/i.test(combined);

  // 通用逻辑特征（从代码或 I/O 描述推断）
  const hasStartStop = /\b(启停|启动|停止|start|stop|自锁|m0\.0)\b/i.test(combined);
  const hasInterlock =
    /\b(正反转|互锁|interlock|forward|reverse|km_up|km_down)\b/i.test(combined) && !hasElevator;
  const hasDelayOn = /\b(t_delay|延时|delay|ton)\b/i.test(combined) && /\b(启动|start)\b/i.test(combined);
  const hasDoublePressStart =
    /\b(dbl_step|t_dbl|双次|两次启动|第二次)\b/i.test(combined);
  const hasEmergency = /\b(estop|急停|安全|i0\.2|i0\.3)\b/i.test(combined);
  const hasMotor =
    /\b(电机|马达|motor|风扇|fan|km_|接触器)\b/i.test(combined) &&
    !hasStarDelta &&
    !hasElevator &&
    !hasCounting;
  const hasLighting =
    /\b(灯|light|照明)\b/i.test(combined) && !hasTrafficLight && !hasMultiModeLighting;
  const hasPump = /\b(泵|pump|供水|排水)\b/i.test(combined) && !hasMixingTank;
  const hasSequencer = /\b(step|顺序|流程|sequencer)\b/i.test(combined);

  let scenarioType: LogicConfig['scenarioType'] = 'general';
  if (hasTrafficLight) scenarioType = 'traffic';
  else if (hasGarageDoor) scenarioType = 'door';
  else if (hasMixingTank) scenarioType = 'tank';
  else if (hasElevator) scenarioType = 'elevator';
  else if (hasPID) scenarioType = 'pid';
  else if (hasLighting || hasMultiModeLighting) scenarioType = 'lighting';
  else if (hasPump) scenarioType = 'pump';
  else if (hasMotor) scenarioType = 'motor';

  const out: Partial<LogicConfig> = {
    scenarioType,
  };
  if (hasStartStop) out.hasStartStop = true;
  if (hasInterlock) out.hasInterlock = true;
  if (hasDelayOn) out.hasDelayOn = true;
  if (hasDoublePressStart) out.hasDoublePressStart = true;
  if (hasCounting) out.hasCounting = true;
  if (hasTrafficLight) out.hasTrafficLight = true;
  if (hasSequencer) out.hasSequencer = true;
  if (hasEmergency) out.hasEmergency = true;
  if (hasLighting) out.hasLighting = true;
  if (hasMultiModeLighting) out.hasMultiModeLighting = true;
  if (hasMotor) out.hasMotor = true;
  if (hasPump) out.hasPump = true;
  if (hasStarDelta) out.hasStarDelta = true;
  if (hasGarageDoor) out.hasGarageDoor = true;
  if (hasMixingTank) out.hasMixingTank = true;
  if (hasElevator) out.hasElevator = true;
  if (hasPID) out.hasPID = true;

  return out;
}
