/** 与桌面博途 V16 文档对齐的 LAD / SCL 源码（教科书场景） */

export const COMPARISON_SCL = `// =============================================================================
// 【变量定义表】比较指令三组灯 — TIA Portal V16 · S7-1200/1500
// =============================================================================
// ── PLC 标签（PLC 变量表）──
// 标签名      类型    地址      说明
// Start       Bool    %I0.0     启动按钮（常开）
// Stop        Bool    %I0.1     停止按钮
// Green       Bool    %Q0.0     第一组绿色灯
// Blue        Bool    %Q0.1     第二组蓝色灯
// Red         Bool    %Q0.2     第三组红色灯
//
// ── FB_LightCompare 功能块变量 ──
// VAR_INPUT  : Start, Stop
// VAR_OUTPUT : Green, Blue, Red
// VAR        : Run(Bool), T_Sec(Int 0~29), Ton_1s(TON), TonFlag(Bool)
// VAR_CONST  : T_10S=10, T_20S=20, T_30S=30
// =============================================================================

FUNCTION_BLOCK "FB_LightCompare"
{ S7_Optimized_Access := 'TRUE' }
VERSION : 1.0
   VAR_INPUT
      Start : Bool;   // 启动
      Stop : Bool;    // 停止
   END_VAR

   VAR_OUTPUT
      Green : Bool;   // 绿色灯组
      Blue : Bool;    // 蓝色灯组
      Red : Bool;     // 红色灯组
   END_VAR

   VAR
      Run : Bool;              // 运行标志
      T_Sec : Int := 0;        // 秒计数 0~29
      Ton_1s {Instruction := 'TON_TIME'; LibVersion := '1.0'} : TON_TIME;
      TonFlag : Bool;          // 防止同一秒内重复计数
   END_VAR

   VAR CONSTANT
      T_10S : Int := 10;
      T_20S : Int := 20;
      T_30S : Int := 30;
   END_VAR

BEGIN
   // Network 1：启动 / 停止 / 自锁
   IF #Start AND NOT #Stop THEN
      #Run := TRUE;
   ELSIF #Stop THEN
      #Run := FALSE;
   END_IF;

   // Network 2~3：1 秒定时器 + 秒计数
   #Ton_1s(IN := #Run AND NOT #Ton_1s.Q, PT := T#1S);

   IF #Run AND #Ton_1s.Q THEN
      IF NOT #TonFlag THEN
         #T_Sec := #T_Sec + 1;
         #TonFlag := TRUE;
      END_IF;
   ELSE
      #TonFlag := FALSE;
   END_IF;

   // Network 4：30 秒到，计数清零（比较 >=）
   IF #Run AND (#T_Sec >= #T_30S) THEN
      #T_Sec := 0;
   END_IF;

   // Network 5~7：比较指令控制三组灯
   IF #Run THEN
      #Green := (#T_Sec < #T_10S);
      #Blue  := (#T_Sec >= #T_10S) AND (#T_Sec < #T_20S);
      #Red   := (#T_Sec >= #T_20S) AND (#T_Sec < #T_30S);
   ELSE
      // Network 8：停止时关灯并清零
      #Green := FALSE;
      #Blue  := FALSE;
      #Red   := FALSE;
      #T_Sec := 0;
      #TonFlag := FALSE;
      #Ton_1s(IN := FALSE, PT := T#1S);
   END_IF;

END_FUNCTION_BLOCK

ORGANIZATION_BLOCK "Main"
TITLE = 'Main Program Cycle'
{ S7_Optimized_Access := 'TRUE' }
VERSION : 1.0
   VAR
      FB_Inst {Instruction := 'FB_LightCompare'; LibVersion := '1.0'} : FB_LightCompare;
   END_VAR
BEGIN
   #FB_Inst(Start := "Start",
            Stop  := "Stop",
            Green => "Green",
            Blue  => "Blue",
            Red   => "Red");
END_ORGANIZATION_BLOCK`;

export const COMPARISON_LAD = `// Network 1: 启动/停止自锁 Start / Stop Latch
      Start(I0.0)     Stop(I0.1)      Run(M0.0)
|-------| |-------+-------|/|-------------( S )-------|
      Run(M0.0)     Stop(I0.1)
|-------| |-------+-------|/|-------------( R )-------|

// Network 2: 1秒定时器TON 1 Second Timer TON
      Run(M0.0)     Ton_1s.Q        Ton_1s
|-------| |-------+-------|/|-----[ TON PT=T#1S ]-------|

// Network 3: 秒计数+1 Second Counter +1
      Run(M0.0)     Ton_1s.Q        TonFlag(M0.1)   T_Sec(MW10)
|-------| |-------+-------|-------|/|-----[ ADD T_Sec+1 ]--|
      Run(M0.0)     Ton_1s.Q        TonFlag(M0.1)
|-------| |-------+-------|-------|-------------( S TonFlag )--|
      Ton_1s.Q
|-------|/|-------------( R TonFlag )-------|

// Network 4: 30秒周期复位（比较>=）30s Period Reset (CMP >=)
      Run(M0.0)     T_Sec(MW10)                      T_Sec(MW10)
|-------| |-------+-----|>= INT 30|-----[ MOVE 0 ]-------|

// Network 5: 0~9秒绿色灯（比较<）0~9s Green Light (CMP <)
      Run(M0.0)     T_Sec(MW10)     Green(Q0.0)
|-------| |-------+-----|< INT 10|-------------( )-------|

// Network 6: 10~19秒蓝色灯（比较>=且<）10~19s Blue Light (CMP >= AND <)
      Run(M0.0)     T_Sec(MW10)     T_Sec(MW10)     Blue(Q0.1)
|-------| |-------+-----|>= INT 10|-----|< INT 20|-----( )-------|

// Network 7: 20~29秒红色灯（比较>=且<）20~29s Red Light (CMP >= AND <)
      Run(M0.0)     T_Sec(MW10)     T_Sec(MW10)     Red(Q0.2)
|-------| |-------+-----|>= INT 20|-----|< INT 30|-----( )-------|

// Network 8: 停止复位输出与计数 Stop — Reset Outputs and Counter
      Run(M0.0)     Green(Q0.0)     Blue(Q0.1)      Red(Q0.2)
|-------|/|-------------( R )-------( R )-------( R )-------|
      Run(M0.0)     T_Sec(MW10)     TonFlag(M0.1)
|-------|/|-----[ MOVE 0 → T_Sec ]-------( R TonFlag )-------|`;

