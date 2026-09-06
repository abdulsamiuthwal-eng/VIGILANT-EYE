/**
 * Vigilant Eye — Main Dashboard JS (Client-Side Demo version)
 * Handles cameras, events list, settings, and TensorFlow.js object detection
 */

// ══════════════════════════════════════════════
// STATE & SEED DATA INITIALIZATION
// ══════════════════════════════════════════════
let cameras = [];
let activeStreams = {};
let cocoModel = null;
let isExpanded = false;
let activeExpandedId = null;
let cameraFacingModes = {}; // track front/back per camera id
let isMobileDevice = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

// Initialize mock database in localStorage
(function initLocalStorageDB() {
  // Default Cameras
  if (!localStorage.getItem("ve_cameras")) {
    localStorage.setItem("ve_cameras", JSON.stringify([
      { id: 1, camera_uid: "CAM-01", name: "Local Webcam / Mobile Feed", source: "0", camera_type: "usb", location: "Main Monitor", is_active: true, alert_enabled: true }
    ]));
  }
  
  // Default Emails
  if (!localStorage.getItem("ve_emails")) {
    localStorage.setItem("ve_emails", JSON.stringify([
      { email: "admin@vigilanteye.com", verified: true, alert_enabled: true }
    ]));
  }

  // Default Settings
  if (!localStorage.getItem("ve_settings")) {
    localStorage.setItem("ve_settings", JSON.stringify({
      email_alerts_enabled: "false",
      push_alerts_enabled: "false",
      alert_sound_enabled: "true",
      detection_confidence: "0.70",
      theme: "dark",
      font_layout: "'Outfit', sans-serif",
      font_size_layout: "16",
      font_dashboard: "'Outfit', sans-serif",
      font_size_dashboard: "16"
    }));
  }

  // Default Events — empty by default, each user gets their own
  if (!localStorage.getItem("ve_events")) {
    localStorage.setItem("ve_events", JSON.stringify([]));
  }

  // Default Training History
  if (!localStorage.getItem("ve_train_history")) {
    localStorage.setItem("ve_train_history", JSON.stringify([
      { id: 1, started_at: (Date.now() / 1000) - 86400, epochs: 50, status: "completed", map50: 0.941, notes: "Loss: 0.082" }
    ]));
  }
})();

// Load User info on start
document.addEventListener("DOMContentLoaded", () => {
  const curUser = JSON.parse(localStorage.getItem("currentUser") || '{"name":"Demo Admin","email":"admin@vigilanteye.com","role":"Administrator","theme":"dark"}');
  
  const setContent = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
  setContent("sidebarAvatar", curUser.name[0].toUpperCase());
  setContent("sidebarUserName", curUser.name);
  setContent("sidebarUserRole", curUser.role);
  setContent("accountAvatar", curUser.name[0].toUpperCase());
  setContent("accountUserName", curUser.name);
  setContent("accountEmail", curUser.email);
  setContent("accountUserRole", curUser.role);

  // Responsive Sidebar Toggle
  document.getElementById("sidebarToggle")?.addEventListener("click", () => {
    const sidebar = document.getElementById("sidebar");
    sidebar.classList.toggle("collapsed");
    document.body.classList.toggle("sidebar-collapsed");
  });

  // Mobile menu button triggers
  document.getElementById("mobileMenuBtn")?.addEventListener("click", () => {
    document.getElementById("sidebar").classList.add("mobile-open");
    document.getElementById("sidebarOverlay").classList.add("active");
  });

  document.getElementById("sidebarOverlay")?.addEventListener("click", () => {
    document.getElementById("sidebar").classList.remove("mobile-open");
    document.getElementById("sidebarOverlay").classList.remove("active");
  });

  // Close mobile sidebar on clicking navigation items
  document.querySelectorAll(".nav-item").forEach(item => {
    item.addEventListener("click", () => {
      document.getElementById("sidebar").classList.remove("mobile-open");
      document.getElementById("sidebarOverlay").classList.remove("active");
    });
  });
});

window.logout = function() {
  localStorage.removeItem("currentUser");
  window.location.href = "login.html";
};

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

  // Update topbar titles
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

  // Stop webcams if switching away from Cameras section
  if (sectionId !== "cameras") {
    stopAllWebcams();
  } else {
    loadCameras(); // re-init streams
  }

  // Section-specific init
  if (sectionId === "stats") { Charts && Charts.loadStats(); }
  if (sectionId === "events") { loadEvents(0); loadCameraFilter(); }
  if (sectionId === "add-camera") { loadCameraManageTable(); }
  if (sectionId === "training") { loadTrainingHistory(); }
  if (sectionId === "settings") { loadSettings(); loadUsers(); }
}

// ══════════════════════════════════════════════
// WEBCAM & OBJECT DETECTION ENGINE
// ══════════════════════════════════════════════
async function loadCocoModel() {
  if (!cocoModel) {
    console.log("Loading COCO-SSD Model...");
    cocoModel = await cocoSsd.load();
    console.log("COCO-SSD Model Loaded!");
  }
  return cocoModel;
}

function stopAllWebcams() {
  Object.keys(activeStreams).forEach(id => {
    if (activeStreams[id]) {
      activeStreams[id].getTracks().forEach(t => t.stop());
      delete activeStreams[id];
    }
  });
  console.log("All webcam streams stopped.");
}

async function startLocalWebcam(camId, facingMode) {
  const video = document.getElementById(`webcam-stream-${camId}`);
  const canvas = document.getElementById(`webcam-canvas-${camId}`);
  const loader = document.getElementById(`ai-loading-${camId}`);
  if (!video || !canvas) return;

  // Default: environment (back) cam on mobile, no preference on desktop
  if (!facingMode) {
    facingMode = cameraFacingModes[camId] || (isMobileDevice ? "environment" : null);
  }
  cameraFacingModes[camId] = facingMode;

  try {
    // Stop stream if already running
    if (activeStreams[camId]) {
      activeStreams[camId].getTracks().forEach(t => t.stop());
      delete activeStreams[camId];
    }

    // Build constraints — on desktop omit facingMode to avoid blocking
    let videoConstraints = { width: { ideal: 1280 }, height: { ideal: 720 } };
    if (facingMode) {
      videoConstraints.facingMode = { ideal: facingMode };
    }

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints });
    } catch (firstErr) {
      console.warn("First camera attempt failed, trying basic fallback...", firstErr);
      // Fallback: just ask for any camera
      stream = await navigator.mediaDevices.getUserMedia({ video: true });
    }

    activeStreams[camId] = stream;
    video.srcObject = stream;

    // Mirror video: back camera should NOT be mirrored, front camera should be
    const shouldMirror = facingMode === "user" || (!isMobileDevice);
    video.style.transform = shouldMirror ? "scaleX(-1)" : "scaleX(1)";

    // Update flip button icon to show current mode
    const flipBtn = document.getElementById(`flip-cam-${camId}`);
    if (flipBtn) {
      flipBtn.title = facingMode === "user" ? "Switch to Back Camera" : "Switch to Front Camera";
      flipBtn.innerHTML = facingMode === "user" ? "🤳" : "📷";
    }

    video.onloadedmetadata = () => {
      video.play();
      runDetectionLoop(camId, video, canvas, loader);
    };
  } catch (err) {
    console.warn("Camera streaming error:", err);
    if (loader) {
      loader.innerHTML = `
        <i class="fas fa-video-slash" style="font-size:2rem;color:var(--red);opacity:0.6;margin-bottom:8px;"></i>
        <div style="font-size:0.8rem;text-align:center;padding:0 12px;">Camera blocked or not connected.<br>Please allow camera permission in your browser.</div>
      `;
    }
  }
}

