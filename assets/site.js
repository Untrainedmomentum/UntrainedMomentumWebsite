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
    ongoing: 'Microsoft 365 or workplace technology'
  };
  if (requestedService && serviceMap[requestedService]) {
    contactForm.elements.service.value = serviceMap[requestedService];
  }

  contactForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(contactForm);
    const subject = encodeURIComponent(`Website inquiry: ${data.get('service') || 'Technology help'}`);
    const body = encodeURIComponent([
      `Name: ${data.get('name') || ''}`,
      `Email: ${data.get('email') || ''}`,
      `Phone: ${data.get('phone') || ''}`,
      `Location: ${data.get('location') || ''}`,
      `Service: ${data.get('service') || ''}`,
      '',
      data.get('message') || ''
    ].join('\n'));
    window.location.href = `mailto:support@untrainedmomentum.com?subject=${subject}&body=${body}`;
  });
}

