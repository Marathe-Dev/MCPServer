import type { DeviceInfo } from "../relay/device-registry.js";

/** Minimal HTML-escape for values interpolated into the widget markup. */
function esc(value: string): string {
  return value.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string),
  );
}

/** Inline SVG icons so the widget renders even when a sandboxed iframe blocks CDNs. */
const ICONS: Record<string, string> = {
  win32: '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M3 5.5 10 4.5v7H3zM10 12.5v7L3 18.5v-6zM11 4.3 21 3v8.5H11zM21 12.5V21l-10-1.3v-7.2z"/></svg>',
  darwin: '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M16 3c.1 1.2-.4 2.3-1.1 3.1-.7.9-1.9 1.5-3 1.4-.1-1.1.4-2.3 1.1-3 .8-.9 2-1.5 3-1.5zM19.5 17.4c-.5 1.2-.8 1.7-1.4 2.7-.9 1.4-2.2 3.2-3.8 3.2-1.4 0-1.8-.9-3.7-.9s-2.3.9-3.7.9c-1.6 0-2.8-1.6-3.7-3C.9 17.1.6 12.3 2.6 9.9c1-1.2 2.4-1.9 3.8-1.9 1.5 0 2.4.9 3.7.9 1.2 0 2-.9 3.7-.9 1.3 0 2.6.7 3.6 1.9-3.1 1.7-2.6 6.2.1 7.6z"/></svg>',
  linux: '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12 2c2 0 3 2 3 4 0 1 .5 2 1 3 1 1.5 2 3 2 5 0 1-.5 2-1 3 .5 1 1 2 0 3-1 .5-2 0-3-.5-.5.5-1.5 1-3 1s-2.5-.5-3-1c-1 .5-2 1-3 .5-1-1-.5-2 0-3-.5-1-1-2-1-3 0-2 1-3.5 2-5 .5-1 1-2 1-3 0-2 1-4 3-4z"/></svg>',
  unknown: '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M4 5h16v11H4zM2 19h20v2H2z"/></svg>',
  camera: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 8h3l2-2h6l2 2h3v11H4z"/><circle cx="12" cy="13" r="3"/></svg>',
  windows: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>',
  keyboard: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8"/></svg>',
  click: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 3v4M5 5l2.5 2.5M3 9h4M12 12l7 3-3 1-1 3z"/></svg>',
  refresh: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-3-6.7L21 8M21 4v4h-4"/></svg>',
  link: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 4h6v6M20 4l-9 9M10 6H5v13h13v-5"/></svg>',
};