// Flip between front and back camera
window.flipCamera = function(camId) {
  const current = cameraFacingModes[camId] || (isMobileDevice ? "environment" : "user");
  const next = current === "user" ? "environment" : "user";
  cameraFacingModes[camId] = next;
  startLocalWebcam(camId, next);
};

async function runDetectionLoop(camId, video, canvas, loader) {
  try {
    const model = await loadCocoModel();
    if (loader) loader.style.display = "none";

    const ctx = canvas.getContext("2d");
    let lastAlertTime = 0;

    async function detectFrame() {
      // Exit loop if video stopped
      if (video.paused || video.ended || !activeStreams[camId]) return;

      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }

      const predictions = await model.detect(video);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Mirror canvas elements since webcam is self-facing (mirrored)
      ctx.save();
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);

      predictions.forEach(pred => {
        const [x, y, width, height] = pred.bbox;

        // Draw bbox
        ctx.strokeStyle = pred.class === "person" ? "#ff3b3b" : "#00c8ff";
        ctx.lineWidth = 3;
        ctx.strokeRect(x, y, width, height);

        // Label background (un-mirrored text box placement)
        ctx.fillStyle = pred.class === "person" ? "rgba(255,59,59,0.8)" : "rgba(0,200,255,0.8)";
        ctx.font = "bold 14px Outfit, sans-serif";
        const label = `${pred.class} (${Math.round(pred.score * 100)}%)`;
        const textWidth = ctx.measureText(label).width;

        // Draw labels
        ctx.save();
        ctx.translate(x + width, y - 20);
        ctx.scale(-1, 1);
        ctx.fillRect(0, 0, textWidth + 10, 20);
        ctx.fillStyle = "#ffffff";
        ctx.fillText(label, 5, 14);
        ctx.restore();

        // Trigger alarm on person detection
        if (pred.class === "person" && pred.score > 0.65) {
          const now = Date.now();
          if (now - lastAlertTime > 15000) { // 15s cooldown
            lastAlertTime = now;

            const snapPath = captureCanvasSnapshot(video);

            // Get current logged-in user email for per-user isolation
            const _curUser = JSON.parse(localStorage.getItem("currentUser") || '{"email":"demo"}');

            const alertData = {
              event_id: Date.now(),
              event_uid: "EV-" + Math.floor(Math.random() * 9000 + 1000),
              camera_id: camId,
              camera_name: cameras.find(c => c.id === camId)?.name || "Webcam Feed",
              activity_type: "Suspicious Movement (Person Detected)",
              confidence: Math.round(pred.score * 100),
              severity: "medium",
              timestamp: Date.now() / 1000,
              snapshot_path: snapPath,
              is_reviewed: false,
              user_email: _curUser.email   // tag with user
            };

            // Save to localStorage events DB
            const localEvents = JSON.parse(localStorage.getItem("ve_events") || "[]");
            localEvents.unshift(alertData);
            localStorage.setItem("ve_events", JSON.stringify(localEvents));

            // Trigger AlertSystem UI
            if (typeof AlertSystem !== 'undefined' && AlertSystem.onNewAlert) {
              AlertSystem.onNewAlert(alertData);
            }
          }
        }
      });

      ctx.restore();
      requestAnimationFrame(detectFrame);
    }

    detectFrame();
  } catch (err) {
    console.error("Detection loop setup error:", err);
  }
}

function captureCanvasSnapshot(video) {
  try {
    const snapCanvas = document.createElement("canvas");
    snapCanvas.width = video.videoWidth;
    snapCanvas.height = video.videoHeight;
    const snapCtx = snapCanvas.getContext("2d");
    
    // Draw mirrored to look correct
    snapCtx.translate(snapCanvas.width, 0);
    snapCtx.scale(-1, 1);
    snapCtx.drawImage(video, 0, 0, snapCanvas.width, snapCanvas.height);
    return snapCanvas.toDataURL("image/jpeg", 0.75);
  } catch (e) {
    return "";
  }
}

// ══════════════════════════════════════════════
// CAMERA LIST RENDERING & CONTROLS
// ══════════════════════════════════════════════
function loadCameras() {
  cameras = JSON.parse(localStorage.getItem("ve_cameras") || "[]");
  renderCameraGrid(cameras);
  updateActiveCamBadge(cameras.filter(c => c.is_active).length);

  // Refresh expanded view if active
  if (isExpanded && activeExpandedId) {
    const cam = cameras.find(c => c.id === activeExpandedId);
    if (cam) {
      renderExpandedCamera(cam);
      renderThumbnails();
    } else {
      exitExpandedMode();
    }
  }
}

function renderCameraGrid(camerasList) {
  const grid = document.getElementById("cameraGrid");
  const noMsg = document.getElementById("noCamerasMsg");
  if (!grid) return;

  // Clear existing camera cards (keep noCamerasMsg)
  grid.querySelectorAll(".camera-card").forEach(c => c.remove());

  if (!camerasList.length) {
    if (noMsg) noMsg.style.display = "flex";
    return;
  }
  if (noMsg) noMsg.style.display = "none";

  camerasList.forEach(cam => {
    const card = createCameraCard(cam);
    grid.appendChild(card);
    // NO auto-start: user must tap 'Start Camera' button
  });
}

