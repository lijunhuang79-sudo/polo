import type { GeneratedSolution } from '../types';

export type CodeTab = 'STL' | 'LAD' | 'SCL';

export function getActiveProgramCode(
  solution: GeneratedSolution,
  codeTab: CodeTab,
  scenarioText: string
): string {
  const stl = solution.stlCode || '';
  const lad = solution.ladCode || '';
  const scl = solution.sclCode || '';
  if (codeTab === 'STL') return stl;
  if (codeTab === 'LAD') return lad;
  return scl;
}

export function scenarioExportBasename(scenarioTitle: string): string {
  const safe = scenarioTitle.replace(/[^\u4e00-\u9fa5a-zA-Z0-9_-]+/g, '_').slice(0, 48);
  return safe || 'PLC场景';
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildScenarioTxtDocument(
  scenarioTitle: string,
  scenarioText: string,
  solution: GeneratedSolution,
  codeTab: CodeTab
): string {
  const langLabel = codeTab === 'STL' ? 'STL (S7-1200/1500 AWL)' : codeTab === 'LAD' ? '梯形图 LAD (博途 TIA Portal V16)' : 'SCL (博途 TIA Portal V16)';
  const code = getActiveProgramCode(solution, codeTab, scenarioText);
  const lines: string[] = [
    '='.repeat(72),
    `  ${scenarioTitle || 'PLC 控制场景'}`,
    `  导出语言：${langLabel}`,
    `  导出时间：${new Date().toLocaleString('zh-CN')}`,
    `  PLC 平台：Siemens S7-1200 / S7-1500 · TIA Portal V16`,
    '='.repeat(72),
    '',
    '【一】场景需求',
    '-'.repeat(72),
    scenarioText || '（未填写）',
    '',
    '【二】I/O 分配表',
    '-'.repeat(72),
    '地址\t符号\t类型\t设备\t备注',
    ...solution.io.map(
      (io) => `${io.addr}\t${io.symbol}\t${io.type}\t${io.device}\t${io.note || ''}`
    ),
    '',
    '【三】程序代码',
    '-'.repeat(72),
    code,
    '',
    '【四】物料清单 (BOM)',
    '-'.repeat(72),
    ...solution.hardware.map((h) => `${h.name}\t${h.model}\t×${h.qty}\t${h.note}`),
    '',
    '='.repeat(72),
    '  文档结束',
    '='.repeat(72),
  ];
  return lines.join('\n');
}

/** 构建打印用 HTML（macOS / Windows 均可用「打印 → 存储为 PDF」） */
export function buildScenarioPrintHtml(
  scenarioTitle: string,
  scenarioText: string,
  solution: GeneratedSolution,
  codeTab: CodeTab
): string {
  const langLabel = codeTab === 'STL' ? 'STL' : codeTab === 'LAD' ? '梯形图 LAD' : 'SCL';
  const code = escapeHtml(getActiveProgramCode(solution, codeTab, scenarioText));
  const title = escapeHtml(scenarioTitle || 'PLC 控制场景');
  const req = escapeHtml(scenarioText || '（未填写）');
  const exportedAt = escapeHtml(new Date().toLocaleString('zh-CN'));

  const ioRows = solution.io
    .map(
      (io) =>
        `<tr><td>${escapeHtml(io.addr)}</td><td>${escapeHtml(io.symbol)}</td><td>${escapeHtml(io.type)}</td><td>${escapeHtml(io.device)}</td><td>${escapeHtml(io.note || '')}</td></tr>`
    )
    .join('');

  const bomRows = solution.hardware
    .map(
      (h) =>
        `<tr><td>${escapeHtml(h.name)}</td><td>${escapeHtml(h.model)}</td><td>${h.qty}</td><td>${escapeHtml(h.note)}</td></tr>`
    )
    .join('');

  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"/>
<title>${title} - PLC场景导出</title>
<style>
  @page { margin: 18mm; size: A4; }
  * { box-sizing: border-box; }
  body { font-family: "PingFang SC", "Microsoft YaHei", sans-serif; color: #1e293b; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 24px; background: #fff; }
  h1 { font-size: 20px; border-bottom: 2px solid #2563eb; padding-bottom: 8px; margin: 0 0 12px; }
  h2 { font-size: 15px; color: #2563eb; margin: 24px 0 8px; page-break-after: avoid; }
  .meta { color: #64748b; font-size: 13px; margin-bottom: 20px; }
  .hint { display: block; background: #eff6ff; border: 1px solid #bfdbfe; color: #1d4ed8; padding: 10px 14px; border-radius: 8px; font-size: 13px; margin-bottom: 20px; }
  pre { background: #0f172a; color: #4ade80; padding: 16px; border-radius: 8px; font-size: 11px; overflow-x: auto; white-space: pre-wrap; word-break: break-all; page-break-inside: auto; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 8px; page-break-inside: avoid; }
  th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; }
  th { background: #f1f5f9; }
  .req { background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0; white-space: pre-wrap; }
  @media print {
    body { padding: 0; }
    .hint { display: none !important; }
  }
</style></head><body>
<div class="hint">保存 PDF：在打印窗口左下角点 <strong>PDF</strong> → 选「存储为 PDF…」（Mac）或「Microsoft Print to PDF」（Windows）。建议取消勾选「打印页眉和页脚」。</div>
<h1>${title}</h1>
<div class="meta">平台：S7-1200 / S7-1500 · 博途 V16 · 导出语言：${langLabel}<br/>导出时间：${exportedAt}</div>
<h2>场景需求</h2>
<div class="req">${req}</div>
<h2>I/O 分配表</h2>
<table><thead><tr><th>地址</th><th>符号</th><th>类型</th><th>设备</th><th>备注</th></tr></thead><tbody>${ioRows}</tbody></table>
<h2>程序代码 (${langLabel})</h2>
<pre>${code}</pre>
<h2>物料清单</h2>
<table><thead><tr><th>名称</th><th>型号</th><th>数量</th><th>备注</th></tr></thead><tbody>${bomRows}</tbody></table>
<p style="text-align:center;color:#94a3b8;font-size:12px;margin-top:32px;">— PopLab PLC-Sim 场景导出 —</p>
<script>window.onload=function(){setTimeout(function(){window.print();},300);};</script>
</body></html>`;
}

/** 打开打印预览页（由系统打印引擎生成 PDF，排版最稳定） */
export function openPrintPdf(html: string): void {
  const w = window.open('', '_blank');
  if (!w) {
    alert('请允许弹出窗口。随后在打印对话框中选择 PDF → 存储为 PDF。');
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}

/** 构建可导入博途的外部 SCL 源文件 */
export function buildScenarioSclSource(scenarioTitle: string, scenarioText: string, sclCode: string): string {
  return `// =============================================================================
// ${scenarioTitle || 'PLC 控制场景'}
// 平台：Siemens S7-1200 / S7-1500 · TIA Portal V16
// 导出时间：${new Date().toLocaleString('zh-CN')}
// =============================================================================
// 场景需求：
// ${(scenarioText || '').split('\n').join('\n// ')}
//
// 导入：项目树 → 外部源文件 → 从文件生成块
// =============================================================================

${sclCode}
`;
}

export function downloadTextFile(filename: string, content: string, mime = 'text/plain;charset=utf-8'): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function resolveScenarioTitle(scenarioText: string, scenarios: { title: string; text: string }[]): string {
  const hit = scenarios.find((s) => s.text.trim() === scenarioText.trim());
  return hit?.title || 'PLC 控制场景';
}
