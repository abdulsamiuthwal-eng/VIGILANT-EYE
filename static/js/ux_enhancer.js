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
      const stored = localStorage.getItem('header_color') || localStorage.getItem('ve_header_color') || localStorage.getItem('ve_layout_color');
      const storedDash = localStorage.getItem('dashboard_bg') || localStorage.getItem('ve_dashboard_bg') || localStorage.getItem('ve_dashboard_color');
      const storedThemeKey = localStorage.getItem('ve_dash_theme_key');
      const storedLayoutFont = localStorage.getItem('ve_layout_font');
      const storedDashFont = localStorage.getItem('ve_dashboard_font');
      const storedLayoutFontSize = localStorage.getItem('ve_layout_font_size');
      const storedDashFontSize = localStorage.getItem('ve_dashboard_font_size');
      const root = document.documentElement;
      if (storedThemeKey)       root.setAttribute('data-dash-theme', storedThemeKey);
      if (stored)               root.style.setProperty('--header-color', stored);
      if (storedDash)           root.style.setProperty('--dashboard-bg', storedDash);
      if (storedLayoutFont)     root.style.setProperty('--font-family-layout', storedLayoutFont);
      if (storedDashFont)       root.style.setProperty('--font-family-dashboard', storedDashFont);
      if (storedLayoutFontSize) root.style.setProperty('--font-size-layout', storedLayoutFontSize + 'px');
      if (storedDashFontSize)   root.style.setProperty('--font-size-dashboard', storedDashFontSize + 'px');
    } catch (e) { /* ignore */ }
  })();


  /* ─────────────────────────────────────────
     2. Page Entry — handled by Global Skeleton Loader (section 3)
     Body starts visible; skeleton overlay covers until ready.
  ───────────────────────────────────────── */
  // (Body opacity fade-in removed — global loader handles entry UX)


  /* ─────────────────────────────────────────
     3. Global Page-Load Skeleton Controller
     Shows the full-viewport skeleton immediately.
     Hides once: DOM is ready + cameras API resolves.
     Safety cap: always hides within 3.5s max.
  ───────────────────────────────────────── */
  (function () {
    let _dismissed = false;

    function dismissLoader() {
      if (_dismissed) return;
      _dismissed = true;

      const loader = document.getElementById('ve-global-loader');
      if (!loader) return;

      loader.classList.add('ve-gl-hidden');

      // Remove from DOM after the CSS transition ends (450ms)
      setTimeout(function () {
        if (loader.parentNode) loader.parentNode.removeChild(loader);
      }, 500);
    }

    // Apply theme to the loader so it matches current theme instantly
    (function syncLoaderTheme() {
      const loader = document.getElementById('ve-global-loader');
      if (!loader) return;
      const theme = document.documentElement.getAttribute('data-theme') || 'dark';
      if (theme === 'light') {
        loader.style.background = '#F2F2F2';
        const sidebar = loader.querySelector('.ve-gl-sidebar');
        if (sidebar) sidebar.style.background = '#E6ECE1';
        const topbar = loader.querySelector('.ve-gl-topbar');
        if (topbar) topbar.style.background = '#E6ECE1';
      }
    })();

    // Fire dismiss after DOM + cameras API fetch completes
    document.addEventListener('DOMContentLoaded', function () {
      // Intercept the cameras fetch that dashboard.js will make
      const _originalFetch = window.fetch;
      let _camerasResolved = false;

      window.fetch = function (url) {
        const p = _originalFetch.apply(this, arguments);
        if (typeof url === 'string' && url.includes('/api/cameras')) {
          p.then(function () {
            _camerasResolved = true;
            dismissLoader();
          }).catch(function () {
            dismissLoader(); // dismiss even on error
          });
        }
        return p;
      };

      // Fallback: dismiss after 1.5s even if cameras never fire
      setTimeout(dismissLoader, 1500);
    });

    // Absolute hard cap: never block UI longer than 3.5s
    setTimeout(dismissLoader, 3500);
  })();


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


  /* ─────────────────────────────────────────
     16. Agency-Grade Custom Select Dropdowns
     Replaces raw OS popup menus with fluid
     floating glassmorphism dropdown menus
     across Alert Panel, Event Logs, AI Training,
     Settings, and Cameras tabs.
  ───────────────────────────────────────── */
  function enhanceSelect(select) {
    if (!select || select._customSelectInit) return;
    if (select.closest('#videoUploadInput') || select.style.display === 'none') return;

    select._customSelectInit = true;
    select.classList.add('cs-hidden');

    const wrapper = document.createElement('div');
    wrapper.className = 'cs-wrapper';
    if (select.style.width === '100%' || select.classList.contains('w-full') || select.id === 'camType' || select.id === 'videoFpsSelect') {
      wrapper.classList.add('w-full');
    }
    if (select.id) wrapper.dataset.for = select.id;

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'cs-trigger';
    if (select.style.width && select.style.width !== '100%') {
      trigger.style.width = select.style.width;
    }
    if (select.title) trigger.title = select.title;

    const label = document.createElement('span');
    label.className = 'cs-label';

    const chevron = document.createElement('i');
    chevron.className = 'fas fa-chevron-down cs-chevron';

    trigger.appendChild(label);
    trigger.appendChild(chevron);

    const menu = document.createElement('div');
    menu.className = 'cs-menu';

    wrapper.appendChild(trigger);
    wrapper.appendChild(menu);

    select.parentNode.insertBefore(wrapper, select);
    wrapper.appendChild(select);

    function buildOptions() {
      menu.innerHTML = '';
      const options = Array.from(select.options);
      const selectedOpt = select.selectedOptions[0] || options[0];

      label.textContent = selectedOpt ? selectedOpt.text : 'Select...';

      options.forEach(opt => {
        const item = document.createElement('div');
        item.className = 'cs-option' + (opt.selected ? ' is-selected' : '');
        item.dataset.value = opt.value;

        // Visual preview if font dropdown
        if (select.id && select.id.toLowerCase().includes('font')) {
          item.style.fontFamily = opt.value;
        }

        const itemText = document.createElement('span');
        itemText.className = 'cs-option-text';
        itemText.textContent = opt.text;

        const itemCheck = document.createElement('i');
        itemCheck.className = 'fas fa-check cs-check';

        item.appendChild(itemText);
        item.appendChild(itemCheck);

        item.addEventListener('click', (e) => {
          e.stopPropagation();
          select.value = opt.value;
          label.textContent = opt.text;
          menu.querySelectorAll('.cs-option').forEach(el => el.classList.remove('is-selected'));
          item.classList.add('is-selected');
          closeMenu();

          // Dispatch standard change and input events
          select.dispatchEvent(new Event('change', { bubbles: true }));
          select.dispatchEvent(new Event('input', { bubbles: true }));
        });

        menu.appendChild(item);
      });
    }

    function elevateParentContainers(el) {
      let curr = el.parentElement;
      while (curr && curr !== document.body) {
        if (curr.classList.contains('sound-controls') ||
            curr.classList.contains('section-header') ||
            curr.classList.contains('filter-row') ||
            curr.classList.contains('setting-row') ||
            curr.classList.contains('card-panel') ||
            curr.classList.contains('card-mini') ||
            curr.classList.contains('camera-controls') ||
            curr.classList.contains('form-group')) {
          curr.dataset.prevZIndex = curr.style.zIndex || '';
          curr.dataset.prevPos = curr.style.position || '';
          curr.style.zIndex = '999999';
          if (window.getComputedStyle(curr).position === 'static') {
            curr.style.position = 'relative';
          }
        }
        curr = curr.parentElement;
      }
    }

    function resetParentElevations(el) {
      let curr = el.parentElement;
      while (curr && curr !== document.body) {
        if (curr.classList.contains('sound-controls') ||
            curr.classList.contains('section-header') ||
            curr.classList.contains('filter-row') ||
            curr.classList.contains('setting-row') ||
            curr.classList.contains('card-panel') ||
            curr.classList.contains('card-mini') ||
            curr.classList.contains('camera-controls') ||
            curr.classList.contains('form-group')) {
          if (!curr.querySelector('.cs-wrapper.is-open')) {
            curr.style.zIndex = curr.dataset.prevZIndex || '';
            if (curr.dataset.prevPos) {
              curr.style.position = curr.dataset.prevPos;
            } else if (curr.style.position === 'relative' && !curr.getAttribute('style')?.includes('position: relative')) {
              curr.style.position = '';
            }
            delete curr.dataset.prevZIndex;
            delete curr.dataset.prevPos;
          }
        }
        curr = curr.parentElement;
      }
    }

    function openMenu() {
      document.querySelectorAll('.cs-wrapper.is-open').forEach(w => {
        if (w !== wrapper) {
          w.classList.remove('is-open');
          resetParentElevations(w);
        }
      });
      wrapper.classList.add('is-open');
      elevateParentContainers(wrapper);
    }

    function closeMenu() {
      wrapper.classList.remove('is-open');
      resetParentElevations(wrapper);
    }

    trigger.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (wrapper.classList.contains('is-open')) {
        closeMenu();
      } else {
        openMenu();
      }
    });

    // Sync if native select changed programmatically
    select.addEventListener('change', () => {
      const selectedOpt = select.selectedOptions[0];
      if (selectedOpt) {
        label.textContent = selectedOpt.text;
        menu.querySelectorAll('.cs-option').forEach(el => {
          el.classList.toggle('is-selected', el.dataset.value === selectedOpt.value);
        });
      }
    });

    // Rebuild options if select innerHTML changes dynamically
    const observer = new MutationObserver(() => {
      buildOptions();
    });
    observer.observe(select, { childList: true, subtree: true });

    buildOptions();
  }

  function initAllCustomSelects() {
    document.querySelectorAll('select.filter-select, select.tone-select, select').forEach(enhanceSelect);
  }

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.cs-wrapper')) {
      document.querySelectorAll('.cs-wrapper.is-open').forEach(w => {
        w.classList.remove('is-open');
        let curr = w.parentElement;
        while (curr && curr !== document.body) {
          if (curr.dataset?.prevZIndex !== undefined) {
            curr.style.zIndex = curr.dataset.prevZIndex;
            curr.style.position = curr.dataset.prevPos || '';
            delete curr.dataset.prevZIndex;
            delete curr.dataset.prevPos;
          }
          curr = curr.parentElement;
        }
      });
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.cs-wrapper.is-open').forEach(w => {
        w.classList.remove('is-open');
        let curr = w.parentElement;
        while (curr && curr !== document.body) {
          if (curr.dataset?.prevZIndex !== undefined) {
            curr.style.zIndex = curr.dataset.prevZIndex;
            curr.style.position = curr.dataset.prevPos || '';
            delete curr.dataset.prevZIndex;
            delete curr.dataset.prevPos;
          }
          curr = curr.parentElement;
        }
      });
    }
  });

  /* ─────────────────────────────────────────
     17. Agency-Grade Cybernetic Toast Engine
     Universal high-end toast popup handler with
     countdown timer bar, gradient badges, and
     hover-to-pause physics.
  ───────────────────────────────────────── */
  window.renderPremiumToast = function (opts) {
    let container = document.getElementById("toastContainer");
    if (!container) {
      container = document.createElement("div");
      container.className = "alert-toast-container";
      container.id = "toastContainer";
      document.body.appendChild(container);
    }

    const message = opts.message || "";
    const type = (opts.type || "info").toLowerCase();
    const duration = opts.duration || (type === "error" ? 6000 : 4200);
    const category = opts.category || (
      type === "success" ? "System Confirmation" :
      type === "error"   ? "Security Notice" :
      type === "warning" ? "System Warning" : "Sentinel Update"
    );
    const bodyHtml = opts.bodyHtml || "";

    const iconMap = {
      success: 'fas fa-check-circle',
      error:   'fas fa-shield-virus',
      warning: 'fas fa-exclamation-triangle',
      info:    'fas fa-info-circle'
    };
    const iconClass = iconMap[type] || 'fas fa-info-circle';

    const toast = document.createElement("div");
    toast.className = `toast toast-${type} ${type === "error" ? "high" : type === "warning" ? "medium" : type === "success" ? "success" : "low"}`;
    toast.setAttribute("role", "alert");

    toast.innerHTML = `
      <div class="toast-accent-bar"></div>
      <div class="toast-icon-badge">
        <i class="${iconClass}"></i>
      </div>
      <div class="toast-content">
        <div class="toast-header-row">
          <span class="toast-category">${category}</span>
        </div>
        <div class="toast-title">${message}</div>
        ${bodyHtml ? `<div class="toast-body">${bodyHtml}</div>` : ''}
      </div>
      <button class="toast-close" title="Dismiss notification" aria-label="Close">
        <i class="fas fa-times"></i>
      </button>
      <div class="toast-progress" style="animation-duration: ${duration}ms;"></div>
    `;

    function dismissToast() {
      if (toast.classList.contains("dismissing")) return;
      toast.classList.add("dismissing");
      setTimeout(() => {
        if (toast.parentElement) toast.remove();
      }, 350);
    }

    const closeBtn = toast.querySelector(".toast-close");
    if (closeBtn) {
      closeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        dismissToast();
      });
    }

    container.prepend(toast);

    let timer = setTimeout(dismissToast, duration);

    toast.addEventListener("mouseenter", () => {
      clearTimeout(timer);
      const prog = toast.querySelector(".toast-progress");
      if (prog) prog.style.animationPlayState = "paused";
    });
    toast.addEventListener("mouseleave", () => {
      const prog = toast.querySelector(".toast-progress");
      if (prog) prog.style.animationPlayState = "running";
      timer = setTimeout(dismissToast, 1800);
    });

    return toast;
  };

  // Expose global showInlineToast and showToast
  window.showInlineToast = function (message, type = "info", duration) {
    const categoryMap = {
      success: "System Confirmation",
      error:   "Security Notice",
      warning: "System Warning",
      info:    "Sentinel Feed"
    };
    return window.renderPremiumToast({
      message,
      type,
      category: categoryMap[type] || "Sentinel Update",
      duration
    });
  };

})();

