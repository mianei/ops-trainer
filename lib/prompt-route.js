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
    const mianjingMap = {
      需求: 'user', 决策: 'decision', 数据: 'data', 增长: 'growth', 留存: 'retention',
      竞品: 'competitor', 功能: 'feature', 危机: 'crisis', 活动: 'content',
      实习: 'iv-exp', 行为: 'iv-self', 规划: 'iv-career', 产品: 'iv-pm', AI: 'iv-pm',
      实操: 'iv-skills', 估算: 'iv-skills', 运营: 'iv-ops', 综合: 'iv-misc',
      策略: 'iv-open', 设计: 'prod-open', 变现: 'biz-monetize', 笔试: 'iv-misc'
    };
    if (industry === '面经') {
      const topicId = mianjingMap[kind];
      if (topicId && topicMap.get(topicId)?.systemPrompt) {
        return topicMap.get(topicId).systemPrompt;
      }
    }
    if (industry === '产品拆解') {
      const debriefMap = {
        需求: 'user',
        功能: 'feature',
        判断: 'competitor',
        增长: 'decision',
        AI: 'iv-pm',
        竞品: 'competitor',
        开放: 'prod-open',
        产品: 'iv-pm',
        决策: 'decision'
      };
      const topicId = debriefMap[kind];
      if (topicId && topicMap.get(topicId)?.systemPrompt) {
        return topicMap.get(topicId).systemPrompt;
      }
    }
    if (industry === 'SQL') {
      const sql = topicMap.get('sql');
      if (sql?.systemPrompt) return sql.systemPrompt;
    }
    const industryMap = {
      OTA: { 需求: 'user', 决策: 'decision', 数据: 'data', 竞品: 'competitor', 增长: 'growth', 功能: 'feature', 危机: 'crisis', 开放: 'iv-open' },
      电商: { 需求: 'user', 决策: 'decision', 数据: 'data', 竞品: 'competitor', 增长: 'growth', 功能: 'feature', 危机: 'crisis' },
      社区: { 需求: 'user', 决策: 'decision', 数据: 'data', 竞品: 'competitor', 增长: 'growth', 功能: 'feature', 危机: 'crisis' },
      即时零售: { 需求: 'user', 决策: 'decision', 数据: 'data' }
    };
    const topicId = industryMap[industry]?.[kind];
    if (topicId && topicMap.get(topicId)?.systemPrompt) {
      return topicMap.get(topicId).systemPrompt;
    }
  }
  if (/^【产品拆解/.test(text)) {
    const kind = text.match(/^【产品拆解·([^】]+)】/)?.[1]?.split('·')[0];
    const debriefMap = {
      需求: 'user', 功能: 'feature', 判断: 'competitor', 增长: 'decision', AI: 'iv-pm',
      竞品: 'competitor', 开放: 'prod-open', 产品: 'iv-pm', 决策: 'decision'
    };
    const topicId = kind && debriefMap[kind];
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
  if (/^【SQL/.test(text)) {
    const sql = topicMap.get('sql');
    if (sql?.systemPrompt) return sql.systemPrompt;
  }
  if (/^【面经/.test(text) || /^【面试/.test(text) || /面试题/.test(text)) {
    const pm = topicMap.get('iv-pm');
    if (pm?.systemPrompt) return pm.systemPrompt;
  }
  if (/^【社区/.test(text)) {
    const t = topicMap.get('iv-ops');
    if (t?.systemPrompt) return t.systemPrompt;
  }
  return fallbackPrompt;
}
