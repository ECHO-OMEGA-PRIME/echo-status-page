/**
 * echo-status-page v1.1.0
 * Public status page for ECHO OMEGA PRIME services.
 * Serves HTML dashboard + JSON API. Cron monitors every 5 min.
 * v1.1: Incident detection, alert integration, uptime bars, latency tracking.
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
  CRM: Fetcher;
  HELPDESK: Fetcher;
  BOOKING: Fetcher;
  INVOICE: Fetcher;
  CALL_CENTER: Fetcher;
  FLEET_COMMANDER: Fetcher;
  BUILD_ORCHESTRATOR: Fetcher;
  WEBHOOK_ROUTER: Fetcher;
  SERVICE_REGISTRY: Fetcher;
  AUTONOMOUS_BUILDER: Fetcher;
  GRAPH_RAG: Fetcher;
  MEMORY_PRIME: Fetcher;
  AI_ORCHESTRATOR: Fetcher;
  OMNISYNC: Fetcher;
  SWARM_BRAIN: Fetcher;
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
  // Core AI (4)
  { id: 'engine-runtime', name: 'Engine Runtime', category: 'Core AI', binding: 'ENGINE_RUNTIME', healthPath: '/health', critical: true },
  { id: 'shared-brain', name: 'Shared Brain', category: 'Core AI', binding: 'SHARED_BRAIN', healthPath: '/health', critical: true },
  { id: 'echo-chat', name: 'Echo Chat', category: 'Core AI', binding: 'ECHO_CHAT', healthPath: '/health', critical: true },
  { id: 'knowledge-forge', name: 'Knowledge Forge', category: 'Core AI', binding: 'KNOWLEDGE_FORGE', healthPath: '/health', critical: true },
  // Voice & Knowledge (2)
  { id: 'speak-cloud', name: 'Speak Cloud (TTS)', category: 'Voice', binding: 'SPEAK_CLOUD', healthPath: '/health', critical: false },
  { id: 'doctrine-forge', name: 'Doctrine Forge', category: 'Knowledge', binding: 'DOCTRINE_FORGE', healthPath: '/health', critical: false },
  // Intelligence (4)
  { id: 'graph-rag', name: 'GraphRAG', category: 'Intelligence', binding: 'GRAPH_RAG', healthPath: '/health', critical: false },
  { id: 'memory-prime', name: 'Memory Prime', category: 'Intelligence', binding: 'MEMORY_PRIME', healthPath: '/health', critical: false },
  { id: 'ai-orchestrator', name: 'AI Orchestrator', category: 'Intelligence', binding: 'AI_ORCHESTRATOR', healthPath: '/health', critical: true },
  { id: 'swarm-brain', name: 'Swarm Brain', category: 'Intelligence', binding: 'SWARM_BRAIN', healthPath: '/health', critical: false },
  // Revenue Products (5)
  { id: 'crm', name: 'CRM', category: 'Revenue Products', binding: 'CRM', healthPath: '/health', critical: false },
  { id: 'helpdesk', name: 'Helpdesk', category: 'Revenue Products', binding: 'HELPDESK', healthPath: '/health', critical: false },
  { id: 'booking', name: 'Booking', category: 'Revenue Products', binding: 'BOOKING', healthPath: '/health', critical: false },
  { id: 'invoice', name: 'Invoicing', category: 'Revenue Products', binding: 'INVOICE', healthPath: '/health', critical: false },
  { id: 'call-center', name: 'Call Center', category: 'Revenue Products', binding: 'CALL_CENTER', healthPath: '/health', critical: false },
  // Infrastructure (6)
  { id: 'autonomous-daemon', name: 'Fleet Daemon', category: 'Infrastructure', binding: 'AUTONOMOUS_DAEMON', healthPath: '/health', critical: true },
  { id: 'fleet-commander', name: 'Fleet Commander', category: 'Infrastructure', binding: 'FLEET_COMMANDER', healthPath: '/health', critical: true },
  { id: 'build-orchestrator', name: 'Build Orchestrator', category: 'Infrastructure', binding: 'BUILD_ORCHESTRATOR', healthPath: '/status', critical: true },
  { id: 'webhook-router', name: 'Webhook Router', category: 'Infrastructure', binding: 'WEBHOOK_ROUTER', healthPath: '/health', critical: false },
  { id: 'service-registry', name: 'Service Registry', category: 'Infrastructure', binding: 'SERVICE_REGISTRY', healthPath: '/health', critical: false },
  { id: 'autonomous-builder', name: 'Auto Builder', category: 'Infrastructure', binding: 'AUTONOMOUS_BUILDER', healthPath: '/health', critical: false },
  { id: 'analytics-engine', name: 'Analytics Engine', category: 'Infrastructure', binding: 'ANALYTICS_ENGINE', healthPath: '/health', critical: false },
  { id: 'omnisync', name: 'OmniSync', category: 'Infrastructure', binding: 'OMNISYNC', healthPath: '/', critical: false },
  // Security & Platform (2)
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

interface UptimeDay {
  date: string;
  uptime_pct: number;
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

// ─── Incident Detection ─────────────────────────────────────────────────────

async function detectIncidents(db: D1Database, results: CheckResult[]): Promise<void> {
  const downCritical = results.filter(r => r.status === 'down' && r.critical);
  const downNonCritical = results.filter(r => r.status === 'down' && !r.critical);

  // Check for open incidents
  const { results: openIncidents } = await db.prepare(
    "SELECT id, services FROM incidents WHERE status != 'resolved' ORDER BY created_at DESC LIMIT 10"
  ).all();

  const openServiceIds = new Set<string>();
  for (const inc of (openIncidents ?? [])) {
    try {
      const svcs = JSON.parse((inc as { services: string }).services) as string[];
      svcs.forEach(s => openServiceIds.add(s));
    } catch { /* skip */ }
  }

  // Create new incidents for newly-down critical services
  for (const svc of downCritical) {
    if (!openServiceIds.has(svc.serviceId)) {
      await db.prepare(
        "INSERT INTO incidents (title, status, severity, services, message) VALUES (?, 'investigating', 'major', ?, ?)"
      ).bind(
        `${svc.name} is down`,
        JSON.stringify([svc.serviceId]),
        `${svc.name} returned status ${svc.statusCode}. ${svc.error || 'Service unreachable.'}`
      ).run();
    }
  }

  // Create incidents for non-critical services (minor severity)
  for (const svc of downNonCritical) {
    if (!openServiceIds.has(svc.serviceId)) {
      await db.prepare(
        "INSERT INTO incidents (title, status, severity, services, message) VALUES (?, 'investigating', 'minor', ?, ?)"
      ).bind(
        `${svc.name} degraded`,
        JSON.stringify([svc.serviceId]),
        `${svc.name} returned status ${svc.statusCode}. ${svc.error || 'Service unreachable.'}`
      ).run();
    }
  }

  // Auto-resolve incidents where all services are back up
  const allUp = new Set(results.filter(r => r.status === 'up').map(r => r.serviceId));
  for (const inc of (openIncidents ?? [])) {
    try {
      const svcs = JSON.parse((inc as { services: string }).services) as string[];
      if (svcs.every(s => allUp.has(s))) {
        await db.prepare(
          "UPDATE incidents SET status = 'resolved', resolved_at = datetime('now') WHERE id = ?"
        ).bind((inc as { id: number }).id).run();
      }
    } catch { /* skip */ }
  }
}