function platformIcon(platform: string): string {
  return ICONS[platform] ?? ICONS.unknown;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.max(0, Math.floor(diff / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function renderCard(d: DeviceInfo): string {
  const online = d.status === "online";
  const dis = online ? "" : "disabled";
  return `
  <div class="card">
    <div class="card__top">
      <div class="card__name">${platformIcon(d.platform)}<span title="${esc(d.deviceName)}">${esc(d.deviceName)}</span></div>
      <span class="badge ${online ? "on" : "off"}">${d.status}</span>
    </div>
    <div class="card__meta">${esc(d.platform)} · last active ${relativeTime(d.lastActive)}</div>
    <div class="card__actions">
      <button class="btn" ${dis} data-tool="screenshot" data-device="${esc(d.deviceId)}">${ICONS.camera} Screenshot</button>
      <button class="btn" ${dis} data-tool="get_window_list" data-device="${esc(d.deviceId)}">${ICONS.windows} Windows</button>
    </div>
    <div class="card__form">
      <div class="row">
        <input type="text" placeholder="Text to type…" data-type-input="${esc(d.deviceId)}" ${dis} />
        <button class="btn btn--sm" ${dis} data-type-send="${esc(d.deviceId)}">${ICONS.keyboard}</button>
      </div>
      <div class="row">
        <input type="number" placeholder="X" data-click-x="${esc(d.deviceId)}" ${dis} />
        <input type="number" placeholder="Y" data-click-y="${esc(d.deviceId)}" ${dis} />
        <button class="btn btn--sm" ${dis} data-click-send="${esc(d.deviceId)}">${ICONS.click}</button>
      </div>
    </div>
  </div>`;
}

function renderRow(d: DeviceInfo): string {
  const online = d.status === "online";
  return `<tr>
    <td>${esc(d.deviceName)}</td>
    <td><span class="badge ${online ? "on" : "off"}">${d.status}</span></td>
    <td>${relativeTime(d.lastActive)}</td>
  </tr>`;
}

/**
 * Builds the self-contained interactive dashboard rendered INLINE inside an
 * MCP-UI-capable agent. Device data is a snapshot baked in at tool-call
 * time (so it shows instantly, no network from the iframe), and every
 * button drives the host agent's own MCP tools via `postMessage` — the
 * MCP-UI convention `{ type: "tool", payload: { toolName, params } }`.
 * `publicUrl` only backs the optional "open full web dashboard" link.
 */
export function buildDashboardWidget(devices: DeviceInfo[], publicUrl: string): string {
  const onlineCount = devices.filter((d) => d.status === "online").length;
  const cards = devices.length
    ? devices.map(renderCard).join("")
    : `<p class="empty">No devices connected yet. Start a local-tool-service and click Refresh.</p>`;
  const rows = devices.length
    ? devices.map(renderRow).join("")
    : `<tr><td colspan="3" class="empty">No data yet</td></tr>`;

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"/>
<style>
:root{--bg:#0f1117;--panel:#161923;--card:#1a1d29;--border:#2a2e3e;--text:#e6e8ef;--muted:#8b90a5;--accent:#5b8dee;--on:#2ecc71;--off:#e74c3c}
*{box-sizing:border-box}
body{margin:0;padding:16px;font-family:"Segoe UI",system-ui,sans-serif;background:var(--bg);color:var(--text)}
.head{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;gap:10px;flex-wrap:wrap}
.head h1{font-size:1.1rem;margin:0;display:flex;align-items:center;gap:8px}
.head .count{color:var(--muted);font-size:.85rem}
.toolbar{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px}
.panel{background:var(--panel);border:1px solid var(--border);border-radius:10px;padding:16px;margin-bottom:16px}
.panel h2{font-size:.95rem;margin:0 0 12px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px}
.card{background:var(--card);border:1px solid var(--border);border-radius:10px;padding:12px;transition:border-color .15s,transform .15s}
.card:hover{border-color:var(--accent);transform:translateY(-2px)}
.card__top{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px}
.card__name{display:flex;align-items:center;gap:8px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.card__name svg{color:var(--accent);flex-shrink:0}
.card__meta{font-size:.75rem;color:var(--muted);margin-bottom:10px}
.card__actions{display:flex;gap:6px;margin-bottom:8px}
.card__form .row{display:flex;gap:6px;margin-top:6px}
.badge{font-size:.68rem;font-weight:600;padding:2px 8px;border-radius:999px;text-transform:uppercase}
.badge.on{background:rgba(46,204,113,.15);color:var(--on)}
.badge.off{background:rgba(231,76,60,.15);color:var(--off)}
.btn{display:inline-flex;align-items:center;gap:5px;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:7px;padding:6px 9px;font-size:.75rem;cursor:pointer;transition:background .15s,border-color .15s}
.btn:hover:not(:disabled){background:var(--accent);border-color:var(--accent)}
.btn:disabled{opacity:.4;cursor:not-allowed}
.btn--sm{padding:6px 8px}
.btn--primary{background:var(--accent);border-color:var(--accent);color:#fff}
input{flex:1;min-width:0;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:7px;padding:6px 8px;font-size:.78rem;font-family:inherit}
input[type=number]{max-width:70px}
table{width:100%;border-collapse:collapse;font-size:.85rem}
th{text-align:left;color:var(--muted);font-weight:500;padding:8px 10px;border-bottom:1px solid var(--border)}
td{padding:8px 10px;border-bottom:1px solid var(--border)}
tr:last-child td{border-bottom:none}
.empty{color:var(--muted);text-align:center;padding:16px;font-size:.85rem}
.link{color:var(--accent);text-decoration:none;font-size:.8rem;display:inline-flex;align-items:center;gap:5px;cursor:pointer;background:none;border:none;padding:0}
.link:hover{text-decoration:underline}
</style></head>
<body>
  <div class="head">
    <h1>${platformIcon("unknown")} RemotePC Dashboard</h1>
    <span class="count">${onlineCount}/${devices.length} online</span>
  </div>

  <div class="toolbar">
    <button class="btn btn--primary" data-tool="list_devices">${ICONS.refresh} List Devices</button>
    <button class="btn btn--primary" data-refresh>${ICONS.refresh} Reload Dashboard</button>
    <button class="btn" data-screenshot-all>${ICONS.camera} Screenshot All</button>
  </div>

  <div class="panel"><h2>Connected Devices</h2><div class="grid">${cards}</div></div>

  <div class="panel"><h2>System Monitor</h2>
    <table><thead><tr><th>Device</th><th>Status</th><th>Last Active</th></tr></thead>
    <tbody>${rows}</tbody></table>
  </div>

  <button class="link" data-link="${esc(publicUrl)}/dashboard">${ICONS.link} Open full web dashboard</button>

<script>
(function(){
  var devices = ${JSON.stringify(devices.map((d) => ({ deviceId: d.deviceId, status: d.status })))};

  function post(msg){ window.parent.postMessage(msg, "*"); }
  function callTool(toolName, params){ post({ type: "tool", payload: { toolName: toolName, params: params || {} } }); }
  function openLink(url){ post({ type: "link", payload: { url: url } }); }

  function reportSize(){
    post({ type: "ui-size-change", payload: { height: document.body.scrollHeight } });
  }

  document.addEventListener("click", function(e){
    var t = e.target.closest("[data-tool],[data-refresh],[data-screenshot-all],[data-type-send],[data-click-send],[data-link]");
    if(!t) return;

    if(t.hasAttribute("data-link")){ openLink(t.getAttribute("data-link")); return; }
    if(t.hasAttribute("data-refresh")){ callTool("show_dashboard", {}); return; }
    if(t.hasAttribute("data-screenshot-all")){
      devices.filter(function(d){return d.status==="online";})
        .forEach(function(d){ callTool("screenshot", { deviceName: d.deviceId }); });
      return;
    }
    if(t.hasAttribute("data-type-send")){
      var id = t.getAttribute("data-type-send");
      var input = document.querySelector('[data-type-input="'+id+'"]');
      if(input && input.value){ callTool("type_text", { deviceName: id, text: input.value }); input.value=""; }
      return;
    }
    if(t.hasAttribute("data-click-send")){
      var cid = t.getAttribute("data-click-send");
      var x = document.querySelector('[data-click-x="'+cid+'"]');
      var y = document.querySelector('[data-click-y="'+cid+'"]');
      callTool("mouse_click", { deviceName: cid, x: Number(x&&x.value)||0, y: Number(y&&y.value)||0, button: "left", clickType: "single" });
      return;
    }
    if(t.hasAttribute("data-tool")){
      var tool = t.getAttribute("data-tool");
      var dev = t.getAttribute("data-device");
      callTool(tool, dev ? { deviceName: dev } : {});
    }
  });

  window.addEventListener("load", reportSize);
  setTimeout(reportSize, 100);
})();
</script>
</body></html>`;
}
