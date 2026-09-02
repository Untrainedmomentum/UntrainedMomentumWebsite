const menuButton = document.querySelector('.menu-button');
const navLinks = document.querySelector('.nav-links');

if (menuButton && navLinks) {
  menuButton.addEventListener('click', () => {
    const open = navLinks.classList.toggle('open');
    menuButton.setAttribute('aria-expanded', String(open));
    document.body.classList.toggle('menu-open', open);
  });

  navLinks.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      navLinks.classList.remove('open');
      menuButton.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('menu-open');
    });
  });
}

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });

document.querySelectorAll('.reveal').forEach((element) => observer.observe(element));

document.querySelectorAll('[data-year]').forEach((element) => {
  element.textContent = new Date().getFullYear();
});

const contactForm = document.querySelector('[data-contact-form]');
if (contactForm) {
  const requestedService = new URLSearchParams(window.location.search).get('service');
  const serviceMap = {
    local: 'Local home or senior technology configuration',
    business: 'Technology project or vendor coordination',
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
  if (requestedService && serviceMap[requestedService]) {
    contactForm.elements.service.value = serviceMap[requestedService];
  }

}

const leadMagnetForm = document.querySelector('[data-lead-magnet-form]');
if (leadMagnetForm) {
  const status = leadMagnetForm.querySelector('[data-form-status]');
  const downloadPanel = document.querySelector('[data-download-panel]');

  leadMagnetForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = leadMagnetForm.querySelector('button[type="submit"]');
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
