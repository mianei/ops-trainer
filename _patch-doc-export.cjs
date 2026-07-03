const fs = require('fs');
let h = fs.readFileSync('index.html', 'utf8');
if (!/[\u4e00-\u9fff]/.test(h)) throw new Error('encoding lost before patch');

function mustReplace(label, re, repl) {
  if (!re.test(h)) throw new Error('patch anchor not found: ' + label);
  h = h.replace(re, repl);
}

function mustInclude(label, needle) {
  if (!h.includes(needle)) throw new Error('patch verify failed: ' + label);
}

// 1) CSS for doc export split dropdown
mustReplace(
  'doc-export-css',
  /  \.canvas-title-cta \.btn-frost:disabled \{\r?\n    opacity: 0\.55;\r?\n    cursor: not-allowed;\r?\n  \}/,
  `  .canvas-title-cta .btn-frost:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
  .doc-export-split {
    position: relative;
    display: inline-flex;
    align-items: stretch;
    border-radius: var(--btn-pill-radius);
    overflow: visible;
    flex-shrink: 0;
  }
  .doc-export-split .doc-export-main,
  .doc-export-split .doc-export-toggle {
    font-family: inherit;
    font-size: 11px;
    font-weight: 600;
    padding: 5px 12px;
    min-height: var(--btn-min-h-sm);
    line-height: 1.35;
    border: none;
    cursor: pointer;
    white-space: nowrap;
    color: #fff;
    background: linear-gradient(180deg, var(--btn-green-top) 0%, var(--btn-green-mid) 42%, var(--btn-green-base) 100%);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.24),
      inset 0 -1px 0 rgba(0, 0, 0, 0.12),
      0 3px 0 var(--btn-green-lip),
      0 4px 12px var(--btn-green-glow);
  }
  .doc-export-split .doc-export-main {
    border-radius: var(--btn-pill-radius) 0 0 var(--btn-pill-radius);
    padding-right: 10px;
  }
  .doc-export-split .doc-export-toggle {
    border-radius: 0 var(--btn-pill-radius) var(--btn-pill-radius) 0;
    padding: 5px 8px;
    border-left: 1px solid rgba(255, 255, 255, 0.22);
    font-size: 10px;
  }
  .doc-export-split .doc-export-main:hover,
  .doc-export-split .doc-export-toggle:hover {
    background: linear-gradient(180deg, var(--btn-green-hover-top) 0%, var(--btn-green-hover-mid) 42%, var(--btn-green-hover-base) 100%);
  }
  .doc-export-menu {
    position: absolute;
    top: calc(100% + 6px);
    right: 0;
    min-width: 148px;
    padding: 6px;
    border-radius: 12px;
    border: 1px solid var(--frost-border);
    background: var(--surface);
    box-shadow: 0 12px 32px rgba(15, 23, 42, 0.18);
    z-index: 40;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .doc-export-menu[hidden] { display: none !important; }
  .doc-export-menu button {
    font-family: inherit;
    font-size: 12px;
    font-weight: 500;
    text-align: left;
    padding: 8px 10px;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: var(--ink);
    cursor: pointer;
  }
  .doc-export-menu button:hover {
    background: var(--accent-soft);
    color: var(--accent);
  }
  html[data-theme="dark"] .doc-export-menu {
    background: rgba(24, 16, 40, 0.96);
    border-color: rgba(168, 85, 247, 0.28);
    box-shadow: 0 12px 36px rgba(0, 0, 0, 0.45);
  }`
);

// 2) Replace doc tab CTA button HTML
mustReplace(
  'doc-export-cta',
  /  \} else if \(scene === 'resume' && tab === '文档'\) \{\r?\n    const hasDoc = Boolean\(resumeOptimizeResult\.optimizeReport\?\.bullets\?\.length \|\| resumeOptimizeResult\.content\);\r?\n    if \(hasDoc\) parts\.push\('<button type="button" class="btn-primary btn-frost" id="docExportMdBtn">下载 Markdown<\/button>'\);\r?\n  \}/,
  `  } else if (scene === 'resume' && tab === '文档') {
    const hasDoc = Boolean(resumeOptimizeResult.optimizeReport?.bullets?.length || resumeOptimizeResult.content);
    if (hasDoc) parts.push(renderDocExportSplitHtml('resume'));
  }`
);