export const CROSS_TRAFFIC_SCL = `// =============================================================================
// 【变量定义表】十字路口交通灯 — TIA Portal V16 · S7-1200/1500
// =============================================================================
// ── PLC 标签 ──
// SB1_Auto      Bool    %I0.0     自动控制按钮
// SB2_Stop      Bool    %I0.1     停止按钮
// SB3_Manual    Bool    %I0.2     手动控制按钮
// SB4_EW        Bool    %I0.3     东西直行
// SB5_NS        Bool    %I0.4     南北直行
// NS_Red        Bool    %Q0.0     南北红灯
// NS_Yellow     Bool    %Q0.1     南北黄灯
// NS_Green      Bool    %Q0.2     南北绿灯
// EW_Red        Bool    %Q0.3     东西红灯
// EW_Yellow     Bool    %Q0.4     东西黄灯
// EW_Green      Bool    %Q0.5     东西绿灯
// Flash         Bool    %M0.5     0.5s 闪烁位（时钟存储器 %MB0）
//
// ── OB1 Main 局部变量 ──
// AutoMode(Bool), ManualMode(Bool), Step(Int 1~4)
// T1~T4(TON): Step1/3 PT=8s, Step2/4 PT=3s
// =============================================================================

ORGANIZATION_BLOCK "Main"
TITLE = 'Cross Traffic OB1'
{ S7_Optimized_Access := 'TRUE' }
VERSION : 1.0

   VAR
      AutoMode : Bool;
      ManualMode : Bool;
      Step : Int := 0;
      T1 {Instruction := 'TON_TIME'; LibVersion := '1.0'} : TON_TIME;
      T2 {Instruction := 'TON_TIME'; LibVersion := '1.0'} : TON_TIME;
      T3 {Instruction := 'TON_TIME'; LibVersion := '1.0'} : TON_TIME;
      T4 {Instruction := 'TON_TIME'; LibVersion := '1.0'} : TON_TIME;
   END_VAR

BEGIN
   // Network 1 — SB2 停止
   IF "SB2_Stop" THEN
      #AutoMode := FALSE;
      #ManualMode := FALSE;
      #Step := 0;
      "NS_Red" := FALSE; "NS_Yellow" := FALSE; "NS_Green" := FALSE;
      "EW_Red" := FALSE; "EW_Yellow" := FALSE; "EW_Green" := FALSE;
      #T1(IN := FALSE, PT := T#8S);
      #T2(IN := FALSE, PT := T#3S);
      #T3(IN := FALSE, PT := T#8S);
      #T4(IN := FALSE, PT := T#3S);
   END_IF;

   // Network 2 — SB1 自动
   IF "SB1_Auto" AND NOT "SB2_Stop" THEN
      #AutoMode := TRUE;
      #ManualMode := FALSE;
      #Step := 1;
   END_IF;

   // Network 3 — SB3 手动（先全灭）
   IF "SB3_Manual" AND NOT "SB2_Stop" THEN
      #ManualMode := TRUE;
      #AutoMode := FALSE;
      "NS_Red" := FALSE; "NS_Yellow" := FALSE; "NS_Green" := FALSE;
      "EW_Red" := FALSE; "EW_Yellow" := FALSE; "EW_Green" := FALSE;
   END_IF;

   IF #AutoMode THEN
      // Network 11 — 步切换前清输出
      "NS_Red" := FALSE; "NS_Yellow" := FALSE; "NS_Green" := FALSE;
      "EW_Red" := FALSE; "EW_Yellow" := FALSE; "EW_Green" := FALSE;

      CASE #Step OF
         1:
            "NS_Red" := TRUE; "EW_Green" := TRUE;
            #T1(IN := TRUE, PT := T#8S);
            IF #T1.Q THEN #T1(IN := FALSE, PT := T#8S); #Step := 2; END_IF;
         2:
            "NS_Red" := TRUE;
            "EW_Yellow" := "Flash";   // Flash 标签 → %M0.5
            #T2(IN := TRUE, PT := T#3S);
            IF #T2.Q THEN #T2(IN := FALSE, PT := T#3S); #Step := 3; END_IF;
         3:
            "NS_Green" := TRUE; "EW_Red" := TRUE;
            #T3(IN := TRUE, PT := T#8S);
            IF #T3.Q THEN #T3(IN := FALSE, PT := T#8S); #Step := 4; END_IF;
         4:
            "EW_Red" := TRUE;
            "NS_Yellow" := "Flash";
            #T4(IN := TRUE, PT := T#3S);
            IF #T4.Q THEN #T4(IN := FALSE, PT := T#3S); #Step := 1; END_IF;
      END_CASE;

   ELSIF #ManualMode THEN
      IF "SB4_EW" THEN
         "EW_Green" := TRUE; "NS_Red" := TRUE;
      ELSIF "SB5_NS" THEN
         "NS_Green" := TRUE; "EW_Red" := TRUE;
      END_IF;
   END_IF;

END_ORGANIZATION_BLOCK`;