/* ═══════════════════════════════════════════════════════════════
   PREMIUM GLASSMORPHIC CUSTOM DROPDOWN INITIALIZER
   Converts native <select> elements with class .filter-select
   or .tone-select into custom glassmorphic floating menus.
   Z-index stacking is handled so the menu NEVER gets hidden
   behind lower elements (alert cards, tables, etc).
   ═══════════════════════════════════════════════════════════════ */
(function initPremiumDropdowns() {
  'use strict';

  function buildCustomSelect(nativeSelect) {
    if (!nativeSelect || nativeSelect.dataset.csInit === '1') return;
    nativeSelect.dataset.csInit = '1';

    // Hide native select but keep it in DOM for value sync
    nativeSelect.style.cssText = 'position:absolute;opacity:0;pointer-events:none;width:1px;height:1px;';

    // Create wrapper
    const wrapper = document.createElement('div');
    wrapper.className = 'cs-wrapper';
    if (nativeSelect.style.width === '100%' || nativeSelect.classList.contains('w-full')) {
      wrapper.classList.add('w-full');
    }

    // Create trigger button
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'cs-trigger';
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');

    const triggerLabel = document.createElement('span');
    triggerLabel.className = 'cs-label';

    const triggerChevron = document.createElement('span');
    triggerChevron.className = 'cs-chevron';
    triggerChevron.innerHTML = '<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 4L6 8L10 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

    trigger.appendChild(triggerLabel);
    trigger.appendChild(triggerChevron);

    // Create menu
    const menu = document.createElement('div');
    menu.className = 'cs-menu';
    menu.setAttribute('role', 'listbox');

    // Sync options from native select
    function syncOptions() {
      menu.innerHTML = '';
      Array.from(nativeSelect.options).forEach((opt, i) => {
        const item = document.createElement('div');
        item.className = 'cs-option' + (i === nativeSelect.selectedIndex ? ' is-selected' : '');
        item.dataset.value = opt.value;
        item.setAttribute('role', 'option');
        item.setAttribute('aria-selected', i === nativeSelect.selectedIndex ? 'true' : 'false');

        const checkSpan = document.createElement('span');
        checkSpan.className = 'cs-check';
        checkSpan.innerHTML = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2.5 7L5.5 10L11.5 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

        const labelSpan = document.createElement('span');
        labelSpan.textContent = opt.text;

        item.appendChild(checkSpan);
        item.appendChild(labelSpan);

        item.addEventListener('click', () => {
          // Update native select value
          nativeSelect.value = opt.value;
          nativeSelect.dispatchEvent(new Event('change', { bubbles: true }));

          // Update trigger label
          triggerLabel.textContent = opt.text;

          // Update selected states
          menu.querySelectorAll('.cs-option').forEach((el, j) => {
            el.classList.toggle('is-selected', j === i);
            el.setAttribute('aria-selected', j === i ? 'true' : 'false');
          });

          closeMenu();
        });

        menu.appendChild(item);
      });

      // Set initial label
      const sel = nativeSelect.options[nativeSelect.selectedIndex];
      triggerLabel.textContent = sel ? sel.text : '';
    }

    syncOptions();

    // Watch for dynamic option changes
    const mutObs = new MutationObserver(syncOptions);
    mutObs.observe(nativeSelect, { childList: true });

    // Open / close logic
    function openMenu() {
      closeAllMenus();
      wrapper.classList.add('is-open');
      trigger.setAttribute('aria-expanded', 'true');
      menu.classList.add('is-visible');

      // Elevate parent containers so menu floats above everything
      let el = wrapper.parentElement;
      for (let i = 0; i < 6 && el && el !== document.body; i++) {
        if (!el._csOrigZ) {
          el._csOrigZ = el.style.zIndex || '';
          el._csOrigPos = el.style.position || '';
        }
        el.style.position = el.style.position || 'relative';
        el.style.zIndex = '999999';
        el = el.parentElement;
      }

      // Flip menu upward if no space below
      const trigRect = trigger.getBoundingClientRect();
      const spaceBelow = window.innerHeight - trigRect.bottom;
      if (spaceBelow < 220) {
        menu.style.top = 'auto';
        menu.style.bottom = '100%';
        menu.style.marginBottom = '6px';
        menu.style.marginTop = '0';
      } else {
        menu.style.bottom = 'auto';
        menu.style.top = '100%';
        menu.style.marginTop = '6px';
        menu.style.marginBottom = '0';
      }
    }

    function closeMenu() {
      wrapper.classList.remove('is-open');
      trigger.setAttribute('aria-expanded', 'false');
      menu.classList.remove('is-visible');

      // Restore parent z-index
      let el = wrapper.parentElement;
      for (let i = 0; i < 6 && el && el !== document.body; i++) {
        if (el._csOrigZ !== undefined) {
          el.style.zIndex = el._csOrigZ;
          el.style.position = el._csOrigPos;
          delete el._csOrigZ;
          delete el._csOrigPos;
        }
        el = el.parentElement;
      }
    }

    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      wrapper.classList.contains('is-open') ? closeMenu() : openMenu();
    });

    // Build and insert
    wrapper.appendChild(trigger);
    wrapper.appendChild(menu);
    nativeSelect.parentNode.insertBefore(wrapper, nativeSelect);
    wrapper.appendChild(nativeSelect);
  }

  function closeAllMenus() {
    document.querySelectorAll('.cs-wrapper.is-open').forEach(w => {
      w.classList.remove('is-open');
      const t = w.querySelector('.cs-trigger');
      const m = w.querySelector('.cs-menu');
      if (t) t.setAttribute('aria-expanded', 'false');
      if (m) m.classList.remove('is-visible');

      // Restore parents
      let el = w.parentElement;
      for (let i = 0; i < 6 && el && el !== document.body; i++) {
        if (el._csOrigZ !== undefined) {
          el.style.zIndex = el._csOrigZ;
          el.style.position = el._csOrigPos;
          delete el._csOrigZ;
          delete el._csOrigPos;
        }
        el = el.parentElement;
      }
    });
  }

  document.addEventListener('click', closeAllMenus);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeAllMenus(); });

  function initAll() {
    document.querySelectorAll('select.filter-select, select.tone-select').forEach(sel => {
      buildCustomSelect(sel);
    });
  }

  // Init on DOMContentLoaded or immediately if already loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }

  // Also re-init after section switches (for dynamically shown sections)
  document.addEventListener('click', (e) => {
    const navBtn = e.target.closest('[id^="nav-"]');
    if (navBtn) {
      setTimeout(initAll, 100);
    }
  });

  // Expose globally for manual calls if needed
  window.initPremiumDropdowns = initAll;

})();