// 3) Replace export functions block
mustReplace(
  'doc-export-fns',
  /function exportResumeMarkdown\(\) \{\r?\n  const text = resumeOptimizeResult\.content \|\| JSON\.stringify\(resumeOptimizeResult\.optimizeReport \|\| \{\}, null, 2\);\r?\n  downloadTextFile\('简历优化\.md', text\);\r?\n\}\r?\n\r?\nfunction exportPrepMarkdown\(\) \{\r?\n  const text = interviewPrepResult\.content \|\| JSON\.stringify\(interviewPrepResult\.prepReport \|\| \{\}, null, 2\);\r?\n  downloadTextFile\('面试准备\.md', text\);\r?\n\}\r?\n\r?\nfunction downloadTextFile\(name, text\) \{\r?\n  const blob = new Blob\(\[text\], \{ type: 'text\/markdown;charset=utf-8' \}\);\r?\n  const a = document\.createElement\('a'\);\r?\n  a\.href = URL\.createObjectURL\(blob\);\r?\n  a\.download = name;\r?\n  a\.click\(\);\r?\n  URL\.revokeObjectURL\(a\.href\);\r?\n\}/,
  `function renderDocExportSplitHtml(scope) {
  const id = scope === 'resume' ? 'resumeDocExport' : 'prepDocExport';
  return \`<div class="doc-export-split btn-primary" id="\${id}Split" data-doc-export-scope="\${scope}">
    <button type="button" class="doc-export-main" data-doc-export-scope="\${scope}" data-doc-format="docx">下载文档</button>
    <button type="button" class="doc-export-toggle" data-doc-export-scope="\${scope}" aria-expanded="false" aria-haspopup="menu" aria-label="选择导出格式">▾</button>
    <div class="doc-export-menu" id="\${id}Menu" hidden role="menu">
      <button type="button" role="menuitem" data-doc-export-scope="\${scope}" data-doc-format="md">Markdown (.md)</button>
      <button type="button" role="menuitem" data-doc-export-scope="\${scope}" data-doc-format="docx">Word (.docx)</button>
      <button type="button" role="menuitem" data-doc-export-scope="\${scope}" data-doc-format="pdf">PDF (.pdf)</button>
    </div>
  </div>\`;
}

function closeDocExportMenus(exceptScope) {
  document.querySelectorAll('[data-doc-export-scope]').forEach(el => {
    const scope = el.dataset.docExportScope;
    if (!scope || (exceptScope && scope === exceptScope)) return;
    const menu = document.getElementById(scope === 'resume' ? 'resumeDocExportMenu' : 'prepDocExportMenu');
    const toggle = document.querySelector(\`.doc-export-toggle[data-doc-export-scope="\${scope}"]\`);
    if (menu) menu.hidden = true;
    if (toggle) toggle.setAttribute('aria-expanded', 'false');
  });
}

function toggleDocExportMenu(scope) {
  const menu = document.getElementById(scope === 'resume' ? 'resumeDocExportMenu' : 'prepDocExportMenu');
  const toggle = document.querySelector(\`.doc-export-toggle[data-doc-export-scope="\${scope}"]\`);
  if (!menu || !toggle) return;
  const open = menu.hidden;
  closeDocExportMenus();
  menu.hidden = !open;
  toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
}

function bindDocExportControls() {
  if (window.__docExportBound) return;
  window.__docExportBound = true;
  document.addEventListener('click', e => {
    const fmtBtn = e.target.closest('[data-doc-format][data-doc-export-scope]');
    if (fmtBtn) {
      e.preventDefault();
      const scope = fmtBtn.dataset.docExportScope;
      const format = fmtBtn.dataset.docFormat;
      closeDocExportMenus();
      if (scope === 'resume') exportResumeDocument(format);
      else if (scope === 'prep') exportPrepDocument(format);
      return;
    }
    const toggle = e.target.closest('.doc-export-toggle[data-doc-export-scope]');
    if (toggle) {
      e.preventDefault();
      e.stopPropagation();
      toggleDocExportMenu(toggle.dataset.docExportScope);
      return;
    }
    if (!e.target.closest('.doc-export-split')) closeDocExportMenus();
  });
}

function getResumeDocumentExportContent() {
  const report = resumeOptimizeResult.optimizeReport;
  const hasDoc = Boolean(report?.bullets?.length || resumeOptimizeResult.content);
  if (!hasDoc) return null;
  const title = '简历优化';
  const mdLines = [\`# \${title}\`, ''];
  const htmlParts = [\`<h1>\${escapeHtml(title)}</h1>\`];
  const changes = (report?.evalBadcase || []).slice(0, 10);
  if (changes.length) {
    mdLines.push('## 变更摘要', '');
    changes.forEach((c, i) => mdLines.push(\`\${i + 1}. \${c}\`));
    mdLines.push('');
    htmlParts.push('<h2>变更摘要</h2><ol>');
    changes.forEach(c => htmlParts.push(\`<li>\${escapeHtml(c)}</li>\`));
    htmlParts.push('</ol>');
  }
  if (report?.bullets?.length) {
    mdLines.push('## 优化 Bullet', '');
    report.bullets.forEach((b, i) => {
      if (b.before) mdLines.push(\`### 条目 \${i + 1} · 改前\\n\${b.before}\\n\`);
      if (b.after) mdLines.push(\`**改后：** \${b.after}\\n\`);
      if (b.before) htmlParts.push(\`<h3>条目 \${i + 1} · 改前</h3><p>\${escapeHtml(b.before)}</p>\`);
      if (b.after) htmlParts.push(\`<p><strong>改后：</strong>\${escapeHtml(b.after)}</p>\`);
    });
  } else if (resumeOptimizeResult.content) {
    mdLines.push(resumeOptimizeResult.content);
    htmlParts.push(\`<p>\${escapeHtml(resumeOptimizeResult.content).replace(/\\n/g, '<br/>')}</p>\`);
  }
  return { md: mdLines.join('\\n'), html: htmlParts.join(''), title };
}

function getPrepDocumentExportContent() {
  const report = interviewPrepResult.prepReport;
  if (!report && !interviewPrepResult.content) return null;
  const title = '面试准备';
  if (interviewPrepResult.content && !report) {
    return {
      md: interviewPrepResult.content,
      html: \`<p>\${escapeHtml(interviewPrepResult.content).replace(/\\n/g, '<br/>')}</p>\`,
      title
    };
  }
  const body = [report.opening15s, ...(report.projects || []).map(p => p.name + '：' + (p.structure30s || ''))].filter(Boolean);
  const md = [\`# \${title}\`, '', ...body].join('\\n\\n');
  const html = [\`<h1>\${escapeHtml(title)}</h1>\`, ...body.map(p => \`<p>\${escapeHtml(p).replace(/\\n/g, '<br/>')}</p>\`)].join('');
  return { md, html, title };
}

function exportResumeDocument(format) {
  const payload = getResumeDocumentExportContent();
  if (!payload) { alert('暂无文档内容，请先完成优化'); return; }
  if (format === 'md') downloadTextFile('简历优化.md', payload.md, 'text/markdown;charset=utf-8');
  else if (format === 'docx') downloadWordHtmlFile('简历优化.docx', payload.html, payload.title);
  else if (format === 'pdf') printHtmlDocument(payload.html, payload.title);
}

function exportPrepDocument(format) {
  const payload = getPrepDocumentExportContent();
  if (!payload) { alert('暂无导出内容'); return; }
  if (format === 'md') downloadTextFile('面试准备.md', payload.md, 'text/markdown;charset=utf-8');
  else if (format === 'docx') downloadWordHtmlFile('面试准备.docx', payload.html, payload.title);
  else if (format === 'pdf') printHtmlDocument(payload.html, payload.title);
}

function exportResumeMarkdown() { exportResumeDocument('md'); }

function exportPrepMarkdown() { exportPrepDocument('md'); }

function downloadTextFile(name, text, mime) {
  const blob = new Blob([text], { type: mime || 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

function downloadWordHtmlFile(name, bodyHtml, title) {
  const html = \`<!DOCTYPE html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
<head><meta charset="utf-8"><title>\${escapeHtml(title || '文档')}</title>
<style>body{font-family:"Microsoft YaHei",SimSun,sans-serif;line-height:1.6;padding:24px;color:#111}h1{font-size:20px}h2{font-size:16px;margin-top:18px}p,li{font-size:14px}</style></head>
<body>\${bodyHtml}</body></html>\`;
  const blob = new Blob(['\\ufeff', html], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

function printHtmlDocument(bodyHtml, title) {
  const win = window.open('', '_blank', 'noopener,noreferrer');
  if (!win) { alert('请允许弹出窗口以导出 PDF'); return; }
  win.document.write(\`<!DOCTYPE html><html><head><meta charset="utf-8"><title>\${escapeHtml(title || '文档')}</title>
<style>@page{margin:18mm}body{font-family:"Microsoft YaHei",SimSun,sans-serif;line-height:1.65;padding:0;color:#111;max-width:720px;margin:0 auto}h1{font-size:22px}h2{font-size:16px;margin-top:20px}p,li{font-size:14px}</style></head>
<body>\${bodyHtml}</body></html>\`);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 350);
}`
);