// ─── Alert Integration ──────────────────────────────────────────────────────

async function sendAlerts(results: CheckResult[]): Promise<void> {
  const downCritical = results.filter(r => r.status === 'down' && r.critical);
  if (downCritical.length === 0) return;

  const msg = `🚨 STATUS ALERT: ${downCritical.length} critical service(s) DOWN — ${downCritical.map(s => s.name).join(', ')}`;

  // Fire-and-forget to alert router + shared brain
  try {
    await fetch('https://echo-alert-router.bmcii1976.workers.dev/alert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Echo-API-Key': 'echo-omega-prime-forge-x-2026' },
      body: JSON.stringify({
        source: 'echo-status-page',
        severity: 'critical',
        title: `${downCritical.length} critical services down`,
        message: msg,
        services: downCritical.map(s => s.serviceId),
      }),
    });
  } catch { /* best effort */ }

  try {
    await fetch('https://echo-shared-brain.bmcii1976.workers.dev/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Echo-API-Key': 'echo-omega-prime-forge-x-2026' },
      body: JSON.stringify({
        instance_id: 'echo-status-page',
        role: 'system',
        content: msg,
        importance: 9,
        tags: ['alert', 'outage', 'status-page'],
      }),
    });
  } catch { /* best effort */ }
}

// ─── HTML Page ──────────────────────────────────────────────────────────────

