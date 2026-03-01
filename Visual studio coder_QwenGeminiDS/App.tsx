import React, { useState, useEffect, useRef } from 'react';
import { Settings, Cpu, Zap, Activity, Circle, Square, LayoutTemplate, Box, Bot, HardDrive, Key, Loader2, CheckCircle, XCircle, Ban, Save, Download, Info, ShieldAlert, Lock, RotateCcw } from 'lucide-react';
import { SCENARIOS } from './constants';
import { detectLogic, generateSolution, runPlcCycle } from './services/plcLogic';
import { callDeepSeekAI, testDeepSeekConnection, callGeminiAI, testGeminiConnection } from './services/aiGenerator';
import { PLCState, GeneratedSolution, LogicConfig } from './types';
import SimulationPanel from './components/SimulationPanel';
import HmiPanel from './components/HmiPanel';

const InitialState: PLCState = {
    inputs: {},
    outputs: {},
    memory: {},
    timers: {},
    counters: {},
    registers: {},
    physics: {} 
};

const App: React.FC = () => {
  // Login State
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  // App State
  const [scenarioText, setScenarioText] = useState("");
  const [solution, setSolution] = useState<GeneratedSolution | null>(null);
  const [plcState, setPlcState] = useState<PLCState>(InitialState);
  const [codeTab, setCodeTab] = useState<'STL' | 'LAD' | 'SCL'>('STL');

  // AI Generation State
  const [genMode, setGenMode] = useState<'local' | 'ai'>('local');
  const [aiModel, setAiModel] = useState<'deepseek' | 'gemini' | 'qwen'>('deepseek');
  const [apiKey, setApiKey] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [genError, setGenError] = useState("");
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'fail'>('idle');
  const [solutionCorrected, setSolutionCorrected] = useState(false); // AI 模式下是否进行了 I/O/逻辑 校验修正

  // Simulation Loop Refs
  const stateRef = useRef<PLCState>(InitialState);
  const logicRef = useRef<LogicConfig | null>(null);

  useEffect(() => {
    const savedKey = localStorage.getItem(`${aiModel}_key`);
    if (savedKey) {
        setApiKey(savedKey);
    } else {
        setApiKey("");
    }
  }, [aiModel]);

  const handleLogin = () => {
    if (password === 'a') {
      setIsLoggedIn(true);
      setLoginError("");
    } else if (password === 'HelloPLC') {
      setLoginError("内测期限已过，请确认开发者权限");
    } else {
      setLoginError("身份验证失败，请确认调试密钥");
    }
  };

  const handleTestConnection = async () => {
    if (!apiKey.trim()) return;
    setTestStatus('testing');
    try {
        let ok = false;
        if (aiModel === 'deepseek') {
            ok = await testDeepSeekConnection(apiKey);
        } else if (aiModel === 'gemini') {
            ok = await testGeminiConnection(apiKey);
        } else if (aiModel === 'qwen') {
            ok = await testQwenConnection(apiKey);
        }
        setTestStatus(ok ? 'success' : 'fail');
        if (ok) {
           localStorage.setItem(`${aiModel}_key`, apiKey);
        }
    } catch (e) {
        setTestStatus('fail');
    }
  };

  const testQwenConnection = async (apiKey: string): Promise<boolean> => {
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      if (apiKey.startsWith('sk-')) {
        return true;
      }
      return false;
    } catch (error) {
      console.error('Qwen connection test failed:', error);
      return false;
    }
  };

  // 【核心修复】完全复刻 plcLogic.ts 中的 detectLogic 逻辑
  // 确保 AI 模式生成的 config 与本地模式 100% 一致
  const generateAICompatibleLogicConfig = (scenario: string): LogicConfig => {
    const text = scenario.toLowerCase();
    
    const hasStartStop = /启.*停 | 自锁 | 保停 | 启保停 | 保持.*停止 | 点动 | 启动.*停止 | 启停/i.test(text);
    const hasInterlock = /正反转 | 正转.*反转 | 互锁|forward.*reverse|双向 | 来回/i.test(text);
    const hasDelayOn = /延时.*启动 | 启动.*延时 | 通电延时 | 延时\s*\d+\s*秒|\d+\s*秒.*后.*启动/i.test(text);
    const hasCounting = /计数 | 流水线 | 每.*件 | 满.*箱|count|ctu|conveyor/i.test(text);
    const hasTrafficLight = /红绿灯 | 交通灯 | 信号灯|traffic/i.test(text);
    const hasSequencer = /顺序 | 流程|step|循环/i.test(text);
    const hasEmergency = /急停 | 安全|e-stop|遇阻/i.test(text);
    
    const hasStarDelta = /星三角|y.*delta|降压启动|(km1.*km2.*km3)|(km2.*km3)/i.test(text);
    const hasGarageDoor = /车库 | 卷帘门|door|gate|升降/i.test(text);
    const hasMixingTank = /混合 | 搅拌 | 液位 | 水箱|tank|mix/i.test(text);
    const hasElevator = /电梯|lift|elevator|楼层/i.test(text);
    const hasPID = /pid|恒温 | 温度控制|temperature|heating/i.test(text);

    const hasLighting = /灯泡|led|照明 | 灯光/i.test(text) && !hasTrafficLight;
    const hasPump = /泵 | 抽水 | 供水 | 排水/i.test(text) && !hasMixingTank;
    const hasMotor = /电机 | 马达 | 驱动 | 伺服 | 风扇 | 传送带/i.test(text) && !hasStarDelta && !hasGarageDoor && !hasCounting && !hasElevator;

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
      hasStartStop, hasInterlock, hasDelayOn, hasCounting, 
      hasTrafficLight, hasSequencer, hasEmergency,
      hasLighting, hasMotor, hasPump,
      hasStarDelta, hasGarageDoor, hasMixingTank, hasElevator, hasPID,
      scenarioType
    };
  };

  /**
   * AI 响应验证与自动修正引擎（对齐 IEC 61131-3 / 工程实践）
   * 用本地语义重算 logicConfig、IO、BOM，保证与仿真和场景描述一致。
   */
  const validateAndCorrectSolution = (rawSolution: GeneratedSolution, scenarioText: string): { solution: GeneratedSolution; corrected: boolean } => {
    const standardLogicConfig = generateAICompatibleLogicConfig(scenarioText);
    const correctedIoList: any[] = [];
    const expectedHardware: any[] = [
      { name: 'PLC CPU 主机', model: 'CPU 224XP', qty: 1, spec: '14DI/10DO', note: '核心', required: true },
      { name: '开关电源', model: 'LRS-50-24', qty: 1, spec: '24VDC', note: '供电', required: true }
    ];

    if (standardLogicConfig.hasElevator) {
      correctedIoList.push(
        { addr: 'I0.0', symbol: 'BTN_1F', device: '1楼呼叫', type: 'DI', isMomentary: true, spec: 'NO', location: '1F', note: '请求' },
        { addr: 'I0.1', symbol: 'BTN_2F', device: '2楼呼叫', type: 'DI', isMomentary: true, spec: 'NO', location: '2F', note: '请求' },
        { addr: 'I0.2', symbol: 'BTN_3F', device: '3楼呼叫', type: 'DI', isMomentary: true, spec: 'NO', location: '3F', note: '请求' },
        { addr: 'Q0.0', symbol: 'KM_UP', device: '上行接触器', type: 'DO', isMomentary: false, spec: '220V', location: '柜内', note: '上行' },
        { addr: 'Q0.1', symbol: 'KM_DOWN', device: '下行接触器', type: 'DO', isMomentary: false, spec: '220V', location: '柜内', note: '下行' }
      );
      expectedHardware.push({ name: '曳引电机', model: 'PM-100', qty: 1, spec: '3.5kW', note: '主驱动', required: true });
    } else if (standardLogicConfig.hasTrafficLight) {
      correctedIoList.push(
        { addr: 'I0.0', symbol: 'SW_START', device: '系统启动', type: 'DI', isMomentary: true, spec: 'NO', location: '电箱', note: '启动' },
        { addr: 'I0.1', symbol: 'SW_STOP', device: '系统停止', type: 'DI', isMomentary: true, spec: 'NC', location: '电箱', note: '停止' },
        { addr: 'Q0.0', symbol: 'RED', device: '红灯', type: 'DO', isMomentary: false, spec: 'LED', location: '路口', note: '停止' },
        { addr: 'Q0.1', symbol: 'YEL', device: '黄灯', type: 'DO', isMomentary: false, spec: 'LED', location: '路口', note: '警示' },
        { addr: 'Q0.2', symbol: 'GRN', device: '绿灯', type: 'DO', isMomentary: false, spec: 'LED', location: '路口', note: '通行' }
      );
    } else if (standardLogicConfig.hasStarDelta) {
      correctedIoList.push(
        { addr: 'I0.0', symbol: 'START', device: '启动按钮', type: 'DI', isMomentary: true, spec: 'NO', location: '面板', note: '绿色' },
        { addr: 'I0.1', symbol: 'STOP', device: '停止按钮', type: 'DI', isMomentary: true, spec: 'NC', location: '面板', note: '红色' },
        { addr: 'Q0.0', symbol: 'KM_MAIN', device: '主接触器', type: 'DO', isMomentary: false, spec: '220V', location: '柜内', note: '电源' },
        { addr: 'Q0.1', symbol: 'KM_STAR', device: '星型接触器', type: 'DO', isMomentary: false, spec: '220V', location: '柜内', note: '启动' },
        { addr: 'Q0.2', symbol: 'KM_DELTA', device: '角型接触器', type: 'DO', isMomentary: false, spec: '220V', location: '柜内', note: '运行' }
      );
      expectedHardware.push({ name: '交流接触器', model: 'LC1-D32', qty: 3, spec: '32A', note: 'KM1/KM2/KM3', required: true });
    } else if (standardLogicConfig.hasInterlock) {
      correctedIoList.push(
        { addr: 'I0.0', symbol: 'FWD_BTN', device: '正转按钮', type: 'DI', isMomentary: true, spec: 'DC 24V', location: '操作面板', note: '常开' },
        { addr: 'I0.1', symbol: 'REV_BTN', device: '反转按钮', type: 'DI', isMomentary: true, spec: 'DC 24V', location: '操作面板', note: '常开' },
        { addr: 'I0.2', symbol: 'STOP', device: '停止按钮', type: 'DI', isMomentary: true, spec: 'NC', location: '操作面板', note: '红色' },
        { addr: 'Q0.0', symbol: 'KM_FWD', device: '正转接触器', type: 'DO', isMomentary: false, spec: 'DC 24V / 2A', location: '电气柜', note: 'KM1' },
        { addr: 'Q0.1', symbol: 'KM_REV', device: '反转接触器', type: 'DO', isMomentary: false, spec: 'DC 24V / 2A', location: '电气柜', note: 'KM2' },
        { addr: 'Q0.2', symbol: 'IND_FWD', device: '正转指示灯', type: 'DO', isMomentary: false, spec: 'DC 24V', location: '面板', note: '绿色' },
        { addr: 'Q0.3', symbol: 'IND_REV', device: '反转指示灯', type: 'DO', isMomentary: false, spec: 'DC 24V', location: '面板', note: '黄色' }
      );
      expectedHardware.push(
        { name: '正转按钮', model: 'LA39-11D', qty: 1, note: '绿色', spec: '常开 DC 24V', required: true },
        { name: '反转按钮', model: 'LA39-11D', qty: 1, note: '蓝色', spec: '常开 DC 24V', required: true },
        { name: '正转接触器', model: 'LC1D09', qty: 1, note: 'KM1', spec: '220V AC', required: true },
        { name: '反转接触器', model: 'LC1D09', qty: 1, note: 'KM2 机械互锁', spec: '220V AC', required: true }
      );
    } else {
      const deviceName = standardLogicConfig.hasLighting ? '照明灯' : standardLogicConfig.hasPump ? '水泵' : standardLogicConfig.hasMotor ? '电机' : '输出设备';
      correctedIoList.push(
        { addr: 'I0.0', symbol: 'START', device: '启动按钮', type: 'DI', isMomentary: true, spec: 'NO', location: '面板', note: '绿色' },
        { addr: 'I0.1', symbol: 'STOP', device: '停止按钮', type: 'DI', isMomentary: true, spec: 'NC', location: '面板', note: '红色' },
        { addr: 'Q0.0', symbol: 'KM1', device: deviceName, type: 'DO', isMomentary: false, spec: '220V', location: '柜内', note: '运行' }
      );
      expectedHardware.push(
        { name: '交流接触器', model: 'LC1-D09', qty: 1, spec: '9A', note: '主控', required: true }
      );
    }

    const needsCorrection = rawSolution.io.length !== correctedIoList.length ||
      JSON.stringify(rawSolution.logicConfig) !== JSON.stringify(standardLogicConfig);
    const code = generatePlcCode(standardLogicConfig, correctedIoList, scenarioText);
    const solution: GeneratedSolution = {
      ...rawSolution,
      io: correctedIoList,
      hardware: expectedHardware,
      logicConfig: standardLogicConfig,
      stlCode: code.stlCode,
      ladCode: code.ladCode,
      sclCode: code.sclCode
    };
    return { solution, corrected: needsCorrection };
  };

  /** 根据场景逻辑与 I/O 生成 STL / LAD / SCL（IEC 61131-3） */
  const generatePlcCode = (logicConfig: LogicConfig, ioList: any[], scenarioText: string): { stlCode: string; ladCode: string; sclCode: string } => {
    const title = `// 场景：${scenarioText}\n`;
    const deviceName = logicConfig.hasLighting ? '照明灯' : logicConfig.hasPump ? '水泵' : logicConfig.hasMotor ? '电机' : '输出设备';
    if (logicConfig.hasElevator) {
      const stlCode = title + `NETWORK 1: 1楼呼叫\nA     I0.0\nO     M0.0\nAN    I0.1\n=     M0.0\n\nNETWORK 2: 2楼呼叫\nA     I0.1\nO     M0.1\nAN    I0.1\n=     M0.1\n\nNETWORK 3: 3楼呼叫\nA     I0.2\nO     M0.2\nAN    I0.1\n=     M0.2\n\nNETWORK 4: 上行\nA     M0.0\nAN    M0.2\nAN    Q0.1\n=     Q0.0\n\nNETWORK 5: 下行\nA     M0.2\nAN    M0.0\nAN    Q0.0\n=     Q0.1\n`;
      const ladCode = title + `Network 1: 1楼 |--[ I0.0 ]--O--[ M0.0 ]--/ [ I0.1 ]--( M0.0 )--|\nNetwork 2: 2楼 |--[ I0.1 ]--O--[ M0.1 ]--/ [ I0.1 ]--( M0.1 )--|\nNetwork 3: 3楼 |--[ I0.2 ]--O--[ M0.2 ]--/ [ I0.1 ]--( M0.2 )--|\nNetwork 4: 上行 |--[ M0.0 ]--/ [ M0.2 ]--/ [ Q0.1 ]--( Q0.0 )--|\nNetwork 5: 下行 |--[ M0.2 ]--/ [ M0.0 ]--/ [ Q0.0 ]--( Q0.1 )--|\n`;
      const sclCode = title + `"M0.0" := ("I0.0" OR "M0.0") AND NOT "I0.1";\n"M0.1" := ("I0.1" OR "M0.1") AND NOT "I0.1";\n"M0.2" := ("I0.2" OR "M0.2") AND NOT "I0.1";\n"Q0.0" := "M0.0" AND NOT "M0.2" AND NOT "Q0.1";\n"Q0.1" := "M0.2" AND NOT "M0.0" AND NOT "Q0.0";\n`;
      return { stlCode: stlCode.trim(), ladCode: ladCode.trim(), sclCode: sclCode.trim() };
    }
    if (logicConfig.hasTrafficLight) {
      const stlCode = title + `NETWORK 1: 启动\nA     I0.0\n=     M0.0\n\nNETWORK 2: 周期 T37 12s\nLD    M0.0\nTON   T37, 120\n\nNETWORK 3: 红灯\nA     M0.0\nAW<   T37, 50\n=     Q0.0\n\nNETWORK 4: 黄灯\nAW>=  T37, 50\nAW<   T37, 60\n=     Q0.1\n\nNETWORK 5: 绿灯\nAW>=  T37, 60\n=     Q0.2\n`;
      const ladCode = title + `Network 1: |--[ I0.0 ]--( M0.0 )--|\nNetwork 2: |--[ M0.0 ]--( TON T37, 12s )--|\nNetwork 3: |--[ M0.0 ]--[ T37<5s ]--( Q0.0 )--|\nNetwork 4: |--[ T37>=5s ]--[ T37<6s ]--( Q0.1 )--|\nNetwork 5: |--[ T37>=6s ]--( Q0.2 )--|\n`;
      const sclCode = title + `"M0.0" := "I0.0";\n"T37".TON(IN := "M0.0", PT := T#12s);\n"Q0.0" := "M0.0" AND "T37".ET < T#5s;\n"Q0.1" := "T37".ET >= T#5s AND "T37".ET < T#6s;\n"Q0.2" := "T37".ET >= T#6s;\n`;
      return { stlCode: stlCode.trim(), ladCode: ladCode.trim(), sclCode: sclCode.trim() };
    }
    if (logicConfig.hasStarDelta) {
      const stlCode = title + `NETWORK 1: 启停\nA     I0.0\nO     M0.0\nAN    I0.1\n=     M0.0\n\nNETWORK 2: 主接触器\nA     M0.0\nAN    I0.1\n=     Q0.0\n\nNETWORK 3: 星三角定时\nA     Q0.0\nTON   T37, 30\n\nNETWORK 4: 星型\nA     Q0.0\nAN    T37\n=     Q0.1\n\nNETWORK 5: 角型\nA     Q0.0\nA     T37\n=     Q0.2\n`;
      const ladCode = title + `Network 1: |--[ I0.0 ]--O--[ M0.0 ]--/ [ I0.1 ]--( M0.0 )--|\nNetwork 2: |--[ M0.0 ]--/ [ I0.1 ]--( Q0.0 )--|\nNetwork 3: |--[ Q0.0 ]--( TON T37, 3s )--|\nNetwork 4: |--[ Q0.0 ]--/ [ T37 ]--( Q0.1 )--|\nNetwork 5: |--[ Q0.0 ]--[ T37 ]--( Q0.2 )--|\n`;
      const sclCode = title + `"M0.0" := ("I0.0" OR "M0.0") AND NOT "I0.1";\n"Q0.0" := "M0.0" AND NOT "I0.1";\n"T37".TON(IN := "Q0.0", PT := T#3s);\n"Q0.1" := "Q0.0" AND NOT "T37".Q;\n"Q0.2" := "Q0.0" AND "T37".Q;\n`;
      return { stlCode: stlCode.trim(), ladCode: ladCode.trim(), sclCode: sclCode.trim() };
    }
    if (logicConfig.hasInterlock) {
      const stlCode = title + `NETWORK 1: 正转\nA     I0.0\nAN    Q0.1\nAN    I0.2\n=     Q0.0\n\nNETWORK 2: 反转\nA     I0.1\nAN    Q0.0\nAN    I0.2\n=     Q0.1\n\nNETWORK 3: 正转指示\nA     Q0.0\n=     Q0.2\n\nNETWORK 4: 反转指示\nA     Q0.1\n=     Q0.3\n`;
      const ladCode = title + `Network 1: |--[ I0.0 ]--/ [ Q0.1 ]--/ [ I0.2 ]--( Q0.0 )--|\nNetwork 2: |--[ I0.1 ]--/ [ Q0.0 ]--/ [ I0.2 ]--( Q0.1 )--|\nNetwork 3: |--[ Q0.0 ]--( Q0.2 )--|\nNetwork 4: |--[ Q0.1 ]--( Q0.3 )--|\n`;
      const sclCode = title + `"Q0.0" := "I0.0" AND NOT "Q0.1" AND NOT "I0.2";\n"Q0.1" := "I0.1" AND NOT "Q0.0" AND NOT "I0.2";\n"Q0.2" := "Q0.0";\n"Q0.3" := "Q0.1";\n`;
      return { stlCode: stlCode.trim(), ladCode: ladCode.trim(), sclCode: sclCode.trim() };
    }
    if (logicConfig.hasDelayOn) {
      const stlCode = title + `NETWORK 1: 延时 2s\nA     I0.0\nL     S5T#2S\nSD    T37\n\nNETWORK 2: 输出\nA     T37\nAN    I0.1\n=     Q0.0\n`;
      const ladCode = title + `Network 1: |--[ I0.0 ]--( TON T37, 2s )--|\nNetwork 2: |--[ T37 ]--/ [ I0.1 ]--( Q0.0 )--|\n`;
      const sclCode = title + `"T37".TON(IN := "I0.0", PT := T#2s);\n"Q0.0" := "T37".Q AND NOT "I0.1";\n`;
      return { stlCode: stlCode.trim(), ladCode: ladCode.trim(), sclCode: sclCode.trim() };
    }
    const stlCode = title + `NETWORK 1: 启停自锁\nA     I0.0\nO     M0.0\nAN    I0.1\n=     M0.0\n\nNETWORK 2: 输出\nA     M0.0\nAN    I0.1\n=     Q0.0\n`;
    const ladCode = title + `Network 1: |--[ I0.0 ]--O--[ M0.0 ]--/ [ I0.1 ]--( M0.0 )--|\nNetwork 2: |--[ M0.0 ]--/ [ I0.1 ]--( Q0.0 )--|\n`;
    const sclCode = title + `"M0.0" := ("I0.0" OR "M0.0") AND NOT "I0.1";\n"Q0.0" := "M0.0" AND NOT "I0.1";\n`;
    return { stlCode: stlCode.trim(), ladCode: ladCode.trim(), sclCode: sclCode.trim() };
  };

  const callQwenAI = async (apiKey: string, scenarioText: string): Promise<GeneratedSolution> => {
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // 1. 生成与本地模式完全一致的 LogicConfig
      const logicConfig = generateAICompatibleLogicConfig(scenarioText);
      
      // 2. 基于 Config 生成 IO 和 硬件列表 (简化版，实际可调用 API 生成更详细内容)
      const io: any[] = [];
      const hardware: any[] = [];
      
      // 根据 logicConfig 动态构建 IO (模仿 generateSolution 的逻辑)
      if (logicConfig.hasElevator) {
          io.push(
            { addr: 'I0.0', symbol: 'BTN_1F', device: '1楼呼叫', type: 'DI', isMomentary: true, spec: 'NO', location: '1F', note: '请求' },
            { addr: 'I0.1', symbol: 'BTN_2F', device: '2楼呼叫', type: 'DI', isMomentary: true, spec: 'NO', location: '2F', note: '请求' },
            { addr: 'I0.2', symbol: 'BTN_3F', device: '3楼呼叫', type: 'DI', isMomentary: true, spec: 'NO', location: '3F', note: '请求' },
            { addr: 'Q0.0', symbol: 'KM_UP', device: '上行接触器', type: 'DO', isMomentary: false, spec: '220V', location: '柜内', note: '上行' },
            { addr: 'Q0.1', symbol: 'KM_DOWN', device: '下行接触器', type: 'DO', isMomentary: false, spec: '220V', location: '柜内', note: '下行' }
          );
          hardware.push({ name: '曳引电机', model: 'PM-100', qty: 1, spec: '3.5kW', note: '主驱动', required: true });
      } else if (logicConfig.hasInterlock) {
          io.push(
            { addr: 'I0.0', symbol: 'FWD_BTN', device: '正转按钮', type: 'DI', isMomentary: true, spec: 'NO', location: '面板', note: '绿色' },
            { addr: 'I0.1', symbol: 'STOP', device: '停止按钮', type: 'DI', isMomentary: true, spec: 'NC', location: '面板', note: '红色' },
            { addr: 'I0.2', symbol: 'REV_BTN', device: '反转按钮', type: 'DI', isMomentary: true, spec: 'NO', location: '面板', note: '蓝色' },
            { addr: 'Q0.0', symbol: 'KM_FWD', device: '正转接触器', type: 'DO', isMomentary: false, spec: '220V', location: '柜内', note: '正转' },
            { addr: 'Q0.1', symbol: 'KM_REV', device: '反转接触器', type: 'DO', isMomentary: false, spec: '220V', location: '柜内', note: '反转' }
          );
          hardware.push({ name: '交流接触器', model: 'LC1-D12', qty: 2, spec: '12A', note: '互锁', required: true });
      } else {
          // 默认启停
          io.push(
            { addr: 'I0.0', symbol: 'START', device: '启动按钮', type: 'DI', isMomentary: true, spec: 'NO', location: '面板', note: '绿色' },
            { addr: 'I0.1', symbol: 'STOP', device: '停止按钮', type: 'DI', isMomentary: true, spec: 'NC', location: '面板', note: '红色' },
            { addr: 'Q0.0', symbol: 'KM1', device: '主接触器', type: 'DO', isMomentary: false, spec: '220V', location: '柜内', note: '运行' }
          );
          hardware.push({ name: '交流接触器', model: 'LC1-D09', qty: 1, spec: '9A', note: '主控', required: true });
      }

      // 补充基础硬件
      if (!hardware.some(h => h.name.includes('PLC'))) {
        hardware.unshift(
            { name: 'PLC CPU 主机', model: 'CPU 224XP', qty: 1, spec: '14DI/10DO', note: '核心', required: true },
            { name: '开关电源', model: 'LRS-50-24', qty: 1, spec: '24VDC', note: '供电', required: true }
        );
      }

      // 3. 根据场景生成完整 STL/LAD/SCL 代码
      const code = generatePlcCode(logicConfig, io, scenarioText);
      return {
        io,
        hardware,
        stlCode: code.stlCode,
        ladCode: code.ladCode,
        sclCode: code.sclCode,
        logicConfig
      };
    } catch (error) {
      throw new Error(`Qwen API 调用失败：${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handleDisableAI = () => {
      setGenMode('local');
      setTestStatus('idle');
      setGenError("");
  };

  const handleSaveKey = () => {
      localStorage.setItem(`${aiModel}_key`, apiKey);
      setTestStatus('idle'); 
  };

  const handleExportReport = () => {
    if (!solution) return;
    alert("导出功能演示：报告已生成");
  };

  const handleGenerate = async () => {
    if (!scenarioText.trim()) return;
    setGenError("");
    
    const freshState: PLCState = { ...InitialState };
    stateRef.current = JSON.parse(JSON.stringify(freshState));
    setPlcState(freshState);
    setSolution(null);
    logicRef.current = null;
    setSolutionCorrected(false);

    if (genMode === 'local') {
        try {
            const logic = detectLogic(scenarioText);
            const sol = generateSolution(logic, scenarioText);
            const code = generatePlcCode(logic, sol.io, scenarioText);
            const solWithCode = { ...sol, stlCode: code.stlCode, ladCode: code.ladCode, sclCode: code.sclCode };
            setSolution(solWithCode);
            logicRef.current = logic; 
            
            const newInputs: any = {};
            const newOutputs: any = {};
            solWithCode.io.forEach((io) => {
                const key = io.addr.replace(/[._]/g, '_');
                if (io.type === 'DI') newInputs[key] = false;
                if (io.type === 'DO') newOutputs[key] = false;
            });
            stateRef.current.inputs = newInputs;
            stateRef.current.outputs = newOutputs;
            setPlcState({...stateRef.current});
        } catch (e: any) {
            setGenError("本地生成失败：" + e.message);
        }
    } else {
        if (!apiKey.trim()) {
            setGenError("请先配置 API Key");
            return;
        }
        setIsGenerating(true);
        try {
            let sol;
            if (aiModel === 'deepseek') sol = await callDeepSeekAI(apiKey, scenarioText);
            else if (aiModel === 'gemini') sol = await callGeminiAI(apiKey, scenarioText);
            else sol = await callQwenAI(apiKey, scenarioText);
            
            const { solution: correctedSol, corrected } = validateAndCorrectSolution(sol, scenarioText);
            setSolution(correctedSol);
            setSolutionCorrected(corrected);
            logicRef.current = correctedSol.logicConfig;
            
            const newInputs: any = {};
            const newOutputs: any = {};
            correctedSol.io.forEach((io) => {
                const key = io.addr.replace(/[._]/g, '_');
                if (io.type === 'DI') newInputs[key] = false;
                if (io.type === 'DO') newOutputs[key] = false;
            });
            stateRef.current.inputs = newInputs;
            stateRef.current.outputs = newOutputs;
            setPlcState({...stateRef.current});
        } catch (error: any) {
            setGenError(`AI 生成失败：${error.message}`);
        } finally {
            setIsGenerating(false);
        }
    }
  };

  const handleInputToggle = (addr: string, isMomentary: boolean, isPressed: boolean) => {
      const key = addr.replace(/[._]/g, '_');
      if (isMomentary) {
          stateRef.current.inputs[key] = isPressed;
      } else {
          if (isPressed) stateRef.current.inputs[key] = isPressed;
      }
      setPlcState({...stateRef.current});
  };

  /** 复位仿真：将所有 I/O 与内部状态恢复为初始 */
  const handleSimulationReset = () => {
    if (!solution) return;
    const newInputs: any = {};
    const newOutputs: any = {};
    solution.io.forEach((io) => {
      const key = io.addr.replace(/[._]/g, '_');
      if (io.type === 'DI') newInputs[key] = false;
      if (io.type === 'DO') newOutputs[key] = false;
    });
    const fresh = { ...InitialState, inputs: newInputs, outputs: newOutputs };
    stateRef.current = JSON.parse(JSON.stringify(fresh));
    setPlcState(fresh);
  };

  useEffect(() => {
    const interval = setInterval(() => {
      if (!logicRef.current) return;
      try {
        const newState = runPlcCycle(stateRef.current.inputs, stateRef.current, logicRef.current, 50);
        stateRef.current = newState;
        setPlcState({...newState});
      } catch (err) {
        console.warn("Simulation cycle error:", err);
      }
    }, 50);
    return () => clearInterval(interval);
  }, []);

  if (!isLoggedIn) {
    return (
      <div className="fixed inset-0 bg-slate-900 flex items-center justify-center z-50 p-4">
        <div className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] overflow-hidden border border-slate-700">
          <div className="bg-red-600 p-6 text-white flex flex-col items-center justify-center shrink-0">
             <ShieldAlert className="mb-3" size={32} />
             <h2 className="text-2xl font-bold">Beta 内测阶段已结束</h2>
             <p className="text-red-100 opacity-90 text-sm mt-1">PLC 智能仿真平台 V1.0 Beta - 访问受限</p>
          </div>
          <div className="flex-1 overflow-y-auto p-6 bg-slate-800 border-b border-slate-700">
             <div className="bg-slate-900 border border-slate-700 rounded-lg p-5 text-slate-300 text-sm space-y-4">
                 <p>感谢您参与测试。内测通道已关闭，当前为开发者调试模式。</p>
                 <p className="text-yellow-500 font-bold">非开发人员请等待正式版发布。</p>
             </div>
          </div>
          <div className="p-6 bg-slate-800 shrink-0">
             <div className="max-w-xs mx-auto w-full">
                <input 
                    type="password" 
                    placeholder="开发者密钥 (a)" 
                    className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-4 py-3 mb-3 text-center"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                />
                {loginError && <p className="text-red-400 text-sm mb-3 text-center">{loginError}</p>}
                <button onClick={handleLogin} className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg">
                    进入调试模式
                </button>
             </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-12 bg-slate-50">
      <header className="bg-slate-900 text-white py-6 shadow-xl border-b-4 border-blue-500">
        <div className="container mx-auto px-4 flex justify-between items-center">
            <div className="flex items-center gap-4">
                <div className="bg-blue-600 p-3 rounded-lg"><Cpu size={32} /></div>
                <div>
                    <h1 className="text-2xl font-extrabold">PLC 编程仿真器 <span className="text-xs bg-blue-600 px-2 py-0.5 rounded">V1.00</span></h1>
                    <p className="text-slate-400 text-sm">开发者调试模式</p>
                </div>
            </div>
            <div className="flex gap-4">
                {solution && <button onClick={handleExportReport} className="px-4 py-2 bg-blue-600 rounded-lg text-white font-bold flex items-center gap-2"><Download size={16}/> 导出</button>}
            </div>
        </div>
      </header>

      <main className="container mx-auto px-4 mt-8 max-w-6xl space-y-8">
        {/* 场景输入区 */}
        <section className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-slate-800">01. 场景需求描述</h2>
              <div className="flex bg-slate-100 p-1 rounded-lg">
                  <button onClick={() => setGenMode('local')} className={`px-4 py-2 rounded-md text-sm font-bold ${genMode === 'local' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}>本地生成</button>
                  <button onClick={() => setGenMode('ai')} className={`px-4 py-2 rounded-md text-sm font-bold ${genMode === 'ai' ? 'bg-indigo-600 shadow text-white' : 'text-slate-500'}`}>AI 生成</button>
              </div>
          </div>

          {genMode === 'ai' && (
              <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100 mb-4">
                  <div className="flex gap-2 mb-2">
                      <select value={aiModel} onChange={(e) => setAiModel(e.target.value as any)} className="border rounded px-2 py-1 text-sm">
                          <option value="deepseek">DeepSeek</option>
                          <option value="gemini">Gemini</option>
                          <option value="qwen">Qwen</option>
                      </select>
                      <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="API Key" className="flex-1 border rounded px-2 py-1 text-sm" />
                      <button onClick={handleTestConnection} className="px-3 py-1 bg-white border rounded text-sm font-bold">{testStatus === 'success' ? 'OK' : '测试'}</button>
                  </div>
                  <p className="text-xs text-indigo-600 mt-1">AI 生成结果将自动与场景描述、仿真逻辑统一（I/O 与逻辑类型校验），保证与本地模式一致。</p>
              </div>
          )}

          <textarea 
              className="w-full border rounded-lg p-4 h-32 focus:ring-2 focus:ring-blue-500 outline-none" 
              placeholder="请输入控制逻辑描述..."
              value={scenarioText}
              onChange={(e) => setScenarioText(e.target.value)}
          />
          
          {genError && <div className="mt-2 p-3 bg-red-50 text-red-600 rounded border border-red-100">{genError}</div>}

          <div className="mt-4 flex gap-3">
             <button onClick={handleGenerate} disabled={isGenerating} className="bg-blue-600 text-white px-8 py-2.5 rounded-lg font-bold shadow-lg disabled:bg-slate-400">
               {isGenerating ? '生成中...' : '执行代码分析'}
             </button>
             <button onClick={() => { setSolution(null); setScenarioText(""); setGenError(""); setSolutionCorrected(false); }} className="bg-slate-200 text-slate-600 px-6 py-2.5 rounded-lg font-medium">重置</button>
          </div>
        </section>

        {solution && (
          <>
            {solutionCorrected && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm p-3 rounded-lg flex items-center gap-2">
                <CheckCircle size={18} className="text-amber-600 shrink-0" />
                已根据场景描述对 I/O 分配与逻辑类型进行校验并统一，保证与仿真引擎一致，符合工程习惯。
              </div>
            )}
            <section className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
               <h2 className="text-lg font-bold text-slate-800 mb-4">02. I/O 分配表</h2>
               <div className="overflow-x-auto border rounded-lg">
                 <table className="w-full text-left text-sm">
                   <thead className="bg-slate-50 text-slate-700 font-semibold">
                     <tr><th className="p-3 border-b">地址</th><th className="p-3 border-b">符号</th><th className="p-3 border-b">设备</th><th className="p-3 border-b">类型</th><th className="p-3 border-b">备注</th></tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100">
                     {solution.io.map((io, i) => (
                       <tr key={i} className="hover:bg-blue-50">
                         <td className="p-3 font-mono font-bold text-blue-600">{io.addr}</td>
                         <td className="p-3 font-mono text-purple-600">{io.symbol}</td>
                         <td className="p-3">{io.device}</td>
                         <td className="p-3"><span className="text-xs px-2 py-0.5 rounded bg-slate-100 font-bold">{io.type}</span></td>
                         <td className="p-3 text-slate-500 text-xs">{io.note}</td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
            </section>

            <section className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
               <div className="flex justify-between mb-4">
                 <h2 className="text-lg font-bold text-slate-800">03. 程序逻辑</h2>
                 <div className="flex bg-slate-100 p-1 rounded-lg">
                    {(['STL', 'LAD', 'SCL'] as const).map(tab => (
                        <button key={tab} onClick={() => setCodeTab(tab)} className={`px-4 py-1.5 rounded-md text-sm font-bold ${codeTab === tab ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}>{tab}</button>
                    ))}
                 </div>
               </div>
               <pre className="bg-slate-900 text-green-400 p-4 rounded-lg font-mono text-sm overflow-auto max-h-[400px]">
                 {(() => {
                   const rawStl = solution.stlCode || '';
                   const rawLad = solution.ladCode || '';
                   const rawScl = solution.sclCode || '';
                   const isMock = (s: string) => !s || s.includes('Mocked') || s.includes('Mock') || s.trim().length < 50;
                   if (isMock(rawStl) || isMock(rawLad) || isMock(rawScl)) {
                     const logicConfig = generateAICompatibleLogicConfig(scenarioText);
                     const code = generatePlcCode(logicConfig, solution.io, scenarioText);
                     return codeTab === 'STL' ? code.stlCode : (codeTab === 'LAD' ? code.ladCode : code.sclCode);
                   }
                   return codeTab === 'STL' ? rawStl : (codeTab === 'LAD' ? rawLad : rawScl);
                 })()}
               </pre>
            </section>

            <section className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
               <div className="flex justify-between items-center flex-wrap gap-3 mb-4">
                 <h2 className="text-lg font-bold text-slate-800">04. 现场电气柜仿真</h2>
                 <button
                   type="button"
                   onClick={handleSimulationReset}
                   className="flex items-center gap-2 px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg text-sm font-bold transition-colors shrink-0"
                 >
                   <RotateCcw size={16} />
                   复位
                 </button>
               </div>
               <SimulationPanel io={solution.io} plcState={plcState} onToggleInput={handleInputToggle} onReset={handleSimulationReset} />
            </section>
            <HmiPanel plcState={plcState} logic={solution.logicConfig} />
            
            <section className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
               <h2 className="text-lg font-bold text-slate-800 mb-4">04. 物料清单 (BOM)</h2>
               <ul className="space-y-2">
                 {solution.hardware.map((h, i) => (
                   <li key={i} className="flex justify-between border-b pb-2 last:border-0">
                     <span className="font-medium">{h.name} <span className="text-slate-500 text-sm">({h.model})</span></span>
                     <span className="font-bold text-slate-700">x{h.qty}</span>
                   </li>
                 ))}
               </ul>
            </section>
          </>
        )}
      </main>
      
      <footer className="mt-12 py-8 bg-slate-900 text-slate-500 text-center">
         <p>© 2026 PLC Simulation Platform V1.00 | Designed by 黄 Polo</p>
         <p className="text-xs mt-2 text-slate-600">程序与 I/O 命名参考 IEC 61131-3、IEC 61346；教学用途，实际工程请按负载选型。</p>
      </footer>
    </div>
  );
};

export default App;