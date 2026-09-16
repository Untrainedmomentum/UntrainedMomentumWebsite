const MOBILE_NAV_VERSION = '20260912-2';
const READABILITY_VERSION = '20260915-3';

if (!document.querySelector('link[href*="mobile-nav.css"]')) {
  const mobileNavStyles = document.createElement('link');
  mobileNavStyles.rel = 'stylesheet';
  mobileNavStyles.href = `/assets/mobile-nav.css?v=${MOBILE_NAV_VERSION}`;
  document.head.appendChild(mobileNavStyles);
}

if (!document.querySelector('link[href*="readability.css"]')) {
  const readabilityStyles = document.createElement('link');
  readabilityStyles.rel = 'stylesheet';
  readabilityStyles.href = `/assets/readability.css?v=${READABILITY_VERSION}`;
  document.head.appendChild(readabilityStyles);
}

function standardizeHeader() {
  const nav = document.querySelector('.site-header .nav');
  if (!nav) return;

  let brand = nav.querySelector('.brand');
  if (!brand) {
    brand = document.createElement('a');
    brand.className = 'brand';
    nav.prepend(brand);
  }
  brand.href = '/';
  brand.setAttribute('aria-label', 'Untrained Momentum home');
  brand.innerHTML = '<img class="brand-logo" src="/Logo%20Black.png" alt="Untrained Momentum">';

  let menu = nav.querySelector('.menu-button');
  if (!menu) {
    menu = document.createElement('button');
    menu.className = 'menu-button';
    menu.type = 'button';
    menu.innerHTML = '<span></span><span></span><span></span>';
    brand.insertAdjacentElement('afterend', menu);
  }
  menu.setAttribute('aria-label', 'Open menu');
  menu.setAttribute('aria-expanded', 'false');
  menu.setAttribute('aria-controls', 'primary-navigation');

  let links = nav.querySelector('.nav-links');
  if (!links) {
    links = document.createElement('div');
    links.className = 'nav-links';
    nav.appendChild(links);
  }
  links.id = 'primary-navigation';
  links.innerHTML = `
    <a href="/business-services.html">Business Services</a>
    <a href="/managed-website-rental.html">Managed Websites</a>
    <a href="/business-startup-support.html">Business Start Up</a>
    <a href="/local-tech-help.html">Home Tech</a>
    <a href="/work.html">Work</a>
    <a href="/about.html">About</a>
    <a href="/client/login.html">Client Login</a>
    <a class="nav-cta" href="/book.html">Free Consultation</a>`;
}

standardizeHeader();

const menuButton = document.querySelector('.menu-button');
const navLinks = document.querySelector('.nav-links');

function setMenuState(open) {
  if (!menuButton || !navLinks) return;
  navLinks.classList.toggle('open', open);
  menuButton.setAttribute('aria-expanded', String(open));
  menuButton.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  document.body.classList.toggle('menu-open', open);
}