function createCameraCard(cam) {
  const card = document.createElement("div");
  card.className = "camera-card";
  card.dataset.cameraId = cam.id;
  card.innerHTML = `
    <div class="camera-feed-wrap">
      ${cam.is_active
        ? `
          <video id="webcam-stream-${cam.id}" autoplay playsinline muted style="width:100%;height:100%;object-fit:cover;display:none;"></video>
          <canvas id="webcam-canvas-${cam.id}" style="position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;display:none;"></canvas>
          <div id="ai-loading-${cam.id}" style="position:absolute;inset:0;background:#040c20;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:12px;color:#00c8ff;display:none;">
            <div style="width:28px;height:28px;border-radius:50%;border:2px solid rgba(0,200,255,0.15);border-top-color:#00c8ff;animation:spin 0.8s linear infinite;"></div>
            <span style="font-size:0.75rem;letter-spacing:1px;text-transform:uppercase;">Booting AI...</span>
          </div>
          <div id="cam-start-prompt-${cam.id}" style="position:absolute;inset:0;background:#040c20;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:14px;">
            <i class="fas fa-camera" style="font-size:2.5rem;color:rgba(0,200,255,0.5);"></i>
            <span style="font-size:0.8rem;color:rgba(255,255,255,0.5);letter-spacing:0.5px;">Camera ready</span>
            <button onclick="activateCameraFeed(${cam.id})" style="background:var(--accent);border:none;color:#000;font-weight:700;padding:10px 22px;border-radius:8px;cursor:pointer;font-size:0.85rem;letter-spacing:0.5px;display:flex;align-items:center;gap:8px;">
              <i class="fas fa-play"></i> Start Camera
            </button>
          </div>
          `
        : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:12px;background:#040c20;color:rgba(255,255,255,0.2)"><i class="fas fa-video-slash" style="font-size:2.5rem;opacity:0.3"></i><span style="font-size:0.82rem">Camera Offline</span></div>`
      }
      <div class="camera-overlay">
        <span class="cam-id-badge">📹 ${cam.camera_uid}</span>
        ${cam.is_active ? `<span class="rec-badge" id="rec-badge-${cam.id}" style="display:none;"><span class="rec-dot"></span>REC</span>` : ""}
      </div>
      ${cam.is_active ? `
        <button id="flip-cam-${cam.id}" onclick="flipCamera(${cam.id})" title="Switch Camera"
          style="position:absolute;bottom:10px;right:10px;z-index:10;background:rgba(0,0,0,0.55);border:1px solid rgba(255,255,255,0.2);border-radius:50%;width:38px;height:38px;font-size:1.2rem;cursor:pointer;display:none;align-items:center;justify-content:center;backdrop-filter:blur(4px);transition:background 0.2s;"
          onmouseover="this.style.background='rgba(0,200,255,0.25)'" onmouseout="this.style.background='rgba(0,0,0,0.55)'">📷</button>
      ` : ""}
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
  
  card.addEventListener("dblclick", () => expandCamera(cam.id));
  return card;
}

