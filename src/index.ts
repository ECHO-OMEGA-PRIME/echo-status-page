/**
 * echo-status-page v1.0.0
 * Public status page for ECHO OMEGA PRIME services.
 * Serves HTML dashboard + JSON API. Cron monitors every 5 min.
 */

interface Env {
  DB: D1Database;
  CACHE: KVNamespace;
  ENGINE_RUNTIME: Fetcher;
  SHARED_BRAIN: Fetcher;
  ECHO_CHAT: Fetcher;
  KNOWLEDGE_FORGE: Fetcher;
  SPEAK_CLOUD: Fetcher;
  DOCTRINE_FORGE: Fetcher;
  AUTONOMOUS_DAEMON: Fetcher;
  ANALYTICS_ENGINE: Fetcher;
  VAULT_API: Fetcher;
  SDK_GATEWAY: Fetcher;
  VERSION: string;
  SERVICE_NAME: string;
}

interface ServiceDef {
  id: string;
  name: string;
  category: string;
  binding: keyof Env;
  healthPath: string;
  critical: boolean;
}

const MONITORED_SERVICES: ServiceDef[] = [
  { id: 'engine-runtime', name: 'Engine Runtime', category: 'Core AI', binding: 'ENGINE_RUNTIME', healthPath: '/health', critical: true },
  { id: 'shared-brain', name: 'Shared Brain', category: 'Core AI', binding: 'SHARED_BRAIN', healthPath: '/health', critical: true },
  { id: 'echo-chat', name: 'Echo Chat', category: 'Core AI', binding: 'ECHO_CHAT', healthPath: '/health', critical: true },
  { id: 'knowledge-forge', name: 'Knowledge Forge', category: 'Core AI', binding: 'KNOWLEDGE_FORGE', healthPath: '/health', critical: true },
  { id: 'speak-cloud', name: 'Speak Cloud (TTS)', category: 'Voice', binding: 'SPEAK_CLOUD', healthPath: '/health', critical: false },
  { id: 'doctrine-forge', name: 'Doctrine Forge', category: 'Knowledge', binding: 'DOCTRINE_FORGE', healthPath: '/health', critical: false },
  { id: 'autonomous-daemon', name: 'Fleet Daemon', category: 'Infrastructure', binding: 'AUTONOMOUS_DAEMON', healthPath: '/health', critical: true },
  { id: 'analytics-engine', name: 'Analytics Engine', category: 'Infrastructure', binding: 'ANALYTICS_ENGINE', healthPath: '/health', critical: false },
  { id: 'vault-api', name: 'Vault API', category: 'Security', binding: 'VAULT_API', healthPath: '/health', critical: true },
  { id: 'sdk-gateway', name: 'SDK Gateway', category: 'Platform', binding: 'SDK_GATEWAY', healthPath: '/health', critical: true },
];

interface CheckResult {
  serviceId: string;
  name: string;
  category: string;
  status: 'up' | 'degraded' | 'down';
  latencyMs: number;
  statusCode: number;
  error?: string;
  critical: boolean;
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

// ─── Health Checks ──────────────────────────────────────────────────────────

async function checkService(env: Env, svc: ServiceDef): Promise<CheckResult> {
  const start = Date.now();
  try {
    const binding = env[svc.binding] as Fetcher;
    const res = await binding.fetch(`http://internal${svc.healthPath}`, {
      headers: { 'X-Echo-API-Key': 'echo-omega-prime-forge-x-2026' },
    });
    const latency = Date.now() - start;
    const status: 'up' | 'degraded' | 'down' = res.ok ? (latency > 5000 ? 'degraded' : 'up') : 'down';
    return { serviceId: svc.id, name: svc.name, category: svc.category, status, latencyMs: latency, statusCode: res.status, critical: svc.critical };
  } catch (e) {
    return { serviceId: svc.id, name: svc.name, category: svc.category, status: 'down', latencyMs: Date.now() - start, statusCode: 0, error: String(e), critical: svc.critical };
  }
}

async function runAllChecks(env: Env): Promise<CheckResult[]> {
  return Promise.all(MONITORED_SERVICES.map(svc => checkService(env, svc)));
}

async function storeChecks(db: D1Database, results: CheckResult[]): Promise<void> {
  const stmt = db.prepare('INSERT INTO checks (service_id, status, latency_ms, status_code, error) VALUES (?, ?, ?, ?, ?)');
  const batch = results.map(r => stmt.bind(r.serviceId, r.status, r.latencyMs, r.statusCode, r.error ?? null));
  await db.batch(batch);
}

async function updateUptime(db: D1Database, results: CheckResult[]): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  for (const r of results) {
    await db.prepare(`
      INSERT INTO uptime_daily (service_id, date, total_checks, up_checks, avg_latency, uptime_pct)
      VALUES (?, ?, 1, ?, ?, ?)
      ON CONFLICT(service_id, date) DO UPDATE SET
        total_checks = total_checks + 1,
        up_checks = up_checks + ?,
        avg_latency = (avg_latency * total_checks + ?) / (total_checks + 1),
        uptime_pct = CAST((up_checks + ?) AS REAL) / (total_checks + 1) * 100
    `).bind(
      r.serviceId, today,
      r.status === 'up' ? 1 : 0, r.latencyMs, r.status === 'up' ? 100.0 : 0.0,
      r.status === 'up' ? 1 : 0, r.latencyMs, r.status === 'up' ? 1 : 0
    ).run();
  }
}

