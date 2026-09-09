(() => {
  const site = document.body?.dataset.umSite;
  if (!site) return;
  const storageKey = `um_cart_${site}`;
  const cart = (() => { try { return JSON.parse(localStorage.getItem(storageKey) || '{}'); } catch { return {}; } })();
  const bar = document.querySelector('[data-um-cart-bar]');
  const countNode = document.querySelector('[data-um-cart-count]');

  function totalCount() { return Object.values(cart).reduce((sum, qty) => sum + Number(qty || 0), 0); }
  function save() {
    localStorage.setItem(storageKey, JSON.stringify(cart));
    const count = totalCount();
    if (countNode) countNode.textContent = `${count} item${count === 1 ? '' : 's'}`;
    if (bar) bar.hidden = count === 0;
  }

  document.querySelectorAll('[data-um-add]').forEach((button) => {
    button.addEventListener('click', () => {
      const id = button.dataset.umAdd;
      cart[id] = Math.min(25, Number(cart[id] || 0) + 1);
      save();
      const original = button.textContent;
      button.textContent = 'Added';
      setTimeout(() => { button.textContent = original; }, 900);
    });
  });

  document.querySelector('[data-um-checkout]')?.addEventListener('click', async (event) => {
    const button = event.currentTarget;
    button.disabled = true; const original = button.textContent; button.textContent = 'Opening checkout…';
    try {
      const items = Object.entries(cart).filter(([, quantity]) => quantity > 0).map(([id, quantity]) => ({ id, quantity }));
      const response = await fetch('/api/commerce/checkout', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ site, items }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Checkout could not be started.');
      location.href = data.url;
    } catch (error) {
      alert(error.message);
      button.disabled = false; button.textContent = original;
    }
  });

  save();
})();
