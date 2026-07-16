import { json } from './store.js';

const OCR_PROMPT =
  '你是 OCR。只输出图片里的招聘 JD / 岗位说明纯文本（岗位名、职责、要求、加分项等），按阅读顺序保留换行。不要解释、不要前后缀、不要 markdown 代码块。若含无关 UI 文案可略过，正文务必完整。';

function getVisionConfig() {
  const anthropicKey = (process.env.ANTHROPIC_API_KEY || '').trim();
  const openaiKey = (process.env.OPENAI_API_KEY || '').trim();
  const prefer = (process.env.OCR_PROVIDER || '').trim().toLowerCase();

  if (prefer === 'openai' && openaiKey) {
    return {
      provider: 'openai',
      apiKey: openaiKey,
      model: process.env.OCR_MODEL || process.env.OPENAI_VISION_MODEL || 'gpt-4o-mini',
      baseUrl: (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '')
    };
  }
  if (prefer === 'anthropic' && anthropicKey) {
    return {
      provider: 'anthropic',
      apiKey: anthropicKey,
      model: process.env.OCR_MODEL || process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6'
    };
  }
  // 默认：有 Anthropic 优先（中文截图稳），否则 OpenAI
  if (anthropicKey) {
    return {
      provider: 'anthropic',
      apiKey: anthropicKey,
      model: process.env.OCR_MODEL || process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6'
    };
  }
  if (openaiKey) {
    return {
      provider: 'openai',
      apiKey: openaiKey,
      model: process.env.OCR_MODEL || process.env.OPENAI_VISION_MODEL || 'gpt-4o-mini',
      baseUrl: (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '')
    };
  }
  return {
    error: '未配置视觉 OCR：请设置 ANTHROPIC_API_KEY 或 OPENAI_API_KEY',
    hint: '客户端将尝试本地 OCR；也可粘贴 JD 文本'
  };
}

function normalizeImagePayload(body) {
  let raw = String(body.imageBase64 || body.image || '').trim();
  if (!raw) return { error: '缺少 imageBase64' };
  let mime = String(body.mimeType || 'image/jpeg').toLowerCase();
  const dataUrl = raw.match(/^data:([^;]+);base64,(.+)$/i);
  if (dataUrl) {
    mime = dataUrl[1].toLowerCase();
    raw = dataUrl[2];
  }
  raw = raw.replace(/\s/g, '');
  if (!/^image\/(jpeg|jpg|png|webp|gif)$/.test(mime)) {
    if (mime === 'image/jpg') mime = 'image/jpeg';
    else return { error: '仅支持 PNG / JPG / WEBP / GIF 截图' };
  }
  // ~4MB base64 ≈ 3MB binary；再大易撞请求体限制
  if (raw.length > 5.5e6) return { error: '截图过大，请裁剪后重试（建议 < 4MB）' };
  return { base64: raw, mime };
}

async function ocrWithAnthropic(cfg, base64, mime) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': cfg.apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: cfg.model,
      max_tokens: 4096,
      temperature: 0,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mime === 'image/jpg' ? 'image/jpeg' : mime, data: base64 }
            },
            { type: 'text', text: OCR_PROMPT }
          ]
        }
      ]
    })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { error: data?.error?.message || 'Anthropic 视觉 OCR 失败', status: res.status };
  }
  const text = String(data?.content?.[0]?.text || '').trim();
  if (!text) return { error: '未识别到文字', status: 502 };
  return { text };
}

async function ocrWithOpenAI(cfg, base64, mime) {
  const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${cfg.apiKey}`
    },
    body: JSON.stringify({
      model: cfg.model,
      max_tokens: 4096,
      temperature: 0,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: OCR_PROMPT },
            {
              type: 'image_url',
              image_url: { url: `data:${mime};base64,${base64}`, detail: 'high' }
            }
          ]
        }
      ]
    })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { error: data?.error?.message || 'OpenAI 视觉 OCR 失败', status: res.status };
  }
  const text = String(data?.choices?.[0]?.message?.content || '').trim();
  if (!text) return { error: '未识别到文字', status: 502 };
  return { text };
}

/** @param {Record<string, unknown>} body */
export async function handleOcr(body) {
  const cfg = getVisionConfig();
  if (cfg.error) return json({ error: cfg.error, hint: cfg.hint, fallbackLocal: true }, 503);

  const img = normalizeImagePayload(body);
  if (img.error) return json({ error: img.error }, 400);

  const result =
    cfg.provider === 'openai'
      ? await ocrWithOpenAI(cfg, img.base64, img.mime)
      : await ocrWithAnthropic(cfg, img.base64, img.mime);

  if (result.error) {
    return json({ error: result.error, fallbackLocal: true }, result.status || 502);
  }

  return json({
    ok: true,
    text: result.text,
    provider: cfg.provider,
    model: cfg.model
  });
}