// Called when user taps 'Start Camera' button
window.activateCameraFeed = function(camId) {
  const prompt = document.getElementById(`cam-start-prompt-${camId}`);
  const loader = document.getElementById(`ai-loading-${camId}`);
  const video = document.getElementById(`webcam-stream-${camId}`);
  const canvas = document.getElementById(`webcam-canvas-${camId}`);
  const flipBtn = document.getElementById(`flip-cam-${camId}`);
  const recBadge = document.getElementById(`rec-badge-${camId}`);

  if (prompt) prompt.style.display = "none";
  if (loader) { loader.style.display = "flex"; }
  if (video) video.style.display = "block";
  if (canvas) canvas.style.display = "block";
  if (flipBtn) flipBtn.style.display = "flex";
  if (recBadge) recBadge.style.display = "flex";

  startLocalWebcam(camId);
};

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
    container.innerHTML = `
      <div style="width:100%;height:100%;position:relative;">
        <video id="webcam-stream-${cam.id}" autoplay playsinline muted style="width:100%;height:100%;object-fit:cover;display:none;"></video>
        <canvas id="webcam-canvas-${cam.id}" style="position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;display:none;"></canvas>
        <div id="ai-loading-${cam.id}" style="position:absolute;inset:0;background:#040c20;align-items:center;justify-content:center;flex-direction:column;gap:12px;color:#00c8ff;display:none;">
          <div style="width:36px;height:36px;border-radius:50%;border:2px solid rgba(0,200,255,0.15);border-top-color:#00c8ff;animation:spin 0.8s linear infinite;"></div>
          <span style="font-size:0.75rem;letter-spacing:1px;text-transform:uppercase;">Booting AI...</span>
        </div>
        <div id="cam-start-prompt-${cam.id}" style="position:absolute;inset:0;background:#040c20;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:18px;">
          <i class="fas fa-camera" style="font-size:3.5rem;color:rgba(0,200,255,0.45);"></i>
          <span style="font-size:0.85rem;color:rgba(255,255,255,0.45);letter-spacing:0.5px;">Camera ready</span>
          <button onclick="activateCameraFeed(${cam.id})" style="background:var(--accent);border:none;color:#000;font-weight:700;padding:12px 28px;border-radius:10px;cursor:pointer;font-size:0.9rem;letter-spacing:0.5px;display:flex;align-items:center;gap:10px;">
            <i class="fas fa-play"></i> Start Camera
          </button>
        </div>
        <button id="flip-cam-${cam.id}" onclick="flipCamera(${cam.id})" title="Switch Camera"
          style="position:absolute;bottom:16px;right:16px;z-index:10;background:rgba(0,0,0,0.55);border:1px solid rgba(255,255,255,0.25);border-radius:50%;width:48px;height:48px;font-size:1.5rem;cursor:pointer;display:none;align-items:center;justify-content:center;backdrop-filter:blur(4px);transition:background 0.2s;"
          onmouseover="this.style.background='rgba(0,200,255,0.25)'" onmouseout="this.style.background='rgba(0,0,0,0.55)'">📷</button>
      </div>
    `;
    // No auto-start — user taps 'Start Camera'
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
          ? `<i class="fas fa-video" style="color:var(--accent); font-size:1.5rem;"></i>`
          : `<i class="fas fa-video-slash" style="opacity:0.2; font-size:1.5rem;"></i>`
        }
      </div>
      <div class="thumb-info">
        <div class="thumb-name">${cam.name}</div>
        <div class="thumb-status ${cam.is_active ? 'online' : ''}">${cam.is_active ? 'Online' : 'Offline'}</div>
      </div>
    `;
    thumb.onclick = () => {
      activeExpandedId = cam.id;
      // Stop old stream before starting new one
      stopAllWebcams();
      renderExpandedCamera(cam);
      renderThumbnails();
    };
    list.appendChild(thumb);
  });
}

function exitExpandedMode() {
  isExpanded = false;
  activeExpandedId = null;
  stopAllWebcams();
  document.getElementById("cameraExpandedView").style.display = "none";
  document.getElementById("cameraGrid").style.display = "grid";
  loadCameras();
}

document.getElementById("btnExitExpanded")?.addEventListener("click", exitExpandedMode);

function toggleCamera(cameraId, active) {
  const list = JSON.parse(localStorage.getItem("ve_cameras") || "[]");
  const idx = list.findIndex(c => c.id === cameraId);
  if (idx !== -1) {
    list[idx].is_active = active;
    localStorage.setItem("ve_cameras", JSON.stringify(list));
    showInlineToast(`Camera "${list[idx].name}" turned ${active ? 'ON' : 'OFF'}.`, "success");
    
    // Stop streams if turned off
    if (!active && activeStreams[cameraId]) {
      activeStreams[cameraId].getTracks().forEach(t => t.stop());
      delete activeStreams[cameraId];
    }
    
    setTimeout(() => loadCameras(), 300);
  }
}

function takeSnapshot(cameraId) {
  const video = document.getElementById(`webcam-stream-${cameraId}`);
  if (!video || !activeStreams[cameraId]) {
    showInlineToast("Camera not active or no frame available.", "error");
    return;
  }

  const snapData = captureCanvasSnapshot(video);
  if (snapData) {
    showInlineToast("Snapshot saved successfully to local downloads!", "success");
    
    // Trigger download trigger
    const link = document.createElement("a");
    link.href = snapData;
    link.download = `VigilantEye_Snapshot_Cam${cameraId}_${Math.floor(Date.now()/1000)}.jpg`;
    link.click();
  } else {
    showInlineToast("Failed to capture snapshot.", "error");
  }
}

function updateActiveCamBadge(count) {
  const badge = document.getElementById("activeCamBadge");
  if (badge) badge.textContent = count;
}

// ── Detect cameras using browser WebRTC media devices enumerator ──
document.getElementById("detectCamerasBtn")?.addEventListener("click", async () => {
  const btn = document.getElementById("detectCamerasBtn");
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Scanning...';
  btn.disabled = true;
  
  try {
    // Request permission to enumerate cameras with names
    await navigator.mediaDevices.getUserMedia({ video: true });
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(d => d.kind === "videoinput");
    
    const list = document.getElementById("detectedCamList");
    if (!list) return;
    list.innerHTML = "";

    if (!videoDevices.length) {
      list.innerHTML = '<div class="hint">No camera hardware devices found.</div>';
    } else {
      videoDevices.forEach((device, index) => {
        const item = document.createElement("div");
        item.className = "detected-cam-item";
        item.innerHTML = `
          <span>📹 ${device.label || `Camera ${index + 1}`} (Device Index: ${index})</span>
          <button class="btn btn-sm btn-primary" onclick="quickAddCamera('${index}', '${device.label || `Camera ${index + 1}`}')">Add</button>
        `;
        list.appendChild(item);
      });
    }
  } catch (err) {
    console.warn("Enumerate devices failed:", err);
    const list = document.getElementById("detectedCamList");
    if (list) list.innerHTML = '<div class="hint">Permission denied or error listing cameras.</div>';
  } finally {
    btn.innerHTML = '<i class="fas fa-search"></i> Scan for Cameras';
    btn.disabled = false;
  }
});

function quickAddCamera(index, name) {
  const list = JSON.parse(localStorage.getItem("ve_cameras") || "[]");
  const newCam = {
    id: Date.now(),
    camera_uid: "CAM-" + Math.floor(Math.random() * 9000 + 1000),
    name: name,
    source: index,
    camera_type: "usb",
    location: "Security Area",
    is_active: false,
    alert_enabled: true
  };
  list.push(newCam);
  localStorage.setItem("ve_cameras", JSON.stringify(list));
  
  showInlineToast(`Camera "${name}" added to list!`, "success");
  loadCameras();
  loadCameraManageTable();
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

  const name = document.getElementById("camName").value;
  const source = document.getElementById("camSource").value;
  const type = document.getElementById("camType").value;
  const location = document.getElementById("camLocation").value || "Store";

  setTimeout(() => {
    const list = JSON.parse(localStorage.getItem("ve_cameras") || "[]");
    const newCam = {
      id: Date.now(),
      camera_uid: "CAM-" + Math.floor(Math.random() * 9000 + 1000),
      name: name,
      source: source,
      camera_type: type,
      location: location,
      is_active: false,
      alert_enabled: true
    };
    list.push(newCam);
    localStorage.setItem("ve_cameras", JSON.stringify(list));

    showInlineToast("Camera added successfully!", "success");
    this.reset();
    
    if (submitBtn) {
      submitBtn.innerHTML = originalHtml;
      submitBtn.disabled = false;
    }
    loadCameras();
    loadCameraManageTable();
  }, 800);
});

function loadCameraManageTable() {
  const cams = JSON.parse(localStorage.getItem("ve_cameras") || "[]");
  const tbody = document.getElementById("cameraManageBody");
  if (!tbody) return;
  
  if (!cams.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="loading-row">No cameras added yet.</td></tr>';
    return;
  }

  tbody.innerHTML = cams.map(cam => `
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
  loadCameraFilter();
}

function toggleCameraAlerts(cameraId, enabled) {
  const list = JSON.parse(localStorage.getItem("ve_cameras") || "[]");
  const idx = list.findIndex(c => c.id === cameraId);
  if (idx !== -1) {
    list[idx].alert_enabled = enabled;
    localStorage.setItem("ve_cameras", JSON.stringify(list));
    showInlineToast(`Alerts ${enabled ? 'enabled' : 'disabled'} for ${list[idx].name}.`, "success");
  }
}

function deleteCamera(cameraId, name) {
  if (!confirm(`Remove camera "${name}"?`)) return;
  const list = JSON.parse(localStorage.getItem("ve_cameras") || "[]");
  const filtered = list.filter(c => c.id !== cameraId);
  localStorage.setItem("ve_cameras", JSON.stringify(filtered));

  if (activeStreams[cameraId]) {
    activeStreams[cameraId].getTracks().forEach(t => t.stop());
    delete activeStreams[cameraId];
  }

  showInlineToast(`Camera "${name}" removed.`, "success");
  loadCameras();
  loadCameraManageTable();
}

// ══════════════════════════════════════════════
// EVENT LOGS
// ══════════════════════════════════════════════
let currentPage = 0;
const PAGE_SIZE = 15;

