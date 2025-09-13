// scripts/http.ts
import http from 'http';
import https from 'https';

export type R = { ok: boolean; status: number; headers: any; text: () => Promise<string>; json: () => Promise<any> };

export function redact(v?: string) {
  if (!v) return '';
  const tail = v.slice(-4);
  return `…${tail}`;
}

export async function fetchx(url: string, init: { method?: string; headers?: Record<string,string>; body?: any; timeoutMs?: number; retries?: number } = {}): Promise<R> {
  const { method = 'GET', headers = {}, body, timeoutMs = 8000, retries = 2 } = init;
  const doOnce = () => new Promise<R>((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.request(url, { method, headers, timeout: timeoutMs }, res => {
      const chunks: Buffer[] = [];
      res.on('data', d => chunks.push(d));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        const status = res.statusCode || 0;
        const ok = status >= 200 && status < 300;
        resolve({ ok, status, headers: res.headers, text: async () => buf.toString('utf8'), json: async () => JSON.parse(buf.toString('utf8') || '{}') });
      });
    });
    req.on('error', reject);
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
  let lastErr: any;
  for (let i = 0; i <= retries; i++) {
    try { return await doOnce(); } catch (e) { lastErr = e; await new Promise(r => setTimeout(r, 500 * (i+1))); }
  }
  throw lastErr;
}