export const CROSS_TRAFFIC_LAD = `// Network 1: 停止SB2（最高优先级）Stop SB2 (Highest Priority)
      SB2_Stop(I0.1)  AutoMode(M0.0)  ManualMode(M0.1) Step(MW10)
|-------| |-------+-------------( R )-------( R )-------[ MOVE 0→Step ]--|
      SB2_Stop        NS_Red(Q0.0)    NS_Yellow(Q0.1) NS_Green(Q0.2)
|-------| |-------+-------------( R )-------( R )-------( R )-------|
      SB2_Stop        EW_Red(Q0.3)    EW_Yellow(Q0.4) EW_Green(Q0.5)
|-------| |-------+-------------( R )-------( R )-------( R )-------|

// Network 2: 进入自动方式SB1 Enter Auto Mode SB1
      SB1_Auto(I0.0)  SB2_Stop(I0.1)  AutoMode(M0.0)  ManualMode(M0.1) Step(MW10)
|-------| |-------+-------|/|-------------( S )-------( R )-------[ MOVE 1→Step ]--|

// Network 3: 进入手动方式SB3 Enter Manual Mode SB3
      SB3_Manual(I0.2) SB2_Stop(I0.1) ManualMode(M0.1) AutoMode(M0.0)
|-------| |-------+-------|/|-------------( S )-------( R )-------|
      SB3_Manual      All_Lights
|-------| |-------+-------------( R All 6 Lights )-------|

// Network 4: 阶段定时器T1~T4 Step Timers (T1~T4)
      AutoMode(M0.0)  Step(MW10)      T1
|-------| |-------+-----|== INT 1|-----[ TON PT=T#8S ]--|
      AutoMode        Step            T2
|-------| |-------+-----|== INT 2|-----[ TON PT=T#3S ]--|
      AutoMode        Step            T3
|-------| |-------+-----|== INT 3|-----[ TON PT=T#8S ]--|
      AutoMode        Step            T4
|-------| |-------+-----|== INT 4|-----[ TON PT=T#3S ]--|

// Network 5: 第1步南北红+东西绿8s Step 1 — NS Red + EW Green (8s)
      AutoMode(M0.0)  Step(MW10)      NS_Red(Q0.0)    EW_Green(Q0.5)
|-------| |-------+-----|== INT 1|-------------( )-------( )-------|
      AutoMode        Step            T1.Q            Step(MW10)
|-------| |-------+-----|== INT 1|-------|-------|[ MOVE 2→Step ]--|

// Network 6: 第2步南北红+东西黄闪3s Step 2 — NS Red + EW Yellow Flash (3s)
      AutoMode(M0.0)  Step(MW10)      NS_Red(Q0.0)
|-------| |-------+-----|== INT 2|-------------( )-------|
      AutoMode        Step            Flash(M0.5)     EW_Yellow(Q0.4)
|-------| |-------+-----|== INT 2|-------|-------|-----( )-------|
      AutoMode        Step            T2.Q            Step(MW10)
|-------| |-------+-----|== INT 2|-------|-------|[ MOVE 3→Step ]--|

// Network 7: 第3步南北绿+东西红8s Step 3 — NS Green + EW Red (8s)
      AutoMode(M0.0)  Step(MW10)      NS_Green(Q0.2)  EW_Red(Q0.3)
|-------| |-------+-----|== INT 3|-------------( )-------( )-------|
      AutoMode        Step            T3.Q            Step(MW10)
|-------| |-------+-----|== INT 3|-------|-------|[ MOVE 4→Step ]--|

// Network 8: 第4步南北黄闪+东西红3s Step 4 — NS Yellow Flash + EW Red (3s)
      AutoMode(M0.0)  Step(MW10)      EW_Red(Q0.3)
|-------| |-------+-----|== INT 4|-------------( )-------|
      AutoMode        Step            Flash(M0.5)     NS_Yellow(Q0.1)
|-------| |-------+-----|== INT 4|-------|-------|-----( )-------|
      AutoMode        Step            T4.Q            Step(MW10)
|-------| |-------+-----|== INT 4|-------|-------|[ MOVE 1→Step ]--|

// Network 9: 手动东西直行SB4 Manual — EW Straight SB4
      ManualMode(M0.1) SB4_EW(I0.3)   EW_Green(Q0.5)  NS_Red(Q0.0)
|-------| |-------+-------|-------------( )-------( )-------|

// Network 10: 手动南北直行SB5 Manual — NS Straight SB5
      ManualMode(M0.1) SB5_NS(I0.4)   NS_Green(Q0.2)  EW_Red(Q0.3)
|-------| |-------+-------|-------------( )-------( )-------|

// Network 11: 步切换前清除输出 Clear Outputs Before Step Switch
      AutoMode(M0.0)  Step_Change     All_Lights
|-------| |-------+-------|-------------( R All 6 Lights )-------|

// Network 12: 闪烁位Flash（系统时钟%M0.5）Flash Bit (System Clock %M0.5)
      Flash(M0.5)
|-------| |-------+  ← PLC 属性 → 时钟存储器 %MB0，Step 2/4 黄灯串联此触点`;

