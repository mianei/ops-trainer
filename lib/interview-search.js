/**
 * 外部面经检索 — 通过 Serper(Google) 按站点搜索牛客、小红书等公开索引内容。
 * 配置环境变量 SERPER_API_KEY（https://serper.dev 免费档约 2500 次/月）
 */

const SOURCE_SITES = {
  nowcoder: {
    id: 'nowcoder',
    label: '牛客网',
    site: 'nowcoder.com',
    pathHint: '/discuss'
  },
  xiaohongshu: {
    id: 'xiaohongshu',
    label: '小红书',
    site: 'xiaohongshu.com',
    altSite: 'xhslink.com'
  },
  zhihu: {
    id: 'zhihu',
    label: '知乎',
    site: 'zhihu.com'
  }
};

function buildSearchQuery({ goal, company, roleLabel, sources }) {
  const parts = [company, roleLabel, '面经', '面试'].filter(Boolean);
  if (goal && !parts.some(p => goal.includes(p))) parts.unshift(goal);
  const base = parts.join(' ').replace(/\s+/g, ' ').trim();
  const siteParts = [];
  const src = sources?.length ? sources : ['nowcoder', 'xiaohongshu'];
  for (const key of src) {
    const s = SOURCE_SITES[key];
    if (!s) continue;
    siteParts.push(`site:${s.site}`);
    if (s.altSite) siteParts.push(`site:${s.altSite}`);
  }
  if (!siteParts.length) return base;
  return `${base} (${siteParts.join(' OR ')})`;
}

function fallbackSearchLinks(query, company, roleLabel) {
  const q = encodeURIComponent([company, roleLabel, '面经'].filter(Boolean).join(' ') || query);
  return [
    {
      source: 'nowcoder',
      label: '牛客网',
      url: `https://www.nowcoder.com/search/all?query=${q}`,
      title: '在牛客打开搜索',
      snippet: '需登录牛客后查看完整面经帖',
      external: true
    },
    {
      source: 'xiaohongshu',
      label: '小红书',
      url: `https://www.google.com/search?q=${encodeURIComponent(`site:xiaohongshu.com ${decodeURIComponent(q)}`)}`,
      title: '通过 Google 检索小红书面经',
      snippet: '小红书 Web 端索引有限，建议 App 内搜同名关键词',
      external: true
    }
  ];
}

async function serperSearch(query, apiKey, num = 8) {
  const res = await fetch('https://google.serper.dev/search', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'X-API-KEY': apiKey
    },
    body: JSON.stringify({ q: query, gl: 'cn', hl: 'zh-cn', num })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || data.error || `Serper HTTP ${res.status}`);
  }
  return data;
}

function normalizeSerperResults(data, sources) {
  const allowed = new Set();
  for (const key of sources || Object.keys(SOURCE_SITES)) {
    const s = SOURCE_SITES[key];
    if (s) {
      allowed.add(s.site);
      if (s.altSite) allowed.add(s.altSite);
    }
  }

  const organic = Array.isArray(data.organic) ? data.organic : [];
  return organic
    .filter(item => {
      const link = String(item.link || '');
      if (!allowed.size) return true;
      return [...allowed].some(site => link.includes(site));
    })
    .map(item => {
      const link = String(item.link || '');
      let source = 'web';
      if (link.includes('nowcoder.com')) source = 'nowcoder';
      else if (link.includes('xiaohongshu.com') || link.includes('xhslink.com')) source = 'xiaohongshu';
      else if (link.includes('zhihu.com')) source = 'zhihu';
      return {
        source,
        sourceLabel: SOURCE_SITES[source]?.label || source,
        title: String(item.title || '').trim(),
        url: link,
        snippet: String(item.snippet || '').trim(),
        date: item.date || null
      };
    })
    .filter(r => r.title && r.url);
}

/**
 * @param {{ goal?: string, company?: string, roleLabel?: string, sources?: string[], limit?: number }} opts
 */
export async function searchInterviewPosts(opts = {}) {
  const apiKey = process.env.SERPER_API_KEY?.trim();
  const sources = opts.sources?.length ? opts.sources : ['nowcoder', 'xiaohongshu'];
  const query = buildSearchQuery({
    goal: opts.goal || '',
    company: opts.company || '',
    roleLabel: opts.roleLabel || '',
    sources
  });

  if (!apiKey) {
    return {
      enabled: false,
      query,
      results: fallbackSearchLinks(query, opts.company, opts.roleLabel),
      message: '未配置 SERPER_API_KEY，已返回手动检索链接。请在 Vercel 配置 Serper API Key 以自动抓取面经摘要。'
    };
  }

  try {
    const data = await serperSearch(query, apiKey, Math.min(opts.limit || 8, 10));
    const results = normalizeSerperResults(data, sources);
    if (!results.length) {
      return {
        enabled: true,
        query,
        results: fallbackSearchLinks(query, opts.company, opts.roleLabel),
        message: '未检索到匹配面经，已提供手动搜索链接'
      };
    }
    return { enabled: true, query, results, message: null };
  } catch (e) {
    return {
      enabled: false,
      query,
      results: fallbackSearchLinks(query, opts.company, opts.roleLabel),
      message: String(e.message || e)
    };
  }
}

/** 从检索摘要提取可用于筛题的关键词 */
export function keywordsFromSearchResults(results, limit = 6) {
  const text = (results || [])
    .map(r => `${r.title} ${r.snippet}`)
    .join(' ');
  const picks = [];
  const patterns = [
    /字节|抖音|美团|阿里|腾讯|拼多多|滴滴|小红书|快手|京东|百度|网易|B站/g,
    /产品|运营|数分|数据分析|策略|商业化|增长|算法|交互|STAR|行为面|业务面|技术面|HR面/g,
    /OTA|电商|本地生活|推荐|搜索|直播|社区|SQL|留存|漏斗|GMV|DAU/g
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) m.forEach(w => { if (!picks.includes(w)) picks.push(w); });
  }
  return picks.slice(0, limit);
}

export { SOURCE_SITES, buildSearchQuery, fallbackSearchLinks };
