import React, { useState, useEffect, useRef } from 'react';
import { Settings, Cpu, Cog, Zap, Activity, Circle, Square, LayoutTemplate, Box, Bot, HardDrive, Key, Loader2, CheckCircle, XCircle, Ban, Save, Download, Info, ShieldAlert, Lock, RotateCcw, ChevronDown, ChevronRight, Copy } from 'lucide-react';
import { SCENARIOS } from './constants';
import { detectLogic, generateSolution, runPlcCycle } from './services/plcLogic';
import { validateAndNormalizeSolution, ensureProgramComplete, ensureBomMatchesIo } from './services/aiSolutionValidator';
import { inferLogicFromSolution } from './services/inferLogicFromSolution';
import { AI_MODEL_CONFIGS, type AiModelId } from './config/aiModels';
import { backendGenerate } from './services/backendAi';
import { PLCState, GeneratedSolution, LogicConfig } from './types';
import SimulationPanel from './components/SimulationPanel';
import HmiPanel from './components/HmiPanel';
import { ErrorBoundary } from './components/ErrorBoundary';

// Vite 环境变量：开发模式默认免登录
const _env = typeof import.meta !== 'undefined' && (import.meta as any).env ? (import.meta as any).env : {};
const APP_DISPLAY_NAME = _env.VITE_APP_NAME ?? 'PLC 编程仿真器';
const APP_DISPLAY_VERSION = _env.VITE_APP_VERSION ?? 'v2.0';
/** 构建时间（仅在生产构建时注入，开发时为 undefined） */
const APP_BUILD_TIME = typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : '';
// 开发模式默认免登录；生产仅当显式 VITE_APP_SKIP_LOGIN=true 时免登录（商用合规）
const SKIP_LOGIN = (typeof import.meta !== 'undefined' && (import.meta as any).env?.DEV)
  ? String((import.meta as any).env.VITE_APP_SKIP_LOGIN) !== 'false'
  : String(_env.VITE_APP_SKIP_LOGIN) === 'true';
// 生产环境禁止开发者后门；仅开发或显式 VITE_APP_DEV_BACKDOOR=true 时允许（商用合规）
const ALLOW_DEV_BACKDOOR = (typeof import.meta !== 'undefined' && (import.meta as any).env?.DEV) || String(_env.VITE_APP_DEV_BACKDOOR) === 'true';
/** 开发者调试入口密码（仅当 ALLOW_DEV_BACKDOOR 为 true 时有效；可在此修改） */
const DEV_DEBUG_PASSWORD = 'PoloDebug#2026';
/** Phase 1：生产环境使用后端 AI 代理，前端不接触 Key；开发可通过 VITE_APP_USE_BACKEND_AI 控制 */
const USE_BACKEND_AI = (typeof import.meta !== 'undefined' && (import.meta as any).env?.DEV)
  ? String(_env.VITE_APP_USE_BACKEND_AI) === 'true'
  : String(_env.VITE_APP_USE_BACKEND_AI) !== 'false';
