/**
 * Vigilant Eye — UX Enhancer
 * =====================================================
 * Pure UI-layer performance and smoothness layer.
 * Does NOT touch any backend, detection, camera, or
 * alert logic. Only adds transitions, animations,
 * and async rendering helpers.
 */
(function () {
  'use strict';

  /* ─────────────────────────────────────────
     1. FOUC (Flash Of Unstyled Content) Guard
     Apply theme from localStorage BEFORE body paints
  ───────────────────────────────────────── */
  (function applyStoredTheme() {
    try {
      const stored = localStorage.getItem('ve_layout_color');
      const storedDash = localStorage.getItem('ve_dashboard_color');
      const storedLayoutFont = localStorage.getItem('ve_layout_font');
      const storedDashFont = localStorage.getItem('ve_dashboard_font');
      const storedLayoutFontSize = localStorage.getItem('ve_layout_font_size');
      const storedDashFontSize = localStorage.getItem('ve_dashboard_font_size');
      const root = document.documentElement;
      if (stored)               root.style.setProperty('--header-color', stored);
      if (storedDash)           root.style.setProperty('--dashboard-bg', storedDash);
      if (storedLayoutFont)     root.style.setProperty('--font-family-layout', storedLayoutFont);
      if (storedDashFont)       root.style.setProperty('--font-family-dashboard', storedDashFont);
      if (storedLayoutFontSize) root.style.setProperty('--font-size-layout', storedLayoutFontSize + 'px');
      if (storedDashFontSize)   root.style.setProperty('--font-size-dashboard', storedDashFontSize + 'px');
    } catch (e) { /* ignore */ }
  })();


  /* ─────────────────────────────────────────
     2. Page Entry Fade-In
     Body enters with a smooth opacity transition
  ───────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', function () {
    document.body.style.opacity = '0';
    document.body.style.transition = 'opacity 0.3s ease';
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document.body.style.opacity = '1';
      });
    });
  });


  /* ─────────────────────────────────────────
     3. Page-Level Loading Overlay
     Blocks blank screen during initial resource load
  ───────────────────────────────────────── */
  function createPageLoader() {
    const loader = document.createElement('div');
    loader.id = 've-page-loader';
    loader.style.cssText = `
      position: fixed; inset: 0; z-index: 99999;
      background: var(--bg-primary, #0d1a35);
      display: flex; align-items: center; justify-content: center;
      opacity: 1;
      transition: opacity 0.35s ease;
      pointer-events: all;
      will-change: opacity;
    `;
    loader.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;gap:16px;">
        <div style="
          width:48px;height:48px;border-radius:50%;
          border:3px solid rgba(0,120,255,0.15);
          border-top-color:#00c8ff;
          animation:ve-spin 0.7s linear infinite;
          will-change:transform;
        "></div>
        <div style="font-size:0.78rem;color:rgba(255,255,255,0.3);letter-spacing:2px;text-transform:uppercase;font-family:'Outfit',sans-serif;">
          Loading Dashboard...
        </div>
      </div>
      <style>
        @keyframes ve-spin { to { transform:rotate(360deg); } }
      </style>
    `;
    document.body.prepend(loader);
    return loader;
  }

  document.addEventListener('DOMContentLoaded', function () {
    const loader = document.getElementById('ve-page-loader') || createPageLoader();

    // Hide loader once the page is fully interactive
    function hideLoader() {
      loader.style.opacity = '0';
      loader.style.pointerEvents = 'none';
      setTimeout(() => { loader.remove(); }, 380);
    }

    if (document.readyState === 'complete') {
      setTimeout(hideLoader, 120);
    } else {
      window.addEventListener('load', () => setTimeout(hideLoader, 120));
      // Safety fallback — never block user longer than 2.5s
      setTimeout(hideLoader, 2500);
    }
  });


  /* ─────────────────────────────────────────
     4. Section Navigation — Smooth Transitions
     Wraps the existing switchSection() to add
     fade-out → fade-in between sections.
  ───────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', function () {
    // Wait for dashboard.js to define switchSection
    setTimeout(patchSectionSwitch, 600);
  });

  function patchSectionSwitch() {
    if (typeof window.switchSection !== 'function') return;

    const _original = window.switchSection;
    window.switchSection = function (sectionName) {
      const currentActive = document.querySelector('.section.active');

      if (!currentActive) {
        _original(sectionName);
        return;
      }

      const targetSection = document.getElementById('section-' + sectionName);
      if (!targetSection || targetSection === currentActive) {
        _original(sectionName);
        return;
      }

      // Fade out current
      currentActive.style.transition = 'opacity 0.18s ease, transform 0.18s ease';
      currentActive.style.opacity    = '0';
      currentActive.style.transform  = 'translateY(6px)';
      currentActive.style.pointerEvents = 'none';

      setTimeout(() => {
        _original(sectionName);

        // Fade in new section
        const newActive = document.querySelector('.section.active');
        if (newActive) {
          newActive.style.transition = 'none';
          newActive.style.opacity    = '0';
          newActive.style.transform  = 'translateY(10px)';

          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              newActive.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
              newActive.style.opacity    = '1';
              newActive.style.transform  = 'translateY(0)';
              newActive.style.pointerEvents = '';
            });
          });
        }

        // Reset old section styles
        currentActive.style.transition = '';
        currentActive.style.opacity    = '';
        currentActive.style.transform  = '';
        currentActive.style.pointerEvents = '';

        // Scroll to top of content
        const mainContent = document.getElementById('mainContent');
        if (mainContent) mainContent.scrollTo({ top: 0, behavior: 'smooth' });

      }, 180);
    };
  }


  /* ─────────────────────────────────────────
     5. Button Ripple Effect
     Lightweight CSS ripple on all .btn elements
  ───────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', function () {
    injectRippleStyle();
    attachRippleListeners();

    // Re-attach when new buttons are dynamically added (e.g., camera cards)
    const observer = new MutationObserver(() => attachRippleListeners());
    observer.observe(document.body, { childList: true, subtree: true });
  });

  function injectRippleStyle() {
    const style = document.createElement('style');
    style.textContent = `
      .btn, .btn-sm, .icon-btn { position: relative; overflow: hidden; }
      .ve-ripple {
        position: absolute;
        border-radius: 50%;
        background: rgba(255,255,255,0.18);
        transform: scale(0);
        animation: ve-ripple-anim 0.52s ease-out forwards;
        pointer-events: none;
        will-change: transform, opacity;
      }
      @keyframes ve-ripple-anim {
        to { transform: scale(3.5); opacity: 0; }
      }

      /* Enhanced hover states */
      .btn-primary:active   { transform: translateY(1px) !important; filter: brightness(0.92); }
      .btn-outline:active   { transform: translateY(1px) !important; }
      .btn-outline-danger:active { transform: translateY(1px) !important; }

      /* Nav item — enhanced hover */
      .nav-item {
        transition: background 0.18s cubic-bezier(0.4,0,0.2,1),
                    color 0.18s ease,
                    border-left-color 0.18s ease,
                    transform 0.15s ease !important;
      }
      .nav-item:hover { transform: translateX(3px); }
      .nav-item.active { transform: translateX(0); }

      /* Table rows smooth hover */
      .data-table tbody tr {
        transition: background 0.12s ease;
      }

      /* Camera cards */
      .camera-card {
        transition: transform 0.22s cubic-bezier(0.4,0,0.2,1),
                    box-shadow 0.22s ease,
                    border-color 0.22s ease !important;
      }

      /* Stat cards */
      .stat-card {
        transition: transform 0.2s cubic-bezier(0.4,0,0.2,1),
                    box-shadow 0.2s ease !important;
      }

      /* Smooth theme change — no white flash */
      html {
        transition: background-color 0.3s ease, color 0.3s ease;
      }

      /* Smooth scroll for main content */
      .main-content {
        scroll-behavior: smooth;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
      }

      /* Skeleton loader */
      .ve-skeleton {
        background: linear-gradient(90deg,
          rgba(255,255,255,0.05) 25%,
          rgba(255,255,255,0.1) 50%,
          rgba(255,255,255,0.05) 75%
        );
        background-size: 200% 100%;
        animation: ve-skeleton-wave 1.4s ease-in-out infinite;
        border-radius: 6px;
        display: inline-block;
      }
      @keyframes ve-skeleton-wave {
        0%   { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }

      /* Alert items entrance */
      .alert-item {
        transition: background 0.15s ease, transform 0.15s ease !important;
      }

      /* Toggle switches */
      .toggle-slider {
        transition: background 0.22s ease !important;
      }

      /* Modal */
      .modal-overlay {
        animation: ve-modal-overlay-in 0.2s ease forwards;
      }
      @keyframes ve-modal-overlay-in {
        from { opacity: 0; }
        to   { opacity: 1; }
      }

      /* Settings instant open — no jank */
      #section-settings {
        will-change: opacity, transform;
      }

      /* Logout button */
      .logout-btn {
        transition: color 0.18s ease, background 0.18s ease !important;
      }
    `;
    document.head.appendChild(style);
  }

  function attachRippleListeners() {
    document.querySelectorAll('.btn, .btn-sm, .icon-btn').forEach(btn => {
      if (btn.dataset.veRipple) return;
      btn.dataset.veRipple = '1';
      btn.addEventListener('mousedown', function (e) {
        const rect = this.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height) * 1.6;
        const x    = e.clientX - rect.left - size / 2;
        const y    = e.clientY - rect.top  - size / 2;
        const ripple = document.createElement('span');
        ripple.className = 've-ripple';
        ripple.style.cssText = `width:${size}px;height:${size}px;left:${x}px;top:${y}px;`;
        this.appendChild(ripple);
        ripple.addEventListener('animationend', () => ripple.remove());
      });
    });
  }


  /* ─────────────────────────────────────────
     6. Smooth Scrolling for Tables & Lists
  ───────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('.alerts-list, .table-wrap, .thumb-list').forEach(el => {
      el.style.scrollBehavior = 'smooth';
    });
  });


  /* ─────────────────────────────────────────
     7. Event Table — Batch DOM Insertions
     Prevents long blocking paints when rendering
     many rows. Uses rAF to batch writes.
  ───────────────────────────────────────── */
  const _originalRenderRows = null; // hook set below
  window.veRenderTableBatched = function (tbody, rows, renderFn) {
    if (!tbody || !rows || !rows.length) return;
    const BATCH = 15;
    tbody.innerHTML = '';
    let idx = 0;

    function paintBatch() {
      const end = Math.min(idx + BATCH, rows.length);
      const frag = document.createDocumentFragment();
      for (; idx < end; idx++) {
        frag.appendChild(renderFn(rows[idx]));
      }
      tbody.appendChild(frag);
      if (idx < rows.length) requestAnimationFrame(paintBatch);
    }
    requestAnimationFrame(paintBatch);
  };


  /* ─────────────────────────────────────────
     8. SocketIO Stats — Debounce Re-renders
     Prevents excessive DOM churn from rapid
     socket events by batching to one rAF tick.
  ───────────────────────────────────────── */
  let _statsPending = false;
  window.veScheduleStatsUpdate = function (callback) {
    if (_statsPending) return;
    _statsPending = true;
    requestAnimationFrame(() => {
      _statsPending = false;
      callback();
    });
  };


  /* ─────────────────────────────────────────
     9. Settings Prefetch
     Fire /api/settings in background 1.5s after
     load so settings panel opens instantly.
  ───────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', function () {
    setTimeout(() => {
      if (window._veSettingsPrefetched) return;
      fetch('/api/settings', { credentials: 'same-origin' })
        .then(r => r.json())
        .then(data => { window._veCachedSettings = data; window._veSettingsPrefetched = true; })
        .catch(() => {});
    }, 1500);
  });


  /* ─────────────────────────────────────────
     10. Camera MJPEG — Memory Management
     Clears src of inactive stream imgs to
     prevent zombie HTTP connections.
  ───────────────────────────────────────── */
  window.veReleaseCameraStream = function (imgEl) {
    if (!imgEl) return;
    // Replace with blank so browser drops the TCP connection
    imgEl.src = 'about:blank';
    imgEl.removeAttribute('src');
  };


  /* ─────────────────────────────────────────
     11. Topbar Clock — rAF-based (no setInterval drift)
  ───────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', function () {
    const clockEl = document.getElementById('timeDisplay');
    if (!clockEl) return;

    let lastStr = '';
    function tick() {
      const now = new Date();
      const str = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      if (str !== lastStr) {
        clockEl.textContent = str;
        lastStr = str;
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  });


  /* ─────────────────────────────────────────
     12. Theme Toggle — No White Flash
     When toggling dark/light, temporarily lock
     background-color so it doesn't flash.
  ───────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', function () {
    const themeBtn = document.getElementById('themeToggleBtn');
    if (!themeBtn) return;

    themeBtn.addEventListener('click', function () {
      // Prevent flash by locking body bg during transition
      const body = document.body;
      body.style.transition = 'background-color 0.3s ease, color 0.3s ease';

      // The existing theme toggle in dashboard.js will fire after this
      // Our CSS transition handles the smooth change
    });
  });


  /* ─────────────────────────────────────────
     13. Sidebar Toggle — Smooth Width Transition
     Ensure sidebar collapse never causes a jarring
     jump in the main content margin.
  ───────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', function () {
    const mainContent = document.getElementById('mainContent');
    const sidebarToggle = document.getElementById('sidebarToggle');
    if (!sidebarToggle || !mainContent) return;

    sidebarToggle.addEventListener('click', function () {
      mainContent.style.transition = 'margin-left 0.3s cubic-bezier(0.4,0,0.2,1)';
    });
  });


  /* ─────────────────────────────────────────
     14. Smooth Alert Badge Updates
     When alert count changes, animate the badge
     without layout shift.
  ───────────────────────────────────────── */
  window.veAnimateBadge = function (badgeEl, newCount) {
    if (!badgeEl) return;
    if (badgeEl.textContent === String(newCount)) return;

    badgeEl.style.transition = 'transform 0.2s cubic-bezier(0.4,0,0.2,1), opacity 0.2s ease';
    badgeEl.style.transform  = 'scale(0.7)';
    badgeEl.style.opacity    = '0.4';

    setTimeout(() => {
      badgeEl.textContent = newCount;
      badgeEl.style.transform = 'scale(1)';
      badgeEl.style.opacity   = '1';
    }, 160);
  };


  /* ─────────────────────────────────────────
     15. Expandable Panels — Smooth height
     Re-patch any expandable panels that open
     instantly without animation.
  ───────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', function () {
    // Existing toggleExpand in dashboard.js handles panels; our CSS handles animation.
    // Ensure panels start closed without overriding CSS stylesheet rules.
    document.querySelectorAll('.expandable-panel').forEach(panel => {
      if (!panel.classList.contains('open')) {
        panel.style.maxHeight  = '';
        panel.style.opacity    = '';
        panel.style.overflow   = '';
      }
    });
  });

})();
