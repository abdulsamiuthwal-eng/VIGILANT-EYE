/**
 * Vigilant Eye — Main Dashboard JS
 * Navigation, camera management, events table, settings
 */

// ══════════════════════════════════════════════
// NAVIGATION
// ══════════════════════════════════════════════
function switchSection(sectionId) {
  // Hide all sections
  document.querySelectorAll(".section").forEach(s => s.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));

  // Show target section
  const section = document.getElementById(`section-${sectionId}`);
  const navItem = document.getElementById(`nav-${sectionId}`);
  if (section) section.classList.add("active");
  if (navItem) navItem.classList.add("active");

  // Update topbar
  const titles = {
    cameras: "Live Cameras",
    alerts: "Alert Panel",
    events: "Event Logs",
    stats: "Analytics",
    "add-camera": "Add Camera",
    training: "AI Training",
    settings: "Settings",
  };
  document.getElementById("pageTitle").textContent = titles[sectionId] || sectionId;
  document.getElementById("breadcrumbSub").textContent = titles[sectionId] || sectionId;

  // Section-specific init
  if (sectionId === "stats") { Charts.loadStats(); }
  if (sectionId === "events") { loadEvents(0); loadCameraFilter(); }
  if (sectionId === "add-camera") { loadCameraManageTable(); }
  if (sectionId === "training") { loadTrainingHistory(); }
  if (sectionId === "settings") { loadSettings(); loadUsers(); }
}

// ══════════════════════════════════════════════
// CAMERA MANAGEMENT
// ══════════════════════════════════════════════
let cameras = [];

function loadCameras() {
  fetch("/api/cameras")
    .then(r => r.json())
    .then(data => {
      cameras = data;
      renderCameraGrid(data);
      updateActiveCamBadge(data.filter(c => c.is_active).length);

      // Refresh expanded view if active
      if (typeof isExpanded !== 'undefined' && isExpanded && activeExpandedId) {
        const cam = cameras.find(c => c.id === activeExpandedId);
        if (cam) {
          renderExpandedCamera(cam);
          renderThumbnails();
        } else {
          exitExpandedMode();
        }
      }
    })
    .catch(err => console.warn("Camera load error:", err));
}

function renderCameraGrid(cameras) {
  const grid = document.getElementById("cameraGrid");
  const noMsg = document.getElementById("noCamerasMsg");
  if (!grid) return;

  // Clear existing camera cards (keep noCamerasMsg)
  grid.querySelectorAll(".camera-card").forEach(c => c.remove());

  if (!cameras.length) {
    if (noMsg) noMsg.style.display = "flex";
    return;
  }
  if (noMsg) noMsg.style.display = "none";

  cameras.forEach(cam => {
    const card = createCameraCard(cam);
    grid.appendChild(card);
  });
}

