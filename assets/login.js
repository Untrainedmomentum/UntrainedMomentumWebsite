import { consumeAuthRedirect, escapeHtml, getSession, signInClient, signUpClient } from '/assets/client.js';

const loginForm = document.querySelector('#login-form');
const activateForm = document.querySelector('#activate-form');
const loginStatus = document.querySelector('#login-status');
const activateStatus = document.querySelector('#activate-status');
const showActivate = document.querySelector('[data-show-activate]');
const showLogin = document.querySelector('[data-show-login]');
const loginPanel = document.querySelector('#login-panel');
const activatePanel = document.querySelector('#activate-panel');

function notice(target, message, kind = '') {
  target.innerHTML = `<div class="client-notice ${kind}">${escapeHtml(message)}</div>`;
  target.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
}

function switchPanel(mode) {
  const activating = mode === 'activate';
  loginPanel.hidden = activating;
  activatePanel.hidden = !activating;
  (activating ? activateForm.querySelector('input[name="email"]') : loginForm.querySelector('input[name="email"]'))?.focus();
}

showActivate?.addEventListener('click', () => switchPanel('activate'));
showLogin?.addEventListener('click', () => switchPanel('login'));

try {
  const consumed = consumeAuthRedirect();
  if (consumed) {
    notice(loginStatus, 'Email confirmed. Signing you in…', 'good');
  } else if (new URL(location.href).searchParams.get('confirmed') === '1') {
    notice(loginStatus, 'Email confirmed. Sign in with the password you created.', 'good');
  }
  await getSession();
  location.replace('/client/index.html');
} catch (error) {
  if (error?.message && error.message !== 'Please sign in.') {
    notice(loginStatus, error.message, 'error');
  }
}

loginForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = loginForm.querySelector('button[type="submit"]');
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = 'Signing in…';
  loginStatus.textContent = '';
  const values = Object.fromEntries(new FormData(loginForm));
  try {
    await signInClient(values.email, values.password);
    notice(loginStatus, 'Signed in. Opening your dashboard…', 'good');
    await getSession();
    location.replace('/client/index.html');
  } catch (error) {
    notice(loginStatus, error.message || 'Sign in failed.', 'error');
    button.disabled = false;
    button.textContent = originalText;
  }
});

activateForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = activateForm.querySelector('button[type="submit"]');
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = 'Creating account…';
  activateStatus.textContent = '';
  const values = Object.fromEntries(new FormData(activateForm));

  if (String(values.password || '').length < 12) {
    notice(activateStatus, 'Use at least 12 characters for your password.', 'error');
    button.disabled = false;
    button.textContent = originalText;
    return;
  }
  if (values.password !== values.confirmPassword) {
    notice(activateStatus, 'The passwords do not match.', 'error');
    button.disabled = false;
    button.textContent = originalText;
    return;
  }

  try {
    notice(activateStatus, 'Creating your client account and sending the confirmation email…');
    const data = await signUpClient({ email: values.email, password: values.password, fullName: values.fullName });
    if (data?.access_token) {
      notice(activateStatus, 'Account activated. Opening your dashboard…', 'good');
      await getSession();
      location.replace('/client/index.html');
      return;
    }
    activateForm.reset();
    notice(activateStatus, 'Account created. Check your email to confirm your address, then return here and sign in with the password you just created.', 'good');
    button.textContent = 'Confirmation email sent';
  } catch (error) {
    notice(activateStatus, error.message || 'Account activation failed.', 'error');
    button.disabled = false;
    button.textContent = originalText;
  }
});