function statusIcon(s: string): string {
  if (s === 'up') return '<span style="color:#10b981">●</span>';
  if (s === 'degraded') return '<span style="color:#f59e0b">●</span>';
  return '<span style="color:#ef4444">●</span>';
}

function uptimeBarColor(pct: number): string {
  if (pct >= 99.5) return '#10b981';
  if (pct >= 95) return '#f59e0b';
  return '#ef4444';
}

function renderHTML(
  results: CheckResult[],
  uptimeToday: Record<string, number>,
  uptimeHistory: Record<string, UptimeDay[]>,
  incidents: Array<{ id: number; title: string; status: string; severity: string; created_at: string; resolved_at: string | null }>,
): string {
  const allUp = results.every(r => r.status === 'up');
  const anyDown = results.some(r => r.status === 'down');
  const overallStatus = allUp ? 'All Systems Operational' : anyDown ? 'Partial Outage' : 'Degraded Performance';
  const overallColor = allUp ? '#10b981' : anyDown ? '#ef4444' : '#f59e0b';

  const avgLatency = Math.round(results.reduce((s, r) => s + r.latencyMs, 0) / results.length);
  const categories = [...new Set(results.map(r => r.category))];

  const serviceRows = categories.map(cat => {
    const svcs = results.filter(r => r.category === cat);
    const rows = svcs.map(r => {
      const history = uptimeHistory[r.serviceId] || [];
      const bars = history.slice(0, 30).reverse().map(d =>
        `<div title="${d.date}: ${d.uptime_pct.toFixed(1)}%" style="width:4px;height:20px;background:${uptimeBarColor(d.uptime_pct)};border-radius:1px"></div>`
      ).join('');

      return `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 0;border-bottom:1px solid #1e293b">
        <div style="display:flex;align-items:center;gap:10px;min-width:200px">
          ${statusIcon(r.status)}
          <span style="color:#e2e8f0;font-weight:500">${r.name}</span>
          ${r.critical ? '<span style="font-size:10px;background:#7c3aed;color:white;padding:1px 6px;border-radius:4px">CRITICAL</span>' : ''}
        </div>
        <div style="display:flex;align-items:center;gap:2px;flex:1;justify-content:center">${bars}</div>
        <div style="display:flex;align-items:center;gap:16px;min-width:180px;justify-content:flex-end">
          <span style="color:#64748b;font-size:13px;font-family:monospace">${r.latencyMs}ms</span>
          <span style="color:${r.status === 'up' ? '#10b981' : r.status === 'degraded' ? '#f59e0b' : '#ef4444'};font-size:13px;font-weight:600;text-transform:uppercase">${r.status}</span>
          ${uptimeToday[r.serviceId] !== undefined ? `<span style="color:#94a3b8;font-size:12px">${uptimeToday[r.serviceId].toFixed(1)}%</span>` : ''}
        </div>
      </div>
    `;
    }).join('');

    return `
      <div style="margin-bottom:24px">
        <h3 style="color:#8b5cf6;font-size:14px;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px;font-family:monospace">${cat}</h3>
        ${rows}
      </div>
    `;
  }).join('');

  // Incident history section
  const openIncidents = incidents.filter(i => i.status !== 'resolved');
  const recentResolved = incidents.filter(i => i.status === 'resolved').slice(0, 5);

  const incidentSection = (openIncidents.length > 0 || recentResolved.length > 0) ? `
    <div style="margin-top:32px">
      <h2 style="color:#e2e8f0;font-size:18px;font-weight:700;margin-bottom:16px">Incidents</h2>
      ${openIncidents.map(i => `
        <div style="background:#ef444415;border:1px solid #ef444440;border-radius:8px;padding:12px 16px;margin-bottom:8px">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span style="color:#ef4444;font-weight:600">${i.title}</span>
            <span style="color:#ef4444;font-size:12px;text-transform:uppercase">${i.severity}</span>
          </div>
          <div style="color:#64748b;font-size:12px;margin-top:4px">${i.created_at}</div>
        </div>
      `).join('')}
      ${recentResolved.map(i => `
        <div style="background:#10b98108;border:1px solid #10b98120;border-radius:8px;padding:12px 16px;margin-bottom:8px">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span style="color:#94a3b8;font-weight:500;text-decoration:line-through">${i.title}</span>
            <span style="color:#10b981;font-size:12px">RESOLVED</span>
          </div>
          <div style="color:#475569;font-size:12px;margin-top:4px">${i.created_at} → ${i.resolved_at || '?'}</div>
        </div>
      `).join('')}
    </div>
  ` : '';

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
  <div style="max-width:800px;margin:0 auto;padding:40px 20px">
    <div style="text-align:center;margin-bottom:32px">
      <h1 style="font-size:28px;font-weight:800;background:linear-gradient(135deg,#9900ff,#ff6b35);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:4px">ECHO OMEGA PRIME</h1>
      <p style="color:#64748b;font-size:14px">System Status</p>
    </div>

    <div style="background:${overallColor}15;border:1px solid ${overallColor}40;border-radius:12px;padding:20px;text-align:center;margin-bottom:32px">
      <div style="font-size:20px;font-weight:700;color:${overallColor}">${overallStatus}</div>
      <div style="color:#64748b;font-size:13px;margin-top:4px">
        Last checked: ${new Date().toUTCString()} &bull; Avg latency: ${avgLatency}ms &bull; ${results.length} services
      </div>
    </div>

    <div style="display:flex;justify-content:flex-end;margin-bottom:8px;gap:8px;font-size:11px;color:#64748b">
      <span>30-day uptime →</span>
      <div style="display:flex;gap:4px;align-items:center">
        <div style="width:8px;height:8px;background:#10b981;border-radius:1px"></div> &gt;99.5%
        <div style="width:8px;height:8px;background:#f59e0b;border-radius:1px;margin-left:4px"></div> &gt;95%
        <div style="width:8px;height:8px;background:#ef4444;border-radius:1px;margin-left:4px"></div> &lt;95%
      </div>
    </div>

    ${serviceRows}

    ${incidentSection}

    <div style="text-align:center;margin-top:40px;padding-top:20px;border-top:1px solid #1e293b">
      <p style="color:#475569;font-size:12px">
        Powered by <a href="https://echo-op.com">ECHO OMEGA PRIME</a> &bull;
        <a href="https://echo-ept.com">echo-ept.com</a> &bull;
        Monitored every 5 minutes &bull; <a href="/api/status">JSON API</a>
      </p>
    </div>
  </div>
  <script>setTimeout(()=>location.reload(),300000)</script>
</body>
</html>`;
}

// ─── Route Handlers ─────────────────────────────────────────────────────────

async function getUptimeHistory(db: D1Database): Promise<Record<string, UptimeDay[]>> {
  const result: Record<string, UptimeDay[]> = {};
  try {
    const { results: rows } = await db.prepare(
      'SELECT service_id, date, uptime_pct FROM uptime_daily WHERE date >= date("now", "-30 days") ORDER BY date DESC'
    ).all();
    for (const row of (rows ?? [])) {
      const r = row as { service_id: string; date: string; uptime_pct: number };
      if (!result[r.service_id]) result[r.service_id] = [];
      result[r.service_id].push({ date: r.date, uptime_pct: r.uptime_pct });
    }
  } catch { /* no data yet */ }
  return result;
}

async function getIncidents(db: D1Database, limit = 20): Promise<Array<{ id: number; title: string; status: string; severity: string; created_at: string; resolved_at: string | null }>> {
  try {
    const { results: rows } = await db.prepare(
      'SELECT id, title, status, severity, created_at, resolved_at FROM incidents ORDER BY created_at DESC LIMIT ?'
    ).bind(limit).all();
    return (rows ?? []) as Array<{ id: number; title: string; status: string; severity: string; created_at: string; resolved_at: string | null }>;
  } catch { return []; }
}

async function handleStatus(env: Env): Promise<Response> {
  const cached = await env.CACHE.get('status_html');
  if (cached) {
    return new Response(cached, { headers: { 'Content-Type': 'text/html;charset=utf-8', 'Cache-Control': 'public, max-age=60' } });
  }

  const [results, uptimeHistory, incidents] = await Promise.all([
    runAllChecks(env),
    getUptimeHistory(env.DB),
    getIncidents(env.DB),
  ]);

  const uptimeToday: Record<string, number> = {};
  const today = new Date().toISOString().slice(0, 10);
  try {
    const { results: rows } = await env.DB.prepare(
      'SELECT service_id, uptime_pct FROM uptime_daily WHERE date = ? ORDER BY service_id'
    ).bind(today).all();
    for (const row of (rows ?? [])) {
      const r = row as { service_id: string; uptime_pct: number };
      uptimeToday[r.service_id] = r.uptime_pct;
    }
  } catch { /* no data yet */ }

  const html = renderHTML(results, uptimeToday, uptimeHistory, incidents);
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
    avg_latency_ms: Math.round(results.reduce((s, r) => s + r.latencyMs, 0) / results.length),
    checked_at: new Date().toISOString(),
    version: '1.1.0',
  };
  await env.CACHE.put('status_json', JSON.stringify(response), { expirationTtl: 300 });
  return json(response);
}

async function handleHealth(env: Env): Promise<Response> {
  return json({
    ok: true,
    service: env.SERVICE_NAME,
    version: '1.1.0',
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

async function handleIncidents(env: Env): Promise<Response> {
  const incidents = await getIncidents(env.DB, 50);
  return json({ ok: true, incidents });
}

// ─── Cron ───────────────────────────────────────────────────────────────────

async function handleCron(env: Env): Promise<void> {
  const results = await runAllChecks(env);
  await storeChecks(env.DB, results);
  await updateUptime(env.DB, results);
  await detectIncidents(env.DB, results);

  // Invalidate caches
  await env.CACHE.delete('status_html');
  await env.CACHE.delete('status_json');

  const down = results.filter(r => r.status === 'down');
  if (down.length > 0) {
    console.log(JSON.stringify({
      level: 'warn',
      service: 'echo-status-page',
      version: '1.1.0',
      message: `${down.length} services down`,
      services: down.map(d => d.serviceId),
      critical: down.filter(d => d.critical).map(d => d.serviceId),
    }));
    // Send alerts for critical outages
    await sendAlerts(results);
  }

  // Prune old check data (keep 7 days)
  try {
    await env.DB.prepare("DELETE FROM checks WHERE checked_at < datetime('now', '-7 days')").run();
  } catch { /* best effort */ }
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
    if (method === 'GET' && path === '/api/incidents') return handleIncidents(env);

    return json({ ok: false, error: 'not found', endpoints: [
      'GET / — HTML status page',
      'GET /health — Health check',
      'GET /api/status — JSON status',
      'GET /api/uptime — Uptime history',
      'GET /api/incidents — Incident history',
    ] }, 404);
  },

  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(handleCron(env));
  },
} satisfies ExportedHandler<Env>;
