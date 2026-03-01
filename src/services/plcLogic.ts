import { LogicConfig, GeneratedSolution, IOPoint, HardwareItem, PLCState } from '../types';
import { updateTON, applyMotorPhysics, applyElevatorPhysics, applyGarageDoorPhysics, applyCountingConveyorPhysics } from './simKernel';

// --- Analysis Logic ---
export const detectLogic = (scenario: string): LogicConfig => {
  const text = scenario.toLowerCase();
  
  const hasStartStop = /启.*停|自锁|保停|启保停|保持.*停止|点动|启动.*停止|启停/i.test(text);
  const hasInterlock = /正反转|正转.*反转|互锁|forward.*reverse|双向|来回/i.test(text);
  const hasDelayOn = /延时.*启动|启动.*延时|通电延时|延时\s*\d+\s*秒|\d+\s*秒.*后.*启动/i.test(text);
  const hasDoublePressStart = /按两次|两次启动|二次按下|双次启动|第二次按下|需按两次|间隔\s*\d+\s*秒|超过\s*\d+\s*秒.*重置|否则无效|两次.*间隔|间隔.*否则无效/i.test(text);
  const hasCounting = /计数|流水线|每.*件|满.*箱|count|ctu|conveyor/i.test(text);
  const hasTrafficLight = /红绿灯|交通灯|信号灯|traffic/i.test(text);
  const hasSequencer = /顺序|流程|step|循环/i.test(text);
  const hasEmergency = /急停|安全|e-stop|遇阻/i.test(text);
  
  const hasStarDelta = /星三角|y.*delta|降压启动|(km1.*km2.*km3)|(km2.*km3)/i.test(text);
  const hasGarageDoor = /车库|卷帘门|door|gate|升降/i.test(text);
  const hasMixingTank = /混合|搅拌|液位|水箱|tank|mix/i.test(text);
  const hasElevator = /电梯|lift|elevator|楼层/i.test(text);
  const hasPID = /pid|恒温|温度控制|temperature|heating/i.test(text);

  const hasLighting = /灯具|灯泡|led|照明|灯光/i.test(text) && !hasTrafficLight;
  const hasMultiModeLighting =
    hasLighting &&
    /(三种灯光模式|三种模式|3种模式|冷光|暖光|日光)/i.test(text) &&
    /(一个开关|同一个开关|单个开关)/i.test(text) &&
    /3\\s*秒.*(再次|重新).*按下|关闭.*3\\s*秒.*(再次|重新).*打开/i.test(text);
  const hasPump = /泵|抽水|供水|排水/i.test(text) && !hasMixingTank;
  const hasMotor = /电机|马达|驱动|伺服|风扇|传送带/i.test(text) && !hasStarDelta && !hasGarageDoor && !hasCounting && !hasElevator;

  let scenarioType: LogicConfig['scenarioType'] = 'general';
  if (hasTrafficLight) scenarioType = 'traffic';
  else if (hasGarageDoor) scenarioType = 'door';
  else if (hasMixingTank) scenarioType = 'tank';
  else if (hasElevator) scenarioType = 'elevator';
  else if (hasPID) scenarioType = 'pid';
  else if (hasLighting) scenarioType = 'lighting';
  else if (hasPump) scenarioType = 'pump';
  else if (hasMotor) scenarioType = 'motor';

  return {
    hasStartStop, hasInterlock, hasDelayOn, hasDoublePressStart, hasCounting,
    hasTrafficLight, hasSequencer, hasEmergency,
    hasLighting, hasMotor, hasPump,
    hasStarDelta, hasGarageDoor, hasMixingTank, hasElevator, hasPID,
    scenarioType,
    hasMultiModeLighting,
  };
};

