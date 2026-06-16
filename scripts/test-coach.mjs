import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const envPath = join(root, '.env.local');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  }
}

const handler = (await import(pathToFileURL(join(root, 'api', 'coach.js')))).default;

const req = {
  method: 'POST',
  headers: { get: () => null },
  json: async () => ({
    accessCode: 'guest',
    userId: 'guest',
    action: 'resume-score',
    contextModule: 'resume',
    intake: {
      resume: '张三，AI产品实习。项目：RAG知识库，负责需求与评测。',
      targetRole: 'AI产品实习'
    }
  })
};

console.log('DEEPSEEK_API_KEY set:', Boolean(process.env.DEEPSEEK_API_KEY));
console.log('AUTH_DISABLED:', process.env.AUTH_DISABLED);

const t0 = Date.now();
const res = await handler(req);
const body = await res.text();
console.log('status', res.status, 'ms', Date.now() - t0);
console.log(body.slice(0, 1200));
