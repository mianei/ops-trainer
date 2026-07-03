/** @param {string} raw */
function extractJsonText(raw) {
  const text = String(raw || '').trim();
  if (!text) return '';
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) return fenced[1].trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) return text.slice(start, end + 1);
  return text;
}

/** @param {string} text */
function cleanOptimizeAfter(text) {
  let t = String(text || '').trim();
  if (!t) return '';
  t = t.replace(/[，；]\s*但[^。；！？]*[。；！？]?$/u, '').trim();
  t = t.replace(/[，；]\s*（未[^）]*）$/u, '').trim();
  t = t.replace(/[，；]\s*属于传统[^。；！？]*[。；！？]?$/u, '').trim();
  return t;
}

/** @param {string} raw */
export function parseResumeOptimizeReport(raw) {
  try {
    const parsed = JSON.parse(extractJsonText(raw));
    if (!parsed || typeof parsed !== 'object') return null;

    const bullets = (Array.isArray(parsed.bullets) ? parsed.bullets : [])
      .map(b => ({
        before: String(b?.before || '').trim(),
        after: cleanOptimizeAfter(b?.after)
      }))
      .filter(b => b.before || b.after)
      .slice(0, 2);

    const evalBadcase = (Array.isArray(parsed.evalBadcase) ? parsed.evalBadcase : [])
      .map(s => String(s || '').trim())
      .filter(Boolean)
      .slice(0, 4);

    return {
      weakProject: String(parsed.weakProject || parsed.diagnosis || '').trim(),
      bullets,
      evalBadcase,
      mainDirection: String(parsed.mainDirection || parsed.directions?.main || '').trim(),
      backupDirection: String(parsed.backupDirection || parsed.directions?.backup || '').trim()
    };
  } catch {
    return null;
  }
}

/** @param {ReturnType<typeof parseResumeOptimizeReport>} report */
export function formatResumeOptimizeReply(report) {
  if (!report) return '';
  const lines = [
    report.weakProject && `诊断：${report.weakProject}`,
    '',
    'Bullet 改写（可直接粘贴）：',
    ...report.bullets.map((b, i) => `${i + 1}. ${b.before} → ${b.after}`),
    '',
    'Eval / Badcase：',
    ...report.evalBadcase.map(s => `- ${s}`),
    '',
    `主方向：${report.mainDirection || '—'}`,
    `备方向：${report.backupDirection || '—'}`
  ];
  return lines.filter(l => l !== '').join('\n');
}