function loadEvents(offset = 0) {
  currentPage = offset;
  const tbody = document.getElementById("eventsBody");
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="7" class="loading-row"><i class="fas fa-spinner fa-spin" style="margin-right:8px"></i>Loading events...</td></tr>';

  setTimeout(() => {
    let events = JSON.parse(localStorage.getItem("ve_events") || "[]");
    
    // Filters
    const filterCamera = document.getElementById("filterCamera")?.value || "";
    const filterActivity = document.getElementById("filterActivity")?.value || "";

    if (filterCamera) {
      events = events.filter(e => String(e.camera_id) === filterCamera);
    }
    if (filterActivity) {
      events = events.filter(e => e.activity_type.toLowerCase().includes(filterActivity.toLowerCase()));
    }

    // Pagination
    const paginated = events.slice(offset, offset + PAGE_SIZE);

    const prevBtn = document.getElementById("prevPageBtn");
    const nextBtn = document.getElementById("nextPageBtn");

    if (prevBtn) prevBtn.disabled = offset === 0;
    if (nextBtn) nextBtn.disabled = events.length <= offset + PAGE_SIZE;

    if (!paginated.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="loading-row">No events found.</td></tr>';
      return;
    }

    tbody.innerHTML = paginated.map(e => `
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
            ${!e.is_reviewed ? `
              <button class="btn-sm btn-primary" onclick="reviewEvent(${e.event_id}, false, this)">✓ OK</button>
              <button class="btn-sm btn-danger" onclick="reviewEvent(${e.event_id}, true, this)">✗ False</button>
            ` : `<span style="color:var(--text-muted);font-size:0.75rem">Reviewed</span>`}
          </div>
        </td>
      </tr>
    `).join("");

    const pageNum = Math.floor(offset / PAGE_SIZE) + 1;
    document.getElementById("pageInfo").textContent = `Page ${pageNum}`;
  }, 300);
}

function reviewEvent(eventId, isFalseAlarm) {
  const events = JSON.parse(localStorage.getItem("ve_events") || "[]");
  const idx = events.findIndex(e => e.event_id === eventId);
  if (idx !== -1) {
    events[idx].is_reviewed = true;
    if (isFalseAlarm) {
      events[idx].activity_type = "False Alarm: " + events[idx].activity_type;
    }
    localStorage.setItem("ve_events", JSON.stringify(events));
    loadEvents(currentPage);
  }
}

function loadCameraFilter() {
  const cams = JSON.parse(localStorage.getItem("ve_cameras") || "[]");
  const select = document.getElementById("filterCamera");
  if (select) {
    select.innerHTML = '<option value="">All Cameras</option>' +
      cams.map(c => `<option value="${c.id}">${c.name}</option>`).join("");
  }
}

function exportEvents() {
  const events = JSON.parse(localStorage.getItem("ve_events") || "[]");
  const csv = [
    "Event ID,Camera,Activity,Confidence,Severity,Timestamp",
    ...events.map(e => `${e.event_uid},${e.camera_name},"${e.activity_type}",${e.confidence}%,${e.severity},${new Date(e.timestamp * 1000).toLocaleString()}`)
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "vigilant_eye_events_demo.csv";
  a.click();
}

document.getElementById("applyFilterBtn")?.addEventListener("click", () => loadEvents(0));
document.getElementById("exportEventsBtn")?.addEventListener("click", exportEvents);
document.getElementById("prevPageBtn")?.addEventListener("click", () => { if (currentPage >= PAGE_SIZE) loadEvents(currentPage - PAGE_SIZE); });
document.getElementById("nextPageBtn")?.addEventListener("click", () => loadEvents(currentPage + PAGE_SIZE));

// ══════════════════════════════════════════════
// SETTINGS MANAGEMENT
// ══════════════════════════════════════════════
function loadSettings() {
  const settings = JSON.parse(localStorage.getItem("ve_settings"));
  
  const set = (id, val) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (el.type === "checkbox") el.checked = val === "true";
    else if (el.type === "range") el.value = parseFloat(val);
    else el.value = val;
  };

  set("emailAlertToggle", settings.email_alerts_enabled);
  set("pushAlertToggle", settings.push_alerts_enabled);
  set("soundSettingToggle", settings.alert_sound_enabled);
  
  // Conf threshold range is 50 - 99
  const confRangeVal = Math.round(parseFloat(settings.detection_confidence) * 100);
  const confEl = document.getElementById("confThreshold");
  if (confEl) confEl.value = confRangeVal;
  
  const confVal = document.getElementById("confVal");
  if (confVal) confVal.textContent = confRangeVal + "%";

  // Load fonts
  const fontLayout = settings.font_layout;
  const sizeLayout = settings.font_size_layout;
  const fontDash = settings.font_dashboard;
  const sizeDash = settings.font_size_dashboard;

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
  loadVerifiedEmailList();
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

  // Update in settings
  const settings = JSON.parse(localStorage.getItem("ve_settings"));
  settings.font_layout = layoutFont;
  settings.font_size_layout = layoutSize;
  settings.font_dashboard = dashFont;
  settings.font_size_dashboard = dashSize;
  localStorage.setItem("ve_settings", JSON.stringify(settings));
}

function saveAllSettings() {
  const getChecked = id => document.getElementById(id)?.checked;
  const getVal = id => document.getElementById(id)?.value;
  const conf = parseFloat(getVal("confThreshold") || "70") / 100;
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

  localStorage.setItem("ve_settings", JSON.stringify(payload));
  showInlineToast("Settings saved locally!", "success");
}

document.getElementById("saveSettingsBtn")?.addEventListener("click", saveAllSettings);

// Font live updates
["layoutFontFamily", "layoutFontSize", "dashboardFontFamily", "dashboardFontSize"].forEach(id => {
  document.getElementById(id)?.addEventListener("change", () => {
    const layoutSize = document.getElementById("layoutFontSize")?.value;
    const dashSize = document.getElementById("dashboardFontSize")?.value;
    if (document.getElementById("layoutFontSizeVal")) document.getElementById("layoutFontSizeVal").textContent = layoutSize + "px";
    if (document.getElementById("dashboardFontSizeVal")) document.getElementById("dashboardFontSizeVal").textContent = dashSize + "px";
    saveFontSettings();
  });
  if (id.includes("Size")) {
    document.getElementById(id)?.addEventListener("input", () => {
      const elVal = document.getElementById(id + "Val");
      const elInput = document.getElementById(id);
      if (elVal && elInput) elVal.textContent = elInput.value + "px";
    });
  }
});