export const generateSolution = (logic: LogicConfig, scenarioText: string): GeneratedSolution => {
  const io: IOPoint[] = [];
  const hardware: HardwareItem[] = [];
  let stl = "";
  let lad = "";
  let scl = "";

  // 1. Initialize Standard Electrical BOM (Cabinet essentials)
  hardware.push({ name: 'PLC CPU 主机', model: 'CPU 224XP (或同级 S7-1200)', qty: 1, spec: 'DC/DC/DC, 14DI/10DO', note: '核心控制器', required: true });
  hardware.push({ name: '开关电源', model: 'LRS-50-24', qty: 1, spec: 'In: 220VAC, Out: 24VDC 2.2A', note: 'PLC及传感器供电', required: true });
  hardware.push({ name: '微型断路器 (MCB)', model: 'DZ47-63 1P+N C6', qty: 1, spec: '6A', note: '总电源保护', required: true });
  hardware.push({ name: '接线端子排', model: 'UK-2.5B', qty: 20, spec: '2.5mm²', note: 'IO接线', required: false });
  hardware.push({ name: 'DIN导轨', model: 'TH35-7.5', qty: 1, spec: '35mm 铝合金', note: '元器件安装', required: false });
  hardware.push({ name: '线槽及导线', model: 'PVC 40x40', qty: 1, spec: 'BVR 0.75mm²/1.5mm²', note: '辅材', required: false });

  // --- Logic Generation based on Scenarios ---

  if (logic.hasElevator) {
      // --- 9. Elevator Control ---
      io.push({ addr: 'I0.0', symbol: 'BTN_1F', device: '1楼外呼按钮', type: 'DI', spec: 'NO (常开)', location: '1F 厅门', note: '用户请求', isMomentary: true });
      io.push({ addr: 'I0.1', symbol: 'BTN_2F', device: '2楼外呼按钮', type: 'DI', spec: 'NO (常开)', location: '2F 厅门', note: '用户请求', isMomentary: true });
      io.push({ addr: 'I0.2', symbol: 'BTN_3F', device: '3楼外呼按钮', type: 'DI', spec: 'NO (常开)', location: '3F 厅门', note: '用户请求', isMomentary: true });
      io.push({ addr: 'I0.3', symbol: 'SENS_1F', device: '1楼平层感应', type: 'DI', spec: 'NO (磁开关)', location: '井道 1F', note: '位置反馈', isMomentary: false });
      io.push({ addr: 'I0.4', symbol: 'SENS_2F', device: '2楼平层感应', type: 'DI', spec: 'NO (磁开关)', location: '井道 2F', note: '位置反馈', isMomentary: false });
      io.push({ addr: 'I0.5', symbol: 'SENS_3F', device: '3楼平层感应', type: 'DI', spec: 'NO (磁开关)', location: '井道 3F', note: '位置反馈', isMomentary: false });

      io.push({ addr: 'Q0.0', symbol: 'KM_UP', device: '上行接触器', type: 'DO', spec: '220V 线圈', location: '控制柜', note: '电机正转' });
      io.push({ addr: 'Q0.1', symbol: 'KM_DOWN', device: '下行接触器', type: 'DO', spec: '220V 线圈', location: '控制柜', note: '电机反转' });
      io.push({ addr: 'Q0.2', symbol: 'CMD_DOOR', device: '自动门开闭', type: 'DO', spec: '24V 信号', location: '轿顶', note: '开门使能' });

      hardware.push({ name: '曳引电机', model: 'PM-100', qty: 1, spec: '3.5kW, 380V', note: '主驱动', required: true });
      hardware.push({ name: '平层感应器', model: 'M-Sens', qty: 3, spec: 'NPN/NO', note: '井道位置检测', required: true });
      hardware.push({ name: '交流接触器', model: 'LC1-D18', qty: 2, spec: '18A, AC220V Coil', note: '电机正反转', required: true });

      stl += `TITLE 3层简易电梯控制逻辑
// 网络1: 1楼呼叫信号保持
LD     I0.0          // 按下1楼呼叫
O      M0.1          // 或已经保持
AN     I0.3          // 且未到达1楼
=      M0.1          // 锁存请求标志

// 网络2: 2楼呼叫信号保持
LD     I0.1
O      M0.2
AN     I0.4
=      M0.2

// 网络3: 3楼呼叫信号保持
LD     I0.2
O      M0.3
AN     I0.5
=      M0.3

// 网络4: 上行控制 (KM_UP)
// 逻辑: 有高层请求 且 (当前在底层 或 轿厢位置<目标)
LD     M0.3          // 请求3楼
O      M0.2          // 或请求2楼
A      I0.3          // 且在1楼
O      M0.3          // 或请求3楼
A      I0.4          // 且在2楼
AN     Q0.1          // 互锁: 不在下行
AN     Q0.2          // 互锁: 门已关
=      Q0.0          // 输出上行

// 网络5: 下行控制 (KM_DOWN)
// 逻辑: 有低层请求
LD     M0.1          // 请求1楼
O      M0.2          // 或请求2楼
A      I0.5          // 且在3楼
O      M0.1          // 或请求1楼
A      I0.4          // 且在2楼
AN     Q0.0          // 互锁: 不在上行
AN     Q0.2          // 互锁: 门已关
=      Q0.1          // 输出下行`;

      lad += `// Network 1: Floor 1 Request Memory (Set/Reset)
      BTN_1F(I0.0)    SENS_1F(I0.3)   REQ_1F(M0.1)
|-------| |-----+-------|/|-------------( )-------|
                |
      REQ_1F    |
|-------| |-----+

// Network 2: Floor 2 Request Memory
      BTN_2F(I0.1)    SENS_2F(I0.4)   REQ_2F(M0.2)
|-------| |-----+-------|/|-------------( )-------|
                |
      REQ_2F    |
|-------| |-----+

// Network 3: Floor 3 Request Memory
      BTN_3F(I0.2)    SENS_3F(I0.5)   REQ_3F(M0.3)
|-------| |-----+-------|/|-------------( )-------|
                |
      REQ_3F    |
|-------| |-----+

// Network 4: Motor UP Control
// Logic: (Call 3F OR Call 2F) AND Not Down AND Door Closed
      REQ_3F(M0.3)                    KM_DN(Q0.1)     DOOR(Q0.2)      KM_UP(Q0.0)
|-------| |-------+-----------------------|/|-------------|/|------------( )-------|
      REQ_2F(M0.2)|
|-------| |-------+

// Network 5: Motor DOWN Control
// Logic: (Call 1F OR Call 2F) AND Not Up AND Door Closed
      REQ_1F(M0.1)                    KM_UP(Q0.0)     DOOR(Q0.2)      KM_DN(Q0.1)
|-------| |-------+-----------------------|/|-------------|/|------------( )-------|
      REQ_2F(M0.2)|
|-------| |-------+`;

      scl += `REGION Request_Latches
    // Floor Request Logic (Set on Button, Reset on Arrival)
    "Req_1F" := "BTN_1F" OR ("Req_1F" AND NOT "SENS_1F");
    "Req_2F" := "BTN_2F" OR ("Req_2F" AND NOT "SENS_2F");
    "Req_3F" := "BTN_3F" OR ("Req_3F" AND NOT "SENS_3F");
END_REGION

REGION Directional_Control
    // Determine target direction based on requests and current position
    // Up Command: Target Floor > Current Floor
    "Cmd_Up" := ("Req_3F" AND NOT "SENS_3F") OR 
                ("Req_2F" AND "SENS_1F");

    // Down Command: Target Floor < Current Floor
    "Cmd_Down" := ("Req_1F" AND NOT "SENS_1F") OR 
                  ("Req_2F" AND "SENS_3F");
END_REGION

REGION Motor_Outputs
    // Drive Motors with Electrical Interlock
    "KM_UP"   := "Cmd_Up" AND NOT "Cmd_Down" AND NOT "KM_DOWN" AND NOT "CMD_DOOR";
    "KM_DOWN" := "Cmd_Down" AND NOT "Cmd_Up" AND NOT "KM_UP" AND NOT "CMD_DOOR";
END_REGION`;
  }
  else if (logic.hasPID) {
      // --- 10. PID Control ---
      io.push({ addr: 'I0.0', symbol: 'SW_ON', device: '系统启动开关', type: 'DI', spec: 'NO (常开)', location: '控制面板', note: '使能(可锁)', isMomentary: true });
      io.push({ addr: 'AIW0', symbol: 'TEMP_PV', device: '温度传感器', type: 'AI', spec: 'PT100/4-20mA', location: '加热槽', note: '0-100℃', value: 25 });
      io.push({ addr: 'Q0.0', symbol: 'SSR_HEAT', device: '固态继电器', type: 'DO', spec: 'PWM / DC24V', location: '加热棒', note: 'PWM控制' });
      io.push({ addr: 'Q0.1', symbol: 'FAN_COOL', device: '冷却风扇', type: 'DO', spec: 'DC24V', location: '箱体', note: '超温保护' });

      hardware.push({ name: '温度变送器', model: 'SBWZ-PT100', qty: 1, spec: 'In: PT100, Out: 4-20mA', note: '模拟量输入', required: true });
      hardware.push({ name: '固态继电器 (SSR)', model: 'SSR-40DA', qty: 1, spec: 'Input: 3-32VDC, Load: 220VAC', note: '高频开关', required: true });
      hardware.push({ name: '加热管', model: 'Single Head', qty: 1, spec: '500W', note: '负载', required: true });

      stl += `TITLE PID 温度控制 (S7-200 指令集)
// 网络1: PID 初始化与使能
LD     I0.0          // 启动开关
EU                   // 上升沿
CALL   SBR_PID_INIT  // 调用PID初始化子程序(设置P/I/D参数)

// 网络2: 自动运行标志
LD     I0.0
=      M0.0          // Auto Mode

// 网络3: PID 回路计算
// 假设回路表起始地址 VB100
// VD104: 过程变量(PV) - 映射自 AIW0
// VD108: 设定值(SP) - 固定 60.0
// VD112: 输出值(Mn) - 0.0-1.0
LD     M0.0
ITD    AIW0, AC0     // AI转换
DTR    AC0, AC0      // 整数转实数
MOVR   AC0, VD104    // 存入PV
PID    VB100, 0      // 执行PID回路0

// 网络4: PWM 生成 (软件PWM)
// 将PID输出 (0.0-1.0) 转换为占空比
LD     M0.0
MOVR   VD112, AC1    // 取PID输出
*R     1000.0, AC1   // 乘周期 1000ms
ROUND  AC1, AC1      // 转为整数ms
LD     M0.0
AB>=   AC1, T32      // 如果 计算值 >= 计时器值
=      Q0.0          // 输出加热

// 网络5: PWM 周期计时器
LD     M0.0
TON    T32, 1000     // 1.0s 周期`;

      lad += `// Network 1: PID Enable
      SW_ON(I0.0)                                     Auto_Mode(M0.0)
|-------| |-------------------------------------------------( )-------|

// Network 2: PID Calculation Block
      Auto_Mode                                       +-------------+
|-------| |-------------------------------------------| PID_Control |-|
                                          TEMP_PV ----| PV          |
                                         60.0_deg ----| SP          |
                                                      |             |
                                          PID_OUT ----| OUT         |
                                                      +-------------+

// Network 3: PWM Output Generation (Software PWM)
// Logic: If PID Output > Timer Value -> Output ON
      Auto_Mode(M0.0)       +-------------+           SSR_HEAT(Q0.0)
|-------| |-----------------| COMPARE     |-----------------( )-------|
                            | PID_OUT >   |
                            | Timer.ET    |
                            +-------------+`;

      scl += `REGION PID_Algorithm
    // Simple PI Controller Implementation
    IF "SW_ON" THEN
        // 1. Calculate Error (SP - PV)
        #Error := 60.0 - "TEMP_PV"; // Setpoint = 60.0C
        
        // 2. Proportional Term
        #P_Term := 2.0 * #Error; // Kp = 2.0
        
        // 3. Integral Term (Accumulate Error)
        #I_Term := #I_Term + (0.05 * #Error * 0.1); // Ki * Error * dt
        
        // 4. Calculate Output & Saturation
        #PID_Out := #P_Term + #I_Term;
        IF #PID_Out > 1.0 THEN #PID_Out := 1.0; END_IF;
        IF #PID_Out < 0.0 THEN #PID_Out := 0.0; END_IF;
    ELSE
        #PID_Out := 0.0;
        #I_Term := 0.0;
    END_IF;
END_REGION

REGION PWM_Generator
    // Time-Proportioning Logic (1.0s Cycle)
    "T_PWM".TON(IN := NOT "T_PWM".Q, PT := T#1s);
    
    // Output ON if Timer < Duty Cycle
    "SSR_HEAT" := "SW_ON" AND ("T_PWM".ET < REAL_TO_TIME(#PID_Out * 1000.0));
    "FAN_COOL" := "TEMP_PV" > 90.0; // Overheat Safety
END_REGION`;
  }
  else if (logic.hasStarDelta) {
      // --- 3. Star-Delta Start ---
      io.push({ addr: 'I0.0', symbol: 'START', device: '启动按钮 (SB1)', type: 'DI', spec: 'NO (绿色)', location: '柜门', note: '点动', isMomentary: true });
      io.push({ addr: 'I0.1', symbol: 'STOP', device: '停止按钮 (SB2)', type: 'DI', spec: 'NC (红色)', location: '柜门', note: '点动', isMomentary: true });
      
      io.push({ addr: 'Q0.0', symbol: 'KM1', device: '主接触器', type: 'DO', spec: 'AC220V Coil', location: '安装板', note: '电源接入' });
      io.push({ addr: 'Q0.1', symbol: 'KM2', device: '星型接触器 (Y)', type: 'DO', spec: 'AC220V Coil', location: '安装板', note: '短接绕组' });
      io.push({ addr: 'Q0.2', symbol: 'KM3', device: '角型接触器 (△)', type: 'DO', spec: 'AC220V Coil', location: '安装板', note: '运行绕组' });

      hardware.push({ name: '交流接触器', model: 'LC1-D32', qty: 3, spec: '32A, AC220V线圈', note: 'KM1/KM2/KM3', required: true });
      hardware.push({ name: '热过载继电器', model: 'LRD-32', qty: 1, spec: '23-32A', note: '电机过载保护', required: true });
      hardware.push({ name: '时间继电器 (可选)', model: 'DH48S-S', qty: 1, spec: '0-10s', note: '若PLC控制则无需', required: false });
      hardware.push({ name: '三相异步电机', model: 'Y-132M-4', qty: 1, spec: '7.5kW', note: '被控对象', required: true });

      stl += `TITLE 星三角降压启动控制
// 网络1: 主接触器 KM1 (Q0.0) 启动与自锁
LD     I0.0          // 启动按钮
O      Q0.0          // KM1 自锁
AN     I0.1          // 停止按钮 (NC)
=      Q0.0          // 输出主接触器

// 网络2: 星三角切换定时器 (T37)
LD     Q0.0          // 主接触器吸合后
TON    T37, 50       // 延时 50 * 100ms = 5.0秒

// 网络3: 星型接触器 KM2 (Q0.1)
LD     Q0.0          // 主接触器吸合
AN     T37           // 且 定时时间未到
AN     Q0.2          // 且 角接触器未吸合 (互锁)
=      Q0.1          // 输出星型

// 网络4: 角型接触器 KM3 (Q0.2)
LD     Q0.0          // 主接触器吸合
A      T37           // 且 定时时间已到
AN     Q0.1          // 且 星接触器未吸合 (互锁)
=      Q0.2          // 输出角型`;

      lad += `// Network 1: Main Contactor (KM1) Control
      START(I0.0)     STOP(I0.1)                      KM1(Q0.0)
|-------| |-------+-------|/|---------------------------( )-------|
                  |
      KM1(Q0.0)   |
|-------| |-------+

// Network 2: Star-Delta Timer (T_SD)
      KM1(Q0.0)                                       T37(TON)
|-------| |-------------------------------------------[ 5.0s  ]---|

// Network 3: Star Contactor (KM2)
// Logic: Main Active AND Timer Not Done AND Delta Inactive (Interlock)
      KM1(Q0.0)       T37.Q           KM3(Q0.2)       KM2(Q0.1)
|-------| |-----------|/|-------------|/|---------------( )-------|

// Network 4: Delta Contactor (KM3)
// Logic: Main Active AND Timer Done AND Star Inactive (Interlock)
      KM1(Q0.0)       T37.Q           KM2(Q0.1)       KM3(Q0.2)
|-------| |-----------| |-------------|/|---------------( )-------|`;

      scl += `REGION Main_Control
    // Main Contactor KM1 (Self-Holding)
    "KM1" := ("START" OR "KM1") AND NOT "STOP";
    
    // Transition Timer (Star to Delta)
    "T_SD".TON(IN := "KM1", PT := T#5s);
END_REGION

REGION Contactor_Outputs
    // Star Contactor (KM2)
    // Active during startup (Timer NOT Done) AND Delta is OFF
    "KM2" := "KM1" AND NOT "T_SD".Q AND NOT "KM3";

    // Delta Contactor (KM3)
    // Active after startup (Timer Done) AND Star is OFF
    "KM3" := "KM1" AND "T_SD".Q AND NOT "KM2";
END_REGION`;
  }
  else if (logic.hasMixingTank) {
      // --- 7. Mixing Tank ---
      io.push({ addr: 'I0.0', symbol: 'START', device: '启动按钮', type: 'DI', spec: 'NO', location: '面板', note: '流程开始', isMomentary: true });
      io.push({ addr: 'I0.1', symbol: 'STOP', device: '停止按钮', type: 'DI', spec: 'NC', location: '面板', note: '流程复位', isMomentary: true });
      io.push({ addr: 'I0.2', symbol: 'S_HIGH', device: '高液位开关', type: 'DI', spec: 'NO (浮球)', location: '罐体顶部', note: '满液信号', isMomentary: false });
      io.push({ addr: 'I0.3', symbol: 'S_LOW', device: '低液位开关', type: 'DI', spec: 'NO (浮球)', location: '罐体底部', note: '空液信号', isMomentary: false });
      
      io.push({ addr: 'Q0.0', symbol: 'V_IN', device: '进水电磁阀', type: 'DO', spec: 'DC24V', location: '进水管', note: '加液' });
      io.push({ addr: 'Q0.1', symbol: 'M_MIX', device: '搅拌电机', type: 'DO', spec: 'AC380V', location: '罐体中心', note: '混合' });
      io.push({ addr: 'Q0.2', symbol: 'V_OUT', device: '出水电磁阀', type: 'DO', spec: 'DC24V', location: '出水管', note: '排空' });

      hardware.push({ name: '浮球液位开关', model: 'UQK-71', qty: 2, spec: '304不锈钢', note: 'High/Low监测', required: true });
      hardware.push({ name: '电磁阀', model: '2W-160-15', qty: 2, spec: 'DN15, DC24V', note: '水路控制', required: true });
      hardware.push({ name: '中间继电器', model: 'MY2N-J', qty: 2, spec: 'DC24V 线圈', note: '驱动电磁阀', required: true });

      stl += `TITLE 混合罐顺序控制 (SCR 顺控指令)
// 网络1: 初始步 S0.0
LD     I0.0          // 按下启动
S      S0.1, 1       // 激活第一步
R      S0.0, 1       // 复位初始步

// 网络2: 停止逻辑 (全局复位)
LD     I0.1
R      S0.0, 4       // 复位所有状态
S      S0.0, 1       // 回到初始

// 网络3: 步1 - 加水 (S0.1)
LSCR   S0.1
LD     SM0.0         // 总是接通
=      Q0.0          // 打开进水阀 V_IN
LD     I0.2          // 高液位到达
SCRT   S0.2          // 转移到步2
SCRE

// 网络4: 步2 - 搅拌 (S0.2)
LSCR   S0.2
LD     SM0.0
=      Q0.1          // 启动电机 M_MIX
TON    T37, 50       // 搅拌 5秒
LD     T37
SCRT   S0.3          // 时间到，转移步3
SCRE

// 网络5: 步3 - 排水 (S0.3)
LSCR   S0.3
LD     SM0.0
=      Q0.2          // 打开排阀 V_OUT
LD     I0.3          // 低液位检测
SCRT   S0.0          // 转移回初始步
SCRE`;

      lad += `// Network 1: Start Process -> State 1 (Filling)
      START(I0.0)     STOP(I0.1)                      STATE_1(S)
|-------| |-------+-------|/|---------------------------( S )-------|

// Network 2: State 1 (Filling) Control
      STATE_1(M0.0)                                   V_IN(Q0.0)
|-------| |---------------------------------------------( )-------|

// Network 3: State Transition 1->2 (Full Level -> Mixing)
      STATE_1         S_HIGH(I0.2)    STATE_2(S)      STATE_1(R)
|-------| |-----------| |-------+-------( S )-----------( R )-------|

// Network 4: State 2 (Mixing) Control & Timer
      STATE_2(M0.1)                                   M_MIX(Q0.1)
|-------| |-----------+---------------------------------( )-------|
                      |                               T_MIX(TON)
                      +-------------------------------[ 5.0s  ]---|

// Network 5: State Transition 2->3 (Timer Done -> Draining)
      STATE_2         T_MIX.Q         STATE_3(S)      STATE_2(R)
|-------| |-----------| |-------+-------( S )-----------( R )-------|

// Network 6: State 3 (Draining) until Empty
      STATE_3         S_LOW(I0.3)     STATE_3(R)      V_OUT(Q0.2)
|-------| |-------+---|/|-------+-------( R )-----------( )-------|`;

      scl += `REGION Process_Reset
    // Global Stop/Reset
    IF "STOP" THEN
        "Step" := 0;
        "V_IN" := FALSE; "M_MIX" := FALSE; "V_OUT" := FALSE;
        RETURN;
    END_IF;
END_REGION

REGION Sequence_Control
    CASE "Step" OF
        0:  // IDLE: Wait for Start
            IF "START" THEN "Step" := 10; END_IF;
            
        10: // FILLING: Open Inlet Valve
            "V_IN" := TRUE;
            IF "S_HIGH" THEN 
                "V_IN" := FALSE; 
                "Step" := 20; 
            END_IF;
            
        20: // MIXING: Run Mixer for 5s
            "M_MIX" := TRUE;
            "T_Mix".TON(IN := TRUE, PT := T#5s);
            IF "T_Mix".Q THEN
                "M_MIX" := FALSE;
                "T_Mix".RESET();
                "Step" := 30;
            END_IF;
            
        30: // DRAINING: Open Outlet Valve
            "V_OUT" := TRUE;
            IF "S_LOW" THEN
                "V_OUT" := FALSE;
                "Step" := 0;
            END_IF;
    END_CASE;
END_REGION`;
  }
  else if (logic.hasTrafficLight) {
     // --- 5. Traffic Light ---
     io.push({ addr: 'I0.0', symbol: 'SW_START', device: '系统启动开关', type: 'DI', spec: 'NO', location: '电箱', note: '点动/锁定', isMomentary: true });
     io.push({ addr: 'I0.1', symbol: 'SW_STOP', device: '系统停止开关', type: 'DI', spec: 'NC', location: '电箱', note: '点动/锁定', isMomentary: true });
     
     io.push({ addr: 'Q0.0', symbol: 'RED', device: '交通灯(红)', type: 'DO', spec: 'DC24V LED', location: '灯柱', note: '停止' });
     io.push({ addr: 'Q0.1', symbol: 'YEL', device: '交通灯(黄)', type: 'DO', spec: 'DC24V LED', location: '灯柱', note: '警示' });
     io.push({ addr: 'Q0.2', symbol: 'GRN', device: '交通灯(绿)', type: 'DO', spec: 'DC24V LED', location: '灯柱', note: '通行' });

     hardware.push({ name: '交通信号灯组', model: 'RYG-100', qty: 1, spec: 'DC24V, 100mm', note: '红黄绿三色', required: true });

     stl += `TITLE 交通灯时序控制 (12秒周期)
// 网络1: 系统启停保持
LD     I0.0          // 启动
O      M0.0          // 自锁
AN     I0.1          // 停止
=      M0.0          // 运行标志

// 网络2: 周期定时器 (12.0s)
LD     M0.0
AN     T37           // 循环自复位
TON    T37, 120      // 120 * 100ms

// 网络3: 红灯控制 (0s - 5s)
// 逻辑: T37 < 50
LD     M0.0
AW<    T37, 50       // 整数比较 Word Less Than
=      Q0.0

// 网络4: 绿灯控制 (5s - 10s)
// 逻辑: 50 <= T37 < 100
LD     M0.0
AW>=   T37, 50       // 大于等于 5.0s
AW<    T37, 100      // 且 小于 10.0s
=      Q0.2

// 网络5: 黄灯控制 (10s - 12s)
// 逻辑: T37 >= 100
LD     M0.0
AW>=   T37, 100      // 大于等于 10.0s
=      Q0.1`;

     lad += `// Network 1: System Run Flag & Timer
      START           STOP            RUN_FLAG(M0.0)  T_CYCLE(TON)
|-------| |-------+-------|/|-------+-------( )-------+-[ 12.0s ]---|
                  |                 |
      RUN_FLAG    |                 |
|-------| |-------+                 |
                                    |
      T_CYCLE.Q                     |
|-------| |-------------------------| (Reset)

// Network 2: RED Light Control (0 - 5.0s)
      RUN_FLAG        +----------+                    RED(Q0.0)
|-------| |-----------| CMP      |----------------------( )-------|
                      | T < 5.0s |
                      +----------+

// Network 3: GREEN Light Control (5.0s - 10.0s)
      RUN_FLAG        +----------+                    GRN(Q0.2)
|-------| |-----------| CMP      |----------------------( )-------|
                      | 5s<=T<10s|
                      +----------+

// Network 4: YELLOW Light Control (> 10.0s)
      RUN_FLAG        +----------+                    YEL(Q0.1)
|-------| |-----------| CMP      |----------------------( )-------|
                      | T >= 10s |
                      +----------+`;

     scl += `REGION System_Status
    // Master System Run Flag
    "System_On" := ("SW_START" OR "System_On") AND NOT "SW_STOP";
    
    // Cycle Timer (Free Running Loop)
    "T_Cycle".TON(IN := "System_On", PT := T#12s);
    IF "T_Cycle".Q THEN "T_Cycle".RESET(); END_IF;
END_REGION

REGION Light_Sequence
    IF "System_On" THEN
        // Phase 1: Red (0 - 5s)
        IF "T_Cycle".ET < T#5s THEN
            "RED" := TRUE; "GRN" := FALSE; "YEL" := FALSE;
            
        // Phase 2: Green (5 - 10s)
        ELSIF "T_Cycle".ET < T#10s THEN
            "RED" := FALSE; "GRN" := TRUE; "YEL" := FALSE;
            
        // Phase 3: Yellow (10 - 12s)
        ELSE
            "RED" := FALSE; "GRN" := FALSE; "YEL" := TRUE;
        END_IF;
    ELSE
        // All Off when Stopped
        "RED" := FALSE; "GRN" := FALSE; "YEL" := FALSE;
    END_IF;
END_REGION`;
  }
  else if (logic.hasCounting) {
     // --- 8. Counting Conveyor ---
     io.push({ addr: 'I0.0', symbol: 'START', device: '启动按钮', type: 'DI', spec: 'NO', location: '面板', note: '启动皮带', isMomentary: true });
     io.push({ addr: 'I0.1', symbol: 'STOP', device: '停止按钮', type: 'DI', spec: 'NC', location: '面板', note: '停止皮带', isMomentary: true });
     io.push({ addr: 'I0.2', symbol: 'SENSOR', device: '光电开关', type: 'DI', spec: 'PNP/NO', location: '皮带中段', note: '计数输入', isMomentary: false });
     io.push({ addr: 'I0.3', symbol: 'RESET', device: '复位按钮', type: 'DI', spec: 'NO', location: '面板', note: '清零', isMomentary: true });

     io.push({ addr: 'Q0.0', symbol: 'M_BELT', device: '皮带电机', type: 'DO', spec: 'DC24V', location: '流水线', note: '运行' });
     io.push({ addr: 'Q0.1', symbol: 'L_FULL', device: '满载指示灯', type: 'DO', spec: 'DC24V LED', location: '面板', note: '完成信号' });

     hardware.push({ name: '漫反射光电', model: 'E3Z-D61', qty: 1, spec: 'NPN, 10-30V', note: '物体检测', required: true });
     hardware.push({ name: '直流电机', model: 'DC-Gear', qty: 1, spec: '24V, 60RPM', note: '传送带驱动', required: true });

     stl += `TITLE 流水线计数控制
// 网络1: 皮带电机启停
// 逻辑: 启动 OR 运行中 且 非停止 且 未满载(C1=0)
LD     I0.0          // Start
O      Q0.0          // Self-lock
AN     I0.1          // Stop
AN     C1            // Counter Done bit
=      Q0.0          // Motor Run

// 网络2: 计数器 C1
// 传感器上升沿触发计数，设定值 PV=10
LD     I0.2          // Sensor Input
LD     I0.3          // Reset Button
CTU    C1, 10        // Count Up

// 网络3: 满载指示输出
LD     C1            // C1 Done (Current >= PV)
=      Q0.1          // Full Lamp`;

     lad += `// Network 1: Belt Motor Control
// Stop if STOP pressed OR Count Done (C1)
      START(I0.0)     STOP(I0.1)      C1.Done         M_BELT(Q0.0)
|-------| |-------+-------|/|-------------|/|-----------( )-------|
                  |
      M_BELT      |
|-------| |-------+

// Network 2: Product Counter (CTU)
      SENSOR(I0.2)                                    C1(CTU)
|-------| |-------------------------------------------[ PV: 10 ]--|
                                                      |           |
      RESET(I0.3)                                     |           |
|-------| |-------------------------------------------[ R        ]--|

// Network 3: Full Load Indicator
      C1.Done                                         L_FULL(Q0.1)
|-------| |---------------------------------------------( )-------|`;

     scl += `REGION Motor_Control
    // Belt Motor Logic
    // Run if: (Start OR Self-Latch) AND Not Stop AND Not Full
    "M_BELT" := ("START" OR "M_BELT") 
                AND NOT "STOP" 
                AND NOT "L_FULL";
END_REGION

REGION Counter_Block
    // Product Counter
    "C_Product".CTU(
        CU := "SENSOR", // Count on Rising Edge
        R  := "RESET",  // Manual Reset
        PV := 10        // Target
    );
    
    // Full Indication
    "L_FULL" := "C_Product".Q;
END_REGION`;
  }
  else if (logic.hasLighting && logic.hasMultiModeLighting) {
      // --- 三模式灯具：三档开关 I0.0/I0.1/I0.2 直驱 Q0.0/Q0.1/Q0.2（拨档选冷/暖/日光）---
      io.push({ addr: 'I0.0', symbol: 'SW_COLD', device: '冷光档', type: 'DI', spec: '三档开关档位1', location: '墙面', note: '拨到冷光', isMomentary: false });
      io.push({ addr: 'I0.1', symbol: 'SW_WARM', device: '暖光档', type: 'DI', spec: '三档开关档位2', location: '墙面', note: '拨到暖光', isMomentary: false });
      io.push({ addr: 'I0.2', symbol: 'SW_DAY', device: '日光档', type: 'DI', spec: '三档开关档位3', location: '墙面', note: '拨到日光', isMomentary: false });
      io.push({ addr: 'Q0.0', symbol: 'L_COLD', device: '冷光灯', type: 'DO', spec: 'LED 10W 6500K', location: '天花板', note: '冷光' });
      io.push({ addr: 'Q0.1', symbol: 'L_WARM', device: '暖光灯', type: 'DO', spec: 'LED 10W 3000K', location: '天花板', note: '暖光' });
      io.push({ addr: 'Q0.2', symbol: 'L_DAY', device: '日光灯', type: 'DO', spec: 'LED 10W 4000K', location: '天花板', note: '日光' });

      hardware.push({ name: 'LED灯具(三色可调)', model: 'Tri-Color Panel', qty: 1, spec: 'AC220V, 冷/暖/日光', note: '三色灯', required: true });
      hardware.push({ name: '三档开关', model: 'WX-03', qty: 1, spec: '16A, 250VAC, 三档', note: '拨档选冷/暖/日光', required: true });

      stl += `TITLE 三模式灯具控制 (三档开关直驱)
// 三档开关: I0.0=冷光档 I0.1=暖光档 I0.2=日光档 (互斥)
// 输出: Q0.0=冷光 Q0.1=暖光 Q0.2=日光

LD     I0.0
=      Q0.0              // 冷光
LD     I0.1
=      Q0.1              // 暖光
LD     I0.2
=      Q0.2              // 日光`;

      lad += `// 三档开关直驱灯输出
      SW_COLD(I0.0)                                    L_COLD(Q0.0)
|-------| |---------------------------------------------( )-------|

      SW_WARM(I0.1)                                    L_WARM(Q0.1)
|-------| |---------------------------------------------( )-------|

      SW_DAY(I0.2)                                     L_DAY(Q0.2)
|-------| |---------------------------------------------( )-------|`;

      scl += `REGION MultiMode_Lamp
    // 三档开关直驱
    "L_COLD" := "SW_COLD";
    "L_WARM" := "SW_WARM";
    "L_DAY"  := "SW_DAY";
END_REGION`;
  }
  else if (logic.hasGarageDoor) {
     // --- 6. Garage Door ---
     io.push({ addr: 'I0.0', symbol: 'BTN_OPEN', device: '开门按钮', type: 'DI', spec: 'NO', location: '墙壁', note: '点动', isMomentary: true });
     io.push({ addr: 'I0.1', symbol: 'BTN_CLOSE', device: '关门按钮', type: 'DI', spec: 'NO', location: '墙壁', note: '点动', isMomentary: true });
     io.push({ addr: 'I0.2', symbol: 'BTN_STOP', device: '停止按钮', type: 'DI', spec: 'NC', location: '墙壁', note: '急停', isMomentary: true });
     io.push({ addr: 'I0.3', symbol: 'LMT_UP', device: '上限位开关', type: 'DI', spec: 'NC', location: '门顶', note: '到位停', isMomentary: false });
     io.push({ addr: 'I0.4', symbol: 'LMT_DN', device: '下限位开关', type: 'DI', spec: 'NC', location: '门底', note: '到位停', isMomentary: false });
     io.push({ addr: 'I0.5', symbol: 'PE_SAFE', device: '红外对射', type: 'DI', spec: 'NC', location: '门框', note: '防夹保护', isMomentary: false });

     io.push({ addr: 'Q0.0', symbol: 'M_OPEN', device: '电机上升', type: 'DO', spec: 'AC220V', location: '电机', note: '开门' });
     io.push({ addr: 'Q0.1', symbol: 'M_CLOSE', device: '电机下降', type: 'DO', spec: 'AC220V', location: '电机', note: '关门' });

     hardware.push({ name: '管状电机', model: 'Dooya-50', qty: 1, spec: '50N.m, 220V', note: '卷帘门专用', required: true });
     hardware.push({ name: '行程开关', model: 'LX19-001', qty: 2, spec: '滚轮式', note: '限位保护', required: true });
     hardware.push({ name: '安全光幕', model: 'Sec-Light', qty: 1, spec: '对射式', note: '遇阻停止', required: true });

     stl += `TITLE 车库门自动控制
// 网络1: 开门逻辑 (Priority Open)
// 停止条件: 停止按钮, 上限位, 或 正在关门(互锁)
LD     I0.0          // 开门按钮
O      Q0.0          // 自锁
AN     I0.2          // 停止按钮
AN     I0.3          // 上限位 (NC -> 动作时断开 -> AN为False)
AN     Q0.1          // 互锁: 关门中
=      Q0.0          // 输出开门

// 网络2: 关门逻辑 (Safety Close)
// 停止条件: 停止按钮, 下限位, 红外保护, 或 正在开门
LD     I0.1          // 关门按钮
O      Q0.1          // 自锁
AN     I0.2          // 停止
AN     I0.4          // 下限位
AN     I0.5          // 红外防夹 (触发断开)
AN     Q0.0          // 互锁: 开门中
=      Q0.1          // 输出关门`;

     lad += `// Network 1: Door Open Control
// Stop if: Stop Btn OR Limit Up OR Closing Interlock
      BTN_OPEN        BTN_STOP        LMT_UP          M_CLOSE         M_OPEN
|-------| |-------+-------|/|-------------|/|-------------|/|-----------( )-------|
                  |
      M_OPEN      |
|-------| |-------+

// Network 2: Door Close Control
// Stop if: Stop Btn OR Limit Down OR Safety OR Opening Interlock
      BTN_CLOSE       BTN_STOP        LMT_DN          PE_SAFE         M_OPEN          M_CLOSE
|-------| |-------+-------|/|-------------|/|-------------|/|-------------|/|-----------( )-------|
                  |
      M_CLOSE     |
|-------| |-------+`;

     scl += `REGION Open_Logic
    // Open Motor Control
    // Stop Conditions: Stop Btn, Upper Limit, or Closing Interlock
    "M_OPEN" := ("BTN_OPEN" OR "M_OPEN") 
                AND NOT "BTN_STOP" 
                AND NOT "LMT_UP" 
                AND NOT "M_CLOSE";
END_REGION

REGION Close_Logic
    // Close Motor Control
    // Stop Conditions: Stop Btn, Lower Limit, Obstruction (PE), or Opening Interlock
    "M_CLOSE" := ("BTN_CLOSE" OR "M_CLOSE") 
                 AND NOT "BTN_STOP" 
                 AND NOT "LMT_DN" 
                 AND NOT "PE_SAFE" 
                 AND NOT "M_OPEN";
END_REGION`;
  }
  else {
     // --- General Basic Logic ---
     io.push({ addr: 'I0.0', symbol: 'START', device: '启动按钮', type: 'DI', spec: 'NO', location: '控制柜', note: '绿色', isMomentary: true });
     io.push({ addr: 'I0.1', symbol: 'STOP', device: '停止按钮', type: 'DI', spec: 'NC', location: '控制柜', note: '红色', isMomentary: true });
     
     if (logic.hasInterlock) {
         // --- 4. Motor Reversing (Interlock) ---
         io.push({ addr: 'I0.2', symbol: 'REV_BTN', device: '反转启动', type: 'DI', spec: 'NO', location: '控制柜', note: '蓝色', isMomentary: true });
         io.push({ addr: 'Q0.0', symbol: 'KM_FWD', device: '正转接触器', type: 'DO', spec: '220V', location: '电机', note: '' });
         io.push({ addr: 'Q0.1', symbol: 'KM_REV', device: '反转接触器', type: 'DO', spec: '220V', location: '电机', note: '' });
         
         hardware.push({ name: '交流接触器', model: 'LC1-D12', qty: 2, spec: '12A', note: '正反转互锁', required: true });

         stl += `TITLE 电机正反转互锁控制
// 网络1: 正转控制 (Forward)
LD     I0.0          // 正转启动
O      Q0.0          // 自锁
AN     I0.1          // 停止
AN     Q0.1          // 互锁: 反转输出
=      Q0.0

// 网络2: 反转控制 (Reverse)
LD     I0.2          // 反转启动
O      Q0.1          // 自锁
AN     I0.1          // 停止
AN     Q0.0          // 互锁: 正转输出
=      Q0.1`;
         
         lad += `// Network 1: Forward Motor (KM_FWD)
      START(I0.0)     STOP(I0.1)      KM_REV(Q0.1)    KM_FWD(Q0.0)
|-------| |-------+-------|/|-------------|/|-----------( )-------|
                  |
      KM_FWD      |
|-------| |-------+

// Network 2: Reverse Motor (KM_REV)
      REV_BTN(I0.2)   STOP(I0.1)      KM_FWD(Q0.0)    KM_REV(Q0.1)
|-------| |-------+-------|/|-------------|/|-----------( )-------|
                  |
      KM_REV      |
|-------| |-------+`;

         scl += `REGION Forward_Control
    // Forward Contactor
    // Interlocked with Reverse Contactor (KM_REV)
    "KM_FWD" := ("START" OR "KM_FWD") 
                AND NOT "STOP" 
                AND NOT "KM_REV";
END_REGION

REGION Reverse_Control
    // Reverse Contactor
    // Interlocked with Forward Contactor (KM_FWD)
    "KM_REV" := ("REV_BTN" OR "KM_REV") 
                AND NOT "STOP" 
                AND NOT "KM_FWD";
END_REGION`;

     } else {
         io.push({ addr: 'Q0.0', symbol: 'KM1', device: '主接触器', type: 'DO', spec: '220V', location: '电机', note: '' });
         hardware.push({ name: '交流接触器', model: 'LC1-D09', qty: 1, spec: '9A', note: '电机控制', required: true });

         if (logic.hasDoublePressStart) {
             // --- 双次启动：第一次按下后等待，第二次需间隔≥2s且≤10s 才启动，超时重置 ---
             stl += `TITLE 双次启动控制 (间隔2秒有效，超10秒重置)
// 网络1: 第一次按下 -> 进入等待二次按下状态 M0.0
LD     I0.0          // 启动按钮上升沿
EU
O      M0.0          // 或已处于等待状态
AN     I0.1          // 未按停止
AN     Q0.0          // 未运行
=      M0.0

// 网络2: 超时10秒定时器 T37，到则复位 M0.0
LD     M0.0
TON    T37, 100      // 100*100ms=10s
LD     T37
R      M0.0, 1

// 网络3: 间隔2秒定时器 T38，用于判断第二次按下是否有效
LD     M0.0
TON    T38, 20      // 20*100ms=2s

// 网络4: 第二次按下且在2s~10s窗口内 -> 置位运行 M0.1，复位等待 M0.0
LD     I0.0          // 第二次按下
A      M0.0          // 处于等待
A      T38           // 已过2秒 (T38=ON表示≥2s)
AN     T37           // 未超10秒
EU
S      M0.1, 1
R      M0.0, 1

// 网络5: 运行输出 Q0.0 (自锁，停止复位)
LD     M0.1
O      Q0.0
AN     I0.1
=      Q0.0
LD     I0.1
R      M0.1, 1`;
             lad += `// Network 1: First Press -> Wait Second Press (M0.0)
      START(I0.0)     STOP(I0.1)     KM1(Q0.0)       WAIT_2ND(M0.0)
|-------| P ----+-------|/|-------------|/|-------------( )-------|

// Network 2: Timeout 10s -> Reset Wait
      WAIT_2ND(M0.0)                 T37(TON)        WAIT_2ND(R)
|-------| |-------------------------[ 10.0s ]-------+---( R )-------|

// Network 3: Min Interval 2s Timer
      WAIT_2ND(M0.0)                                 T38(TON)
|-------| |-----------------------------------------[ 2.0s  ]-------|

// Network 4: Second Press Valid (2s~10s) -> Run Latch M0.1
      START(P)    WAIT_2ND    T38.Q    T37.Q          RUN(M0.1)  WAIT_2ND(R)
|-------| |----|-------| |----| |------|/|-------------( S )-----( R )-------|

// Network 5: Output (Stop resets Run)
      RUN(M0.1)   STOP(I0.1)                         KM1(Q0.0)
|-------| |-------+-------|/|-------------------------( )-------|
                |
      KM1(Q0.0) |
|-------| |-----+`;
             scl += `REGION Double_Press_Start
    // First press -> wait for second press (M0.0)
    "T_Timeout".TON(IN := "WAIT_2ND", PT := T#10s);
    IF "START" AND NOT "STOP" AND NOT "KM1" THEN "WAIT_2ND" := TRUE; END_IF;
    IF "T_Timeout".Q THEN "WAIT_2ND" := FALSE; END_IF;
    
    "T_MinInt".TON(IN := "WAIT_2ND", PT := T#2s);
    // Second press valid only when 2s <= elapsed < 10s
    IF "START" AND "WAIT_2ND" AND "T_MinInt".Q AND NOT "T_Timeout".Q THEN
        "RUN" := TRUE; "WAIT_2ND" := FALSE;
    END_IF;
    IF "STOP" THEN "RUN" := FALSE; END_IF;
    "KM1" := ("RUN" OR "KM1") AND NOT "STOP";
END_REGION`;
         } else if (logic.hasDelayOn) {
             // --- 2. Delay On ---
             stl += `TITLE 电机延时启动
// 网络1: 启动计时
LD     I0.0          // 按下启动不松开
TON    T37, 30       // 延时 30 * 100ms = 3s

// 网络2: 输出驱动
LD     T37           // 时间到
=      Q0.0          // 启动电机`;
             lad += `// Network 1: Start Button -> Delay Timer
      START(I0.0)                                     T37(TON)
|-------| |-------------------------------------------[ 3.0s  ]---|

// Network 2: Timer Done -> Output
      T37.Q                                           KM1(Q0.0)
|-------| |---------------------------------------------( )-------|`;
             scl += `REGION Start_Timer
    // Delay On Timer (3 Seconds)
    "T_Delay".TON(IN := "START", PT := T#3s);
END_REGION

REGION Output_Control
    // Output active only after timer done
    "KM1" := "T_Delay".Q AND NOT "STOP";
END_REGION`;
         } else {
             // --- 1. Basic Start Stop ---
             stl += `TITLE 电机启保停控制
// 网络1: 经典自锁电路
LD     I0.0          // 启动
O      Q0.0          // 自锁触点
AN     I0.1          // 停止 (NC)
=      Q0.0          // 线圈输出`;
             lad += `// Network 1: Start-Stop Control (Latch)
      START(I0.0)     STOP(I0.1)                      KM1(Q0.0)
|-------| |-------+-------|/|---------------------------( )-------|
                  |
      KM1(Q0.0)   |
|-------| |-------+`;
             scl += `REGION Direct_Start
    // Basic Start-Stop Logic (Latching)
    "KM1" := ("START" OR "KM1") AND NOT "STOP";
END_REGION`;
         }
     }
  }

  return { io, hardware, stlCode: stl, ladCode: lad, sclCode: scl, logicConfig: logic };
};

