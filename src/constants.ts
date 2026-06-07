export type ScenarioItem = { title: string; text: string };

/** 典型场景示例（本地生成；免费档 2 项，基础版解锁全部） */
export const SCENARIOS: ScenarioItem[] = [
  { title: "基础: 启保停控制", text: "设计一个电机控制程序，使用启动和停止按钮，具有自锁功能。" },
  { title: "基础: 延时启动", text: "按下启动按钮，延时3秒后电机启动；按下停止按钮，电机立即停止。" },
  { title: "进阶: 双次启动(间隔+超时)", text: "需按下两次启动按钮电机才能运行；第二次按下必须和第一次间隔2秒以上，否则无效；第一次按下后超过10秒若未按第二次则自动重置，下次启动仍需按两次。" },
  { title: "进阶: 星三角启动", text: "大功率电机启动，按下启动后KM1和KM2(Y)吸合，延时5秒后KM2断开，KM3(△)吸合。" },
  { title: "互锁: 电机正反转", text: "控制电机正反转，必须有互锁保护，防止同时吸合，且有停止按钮。" },
  { title: "应用: 交通信号灯", text: "设计一个简单的红绿灯控制，红灯亮5秒，绿灯亮5秒，黄灯亮2秒，循环执行。" },
  { title: "应用: 自动车库门", text: "车库门控制，有开/关/停按钮。门有上限位和下限位开关，运行中遇阻（光电）急停。" },
  { title: "过程: 液体混合罐", text: "按下启动，进水阀A打开，水位到达高液位后停止进水，搅拌机运行5秒，然后排空阀打开。" },
  { title: "计数: 流水线计数", text: "流水线光电传感器检测产品，每满10个停止皮带，需手动复位。" },
  { title: "综合: 电梯控制 (3层)", text: "3层电梯控制。包含1F/2F/3F呼叫按钮，轿厢上下行电机，以及楼层限位开关逻辑。" },
  { title: "高级: 温度PID控制", text: "恒温控制系统。通过温度传感器读取数值，使用PID算法控制加热器输出，保持温度在60度。" },
];

/** 教科书场景示例（博途 S7-1200/1500；需开通 AI 智能生成后解锁） */
export const TEXTBOOK_SCENARIOS: ScenarioItem[] = [
  { title: "场景: 比较指令三组灯", text: "使用比较指令控制三组灯循环：按下启动，第一组绿色灯亮；10秒后第二组蓝色灯亮；20秒后第三组红色灯亮；同一时刻仅一组灯亮；30秒后回到第一组绿色，循环往复。" },
  { title: "场景: 十字路口交通灯", text: "十字路口交通信号灯自动与手动控制。SB1自动、SB2停止全灭、SB3手动、SB4东西直行、SB5南北直行。自动时黄灯0.5秒间隔闪烁。顺序：南北红东西绿8s→南北红东西黄3s→南北绿东西红8s→南北黄东西红3s循环。" },
  { title: "场景: 机械手控制", text: "机械手在A工作台与B工作台之间搬运。选择开关含手动、连续、单周期、单步、回原位。自动顺序：下降→夹紧→上升→右行→下降→放松→上升→左行→回原位。停止后回原点。" },
  { title: "场景: 发动机组风扇", text: "发动机组含汽油发动机与柴油发动机，各设启动停止按钮。汽油或柴油机启动时散热风扇打开；均停止时风扇延时10秒关闭（TOF关断延时）。" },
];

/** 全部场景（标题解析等用） */
export const ALL_SCENARIOS: ScenarioItem[] = [...SCENARIOS, ...TEXTBOOK_SCENARIOS];

export function isTextbookScenarioText(text: string): boolean {
  const t = text.trim();
  return TEXTBOOK_SCENARIOS.some((s) => s.text.trim() === t);
}

export function isTextbookScenarioTitle(title: string): boolean {
  return TEXTBOOK_SCENARIOS.some((s) => s.title === title);
}
