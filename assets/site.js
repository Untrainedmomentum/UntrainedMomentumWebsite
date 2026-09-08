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

  const currentPath = (window.location.pathname.replace(/\/+$/, '') || '/').toLowerCase();
  navLinks.querySelectorAll('a[href]').forEach((link) => {
    const url = new URL(link.href, window.location.origin);
    if (url.origin !== window.location.origin) return;
    const linkPath = (url.pathname.replace(/\/+$/, '') || '/').toLowerCase();
    if (linkPath === currentPath) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
}

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
    local: 'Local home or senior technology configuration',
    business: 'Not sure—business technology or operations',
    assessment: 'Business process or automation',
    project: 'Technology project or vendor coordination',
    ongoing: 'Microsoft 365 or workplace technology',
    website: 'Website subscription or digital operations',
    startup: 'Business Foundation Setup',
    agent: 'Michigan resident agent service',
    coaching: 'Monthly business planning and accountability',
    group: 'Monthly Momentum Group',
    personal: 'Personal Business Launch Partnership'
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
