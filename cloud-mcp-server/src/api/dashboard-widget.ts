/**
 * Builds the static MCP Apps "View" (the dashboard widget HTML) served as a
 * `ui://` resource. Per the MCP Apps spec (SEP-1865) this HTML is a template
 * with NO baked-in data: the host fetches it once via `resources/read`, then
 * pushes live device data into it via `ui/notifications/tool-result` and the
 * app-only `get_dashboard_data` tool. All host communication is JSON-RPC 2.0
 * over `postMessage` (ui/initialize handshake, tools/call, size-changed).
 *
 * Kept dependency-free and self-contained: inline CSS + inline SVG only (no
 * CDNs), so it renders under the host's restrictive default CSP.
 */
export function buildDashboardWidget(): string {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"/>
<style>
:root{
  --bg:var(--color-background-primary,#0f1117);
  --panel:var(--color-background-secondary,#161923);
  --card:var(--color-background-tertiary,#1a1d29);
  --border:var(--color-border-primary,#2a2e3e);
  --text:var(--color-text-primary,#e6e8ef);
  --muted:var(--color-text-secondary,#8b90a5);
  --accent:var(--color-background-info,#5b8dee);
  --on:var(--color-text-success,#2ecc71);
  --off:var(--color-text-danger,#e74c3c);
}
*{box-sizing:border-box}
body{margin:0;padding:16px;font-family:var(--font-sans,"Segoe UI",system-ui,sans-serif);background:var(--bg);color:var(--text)}
.head{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;gap:10px;flex-wrap:wrap}
.head h1{font-size:1.05rem;margin:0;display:flex;align-items:center;gap:8px}
.head h1 svg{color:var(--accent)}
.count{color:var(--muted);font-size:.85rem}
.toolbar{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px}
.panel{background:var(--panel);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:14px}
.panel h2{font-size:.9rem;margin:0 0 10px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px}
.card{background:var(--card);border:1px solid var(--border);border-radius:10px;padding:12px;transition:border-color .15s,transform .15s}
.card:hover{border-color:var(--accent);transform:translateY(-2px)}
.card__top{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px}
.card__name{display:flex;align-items:center;gap:8px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.card__name svg{color:var(--accent);flex-shrink:0}
.card__meta{font-size:.75rem;color:var(--muted);margin-bottom:10px}
.card__actions{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px}
.card__form .row{display:flex;gap:6px;margin-top:6px}
.badge{font-size:.66rem;font-weight:600;padding:2px 8px;border-radius:999px;text-transform:uppercase}
.badge.on{background:rgba(46,204,113,.15);color:var(--on)}
.badge.off{background:rgba(231,76,60,.15);color:var(--off)}
.btn{display:inline-flex;align-items:center;gap:5px;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:7px;padding:6px 9px;font-size:.75rem;cursor:pointer;transition:background .15s,border-color .15s}
.btn:hover:not(:disabled){background:var(--accent);border-color:var(--accent)}
.btn:disabled{opacity:.4;cursor:not-allowed}
.btn--primary{background:var(--accent);border-color:var(--accent);color:#fff}
.btn.loading{opacity:.6;pointer-events:none}
input{flex:1;min-width:0;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:7px;padding:6px 8px;font-size:.78rem;font-family:inherit}
input[type=number]{max-width:64px}
table{width:100%;border-collapse:collapse;font-size:.85rem}
th{text-align:left;color:var(--muted);font-weight:500;padding:8px 10px;border-bottom:1px solid var(--border)}
td{padding:8px 10px;border-bottom:1px solid var(--border)}
tr:last-child td{border-bottom:none}
.empty{color:var(--muted);text-align:center;padding:16px;font-size:.85rem}
.link{color:var(--accent);text-decoration:none;font-size:.8rem;display:inline-flex;align-items:center;gap:5px;cursor:pointer;background:none;border:none;padding:0}
.link:hover{text-decoration:underline}
#viewer{margin-top:12px}
#viewer img{max-width:100%;border:1px solid var(--border);border-radius:8px;margin-top:6px}
#viewer ul{margin:6px 0 0;padding-left:18px;font-size:.82rem}
#viewer pre{white-space:pre-wrap;word-break:break-word;font-size:.78rem}
.toast{position:fixed;bottom:14px;right:14px;background:var(--panel);border:1px solid var(--border);border-left:4px solid var(--accent);border-radius:8px;padding:10px 14px;font-size:.82rem;max-width:300px}
.toast.err{border-left-color:var(--off)}
.toast.ok{border-left-color:var(--on)}
</style></head>
<body>
  <div class="head">
    <h1><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M4 5h16v11H4zM2 19h20v2H2z"/></svg> RemotePC Dashboard</h1>
    <span class="count" id="count">connecting…</span>
  </div>

  <div class="toolbar">
    <button class="btn btn--primary" id="refresh">Refresh</button>
    <button class="btn" id="shotAll">Screenshot All</button>
  </div>

  <div class="panel"><h2>Connected Devices</h2><div class="grid" id="grid"><p class="empty">Loading…</p></div></div>
  <div class="panel"><h2>System Monitor</h2>
    <table><thead><tr><th>Device</th><th>Status</th><th>Last Active</th></tr></thead><tbody id="rows"></tbody></table>
  </div>

  <div id="viewer"></div>

<script>
(function(){
  "use strict";
  var state = { devices: [] };
  var nextId = 1, pending = {};

  var ICON = {
    win32:'<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M3 5.5 10 4.5v7H3zM10 12.5v7L3 18.5v-6zM11 4.3 21 3v8.5H11zM21 12.5V21l-10-1.3v-7.2z"/></svg>',
    darwin:'<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M16 3c.1 1.2-.4 2.3-1.1 3.1-.7.9-1.9 1.5-3 1.4-.1-1.1.4-2.3 1.1-3 .8-.9 2-1.5 3-1.5zM19.5 17.4c-.5 1.2-.8 1.7-1.4 2.7-.9 1.4-2.2 3.2-3.8 3.2-1.4 0-1.8-.9-3.7-.9s-2.3.9-3.7.9c-1.6 0-2.8-1.6-3.7-3C.9 17.1.6 12.3 2.6 9.9c1-1.2 2.4-1.9 3.8-1.9 1.5 0 2.4.9 3.7.9 1.2 0 2-.9 3.7-.9 1.3 0 2.6.7 3.6 1.9-3.1 1.7-2.6 6.2.1 7.6z"/></svg>',
    linux:'<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12 2c2 0 3 2 3 4 0 1 .5 2 1 3 1 1.5 2 3 2 5 0 1-.5 2-1 3 .5 1 1 2 0 3-1 .5-2 0-3-.5-.5.5-1.5 1-3 1s-2.5-.5-3-1c-1 .5-2 1-3 .5-1-1-.5-2 0-3-.5-1-1-2-1-3 0-2 1-3.5 2-5 .5-1 1-2 1-3 0-2 1-4 3-4z"/></svg>',
    unknown:'<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M4 5h16v11H4zM2 19h20v2H2z"/></svg>'
  };

  function send(m){ window.parent.postMessage(m, "*"); }
  function rpc(method, params){
    var id = nextId++;
    return new Promise(function(resolve, reject){
      pending[id] = { resolve: resolve, reject: reject };
      send({ jsonrpc:"2.0", id:id, method:method, params:params||{} });
    });
  }
  function notify(method, params){ send({ jsonrpc:"2.0", method:method, params:params||{} }); }

  window.addEventListener("message", function(ev){
    var m = ev.data;
    if(!m || m.jsonrpc !== "2.0") return;
    if(m.id !== undefined && (m.result !== undefined || m.error !== undefined)){
      var p = pending[m.id];
      if(p){ delete pending[m.id]; m.error ? p.reject(new Error(m.error.message||"error")) : p.resolve(m.result); }
      return;
    }
    if(m.method === "ping" && m.id !== undefined){ send({jsonrpc:"2.0",id:m.id,result:{}}); return; }
    if(m.method === "ui/resource-teardown" && m.id !== undefined){ send({jsonrpc:"2.0",id:m.id,result:{}}); return; }
    if(m.method === "ui/notifications/tool-result"){ applyResult(m.params); return; }
    if(m.method === "ui/notifications/host-context-changed"){ if(m.params&&m.params.theme) document.documentElement.setAttribute("data-theme", m.params.theme); return; }
  });

  function applyResult(res){
    if(res && res.structuredContent && res.structuredContent.devices) render(res.structuredContent.devices);
  }

  function esc(s){ return String(s==null?"":s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];}); }
  function icon(p){ return ICON[p] || ICON.unknown; }
  function rel(iso){
    if(!iso) return "never";
    var s = Math.max(0, Math.floor((Date.now()-new Date(iso).getTime())/1000));
    if(s<60) return s+"s ago";
    var mm=Math.floor(s/60); if(mm<60) return mm+"m ago";
    var h=Math.floor(mm/60); if(h<24) return h+"h ago";
    return Math.floor(h/24)+"d ago";
  }

  function cardHtml(d){
    var on = d.status === "online", dis = on ? "" : "disabled";
    return '<div class="card">'
      + '<div class="card__top"><div class="card__name">'+icon(d.platform)+'<span title="'+esc(d.deviceName)+'">'+esc(d.deviceName)+'</span></div>'
      + '<span class="badge '+(on?"on":"off")+'">'+esc(d.status)+'</span></div>'
      + '<div class="card__meta">'+esc(d.platform)+' · last active '+rel(d.lastActive)+'</div>'
      + '<div class="card__actions">'
      + '<button class="btn" '+dis+' data-tool="screenshot" data-device="'+esc(d.deviceId)+'">Screenshot</button>'
      + '<button class="btn" '+dis+' data-tool="get_window_list" data-device="'+esc(d.deviceId)+'">Windows</button>'
      + '</div>'
      + '<div class="card__form">'
      + '<div class="row"><input type="text" placeholder="Text to type…" data-type-input="'+esc(d.deviceId)+'" '+dis+'/><button class="btn" '+dis+' data-type-send="'+esc(d.deviceId)+'">Type</button></div>'
      + '<div class="row"><input type="number" placeholder="X" data-x="'+esc(d.deviceId)+'" '+dis+'/><input type="number" placeholder="Y" data-y="'+esc(d.deviceId)+'" '+dis+'/><button class="btn" '+dis+' data-click="'+esc(d.deviceId)+'">Click</button></div>'
      + '</div></div>';
  }
  function rowHtml(d){
    var on = d.status === "online";
    return '<tr><td>'+esc(d.deviceName)+'</td><td><span class="badge '+(on?"on":"off")+'">'+esc(d.status)+'</span></td><td>'+rel(d.lastActive)+'</td></tr>';
  }

  function render(devices){
    state.devices = devices || [];
    var online = state.devices.filter(function(d){return d.status==="online";}).length;
    document.getElementById("count").textContent = online+"/"+state.devices.length+" online";
    document.getElementById("grid").innerHTML = state.devices.length ? state.devices.map(cardHtml).join("") : '<p class="empty">No devices connected. Start a local-tool-service.</p>';
    document.getElementById("rows").innerHTML = state.devices.length ? state.devices.map(rowHtml).join("") : '<tr><td colspan="3" class="empty">No data</td></tr>';
    reportSize();
  }

  function toast(text, kind){
    var t = document.createElement("div");
    t.className = "toast " + (kind||"");
    t.textContent = text;
    document.body.appendChild(t);
    setTimeout(function(){ t.remove(); }, 4000);
  }

  function showResult(title, result){
    var v = document.getElementById("viewer");
    var html = '<div class="panel"><h2>'+esc(title)+'</h2>';
    var img = (result.content||[]).filter(function(c){return c.type==="image";})[0];
    if(img){ html += '<img src="data:'+(img.mimeType||"image/png")+';base64,'+img.data+'"/>'; }
    var sc = result.structuredContent;
    if(sc && sc.windows){ html += "<ul>"+sc.windows.map(function(w){return "<li>"+esc(w.title)+" — "+w.width+"x"+w.height+(w.isFocused?" (focused)":"")+"</li>";}).join("")+"</ul>"; }
    else if(!img){
      var txt = (result.content||[]).filter(function(c){return c.type==="text";}).map(function(c){return c.text;}).join("\\n");
      html += "<pre>"+esc(txt)+"</pre>";
    }
    html += "</div>";
    v.innerHTML = html;
    reportSize();
  }

  function invoke(name, args, btn){
    if(btn) btn.classList.add("loading");
    return rpc("tools/call", { name:name, arguments:args||{} }).then(function(r){
      if(btn) btn.classList.remove("loading");
      if(r && r.isError) throw new Error("Tool reported an error");
      return r;
    }, function(e){
      if(btn) btn.classList.remove("loading");
      throw e;
    });
  }

  function refresh(){
    invoke("get_dashboard_data", {}).then(function(r){
      if(r && r.structuredContent && r.structuredContent.devices) render(r.structuredContent.devices);
    }).catch(function(){});
  }

  document.addEventListener("click", function(e){
    var el = e.target.closest("[data-tool],[data-type-send],[data-click],#refresh,#shotAll");
    if(!el) return;
    if(el.id === "refresh"){ refresh(); return; }
    if(el.id === "shotAll"){
      state.devices.filter(function(d){return d.status==="online";}).forEach(function(d){
        invoke("screenshot", { deviceName:d.deviceId }).then(function(r){ showResult("Screenshot — "+d.deviceName, r); }).catch(function(err){ toast(err.message,"err"); });
      });
      return;
    }
    if(el.hasAttribute("data-type-send")){
      var id = el.getAttribute("data-type-send");
      var inp = document.querySelector('[data-type-input="'+id+'"]');
      if(inp && inp.value){ invoke("type_text",{deviceName:id,text:inp.value},el).then(function(){toast("Text sent","ok"); inp.value="";}).catch(function(err){toast(err.message,"err");}); }
      return;
    }
    if(el.hasAttribute("data-click")){
      var cid = el.getAttribute("data-click");
      var xi = document.querySelector('[data-x="'+cid+'"]'), yi = document.querySelector('[data-y="'+cid+'"]');
      invoke("mouse_click",{deviceName:cid,x:Number(xi&&xi.value)||0,y:Number(yi&&yi.value)||0,button:"left",clickType:"single"},el).then(function(){toast("Click sent","ok");}).catch(function(err){toast(err.message,"err");});
      return;
    }
    if(el.hasAttribute("data-tool")){
      var tool = el.getAttribute("data-tool"), dev = el.getAttribute("data-device");
      invoke(tool, { deviceName:dev }, el).then(function(r){ showResult(tool+" — "+dev, r); }).catch(function(err){ toast(err.message,"err"); });
    }
  });

  function reportSize(){
    notify("ui/notifications/size-changed", { width: document.documentElement.scrollWidth, height: Math.ceil(document.body.getBoundingClientRect().height) });
  }

  async function init(){
    try{
      var res = await rpc("ui/initialize", {
        protocolVersion: "2026-01-26",
        capabilities: {},
        appCapabilities: { availableDisplayModes: ["inline"] },
        clientInfo: { name: "remotepc-dashboard", version: "1.0.0" }
      });
      notify("ui/notifications/initialized", {});
      if(res && res.hostContext && res.hostContext.theme) document.documentElement.setAttribute("data-theme", res.hostContext.theme);
    }catch(e){ /* non-MCP-Apps host: still fetch + render below */ }
    refresh();
    reportSize();
    if(window.ResizeObserver){ new ResizeObserver(reportSize).observe(document.body); }
  }
  init();
})();
</script>
</body></html>`;
}
