/**
 * Vigilant Eye — Alert System JS
 * Real-time alerts via SocketIO + sound + toast notifications
 */

const AlertSystem = (() => {
  let socket = null;
  let alertCount = 0;
  let soundEnabled = true;
  let volume = 0.8;
  let audioCtx = null;
  let trainingStartTime = null;

  // ── Connect SocketIO (Mocked for Client-Side Demo) ──
  function init() {
    socket = {
      on: function(event, callback) {
        if (!this.callbacks) this.callbacks = {};
        if (!this.callbacks[event]) this.callbacks[event] = [];
        this.callbacks[event].push(callback);
      },
      emit: function(event, data) {
        console.log("Mock Socket Emit:", event, data);
        if (event === "request_stats") {
          // Trigger a mock stats update callback if registered
          if (this.callbacks && this.callbacks["stats_update"]) {
            // Get stats from database mockup
            const stats = typeof EventManager !== 'undefined' ? EventManager.getStats() : {
              total_alerts: alertCount,
              today_alerts: alertCount,
              accuracy: 94,
              active_cameras: 1
            };
            this.callbacks["stats_update"].forEach(cb => cb(stats));
          }
        }
      },
      trigger: function(event, data) {
        if (this.callbacks && this.callbacks[event]) {
          this.callbacks[event].forEach(cb => cb(data));
        }
      },
      callbacks: {}
    };

    console.log("Mock SocketIO initialized.");
    setTimeout(() => {
      if (socket.trigger) socket.trigger("connect");
    }, 100);
    
    socket.on("new_alert", onNewAlert);
    socket.on("training_progress", onTrainingProgress);
    socket.on("extraction_progress", onExtractionProgress);
    socket.on("stats_update", (data) => {
      if (typeof Charts !== 'undefined' && Charts.updateStats) {
        Charts.updateStats(data);
      }
    });
  }

  // ── Handle incoming alert ──
  function onNewAlert(data) {
    alertCount++;
    updateBadge();
    showToast(data);
    addToAlertsList(data);
    if (soundEnabled) playAlertSound();
    flashCameraCard(data.camera_id);
    updateNotifDot(true);
    // Real-time chart update trigger
    if (socket) socket.emit("request_stats");
  }

  // ── Toast notification ──
  function showToast(data) {
    const container = document.getElementById("toastContainer");
    if (!container) return;
    const severityIcon = { high: "🔴", medium: "🟠", low: "🟡" };
    const toast = document.createElement("div");
    toast.className = `toast ${data.severity || "medium"}`;
    toast.innerHTML = `
      <div class="toast-icon">${severityIcon[data.severity] || "⚠️"}</div>
      <div>
        <div class="toast-title">⚠ ${data.activity_type}</div>
        <div class="toast-body">
          📹 ${data.camera_name} &nbsp;·&nbsp; ${data.confidence}% confidence<br>
          🕒 ${formatTime(data.timestamp)}
        </div>
      </div>
      <button class="toast-close" onclick="this.parentElement.remove()">✕</button>
    `;
    container.prepend(toast);
    setTimeout(() => { if (toast.parentElement) toast.remove(); }, 8000);
  }

  // ── Add to alerts panel list ──
  function addToAlertsList(data) {
    const list = document.getElementById("alertsList");
    if (!list) return;

    // Remove empty state
    const empty = list.querySelector(".empty-state");
    if (empty) empty.remove();

    const sevColors = { high: "🔴", medium: "🟠", low: "🟡" };
    const item = document.createElement("div");
    item.className = `alert-item severity-${data.severity || "medium"}`;
    item.dataset.eventId = data.event_id;
    item.innerHTML = `
      <div class="alert-sev-icon ${data.severity || "medium"}">${sevColors[data.severity] || "⚠"}</div>
      <div class="alert-info">
        <div class="alert-type">${data.activity_type}</div>
        <div class="alert-meta">📹 ${data.camera_name} &nbsp;&nbsp; Event: ${data.event_uid || ""}</div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
        <span class="alert-conf">${data.confidence}%</span>
        <span class="alert-time">${formatTime(data.timestamp)}</span>
      </div>
      ${data.snapshot_path ? `<button class="btn-sm" onclick="AlertSystem.viewSnapshot('${data.snapshot_path}', '${data.activity_type}', '${data.camera_name}', '${formatTime(data.timestamp)}')">📸</button>` : ""}
    `;
    list.prepend(item);

    // Keep max 50 items
    const items = list.querySelectorAll(".alert-item");
    if (items.length > 50) items[items.length - 1].remove();
  }

  // ── Flash camera card on alert ──
  function flashCameraCard(cameraId) {
    const card = document.querySelector(`[data-camera-id="${cameraId}"]`);
    if (!card) return;
    card.classList.add("alert-flash");
    setTimeout(() => card.classList.remove("alert-flash"), 5000);
  }

  // ── Badge counter ──
  function updateBadge() {
    const badge = document.getElementById("alertBadge");
    if (badge) {
      badge.textContent = alertCount;
      badge.classList.add("animate");
      setTimeout(() => badge.classList.remove("animate"), 500);
    }
  }

  function updateNotifDot(show) {
    const dot = document.getElementById("notifDot");
    if (dot) dot.style.display = show ? "block" : "none";
  }

  // ── Alert sound (Web Audio API) ──
  function playAlertSound() {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      
      const tone = document.getElementById("toneSelect")?.value || "beep";
      const vol = parseFloat(document.getElementById("volumeSlider")?.value || 80) / 100;

      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      if (tone === "alarm") {
        oscillator.type = "sawtooth";
        oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.5);
        gainNode.gain.setValueAtTime(vol * 0.4, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.6);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.6);
      } else if (tone === "chime") {
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(1047, audioCtx.currentTime);
        oscillator.frequency.setValueAtTime(1319, audioCtx.currentTime + 0.15);
        oscillator.frequency.setValueAtTime(1568, audioCtx.currentTime + 0.3);
        gainNode.gain.setValueAtTime(vol * 0.3, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.5);
      } else {
        // Beep
        oscillator.type = "square";
        oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
        gainNode.gain.setValueAtTime(vol * 0.2, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.2);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.2);
      }
    } catch (e) {
      console.warn("Audio play failed:", e);
    }
  }

  // ── View snapshot modal ──
  function viewSnapshot(path, activityType, cameraName, timestamp) {
    const modal = document.getElementById("snapshotModal");
    const img = document.getElementById("snapshotImg");
    const info = document.getElementById("snapshotInfo");
    if (!modal || !img) return;
    
    if (path.startsWith("data:") || path.startsWith("http")) {
      img.src = path;
    } else {
      img.src = path.replace(/\\/g, "/").replace(/^\//, "");
    }
    
    img.onerror = () => { 
      img.src = ""; 
      img.alt = "Snapshot unavailable"; 
    };
    info.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:0.85rem">
        <div><span style="color:var(--text-muted)">Activity:</span> <b>${activityType}</b></div>
        <div><span style="color:var(--text-muted)">Camera:</span> <b>${cameraName}</b></div>
        <div><span style="color:var(--text-muted)">Time:</span> <b>${timestamp}</b></div>
      </div>
    `;
    modal.style.display = "flex";
  }

  // ── Training time state ──
  let _trainTicker = null;          // setInterval handle for live countdown
  let _trainMsPerEpoch = 0;         // rolling avg ms per epoch
  let _trainMsRemaining = 0;        // last calculated ms remaining
  let _trainTotalEpochs = 0;        // total epochs in this run

  // ── Format ms as "X hr Y min" / "X min Y sec" / "< 1 sec" ──
  function _fmtDuration(ms) {
    if (ms <= 0) return '< 1 sec';
    const totalSecs = Math.floor(ms / 1000);
    const hrs  = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    if (hrs > 0)  return `${hrs} hr ${mins} min`;
    if (mins > 0) return `${mins} min ${secs} sec`;
    return `${secs} sec`;
  }

  // ── Tick every second to update countdown cards live ──
  function _startTicker() {
    _stopTicker();
    _trainTicker = setInterval(() => {
      if (!trainingStartTime) return;

      const elapsedMs = Date.now() - trainingStartTime;

      // Elapsed
      const elEl = document.getElementById('trainElapsedTime');
      if (elEl) elEl.textContent = _fmtDuration(elapsedMs);

      // Remaining — we subtract 1 second each tick for the countdown feel
      if (_trainMsRemaining > 1000) _trainMsRemaining -= 1000;
      const tlEl = document.getElementById('trainTimeLeft');
      if (tlEl) tlEl.textContent = _fmtDuration(Math.max(0, _trainMsRemaining));

      // ETA
      const etaEl = document.getElementById('trainCompletionTime');
      if (etaEl) {
        const etaDate = new Date(Date.now() + Math.max(0, _trainMsRemaining));
        etaEl.textContent = etaDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
    }, 1000);
  }

  function _stopTicker() {
    if (_trainTicker) { clearInterval(_trainTicker); _trainTicker = null; }
  }

  // ── Training progress handler ──
  function onTrainingProgress(data) {
    const wrap      = document.getElementById('trainingProgressWrap');
    const bar       = document.getElementById('trainingBar');
    const msg       = document.getElementById('trainingMsg');
    const idle      = document.getElementById('trainingIdle');
    const startBtn  = document.getElementById('startTrainingBtn');
    const stopBtn   = document.getElementById('stopTrainingBtn');
    const pctBadge  = document.getElementById('trainProgressPct');
    const epochLbl  = document.getElementById('trainEpochLabel');
    const elapsedEl = document.getElementById('trainElapsedTime');
    const avgEl     = document.getElementById('trainAvgEpochTime');
    const tlEl      = document.getElementById('trainTimeLeft');
    const etaEl     = document.getElementById('trainCompletionTime');
    const pill      = document.getElementById('trainingStatusPill');

    if (!wrap) return;

    if (data.status === 'running' || data.status === 'pending') {
      // ── Show panel ──
      wrap.style.display = 'block';
      if (idle) idle.style.display = 'none';
      if (startBtn) { startBtn.style.display = 'none'; startBtn.disabled = false; startBtn.innerHTML = '<i class="fas fa-play"></i> Start Training'; }
      if (stopBtn)  { stopBtn.style.display = 'block'; stopBtn.disabled = false; stopBtn.innerHTML = '<i class="fas fa-stop"></i> Stop Training'; }

      // ── Progress bar + % ──
      const pct = data.progress || 0;
      if (bar)      bar.style.width = `${pct}%`;
      if (pctBadge) pctBadge.textContent = `${pct}%`;

      // ── Epoch label ──
      if (epochLbl && data.total_epochs) {
        epochLbl.textContent = data.epoch > 0
          ? `Epoch ${data.epoch} / ${data.total_epochs}`
          : `Starting — ${data.total_epochs} epochs total`;
      }

      // ── Status pill ──
      if (pill) {
        pill.className = 'training-active-pill';
        pill.innerHTML = '<span class="pulse-dot"></span> TRAINING';
      }

      // ── Message ──
      if (msg) msg.textContent = data.message || '';

      // ── Time math ──
      // Only set start time once per run
      if ((data.epoch === 0 || data.progress === 0) && !trainingStartTime) {
        trainingStartTime = Date.now();
        _trainTotalEpochs = data.total_epochs || 0;
        _trainMsRemaining = 0;
        _trainMsPerEpoch  = 0;
        if (elapsedEl) elapsedEl.textContent = '—';
        if (avgEl)     avgEl.textContent = '—';
        if (tlEl)      tlEl.textContent = '—';
        if (etaEl)     etaEl.textContent = '—';
        _startTicker();
      } else if (data.epoch > 0 && trainingStartTime && data.total_epochs) {
        const elapsedMs      = Date.now() - trainingStartTime;
        _trainMsPerEpoch     = elapsedMs / data.epoch;
        const epochsLeft     = data.total_epochs - data.epoch;
        _trainMsRemaining    = epochsLeft * _trainMsPerEpoch;
        _trainTotalEpochs    = data.total_epochs;

        // Per-epoch avg card
        if (avgEl) avgEl.textContent = _fmtDuration(_trainMsPerEpoch);

        // Kick-start ticker if not yet running (e.g. page reload during training)
        if (!_trainTicker) _startTicker();
      }

    } else if (data.status === 'stopping') {
      // ── Stop requested ──
      const pct = data.progress || 0;
      if (bar)      bar.style.width = `${pct}%`;
      if (pctBadge) pctBadge.textContent = `${pct}%`;
      if (msg)      msg.textContent = 'Stopping — finishing current epoch...';
      if (stopBtn)  { stopBtn.disabled = true; stopBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Stopping...'; }
      if (pill) {
        pill.className = 'stopping-pill';
        pill.innerHTML = '<i class="fas fa-spinner fa-spin" style="font-size:0.65rem"></i> STOPPING';
      }

    } else {
      // ── Terminal: completed / stopped / failed ──
      _stopTicker();
      trainingStartTime = null;
      _trainMsRemaining = 0;

      if (wrap)  wrap.style.display = 'none';
      if (startBtn) { startBtn.style.display = 'block'; startBtn.disabled = false; startBtn.innerHTML = '<i class="fas fa-play"></i> Start Training'; }
      if (stopBtn)  { stopBtn.style.display = 'none';  stopBtn.disabled = false;  stopBtn.innerHTML = '<i class="fas fa-stop"></i> Stop Training'; }

      const isStop = data.status === 'stopped';
      const isFail = data.status === 'failed';

      if (idle) {
        idle.style.display = 'block';
        if (isStop) {
          idle.innerHTML = '<i class="fas fa-check-circle" style="color:var(--orange);margin-right:6px"></i><span style="color:var(--orange)">Stopped Successfully</span>';
        } else if (isFail) {
          idle.textContent = data.message || 'Training failed.';
          idle.style.color = 'var(--red)';
        } else {
          idle.textContent = data.message || 'Training finished.';
          idle.style.color = 'var(--green)';
        }
      }

      if (data.status === 'completed') {
        showToast({ activity_type: 'Training Complete', camera_name: 'AI Model', confidence: '100', severity: 'low', timestamp: new Date().toISOString() });
      } else if (isStop) {
        showToast({ activity_type: 'Training Stopped', camera_name: 'AI Model', confidence: '—', severity: 'medium', timestamp: new Date().toISOString() });
      }

      if (typeof loadTrainingHistory === 'function') loadTrainingHistory();
    }
  }

  // ── Extraction progress handler ──
  function onExtractionProgress(data) {
    const wrap = document.getElementById("extractionProgressWrap");
    const bar = document.getElementById("extractionBar");
    const msg = document.getElementById("extractionMsg");
    if (!wrap) return;

    if (data.status === "running") {
      wrap.style.display = "block";
      if (bar) bar.style.width = `${data.progress || 0}%`;
      if (msg) msg.textContent = data.message || "";
    } else {
      wrap.style.display = "none";
      if (data.status === "completed") {
        showToast(data.message || "Frames added to dataset successfully.", "success");
        // Trigger validation automatically
        const validBtn = document.getElementById("validateDatasetBtn");
        if (validBtn) validBtn.click();
      } else if (data.status === "failed") {
        showToast(data.message || "Extraction failed.", "error");
      }
    }
  }

  // ── Time formatter ──
  function formatTime(ts) {
    if (!ts) return "—";
    const d = new Date(ts);
    return d.toLocaleString("en-US", { month:"short", day:"numeric", hour:"2-digit", minute:"2-digit", second:"2-digit" });
  }

  // ── Load existing alerts (only for current logged-in user) ──
  function loadAlerts() {
    try {
      const curUser = JSON.parse(localStorage.getItem("currentUser") || '{"email":null}');
      const allEvents = JSON.parse(localStorage.getItem("ve_events") || "[]");

      // Filter: only show events that belong to this user (or have no tag = legacy, skip those)
      const events = allEvents.filter(e => e.user_email && e.user_email === curUser.email);

      if (!events.length) return;
      events.forEach(e => addToAlertsList({
        event_id: e.event_id || e.id,
        event_uid: e.event_uid,
        camera_id: e.camera_id,
        camera_name: e.camera_name,
        activity_type: e.activity_type,
        confidence: e.confidence,
        severity: e.severity,
        snapshot_path: e.snapshot_path,
        timestamp: e.timestamp,
      }));
      alertCount = events.length;
      updateBadge();
    } catch(err) {
      console.warn("Local alerts load error:", err);
    }
  }

  return { init, playAlertSound, formatTime, viewSnapshot, loadAlerts, addToAlertsList };
})();

// Initialize on DOM ready
document.addEventListener("DOMContentLoaded", () => {
  AlertSystem.init();

  // Volume slider
  const vol = document.getElementById("volumeSlider");
  const volVal = document.getElementById("volVal");
  if (vol) vol.addEventListener("input", () => { if (volVal) volVal.textContent = vol.value + "%"; });

  // Sound toggle
  document.getElementById("soundToggle")?.addEventListener("change", function() {
    soundEnabled = this.checked;
  });

  // Test sound button
  document.getElementById("testSoundBtn")?.addEventListener("click", AlertSystem.playAlertSound);

  // Test alert button (Mocked)
  document.getElementById("testAlertBtn")?.addEventListener("click", () => {
    const curUser = JSON.parse(localStorage.getItem("currentUser") || '{"email":"demo"}');
    const alertData = {
      event_id: Date.now(),
      event_uid: "EV-" + Math.floor(Math.random() * 9000 + 1000),
      camera_id: 1,
      camera_name: "Local Webcam / Mobile Feed",
      activity_type: "Test Panel Security Event Triggered",
      confidence: 97,
      severity: "low",
      timestamp: Date.now() / 1000,
      snapshot_path: "",
      user_email: curUser.email  // tag with current user
    };
    
    // Save to event list
    const localEvents = JSON.parse(localStorage.getItem("ve_events") || "[]");
    localEvents.unshift(alertData);
    localStorage.setItem("ve_events", JSON.stringify(localEvents));

    AlertSystem.onNewAlert(alertData);
  });

  // Clear alerts
  document.getElementById("clearAlertsBtn")?.addEventListener("click", () => {
    const list = document.getElementById("alertsList");
    if (list) {
      list.innerHTML = '<div class="empty-state"><i class="fas fa-shield-alt"></i><p>Cleared. System monitoring actively.</p></div>';
      alertCount = 0;
      const badge = document.getElementById("alertBadge");
      if (badge) badge.textContent = "0";
    }
  });

  // Close modal on overlay click
  document.querySelectorAll(".modal-overlay").forEach(overlay => {
    overlay.addEventListener("click", function(e) {
      if (e.target === this) this.style.display = "none";
    });
  });

  // Global alerts toggle
  document.getElementById("globalAlertsToggle")?.addEventListener("change", function() {
    try {
      const settings = JSON.parse(localStorage.getItem("ve_settings") || "{}");
      settings.global_alerts_enabled = this.checked ? "true" : "false";
      localStorage.setItem("ve_settings", JSON.stringify(settings));
      console.log("Global alerts settings toggled:", this.checked);
    } catch (e) {}
  });

  AlertSystem.loadAlerts();
});

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = "none";
}