export const ROBOT_ARM_SCL = `// =============================================================================
// 【变量定义表】机械手控制 — TIA Portal V16 · S7-1200/1500
// =============================================================================
// ── PLC 标签（I/O）──
// SB1_Start     Bool    %I0.0     启动按钮
// SB2_Stop      Bool    %I0.1     停止按钮
// Btn_Up        Bool    %I0.2     上升（手动）
// Btn_Down      Bool    %I0.3     下降（手动）
// Btn_Left      Bool    %I0.4     左行（手动）
// Btn_Right     Bool    %I0.5     右行（手动）
// Btn_Clamp     Bool    %I0.6     夹紧（手动）
// Btn_Release   Bool    %I0.7     放松（手动）
// SA_Manual     Bool    %I1.0     手动
// SA_Home       Bool    %I1.1     回原位
// SA_SingleStep Bool    %I1.2     单步
// SA_SingleCyc  Bool    %I1.3     单周期
// SA_Continuous Bool    %I1.4     连续
// LS_Up         Bool    %I2.0     上升到位
// LS_DownA      Bool    %I2.1     A 台下降到位
// LS_DownB      Bool    %I2.2     B 台下降到位
// LS_Left       Bool    %I2.3     左行到位（原位）
// LS_Right      Bool    %I2.4     右行到位（B 台）
// Out_Up        Bool    %Q0.0     上升
// Out_Down      Bool    %Q0.1     下降
// Out_Left      Bool    %Q0.2     左行
// Out_Right     Bool    %Q0.3     右行
// Out_Clamp     Bool    %Q0.4     夹紧
// Out_Release   Bool    %Q0.5     放松
//
// ── FB_RobotArm 功能块变量 ──
// VAR_INPUT  : SB1_Start, SB2_Stop, Btn_Up~Release, SA_Manual~Continuous, LS_Up~Right
// VAR_OUTPUT : Out_Up, Out_Down, Out_Left, Out_Right, Out_Clamp, Out_Release
// VAR        : AutoRun, StopReq, StepDone, AtHome, Step(Int 0~8), Mode(Int 1~5)
//              T_Clamp(TON 1s), T_Rel(TON 1s), ClampRunning, RelRunning
// =============================================================================

FUNCTION_BLOCK "FB_RobotArm"
{ S7_Optimized_Access := 'TRUE' }
VERSION : 1.0
   VAR_INPUT
      SB1_Start : Bool;
      SB2_Stop : Bool;
      Btn_Up : Bool;
      Btn_Down : Bool;
      Btn_Left : Bool;
      Btn_Right : Bool;
      Btn_Clamp : Bool;
      Btn_Release : Bool;
      SA_Manual : Bool;
      SA_Home : Bool;
      SA_SingleStep : Bool;
      SA_SingleCyc : Bool;
      SA_Continuous : Bool;
      LS_Up : Bool;
      LS_DownA : Bool;
      LS_DownB : Bool;
      LS_Left : Bool;
      LS_Right : Bool;
   END_VAR
   VAR_OUTPUT
      Out_Up : Bool;
      Out_Down : Bool;
      Out_Left : Bool;
      Out_Right : Bool;
      Out_Clamp : Bool;
      Out_Release : Bool;
   END_VAR
   VAR
      AutoRun : Bool;
      StopReq : Bool;
      StepDone : Bool;
      AtHome : Bool;
      Step : Int := 0;
      Mode : Int := 1;
      T_Clamp {Instruction := 'TON_TIME'; LibVersion := '1.0'} : TON_TIME;
      T_Rel {Instruction := 'TON_TIME'; LibVersion := '1.0'} : TON_TIME;
      ClampRunning : Bool;
      RelRunning : Bool;
   END_VAR
BEGIN
   // Network 1 — SA → Mode
   IF #SA_Manual THEN #Mode := 1;
   ELSIF #SA_Home THEN #Mode := 2;
   ELSIF #SA_SingleStep THEN #Mode := 3;
   ELSIF #SA_SingleCyc THEN #Mode := 4;
   ELSIF #SA_Continuous THEN #Mode := 5;
   END_IF;

   // Network 2 — AtHome
   #AtHome := #LS_Up AND #LS_Left;

   // Network 3 — StopReq
   IF #SB2_Stop THEN #StopReq := TRUE; END_IF;

   // Network 4 — AutoRun 启动
   IF #SB1_Start AND NOT #AutoRun THEN
      IF (#Mode >= 3) AND (#Mode <= 5) AND #AtHome THEN
         #AutoRun := TRUE;
         IF #Step = 0 THEN #Step := 1; END_IF;
      ELSIF (#Mode = 2) AND NOT #AtHome THEN
         #AutoRun := TRUE;
      END_IF;
   END_IF;

   // 清输出
   #Out_Up := FALSE; #Out_Down := FALSE;
   #Out_Left := FALSE; #Out_Right := FALSE;
   #Out_Clamp := FALSE; #Out_Release := FALSE;
   #StepDone := FALSE;

   // Network 10 — StopReq 回原点
   IF #StopReq THEN
      IF NOT #LS_Up THEN #Out_Up := TRUE;
      ELSIF NOT #LS_Left THEN #Out_Left := TRUE;
      ELSIF #AtHome THEN #AutoRun := FALSE; #StopReq := FALSE; #Step := 0;
      END_IF;
   // Network 11 — Mode=2 回原位
   ELSIF #AutoRun AND (#Mode = 2) THEN
      IF NOT #LS_Up THEN #Out_Up := TRUE;
      ELSIF NOT #LS_Left THEN #Out_Left := TRUE;
      ELSIF #AtHome THEN #AutoRun := FALSE;
      END_IF;
   // Network 5 — 手动
   ELSIF (#Mode = 1) AND NOT #AutoRun THEN
      #Out_Up := #Btn_Up AND NOT #Btn_Down;
      #Out_Down := #Btn_Down AND NOT #Btn_Up;
      #Out_Left := #Btn_Left AND NOT #Btn_Right;
      #Out_Right := #Btn_Right AND NOT #Btn_Left;
      #Out_Clamp := #Btn_Clamp;
      #Out_Release := #Btn_Release;
   // Network 6~9 — 自动步序
   ELSIF #AutoRun AND (#Mode >= 3) AND (#Mode <= 5) THEN
      CASE #Step OF
         1: #Out_Down := TRUE;
         2: #Out_Clamp := TRUE;
         3: #Out_Up := TRUE;
         4: #Out_Right := TRUE;
         5: #Out_Down := TRUE;
         6: #Out_Release := TRUE;
         7: #Out_Up := TRUE;
         8: #Out_Left := TRUE;
      END_CASE;

      // Network 7 — 步完成
      IF (#Step = 1) AND #LS_DownA THEN #StepDone := TRUE;
      ELSIF (#Step = 2) AND #T_Clamp.Q THEN #StepDone := TRUE;
      ELSIF (#Step = 3) AND #LS_Up THEN #StepDone := TRUE;
      ELSIF (#Step = 4) AND #LS_Right THEN #StepDone := TRUE;
      ELSIF (#Step = 5) AND #LS_DownB THEN #StepDone := TRUE;
      ELSIF (#Step = 6) AND #T_Rel.Q THEN #StepDone := TRUE;
      ELSIF (#Step = 7) AND #LS_Up THEN #StepDone := TRUE;
      ELSIF (#Step = 8) AND #LS_Left THEN #StepDone := TRUE;
      END_IF;

      IF #Step = 2 THEN
         #T_Clamp(IN := #ClampRunning, PT := T#1S);
         IF #Out_Clamp THEN #ClampRunning := TRUE; END_IF;
         IF #T_Clamp.Q THEN #ClampRunning := FALSE; #T_Clamp(IN := FALSE, PT := T#1S); END_IF;
      END_IF;
      IF #Step = 6 THEN
         #T_Rel(IN := #RelRunning, PT := T#1S);
         IF #Out_Release THEN #RelRunning := TRUE; END_IF;
         IF #T_Rel.Q THEN #RelRunning := FALSE; #T_Rel(IN := FALSE, PT := T#1S); END_IF;
      END_IF;

      // Network 8 — 步号递增
      IF #StepDone THEN
         IF (#Mode = 5) AND (#Step = 8) THEN #Step := 1;
         ELSIF (#Mode = 5) OR ((#Mode = 4) AND (#Step < 8)) OR (#Mode = 3) THEN
            IF #Step < 8 THEN #Step := #Step + 1; ELSE #Step := 0; END_IF;
         END_IF;
         // Network 9
         IF (#Mode = 4) AND (#Step = 8) THEN #AutoRun := FALSE; #Step := 0; END_IF;
         IF (#Mode = 3) THEN #AutoRun := FALSE; END_IF;
      END_IF;
   END_IF;

   // 互锁
   IF #Out_Up THEN #Out_Down := FALSE; END_IF;
   IF #Out_Down THEN #Out_Up := FALSE; END_IF;
   IF #Out_Left THEN #Out_Right := FALSE; END_IF;
   IF #Out_Right THEN #Out_Left := FALSE; END_IF;
END_FUNCTION_BLOCK

ORGANIZATION_BLOCK "Main"
{ S7_Optimized_Access := 'TRUE' }
VERSION : 1.0
   VAR
      FB_Inst {Instruction := 'FB_RobotArm'; LibVersion := '1.0'} : FB_RobotArm;
   END_VAR
BEGIN
   #FB_Inst(
      SB1_Start := "SB1_Start", SB2_Stop := "SB2_Stop",
      Btn_Up := "Btn_Up", Btn_Down := "Btn_Down",
      Btn_Left := "Btn_Left", Btn_Right := "Btn_Right",
      Btn_Clamp := "Btn_Clamp", Btn_Release := "Btn_Release",
      SA_Manual := "SA_Manual", SA_Home := "SA_Home",
      SA_SingleStep := "SA_SingleStep", SA_SingleCyc := "SA_SingleCyc",
      SA_Continuous := "SA_Continuous",
      LS_Up := "LS_Up", LS_DownA := "LS_DownA", LS_DownB := "LS_DownB",
      LS_Left := "LS_Left", LS_Right := "LS_Right",
      Out_Up => "Out_Up", Out_Down => "Out_Down",
      Out_Left => "Out_Left", Out_Right => "Out_Right",
      Out_Clamp => "Out_Clamp", Out_Release => "Out_Release");
END_ORGANIZATION_BLOCK`;