export const runPlcCycle = (
    inputs: Record<string, boolean>,
    prevState: PLCState,
    logic: LogicConfig,
    dtMs: number
): PLCState => {
    // ... (Simulation Logic remains robust from previous iteration)
    // No changes needed here as logic simulation was already optimized for specific scenarios
    
    // Clone state
    const state: PLCState = {
        inputs: { ...inputs },
        outputs: { ...prevState.outputs },
        memory: { ...prevState.memory },
        timers: { ...prevState.timers },
        counters: { ...prevState.counters },
        registers: { ...prevState.registers },
        physics: { ...prevState.physics }
    };

    const setOut = (addr: string, val: boolean) => { state.outputs[addr] = val; };
    const getIn = (addr: string) => !!state.inputs[addr];
    const getOut = (addr: string) => !!state.outputs[addr];
    
    // 电机角度：由 simKernel 统一更新
    let motorSpeed = 0;
    if (logic.hasStarDelta) {
       if (getOut('Q0.0')) {
           if (getOut('Q0.1')) motorSpeed = 5;
           if (getOut('Q0.2')) motorSpeed = 15;
       }
    } else if (logic.hasInterlock) {
       if (getOut('Q0.0')) motorSpeed = 10;
       if (getOut('Q0.1')) motorSpeed = -10;
    } else if (!logic.hasElevator) {
       if (getOut('Q0.0') || getOut('Q0.1')) motorSpeed = 10;
    }
    if (motorSpeed !== 0) applyMotorPhysics(state, motorSpeed);

    // --- SCENARIO LOGIC Execution & Physics ---

    if (logic.hasElevator) {
        // ... (Elevator Logic)
        let carPos = state.physics['carPos'] || 0; 
        let doorPos = state.physics['doorPos'] || 0; 
        
        const atF1 = Math.abs(carPos - 0) < 2.0;
        const atF2 = Math.abs(carPos - 50) < 2.0;
        const atF3 = Math.abs(carPos - 100) < 2.0;

        state.inputs['I0.3'] = atF1;
        state.inputs['I0.4'] = atF2;
        state.inputs['I0.5'] = atF3;

        if (getIn('I0.0')) state.memory['req_1'] = true;
        if (getIn('I0.1')) state.memory['req_2'] = true;
        if (getIn('I0.2')) state.memory['req_3'] = true;

        let doorTimer = state.timers['door_timer'] || { pt: 3000, et: 0, q: false };
        let shouldOpenDoor = false;

        if (doorPos < 5) {
            if (atF1 && state.memory['req_1']) { state.memory['req_1'] = false; shouldOpenDoor = true; }
            if (atF2 && state.memory['req_2']) { state.memory['req_2'] = false; shouldOpenDoor = true; }
            if (atF3 && state.memory['req_3']) { state.memory['req_3'] = false; shouldOpenDoor = true; }
        }

        if (shouldOpenDoor) { doorTimer.et = 0; doorTimer.q = true; }

        let doorCmd = false;
        if (doorTimer.q) {
             doorTimer.et += dtMs;
             if (doorTimer.et < doorTimer.pt) {
                 doorCmd = true;
             } else {
                 doorTimer.q = false; 
             }
        }
        setOut('Q0.2', doorCmd);
        state.timers['door_timer'] = doorTimer;

        if (!doorCmd && doorPos < 2) {
            const req1 = state.memory['req_1'];
            const req2 = state.memory['req_2'];
            const req3 = state.memory['req_3'];

            const wantUp = (req3 && carPos < 98) || (req2 && carPos < 48);
            const wantDown = (req1 && carPos > 2) || (req2 && carPos > 52);

            if (wantUp && !wantDown) { setOut('Q0.0', true); setOut('Q0.1', false); } 
            else if (wantDown && !wantUp) { setOut('Q0.0', false); setOut('Q0.1', true); } 
            else if (wantUp && wantDown) {
                if (getOut('Q0.1')) { setOut('Q0.0', false); setOut('Q0.1', true); } 
                else { setOut('Q0.0', true); setOut('Q0.1', false); }
            } else { setOut('Q0.0', false); setOut('Q0.1', false); }
        } else {
            setOut('Q0.0', false); setOut('Q0.1', false);
        }

        applyElevatorPhysics(state, getOut('Q0.0'), getOut('Q0.1'), getOut('Q0.2'));
    }
    else if (logic.hasPID) {
        let temp = state.physics['temp'] || 25.0; 
        const setpoint = 60.0;
        const sysOn = getIn('I0.0'); 
        
        let output = 0;
        if (sysOn) {
            const error = setpoint - temp;
            if (error > 0) output = Math.min(1.0, error * 0.2);
        }
        
        const cycleTime = 500;
        const now = Date.now();
        const cyclePos = (now % cycleTime) / cycleTime;
        
        const heaterOn = sysOn && (cyclePos < output);
        setOut('Q0.0', heaterOn);
        setOut('Q0.1', temp > 90); 
        
        if (heaterOn) { temp += 0.8; } 
        else { const coolingRate = (temp - 25.0) * 0.02; temp -= coolingRate; }
        
        temp = Math.max(25, temp);
        state.physics['temp'] = temp;
        state.registers['AIW0'] = Math.round(temp * 10);
    }
    else if (logic.hasStarDelta) {
        const start = getIn('I0.0'); 
        const stop = getIn('I0.1');
        
        if (stop) {
            setOut('Q0.0', false); setOut('Q0.1', false); setOut('Q0.2', false);
            state.timers['T_SD'] = { pt: 5000, et: 0, q: false };
        } else {
            if (start || getOut('Q0.0')) {
                setOut('Q0.0', true);
                
                const t = state.timers['T_SD'] || { pt: 5000, et: 0, q: false };
                t.et += dtMs;
                const deadband = 100; 

                if (t.et < t.pt) {
                    setOut('Q0.1', true);  
                    setOut('Q0.2', false); 
                } else if (t.et >= t.pt && t.et < (t.pt + deadband)) {
                    setOut('Q0.1', false); 
                    setOut('Q0.2', false);
                } else {
                    t.q = true;
                    setOut('Q0.1', false); 
                    setOut('Q0.2', true); 
                }
                state.timers['T_SD'] = t;
            }
        }
    }
    else if (logic.hasMixingTank) {
        let level = state.physics['level'] || 0;
        let step = state.memory['step'] || 0; 
        const start = getIn('I0.0'); const stop = getIn('I0.1');
        state.inputs['I0.2'] = level >= 90; 
        state.inputs['I0.3'] = level <= 10; 
        
        if (stop) {
            step = 0; setOut('Q0.0', false); setOut('Q0.1', false); setOut('Q0.2', false);
        } else {
             if (step === 0 && start) step = 1;
             if (step === 1) { 
                 setOut('Q0.0', true);
                 level += 0.8; 
                 if (state.inputs['I0.2']) { setOut('Q0.0', false); step = 2; }
             }
             if (step === 2) { 
                 setOut('Q0.1', true);
                 updateTON(state.timers, 'T_MIX', true, 5000, dtMs);
                 if (state.timers['T_MIX'].q) { setOut('Q0.1', false); step = 3; }
             } else {
                 state.timers['T_MIX'] = { pt: 5000, et: 0, q: false };
             }
             
             if (step === 3) { 
                 setOut('Q0.2', true);
                 level -= 1.0; 
                 if (state.inputs['I0.3']) { setOut('Q0.2', false); step = 0; }
             }
        }
        state.memory['step'] = step;
        state.physics['level'] = Math.max(0, Math.min(100, level));
    }
    else if (logic.hasTrafficLight) {
        let start = getIn('I0.0'); let stop = getIn('I0.1'); 
        if (start) state.memory['M0.0'] = true;
        if (stop) state.memory['M0.0'] = false;
        
        const sysOn = state.memory['M0.0'];
        const t37 = state.timers['T37'] || { pt: 12000, et: 0, q: false };
        if (sysOn) {
            t37.et += dtMs;
            if (t37.et >= t37.pt) t37.et = 0;
        } else {
            t37.et = 0;
        }
        state.timers['T37'] = t37;
        
        if (sysOn) {
            setOut('Q0.0', t37.et < 5000); 
            setOut('Q0.2', t37.et >= 5000 && t37.et < 10000);
            setOut('Q0.1', t37.et >= 10000);
        } else {
            setOut('Q0.0', false); setOut('Q0.1', false); setOut('Q0.2', false);
        }
    }
    else if (logic.hasGarageDoor) {
        let pos = state.physics['doorPos'] || 0;
        state.inputs['I0.3'] = pos >= 100; state.inputs['I0.4'] = pos <= 0;
        const stop = getIn('I0.2'); const lmtUp = getIn('I0.3'); const lmtDn = getIn('I0.4'); const safe = getIn('I0.5');
        
        if (getIn('I0.0') && !lmtUp && !getOut('Q0.1')) setOut('Q0.0', true);
        if (getIn('I0.1') && !lmtDn && !getOut('Q0.0')) setOut('Q0.1', true);
        if (stop || lmtUp) setOut('Q0.0', false);
        if (stop || lmtDn || safe) setOut('Q0.1', false);
        if (getOut('Q0.0')) setOut('Q0.1', false);
        if (getOut('Q0.1')) setOut('Q0.0', false);
        applyGarageDoorPhysics(state, getOut('Q0.0'), getOut('Q0.1'));
    }
    else if (logic.hasCounting) {
        const start = getIn('I0.0'); const stop = getIn('I0.1'); const reset = getIn('I0.3');
        const c1 = state.counters['C1'] || { pv: 10, cv: 0, q: false };
        const prevSens = !!state.memory['prev_I0.2'];
        const currSens = getIn('I0.2');
        if (currSens && !prevSens) {
             if (c1.cv < c1.pv) c1.cv++;
             if (c1.cv >= c1.pv) c1.q = true;
        }
        state.memory['prev_I0.2'] = currSens;
        if (reset) { c1.cv = 0; c1.q = false; }
        state.counters['C1'] = c1;
        if (start && !c1.q) setOut('Q0.0', true);
        if (stop || c1.q) setOut('Q0.0', false);
        setOut('Q0.1', c1.q);
        applyCountingConveyorPhysics(state, getOut('Q0.0'));
    }
    else if (logic.hasLighting && logic.hasMultiModeLighting) {
        // 三档开关直驱：I0.0=冷 I0.1=暖 I0.2=日 -> Q0.0/Q0.1/Q0.2
        setOut('Q0.0', getIn('I0.0'));
        setOut('Q0.1', getIn('I0.1'));
        setOut('Q0.2', getIn('I0.2'));
    }
    else {
        // Generic Logic
        const start = getIn('I0.0');
        const stop = getIn('I0.1');
        
        if (logic.hasInterlock) {
            const rev = getIn('I0.2');
            if (start && !getOut('Q0.1') && !stop) setOut('Q0.0', true);
            if (stop) setOut('Q0.0', false);
            if (rev && !getOut('Q0.0') && !stop) setOut('Q0.1', true);
            if (stop) setOut('Q0.1', false);
        } else if (logic.hasDoublePressStart) {
            // 双次启动：第一次按下进入等待，第二次需间隔≥2s且≤10s 有效，超10s重置
            let step = (state.memory['dbl_step'] as number) ?? 0;
            const prevStart = !!state.memory['prev_start'];
            const t = state.timers['T_DBL'] || { pt: 10000, et: 0, q: false };
            const T_MIN_MS = 2000;
            const T_MAX_MS = 10000;
            if (stop) {
                step = 0;
                setOut('Q0.0', false);
            } else if (step === 0) {
                if (start && !prevStart) {
                    step = 1;
                    t.et = 0;
                }
            } else if (step === 1) {
                t.et += dtMs;
                if (t.et >= T_MAX_MS) {
                    step = 0;
                    t.et = 0;
                } else if (start && !prevStart) {
                    if (t.et >= T_MIN_MS) {
                        step = 2;
                        setOut('Q0.0', true);
                    }
                    // 未满2秒的第二次按下忽略，保持 step=1
                }
            } else {
                // step === 2 运行中，仅停止可复位
            }
            state.memory['dbl_step'] = step;
            state.memory['prev_start'] = start;
            state.timers['T_DBL'] = t;
        } else {
             if (logic.hasDelayOn) {
                 if (start) state.memory['req'] = true;
                 if (stop) { state.memory['req'] = false; setOut('Q0.0', false); }
                 updateTON(state.timers, 'T_DELAY', !!state.memory['req'], 3000, dtMs);
                 if (state.timers['T_DELAY']?.q) setOut('Q0.0', true);
            } else {
                 if (start) setOut('Q0.0', true);
                 if (stop) setOut('Q0.0', false);
            }
        }
    }

    return state;
};