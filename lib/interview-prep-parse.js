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

/** @param {unknown} v */
function str(v) {
  return String(v ?? '').trim();
}

/** @param {string} raw */
export function parseInterviewPrepReport(raw) {
  try {
    const parsed = JSON.parse(extractJsonText(raw));
    if (!parsed || typeof parsed !== 'object') return null;

    const projects = (Array.isArray(parsed.projects) ? parsed.projects : [])
      .slice(0, 4)
      .map(p => ({
        name: str(p?.name) || '项目',
        structure30s: str(p?.structure30s || p?.structure),
        keyEvidence: str(p?.keyEvidence || p?.evidence)
      }))
      .filter(p => p.structure30s || p.keyEvidence);

    const followUps = (Array.isArray(parsed.followUps) ? parsed.followUps : [])
      .slice(0, 6)
      .map(f => ({
        question: str(f?.question || f?.q),
        defense: str(f?.defense || f?.answer)
      }))
      .filter(f => f.question);

    const badcases = (Array.isArray(parsed.badcases) ? parsed.badcases : [])
      .map(b => str(typeof b === 'string' ? b : b?.text))
      .filter(Boolean)
      .slice(0, 4);

    const doNotSay = (Array.isArray(parsed.doNotSay) ? parsed.doNotSay : [])
      .map(s => str(s))
      .filter(Boolean)
      .slice(0, 6);

    const opening15s = str(parsed.opening15s || parsed.opening);
    if (!opening15s && !projects.length && !followUps.length) return null;

    return {
      opening15s,
      projects,
      followUps,
      badcases,
      doNotSay,
      summary: str(parsed.summary)
    };
  } catch {
    return null;
  }
}

/** @param {ReturnType<typeof parseInterviewPrepReport>} report */
export function formatInterviewPrepReply(report) {
  if (!report) return '';
  const lines = [];
  if (report.summary) lines.push(report.summary);
  if (report.opening15s) lines.push('【前 15 秒】' + report.opening15s);
  report.projects.forEach(p => {
    lines.push(`【${p.name}】${p.structure30s}`);
  });
  return lines.join('\n');
}
