(() => {
  "use strict";

  const REFRESH_INTERVAL_MS = 30000;
  // Same-origin by default ("") — set to an absolute URL when this file is
  // inlined into the show_dashboard MCP tool's HTML widget.
  const API_BASE = (typeof window !== "undefined" && window.__DASHBOARD_API_BASE__) || "";

  const state = {
    devices: [],
    selectedDeviceId: null,
    lastActionAt: null,
  };

  const el = {
    deviceGrid: document.getElementById("deviceGrid"),
    monitorBody: document.getElementById("monitorBody"),
    deviceCount: document.getElementById("deviceCount"),
    lastRefresh: document.getElementById("lastRefresh"),
    activeDeviceLabel: document.getElementById("activeDeviceLabel"),
    toastContainer: document.getElementById("toastContainer"),
    typeTextModal: document.getElementById("typeTextModal"),
    typeTextDevice: document.getElementById("typeTextDevice"),
    typeTextInput: document.getElementById("typeTextInput"),
    typeTextSubmit: document.getElementById("typeTextSubmit"),
    clickModal: document.getElementById("clickModal"),
    clickDevice: document.getElementById("clickDevice"),
    clickX: document.getElementById("clickX"),
    clickY: document.getElementById("clickY"),
    clickButton: document.getElementById("clickButton"),
    clickType: document.getElementById("clickType"),
    clickSubmit: document.getElementById("clickSubmit"),
    viewerModal: document.getElementById("viewerModal"),
    viewerTitle: document.getElementById("viewerTitle"),
    viewerBody: document.getElementById("viewerBody"),
  };

  // ---------- helpers ----------

  function platformIcon(platform) {
    switch (platform) {
      case "win32": return "ti-brand-windows";
      case "darwin": return "ti-brand-apple";
      case "linux": return "ti-brand-ubuntu";
      default: return "ti-device-desktop";
    }
  }

  function relativeTime(isoString) {
    if (!isoString) return "never";
    const diffMs = Date.now() - new Date(isoString).getTime();
    const seconds = Math.max(0, Math.floor(diffMs / 1000));
    if (seconds < 5) return "just now";
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  }

  function toast(message, kind = "success") {
    const node = document.createElement("div");
    node.className = `toast ${kind}`;
    node.textContent = message;
    el.toastContainer.appendChild(node);
    setTimeout(() => node.remove(), 4500);
  }

  function openModal(modal) { modal.classList.remove("hidden"); }
  function closeModal(modal) { modal.classList.add("hidden"); }

  document.querySelectorAll("[data-close-modal]").forEach((btn) => {
    btn.addEventListener("click", () => btn.closest(".modal-overlay").classList.add("hidden"));
  });

  async function api(path, options) {
    const res = await fetch(API_BASE + path, {
      headers: { "content-type": "application/json" },
      ...options,
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
    return body;
  }

  async function performAction(deviceId, action, args = {}) {
    return api("/api/action", {
      method: "POST",
      body: JSON.stringify({ deviceId, action, args }),
    });
  }

  // ---------- rendering ----------

  function populateDeviceSelects() {
    const options = state.devices
      .map((d) => `<option value="${d.deviceId}">${escapeHtml(d.deviceName)} (${d.status})</option>`)
      .join("");
    el.typeTextDevice.innerHTML = options;
    el.clickDevice.innerHTML = options;
    if (state.selectedDeviceId) {
      el.typeTextDevice.value = state.selectedDeviceId;
      el.clickDevice.value = state.selectedDeviceId;
    }
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  function renderDeviceGrid() {
    if (state.devices.length === 0) {
      el.deviceGrid.innerHTML = `<p class="empty-state">No devices yet — waiting for the first refresh…</p>`;
      return;
    }

    el.deviceGrid.innerHTML = state.devices.map((device) => {
      const isActive = device.deviceId === state.selectedDeviceId;
      const online = device.status === "online";
      return `
        <div class="device-card ${isActive ? "active" : ""}" data-device-id="${device.deviceId}">
          <div class="device-card__head">
            <div class="device-card__name">
              <i class="ti ${platformIcon(device.platform)}"></i>
              <span title="${escapeHtml(device.deviceName)}">${escapeHtml(device.deviceName)}</span>
            </div>
            <span class="status-dot ${online ? "online" : "offline"}" title="${device.status}"></span>
          </div>
          <div class="device-card__meta">
            <span class="badge ${online ? "badge-online" : "badge-offline"}">${device.status}</span>
            &nbsp;·&nbsp; ${escapeHtml(device.platform)} &nbsp;·&nbsp; last active ${relativeTime(device.lastActive)}
          </div>
          <div class="device-card__actions">
            <button class="icon-btn" data-card-action="screenshot" ${online ? "" : "disabled"}>
              <i class="ti ti-camera"></i> Screenshot
            </button>
            <button class="icon-btn" data-card-action="connect">
              <i class="ti ti-plug"></i> ${isActive ? "Connected" : "Connect"}
            </button>
            <button class="icon-btn" data-card-action="windows" ${online ? "" : "disabled"}>
              <i class="ti ti-layout-grid"></i> Windows
            </button>
            <button class="icon-btn" disabled title="Not supported by the backend yet">
              <i class="ti ti-folder"></i> Files
            </button>
          </div>
        </div>`;
    }).join("");

    el.deviceGrid.querySelectorAll(".device-card").forEach((card) => {
      const deviceId = card.dataset.deviceId;
      card.querySelectorAll("[data-card-action]").forEach((btn) => {
        btn.addEventListener("click", () => handleCardAction(deviceId, btn.dataset.cardAction, btn));
      });
    });
  }

  function renderMonitorTable() {
    if (state.devices.length === 0) {
      el.monitorBody.innerHTML = `<tr><td colspan="3" class="empty-state">No data yet</td></tr>`;
      return;
    }
    el.monitorBody.innerHTML = state.devices.map((device) => `
      <tr>
        <td>${escapeHtml(device.deviceName)}</td>
        <td><span class="badge ${device.status === "online" ? "badge-online" : "badge-offline"}">${device.status}</span></td>
        <td>${relativeTime(device.lastActive)}</td>
      </tr>`).join("");
  }

  function renderTopbar() {
    const onlineCount = state.devices.filter((d) => d.status === "online").length;
    el.deviceCount.textContent = `${onlineCount}/${state.devices.length} online`;
    el.lastRefresh.textContent = `refreshed ${relativeTime(new Date().toISOString())}`;
    el.activeDeviceLabel.textContent = state.selectedDeviceId
      ? (state.devices.find((d) => d.deviceId === state.selectedDeviceId)?.deviceName ?? state.selectedDeviceId)
      : "none selected";
  }

  function renderAll() {
    renderDeviceGrid();
    renderMonitorTable();
    renderTopbar();
    populateDeviceSelects();
  }

  // ---------- data ----------

  async function fetchDevices() {
    try {
      const { devices } = await api("/api/devices");
      state.devices = devices;
      if (state.selectedDeviceId && !devices.some((d) => d.deviceId === state.selectedDeviceId)) {
        state.selectedDeviceId = null;
      }
      renderAll();
    } catch (error) {
      toast(`Failed to load devices: ${error.message}`, "error");
    }
  }

  // ---------- actions ----------

  async function handleCardAction(deviceId, action, button) {
    if (action === "connect") {
      state.selectedDeviceId = deviceId;
      renderAll();
      return;
    }
    if (action === "screenshot") {
      await runWithLoading(button, async () => {
        const { result } = await performAction(deviceId, "screenshot");
        showViewer("Screenshot", `<img src="data:image/png;base64,${result.base64Data}" alt="Screenshot" />`);
        toast("Screenshot captured", "success");
      });
      return;
    }
    if (action === "windows") {
      await runWithLoading(button, async () => {
        const { result } = await performAction(deviceId, "get_window_list");
        const list = result.windows.map((w) => `<li>${escapeHtml(w.title)} — ${w.width}x${w.height}${w.isFocused ? " (focused)" : ""}</li>`).join("");
        showViewer("Windows", `<ul>${list || "<li>No windows reported</li>"}</ul>`);
        toast("Window list retrieved", "success");
      });
    }
  }

  async function runWithLoading(button, fn) {
    const original = button.innerHTML;
    button.disabled = true;
    button.classList.add("loading");
    try {
      await fn();
      state.lastActionAt = new Date().toISOString();
    } catch (error) {
      toast(error.message, "error");
    } finally {
      button.disabled = false;
      button.classList.remove("loading");
      button.innerHTML = original;
    }
  }

  function showViewer(title, html) {
    el.viewerTitle.innerHTML = `<i class="ti ti-photo"></i> ${escapeHtml(title)}`;
    el.viewerBody.innerHTML = html;
    openModal(el.viewerModal);
  }

  // Quick actions bar
  document.querySelectorAll(".quick-action").forEach((btn) => {
    btn.addEventListener("click", () => handleQuickAction(btn.dataset.action, btn));
  });

  async function handleQuickAction(action, button) {
    if (action === "list-devices") {
      await runWithLoading(button, fetchDevices);
      toast("Device list refreshed", "success");
      return;
    }
    if (action === "screenshot-all") {
      const online = state.devices.filter((d) => d.status === "online");
      if (online.length === 0) return toast("No online devices to screenshot", "error");
      await runWithLoading(button, async () => {
        const results = await Promise.allSettled(online.map((d) => performAction(d.deviceId, "screenshot")));
        const gallery = results.map((r, i) => {
          if (r.status !== "fulfilled") return `<p>${escapeHtml(online[i].deviceName)}: failed (${escapeHtml(r.reason.message)})</p>`;
          return `<p>${escapeHtml(online[i].deviceName)}</p><img src="data:image/png;base64,${r.value.result.base64Data}" alt="${escapeHtml(online[i].deviceName)}" />`;
        }).join("<hr/>");
        showViewer("Screenshot All", gallery);
        toast(`Captured ${results.filter((r) => r.status === "fulfilled").length}/${online.length} screenshots`, "success");
      });
      return;
    }
    if (action === "type-text") {
      if (state.devices.length === 0) return toast("No devices available", "error");
      openModal(el.typeTextModal);
      return;
    }
    if (action === "click") {
      if (state.devices.length === 0) return toast("No devices available", "error");
      openModal(el.clickModal);
    }
  }

  el.typeTextSubmit.addEventListener("click", async () => {
    const deviceId = el.typeTextDevice.value;
    const text = el.typeTextInput.value;
    if (!deviceId || !text) return toast("Pick a device and enter text", "error");
    try {
      await performAction(deviceId, "type_text", { text });
      toast("Text sent", "success");
      closeModal(el.typeTextModal);
      el.typeTextInput.value = "";
    } catch (error) {
      toast(error.message, "error");
    }
  });

  el.clickSubmit.addEventListener("click", async () => {
    const deviceId = el.clickDevice.value;
    if (!deviceId) return toast("Pick a device", "error");
    try {
      await performAction(deviceId, "mouse_click", {
        x: Number(el.clickX.value) || 0,
        y: Number(el.clickY.value) || 0,
        button: el.clickButton.value,
        clickType: el.clickType.value,
      });
      toast("Click sent", "success");
      closeModal(el.clickModal);
    } catch (error) {
      toast(error.message, "error");
    }
  });

  // ---------- boot ----------

  fetchDevices();
  setInterval(fetchDevices, REFRESH_INTERVAL_MS);
})();