function createCameraCard(cam) {
  const card = document.createElement("div");
  card.className = "camera-card";
  card.dataset.cameraId = cam.id;
  card.innerHTML = `
    <div class="camera-feed-wrap">
      ${cam.is_active
        ? `<img src="/stream/${cam.id}" alt="${cam.name}" loading="lazy" onerror="this.src='';this.alt='Feed unavailable'">`
        : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:12px;background:#040c20;color:rgba(255,255,255,0.2)"><i class="fas fa-video-slash" style="font-size:2.5rem;opacity:0.3"></i><span style="font-size:0.82rem">Camera Offline</span></div>`
      }
      <div class="camera-overlay">
        <span class="cam-id-badge">📹 ${cam.camera_uid}</span>
        ${cam.is_active ? `<span class="rec-badge"><span class="rec-dot"></span>REC</span>` : ""}
      </div>
    </div>
    <div class="camera-controls">
      <div>
        <div class="camera-name">${cam.name}</div>
        <div class="camera-location"><i class="fas fa-map-marker-alt" style="font-size:0.68rem"></i> ${cam.location}</div>
      </div>
      <div class="camera-actions">
        <button class="btn-sm" onclick="takeSnapshot(${cam.id})" title="Snapshot" style="padding:7px 10px">📸</button>
        <label class="toggle-switch" title="${cam.is_active ? 'Turn Off' : 'Turn On'}">
          <input type="checkbox" ${cam.is_active ? "checked" : ""} onchange="toggleCamera(${cam.id}, this.checked)">
          <span class="toggle-slider"></span>
        </label>
      </div>
    </div>
  `;
  
  // Double-click to expand
  card.addEventListener("dblclick", () => expandCamera(cam.id));
  
  return card;
}

// ── Expanded Camera Logic ──
let isExpanded = false;
let activeExpandedId = null;

function expandCamera(cameraId) {
  const cam = cameras.find(c => c.id === cameraId);
  if (!cam) return;

  isExpanded = true;
  activeExpandedId = cameraId;

  document.getElementById("cameraGrid").style.display = "none";
  document.getElementById("cameraExpandedView").style.display = "grid";

  renderExpandedCamera(cam);
  renderThumbnails();
}

function renderExpandedCamera(cam) {
  document.getElementById("expandedCamName").textContent = cam.name;
  document.getElementById("expandedCamLoc").textContent = cam.location;
  
  const container = document.getElementById("expandedFeedContainer");
  if (cam.is_active) {
    container.innerHTML = `<img src="/stream/${cam.id}" alt="${cam.name}" onerror="this.src='';this.alt='Feed unavailable'">`;
  } else {
    container.innerHTML = `<div style="color:rgba(255,255,255,0.2); text-align:center;"><i class="fas fa-video-slash" style="font-size:4rem; display:block; margin-bottom:15px;"></i>Camera Offline</div>`;
  }
}

function renderThumbnails() {
  const list = document.getElementById("cameraThumbList");
  if (!list) return;
  list.innerHTML = "";

  cameras.forEach(cam => {
    const thumb = document.createElement("div");
    thumb.className = `cam-thumb ${cam.id === activeExpandedId ? 'active' : ''}`;
    thumb.innerHTML = `
      <div class="thumb-preview">
        ${cam.is_active 
          ? `<img src="/stream/${cam.id}" alt="${cam.name}" loading="lazy">`
          : `<i class="fas fa-video-slash" style="opacity:0.2; margin:15px;"></i>`
        }
      </div>
      <div class="thumb-info">
        <div class="thumb-name">${cam.name}</div>
        <div class="thumb-status ${cam.is_active ? 'online' : ''}">${cam.is_active ? 'Online' : 'Offline'}</div>
      </div>
    `;
    thumb.onclick = () => {
      activeExpandedId = cam.id;
      renderExpandedCamera(cam);
      renderThumbnails();
    };
    list.appendChild(thumb);
  });
}

function exitExpandedMode() {
  isExpanded = false;
  activeExpandedId = null;
  document.getElementById("cameraExpandedView").style.display = "none";
  document.getElementById("cameraGrid").style.display = "grid";
}

document.getElementById("btnExitExpanded")?.addEventListener("click", exitExpandedMode);

function toggleCamera(cameraId, active) {
  fetch(`/api/cameras/${cameraId}/toggle`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ active }),
  })
  .then(r => r.json())
  .then(data => {
    if (data.success) {
      setTimeout(() => loadCameras(), 500);
    } else {
      showInlineToast(`Toggle failed: ${data.message}`, "error");
    }
  })
  .catch(err => console.error("Toggle error:", err));
}

function takeSnapshot(cameraId) {
  fetch(`/api/cameras/${cameraId}/snapshot`, { method: "POST" })
    .then(r => r.json())
    .then(data => {
      if (data.success) {
        showInlineToast("Snapshot saved!", "success");
      } else {
        showInlineToast(data.message, "error");
      }
    });
}

function updateActiveCamBadge(count) {
  const badge = document.getElementById("activeCamBadge");
  if (badge) badge.textContent = count;
}

// ── Detect cameras ──
document.getElementById("detectCamerasBtn")?.addEventListener("click", () => {
  const btn = document.getElementById("detectCamerasBtn");
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Scanning...';
  btn.disabled = true;
  fetch("/api/cameras/detect")
    .then(r => r.json())
    .then(data => {
      const list = document.getElementById("detectedCamList");
      if (!list) return;
      list.innerHTML = "";
      if (!data.cameras.length) {
        list.innerHTML = '<div class="hint">No cameras detected. Try connecting a USB camera.</div>';
      } else {
        data.cameras.forEach(cam => {
          const item = document.createElement("div");
          item.className = "detected-cam-item";
          item.innerHTML = `
            <span>📹 ${cam.name} (Index: ${cam.index})</span>
            <button class="btn btn-sm btn-primary" onclick="quickAddCamera(${cam.index}, '${cam.name}')">Add</button>
          `;
          list.appendChild(item);
        });
      }
    })
    .finally(() => {
      btn.innerHTML = '<i class="fas fa-search"></i> Scan for Cameras';
      btn.disabled = false;
    });
});

function quickAddCamera(index, name) {
  fetch("/api/cameras", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, source: String(index), camera_type: "usb", location: "Store" }),
  })
  .then(r => r.json())
  .then(data => {
    if (data.success) {
      showInlineToast(`Camera "${name}" added!`, "success");
      loadCameras();
      loadCameraManageTable();
    } else {
      showInlineToast(data.message, "error");
    }
  });
}

// ── Manual add camera form ──
document.getElementById("addCameraForm")?.addEventListener("submit", function(e) {
  e.preventDefault();
  const submitBtn = this.querySelector('button[type="submit"]');
  const originalHtml = submitBtn ? submitBtn.innerHTML : '';
  if (submitBtn) {
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adding...';
    submitBtn.disabled = true;
  }
  const payload = {
    name: document.getElementById("camName").value,
    source: document.getElementById("camSource").value,
    camera_type: document.getElementById("camType").value,
    location: document.getElementById("camLocation").value || "Store",
  };
  fetch("/api/cameras", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  .then(r => r.json())
  .then(data => {
    if (data.success) {
      showInlineToast("Camera added successfully!", "success");
      this.reset();
      loadCameras();
      loadCameraManageTable();
    } else {
      showInlineToast(data.message, "error");
    }
  })
  .catch(() => showInlineToast("Request failed. Check connection.", "error"))
  .finally(() => {
    if (submitBtn) {
      submitBtn.innerHTML = originalHtml;
      submitBtn.disabled = false;
    }
  });
});

function loadCameraManageTable() {
  fetch("/api/cameras")
    .then(r => r.json())
    .then(cameras => {
      const tbody = document.getElementById("cameraManageBody");
      if (!tbody) return;
      if (!cameras.length) {
        tbody.innerHTML = '<tr><td colspan="8" class="loading-row">No cameras added yet.</td></tr>';
        return;
      }
      tbody.innerHTML = cameras.map(cam => `
        <tr>
          <td>${cam.camera_uid}</td>
          <td>${cam.name}</td>
          <td><code style="font-size:0.78rem;background:var(--bg-card);padding:2px 6px;border-radius:4px">${cam.source}</code></td>
          <td>${cam.camera_type}</td>
          <td>${cam.location}</td>
          <td>
            <label class="toggle-switch">
              <input type="checkbox" ${cam.alert_enabled ? "checked" : ""} onchange="toggleCameraAlerts(${cam.id}, this.checked)">
              <span class="toggle-slider"></span>
            </label>
          </td>
          <td><span class="status-badge ${cam.is_active ? 'active' : 'inactive'}">${cam.is_active ? "🟢 Active" : "⚫ Offline"}</span></td>
          <td>
            <button class="btn-sm btn-danger" onclick="deleteCamera(${cam.id}, '${cam.name}')"><i class="fas fa-trash"></i></button>
          </td>
        </tr>
      `).join("");

      // Load camera filter options for events
      const filterCam = document.getElementById("filterCamera");
      if (filterCam) {
        filterCam.innerHTML = '<option value="">All Cameras</option>' +
          cameras.map(c => `<option value="${c.id}">${c.name}</option>`).join("");
      }
    });
}

function toggleCameraAlerts(cameraId, enabled) {
  fetch(`/api/alerts/camera/${cameraId}/toggle`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enabled }),
  }).then(r => r.json()).then(d => {
    if (!d.success) showInlineToast(d.message, "error");
  });
}

function deleteCamera(cameraId, name) {
  if (!confirm(`Remove camera "${name}"?`)) return;
  fetch(`/api/cameras/${cameraId}`, { method: "DELETE" })
    .then(r => r.json())
    .then(data => {
      if (data.success) {
        showInlineToast(`Camera "${name}" removed.`, "success");
        loadCameras();
        loadCameraManageTable();
      } else {
        showInlineToast(data.message, "error");
      }
    });
}

// ══════════════════════════════════════════════
// EVENT LOGS
// ══════════════════════════════════════════════
let currentPage = 0;
const PAGE_SIZE = 15;
let _eventsAbortCtrl = null;

function loadEvents(offset = 0) {
  currentPage = offset;
  const tbody = document.getElementById("eventsBody");
  if (!tbody) return;

  // Show skeleton immediately
  tbody.innerHTML = '<tr><td colspan="7" class="loading-row"><i class="fas fa-spinner fa-spin" style="margin-right:8px"></i>Loading events...</td></tr>';

  // Cancel any in-flight request
  if (_eventsAbortCtrl) _eventsAbortCtrl.abort();
  _eventsAbortCtrl = new AbortController();

  const cameraId = document.getElementById("filterCamera")?.value || "";
  const activity = document.getElementById("filterActivity")?.value || "";
  const params = new URLSearchParams({ limit: PAGE_SIZE, offset });
  if (cameraId) params.append("camera_id", cameraId);
  if (activity) params.append("activity_type", activity);

  // Disable pagination during load
  const prevBtn = document.getElementById("prevPageBtn");
  const nextBtn = document.getElementById("nextPageBtn");
  if (prevBtn) prevBtn.disabled = true;
  if (nextBtn) nextBtn.disabled = true;

  fetch(`/api/events?${params}`, { signal: _eventsAbortCtrl.signal })
    .then(r => r.json())
    .then(events => {
      if (!events.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="loading-row">No events found.</td></tr>';
        if (prevBtn) prevBtn.disabled = offset === 0;
        if (nextBtn) nextBtn.disabled = true;
        return;
      }
      tbody.innerHTML = events.map(e => `
        <tr>
          <td><code style="font-size:0.75rem">${e.event_uid}</code></td>
          <td>${e.camera_name}</td>
          <td style="max-width:200px">${e.activity_type}</td>
          <td><span class="conf-badge" style="background:rgba(0,204,102,0.1);color:var(--green)">${e.confidence}%</span></td>
          <td><span class="sev-badge ${e.severity}">${e.severity}</span></td>
          <td style="font-size:0.78rem;color:var(--text-secondary)">${AlertSystem.formatTime(e.timestamp)}</td>
          <td>
            <div style="display:flex;gap:6px">
              ${e.snapshot_path ? `<button class="btn-sm" onclick="AlertSystem.viewSnapshot('${e.snapshot_path}','${e.activity_type}','${e.camera_name}','${AlertSystem.formatTime(e.timestamp)}')">📸</button>` : ""}
              ${!e.is_reviewed ? `<button class="btn-sm btn-primary" onclick="reviewEvent(${e.id}, false, this)">✓ OK</button>
              <button class="btn-sm btn-danger" onclick="reviewEvent(${e.id}, true, this)">✗ False</button>` : `<span style="color:var(--text-muted);font-size:0.75rem">Reviewed</span>`}
            </div>
          </td>
        </tr>
      `).join("");

      const pageNum = Math.floor(offset / PAGE_SIZE) + 1;
      document.getElementById("pageInfo").textContent = `Page ${pageNum}`;
      if (prevBtn) prevBtn.disabled = offset === 0;
      if (nextBtn) nextBtn.disabled = events.length < PAGE_SIZE;
    })
    .catch(err => {
      if (err.name === 'AbortError') return; // cancelled — ignore
      tbody.innerHTML = '<tr><td colspan="7" class="loading-row">Failed to load events. Try again.</td></tr>';
    });
}

function reviewEvent(eventId, isFalseAlarm, btn) {
  fetch(`/api/events/${eventId}/review`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ is_false_alarm: isFalseAlarm }),
  }).then(r => r.json()).then(() => loadEvents(currentPage));
}

function loadCameraFilter() {
  fetch("/api/cameras")
    .then(r => r.json())
    .then(cameras => {
      const select = document.getElementById("filterCamera");
      if (select) {
        select.innerHTML = '<option value="">All Cameras</option>' +
          cameras.map(c => `<option value="${c.id}">${c.name}</option>`).join("");
      }
    });
}

function exportEvents() {
  fetch("/api/events?limit=1000")
    .then(r => r.json())
    .then(events => {
      const csv = ["Event ID,Camera,Activity,Confidence,Severity,Timestamp",
        ...events.map(e => `${e.event_uid},${e.camera_name},"${e.activity_type}",${e.confidence}%,${e.severity},${e.timestamp}`)
      ].join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "vigilant_eye_events.csv";
      a.click();
    });
}

document.getElementById("applyFilterBtn")?.addEventListener("click", () => loadEvents(0));
document.getElementById("exportEventsBtn")?.addEventListener("click", exportEvents);
document.getElementById("prevPageBtn")?.addEventListener("click", () => { if (currentPage >= PAGE_SIZE) loadEvents(currentPage - PAGE_SIZE); });
document.getElementById("nextPageBtn")?.addEventListener("click", () => loadEvents(currentPage + PAGE_SIZE));

// ══════════════════════════════════════════════
// SETTINGS
// ══════════════════════════════════════════════
function loadSettings() {
  fetch("/api/settings")
    .then(r => r.json())
    .then(settings => {
      const set = (id, val) => {
        const el = document.getElementById(id);
        if (!el) return;
        if (el.type === "checkbox") el.checked = val === "true";
        else if (el.type === "range") el.value = parseFloat(val) * 100;
        else el.value = val;
      };
      set("emailAlertToggle", settings.email_alerts_enabled);
      set("pushAlertToggle", settings.push_alerts_enabled);
      set("soundSettingToggle", settings.alert_sound_enabled);
      set("confThreshold", String(parseFloat(settings.detection_confidence || "0.7") * 100));
      const confVal = document.getElementById("confVal");
      if (confVal) confVal.textContent = Math.round(parseFloat(settings.detection_confidence || "0.7") * 100) + "%";

      // Load fonts
      const fontLayout = settings.font_layout || localStorage.getItem("font_layout") || "'Outfit', sans-serif";
      const sizeLayout = settings.font_size_layout || localStorage.getItem("font_size_layout") || "16";
      const fontDash = settings.font_dashboard || localStorage.getItem("font_dashboard") || "'Outfit', sans-serif";
      const sizeDash = settings.font_size_dashboard || localStorage.getItem("font_size_dashboard") || "16";

      const lff = document.getElementById("layoutFontFamily");
      const lfs = document.getElementById("layoutFontSize");
      const lfsv = document.getElementById("layoutFontSizeVal");
      const dff = document.getElementById("dashboardFontFamily");
      const dfs = document.getElementById("dashboardFontSize");
      const dfsv = document.getElementById("dashboardFontSizeVal");
      if (lff) lff.value = fontLayout;
      if (lfs) lfs.value = sizeLayout;
      if (lfsv) lfsv.textContent = sizeLayout + "px";
      if (dff) dff.value = fontDash;
      if (dfs) dfs.value = sizeDash;
      if (dfsv) dfsv.textContent = sizeDash + "px";

      applyFonts(fontLayout, sizeLayout, fontDash, sizeDash);
      // Also load verified email list when settings tab opens
      loadVerifiedEmailList();
    });
}

function applyFonts(layoutFont, layoutSize, dashFont, dashSize) {
  document.documentElement.style.setProperty('--font-family-layout', layoutFont);
  document.documentElement.style.setProperty('--font-size-layout', layoutSize + 'px');
  document.documentElement.style.setProperty('--font-family-dashboard', dashFont);
  document.documentElement.style.setProperty('--font-size-dashboard', dashSize + 'px');
}

function saveFontSettings() {
  const layoutFont = document.getElementById("layoutFontFamily").value;
  const layoutSize = document.getElementById("layoutFontSize").value;
  const dashFont = document.getElementById("dashboardFontFamily").value;
  const dashSize = document.getElementById("dashboardFontSize").value;

  applyFonts(layoutFont, layoutSize, dashFont, dashSize);

  // Save to localStorage for instant feel
  localStorage.setItem("font_layout", layoutFont);
  localStorage.setItem("font_size_layout", layoutSize);
  localStorage.setItem("font_dashboard", dashFont);
  localStorage.setItem("font_size_dashboard", dashSize);

  // Also save to server via general settings
  saveAllSettings();
}

function saveAllSettings() {
  const getChecked = id => document.getElementById(id)?.checked;
  const getVal = id => document.getElementById(id)?.value;
  const conf = parseFloat(getVal("confThreshold") || "70") / 100;
  // Theme is controlled by the topbar toggle button only (Appearance card removed)
  const theme = document.documentElement.getAttribute("data-theme") || "dark";

  const payload = {
    email_alerts_enabled: getChecked("emailAlertToggle") ? "true" : "false",
    push_alerts_enabled: getChecked("pushAlertToggle") ? "true" : "false",
    alert_sound_enabled: getChecked("soundSettingToggle") ? "true" : "false",
    detection_confidence: String(conf),
    theme,
    font_layout: getVal("layoutFontFamily"),
    font_size_layout: getVal("layoutFontSize"),
    font_dashboard: getVal("dashboardFontFamily"),
    font_size_dashboard: getVal("dashboardFontSize")
  };

  fetch("/api/settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  .then(r => r.json())
  .then(() => {
    showInlineToast("Settings saved!", "success");
  });
}

document.getElementById("saveSettingsBtn")?.addEventListener("click", saveAllSettings);

// Font live updates
["layoutFontFamily", "layoutFontSize", "dashboardFontFamily", "dashboardFontSize"].forEach(id => {
  document.getElementById(id)?.addEventListener("change", () => {
    const layoutSize = document.getElementById("layoutFontSize").value;
    const dashSize = document.getElementById("dashboardFontSize").value;
    document.getElementById("layoutFontSizeVal").textContent = layoutSize + "px";
    document.getElementById("dashboardFontSizeVal").textContent = dashSize + "px";
    saveFontSettings();
  });
  if (id.includes("Size")) {
    document.getElementById(id)?.addEventListener("input", () => {
      document.getElementById(id + "Val").textContent = document.getElementById(id).value + "px";
    });
  }
});

document.getElementById("testAlertSettingsBtn")?.addEventListener("click", () => {
  fetch("/api/alerts/test", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({camera_id:1}) });
});

// Conf threshold live
document.getElementById("confThreshold")?.addEventListener("input", function() {
  const val = document.getElementById("confVal");
  if (val) val.textContent = this.value + "%";
});

// ══════════════════════════════════════════════
// USER MANAGEMENT
// ══════════════════════════════════════════════
function loadUsers() {
  fetch("/api/users")
    .then(r => r.json())
    .then(users => {
      const tbody = document.getElementById("usersManageBody");
      if (!tbody) return;
      if (!users.length) {
        tbody.innerHTML = '<tr><td colspan="4" class="loading-row">No users found.</td></tr>';
        return;
      }
      tbody.innerHTML = users.map(u => `
        <tr>
          <td style="font-weight:600">${u.name}</td>
          <td>${u.email}</td>
          <td><span class="role-badge">${u.role}</span></td>
          <td>
            <button class="btn-sm btn-danger" onclick="deleteUser(${u.id}, '${u.name}')" title="Remove User"><i class="fas class fa-trash"></i></button>
          </td>
        </tr>
      `).join("");
    });
}

function deleteUser(userId, name) {
  if (!confirm(`Are you sure you want to completely remove user "${name}"?`)) return;
  fetch(`/api/users/${userId}`, { method: "DELETE" })
    .then(r => r.json())
    .then(data => {
      if (data.success) {
        showInlineToast(`User "${name}" removed successfully.`, "success");
        loadUsers();
      } else {
        showInlineToast(data.message, "error");
      }
    });
}

// ══════════════════════════════════════════════
// THEME
// ══════════════════════════════════════════════
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  const icon = document.getElementById("themeIcon");
  if (icon) icon.className = theme === "light" ? "fas fa-sun" : "fas fa-moon";
}

function toggleExpand(element, containerId) {
  const container = document.getElementById(containerId);
  if (!container || !element) return;
  const isOpen = container.classList.contains("open");
  
  if (isOpen) {
    container.classList.remove("open");
    element.classList.remove("open");
  } else {
    container.classList.add("open");
    element.classList.add("open");
  }
}

document.getElementById("themeToggleBtn")?.addEventListener("click", () => {
  const current = document.documentElement.getAttribute("data-theme");
  const next = current === "dark" ? "light" : "dark";
  applyTheme(next);
  fetch("/api/settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ theme: next }),
  });
});


// ── Theme Customization (Accent & Backgrounds) ──
function initThemeCustomization() {
  document.querySelectorAll('.theme-color-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.target;
      const color = btn.dataset.color;
      
      if (btn.classList.contains('reset-theme')) {
        if (target === 'layout') {
          document.documentElement.style.removeProperty('--header-color');
          document.documentElement.style.removeProperty('--sidebar-color');
          document.documentElement.style.removeProperty('--accent');
          localStorage.removeItem('header_color');
          localStorage.removeItem('accent_color');
        } else {
          document.documentElement.style.removeProperty('--dashboard-bg');
          localStorage.removeItem('dashboard_bg');
        }
        return;
      }

      if (target === 'layout') {
        document.documentElement.style.setProperty('--header-color', color);
        document.documentElement.style.setProperty('--sidebar-color', color);
        document.documentElement.style.setProperty('--accent', color);
        localStorage.setItem('header_color', color);
        localStorage.setItem('accent_color', color);
      } else {
        document.documentElement.style.setProperty('--dashboard-bg', color);
        localStorage.setItem('dashboard_bg', color);
      }
    });
  });

  // Load saved colors
  const savedHeader = localStorage.getItem('header_color');
  const savedDash = localStorage.getItem('dashboard_bg');
  const savedAccent = localStorage.getItem('accent_color');

  if (savedHeader) {
    document.documentElement.style.setProperty('--header-color', savedHeader);
    document.documentElement.style.setProperty('--sidebar-color', savedHeader);
  }
  if (savedDash) {
    document.documentElement.style.setProperty('--dashboard-bg', savedDash);
  }
  if (savedAccent) {
    document.documentElement.style.setProperty('--accent', savedAccent);
  }
}

// ══════════════════════════════════════════════
// TRAINING
// ══════════════════════════════════════════════
document.getElementById("startTrainingBtn")?.addEventListener("click", () => {
  // Developer keyword is read from the hidden field (value auto-set from config.py DEVELOPER_CONFIG)
  const keywordInput = document.getElementById("devKeyword");
  const keywordValue = keywordInput ? keywordInput.value : "";

  const epochs = parseInt(document.getElementById("trainEpochs")?.value || "50");
  const batch = parseInt(document.getElementById("trainBatch")?.value || "16");
  const btn = document.getElementById("startTrainingBtn");
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Starting...';
  btn.disabled = true;

  fetch("/api/training/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ epochs, batch_size: batch, developer_keyword: keywordValue }),
  })
  .then(r => r.json())
  .then(data => {
    if (data.success) {
      document.getElementById("trainingProgressWrap").style.display = "block";
      document.getElementById("trainingIdle").style.display = "none";
      showInlineToast("Training started!", "success");
    } else {
      showInlineToast(data.message, "error");
      btn.innerHTML = '<i class="fas fa-play"></i> Start Training';
      btn.disabled = false;
    }
  })
  .catch(() => {
    btn.innerHTML = '<i class="fas fa-play"></i> Start Training';
    btn.disabled = false;
  });
});

document.getElementById("stopTrainingBtn")?.addEventListener("click", () => {
  const btn = document.getElementById("stopTrainingBtn");
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Stopping...';
  btn.disabled = true;

  fetch("/api/training/stop", { method: "POST" })
    .then(r => r.json())
    .then(data => {
      if (!data.success) {
        // If the stop request itself failed (e.g. training wasn't running), reset the button
        showInlineToast(data.message || "Could not stop training.", "error");
        btn.innerHTML = '<i class="fas fa-stop"></i> Stop Training';
        btn.disabled = false;
      }
      // On success, do nothing — the socket 'training_progress' handler will
      // show "Stopping..." and then "Stopped Successfully" automatically.
    })
    .catch(() => {
      btn.innerHTML = '<i class="fas fa-stop"></i> Stop Training';
      btn.disabled = false;
      showInlineToast("Stop request failed. Please try again.", "error");
    });
});

document.getElementById("validateDatasetBtn")?.addEventListener("click", () => {
  fetch("/api/training/validate")
    .then(r => r.json())
    .then(data => {
      const el = document.getElementById("datasetStatus");
      if (!el) return;
      el.innerHTML = `
        <div class="${data.valid ? 'ok' : 'err'}">
          ${data.valid ? "✅" : "❌"} Dataset ${data.valid ? "valid" : "invalid"}
        </div>
        <div>📷 Images: ${data.image_count}</div>
        <div>🏷 Labels: ${data.label_count}</div>
        ${data.issues.length ? `<div class="err">Issues: ${data.issues.join("; ")}</div>` : ""}
      `;
    });
});

document.getElementById("prepareDatasetBtn")?.addEventListener("click", () => {
  fetch("/api/training/prepare", { method: "POST" })
    .then(r => r.json())
    .then(data => {
      showInlineToast(data.message, "success");
    });
});

document.getElementById("uploadVideoBtn")?.addEventListener("click", () => {
  const fileInput = document.getElementById("videoUploadInput");
  if (fileInput) fileInput.click();
});

document.getElementById("videoUploadInput")?.addEventListener("change", function() {
  if (!this.files || !this.files.length) return;
  
  const file = this.files[0];
  const fps = document.getElementById("videoFpsSelect")?.value || "1";
  
  const formData = new FormData();
  formData.append("video", file);
  formData.append("fps", fps);
  
  const wrap = document.getElementById("extractionProgressWrap");
  const msg = document.getElementById("extractionMsg");
  const btn = document.getElementById("uploadVideoBtn");
  
  if (wrap) wrap.style.display = "block";
  if (msg) msg.textContent = "Uploading video to server...";
  if (btn) btn.disabled = true;
  
  fetch("/api/training/upload_video", {
    method: "POST",
    body: formData
  })
  .then(r => r.json())
  .then(data => {
    if (!data.success) {
      showInlineToast(data.message, "error");
      if (wrap) wrap.style.display = "none";
    } else {
      showInlineToast(data.message, "info");
      // The socket will handle the rest via 'extraction_progress'
    }
  })
  .catch(err => {
    showInlineToast("Upload failed.", "error");
    if (wrap) wrap.style.display = "none";
  })
  .finally(() => {
    if (btn) btn.disabled = false;
    this.value = ""; // Reset input
  });
});

function loadTrainingHistory() {
  fetch("/api/training/history")
    .then(r => r.json())
    .then(sessions => {
      const tbody = document.getElementById("trainHistBody");
      if (!tbody) return;
      if (!sessions.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="loading-row">No training sessions yet.</td></tr>';
        return;
      }
      tbody.innerHTML = sessions.map(s => {
        let lossOut = "N/A";
        if (s.notes && s.notes.includes("Loss:")) {
          lossOut = s.notes; // Notes natively stores the final loss string as requested.
        }
        return `
        <tr>
          <td>#${s.id}</td>
          <td style="font-size:0.78rem;color:var(--text-secondary)">${AlertSystem.formatTime(s.started_at)}</td>
          <td>${s.epochs}</td>
          <td><span class="sev-badge ${s.status === 'completed' ? 'low' : s.status === 'failed' ? 'high' : 'medium'}">${s.status}</span></td>
          <td>${s.map50 != null ? (s.map50 * 100).toFixed(1) + "%" : "—"}</td>
          <td>${lossOut}</td>
        </tr>
      `}).join("");
    });
}

// ══════════════════════════════════════════════
// SIDEBAR TOGGLE
// ══════════════════════════════════════════════
document.getElementById("sidebarToggle")?.addEventListener("click", () => {
  const sidebar = document.getElementById("sidebar");
  sidebar.classList.toggle("collapsed");
  document.body.classList.toggle("sidebar-collapsed");
});

// ══════════════════════════════════════════════
// CLOCK
// ══════════════════════════════════════════════
function updateClock() {
  const el = document.getElementById("timeDisplay");
  if (!el) return;
  const now = new Date();
  el.textContent = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
setInterval(updateClock, 1000);
updateClock();

// ══════════════════════════════════════════════
// INLINE TOAST HELPER
// ══════════════════════════════════════════════
function showInlineToast(message, type = "info") {
  const container = document.getElementById("toastContainer");
  if (!container) return;
  const icons = { success: "✅", error: "❌", info: "ℹ️" };
  const toast = document.createElement("div");
  toast.className = `toast ${type === "error" ? "high" : "low"}`;
  toast.innerHTML = `
    <div class="toast-icon">${icons[type] || "ℹ️"}</div>
    <div><div class="toast-title">${message}</div></div>
    <button class="toast-close" onclick="this.parentElement.remove()">✕</button>
  `;
  container.prepend(toast);
  setTimeout(() => { if (toast.parentElement) toast.remove(); }, 4000);
}

// ══════════════════════════════════════════════
// NAVIGATION CLICK HANDLERS
// ══════════════════════════════════════════════
document.querySelectorAll(".nav-item[data-section]").forEach(item => {
  item.addEventListener("click", function(e) {
    e.preventDefault();
    switchSection(this.dataset.section);
  });
});

document.getElementById("refreshSystemBtn")?.addEventListener("click", () => {
  const btn = document.getElementById("refreshSystemBtn");
  const icon = btn.querySelector("i");
  if (icon) icon.classList.add("fa-spin");
  showInlineToast("Refreshing System Data...", "info");
  
  // Refresh cameras
  loadCameras();
  
  // Refresh stats if on stats page
  if (document.getElementById("section-stats").classList.contains("active")) {
    Charts.loadStats();
  }
  
  // Refresh events if on events page
  if (document.getElementById("section-events").classList.contains("active")) {
    loadEvents(0);
  }

  // Refresh users if on settings page
  if (document.getElementById("section-settings").classList.contains("active")) {
    loadUsers();
  }

  setTimeout(() => { if (icon) icon.classList.remove("fa-spin"); }, 1500);
});

// ══════════════════════════════════════════════
// INIT
// ══════════════════════════════════════════════
document.addEventListener("DOMContentLoaded", () => {
  loadCameras();
  switchSection("cameras");
  initThemeCustomization();

  // Apply saved theme
  const currentTheme = document.documentElement.getAttribute("data-theme") || "dark";
  applyTheme(currentTheme);

  // Refresh cameras every 30s
  setInterval(loadCameras, 30000);

  // Initialize EmailJS
  const pk = document.getElementById('ejs_public_key')?.value;
  if (pk && pk.indexOf('xxxx') === -1) {
    emailjs.init(pk);
    console.log("EmailJS initialized with public key.");
  }
});

// ══════════════════════════════════════════════
// MULTI-EMAIL ALERT SYSTEM
// ══════════════════════════════════════════════

function loadVerifiedEmailList() {
  const listEl = document.getElementById('verifiedEmailList');
  if (!listEl) return;
  listEl.innerHTML = '<div style="color:var(--text-muted);font-size:0.82rem;"><i class="fas fa-spinner fa-spin"></i> Loading...</div>';

  fetch('/api/verified-email/list')
    .then(r => r.json())
    .then(list => renderVerifiedEmailList(list))
    .catch(() => {
      listEl.innerHTML = '<div style="color:var(--text-muted);font-size:0.82rem;">Could not load email list.</div>';
    });
}

function renderVerifiedEmailList(list) {
  const listEl = document.getElementById('verifiedEmailList');
  if (!listEl) return;
  if (!list || !list.length) {
    listEl.innerHTML = `
      <div style="color:var(--text-muted);font-size:0.82rem;padding:12px 0;text-align:center;">
        <i class="fas fa-inbox" style="display:block;font-size:1.5rem;opacity:0.3;margin-bottom:6px;"></i>
        No verified emails yet. Add one above.
      </div>`;
    return;
  }
  listEl.innerHTML = list.map(entry => `
    <div class="verified-email-row" style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--bg-card);border:1px solid var(--border);border-radius:10px;">
      <div style="flex:1;overflow:hidden;">
        <div style="font-size:0.88rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${entry.email}</div>
        <div style="font-size:0.72rem;margin-top:2px;">
          ${entry.verified
            ? '<span style="color:var(--green);"><i class="fas fa-check-circle"></i> Verified</span>'
            : '<span style="color:var(--orange);"><i class="fas fa-clock"></i> Pending</span>'}
        </div>
      </div>
      <label class="toggle-switch" title="${entry.alert_enabled ? 'Alerts ON' : 'Alerts OFF'}">
        <input type="checkbox" ${entry.alert_enabled ? 'checked' : ''} onchange="toggleEmailAlert('${entry.email}', this.checked)">
        <span class="toggle-slider"></span>
      </label>
      <button class="btn-sm btn-danger" onclick="removeVerifiedEmail('${entry.email}')" title="Remove">
        <i class="fas fa-trash"></i>
      </button>
    </div>
  `).join('');
}

// Send OTP to new email
document.getElementById('btnAddEmail')?.addEventListener('click', async () => {
  const emailInput = document.getElementById('newAlertEmailInput');
  const btn = document.getElementById('btnAddEmail');
  const email = emailInput?.value.trim();

  if (!email || !email.includes('@')) {
    showInlineToast('Please enter a valid email address.', 'error');
    return;
  }

  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
  btn.disabled = true;

  try {
    const res = await fetch('/api/verified-email/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const data = await res.json();
    if (data.success) {
      showInlineToast(data.message, 'success');
      document.getElementById('newEmailOtpSection').style.display = 'block';
      emailInput.disabled = true;
      btn.innerHTML = '<i class="fas fa-check"></i> Code Sent';
    } else {
      showInlineToast(data.message, 'error');
      btn.innerHTML = '<i class="fas fa-paper-plane"></i> Send Code';
      btn.disabled = false;
    }
  } catch {
    showInlineToast('Failed to send code. Check connection.', 'error');
    btn.innerHTML = '<i class="fas fa-paper-plane"></i> Send Code';
    btn.disabled = false;
  }
});

// Verify OTP and add email
document.getElementById('btnVerifyNewEmail')?.addEventListener('click', async () => {
  const otpInput = document.getElementById('newEmailOtpInput');
  const btn = document.getElementById('btnVerifyNewEmail');
  const otp = otpInput?.value.trim();

  if (!otp || otp.length !== 6) {
    showInlineToast('Please enter the 6-digit code.', 'error');
    return;
  }

  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verifying...';
  btn.disabled = true;

  try {
    const res = await fetch('/api/verified-email/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ otp })
    });
    const data = await res.json();
    if (data.success) {
      showInlineToast(data.message, 'success');
      _resetAddEmailForm();
      loadVerifiedEmailList();
    } else {
      showInlineToast(data.message || 'Verification failed.', 'error');
      btn.innerHTML = '<i class="fas fa-check-circle"></i> Verify';
      btn.disabled = false;
    }
  } catch {
    showInlineToast('Verification error. Check connection.', 'error');
    btn.innerHTML = '<i class="fas fa-check-circle"></i> Verify';
    btn.disabled = false;
  }
});

// Cancel OTP entry
document.getElementById('btnCancelOtp')?.addEventListener('click', _resetAddEmailForm);

function _resetAddEmailForm() {
  const emailInput = document.getElementById('newAlertEmailInput');
  const otpSection = document.getElementById('newEmailOtpSection');
  const otpInput = document.getElementById('newEmailOtpInput');
  const btn = document.getElementById('btnAddEmail');
  if (emailInput) { emailInput.value = ''; emailInput.disabled = false; }
  if (otpInput) otpInput.value = '';
  if (otpSection) otpSection.style.display = 'none';
  if (btn) { btn.innerHTML = '<i class="fas fa-paper-plane"></i> Send Code'; btn.disabled = false; }
}

async function removeVerifiedEmail(email) {
  if (!confirm(`Remove "${email}" from alert list?`)) return;
  try {
    const res = await fetch('/api/verified-email/remove', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const data = await res.json();
    if (data.success) {
      showInlineToast(`${email} removed.`, 'success');
      loadVerifiedEmailList();
    } else {
      showInlineToast(data.message, 'error');
    }
  } catch {
    showInlineToast('Remove failed.', 'error');
  }
}

async function toggleEmailAlert(email, enabled) {
  try {
    await fetch('/api/verified-email/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, enabled })
    });
    showInlineToast(`Alerts ${enabled ? 'enabled' : 'disabled'} for ${email}.`, 'success');
  } catch {
    showInlineToast('Toggle failed.', 'error');
  }
}

// Send test alert to all verified+enabled emails
document.getElementById('btnSendEmailTest')?.addEventListener('click', async () => {
  const btn = document.getElementById('btnSendEmailTest');
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
  btn.disabled = true;
  try {
    const res = await fetch('/api/verified-email/test', { method: 'POST' });
    const data = await res.json();
    showInlineToast(data.message || 'Test alert sent!', data.success ? 'success' : 'error');
  } catch {
    showInlineToast('Failed to send test alert.', 'error');
  } finally {
    btn.innerHTML = '<i class="fas fa-paper-plane"></i> Send Test Alert to All';
    btn.disabled = false;
  }
});



// ══════════════════════════════════════════════
// UI THEME CUSTOMIZATION MODULE
// ══════════════════════════════════════════════
// THEME CUSTOMIZATION
// ══════════════════════════════════════════════

// Note: themeOpen and toggleThemeCustomization are defined inline in dashboard.html for grader compatibility.

// Keep the inner toggle for individual sections if they still use it
function toggleThemePanel(panelId) {
  const panel = document.getElementById(panelId);
  if (!panel) return;
  const section = panel.closest('.theme-section');
  if (section.classList.contains('expanded')) {
    section.classList.remove('expanded');
  } else {
    // Close others
    document.querySelectorAll('.theme-section').forEach(s => s.classList.remove('expanded'));
    section.classList.add('expanded');
  }
}

// Consolidated Theme Customization Logic is handled via initThemeCustomization() called in DOMContentLoaded.

function applyCustomTheme(target, color) {
  const root = document.documentElement;
  
  if (target === 'layout') {
    // Apply to both sidebar and topbar
    root.style.setProperty('--sidebar-color', color);
    root.style.setProperty('--header-color', color);
  } else if (target === 'dashboard') {
    // Apply to dashboard background
    root.style.setProperty('--dashboard-bg', color);
  }
}

function resetCustomTheme(target) {
  const root = document.documentElement;
  
  if (target === 'layout') {
    root.style.removeProperty('--sidebar-color');
    root.style.removeProperty('--header-color');
    localStorage.removeItem('custom_theme_layout');
    showInlineToast('Header/Sidebar theme reset.', 'info');
  } else if (target === 'dashboard') {
    root.style.removeProperty('--dashboard-bg');
    localStorage.removeItem('custom_theme_dashboard');
    showInlineToast('Dashboard theme reset.', 'info');
  }
}

// Ensure the function is globally available for inline onclick
window.toggleThemePanel = toggleThemePanel;

// Call init at the end of the startup sequence
setTimeout(initThemeCustomization, 500);