export const ROBOT_ARM_LAD = `// Network 1: 工作方式译码（SA→Mode）Mode Decode (SA → Mode)
      SA_Manual(I1.0)     Mode(MW12)
|-------| |-------+-----[ MOVE 1→Mode ]-------|
      SA_Home(I1.1)
|-------| |-------+-----[ MOVE 2→Mode ]-------|
      SA_SingleStep(I1.2)
|-------| |-------+-----[ MOVE 3→Mode ]-------|
      SA_SingleCyc(I1.3)
|-------| |-------+-----[ MOVE 4→Mode ]-------|
      SA_Continuous(I1.4)
|-------| |-------+-----[ MOVE 5→Mode ]-------|

// Network 2: 在原位判断 At Home Detection
      LS_Up(I2.0)     LS_Left(I2.3)   AtHome(M0.3)
|-------| |-------+-------|-------------( )-------|

// Network 3: 停止请求 Stop Request
      SB2_Stop(I0.1)  StopReq(M0.1)
|-------| |-------+-------------( S )-------|

// Network 4: 自动运行启动 AutoRun Start
      SB1_Start(I0.0) Mode(MW12)      Mode(MW12)      AutoRun(M0.0)
|-------| |-------+-----|>= INT 3|-----|<= INT 5|-----|/|-------------( S )-------|
      SB1_Start       Mode            AtHome(M0.3)    AutoRun
|-------| |-------+-----|== INT 2|-----|/|-------------( S )-------|

// Network 5: 手动方式（Mode=1）Manual Mode (Mode=1)
      Mode(MW12)      Btn_Up(I0.2)    Out_Down(Q0.1)  Out_Up(Q0.0)
|-------| |-------+-----|== INT 1|-------|-------|/|-----( )-------|
      Mode            Btn_Down(I0.3)  Out_Up          Out_Down(Q0.1)
|-------| |-------+-----|== INT 1|-------|/|-------|-----( )-------|
      Mode            Btn_Left(I0.4)  Out_Right(Q0.3) Out_Left(Q0.2)
|-------| |-------+-----|== INT 1|-------|/|-------|-----( )-------|
      Mode            Btn_Right(I0.5) Out_Left        Out_Right(Q0.3)
|-------| |-------+-----|== INT 1|-------|/|-------|-----( )-------|
      Mode            Btn_Clamp(I0.6) Out_Clamp(Q0.4)
|-------| |-------+-----|== INT 1|-------|-------------( )-------|
      Mode            Btn_Release(I0.7) Out_Release(Q0.5)
|-------| |-------+-----|== INT 1|-------|-------------( )-------|

// Network 6: 自动步序输出（Step 1~8）Auto Step Outputs (Step 1~8)
      AutoRun(M0.0)   Step(MW10)      Out_Down(Q0.1)
|-------| |-------+-----|== INT 1|-------------( )-------|
      AutoRun         Step            Out_Clamp(Q0.4)
|-------| |-------+-----|== INT 2|-------------( )-------|
      AutoRun         Step            Out_Up(Q0.0)
|-------| |-------+-----|== INT 3|-------------( )-------|
      AutoRun         Step            Out_Right(Q0.3)
|-------| |-------+-----|== INT 4|-------------( )-------|
      AutoRun         Step            Out_Down(Q0.1)
|-------| |-------+-----|== INT 5|-------------( )-------|
      AutoRun         Step            Out_Release(Q0.5)
|-------| |-------+-----|== INT 6|-------------( )-------|
      AutoRun         Step            Out_Up(Q0.0)
|-------| |-------+-----|== INT 7|-------------( )-------|
      AutoRun         Step            Out_Left(Q0.2)
|-------| |-------+-----|== INT 8|-------------( )-------|

// Network 7: 步完成→StepDone脉冲 Step Done → StepDone Pulse
      AutoRun(M0.0)   Step(MW10)      LS_DownA(I2.1)  StepDone(M0.2)
|-------| |-------+-----|== INT 1|-------|-------------( S )-------|
      AutoRun         Step            T_Clamp.Q       StepDone(M0.2)
|-------| |-------+-----|== INT 2|-------|-------------( S )-------|
      AutoRun         Step            LS_Up(I2.0)     StepDone(M0.2)
|-------| |-------+-----|== INT 3|-------|-------------( S )-------|
      AutoRun         Step            LS_Right(I2.4)  StepDone(M0.2)
|-------| |-------+-----|== INT 4|-------|-------------( S )-------|
      AutoRun         Step            LS_DownB(I2.2)  StepDone(M0.2)
|-------| |-------+-----|== INT 5|-------|-------------( S )-------|
      AutoRun         Step            T_Rel.Q         StepDone(M0.2)
|-------| |-------+-----|== INT 6|-------|-------------( S )-------|
      AutoRun         Step            LS_Up(I2.0)     StepDone(M0.2)
|-------| |-------+-----|== INT 7|-------|-------------( S )-------|
      AutoRun         Step            LS_Left(I2.3)   StepDone(M0.2)
|-------| |-------+-----|== INT 8|-------|-------------( S )-------|
      AutoRun         Step=2          Out_Clamp(Q0.4) T_Clamp
|-------| |-------+-----|== INT 2|-------|-----[ TON PT=T#1S ]--|
      AutoRun         Step=6          Out_Release(Q0.5) T_Rel
|-------| |-------+-----|== INT 6|-------|-----[ TON PT=T#1S ]--|

// Network 8: 步号递增/连续循环 Step Increment / Continuous Loop
      AutoRun(M0.0)   StepDone(M0.2)  Mode(MW12)      Step(MW10)
|-------| |-------+-------|-------+-----|== INT 5|-----[ ADD Step+1 ]--|
      AutoRun         StepDone        Mode            Step
|-------| |-------+-------|-------+-----|== INT 4|-----|< INT 8|----[ ADD Step+1 ]--|
      AutoRun         StepDone        Mode(MW12)
|-------| |-------+-------|-------+-----|== INT 3|-----[ ADD Step+1 ]--|
      StepDone(M0.2)  Step(MW10)      Mode(MW12)      Step(MW10)
|-------| |-------+-----|== INT 8|-----|== INT 5|-----[ MOVE 1→Step ]--|

// Network 9: 单周期/单步/停止结束AutoRun Single Cycle / Single Step / Stop End AutoRun
      StepDone(M0.2)  Step(MW10)      Mode(MW12)      AutoRun(M0.0)
|-------| |-------+-----|== INT 8|-----|== INT 4|-------------( R )-------|
      StepDone        Mode(MW12)      AutoRun(M0.0)
|-------| |-------+-----|== INT 3|-------------( R )-------|
      StopReq(M0.1)   AtHome(M0.3)    AutoRun(M0.0)   StopReq(M0.1)
|-------| |-------+-------|-------------( R )-------( R )-------|

// Network 10: StopReq回原点（先Up再Left）StopReq Return Home (Up then Left)
      StopReq(M0.1)   LS_Up(I2.0)     Out_Up(Q0.0)
|-------| |-------+-------|/|-------------( )-------|
      StopReq         LS_Up           LS_Left(I2.3)   Out_Left(Q0.2)
|-------| |-------+-------|-------|/|-----( )-------|

// Network 11: Mode=2回原位 Mode=2 Return Home
      AutoRun(M0.0)   Mode(MW12)      LS_Up(I2.0)     Out_Up(Q0.0)
|-------| |-------+-----|== INT 2|-------|/|-----( )-------|
      AutoRun         Mode            LS_Up           LS_Left(I2.3) Out_Left(Q0.2)
|-------| |-------+-----|== INT 2|-------|-------|/|-----( )-------|
      AtHome(M0.3)    Mode(MW12)      AutoRun(M0.0)
|-------| |-------+-----|== INT 2|-------------( R )-------|

// Network 12: 升降左右互锁 Up/Down Left/Right Interlock
      Out_Up(Q0.0)    Out_Down(Q0.1)
|-------| |-------+-------------( R )-------|
      Out_Down        Out_Up(Q0.0)
|-------| |-------+-------------( R )-------|
      Out_Left(Q0.2)  Out_Right(Q0.3)
|-------| |-------+-------------( R )-------|
      Out_Right       Out_Left(Q0.2)
|-------| |-------+-------------( R )-------|`;

