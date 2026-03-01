# PLC 编程仿真器 — 优化评估与更新说明

## 一、评估总览

从**界面**与**功能**角度，并结合**AI 智能生成模式下程序生成、仿真、场景描述的契合度**及**工程标准/国际规范**，形成以下结论与已做更新。

---

## 二、界面优化建议与已做项

| 项目 | 建议 | 状态 |
|------|------|------|
| 生成模式区分 | 本地 / AI 模式切换处已有区分，可考虑在 AI 模式下增加“校验说明” | ✅ 已增加：AI 模式下提示“AI 生成结果将自动与场景描述、仿真逻辑统一” |
| 典型场景示例 | 与当前模式联动（本地 vs AI） | 可选：后续可为 AI 模式增加“推荐自然语言描述”示例 |
| 结果反馈 | 当 AI 结果被自动修正时，应明确提示用户 | ✅ 已增加：修正后显示“已根据场景描述对 I/O 分配与逻辑类型进行校验并统一…” |
| 工程规范标注 | 标明参考标准，便于教学与工程对接 | ✅ 已增加：页脚注明“参考 IEC 61131-3、IEC 61346；教学用途，实际工程请按负载选型” |

---

## 三、功能优化 — 重点：AI 模式契合度

### 3.1 问题简述

- **本地生成**：`detectLogic` + `generateSolution` 与 `runPlcCycle` 同源，I/O、逻辑类型、仿真一致。
- **AI 生成**：各 API（DeepSeek / Gemini / Qwen）返回的 IO 表、`logicConfig`、BOM 可能与本地语义不一致，导致：
  - 仿真用到的地址、类型与“场景描述”不一致；
  - 同一段场景在“本地”和“AI”下表现不一致。

### 3.2 已实现的解决方案

1. **统一语义来源**  
   使用与本地模式一致的 `generateAICompatibleLogicConfig(scenarioText)` 作为**唯一**场景语义来源（复刻 `plcLogic.detectLogic` 的识别规则），保证：
   - 场景类型（电梯、交通灯、星三角、正反转、启停等）判定与本地一致；
   - 正则与优先级（如交通灯 vs 普通照明）与本地一致。

2. **AI 响应验证与自动修正引擎**  
   新增 `validateAndCorrectSolution(rawSolution, scenarioText)`：
   - **输入**：AI 原始返回的 `GeneratedSolution` + 用户输入的场景描述。
   - **步骤**：  
     - 用 `generateAICompatibleLogicConfig(scenarioText)` 得到标准 `logicConfig`；  
     - 按该 config 重新生成**标准 I/O 表**和**BOM**（与本地 `generateSolution` 对齐）；  
     - 保留 AI 生成的 STL/LAD/SCL 文本，但**强制替换** `io`、`hardware`、`logicConfig`。
   - **输出**：修正后的 `GeneratedSolution` + `corrected` 标志。
   - **效果**：无论哪家 AI 返回什么，最终交给仿真和 HMI 的 I/O 与逻辑类型都与“场景描述”一致，与本地模式同一套逻辑。

3. **AI 流程统一**  
   在 `handleGenerate` 中，对所有 AI 提供商（DeepSeek / Gemini / Qwen）：
   - 先取原始 `sol`；
   - 再执行 `validateAndCorrectSolution(sol, scenarioText)`；
   - 用修正后的 `solution` 更新状态并驱动仿真，必要时设置 `solutionCorrected` 以显示提示。

4. **状态 key 统一**  
   仿真状态中 input/output 的 key 与 I/O 地址一一对应：统一使用 `io.addr.replace(/[._]/g, '_')` 生成 key，在初始化与 `handleInputToggle` 中一致，避免按键与仿真不同步。

---

## 四、工程标准与国际规范

- **IEC 61131-3**：STL / LAD / SCL 的语法与命名习惯；当前生成的代码与 I/O 符号按该习惯命名。
- **IEC 61346**：结构标识与设备命名；I/O 表与 BOM 中的“设备/符号/位置”可按该标准理解与扩展。
- **说明**：页脚已注明“程序与 I/O 命名参考 IEC 61131-3、IEC 61346；教学用途，实际工程请按负载选型”，便于教学与工程对接。

---

## 五、后续可做增强（建议）

1. **AI 返回代码的地址校验**  
   若 AI 返回的 STL/LAD/SCL 中出现未在标准 I/O 表中的地址，可做一次扫描并提示“代码中存在未在 I/O 表中定义的地址”，或给出映射建议。

2. **场景示例与模式联动**  
   在 AI 模式下，在“典型场景示例”下增加一句“推荐用完整自然语言描述（如：三层电梯，带呼叫与方向指示）”，提升首次使用时的契合度观感。

3. **导出内容**  
   导出报告可包含：场景描述、识别到的逻辑类型、I/O 表、BOM、三视图代码，便于存档和符合工程文档习惯。

4. **plcLogic 单源**  
   若 `services/plcLogic.ts` 与 App 内 `generateAICompatibleLogicConfig` 长期并存，建议将“场景 → LogicConfig”抽成单一模块（如 `scenarioSemantics.ts`），本地与 AI 共用，避免两处正则不一致。

---

## 六、本次代码变更摘要

- **App.tsx**
  - 新增 `validateAndCorrectSolution(rawSolution, scenarioText)`，对 AI 结果做 I/O、BOM、logicConfig 的校验与修正。
  - AI 模式下生成后统一走该校验，并设置 `solutionCorrected`。
  - 新增状态 `solutionCorrected`，修正时显示提示条。
  - AI 配置区增加一句说明：“AI 生成结果将自动与场景描述、仿真逻辑统一（I/O 与逻辑类型校验）”。
  - 页脚增加规范说明（IEC 61131-3、IEC 61346，教学/工程选型提示）。
  - 重置时清除 `solutionCorrected`；`handleInputToggle` 与 state 的 key 已统一（此前已按 addr 归一化）。

以上更新均在**不改变本地生成逻辑**的前提下，**仅对 AI 智能生成模式**做校验与修正，从而提高“程序生成 — 仿真 — 场景描述”的契合度，并体现工程标准与国际规范。
