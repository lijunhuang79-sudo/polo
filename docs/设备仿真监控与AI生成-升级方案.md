# 设备仿真监控与 AI 生成 — 升级方案

## 一、设备仿真监控是不是独立库？

**不是。** 设备仿真监控是项目内的两个组件：

- **SimulationPanel**（`src/components/SimulationPanel.tsx`）  
  根据 `solution.io` 和 `plcState` 动态渲染「现场电气柜」的 I/O 卡片（按钮、灯、接触器等），**与生成模式无关**，只要有 I/O 表就会显示，本地/AI 生成都会用到。

- **HmiPanel**（`src/components/HmiPanel.tsx`）  
  即标题为「设备仿真监控」的区块，内部有多类**预设子面板**（电梯、红绿灯、混合罐、星三角、计数、车库门、三模式灯具、PID、通用电机等），**由 `logic: LogicConfig` 的布尔字段决定显示哪一个**（如 `logic.hasElevator` → 电梯仿真、`logic.hasTrafficLight` → 红绿灯等）。  
  数据来源：`plcState`（实时 I/O/定时器/物理量）+ `logic`（场景类型）。

因此：**仿真监控的“动画效果”完全由 `LogicConfig`（hasXXX / scenarioType）驱动，不是独立第三方库，而是和当前 solution/logic 强绑定。**

---

## 二、现状与问题

- **本地生成**：`detectLogic(scenarioText)` 从自然语言里规则识别出 hasXXX → 生成 solution 时 logic 已确定 → HmiPanel 能正确选到对应子面板（电梯/红绿灯等），**表现一致**。
- **AI 智能生成**：
  - 后端/前端会把「本地规则识别的 logicHint」和「AI 返回的 logicConfig」做 **merge**（见 `App.tsx` 里 mergedLogic）。
  - 若 AI **不返回或很少返回** logicConfig（很多模型只返回 io / stlCode / sclCode），则 mergedLogic 几乎完全依赖本地的 `detectLogic(scenarioText)`。
  - 结果：
    - 用户描述**能命中**本地关键词（如“三层电梯”“红绿灯”）时，HMI 仍能对上；
    - 描述较泛、或 AI 生成了**非预设场景**（如“传送带+光电计数”“自定义顺序控制”）时，detectLogic 只给出 general → HmiPanel 只显示 **GenericPanel**（通用电机/启停/急停），看起来就像「设备仿真监控没有任何变化」。

**矛盾**：  
若让 AI **自动生成“动画/界面描述”**（例如描述每个元件、动画行为），会消耗大量 token，且需要前端新做一套解析与渲染；若**不改**，AI 方案与设备仿真监控容易脱节。

---

## 三、升级思路（在少占 token 的前提下对齐 HMI）

目标：**尽量不增加或只增加极少 token，让 AI 生成的结果也能驱动合适的设备仿真监控界面。**

下面三种方案从“零额外 token”到“极少 token”排列，可组合使用。

---

### 方案一（推荐）：基于 I/O 与代码的「本地二次推断」— 不增加 token

**思路**：AI 仍然只返回 **io / stlCode / sclCode / hardware**（及可选的 logicConfig）；在拿到 AI 的 solution 之后，**在前端或后端做一次“从 I/O 表 + 代码特征推断 HMI 类型”**，把推断结果写回 `logicConfig`，再交给 HmiPanel。

**做法要点**：

- 新增一个纯函数，例如：`inferLogicFromSolution(io, stlCode?, sclCode?): Partial<LogicConfig>`。
- 规则示例（与现有 `detectLogic` 的关键词/结构对齐即可）：
  - I/O 里存在 RED/YEL/GRN 或 红/黄/绿 等符号，且存在定时相关地址（如 T37）→ `hasTrafficLight = true`；
  - 存在 BTN_1F/BTN_2F/SENS_1F/ KM_UP/KM_DOWN 等 → `hasElevator = true`；
  - 存在 level / 液位 / 搅拌 / IN/OUT 等 → `hasMixingTank = true`；
  - 存在星三角相关符号（KM1/KM2/KM3 或 Y/Δ）→ `hasStarDelta = true`；
  - 存在计数/传送带相关（COUNT/CTU/conveyor）→ `hasCounting = true`；
  - 其他类似，对应当前 HmiPanel 的每个分支。
- 在 **AI 返回并校验通过** 后，先做 `inferLogicFromSolution(io, stlCode, sclCode)`，再与 AI 返回的 logicConfig（若有）以及原有的 `detectLogic(scenarioText)` 做 **merge**（以“任一为 true 则保留”的策略，与现有 App 中 mergedLogic 一致），得到最终 logic，再传给 HmiPanel。