// 4) renderCanvasTitleCta: replace docExportMdBtn binding
mustReplace(
  'bind-doc-export-cta',
  /  host\.innerHTML = parts\.join\(''\);\r?\n  bindResumePaneActions\(\);\r?\n  document\.getElementById\('docExportMdBtn'\)\?\.addEventListener\('click', exportResumeMarkdown\);\r?\n  document\.getElementById\('prepDocExportMdBtn'\)\?\.addEventListener\('click', exportPrepMarkdown\);/,
  `  host.innerHTML = parts.join('');
  bindResumePaneActions();
  bindDocExportControls();`
);

// 5) bindAgentWorkspace: remove old docExportMdBtn listeners
mustReplace(
  'bind-agent-workspace-export',
  /  document\.getElementById\('docExportMdBtn'\)\?\.addEventListener\('click', exportResumeMarkdown\);\r?\n  document\.getElementById\('prepDocExportMdBtn'\)\?\.addEventListener\('click', exportPrepMarkdown\);/,
  `  bindDocExportControls();`
);

// 6) renderResumeCanvasPanels doc tab
mustReplace(
  'resume-doc-panel-bind',
  /  if \(tab === '文档'\) \{\r?\n    const docEl = document\.getElementById\('resumeDocPanel'\);\r?\n    if \(docEl\) docEl\.innerHTML = renderDocumentPanelHtml\(\);\r?\n    document\.getElementById\('docExportMdBtn'\)\?\.addEventListener\('click', exportResumeMarkdown\);\r?\n  \}/,
  `  if (tab === '文档') {
    const docEl = document.getElementById('resumeDocPanel');
    if (docEl) docEl.innerHTML = renderDocumentPanelHtml();
    bindDocExportControls();
  }`
);

