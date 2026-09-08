(() => {
  const carousel = document.querySelector('.work-carousel');
  if (!carousel) return;
  const cards = [...carousel.querySelectorAll('.work-card')];
  const selectors = carousel.querySelector('.work-selectors');
  const counter = carousel.querySelector('.work-counter');
  let current = 0;
  const buttons = cards.map((card, index) => {
    const name = card.querySelector('h3').textContent;
    card.setAttribute('role', 'group');
    card.setAttribute('aria-roledescription', 'slide');
    card.id = `work-slide-${index}`;
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = String(index + 1).padStart(2, '0');
    button.setAttribute('aria-label', `Show ${name}`);
    button.setAttribute('aria-controls', card.id);
    button.addEventListener('click', () => show(index));
    selectors.append(button);
    return button;
  });
  function show(index) {
    const focusedInSlide = cards[current].contains(document.activeElement);
    current = (index + cards.length) % cards.length;
    cards.forEach((card, i) => { card.hidden = i !== current; });
    buttons.forEach((button, i) => button.setAttribute('aria-pressed', String(i === current)));
    counter.textContent = `${current + 1} / ${cards.length}`;
    counter.setAttribute('aria-label', `${current + 1} of ${cards.length}: ${cards[current].querySelector('h3').textContent}`);
    if (focusedInSlide && cards[current].hidden === false) buttons[current].focus();
  }
  carousel.querySelector('[data-previous]').addEventListener('click', () => show(current - 1));
  carousel.querySelector('[data-next]').addEventListener('click', () => show(current + 1));
  carousel.addEventListener('keydown', event => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      const focusedInSlide = cards[current].contains(document.activeElement);
      show(current + (event.key === 'ArrowRight' ? 1 : -1));
      if (focusedInSlide) buttons[current].focus();
    }
  });
  let touch;
  carousel.addEventListener('touchstart', event => {
    touch = null;
    if (event.touches.length === 1) touch = {x:event.touches[0].clientX,y:event.touches[0].clientY};
  }, {passive:true});
  carousel.addEventListener('touchcancel', () => { touch = null; }, {passive:true});
  carousel.addEventListener('touchend', event => {
    if (!touch) return;
    const dx=event.changedTouches[0].clientX-touch.x, dy=event.changedTouches[0].clientY-touch.y;
    if (Math.abs(dx)>60 && Math.abs(dx)>Math.abs(dy)*1.5) show(current+(dx<0?1:-1));
    touch=null;
  }, {passive:true});
  carousel.classList.add('is-ready');
  carousel.querySelector('.work-controls').hidden = false;
  show(0);
  function showLinkedProject() {
    const index = cards.findIndex(card => `#${card.querySelector('h3').id}` === location.hash);
    if (index !== -1) show(index);
  }
  window.addEventListener('hashchange', showLinkedProject);
  showLinkedProject();
})();