export const ENGINE_FAN_SCL = `// =============================================================================
// 【变量定义表】发动机组风扇 — TIA Portal V16 · S7-1200/1500
// =============================================================================
// ── PLC 标签 ──
// GasStart        Bool    %I0.0     汽油发动机启动按钮
// GasStop         Bool    %I0.1     汽油发动机停止按钮
// DieselStart     Bool    %I0.2     柴油发动机启动按钮
// DieselStop      Bool    %I0.3     柴油发动机停止按钮
// GasEngine       Bool    %Q0.0     汽油发动机运行输出
// DieselEngine    Bool    %Q0.1     柴油发动机运行输出
// Fan             Bool    %Q0.2     散热风扇
//
// ── OB1 Main 局部变量 ──
// Fan_10s(TOF): IN = GasEngine OR DieselEngine, PT = T#10S, Q → Fan
// =============================================================================

ORGANIZATION_BLOCK "Main"
TITLE = 'Engine Fan OB1'
{ S7_Optimized_Access := 'TRUE' }
VERSION : 1.0
   VAR
      Fan_10s {Instruction := 'TOF_TIME'; LibVersion := '1.0'} : TOF_TIME;
   END_VAR
BEGIN
   // Network 1 — 汽油发动机自锁
   IF "GasStart" AND NOT "GasStop" THEN
      "GasEngine" := TRUE;
   ELSIF "GasStop" THEN
      "GasEngine" := FALSE;
   END_IF;

   // Network 2 — 柴油发动机自锁
   IF "DieselStart" AND NOT "DieselStop" THEN
      "DieselEngine" := TRUE;
   ELSIF "DieselStop" THEN
      "DieselEngine" := FALSE;
   END_IF;

   // Network 3 — TOF 10s 风扇
   #Fan_10s(IN := "GasEngine" OR "DieselEngine", PT := T#10S);
   "Fan" := #Fan_10s.Q;
END_ORGANIZATION_BLOCK`;

export const ENGINE_FAN_LAD = `// Network 1: 汽油发动机启停自锁 Gas Engine Start / Stop Latch
      GasStart(I0.0)  GasStop(I0.1)   GasEngine(Q0.0)
|-------| |-------+-------|/|-------------( )-------|
      GasEngine       GasStop
|-------| |-------+-------|/|-------------( )-------|

// Network 2: 柴油发动机启停自锁 Diesel Engine Start / Stop Latch
      DieselStart(I0.2) DieselStop(I0.3) DieselEngine(Q0.1)
|-------| |-------+-------|/|-------------( )-------|
      DieselEngine    DieselStop
|-------| |-------+-------|/|-------------( )-------|

// Network 3: 风扇关断延时TOF 10s Fan Off-Delay TOF 10s
      GasEngine(Q0.0)                     Fan_10s         Fan(Q0.2)
|-------| |-----+-----[ TOF PT=T#10S ]-------( )-------|
      DieselEngine(Q0.1)|
|-------| |-----+`;

export const COMPARISON_STL = `TITLE 比较指令三组灯 — FB_LightCompare / Main [OB1]
// 软件：TIA Portal V16 · S7-1200/1500 · STL/AWL
// 与 LAD Network 1~8 一一对应

// Network 1: 启动/停止自锁 Start / Stop Latch
LD     I0.0          // Start %I0.0
AN     I0.1          // Stop 未按
O      M0.0          // 自锁 Run %M0.0
AN     I0.1
=      M0.0

// Network 2: 1秒定时器TON 1 Second Timer TON
A      M0.0          // Run
AN     T1            // Ton_1s.Q 未到
L      S5T#1S        // PT = T#1S
SD     T1            // Ton_1s

// Network 3: 秒计数+1 Second Counter +1
A      M0.0
A      T1             // Ton_1s.Q
AN     M0.1           // TonFlag
L      MW10           // T_Sec
L      1
+I
T      MW10

A      M0.0
A      T1
S      M0.1           // 置位 TonFlag

AN     T1
R      M0.1           // Q 变假时复位 TonFlag

// Network 4: 30秒周期复位（比较>=）30s Period Reset (CMP >=)
A      M0.0
L      MW10
L      30
>=I
L      0
T      MW10

// Network 5: 0~9秒绿色灯（比较<）0~9s Green Light (CMP <)
A      M0.0
L      MW10
L      10
<I
=      Q0.0           // Green %Q0.0

// Network 6: 10~19秒蓝色灯（比较>=且<）10~19s Blue Light (CMP >= AND <)
A      M0.0
L      MW10
L      10
>=I
L      MW10
L      20
<I
=      Q0.1           // Blue %Q0.1

// Network 7: 20~29秒红色灯（比较>=且<）20~29s Red Light (CMP >= AND <)
A      M0.0
L      MW10
L      20
>=I
L      MW10
L      30
<I
=      Q0.2           // Red %Q0.2

// Network 8: 停止复位输出与计数 Stop — Reset Outputs and Counter
AN     M0.0
R      Q0.0
R      Q0.1
R      Q0.2
AN     M0.0
L      0
T      MW10
AN     M0.0
R      M0.1
AN     M0.0
R      T1`;