document.getElementById("testAlertSettingsBtn")?.addEventListener("click", () => {
  showInlineToast("Simulating a Test Security Alert...", "info");
  setTimeout(() => {
    const alertData = {
      event_id: Date.now(),
      event_uid: "EV-" + Math.floor(Math.random() * 9000 + 1000),
      camera_id: 1,
      camera_name: "Local Webcam / Mobile Feed",
      activity_type: "Test Alert Triggered",
      confidence: 99,
      severity: "low",
      timestamp: Date.now() / 1000,
      snapshot_path: ""
    };
    
    // Save to event list
    const localEvents = JSON.parse(localStorage.getItem("ve_events") || "[]");
    localEvents.unshift(alertData);
    localStorage.setItem("ve_events", JSON.stringify(localEvents));

    if (typeof AlertSystem !== 'undefined' && AlertSystem.onNewAlert) {
      AlertSystem.onNewAlert(alertData);
    }
  }, 1000);
});

// Conf threshold range live update
document.getElementById("confThreshold")?.addEventListener("input", function() {
  const val = document.getElementById("confVal");
  if (val) val.textContent = this.value + "%";
});

// ══════════════════════════════════════════════
// USER MANAGEMENT (Mock)
// ══════════════════════════════════════════════
function loadUsers() {
  const systemUsers = JSON.parse(localStorage.getItem("ve_users") || "[]");
  const tbody = document.getElementById("usersManageBody");
  if (!tbody) return;

  const defaultAdmin = { id: 999, name: "Demo Admin", email: "admin@vigilanteye.com", role: "Administrator" };
  const allUsers = [defaultAdmin, ...systemUsers.map((u, i) => ({ id: i, name: u.name, email: u.email, role: "Viewer" }))];

  tbody.innerHTML = allUsers.map(u => `
    <tr>
      <td style="font-weight:600">${u.name}</td>
      <td>${u.email}</td>
      <td><span class="role-badge">${u.role}</span></td>
      <td>
        ${u.email !== defaultAdmin.email 
          ? `<button class="btn-sm btn-danger" onclick="deleteUser('${u.email}', '${u.name}')" title="Remove User"><i class="fas fa-trash"></i></button>`
          : `<span style="color:var(--text-muted);font-size:0.75rem">Protected</span>`
        }
      </td>
    </tr>
  `).join("");
}

function deleteUser(email, name) {
  if (!confirm(`Are you sure you want to completely remove user "${name}"?`)) return;
  const list = JSON.parse(localStorage.getItem("ve_users") || "[]");
  const filtered = list.filter(u => u.email !== email);
  localStorage.setItem("ve_users", JSON.stringify(filtered));
  showInlineToast(`User "${name}" removed.`, "success");
  loadUsers();
}

// ══════════════════════════════════════════════
// THEME
// ══════════════════════════════════════════════
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  const icon = document.getElementById("themeIcon");
  if (icon) icon.className = theme === "light" ? "fas fa-sun" : "fas fa-moon";
}

document.getElementById("themeToggleBtn")?.addEventListener("click", () => {
  const current = document.documentElement.getAttribute("data-theme");
  const next = current === "dark" ? "light" : "dark";
  applyTheme(next);
  
  const settings = JSON.parse(localStorage.getItem("ve_settings"));
  settings.theme = next;
  localStorage.setItem("ve_settings", JSON.stringify(settings));
});

// Accent customizations
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
          localStorage.removeItem('ve_header_color');
          localStorage.removeItem('ve_accent_color');
          showInlineToast("Accent colors reset.", "info");
        } else {
          document.documentElement.style.removeProperty('--dashboard-bg');
          localStorage.removeItem('ve_dashboard_bg');
          showInlineToast("Dashboard background reset.", "info");
        }
        return;
      }

      if (target === 'layout') {
        document.documentElement.style.setProperty('--header-color', color);
        document.documentElement.style.setProperty('--sidebar-color', color);
        document.documentElement.style.setProperty('--accent', color);
        localStorage.setItem('ve_header_color', color);
        localStorage.setItem('ve_accent_color', color);
      } else {
        document.documentElement.style.setProperty('--dashboard-bg', color);
        localStorage.setItem('ve_dashboard_bg', color);
      }
    });
  });

  // Load colors
  const savedHeader = localStorage.getItem('ve_header_color');
  const savedDash = localStorage.getItem('ve_dashboard_bg');
  const savedAccent = localStorage.getItem('ve_accent_color');

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
// AI TRAINING SIMULATOR
// ══════════════════════════════════════════════
let trainingTimer = null;

document.getElementById("startTrainingBtn")?.addEventListener("click", () => {
  const epochs = parseInt(document.getElementById("trainEpochs")?.value || "50");
  const batch = parseInt(document.getElementById("trainBatch")?.value || "16");
  const btn = document.getElementById("startTrainingBtn");
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Starting...';
  btn.disabled = true;

  setTimeout(() => {
    // Show progress panel
    document.getElementById("trainingProgressWrap").style.display = "block";
    document.getElementById("trainingIdle").style.display = "none";
    showInlineToast("AI model training initiated!", "success");

    let currentEpoch = 0;
    
    // Simulate training progress over socket trigger
    trainingTimer = setInterval(() => {
      currentEpoch++;
      const progressPct = Math.round((currentEpoch / epochs) * 100);
      const loss = (0.284 / (currentEpoch * 0.12 + 1)).toFixed(4);

      const progressData = {
        status: currentEpoch >= epochs ? "completed" : "running",
        epoch: currentEpoch,
        total_epochs: epochs,
        progress: progressPct,
        message: `Epoch ${currentEpoch}/${epochs} — Loss: ${loss}`
      };

      // Trigger the socket mockup progress event
      if (typeof AlertSystem !== 'undefined' && AlertSystem.init) {
        // Accessing mock socket directly via the local wrapper
        const dummyEvent = new CustomEvent("training_progress", { detail: progressData });
        AlertSystem.init; // ensures alerts.js initialized
      }
      
      // Execute progress updates inside alerts.js directly in window scope
      if (window.AlertSystem) {
        // Manually trigger the mock socket callback
        // The mock socket is alertSystem's private variable, but we can hook into it
        // We modified alerts.js to expose the mock socket's trigger function
        // (we added socket.trigger to trigger events)
        // Let's call the triggered event
        // But since the socket is private in AlertSystem, we can also manually invoke the callback
      }
      
      // Let's call onTrainingProgress directly if exposed or write simulation here
      simulateTrainingProgressUI(progressData);

      if (currentEpoch >= epochs) {
        clearInterval(trainingTimer);
        trainingTimer = null;
        
        // Save to training history
        const hist = JSON.parse(localStorage.getItem("ve_train_history") || "[]");
        hist.unshift({
          id: hist.length + 1,
          started_at: Date.now() / 1000,
          epochs: epochs,
          status: "completed",
          map50: 0.952,
          notes: `Loss: ${loss}`
        });
        localStorage.setItem("ve_train_history", JSON.stringify(hist));
        loadTrainingHistory();
      }
    }, 1500); // 1.5s per epoch
  }, 1000);
});

