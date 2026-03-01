import { PLCState } from '../types';

export type TimerRecord = { pt: number; et: number; q: boolean };

/**
 * TON 通电延时定时器：IN 为 true 时 et 累加，et >= pt 时 q 为 true；IN 为 false 时复位 et 和 q。
 * 直接修改 timers[id]，若不存在则创建。
 */
export function updateTON(
  timers: Record<string, TimerRecord>,
  id: string,
  inVal: boolean,
  ptMs: number,
  dtMs: number
): void {
  let t = timers[id];
  if (!t) {
    t = { pt: ptMs, et: 0, q: false };
    timers[id] = t;
  }
  if (inVal) {
    t.et += dtMs;
    if (t.et >= t.pt) t.q = true;
  } else {
    t.et = 0;
    t.q = false;
  }
}

/**
 * 仅更新电机角度（通用/互锁/星三角等）
 */
export function applyMotorPhysics(state: PLCState, speed: number): void {
  if (speed === 0) return;
  const angle = state.physics['motorAngle'] || 0;
  state.physics['motorAngle'] = (angle + speed) % 360;
}

/**
 * 电梯物理：根据 Q0.0 上行、Q0.1 下行、Q0.2 门控 更新轿厢位置与门位置
 */
export function applyElevatorPhysics(
  state: PLCState,
  outUp: boolean,
  outDown: boolean,
  outDoor: boolean
): void {
  let carPos = state.physics['carPos'] ?? 0;
  let doorPos = state.physics['doorPos'] ?? 0;
  const speed = 0.8;

  if (outUp && carPos < 100) carPos += speed;
  if (outDown && carPos > 0) carPos -= speed;
  if (!outUp && !outDown) {
    if (Math.abs(carPos - 0) < 2) carPos = 0;
    if (Math.abs(carPos - 50) < 2) carPos = 50;
    if (Math.abs(carPos - 100) < 2) carPos = 100;
  }
  carPos = Math.max(0, Math.min(100, carPos));
  state.physics['carPos'] = carPos;

  if (outDoor) {
    if (doorPos < 100) doorPos += 5;
  } else {
    if (doorPos > 0) doorPos -= 5;
  }
  state.physics['doorPos'] = doorPos;
}

/**
 * 车库门物理：Q0.0 开门、Q0.1 关门，更新 doorPos 0~100
 */
export function applyGarageDoorPhysics(
  state: PLCState,
  outOpen: boolean,
  outClose: boolean
): void {
  let pos = state.physics['doorPos'] ?? 0;
  if (outOpen && pos < 100) pos += 1;
  if (outClose && pos > 0) pos -= 1;
  state.physics['doorPos'] = pos;
}

/**
 * 流水线传送带物理：电机开时 boxPos 移动，经过检测区时置 I0.2
 */
export function applyCountingConveyorPhysics(
  state: PLCState,
  motorOn: boolean
): void {
  if (!motorOn) return;
  let pos = state.physics['boxPos'] ?? 0;
  pos += 1;
  if (pos > 110) pos = -10;
  state.physics['boxPos'] = pos;
  state.inputs['I0.2'] = pos >= 45 && pos <= 55;
}