export const CROSS_TRAFFIC_STL = `TITLE 十字路口交通灯 — Main [OB1]
// 软件：TIA Portal V16 · S7-1200/1500 · STL/AWL
// Flash %M0.5 ← PLC 属性 → 时钟存储器 %MB0
// 与 LAD Network 1~12 一一对应

// Network 1: 停止SB2（最高优先级）Stop SB2 (Highest Priority)
A      I0.1           // SB2_Stop
R      M0.0           // AutoMode
R      M0.1           // ManualMode
L      0
T      MW10           // Step
R      Q0.0           // NS_Red
R      Q0.1           // NS_Yellow
R      Q0.2           // NS_Green
R      Q0.3           // EW_Red
R      Q0.4           // EW_Yellow
R      Q0.5           // EW_Green
R      T1
R      T2
R      T3
R      T4

// Network 2: 进入自动方式SB1 Enter Auto Mode SB1
A      I0.0           // SB1_Auto
AN     I0.1           // 非停止
S      M0.0           // AutoMode
R      M0.1           // ManualMode
L      1
T      MW10           // Step := 1

// Network 3: 进入手动方式SB3 Enter Manual Mode SB3
A      I0.2           // SB3_Manual
AN     I0.1
S      M0.1           // ManualMode
R      M0.0           // AutoMode
R      Q0.0
R      Q0.1
R      Q0.2
R      Q0.3
R      Q0.4
R      Q0.5

// Network 4: 阶段定时器T1~T4 Step Timers (T1~T4)
A      M0.0
L      MW10
L      1
==I
L      S5T#8S
SD     T1
A      M0.0
L      MW10
L      2
==I
L      S5T#3S
SD     T2
A      M0.0
L      MW10
L      3
==I
L      S5T#8S
SD     T3
A      M0.0
L      MW10
L      4
==I
L      S5T#3S
SD     T4

// 自动模式：每扫描周期先清六灯（与 SCL CASE 前清输出一致，再 Network 5~8 点亮）
A      M0.0
R      Q0.0
R      Q0.1
R      Q0.2
R      Q0.3
R      Q0.4
R      Q0.5

// Network 5: 第1步南北红+东西绿8s Step 1 — NS Red + EW Green (8s)
A      M0.0
L      MW10
L      1
==I
=      Q0.0           // NS_Red
A      M0.0
L      MW10
L      1
==I
=      Q0.5           // EW_Green
A      M0.0
L      MW10
L      1
==I
A      T1
L      2
T      MW10           // Step := 2
R      T1

// Network 6: 第2步南北红+东西黄闪3s Step 2 — NS Red + EW Yellow Flash (3s)
A      M0.0
L      MW10
L      2
==I
=      Q0.0           // NS_Red
A      M0.0
L      MW10
L      2
==I
A      M0.5           // Flash
=      Q0.4           // EW_Yellow
A      M0.0
L      MW10
L      2
==I
A      T2
L      3
T      MW10           // Step := 3
R      T2

// Network 7: 第3步南北绿+东西红8s Step 3 — NS Green + EW Red (8s)
A      M0.0
L      MW10
L      3
==I
=      Q0.2           // NS_Green
A      M0.0
L      MW10
L      3
==I
=      Q0.3           // EW_Red
A      M0.0
L      MW10
L      3
==I
A      T3
L      4
T      MW10           // Step := 4
R      T3

// Network 8: 第4步南北黄闪+东西红3s Step 4 — NS Yellow Flash + EW Red (3s)
A      M0.0
L      MW10
L      4
==I
=      Q0.3           // EW_Red
A      M0.0
L      MW10
L      4
==I
A      M0.5           // Flash
=      Q0.1           // NS_Yellow
A      M0.0
L      MW10
L      4
==I
A      T4
L      1
T      MW10           // Step := 1 循环
R      T4

// Network 9: 手动东西直行SB4 Manual — EW Straight SB4
A      M0.1           // ManualMode
A      I0.3           // SB4_EW
=      Q0.5           // EW_Green
A      M0.1
A      I0.3
=      Q0.0           // NS_Red

// Network 10: 手动南北直行SB5 Manual — NS Straight SB5
A      M0.1           // ManualMode
A      I0.4           // SB5_NS
=      Q0.2           // NS_Green
A      M0.1
A      I0.4
=      Q0.3           // EW_Red

// Network 11: 步切换前清除输出 Clear Outputs Before Step Switch
// 已在 Network 4 之后、Network 5 之前执行六灯复位（见上方 A M0.0 / R Q0.x 段）

// Network 12: 闪烁位Flash（系统时钟%M0.5）Flash Bit (System Clock %M0.5)
// %M0.5 由 PLC 系统时钟存储器产生，Step 2/4 黄灯线圈串联 M0.5 触点（见 Network 6/8）`;

