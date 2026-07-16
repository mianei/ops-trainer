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

/** @param {string} raw @param {{ maxBullets?: number }} [opts] */
export function parseResumeOptimizeReport(raw, opts = {}) {
  try {
    const parsed = JSON.parse(extractJsonText(raw));
    if (!parsed || typeof parsed !== 'object') return null;
    const maxBullets = Math.max(2, Math.min(6, Number(opts.maxBullets) || 5));

    const bullets = (Array.isArray(parsed.bullets) ? parsed.bullets : [])
      .map(b => ({
        before: String(b?.before || '').trim(),
        after: cleanOptimizeAfter(b?.after)
      }))
      .filter(b => b.before || b.after)
      .slice(0, maxBullets);

    const rawDetails = Array.isArray(parsed.detailSupplements)
      ? parsed.detailSupplements
      : (Array.isArray(parsed.evalBadcase) ? parsed.evalBadcase : []);
    const detailSupplements = rawDetails
      .map(s => String(s || '').trim())
      .filter(Boolean)
      .slice(0, 4);

    let outputResume = String(parsed.outputResume || parsed.rewrittenResume || '').trim();
    if (!outputResume && bullets.some(b => b.after)) {
      outputResume = bullets.map(b => (b.after ? `- ${b.after}` : '')).filter(Boolean).join('\n');
    }

    return {
      weakProject: String(parsed.weakProject || parsed.diagnosis || '').trim(),
      bullets,
      detailSupplements,
      outputResume
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
    '细节补充：',
    ...report.detailSupplements.map(s => `- ${s}`)
  ];
  if (report.outputResume) {
    lines.push('', '【改后简历稿】', report.outputResume);
  }
  return lines.filter(l => l !== '').join('\n');
}
