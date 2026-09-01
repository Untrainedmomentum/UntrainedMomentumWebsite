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
    website: 'Website or digital operations'
  };
  if (requestedService && serviceMap[requestedService]) {
    contactForm.elements.service.value = serviceMap[requestedService];
  }

  contactForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submitButton = contactForm.querySelector('[type="submit"]');
    const status = contactForm.querySelector('[data-form-status]');
    const originalLabel = submitButton.innerHTML;

    submitButton.disabled = true;
    submitButton.textContent = 'Sending…';
    status.className = 'form-status';
    status.textContent = '';

    try {
      const response = await fetch(contactForm.action, {
        method: 'POST',
        body: new FormData(contactForm),
        headers: { Accept: 'application/json' }
      });

      if (!response.ok) throw new Error('Submission failed');

      contactForm.reset();
      status.classList.add('success');
      status.textContent = 'Thank you. Your inquiry has been sent. We will be in touch within two business days.';
    } catch (error) {
      status.classList.add('error');
      status.textContent = 'Your inquiry could not be sent. Please try again, email info@untrainedmomentum.com, or call us.';
    } finally {
      submitButton.disabled = false;
      submitButton.innerHTML = originalLabel;
    }
  });
}

