/**
 * 按场景标签选择更匹配的 systemPrompt（解决 poolIds 合并后 prompt 错配）
 * @param {string} scenario
 * @param {string} fallbackPrompt
 * @param {Map<string, { systemPrompt?: string }>} topicMap
 */
export function resolveSystemPrompt(scenario, fallbackPrompt, topicMap) {
  const text = String(scenario || '');
  const tag = text.match(/^【([^·】]+)·([^】]+)】/);
  if (tag) {
    const industry = tag[1];
    const kind = tag[2].split('·')[0];
    const industryMap = {
      OTA: { 需求: 'user', 决策: 'decision', 数据: 'data', 竞品: 'competitor', 增长: 'growth', 功能: 'feature', 危机: 'crisis', 开放: 'iv-open' },
      电商: { 需求: 'user', 决策: 'decision', 数据: 'data', 竞品: 'competitor', 增长: 'growth', 功能: 'feature', 危机: 'crisis' },
      社区: { 需求: 'user', 决策: 'decision', 数据: 'data', 竞品: 'competitor', 增长: 'growth', 功能: 'feature', 危机: 'crisis' },
      即时零售: { 需求: 'user', 决策: 'decision', 数据: 'data' },
      知乎: { 需求: 'user', 决策: 'decision', 数据: 'data', 增长: 'growth', 竞品: 'competitor', 功能: 'feature', 危机: 'crisis', 传播: 'content' },
      小红书: { 需求: 'user', 决策: 'decision', 数据: 'data', 增长: 'growth', 竞品: 'competitor', 功能: 'feature', 危机: 'crisis', 传播: 'content' },
      抖音: { 需求: 'user', 决策: 'decision', 数据: 'data', 增长: 'growth', 竞品: 'competitor', 功能: 'feature', 危机: 'crisis', 传播: 'content' },
      AI: { 数据: 'data', 功能: 'feature' }
    };
    const topicId = industryMap[industry]?.[kind];
    if (topicId && topicMap.get(topicId)?.systemPrompt) {
      return topicMap.get(topicId).systemPrompt;
    }
  }
  if (/^【AI PM/.test(text) || /^【AI·/.test(text)) {
    const pm = topicMap.get('iv-pm');
    if (pm?.systemPrompt) return pm.systemPrompt;
  }
  if (/^【创作者运营/.test(text)) {
    const ops = topicMap.get('iv-ops');
    if (ops?.systemPrompt) return ops.systemPrompt;
  }
  if (/^【面试/.test(text) || /面试题/.test(text)) {
    const pm = topicMap.get('iv-pm');
    if (pm?.systemPrompt) return pm.systemPrompt;
  }
  if (/^【社区/.test(text)) {
    const t = topicMap.get('iv-ops');
    if (t?.systemPrompt) return t.systemPrompt;
  }
  return fallbackPrompt;
}
