(() => {
  'use strict';

  const UPSTREAM = 'https://oil-price.bangchak.co.th/ApiOilPrice2/th';
  const SOURCES = [
    { name: 'proxy', url: '/api/oil' },
    { name: 'direct', url: UPSTREAM },
  ];
  const REFRESH_MS = 5 * 60 * 1000;
  const TIMEOUT_MS = 12000;
  const CACHE_KEY = 'oil:last-payload';
  const THEME_KEY = 'oil:theme';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  const MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
    'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

  const el = {
    rows: document.getElementById('rows'),
    status: document.getElementById('status'),
    updated: document.getElementById('updated'),
    note: document.getElementById('note'),
    refresh: document.getElementById('refresh'),
    theme: document.getElementById('theme'),
    search: document.getElementById('search'),
    tabs: document.getElementById('tabs'),
  };

  const state = {
    oils: [],
    filter: 'all',
    query: '',
    loading: false,
    nextAt: 0,
  };

  const numberFormat = new Intl.NumberFormat('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const formatPrice = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? numberFormat.format(n) : '—';
  };

  const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

  function formatDate(value) {
    const m = String(value || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!m) return value || '—';
    return `${Number(m[1])} ${MONTHS[Number(m[2]) - 1] || ''} ${m[3]}`;
  }

  function categoryOf(name) {
    if (name.includes('พรีเมียม')) return 'premium';
    if (name.includes('ดีเซล')) return 'diesel';
    if (name.includes('แก๊สโซฮอล์') || name.includes('เบนซิน') || /\bE\d{2}\b/.test(name)) return 'gasohol';
    return 'all';
  }

  function setStatus(text, isError = false) {
    el.status.textContent = text;
    el.status.classList.toggle('is-error', isError);
  }

  async function fetchJson(url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return JSON.parse(await response.text());
    } finally {
      clearTimeout(timer);
    }
  }

  function applyPayload(payload) {
    const row = Array.isArray(payload) ? payload[0] : payload;
    if (!row || !row.OilList) throw new Error('รูปแบบข้อมูลไม่ถูกต้อง');

    const list = typeof row.OilList === 'string' ? JSON.parse(row.OilList) : row.OilList;
    if (!Array.isArray(list)) throw new Error('ไม่พบรายการราคาน้ำมัน');

    const previous = new Map(state.oils.map((oil) => [oil.name, oil.today]));
    const firstLoad = state.oils.length === 0;

    state.oils = list.map((oil) => {
      const today = Number(oil.PriceToday) || 0;
      const yesterday = Number(oil.PriceYesterday) || 0;
      return {
        name: String(oil.OilName || '').trim(),
        logo: String(oil.IconWeb || oil.Icon || ''),
        yesterday,
        today,
        tomorrow: Number(oil.PriceTomorrow) || 0,
        change: round2(today - yesterday),
        category: categoryOf(String(oil.OilName || '')),
      };
    });

    const flash = new Map();
    if (!firstLoad) {
      state.oils.forEach((oil) => {
        const before = previous.get(oil.name);
        if (before === undefined) return;
        const delta = round2(oil.today - before);
        if (Math.abs(delta) > 0.004) {
          flash.set(oil.name, { from: before, to: oil.today, up: delta > 0 });
        }
      });
    }

    el.updated.textContent = row.OilPriceDate
      ? `${formatDate(row.OilPriceDate)} ${row.OilPriceTime || ''} น.`
      : '—';

    const notes = [row.OilRemark2, row.OilRemark].filter(Boolean);
    el.note.textContent = notes.join(' · ');
    el.note.hidden = notes.length === 0;

    document.title = row.OilPriceDate
      ? `ราคาน้ำมันบางจาก · ${formatDate(row.OilPriceDate)}`
      : 'ราคาน้ำมันบางจาก';

    render({ animate: firstLoad, flash });
  }

  function render({ animate = false, flash = null } = {}) {
    const query = state.query.trim().toLowerCase();
    const items = state.oils.filter((oil) => {
      if (state.filter !== 'all' && oil.category !== state.filter) return false;
      return !query || oil.name.toLowerCase().includes(query);
    });

    el.rows.textContent = '';
    const priceCells = new Map();

    if (!items.length) {
      const tr = document.createElement('tr');
      tr.className = 'empty';
      const td = document.createElement('td');
      td.colSpan = 5;
      td.textContent = state.oils.length ? 'ไม่พบรายการที่ตรงกัน' : 'ไม่มีข้อมูล';
      tr.appendChild(td);
      el.rows.appendChild(tr);
    } else {
      const fragment = document.createDocumentFragment();
      items.forEach((oil, index) => {
        const tr = buildRow(oil, index, animate);
        if (flash && flash.has(oil.name)) {
          priceCells.set(oil.name, tr.querySelector('.today'));
        }
        fragment.appendChild(tr);
      });
      el.rows.appendChild(fragment);
    }

    if (flash) {
      flash.forEach(({ from, to, up }, name) => {
        const cell = priceCells.get(name);
        if (!cell) return;
        cell.classList.add(up ? 'flash-up' : 'flash-down');
        setTimeout(() => cell.classList.remove('flash-up', 'flash-down'), 1000);
        animatePrice(cell, from, to);
      });
    }

    if (state.oils.length) {
      setStatus(
        items.length === state.oils.length
          ? `${items.length} รายการ`
          : `แสดง ${items.length} จาก ${state.oils.length} รายการ`
      );
    }
  }

  function animatePrice(cell, from, to) {
    if (reduceMotion.matches) {
      cell.textContent = formatPrice(to);
      return;
    }

    const duration = 380;
    const started = performance.now();

    const frame = (now) => {
      if (!cell.isConnected) return;
      const progress = Math.min(1, (now - started) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      cell.textContent = formatPrice(from + (to - from) * eased);
      if (progress < 1) requestAnimationFrame(frame);
      else cell.textContent = formatPrice(to);
    };

    requestAnimationFrame(frame);
  }

  function fuelDot() {
    const dot = document.createElement('span');
    dot.className = 'fuel-dot';
    dot.setAttribute('aria-hidden', 'true');
    return dot;
  }

  function buildRow(oil, index = 0, animate = false) {
    const tr = document.createElement('tr');
    tr.dataset.category = oil.category;
    tr.dataset.name = oil.name;

    if (animate) {
      tr.classList.add('row-in');
      tr.style.animationDelay = `${Math.min(index * 18, 180)}ms`;
    }

    const name = document.createElement('td');
    if (oil.logo) {
      const logo = document.createElement('img');
      logo.className = 'fuel-logo';
      logo.src = oil.logo;
      logo.alt = '';
      logo.width = 54;
      logo.height = 22;
      logo.decoding = 'async';
      logo.addEventListener('error', () => logo.replaceWith(fuelDot()));
      name.appendChild(logo);
    } else {
      name.appendChild(fuelDot());
    }
    name.appendChild(document.createTextNode(oil.name));

    const yesterday = document.createElement('td');
    yesterday.className = 'num';
    yesterday.dataset.label = 'เมื่อวาน';
    yesterday.textContent = formatPrice(oil.yesterday);

    const today = document.createElement('td');
    today.className = 'num today';
    today.textContent = formatPrice(oil.today);

    const tomorrow = document.createElement('td');
    tomorrow.className = 'num';
    tomorrow.dataset.label = 'พรุ่งนี้';
    tomorrow.textContent = formatPrice(oil.tomorrow);

    const change = document.createElement('td');
    change.className = 'num';
    if (oil.change > 0) {
      change.classList.add('up');
      change.textContent = `+${formatPrice(oil.change)}`;
    } else if (oil.change < 0) {
      change.classList.add('down');
      change.textContent = `−${formatPrice(Math.abs(oil.change))}`;
    } else {
      change.classList.add('flat');
      change.textContent = '—';
    }

    tr.append(name, yesterday, today, tomorrow, change);
    return tr;
  }

  function loadCached() {
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      if (!cached || !cached.payload) return false;
      applyPayload(cached.payload);
      return true;
    } catch {
      return false;
    }
  }

  function saveCache(payload) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), payload }));
    } catch {
      /* storage unavailable */
    }
  }

  function errorMessage() {
    if (location.protocol === 'file:') {
      return 'เปิดไฟล์โดยตรงไม่ได้ · รัน node server.js แล้วเปิด http://localhost:3000';
    }
    return 'โหลดไม่สำเร็จ · ตรวจว่ารันผ่าน node server.js ที่ http://localhost:3000';
  }

  async function load() {
    if (state.loading) return;
    state.loading = true;
    el.refresh.disabled = true;
    el.refresh.classList.add('is-loading');
    if (!state.oils.length) setStatus('กำลังโหลด…');

    const errors = [];
    let payload = null;

    for (const source of SOURCES) {
      try {
        payload = await fetchJson(source.url);
        break;
      } catch (error) {
        errors.push(`${source.name}: ${error.message}`);
      }
    }

    if (payload) {
      try {
        applyPayload(payload);
        saveCache(payload);
      } catch (error) {
        errors.push(error.message);
        payload = null;
      }
    }

    if (!payload) {
      el.status.title = errors.join('\n');
      if (state.oils.length) {
        setStatus('อัปเดตไม่สำเร็จ · แสดงข้อมูลล่าสุด', true);
      } else {
        setStatus(errorMessage(), true);
        el.updated.textContent = '—';
      }
    }

    state.loading = false;
    el.refresh.disabled = false;
    el.refresh.classList.remove('is-loading');
    state.nextAt = Date.now() + REFRESH_MS;
  }

  function applyTheme(theme, persist) {
    const dark = theme === 'dark';
    document.documentElement.dataset.theme = theme;
    el.theme.textContent = dark ? 'โหมดสว่าง' : 'โหมดมืด';
    el.theme.setAttribute('aria-label', dark ? 'เปลี่ยนเป็นโหมดสว่าง' : 'เปลี่ยนเป็นโหมดมืด');

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', dark ? '#111111' : '#ffffff');

    if (persist) {
      try {
        localStorage.setItem(THEME_KEY, theme);
      } catch {
        /* storage unavailable */
      }
    }
  }

  function initTheme() {
    applyTheme(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light', false);

    el.theme.addEventListener('click', () => {
      const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      applyTheme(next, true);
    });

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    if (media.addEventListener) {
      media.addEventListener('change', (event) => {
        let saved = null;
        try {
          saved = localStorage.getItem(THEME_KEY);
        } catch {
          /* storage unavailable */
        }
        if (!saved) applyTheme(event.matches ? 'dark' : 'light', false);
      });
    }
  }

  function bindEvents() {
    el.refresh.addEventListener('click', load);

    let timer;    el.search.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        state.query = el.search.value;
        render({ animate: true });
      }, 100);
    });

    el.tabs.addEventListener('click', (event) => {
      const tab = event.target.closest('.tab');
      if (!tab) return;
      state.filter = tab.dataset.filter;
      el.tabs.querySelectorAll('.tab').forEach((button) => {
        const active = button === tab;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-pressed', String(active));
      });
      render({ animate: true });
    });

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && state.nextAt && Date.now() >= state.nextAt) load();
    });
  }

  initTheme();
  loadCached();
  bindEvents();
  load();

  setInterval(() => {
    if (!document.hidden && state.nextAt && Date.now() >= state.nextAt) load();
  }, 30 * 1000);
})();