// 7) renderPrepCanvasPanels doc tab - also upgrade prep export
mustReplace(
  'prep-doc-cta',
  /  \} else if \(scene === 'prep' && tab === '文档'\) \{\r?\n    if \(interviewPrepResult\.prepReport \|\| interviewPrepResult\.content\) \{\r?\n      parts\.push\('<button type="button" class="btn-primary" id="prepDocExportMdBtn">下载 Markdown<\/button>'\);\r?\n    \}\r?\n  \}/,
  `  } else if (scene === 'prep' && tab === '文档') {
    if (interviewPrepResult.prepReport || interviewPrepResult.content) {
      parts.push(renderDocExportSplitHtml('prep'));
    }
  }`
);

mustReplace(
  'prep-doc-panel-bind',
  /  if \(tab === '文档'\) \{\r?\n    const el = document\.getElementById\('prepDocPanel'\);\r?\n    if \(el\) el\.innerHTML = renderPrepDocumentPanelHtml\(\);\r?\n    document\.getElementById\('prepDocExportMdBtn'\)\?\.addEventListener\('click', exportPrepMarkdown\);\r?\n  \}/,
  `  if (tab === '文档') {
    const el = document.getElementById('prepDocPanel');
    if (el) el.innerHTML = renderPrepDocumentPanelHtml();
    bindDocExportControls();
  }`
);

fs.writeFileSync('index.html', h, 'utf8');
mustInclude('resume export fn', 'function exportResumeDocument(format)');
mustInclude('doc export cta', 'renderDocExportSplitHtml');
mustInclude('download doc btn', '下载文档');
console.log('patched doc export');