// ─── HTML Page ──────────────────────────────────────────────────────────────

function statusIcon(s: string): string {
  if (s === 'up') return '<span style="color:#10b981">●</span>';
  if (s === 'degraded') return '<span style="color:#f59e0b">●</span>';
  return '<span style="color:#ef4444">●</span>';
}

function renderHTML(results: CheckResult[], uptimeData: Record<string, number>): string {
  const allUp = results.every(r => r.status === 'up');
  const anyDown = results.some(r => r.status === 'down');
  const overallStatus = allUp ? 'All Systems Operational' : anyDown ? 'Partial Outage' : 'Degraded Performance';
  const overallColor = allUp ? '#10b981' : anyDown ? '#ef4444' : '#f59e0b';

  const categories = [...new Set(results.map(r => r.category))];

  const serviceRows = categories.map(cat => {
    const svcs = results.filter(r => r.category === cat);
    const rows = svcs.map(r => `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 0;border-bottom:1px solid #1e293b">
        <div style="display:flex;align-items:center;gap:10px">
          ${statusIcon(r.status)}
          <span style="color:#e2e8f0;font-weight:500">${r.name}</span>
          ${r.critical ? '<span style="font-size:10px;background:#7c3aed;color:white;padding:1px 6px;border-radius:4px">CRITICAL</span>' : ''}
        </div>
        <div style="display:flex;align-items:center;gap:16px">
          <span style="color:#64748b;font-size:13px">${r.latencyMs}ms</span>
          <span style="color:${r.status === 'up' ? '#10b981' : r.status === 'degraded' ? '#f59e0b' : '#ef4444'};font-size:13px;font-weight:600;text-transform:uppercase">${r.status}</span>
          ${uptimeData[r.serviceId] !== undefined ? `<span style="color:#94a3b8;font-size:12px">${uptimeData[r.serviceId].toFixed(1)}%</span>` : ''}
        </div>
      </div>
    `).join('');

    return `
      <div style="margin-bottom:24px">
        <h3 style="color:#8b5cf6;font-size:14px;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px;font-family:monospace">${cat}</h3>
        ${rows}
      </div>
    `;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>ECHO OMEGA PRIME — System Status</title>
  <meta name="description" content="Real-time status of ECHO OMEGA PRIME services">
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{background:#0a0a0a;color:#e2e8f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;min-height:100vh}
    a{color:#8b5cf6;text-decoration:none}
    a:hover{text-decoration:underline}
  </style>
</head>
<body>
  <div style="max-width:720px;margin:0 auto;padding:40px 20px">
    <div style="text-align:center;margin-bottom:32px">
      <h1 style="font-size:28px;font-weight:800;background:linear-gradient(135deg,#9900ff,#ff6b35);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:4px">ECHO OMEGA PRIME</h1>
      <p style="color:#64748b;font-size:14px">System Status</p>
    </div>

    <div style="background:${overallColor}15;border:1px solid ${overallColor}40;border-radius:12px;padding:20px;text-align:center;margin-bottom:32px">
      <div style="font-size:20px;font-weight:700;color:${overallColor}">${overallStatus}</div>
      <div style="color:#64748b;font-size:13px;margin-top:4px">Last checked: ${new Date().toUTCString()}</div>
    </div>

    ${serviceRows}

    <div style="text-align:center;margin-top:40px;padding-top:20px;border-top:1px solid #1e293b">
      <p style="color:#475569;font-size:12px">
        Powered by <a href="https://echo-op.com">ECHO OMEGA PRIME</a> •
        <a href="https://echo-ept.com">echo-ept.com</a> •
        Monitored every 5 minutes
      </p>
    </div>
  </div>
  <script>setTimeout(()=>location.reload(),300000)</script>
</body>
</html>`;
}

// ─── Route Handlers ─────────────────────────────────────────────────────────

async function handleStatus(env: Env): Promise<Response> {
  // Try cache first (5 min TTL)
  const cached = await env.CACHE.get('status_html');
  if (cached) {
    return new Response(cached, { headers: { 'Content-Type': 'text/html;charset=utf-8', 'Cache-Control': 'public, max-age=60' } });
  }

  const results = await runAllChecks(env);

  // Get uptime data for today
  const uptimeData: Record<string, number> = {};
  try {
    const { results: rows } = await env.DB.prepare(
      'SELECT service_id, uptime_pct FROM uptime_daily WHERE date = ? ORDER BY service_id'
    ).bind(new Date().toISOString().slice(0, 10)).all();
    for (const row of rows ?? []) {
      const r = row as { service_id: string; uptime_pct: number };
      uptimeData[r.service_id] = r.uptime_pct;
    }
  } catch { /* no uptime data yet */ }

  const html = renderHTML(results, uptimeData);
  await env.CACHE.put('status_html', html, { expirationTtl: 300 });
  return new Response(html, { headers: { 'Content-Type': 'text/html;charset=utf-8', 'Cache-Control': 'public, max-age=60' } });
}

async function handleApiStatus(env: Env): Promise<Response> {
  const cached = await env.CACHE.get('status_json');
  if (cached) return json(JSON.parse(cached));

  const results = await runAllChecks(env);
  const allUp = results.every(r => r.status === 'up');
  const response = {
    ok: true,
    overall: allUp ? 'operational' : 'degraded',
    services: results,
    checked_at: new Date().toISOString(),
    version: '1.0.0',
  };
  await env.CACHE.put('status_json', JSON.stringify(response), { expirationTtl: 300 });
  return json(response);
}

async function handleHealth(env: Env): Promise<Response> {
  return json({
    ok: true,
    service: env.SERVICE_NAME,
    version: env.VERSION,
    timestamp: new Date().toISOString(),
    monitored_services: MONITORED_SERVICES.length,
  });
}

async function handleUptime(env: Env): Promise<Response> {
  const { results: rows } = await env.DB.prepare(
    'SELECT service_id, date, uptime_pct, avg_latency, total_checks FROM uptime_daily ORDER BY date DESC LIMIT 300'
  ).all();
  return json({ ok: true, data: rows ?? [] });
}

// ��── Cron ───────────────────────────────────────────────────────────────────

async function handleCron(env: Env): Promise<void> {
  const results = await runAllChecks(env);
  await storeChecks(env.DB, results);
  await updateUptime(env.DB, results);
  // Invalidate caches
  await env.CACHE.delete('status_html');
  await env.CACHE.delete('status_json');

  const down = results.filter(r => r.status === 'down');
  if (down.length > 0) {
    console.log(JSON.stringify({
      level: 'warn',
      service: 'echo-status-page',
      message: `${down.length} services down`,
      services: down.map(d => d.serviceId),
    }));
  }
}

// ─── Router ─────────────────────────────────────────────────────────────────

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;
    const method = req.method;

    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    if (method === 'GET' && (path === '/' || path === '')) return handleStatus(env);
    if (method === 'GET' && path === '/health') return handleHealth(env);
    if (method === 'GET' && path === '/api/status') return handleApiStatus(env);
    if (method === 'GET' && path === '/api/uptime') return handleUptime(env);

    return json({ ok: false, error: 'not found' }, 404);
  },

  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(handleCron(env));
  },
} satisfies ExportedHandler<Env>;