/** 调试用：在浏览器控制台输入 __PLC_USE_BACKEND_AI 可查看当前构建的实际值（true=不显示 Key 输入框，false=显示） */
if (typeof window !== 'undefined') (window as any).__PLC_USE_BACKEND_AI = USE_BACKEND_AI;
/** 后端支持的模型（qwen 暂未接入后端） */
const BACKEND_MODELS: AiModelId[] = ['deepseek', 'gemini', 'codex'];

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
  const [aiModel, setAiModel] = useState<AiModelId>('deepseek');
  const [apiKey, setApiKey] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [genError, setGenError] = useState("");
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'fail'>('idle');
  const [testErrorDetail, setTestErrorDetail] = useState('');
  const [showAgreement, setShowAgreement] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [scenariosExpanded, setScenariosExpanded] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  // Simulation Loop Refs
  const stateRef = useRef<PLCState>(InitialState);
  const logicRef = useRef<LogicConfig | null>(null);

  // 开发模式默认免登录，直接进入主界面
  useEffect(() => {
    if (SKIP_LOGIN) setIsLoggedIn(true);
  }, []);

  // 后端模式下 qwen 未支持，自动切换到 deepseek
  useEffect(() => {
    if (USE_BACKEND_AI && !BACKEND_MODELS.includes(aiModel)) setAiModel('deepseek');
  }, [USE_BACKEND_AI, aiModel]);

  useEffect(() => {
    const savedKey = localStorage.getItem(`${aiModel}_key`);
    if (savedKey) {
        setApiKey(savedKey);
    } else {
        setApiKey("");
    }
  }, [aiModel]);

  const handleLogin = () => {
    if (ALLOW_DEV_BACKDOOR && password === DEV_DEBUG_PASSWORD) {
      setIsLoggedIn(true);
      setLoginError("");
      return;
    }
    if (password === 'HelloPLC') {
      setLoginError("内测期限已过，请确认开发者权限");
      return;
    }
    setLoginError("身份验证失败，请确认调试密钥");
  };

  const handleTestConnection = async () => {
    if (!apiKey.trim()) return;
    setTestStatus('testing');
    setTestErrorDetail('');
    try {
        const config = AI_MODEL_CONFIGS[aiModel];
        const ok = await config.testConnection(apiKey);
        setTestStatus(ok ? 'success' : 'fail');
        setTestErrorDetail('');
        if (ok) localStorage.setItem(`${aiModel}_key`, apiKey);
    } catch (e) {
        setTestStatus('fail');
        setTestErrorDetail(e instanceof Error ? e.message : String(e));
    }
  };

  const handleDisableAI = () => {
      setGenMode('local');
      setTestStatus('idle');
      setGenError("");
      setTestErrorDetail('');
  };

  const handleSaveKey = () => {
      localStorage.setItem(`${aiModel}_key`, apiKey);
      setTestStatus('idle'); 
  };

  const handleExportReport = () => {
    if (!solution) return;

    const htmlContent = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>PLC 控制方案导出报告 - ${new Date().toLocaleDateString()}</title>
<script src="https://cdn.tailwindcss.com"></script>
<style>
  @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&display=swap');
  body { font-family: sans-serif; background: #f8fafc; padding: 40px; } 
  .card { background: white; border-radius: 12px; padding: 24px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); margin-bottom: 24px; border: 1px solid #e2e8f0; }
  pre { font-family: 'JetBrains Mono', monospace; }
</style>
</head>
<body>
  <div class="max-w-4xl mx-auto">
    <div class="flex items-center justify-between mb-8">
      <div class="flex items-center gap-4">
        <div class="p-3 bg-blue-600 rounded-xl shadow-lg shadow-blue-500/30">
           <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="16" x="4" y="4" rx="2"/><rect width="6" height="6" x="9" y="9" rx="1"/><path d="M15 2v2"/><path d="M15 20v2"/><path d="M2 15h2"/><path d="M2 9h2"/><path d="M20 15h2"/><path d="M20 9h2"/><path d="M9 2v2"/><path d="M9 20v2"/></svg>
        </div>
        <div>
          <h1 class="text-3xl font-bold text-slate-800 tracking-tight">PLC 控制方案导出报告</h1>
          <p class="text-slate-500 font-medium">Generated by PLC Simulation Platform Pro</p>
        </div>
      </div>
      <div class="text-right">
        <div class="text-sm text-slate-400">导出时间</div>
        <div class="font-bold text-slate-700 font-mono">${new Date().toLocaleString()}</div>
      </div>
    </div>
    <div class="card border-l-4 border-l-blue-500">
      <h2 class="text-xl font-bold text-slate-800 mb-4 border-b pb-2 flex items-center gap-2">
         <span class="bg-blue-100 text-blue-600 w-6 h-6 rounded flex items-center justify-center text-xs">01</span> 场景需求
      </h2>
      <p class="text-slate-700 whitespace-pre-wrap leading-relaxed p-4 bg-slate-50 rounded-lg border border-slate-100">${scenarioText || '未填写需求'}</p>
    </div>
    <div class="card border-l-4 border-l-purple-500">
      <h2 class="text-xl font-bold text-slate-800 mb-4 border-b pb-2 flex items-center gap-2">
         <span class="bg-purple-100 text-purple-600 w-6 h-6 rounded flex items-center justify-center text-xs">02</span> I/O 分配表
      </h2>
      <div class="overflow-x-auto">
      <table class="w-full text-left text-sm border-collapse">
        <thead class="bg-slate-50 text-slate-700 uppercase text-xs tracking-wider">
          <tr>
            <th class="p-3 border-b">地址</th>
            <th class="p-3 border-b">符号</th>
            <th class="p-3 border-b">设备描述</th>
            <th class="p-3 border-b">类型</th>
            <th class="p-3 border-b">备注</th>
          </tr>
        </thead>
        <tbody>
          ${solution.io.map(io => `
            <tr class="hover:bg-slate-50 border-b border-slate-100 last:border-0">
              <td class="p-3 font-mono text-blue-600 font-bold bg-slate-50/50">${io.addr}</td>
              <td class="p-3 font-mono font-medium text-purple-700">${io.symbol}</td>
              <td class="p-3 text-slate-700">${io.device}</td>
              <td class="p-3"><span class="px-2 py-0.5 rounded text-xs font-bold ${io.type==='DI'?'bg-green-100 text-green-700': io.type==='DO'?'bg-orange-100 text-orange-700':'bg-slate-100 text-slate-600'}">${io.type}</span></td>
              <td class="p-3 text-slate-500 text-xs">${io.note}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      </div>
    </div>
    <div class="card border-l-4 border-l-green-500">
      <h2 class="text-xl font-bold text-slate-800 mb-4 border-b pb-2 flex items-center gap-2">
         <span class="bg-green-100 text-green-600 w-6 h-6 rounded flex items-center justify-center text-xs">03</span> 程序逻辑 (SCL & STL)
      </h2>
      <div class="mb-6">
        <div class="text-xs font-bold text-slate-500 mb-2 uppercase">SCL (Structured Control Language)</div>
        <pre class="bg-slate-900 text-green-400 p-4 rounded-lg overflow-x-auto text-sm shadow-inner">${solution.sclCode}</pre>
      </div>
      <div>
        <div class="text-xs font-bold text-slate-500 mb-2 uppercase">STL (Statement List)</div>
        <pre class="bg-slate-100 text-slate-600 p-4 rounded-lg overflow-x-auto text-sm border border-slate-200">${solution.stlCode}</pre>
      </div>
    </div>
    <div class="card border-l-4 border-l-orange-500">
      <h2 class="text-xl font-bold text-slate-800 mb-4 border-b pb-2 flex items-center gap-2">
         <span class="bg-orange-100 text-orange-600 w-6 h-6 rounded flex items-center justify-center text-xs">04</span> 物料清单 (BOM)
      </h2>
      <table class="w-full text-left text-sm border-collapse">
        <thead class="bg-slate-50 text-slate-700 uppercase text-xs tracking-wider">
          <tr>
            <th class="p-3 border-b">名称</th>
            <th class="p-3 border-b">型号</th>
            <th class="p-3 border-b">数量</th>
            <th class="p-3 border-b">用途</th>
          </tr>
        </thead>
        <tbody>
           ${solution.hardware.map(h => `
            <tr class="hover:bg-slate-50 border-b border-slate-100 last:border-0">
              <td class="p-3 font-medium text-slate-800">${h.name}</td>
              <td class="p-3 font-mono text-slate-500 text-xs">${h.model}</td>
              <td class="p-3 font-bold text-slate-700">${h.qty}</td>
              <td class="p-3 text-slate-500 italic">${h.note}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    <div class="text-center text-slate-400 text-sm mt-12 pb-8 border-t pt-8">
      Designed by 黄Polo | PLC Programming & Simulation Platform
    </div>
  </div>
</body>
</html>
    `;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `PLC_Solution_${new Date().toISOString().slice(0,10)}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleGenerate = async () => {
    if (!scenarioText.trim()) return;
    setGenError("");
    stateRef.current = JSON.parse(JSON.stringify(InitialState));
    setPlcState(stateRef.current);
    setSolution(null);
    logicRef.current = null;

    if (genMode === 'local') {
        try {
            const logic = detectLogic(scenarioText);
            const sol = generateSolution(logic, scenarioText);
            setSolution(sol);
            logicRef.current = logic;
            const newInputs: Record<string, boolean> = {};
            const newOutputs: Record<string, boolean> = {};
            sol.io.forEach((io: any) => {
                const key = io.addr || '';
                if (io.type === 'DI') newInputs[key] = false;
                if (io.type === 'DO') newOutputs[key] = false;
            });
            stateRef.current.inputs = newInputs;
            stateRef.current.outputs = newOutputs;
            setPlcState({ ...stateRef.current });
        } catch (e) {
            setGenError("本地生成失败，请检查输入。");
        }
    } else {
        if (!USE_BACKEND_AI && !apiKey.trim()) {
            setGenError(`请先输入 ${AI_MODEL_CONFIGS[aiModel].name} API Key`);
            return;
        }
        setIsGenerating(true);
        if (!USE_BACKEND_AI) localStorage.setItem(`${aiModel}_key`, apiKey);
        try {
            const logicHint = detectLogic(scenarioText);
            const aiPrompt = `${scenarioText}\n\n[logic_hints]\n${JSON.stringify(logicHint, null, 2)}`;
            let rawSol: GeneratedSolution;
            try {
                if (USE_BACKEND_AI && BACKEND_MODELS.includes(aiModel)) {
                    rawSol = await backendGenerate({
                        model: aiModel as 'deepseek' | 'gemini' | 'codex',
                        prompt: aiPrompt,
                        logicHints: logicHint,
                    });
                } else {
                    rawSol = await AI_MODEL_CONFIGS[aiModel].generate(apiKey, aiPrompt);
                }
            } catch (apiErr: any) {
                setGenError(`AI 请求失败：${apiErr?.message || String(apiErr)}`);
                const localSol = generateSolution(logicHint, scenarioText);
                setSolution(localSol);
                logicRef.current = logicHint;
                const newInputs: Record<string, boolean> = {};
                const newOutputs: Record<string, boolean> = {};
                localSol.io.forEach((io: any) => {
                    const key = io.addr || '';
                    if (io.type === 'DI') newInputs[key] = false;
                    if (io.type === 'DO') newOutputs[key] = false;
                });
                stateRef.current.inputs = newInputs;
                stateRef.current.outputs = newOutputs;
                setPlcState({ ...stateRef.current });
                return;
            }
            const validated = validateAndNormalizeSolution(rawSol);
            let sol: GeneratedSolution;
            if (!validated.valid) {
                setGenError(validated.error || 'AI 返回格式异常');
                sol = generateSolution(logicHint, scenarioText);
            } else {
                sol = validated.sol;
            }
            const aiLogic = (sol.logicConfig || {}) as Partial<LogicConfig>;
            // 方案一：从 I/O 与代码推断 HMI 类型，不增加 token，使设备仿真监控能对上 AI 生成方案
            const inferredLogic = inferLogicFromSolution(sol.io, sol.stlCode, sol.sclCode);
            const mergedLogic: LogicConfig = {
              ...aiLogic,
              ...logicHint,
              ...inferredLogic,
              // 对于布尔标志：规则识别、AI 返回、推断结果任一方为 true 即取 true
              hasStartStop: !!(aiLogic.hasStartStop || logicHint.hasStartStop || inferredLogic.hasStartStop),
              hasInterlock: !!(aiLogic.hasInterlock || logicHint.hasInterlock || inferredLogic.hasInterlock),
              hasDelayOn: !!(aiLogic.hasDelayOn || logicHint.hasDelayOn || inferredLogic.hasDelayOn),
              hasDoublePressStart: !!(aiLogic.hasDoublePressStart || logicHint.hasDoublePressStart || inferredLogic.hasDoublePressStart),
              hasCounting: !!(aiLogic.hasCounting || logicHint.hasCounting || inferredLogic.hasCounting),
              hasTrafficLight: !!(aiLogic.hasTrafficLight || logicHint.hasTrafficLight || inferredLogic.hasTrafficLight),
              hasSequencer: !!(aiLogic.hasSequencer || logicHint.hasSequencer || inferredLogic.hasSequencer),
              hasEmergency: !!(aiLogic.hasEmergency || logicHint.hasEmergency || inferredLogic.hasEmergency),
              hasLighting: !!(aiLogic.hasLighting || logicHint.hasLighting || inferredLogic.hasLighting),
              hasMultiModeLighting: !!(aiLogic.hasMultiModeLighting || logicHint.hasMultiModeLighting || inferredLogic.hasMultiModeLighting),
              hasMotor: !!(aiLogic.hasMotor || logicHint.hasMotor || inferredLogic.hasMotor),
              hasPump: !!(aiLogic.hasPump || logicHint.hasPump || inferredLogic.hasPump),
              hasStarDelta: !!(aiLogic.hasStarDelta || logicHint.hasStarDelta || inferredLogic.hasStarDelta),
              hasGarageDoor: !!(aiLogic.hasGarageDoor || logicHint.hasGarageDoor || inferredLogic.hasGarageDoor),
              hasMixingTank: !!(aiLogic.hasMixingTank || logicHint.hasMixingTank || inferredLogic.hasMixingTank),
              hasElevator: !!(aiLogic.hasElevator || logicHint.hasElevator || inferredLogic.hasElevator),
              hasPID: !!(aiLogic.hasPID || logicHint.hasPID || inferredLogic.hasPID),
              scenarioType: logicHint.scenarioType !== 'general'
                ? logicHint.scenarioType
                : (aiLogic.scenarioType && aiLogic.scenarioType !== 'general'
                  ? aiLogic.scenarioType
                  : (inferredLogic.scenarioType !== 'general' ? inferredLogic.scenarioType! : 'general')),
            };
            let enrichedSol: GeneratedSolution = { ...sol, logicConfig: mergedLogic };
            // 规则识别出双次启动但 AI 未返回时，用本地生成的程序替换，保证展示代码与仿真一致
            if (mergedLogic.hasDoublePressStart && !aiLogic.hasDoublePressStart) {
              const localSol = generateSolution(mergedLogic, scenarioText);
              enrichedSol = { ...enrichedSol, stlCode: localSol.stlCode, ladCode: localSol.ladCode, sclCode: localSol.sclCode };
            }
            // 结果检查：确保 STL/LAD/SCL 均有有效内容，缺则用本地生成补全
            enrichedSol = ensureProgramComplete(enrichedSol, mergedLogic, scenarioText);
            // 结果检查：确保 BOM 与 I/O 对应，缺项则按 I/O 推导并合并
            enrichedSol = { ...enrichedSol, hardware: ensureBomMatchesIo(enrichedSol.io, enrichedSol.hardware) };
            setSolution(enrichedSol);
            logicRef.current = mergedLogic;
            const newInputs: Record<string, boolean> = {};
            const newOutputs: Record<string, boolean> = {};
            enrichedSol.io.forEach((io: any) => {
                const key = io.addr || '';
                if (io.type === 'DI') newInputs[key] = false;
                if (io.type === 'DO') newOutputs[key] = false;
            });
            stateRef.current.inputs = newInputs;
            stateRef.current.outputs = newOutputs;
            setPlcState({ ...stateRef.current });
        } catch (error: any) {
            setGenError(`AI 生成失败：${error.message}`);
        } finally {
            setIsGenerating(false);
        }
    }
  };

  const handleInputToggle = (addr: string, isMomentary: boolean, isPressed: boolean) => {
      const key = addr || '';
      if (isMomentary) {
          stateRef.current.inputs[key] = isPressed;
      } else {
          if (isPressed) { 
             stateRef.current.inputs[key] = isPressed;
          }
      }
      setPlcState({...stateRef.current});
  };

  const handleSimulationReset = () => {
    if (!solution) return;
    const newInputs: Record<string, boolean> = {};
    const newOutputs: Record<string, boolean> = {};
    solution.io.forEach((io: any) => {
      const key = io.addr || '';
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
      const newState = runPlcCycle(stateRef.current.inputs, stateRef.current, logicRef.current, 50);
      stateRef.current = newState;
      setPlcState({...newState});
    }, 50);
    return () => clearInterval(interval);
  }, []);

  if (!isLoggedIn) {
    return (
      <div className="fixed inset-0 bg-slate-900 flex items-center justify-center z-50 p-4">
        <div className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] overflow-hidden border border-slate-700">
          
          {/* Expired Header */}
          <div className="bg-red-600 p-6 text-white flex flex-col items-center justify-center shrink-0">
             <div className="bg-white/20 p-3 rounded-full mb-3 backdrop-blur-sm">
                 <ShieldAlert className="text-white" size={32} />
             </div>
             <h2 className="text-2xl font-bold">Beta 内测阶段已结束</h2>
             <p className="text-red-100 opacity-90 text-sm mt-1">{APP_DISPLAY_NAME} {APP_DISPLAY_VERSION} - 访问受限</p>
          </div>

          {/* Expiration Notice Area */}
          <div className="flex-1 overflow-y-auto p-6 bg-slate-800 border-b border-slate-700">
             <div className="bg-slate-900 border border-slate-700 rounded-lg p-5 shadow-sm text-slate-300 text-sm leading-relaxed space-y-4">
                 <div className="flex items-center gap-2 text-red-500 font-bold text-base border-b border-slate-700 pb-2 mb-2">
                    <CheckCircle size={18} />
                    <span>📢 关于内测到期的重要声明</span>
                 </div>

                 <div>
                     <h3 className="font-bold text-white mb-1">一、 到期说明</h3>
                     <p>感谢您参与黄 Polo 之家 PLC 编程仿真器的 Beta 测试。按照原定计划，内测通道已于当前日期正式关闭工作。</p>
                     <ul className="list-disc pl-5 mt-2 space-y-1 marker:text-red-400">
                         <li><strong>公测状态：</strong>已结束 (OFFLINE)</li>
                         <li><strong>数据保护：</strong>您的测试反馈已同步至开发日志。</li>
                     </ul>
                 </div>

                 <div>
                     <h3 className="font-bold text-white mb-1">二、 正式版预告</h3>
                     <p>我们正在根据内测期间收集到的反馈进行深度优化：</p>
                     <ul className="list-disc pl-5 mt-1 space-y-1 marker:text-blue-400">
                         <li><span className="text-blue-400">AI 智能逻辑：</span>DeepSeek、Qwen Coder Plus或相关 API 深度适配。</li>
                         <li><span className="text-blue-400">Hmi 仿真增强：</span>更多工业组件支持。</li>
                         <li><strong>正式上线：</strong>敬请关注博主动态。</li>
                     </ul>
                 </div>

                 <div>
                     <h3 className="font-bold text-white mb-1">三、 开发者调试说明</h3>
                     <p className="text-slate-400">当前界面已转为开发者调试模式。非项目开发组成员请等待正式版本发布。</p>
                 </div>

                 <p className="mt-2 text-yellow-500 font-bold bg-yellow-500/10 p-2 rounded text-center border border-yellow-500/20">感谢在内测期间每一位建议的朋友！</p>
             </div>
          </div>

          {/* Developer Debug Input Area */}
          <div className="p-6 bg-slate-800 shrink-0">
             <div className="max-w-xs mx-auto w-full">
                <div className="relative mb-3">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                    <input 
                        type="password" 
                        placeholder="请输入开发者调试密钥" 
                        className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg pl-10 pr-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none transition-all text-center tracking-widest text-lg"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                    />
                </div>
                {loginError && <p className="text-red-400 text-sm mb-3 text-center font-bold bg-red-400/10 py-1 rounded border border-red-400/20">{loginError}</p>}
                <button 
                    onClick={handleLogin}
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-lg transition-colors shadow-lg active:scale-95 flex items-center justify-center gap-2"
                >
                    开发者调试入口 (Debug Entry)
                </button>
                <p className="text-[10px] text-slate-500 text-center mt-3 uppercase tracking-tighter">System locked. Access for authorized developers only.</p>
             </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen min-h-[100dvh] bg-slate-50 pb-[max(3rem,env(safe-area-inset-bottom))]">
      <header className="bg-slate-900 text-white py-4 sm:py-6 shadow-xl border-b-4 border-blue-500 pt-[env(safe-area-inset-top)]">
        <div className="container mx-auto px-3 sm:px-4 max-w-6xl">
          <div className="flex flex-col md:flex-row justify-between items-center gap-3 sm:gap-4">
            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                <div className="bg-blue-600 p-2 sm:p-3 rounded-lg shadow-lg shadow-blue-500/30 shrink-0">
                    <Cog size={28} className="text-white sm:w-8 sm:h-8" />
                </div>
                <div className="min-w-0">
                    <h1 className="text-lg sm:text-2xl font-extrabold tracking-tight flex flex-wrap items-center gap-2 sm:gap-3 truncate">
                        <span className="truncate">{APP_DISPLAY_NAME}</span>
                        <span className="bg-blue-600 text-xs px-2 py-0.5 rounded-full border border-blue-400 font-mono shrink-0">{APP_DISPLAY_VERSION}</span>
                    </h1>
                </div>
            </div>
            
            <div className="flex items-center gap-3 sm:gap-6 w-full md:w-auto justify-center md:justify-end flex-wrap">
                <div className="text-right hidden md:block">
                    <div className="text-xs text-slate-400 uppercase tracking-widest">Logged in as</div>
                </div>
                <div className="h-10 w-px bg-slate-700 hidden md:block"></div>
                 <div className="flex gap-2 sm:gap-4 text-xs sm:text-sm font-medium flex-wrap justify-center">
                     {solution && (
                         <button 
                            onClick={handleExportReport}
                            className="flex items-center gap-1.5 px-3 sm:px-4 py-2.5 sm:py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-white transition-all shadow-lg hover:shadow-blue-500/40 active:scale-95 border border-blue-500 touch-manipulation min-h-[44px]"
                         >
                            <Download size={16} /> <span className="whitespace-nowrap">导出方案</span>
                         </button>
                     )}
                     <div className="flex items-center gap-1.5 text-yellow-400 ml-0 sm:ml-2">
                       <Zap size={16} /> <span className="hidden sm:inline">智能生成</span>
                     </div>
                     <div className="flex items-center gap-1.5 text-green-400">
                       <Activity size={16} /> <span className="hidden sm:inline">逻辑仿真</span>
                     </div>
                     <div className="flex items-center gap-1.5 text-purple-400">
                       <LayoutTemplate size={16} /> <span className="hidden sm:inline">交互视窗</span>
                     </div>
                </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 mt-4 sm:mt-8 max-w-6xl space-y-4 sm:space-y-8">
        <ErrorBoundary fallbackTitle="功能加载异常">
        <section className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 border-b pb-4 gap-3 sm:gap-4">
              <h2 className="text-base sm:text-lg font-bold text-slate-800 flex items-center gap-2">
                <span className="bg-blue-100 text-blue-600 w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-xs sm:text-sm shrink-0">01</span> 
                场景需求描述
              </h2>
              <div className="flex bg-slate-100 p-1 rounded-lg w-full md:w-auto">
                  <button 
                    onClick={() => setGenMode('local')}
                    className={`flex-1 md:flex-none flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 rounded-md text-xs sm:text-sm font-bold transition-all touch-manipulation min-h-[44px] ${genMode === 'local' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    <HardDrive size={16} /> 本地生成
                  </button>
                  <button 
                    onClick={() => setGenMode('ai')}
                    className={`flex-1 md:flex-none flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 rounded-md text-xs sm:text-sm font-bold transition-all touch-manipulation min-h-[44px] ${genMode === 'ai' ? 'bg-indigo-600 shadow text-white' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    <Bot size={16} /> AI 智能生成
                  </button>
              </div>
          </div>

          <div className="space-y-4">
             {genMode === 'ai' && (
                 <div className="bg-indigo-50 p-3 sm:p-4 rounded-lg border border-indigo-100 mb-4 animate-in fade-in slide-in-from-top-2">
                     <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                         <div className="flex items-center gap-2">
                             <Key size={16} className="text-indigo-600 shrink-0" />
                             <span className="text-sm font-bold text-indigo-700">AI 模型配置</span>
                         </div>
                         <select
                             value={aiModel}
                             onChange={(e) => {
                                 setAiModel(e.target.value as AiModelId);
                                 setTestStatus('idle');
                             }}
                             className="bg-white border border-indigo-200 text-indigo-700 text-xs rounded px-2 py-1.5 outline-none focus:ring-1 focus:ring-indigo-500 font-bold w-full sm:w-auto min-h-[44px] sm:min-h-0"
                         >
                             {(USE_BACKEND_AI ? BACKEND_MODELS : (Object.keys(AI_MODEL_CONFIGS) as AiModelId[])).map((id) => (
                                 <option key={id} value={id}>{AI_MODEL_CONFIGS[id].name}{id === 'codex' ? ' (OpenAI)' : ''}</option>
                             ))}
                         </select>
                     </div>
                     {USE_BACKEND_AI ? (
                         <p className="text-sm text-indigo-600">AI 生成由平台提供，无需配置 API Key。</p>
                     ) : (
                         <>
                     <div className="flex flex-col sm:flex-row gap-2">
                         <input 
                            type="password" 
                            disabled={false} 
                            value={apiKey}
                            onChange={(e) => { setApiKey(e.target.value); setTestStatus('idle'); setTestErrorDetail(''); }}
                            placeholder={AI_MODEL_CONFIGS[aiModel].placeholder}
                            className="flex-1 min-w-0 px-4 py-2.5 sm:py-2 border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm bg-white text-slate-800 min-h-[44px] sm:min-h-0" 
                         />
                         <button
                            onClick={handleTestConnection}
                            disabled={testStatus === 'testing' || !apiKey}
                            className={`px-4 py-2.5 sm:py-2 rounded-lg text-sm font-bold transition-all border whitespace-nowrap min-w-[100px] flex justify-center items-center touch-manipulation min-h-[44px] sm:min-h-0 ${
                                testStatus === 'success' ? 'bg-green-100 text-green-700 border-green-200' : 
                                testStatus === 'fail' ? 'bg-red-100 text-red-700 border-red-200' :
                                'bg-white text-indigo-600 border-indigo-200 hover:bg-indigo-50'
                            }`}
                         >
                            {testStatus === 'testing' ? <Loader2 size={16} className="animate-spin" /> : 
                             testStatus === 'success' ? <div className="flex items-center gap-1"><CheckCircle size={16}/> 连接成功</div> :
                             testStatus === 'fail' ? <div className="flex items-center gap-1"><XCircle size={16}/> 连接失败</div> :
                             '连接测试'
                            }
                         </button>
                     </div>
                     {testStatus === 'fail' && testErrorDetail && (
                         <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                             <p className="text-xs font-bold text-amber-800 mb-1">错误详情（API 原始返回）</p>
                             <pre className="text-xs text-slate-700 overflow-x-auto whitespace-pre-wrap break-words max-h-32 overflow-y-auto">{testErrorDetail}</pre>
                         </div>
                     )}
                     <div className="flex justify-between items-center mt-3 flex-wrap gap-2">
                          <div className="text-xs text-indigo-400">
                              当前模型：<span className="font-mono font-bold">{AI_MODEL_CONFIGS[aiModel].modelLabel}</span>
                          </div>
                          <div className="flex gap-2">
                              <button 
                                 onClick={handleSaveKey}
                                 className="text-xs font-bold text-indigo-600 hover:text-indigo-800 px-3 py-1.5 hover:bg-indigo-100 rounded transition-colors flex items-center gap-1"
                              >
                                 <Save size={12} /> 确定保存
                              </button>
                              <button 
                                 onClick={handleDisableAI}
                                 className="text-xs font-bold text-slate-500 hover:text-red-600 px-3 py-1.5 hover:bg-red-50 rounded transition-colors flex items-center gap-1"
                              >
                                 <Ban size={12} /> 禁用 AI 功能
                              </button>
                          </div>
                     </div>
                         </>
                     )}
                 </div>
             )}

             <div className="relative">
                <textarea 
                    className={`w-full border rounded-lg p-3 sm:p-4 text-base sm:text-lg focus:ring-2 outline-none transition-shadow min-h-[100px] sm:min-h-[120px] ${genMode === 'ai' ? 'border-indigo-200 focus:ring-indigo-500' : 'border-slate-300 focus:ring-blue-500'} bg-white text-slate-800`} 
                    rows={3}
                    placeholder="请输入控制逻辑描述..."
                    value={scenarioText}
                    onChange={(e) => setScenarioText(e.target.value)}
                />
                <div className="absolute bottom-2 right-2 sm:bottom-3 sm:right-3 text-xs text-slate-400">
                    {genMode === 'ai' ? `${AI_MODEL_CONFIGS[aiModel].name} 强力驱动` : '支持自然语言解析'}
                </div>
             </div>
          </div>

          {genError && (
              <div className="mt-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100 flex items-center gap-2">
                  <Circle size={8} className="fill-red-500" /> {genError}
              </div>
          )}
          
          <div className="mt-4 bg-slate-50 rounded-lg border border-slate-100 overflow-hidden">
            <button
              type="button"
              onClick={() => setScenariosExpanded((v) => !v)}
              className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left text-sm font-bold text-slate-600 hover:bg-slate-100/80 transition-colors touch-manipulation min-h-[44px]"
              aria-expanded={scenariosExpanded}
            >
              <span className="flex items-center gap-2">
                {scenariosExpanded ? <ChevronDown size={18} className="text-slate-500 shrink-0" /> : <ChevronRight size={18} className="text-slate-500 shrink-0" />}
                <span className="uppercase tracking-wider text-slate-500">⚡ 典型场景示例</span>
              </span>
              <span className="text-xs text-slate-400 font-normal">{scenariosExpanded ? '点击收起' : '点击展开'}</span>
            </button>
            {scenariosExpanded && (
              <div className="px-4 pb-4 pt-0 border-t border-slate-100">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-3">
                  {SCENARIOS.map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => setScenarioText(item.text)}
                      className="text-left text-sm text-slate-600 hover:text-blue-600 hover:bg-white border border-transparent hover:border-blue-200 hover:shadow-sm px-3 py-2.5 rounded transition-all truncate touch-manipulation min-h-[44px]"
                      title={item.text}
                    >
                      • {item.title}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="mt-6 flex flex-col sm:flex-row gap-3">
             <button 
                onClick={handleGenerate}
                disabled={isGenerating}
                className={`text-white px-6 sm:px-8 py-3 sm:py-2.5 rounded-lg font-bold shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 touch-manipulation min-h-[48px] ${isGenerating ? 'bg-slate-400 cursor-not-allowed' : (genMode === 'ai' ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/30' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/30')}`}
             >
               {isGenerating ? <Loader2 size={18} className="animate-spin" /> : (genMode === 'ai' ? <Bot size={18} /> : <Cpu size={18} />)}
               {isGenerating ? '正在生成PLC程序...' : '一键生成PLC程序'}
             </button>
             <button 
                onClick={() => {
                  setSolution(null);
                  setScenarioText("");
                  setGenError("");
                  setPlcState(JSON.parse(JSON.stringify(InitialState)));
                  stateRef.current = JSON.parse(JSON.stringify(InitialState));
                }}
                className="bg-slate-200 hover:bg-slate-300 text-slate-600 px-6 py-3 sm:py-2.5 rounded-lg font-medium transition-colors touch-manipulation min-h-[48px]"
             >
               重置工作区
             </button>
          </div>
        </section>

        {solution && (
          <>
            <section className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-slate-200">
               <h2 className="text-base sm:text-lg font-bold text-slate-800 mb-4 flex items-center gap-2 border-b pb-2">
                <span className="bg-blue-100 text-blue-600 w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-xs sm:text-sm shrink-0">02</span> 
                I/O 分配表 (Input/Output)
               </h2>
               <div className="overflow-x-auto -mx-2 sm:mx-0 border rounded-lg overflow-y-visible" style={{ WebkitOverflowScrolling: 'touch' }}>
                 <table className="w-full text-left text-xs sm:text-sm min-w-[600px]">
                   <thead className="bg-slate-50 text-slate-700 font-semibold uppercase tracking-wider text-xs">
                     <tr>
                       <th className="p-3 border-b">地址 (Addr)</th>
                       <th className="p-3 border-b">符号 (Symbol)</th>
                       <th className="p-3 border-b">设备名称 (Device)</th>
                       <th className="p-3 border-b">类型 (Type)</th>
                       <th className="p-3 border-b">电气特性</th>
                       <th className="p-3 border-b">接线位置/备注</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100">
                     {solution.io.map((io, i) => (
                       <tr key={i} className="hover:bg-blue-50/50 transition-colors">
                         <td className="p-3 font-mono font-bold text-blue-600 bg-slate-50/50">{io.addr}</td>
                         <td className="p-3 font-mono text-purple-600 font-medium">{io.symbol}</td>
                         <td className="p-3 text-slate-700">{io.device}</td>
                         <td className="p-3"><span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${io.type==='DI'?'bg-green-100 text-green-700': io.type==='DO'?'bg-orange-100 text-orange-700':'bg-slate-100'}`}>{io.type}</span></td>
                         <td className="p-3 text-slate-500 text-xs">
                           {io.isMomentary ? (
                             <span className="inline-flex items-center gap-1">
                               <Circle size={8} className="fill-current text-slate-400"/> 点动 (NO)
                             </span>
                           ) : (
                             <span className="inline-flex items-center gap-1">
                               <Square size={8} className="fill-current text-slate-400"/> 自锁 (Switch)
                             </span>
                           )}
                         </td>
                         <td className="p-3 text-slate-500 text-xs font-mono">{io.location || '-'}</td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
            </section>
            <section className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-slate-200">
               <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-4 gap-3 sm:gap-4">
                 <h2 className="text-base sm:text-lg font-bold text-slate-800 flex items-center gap-2">
                    <span className="bg-blue-100 text-blue-600 w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-xs sm:text-sm shrink-0">03</span> 
                    PLC 程序逻辑 (Program)
                 </h2>
                 <div className="flex flex-wrap items-center gap-2">
                   <div className="flex bg-slate-100 p-1 rounded-lg overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
                    <button 
                      onClick={() => setCodeTab('STL')}
                      className={`px-3 sm:px-4 py-2 sm:py-1.5 rounded-md text-xs sm:text-sm font-bold transition-all shrink-0 touch-manipulation min-h-[44px] sm:min-h-0 ${codeTab === 'STL' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      语句表 (STL)
                    </button>
                    <button 
                      onClick={() => setCodeTab('LAD')}
                      className={`px-3 sm:px-4 py-2 sm:py-1.5 rounded-md text-xs sm:text-sm font-bold transition-all shrink-0 touch-manipulation min-h-[44px] sm:min-h-0 ${codeTab === 'LAD' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      梯形图 (LAD)
                    </button>
                    <button 
                      onClick={() => setCodeTab('SCL')}
                      className={`px-3 sm:px-4 py-2 sm:py-1.5 rounded-md text-xs sm:text-sm font-bold transition-all shrink-0 touch-manipulation min-h-[44px] sm:min-h-0 ${codeTab === 'SCL' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      结构化文本 (SCL)
                    </button>
                 </div>
                 <button
                   type="button"
                   onClick={() => {
                     const stl = solution.stlCode || '';
                     const lad = solution.ladCode || '';
                     const scl = solution.sclCode || '';
                     const isEmpty = (s: string) => !s || s.trim().length < 20 || /mock|placeholder|todo|请检查|please/i.test(s);
                     let code: string;
                     if (isEmpty(stl) && isEmpty(lad) && isEmpty(scl)) {
                       const t = scenarioText.toLowerCase();
                       const title = `// 场景：${scenarioText}\n`;
                       if (/红绿灯|交通灯|信号灯|traffic/i.test(t)) {
                         const c = title + `NETWORK 1: 启动\nA     I0.0\n=     M0.0\n\nNETWORK 2: 周期 12s\nLD    M0.0\nTON   T37, 120\n\nNETWORK 3: 红灯 0-5s\nA     M0.0\nAW<   T37, 50\n=     Q0.0\n\nNETWORK 4: 黄灯 5-7s\nAW>=  T37, 50\nAW<   T37, 70\n=     Q0.1\n\nNETWORK 5: 绿灯 7-12s\nAW>=  T37, 70\n=     Q0.2`;
                         const ladCode = title + `Network 1: |--[ I0.0 ]--( M0.0 )--|\nNetwork 2: |--[ M0.0 ]--( TON T37, 12s )--|\nNetwork 3: |--[ M0.0 ]--[ T37<5s ]--( Q0.0 )--|\nNetwork 4: |--[ T37>=5s ]--[ T37<7s ]--( Q0.1 )--|\nNetwork 5: |--[ T37>=7s ]--( Q0.2 )--|`;
                         const sclCode = title + `"M0.0" := "I0.0";\n"T37".TON(IN := "M0.0", PT := T#12s);\n"Q0.0" := "M0.0" AND "T37".ET < T#5s;\n"Q0.1" := "T37".ET >= T#5s AND "T37".ET < T#7s;\n"Q0.2" := "T37".ET >= T#7s;`;
                         code = codeTab === 'STL' ? c : (codeTab === 'LAD' ? ladCode : sclCode);
                       } else {
                         const defStl = title + `NETWORK 1: 启停自锁\nA     I0.0\nO     M0.0\nAN    I0.1\n=     M0.0\n\nNETWORK 2: 输出\nA     M0.0\nAN    I0.1\n=     Q0.0`;
                         const defLad = title + `Network 1: |--[ I0.0 ]--O--[ M0.0 ]--/ [ I0.1 ]--( M0.0 )--|\nNetwork 2: |--[ M0.0 ]--/ [ I0.1 ]--( Q0.0 )--|`;
                         const defScl = title + `"M0.0" := ("I0.0" OR "M0.0") AND NOT "I0.1";\n"Q0.0" := "M0.0" AND NOT "I0.1";`;
                         code = codeTab === 'STL' ? defStl : (codeTab === 'LAD' ? defLad : defScl);
                       }
                     } else {
                       code = codeTab === 'STL' ? stl : (codeTab === 'LAD' ? lad : scl);
                     }
                     navigator.clipboard.writeText(code).then(() => {
                       setCopySuccess(true);
                       setTimeout(() => setCopySuccess(false), 2000);
                     });
                   }}
                   className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors shrink-0 touch-manipulation min-h-[44px] sm:min-h-0"
                   title="复制当前代码到剪贴板"
                 >
                   <Copy size={16} />
                   {copySuccess ? '已复制' : '复制代码'}
                 </button>
                 </div>
               </div>
               <div className="relative">
                   <div className="absolute top-0 left-0 bottom-0 w-8 bg-slate-800 rounded-l-lg border-r border-slate-700"></div>
                   <pre className="bg-slate-900 text-green-400 p-3 sm:p-4 pl-10 sm:pl-12 rounded-lg font-mono text-xs sm:text-sm overflow-auto max-h-[400px] sm:max-h-[500px] border border-slate-700 shadow-inner leading-relaxed">
                     {(() => {
                       const stl = solution.stlCode || '';
                       const lad = solution.ladCode || '';
                       const scl = solution.sclCode || '';
                       const isEmpty = (s: string) => !s || s.trim().length < 20 || /mock|placeholder|todo|请检查|please/i.test(s);
                       if (isEmpty(stl) && isEmpty(lad) && isEmpty(scl)) {
                         const t = scenarioText.toLowerCase();
                         const title = `// 场景：${scenarioText}\n`;
                         if (/红绿灯|交通灯|信号灯|traffic/i.test(t)) {
                           const code = title + `NETWORK 1: 启动\nA     I0.0\n=     M0.0\n\nNETWORK 2: 周期 12s\nLD    M0.0\nTON   T37, 120\n\nNETWORK 3: 红灯 0-5s\nA     M0.0\nAW<   T37, 50\n=     Q0.0\n\nNETWORK 4: 黄灯 5-7s\nAW>=  T37, 50\nAW<   T37, 70\n=     Q0.1\n\nNETWORK 5: 绿灯 7-12s\nAW>=  T37, 70\n=     Q0.2`;
                           const ladCode = title + `Network 1: |--[ I0.0 ]--( M0.0 )--|\nNetwork 2: |--[ M0.0 ]--( TON T37, 12s )--|\nNetwork 3: |--[ M0.0 ]--[ T37<5s ]--( Q0.0 )--|\nNetwork 4: |--[ T37>=5s ]--[ T37<7s ]--( Q0.1 )--|\nNetwork 5: |--[ T37>=7s ]--( Q0.2 )--|`;
                           const sclCode = title + `"M0.0" := "I0.0";\n"T37".TON(IN := "M0.0", PT := T#12s);\n"Q0.0" := "M0.0" AND "T37".ET < T#5s;\n"Q0.1" := "T37".ET >= T#5s AND "T37".ET < T#7s;\n"Q0.2" := "T37".ET >= T#7s;`;
                           return codeTab === 'STL' ? code : (codeTab === 'LAD' ? ladCode : sclCode);
                         }
                         const defStl = title + `NETWORK 1: 启停自锁\nA     I0.0\nO     M0.0\nAN    I0.1\n=     M0.0\n\nNETWORK 2: 输出\nA     M0.0\nAN    I0.1\n=     Q0.0`;
                         const defLad = title + `Network 1: |--[ I0.0 ]--O--[ M0.0 ]--/ [ I0.1 ]--( M0.0 )--|\nNetwork 2: |--[ M0.0 ]--/ [ I0.1 ]--( Q0.0 )--|`;
                         const defScl = title + `"M0.0" := ("I0.0" OR "M0.0") AND NOT "I0.1";\n"Q0.0" := "M0.0" AND NOT "I0.1";`;
                         return codeTab === 'STL' ? defStl : (codeTab === 'LAD' ? defLad : defScl);
                       }
                       return codeTab === 'STL' ? stl : (codeTab === 'LAD' ? lad : scl);
                     })()}
                   </pre>
               </div>
            </section>

            <section className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-slate-200">
               <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center flex-wrap gap-3 mb-4">
                 <h2 className="text-base sm:text-lg font-bold text-slate-800">04. 现场电气柜仿真</h2>
                 <button
                   type="button"
                   onClick={handleSimulationReset}
                   className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-600 hover:bg-slate-700 text-white rounded-lg text-sm font-bold transition-colors shrink-0 touch-manipulation min-h-[44px]"
                 >
                   <RotateCcw size={16} />
                   复位
                 </button>
               </div>
            <SimulationPanel 
              io={solution.io} 
              plcState={plcState} 
              onToggleInput={handleInputToggle}
              onReset={handleSimulationReset}
            />
            <HmiPanel 
              plcState={plcState} 
              logic={solution.logicConfig} 
            />
            </section>
            <section className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-slate-200">
               <h2 className="text-base sm:text-lg font-bold text-slate-800 mb-4 flex items-center gap-2 border-b pb-2">
                <span className="bg-blue-100 text-blue-600 w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-xs sm:text-sm shrink-0">06</span> 
                物料清单 (BOM)
               </h2>
               <div className="overflow-x-auto -mx-2 sm:mx-0 border rounded-lg" style={{ WebkitOverflowScrolling: 'touch' }}>
                 <table className="w-full text-left text-xs sm:text-sm min-w-[500px]">
                   <thead className="bg-slate-50 text-slate-700 font-semibold uppercase tracking-wider text-xs">
                     <tr>
                       <th className="p-3 border-b w-16">序号</th>
                       <th className="p-3 border-b">物品名称</th>
                       <th className="p-3 border-b">规格型号 (参考)</th>
                       <th className="p-3 border-b">数量</th>
                       <th className="p-3 border-b">单位</th>
                       <th className="p-3 border-b">备注/用途</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100">
                     {solution.hardware.map((item, i) => (
                       <tr key={i} className="hover:bg-slate-50 transition-colors">
                         <td className="p-3 text-slate-400 font-mono text-xs">{i + 1}</td>
                         <td className="p-3 font-medium text-slate-800 flex items-center gap-2">
                             <Box size={14} className="text-blue-400" />
                             {item.name}
                         </td>
                         <td className="p-3 text-slate-600 font-mono text-xs">{item.model}</td>
                         <td className="p-3 font-bold text-slate-700">{item.qty}</td>
                         <td className="p-3 text-slate-500 text-xs">PCS</td>
                         <td className="p-3 text-slate-500 text-xs italic">{item.note}</td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
               <div className="mt-4 text-xs text-slate-400 text-right">
                   * 物料型号仅供教学参考，实际工程请依据负载功率选型。
               </div>
            </section>
          </>
        )}
      </ErrorBoundary>
      </main>

      <footer className="mt-8 sm:mt-12 py-6 sm:py-8 px-3 sm:px-4 bg-slate-900 text-slate-500 text-center border-t border-slate-800 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
         <p className="font-medium text-sm sm:text-base">© 2026 {APP_DISPLAY_NAME} {APP_DISPLAY_VERSION}</p>
         {APP_BUILD_TIME && (
           <p className="text-xs mt-1 text-slate-500">构建时间：{new Date(APP_BUILD_TIME).toLocaleString('zh-CN', { dateStyle: 'short', timeStyle: 'short' })}</p>
         )}
         <p className="text-xs mt-2 text-slate-500 max-w-xl mx-auto">本产品仅供教学/方案参考，不替代实际 PLC 工程验证与安全认证。</p>
         <p className="text-sm mt-3 flex items-center justify-center gap-4 flex-wrap">
           <a href="#" onClick={(e) => { e.preventDefault(); setShowAgreement(true); }} className="hover:text-slate-300 underline">用户服务协议</a>
           <a href="#" onClick={(e) => { e.preventDefault(); setShowPrivacy(true); }} className="hover:text-slate-300 underline">隐私政策</a>
         </p>
         <p className="text-sm mt-2">Designed & Developed by 黄 Polo</p>
      </footer>

      {showAgreement && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowAgreement(false)}>
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[80vh] overflow-auto p-6 text-left text-slate-800 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">用户服务协议</h3>
            <p className="text-sm text-slate-600 mb-4">欢迎使用 PLC 编程仿真器。使用本服务即表示您同意以下条款：</p>
            <ul className="text-sm text-slate-600 list-disc pl-5 space-y-1 mb-4">
              <li>本产品仅供教学与方案参考，仿真结果不替代实际 PLC 工程验证与安全认证。</li>
              <li>禁止将本服务用于任何违法、侵权或违反公序良俗的用途。</li>
              <li>账号与数据使用规则以平台公示为准；争议解决适用中华人民共和国法律。</li>
            </ul>
            <p className="text-xs text-slate-500">完整协议由运营方另行公示，必要时请由法务审阅。</p>
            <button type="button" className="mt-4 w-full py-2 bg-slate-200 hover:bg-slate-300 rounded-lg text-sm font-medium" onClick={() => setShowAgreement(false)}>关闭</button>
          </div>
        </div>
      )}
      {showPrivacy && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowPrivacy(false)}>
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[80vh] overflow-auto p-6 text-left text-slate-800 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">隐私政策</h3>
            <p className="text-sm text-slate-600 mb-4">我们重视您的隐私。本产品可能收集或使用的信息包括：</p>
            <ul className="text-sm text-slate-600 list-disc pl-5 space-y-1 mb-4">
              <li>为提供 AI 生成服务而提交的场景描述等文本；</li>
              <li>登录与使用记录（如用于安全与产品改进）；</li>
              <li>若您自行配置 API Key，该信息仅存于本地或按平台说明加密托管，我们不会在日志中记录完整 Key。</li>
            </ul>
            <p className="text-xs text-slate-500">数据留存期限、第三方共享及您享有的查阅/删除等权利，以运营方完整隐私政策为准。若面向欧盟用户需考虑 GDPR。</p>
            <button type="button" className="mt-4 w-full py-2 bg-slate-200 hover:bg-slate-300 rounded-lg text-sm font-medium" onClick={() => setShowPrivacy(false)}>关闭</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;