export const ROBOT_ARM_STL = `TITLE 机械手控制 — FB_RobotArm / Main [OB1]
// 软件：TIA Portal V16 · S7-1200/1500 · STL/AWL
// 与 LAD Network 1~12 一一对应

// Network 1: 工作方式译码（SA→Mode）Mode Decode (SA → Mode)
A      I1.0           // SA_Manual
L      1
T      MW12           // Mode
A      I1.1           // SA_Home
L      2
T      MW12
A      I1.2           // SA_SingleStep
L      3
T      MW12
A      I1.3           // SA_SingleCyc
L      4
T      MW12
A      I1.4           // SA_Continuous
L      5
T      MW12

// Network 2: 在原位判断 At Home Detection
A      I2.0           // LS_Up
A      I2.3           // LS_Left
=      M0.3           // AtHome

// Network 3: 停止请求 Stop Request
A      I0.1           // SB2_Stop
S      M0.1           // StopReq

// Network 4: 自动运行启动 AutoRun Start
A      I0.0           // SB1_Start
AN     M0.0           // 非 AutoRun
L      MW12
L      3
>=I
L      MW12
L      5
<=I
A      M0.3           // AtHome
S      M0.0           // AutoRun
A      I0.0
AN     M0.0
L      MW12
L      2
==I
AN     M0.3           // 非 AtHome
S      M0.0
A      I0.0
AN     M0.0
L      MW10
L      0
==I
L      1
T      MW10           // Step := 1

// Network 5: 手动方式（Mode=1）Manual Mode (Mode=1)
AN     M0.0           // 非 AutoRun
L      MW12
L      1
==I
A      I0.2           // Btn_Up
AN     I0.3
=      Q0.0           // Out_Up
AN     M0.0
L      MW12
L      1
==I
A      I0.3           // Btn_Down
AN     I0.2
=      Q0.1           // Out_Down
AN     M0.0
L      MW12
L      1
==I
A      I0.4           // Btn_Left
AN     I0.5
=      Q0.2           // Out_Left
AN     M0.0
L      MW12
L      1
==I
A      I0.5           // Btn_Right
AN     I0.4
=      Q0.3           // Out_Right
AN     M0.0
L      MW12
L      1
==I
A      I0.6           // Btn_Clamp
=      Q0.4           // Out_Clamp
AN     M0.0
L      MW12
L      1
==I
A      I0.7           // Btn_Release
=      Q0.5           // Out_Release

// Network 6: 自动步序输出（Step 1~8）Auto Step Outputs (Step 1~8)
A      M0.0           // AutoRun
L      MW10
L      1
==I
=      Q0.1           // Out_Down
A      M0.0
L      MW10
L      2
==I
=      Q0.4           // Out_Clamp
A      M0.0
L      MW10
L      3
==I
=      Q0.0           // Out_Up
A      M0.0
L      MW10
L      4
==I
=      Q0.3           // Out_Right
A      M0.0
L      MW10
L      5
==I
=      Q0.1           // Out_Down
A      M0.0
L      MW10
L      6
==I
=      Q0.5           // Out_Release
A      M0.0
L      MW10
L      7
==I
=      Q0.0           // Out_Up
A      M0.0
L      MW10
L      8
==I
=      Q0.2           // Out_Left

// Network 7: 步完成→StepDone脉冲 Step Done → StepDone Pulse
R      M0.2           // 每扫描周期先清 StepDone
A      M0.0
L      MW10
L      1
==I
A      I2.1           // LS_DownA
S      M0.2           // StepDone
A      M0.0
L      MW10
L      2
==I
A      T5             // T_Clamp.Q
S      M0.2
A      M0.0
L      MW10
L      3
==I
A      I2.0           // LS_Up
S      M0.2
A      M0.0
L      MW10
L      4
==I
A      I2.4           // LS_Right
S      M0.2
A      M0.0
L      MW10
L      5
==I
A      I2.2           // LS_DownB
S      M0.2
A      M0.0
L      MW10
L      6
==I
A      T6             // T_Rel.Q
S      M0.2
A      M0.0
L      MW10
L      7
==I
A      I2.0
S      M0.2
A      M0.0
L      MW10
L      8
==I
A      I2.3           // LS_Left
S      M0.2
A      M0.0
L      MW10
L      2
==I
A      Q0.4           // Out_Clamp
L      S5T#1S
SD     T5             // T_Clamp 1s
A      M0.0
L      MW10
L      6
==I
A      Q0.5           // Out_Release
L      S5T#1S
SD     T6             // T_Rel 1s

// Network 8: 步号递增/连续循环 Step Increment / Continuous Loop
A      M0.2           // StepDone
L      MW12
L      5
==I
L      MW10
L      8
==I
L      1
T      MW10           // 连续：Step=8 → 1
A      M0.2
L      MW12
L      5
==I
L      MW10
L      8
<I
L      MW10
L      1
+I
T      MW10           // 连续：Step+1
A      M0.2
L      MW12
L      4
==I
L      MW10
L      8
<I
L      MW10
L      1
+I
T      MW10           // 单周期：Step+1 (<8)
A      M0.2
L      MW12
L      3
==I
L      MW10
L      1
+I
T      MW10           // 单步：Step+1

// Network 9: 单周期/单步/停止结束AutoRun Single Cycle / Single Step / Stop End AutoRun
A      M0.2
L      MW12
L      4
==I
L      MW10
L      8
==I
R      M0.0           // 单周期完成
L      0
T      MW10
A      M0.2
L      MW12
L      3
==I
R      M0.0           // 单步完成停
A      M0.1           // StopReq
A      M0.3           // AtHome
R      M0.0           // 停止回原点完成
R      M0.1           // 清 StopReq
L      0
T      MW10

// Network 10: StopReq回原点（先Up再Left）StopReq Return Home (Up then Left)
A      M0.1           // StopReq
AN     I2.0           // 未 Up 到位
=      Q0.0           // Out_Up
A      M0.1
A      I2.0           // 已 Up
AN     I2.3           // 未 Left 到位
=      Q0.2           // Out_Left

// Network 11: Mode=2回原位 Mode=2 Return Home
A      M0.0
L      MW12
L      2
==I
AN     I2.0
=      Q0.0           // Out_Up
A      M0.0
L      MW12
L      2
==I
A      I2.0
AN     I2.3
=      Q0.2           // Out_Left
A      M0.3           // AtHome
L      MW12
L      2
==I
R      M0.0           // 回原完成停 AutoRun

// Network 12: 升降左右互锁 Up/Down Left/Right Interlock
A      Q0.0           // Out_Up
R      Q0.1           // R Out_Down
A      Q0.1           // Out_Down
R      Q0.0           // R Out_Up
A      Q0.2           // Out_Left
R      Q0.3           // R Out_Right
A      Q0.3           // Out_Right
R      Q0.2           // R Out_Left`;

export const ENGINE_FAN_STL = `TITLE 发动机组风扇 — Main [OB1]
// 软件：TIA Portal V16 · S7-1200/1500 · STL/AWL
// 与 LAD Network 1~3 一一对应

// Network 1: 汽油发动机启停自锁 Gas Engine Start / Stop Latch
LD     I0.0           // GasStart
AN     I0.1           // GasStop 未按
O      Q0.0           // GasEngine 自锁
AN     I0.1
=      Q0.0           // GasEngine %Q0.0
A      I0.1           // GasStop
R      Q0.0

// Network 2: 柴油发动机启停自锁 Diesel Engine Start / Stop Latch
LD     I0.2           // DieselStart
AN     I0.3           // DieselStop 未按
O      Q0.1           // DieselEngine 自锁
AN     I0.3
=      Q0.1           // DieselEngine %Q0.1
A      I0.3           // DieselStop
R      Q0.1

// Network 3: 风扇关断延时TOF 10s Fan Off-Delay TOF 10s
LD     Q0.0           // GasEngine
O      Q0.1           // DieselEngine
L      S5T#10S        // PT = T#10S
SD     T1             // Fan_10s 接通延时保持
LD     Q0.0
O      Q0.1
O      T1             // 发动机运行或定时未到
=      Q0.2           // Fan %Q0.2
AN     Q0.0
AN     Q0.1
A      T1
R      T1             // 延时结束复位定时器`;

/** @deprecated 已由各场景 COMPARISON_STL 等完整 STL 替代 */
export const TEXTBOOK_STL_NOTE =
  '// 本场景 STL/AWL 与 LAD Network 一一对应，请在 TIA Portal 中由 LAD 转换为 AWL 查看。\n';