**优点**：  
不增加任何 prompt/response token，AI 无需改输出格式；只要 AI 生成的 I/O 和代码**符合某类预设场景的特征**，就能自动对上对应仿真监控面板。  
**缺点**：  
依赖 I/O 命名和代码风格，若 AI 命名非常随意，推断可能不准，此时仍会 fallback 到 GenericPanel（与现在行为一致）。

---

### 方案二：AI 只多输出一个「HMI 预设」枚举 — 极少 token

**思路**：在现有 AI 返回的 JSON 中增加**一个**字段，例如 `hmiPreset: 'elevator' | 'traffic' | 'mixing_tank' | 'star_delta' | 'counting' | 'garage_door' | 'multi_mode_lighting' | 'pid' | 'generic'`，**不要求 AI 描述具体动画**，只选一个预设。

**做法要点**：

- 在 prompt 中约定：  
  “在返回的 JSON 中增加字段 `hmiPreset`，取值仅可为以下之一：elevator, traffic, mixing_tank, star_delta, counting, garage_door, multi_mode_lighting, pid, generic；根据控制对象选最贴切的一项。”
- 校验层（如 `aiSolutionValidator`）中解析 `hmiPreset`，映射为 LogicConfig 的 hasXXX（例如 `hmiPreset === 'elevator'` → `hasElevator: true`），再与现有 logicConfig 合并。
- 前端 HmiPanel 逻辑**不变**，仍根据合并后的 logic 的 hasXXX 选子面板。

**优点**：  
token 增加极少（多一个 key + 一个短字符串），可控；AI 直接“点名”要哪种仿真，准确度高。  
**缺点**：  
需要改 prompt 与校验/合并逻辑；若 AI 不填或填错，仍需 fallback（可与方案一结合：未填时用方案一推断）。

---

### 方案三：在 prompt 中轻量说明「可选 HMI 类型」— 可选

**思路**：不要求 AI 输出长描述，只在 system/user prompt 里给一段**简短**的“可选仿真类型列表 + 对应填法”，让 AI 在返回的 `logicConfig` 里**只填 scenarioType 或 1～2 个 hasXXX**（例如只填 `scenarioType: 'elevator'` 或 `hasElevator: true`），其余由前端用默认或由方案一补全。

**优点**：  
与现有 `logicConfig` 结构兼容，AI 只需多填少量字段，token 增加有限。  
**缺点**：  
依赖模型按说明填写；若模型经常漏填，仍需方案一兜底。

---

## 四、推荐组合与实现顺序

1. **优先做方案一**  
   - 实现 `inferLogicFromSolution(io, stlCode?, sclCode?)`，在 AI 分支中「校验通过后」先推断再 merge。  
   - 这样**不增加任何 token**，就能在多数“AI 生成的 I/O/代码已符合某类场景”的情况下，自动对上设备仿真监控。

2. **可选叠加方案二**  
   - 若希望更稳、更可控，再在协议里增加 `hmiPreset`，在校验/合并时优先采用 `hmiPreset` 映射结果，缺失时再用方案一推断。  
   - 这样 token 仍然很少，且能覆盖“描述模糊但 AI 心里知道是电梯”的情况。

3. **方案三**  
   - 可作为 prompt 的小幅优化，与方案一或二并存，不单独依赖。

**不推荐**：  
让 AI 直接生成“完整动画/界面描述”（组件、位置、绑定等），会大幅增加 token 且需新 DSL 与渲染器，性价比低；用「预设子面板 + 类型推断/枚举」即可在低成本下对齐设备仿真监控。

---

## 五、小结

| 项目         | 说明 |
|--------------|------|
| 是否独立库   | 否，设备仿真监控为项目内 SimulationPanel + HmiPanel，由 LogicConfig 与 plcState 驱动。 |
| 当前问题     | AI 模式下 logic 多依赖本地 detectLogic；描述或生成偏离预设时只显示通用面板，显得“没变化”。 |
| 平衡思路     | 不靠 AI 生成动画描述（省 token），而是：① 从 I/O/代码本地推断 HMI 类型；② 或让 AI 只多填一个 hmiPreset 枚举。 |
| 推荐实现     | 先做「基于 I/O/代码的本地二次推断」并 merge 进 logic；可选再增加 hmiPreset 字段与映射。 |

按上述方式升级后，**AI 智能生成的内容会通过 logicConfig 影响设备仿真监控的展示**，同时**几乎不增加 token 消耗**。
