(() => {
  const path = window.location.pathname || '/';
  if (path.startsWith('/client/')) return;

  const SESSION_KEY = 'um_lead_attribution_v1';

  function readState() {
    try {
      return JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null') || {};
    } catch {
      return {};
    }
  }

  function writeState(state) {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(state));
    } catch {
      // Browsing still works if storage is unavailable.
    }
  }

  function clean(value, max = 220) {
    return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
  }

  function externalReferrerOrigin() {
    if (!document.referrer) return '';
    try {
      const ref = new URL(document.referrer);
      return ref.origin === window.location.origin ? '' : ref.origin;
    } catch {
      return '';
    }
  }

  function deviceCategory() {
    const width = window.innerWidth || document.documentElement.clientWidth || 0;
    if (width <= 620) return 'mobile';
    if (width <= 1000) return 'tablet';
    return 'desktop';
  }

  const query = new URLSearchParams(window.location.search);
  const state = readState();

  if (!state.started_at) state.started_at = Date.now();
  if (!state.entry_page) state.entry_page = path;
  if (!state.referrer_origin) state.referrer_origin = externalReferrerOrigin();

  state.utm = state.utm || {
    source: clean(query.get('utm_source'), 100),
    medium: clean(query.get('utm_medium'), 100),
    campaign: clean(query.get('utm_campaign'), 140),
    content: clean(query.get('utm_content'), 140),
    term: clean(query.get('utm_term'), 140)
  };

  state.journey = Array.isArray(state.journey) ? state.journey : [];
  if (state.journey[state.journey.length - 1] !== path) state.journey.push(path);
  state.journey = state.journey.slice(-12);
  writeState(state);

  document.addEventListener('click', (event) => {
    const link = event.target.closest?.('a[href]');
    if (!link) return;

    const href = link.getAttribute('href') || '';
    const label = clean(link.textContent || link.getAttribute('aria-label'), 120);
    let type = 'link';
    let target = '';

    if (/^tel:/i.test(href)) {
      type = 'phone';
      target = 'phone';
    } else if (/^mailto:/i.test(href)) {
      type = 'email';
      target = 'email';
    } else {
      try {
        const url = new URL(href, window.location.href);
        target = url.origin === window.location.origin ? url.pathname : url.origin;
        if (/\/(?:book|book-business|book-smart-home)\.html$/i.test(url.pathname)) type = 'booking';
        else if (link.classList.contains('button') || link.classList.contains('nav-cta')) type = 'primary_cta';
        else if (link.classList.contains('text-link')) type = 'service_link';
        else if (url.origin !== window.location.origin) type = 'external';
        else type = 'internal';
      } catch {
        return;
      }
    }

    state.last_action = {
      type,
      label,
      from: path,
      target: clean(target, 220),
      at: Date.now()
    };
    writeState(state);
  }, { capture: true });

  function setHidden(form, name, value) {
    if (!form || value === undefined || value === null || value === '') return;
    let input = form.querySelector(`input[type="hidden"][name="${name}"]`);
    if (!input) {
      input = document.createElement('input');
      input.type = 'hidden';
      input.name = name;
      form.appendChild(input);
    }
    input.value = clean(value, 800);
  }

  function attachAttribution(form) {
    const latest = readState();
    const elapsedSeconds = latest.started_at ? Math.max(0, Math.round((Date.now() - latest.started_at) / 1000)) : 0;
    const action = latest.last_action;

    setHidden(form, 'source_entry_page', latest.entry_page);
    setHidden(form, 'source_page_journey', (latest.journey || []).join(' > '));
    setHidden(form, 'source_referrer', latest.referrer_origin);
    setHidden(form, 'source_device', deviceCategory());
    setHidden(form, 'source_seconds_before_submit', elapsedSeconds);
    setHidden(form, 'source_last_action', action ? `${action.type}: ${action.label || action.target}` : '');
    setHidden(form, 'source_last_action_page', action?.from || '');
    setHidden(form, 'utm_source', latest.utm?.source || '');
    setHidden(form, 'utm_medium', latest.utm?.medium || '');
    setHidden(form, 'utm_campaign', latest.utm?.campaign || '');
    setHidden(form, 'utm_content', latest.utm?.content || '');
    setHidden(form, 'utm_term', latest.utm?.term || '');
  }

  const forms = [...document.querySelectorAll('form')].filter((form) => {
    const action = form.getAttribute('action') || '';
    return form.matches('[data-contact-form], [data-lead-magnet-form]') || action.includes('formspree.io');
  });

  forms.forEach((form) => {
    attachAttribution(form);
    form.addEventListener('submit', () => attachAttribution(form));
  });
})();