function simulateTrainingProgressUI(data) {
  // Directly drive the progress UI elements to ensure responsiveness
  const wrap = document.getElementById('trainingProgressWrap');
  const bar = document.getElementById('trainingBar');
  const msg = document.getElementById('trainingMsg');
  const idle = document.getElementById('trainingIdle');
  const startBtn = document.getElementById('startTrainingBtn');
  const stopBtn = document.getElementById('stopTrainingBtn');
  const pctBadge = document.getElementById('trainProgressPct');
  const epochLbl = document.getElementById('trainEpochLabel');
  const elapsedEl = document.getElementById('trainElapsedTime');
  const avgEl = document.getElementById('trainAvgEpochTime');
  const tlEl = document.getElementById('trainTimeLeft');
  const etaEl = document.getElementById('trainCompletionTime');
  const pill = document.getElementById('trainingStatusPill');

  if (!wrap) return;

  if (data.status === 'running') {
    wrap.style.display = 'block';
    if (idle) idle.style.display = 'none';
    if (startBtn) startBtn.style.display = 'none';
    if (stopBtn) { stopBtn.style.display = 'block'; stopBtn.disabled = false; }
    
    if (bar) bar.style.width = `${data.progress}%`;
    if (pctBadge) pctBadge.textContent = `${data.progress}%`;
    if (epochLbl) epochLbl.textContent = `Epoch ${data.epoch} / ${data.total_epochs}`;
    if (msg) msg.textContent = data.message;
    if (pill) {
      pill.className = 'training-active-pill';
      pill.innerHTML = '<span class="pulse-dot"></span> TRAINING';
    }
    
    // Simulate time values
    const elapsed = data.epoch * 1.5;
    const timeLeft = (data.total_epochs - data.epoch) * 1.5;
    if (elapsedEl) elapsedEl.textContent = `${Math.round(elapsed)}s`;
    if (avgEl) avgEl.textContent = '1.5s';
    if (tlEl) tlEl.textContent = `${Math.round(timeLeft)}s`;
    if (etaEl) {
      const eta = new Date(Date.now() + timeLeft * 1000);
      etaEl.textContent = eta.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
  } else if (data.status === 'completed') {
    if (wrap) wrap.style.display = 'none';
    if (idle) {
      idle.style.display = 'block';
      idle.textContent = 'Training completed successfully!';
      idle.style.color = 'var(--green)';
    }
    if (startBtn) { startBtn.style.display = 'block'; startBtn.disabled = false; startBtn.innerHTML = '<i class="fas fa-play"></i> Start Training'; }
    if (stopBtn) stopBtn.style.display = 'none';
    
    showInlineToast("Training Complete! YOLO model updated.", "success");
  }
}

document.getElementById("stopTrainingBtn")?.addEventListener("click", () => {
  if (trainingTimer) {
    clearInterval(trainingTimer);
    trainingTimer = null;
  }
  
  const stopBtn = document.getElementById('stopTrainingBtn');
  if (stopBtn) {
    stopBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Stopping...';
    stopBtn.disabled = true;
  }

  setTimeout(() => {
    const wrap = document.getElementById('trainingProgressWrap');
    if (wrap) wrap.style.display = 'none';
    
    const idle = document.getElementById('trainingIdle');
    if (idle) {
      idle.style.display = 'block';
      idle.innerHTML = '<i class="fas fa-check-circle" style="color:var(--orange);margin-right:6px"></i><span style="color:var(--orange)">Stopped Successfully</span>';
    }
    
    const startBtn = document.getElementById('startTrainingBtn');
    if (startBtn) { startBtn.style.display = 'block'; startBtn.disabled = false; startBtn.innerHTML = '<i class="fas fa-play"></i> Start Training'; }
    if (stopBtn) { stopBtn.style.display = 'none'; stopBtn.disabled = false; stopBtn.innerHTML = '<i class="fas fa-stop"></i> Stop Training'; }
    
    showInlineToast("Training execution halted.", "warning");
  }, 1000);
});

document.getElementById("validateDatasetBtn")?.addEventListener("click", () => {
  showInlineToast("Validating dataset folders...", "info");
  setTimeout(() => {
    const el = document.getElementById("datasetStatus");
    if (!el) return;
    el.innerHTML = `
      <div class="ok">
        ✅ Dataset folders valid
      </div>
      <div>📷 Images: 420 (train) + 90 (val)</div>
      <div>🏷 Labels: 420 (train) + 90 (val)</div>
      <div style="color:var(--green);margin-top:6px;"><i class="fas fa-check"></i> Ready for training.</div>
    `;
  }, 800);
});

document.getElementById("prepareDatasetBtn")?.addEventListener("click", () => {
  showInlineToast("Creating workspace folder structures...", "info");
  setTimeout(() => {
    showInlineToast("Folders dataset/images/train and dataset/labels/train generated successfully!", "success");
  }, 1000);
});

document.getElementById("uploadVideoBtn")?.addEventListener("click", () => {
  const fileInput = document.getElementById("videoUploadInput");
  if (fileInput) fileInput.click();
});

document.getElementById("videoUploadInput")?.addEventListener("change", function() {
  if (!this.files || !this.files.length) return;
  
  const file = this.files[0];
  const wrap = document.getElementById("extractionProgressWrap");
  const bar = document.getElementById("extractionBar");
  const msg = document.getElementById("extractionMsg");
  const btn = document.getElementById("uploadVideoBtn");
  
  if (wrap) wrap.style.display = "block";
  if (msg) msg.textContent = "Uploading video stream...";
  if (btn) btn.disabled = true;
  if (bar) bar.style.width = "20%";
  
  setTimeout(() => {
    if (msg) msg.textContent = "Extracting video frames to dataset folder (FPS: 1)...";
    if (bar) bar.style.width = "60%";
    
    setTimeout(() => {
      if (bar) bar.style.width = "100%";
      showInlineToast("Video frames extracted successfully! Place annotations to start training.", "success");
      if (wrap) wrap.style.display = "none";
      if (btn) btn.disabled = false;
      this.value = "";
    }, 2000);
  }, 1500);
});

function loadTrainingHistory() {
  const sessions = JSON.parse(localStorage.getItem("ve_train_history") || "[]");
  const tbody = document.getElementById("trainHistBody");
  if (!tbody) return;
  
  if (!sessions.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="loading-row">No training sessions yet.</td></tr>';
    return;
  }
  tbody.innerHTML = sessions.map(s => {
    return `
      <tr>
        <td>#${s.id}</td>
        <td style="font-size:0.78rem;color:var(--text-secondary)">${new Date(s.started_at * 1000).toLocaleString()}</td>
        <td>${s.epochs}</td>
        <td><span class="sev-badge low">${s.status}</span></td>
        <td>${s.map50 ? (s.map50 * 100).toFixed(1) + "%" : "—"}</td>
        <td>${s.notes}</td>
      </tr>
    `;
  }).join("");
}

// ══════════════════════════════════════════════
// MULTI-EMAIL ALERT RECIPIENTS (Mock)
// ══════════════════════════════════════════════
function loadVerifiedEmailList() {
  const emails = JSON.parse(localStorage.getItem("ve_emails") || "[]");
  renderVerifiedEmailList(emails);
}

function renderVerifiedEmailList(list) {
  const listEl = document.getElementById('verifiedEmailList');
  if (!listEl) return;
  if (!list || !list.length) {
    listEl.innerHTML = `
      <div style="color:var(--text-muted);font-size:0.82rem;padding:12px 0;text-align:center;">
        <i class="fas fa-inbox" style="display:block;font-size:1.5rem;opacity:0.3;margin-bottom:6px;"></i>
        No alert emails configured.
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

document.getElementById('btnAddEmail')?.addEventListener('click', () => {
  const emailInput = document.getElementById('newAlertEmailInput');
  const btn = document.getElementById('btnAddEmail');
  const email = emailInput?.value.trim();

  if (!email || !email.includes('@')) {
    showInlineToast('Please enter a valid email address.', 'error');
    return;
  }

  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
  btn.disabled = true;

  setTimeout(() => {
    showInlineToast('Verification code 123456 sent to email (Mocked)!', 'success');
    document.getElementById('newEmailOtpSection').style.display = 'block';
    if (emailInput) emailInput.disabled = true;
    btn.innerHTML = '<i class="fas fa-check"></i> Code Sent';
  }, 1000);
});

document.getElementById('btnVerifyNewEmail')?.addEventListener('click', () => {
  const otpInput = document.getElementById('newEmailOtpInput');
  const btn = document.getElementById('btnVerifyNewEmail');
  const otp = otpInput?.value.trim();
  const email = document.getElementById('newAlertEmailInput')?.value.trim();

  if (otp !== "123456") {
    showInlineToast('Invalid verification code. Enter 123456.', 'error');
    return;
  }

  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verifying...';
  btn.disabled = true;

  setTimeout(() => {
    const list = JSON.parse(localStorage.getItem("ve_emails") || "[]");
    list.push({ email: email, verified: true, alert_enabled: true });
    localStorage.setItem("ve_emails", JSON.stringify(list));

    showInlineToast('Email verified and added successfully!', 'success');
    _resetAddEmailForm();
    loadVerifiedEmailList();
  }, 1000);
});

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

function removeVerifiedEmail(email) {
  if (!confirm(`Remove "${email}" from alert list?`)) return;
  const list = JSON.parse(localStorage.getItem("ve_emails") || "[]");
  const filtered = list.filter(e => e.email !== email);
  localStorage.setItem("ve_emails", JSON.stringify(filtered));
  showInlineToast(`${email} removed from alerts list.`, 'success');
  loadVerifiedEmailList();
}

function toggleEmailAlert(email, enabled) {
  const list = JSON.parse(localStorage.getItem("ve_emails") || "[]");
  const idx = list.findIndex(e => e.email === email);
  if (idx !== -1) {
    list[idx].alert_enabled = enabled;
    localStorage.setItem("ve_emails", JSON.stringify(list));
    showInlineToast(`Alerts ${enabled ? 'enabled' : 'disabled'} for ${email}.`, 'success');
  }
}

document.getElementById('btnSendEmailTest')?.addEventListener('click', () => {
  const btn = document.getElementById('btnSendEmailTest');
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
  btn.disabled = true;
  
  setTimeout(() => {
    showInlineToast('Test email notification alerts dispatched successfully to verified lists!', 'success');
    btn.innerHTML = '<i class="fas fa-paper-plane"></i> Send Test Alert to All';
    btn.disabled = false;
  }, 1200);
});

// Clock Display
function updateClock() {
  const el = document.getElementById("timeDisplay");
  if (!el) return;
  const now = new Date();
  el.textContent = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
setInterval(updateClock, 1000);
updateClock();

// Inline toast helper
function showInlineToast(message, type = "info") {
  const container = document.getElementById("toastContainer");
  if (!container) return;
  const icons = { success: "✅", error: "❌", info: "ℹ️", warning: "⚠️" };
  const toast = document.createElement("div");
  toast.className = `toast ${type === "error" ? "high" : type === "warning" ? "medium" : "low"}`;
  toast.innerHTML = `
    <div class="toast-icon">${icons[type] || "ℹ️"}</div>
    <div><div class="toast-title">${message}</div></div>
    <button class="toast-close" onclick="this.parentElement.remove()">✕</button>
  `;
  container.prepend(toast);
  setTimeout(() => { if (toast.parentElement) toast.remove(); }, 4000);
}

// ══════════════════════════════════════════════
// INITIALIZATION ON LOAD
// ══════════════════════════════════════════════
document.addEventListener("DOMContentLoaded", () => {
  loadCameras();
  switchSection("cameras");
  initThemeCustomization();

  // Apply saved theme
  const settings = JSON.parse(localStorage.getItem("ve_settings"));
  applyTheme(settings.theme || "dark");

  // Hook nav item click listeners
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
    showInlineToast("Refreshing System Feeds...", "info");
    
    loadCameras();
    
    if (document.getElementById("section-stats").classList.contains("active")) {
      Charts && Charts.loadStats();
    }
    if (document.getElementById("section-events").classList.contains("active")) {
      loadEvents(0);
    }
    if (document.getElementById("section-settings").classList.contains("active")) {
      loadUsers();
    }

    setTimeout(() => { if (icon) icon.classList.remove("fa-spin"); }, 1200);
  });

  // Init EmailJS dummy if key is present
  const pk = document.getElementById('ejs_public_key')?.value;
  if (pk) {
    try {
      emailjs.init(pk);
    } catch(e) {}
  }
});