if (menuButton && navLinks) {
  setMenuState(false);

  menuButton.addEventListener('click', () => {
    setMenuState(!navLinks.classList.contains('open'));
  });

  navLinks.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => setMenuState(false));
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && navLinks.classList.contains('open')) {
      setMenuState(false);
      menuButton.focus();
    }
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 900 && navLinks.classList.contains('open')) {
      setMenuState(false);
    }
  });

  window.addEventListener('pageshow', () => {
    if (window.innerWidth <= 900) setMenuState(false);
  });

  const currentPath = (window.location.pathname.replace(/\/+$/, '') || '/').toLowerCase();
  navLinks.querySelectorAll('a[href]').forEach((link) => {
    const url = new URL(link.href, window.location.origin);
    if (url.origin !== window.location.origin) return;
    const linkPath = (url.pathname.replace(/\/+$/, '') || '/').toLowerCase();
    if (linkPath === currentPath) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
}

function normalizeConsultationCtas() {
  document.querySelectorAll('a[href]').forEach((link) => {
    let url;
    try {
      url = new URL(link.getAttribute('href'), window.location.href);
    } catch {
      return;
    }

    if (url.origin !== window.location.origin) return;

    const path = url.pathname.toLowerCase();
    const isConsultationLink = /\/(?:book|book-business|book-smart-home)\.html$/.test(path);
    const text = (link.textContent || '').replace(/\s+/g, ' ').trim();

    if (link.classList.contains('nav-cta') && isConsultationLink) {
      link.textContent = 'Free Consultation';
      return;
    }

    if (/^book a call$/i.test(text)) {
      link.textContent = 'Free Consultation';
      return;
    }

    if (/schedule a business call/i.test(text)) {
      link.textContent = 'Schedule a Free Business Consultation →';
      return;
    }

    if (/schedule home tech help/i.test(text) || /schedule smart-home consultation/i.test(text)) {
      link.textContent = 'Schedule a Free Home Tech Consultation →';
      return;
    }

    if (/request on-site help/i.test(text) || /request local help/i.test(text) || /request an appointment/i.test(text)) {
      link.href = '/book-smart-home.html';
      link.textContent = 'Start with a Free Consultation →';
      return;
    }

    if (/request (?:senior tech|printer|wi-fi|wifi) help/i.test(text)) {
      link.href = '/book-smart-home.html';
      link.textContent = 'Start with a Free Consultation →';
    }
  });
}

normalizeConsultationCtas();

function normalizeExperienceText(value = '') {
  return String(value)
    .replace(/more than two decades/gi, 'more than 10 years')
    .replace(/two decades/gi, '10+ years')
    .replace(/more than 20\+?\s*years/gi, 'more than 10 years')
    .replace(/20\+\s*years/gi, '10+ years')
    .replace(/20\+\s*yrs/gi, '10+ yrs');
}

function normalizeExperienceClaims() {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const nodes = [];
  let node;
  while ((node = walker.nextNode())) {
    const parentTag = node.parentElement?.tagName;
    if (parentTag === 'SCRIPT' || parentTag === 'STYLE' || parentTag === 'TEXTAREA') continue;
    if (/two decades|20\+?\s*(?:years|yrs)/i.test(node.nodeValue || '')) nodes.push(node);
  }
  nodes.forEach((textNode) => {
    textNode.nodeValue = normalizeExperienceText(textNode.nodeValue);
  });

  document.querySelectorAll('meta[content]').forEach((meta) => {
    if (/two decades|20\+?\s*(?:years|yrs)/i.test(meta.content || '')) {
      meta.content = normalizeExperienceText(meta.content);
    }
  });

  document.querySelectorAll('script[type="application/ld+json"]').forEach((script) => {
    if (/two decades|20\+?\s*(?:years|yrs)/i.test(script.textContent || '')) {
      script.textContent = normalizeExperienceText(script.textContent);
    }
  });
}

normalizeExperienceClaims();

const revealElements = document.querySelectorAll('.reveal');
if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });

  revealElements.forEach((element) => observer.observe(element));
} else {
  revealElements.forEach((element) => element.classList.add('visible'));
}

document.querySelectorAll('[data-year]').forEach((element) => {
  element.textContent = new Date().getFullYear();
});

const contactForm = document.querySelector('[data-contact-form]');
if (contactForm) {
  const requestedService = new URLSearchParams(window.location.search).get('service');
  const serviceMap = {
    local: 'local',
    wifi: 'local',
    printer: 'local',
    'senior-tech': 'local',
    business: 'business',
    'business-tech': 'business',
    assessment: 'automation',
    intake: 'automation',
    automation: 'automation',
    project: 'project',
    ongoing: 'business',
    website: 'website',
    'managed-website': 'website',
    startup: 'startup',
    agent: 'agent',
    coaching: 'planning',
    planning: 'planning',
    group: 'planning',
    personal: 'planning',
    'ai-agents': 'ai-agents',
    'smart-home': 'smart-home',
    other: 'other'
  };

  const serviceField = contactForm.elements?.service;
  if (requestedService && serviceMap[requestedService] && serviceField) {
    serviceField.value = serviceMap[requestedService];
  }
}

const leadMagnetForm = document.querySelector('[data-lead-magnet-form]');
if (leadMagnetForm) {
  const status = leadMagnetForm.querySelector('[data-form-status]');
  const downloadPanel = document.querySelector('[data-download-panel]');

  leadMagnetForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = leadMagnetForm.querySelector('button[type="submit"]');
    if (!button || !status || !downloadPanel) return;

    button.disabled = true;
    button.textContent = 'Preparing your guide…';
    status.textContent = '';

    try {
      const response = await fetch(leadMagnetForm.action, {
        method: 'POST',
        body: new FormData(leadMagnetForm),
        headers: { Accept: 'application/json' }
      });
      if (!response.ok) throw new Error('Submission failed');
      leadMagnetForm.hidden = true;
      downloadPanel.hidden = false;
      downloadPanel.focus();
    } catch (error) {
      status.textContent = 'We could not record your request. Please try again or email info@untrainedmomentum.com.';
      status.className = 'form-status error';
      button.disabled = false;
      button.textContent = 'Get the free blueprint →';
    }
  });
}
