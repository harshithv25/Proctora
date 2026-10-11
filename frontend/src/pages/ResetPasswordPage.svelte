<script lang="ts">
  import { onMount } from 'svelte';
  import { push } from '../lib/router.svelte';
  import Button from '../components/ui/Button.svelte';
  import Input from '../components/ui/Input.svelte';
  import PasswordStrengthIndicator from '../components/auth/PasswordStrengthIndicator.svelte';
  import { authStore } from '../stores/auth.store.svelte';
  import { appStore } from '../stores/app.store.svelte';

  let mounted = $state(false);
  let token = $state('');
  let newPassword = $state('');
  let confirmPassword = $state('');
  let errors = $state<Record<string, string>>({});

  onMount(() => {
    requestAnimationFrame(() => { mounted = true; });

    // Retrieve token from URL query or session storage
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get('token');
    const storedToken = sessionStorage.getItem('proctora_reset_token');

    token = urlToken || storedToken || '';
    if (!token) {
      appStore.addToast('Invalid or missing password reset session. Please verify 2FA again.', 'error');
      push('/forgot-password');
    }
  });

  function validate(): boolean {
    const errs: Record<string, string> = {};

    const hasSpecial = /[^A-Za-z0-9]/.test(newPassword);
    const hasNumber = /[0-9]/.test(newPassword);
    const hasMixedCase = /[a-z]/.test(newPassword) && /[A-Z]/.test(newPassword);

    if (!newPassword) {
      errs.newPassword = 'New password is required';
    } else if (newPassword.length < 8) {
      errs.newPassword = 'Password must be at least 8 characters';
    } else if (!hasSpecial || !hasNumber || !hasMixedCase) {
      errs.newPassword = 'Password must satisfy all strength rules below';
    }

    if (!confirmPassword) {
      errs.confirmPassword = 'Confirm your new password';
    } else if (newPassword !== confirmPassword) {
      errs.confirmPassword = 'Passwords do not match';
    }

    errors = errs;
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (!validate()) return;

    const res = await authStore.resetPassword(token, newPassword);
    if (res.success) {
      sessionStorage.removeItem('proctora_reset_token');
      sessionStorage.removeItem('proctora_reset_email');
      appStore.addToast('Password successfully reset! Please sign in with your new credentials.', 'success');
      push('/login');
    } else {
      appStore.addToast(res.error || 'Failed to update password', 'error');
    }
  }
</script>

<div class="auth-page">
  <div class="auth-container" class:visible={mounted}>
    <header class="auth-header">
      <h1 class="wordmark">proctora</h1>
      <p class="subtitle">Set New Account Password</p>
    </header>

    <div class="auth-card">
      <p class="intro-desc">
        Identity verified via Two-Factor Authentication. Please choose a strong new password for your account.
      </p>

      <form class="reset-form" onsubmit={handleSubmit}>
        <Input
          id="new-password"
          type="password"
          label="New Password"
          value={newPassword}
          placeholder="••••••••"
          error={errors.newPassword}
          autocomplete="new-password"
          oninput={(v) => { newPassword = v; delete errors.newPassword; }}
        />

        <Input
          id="confirm-new-password"
          type="password"
          label="Confirm New Password"
          value={confirmPassword}
          placeholder="••••••••"
          error={errors.confirmPassword}
          autocomplete="new-password"
          oninput={(v) => { confirmPassword = v; delete errors.confirmPassword; }}
        />

        <!-- Password Strength detector below the password text field -->
        <PasswordStrengthIndicator password={newPassword} />

        {#if authStore.error}
          <div class="form-error">
            {authStore.error}
          </div>
        {/if}

        <div class="actions">
          <Button
            type="submit"
            variant="primary"
            fullWidth
            loading={authStore.isLoading}
            disabled={authStore.isLoading}
          >
            Update Password
          </Button>

          <Button
            type="button"
            variant="ghost"
            fullWidth
            disabled={authStore.isLoading}
            onclick={() => push('/login')}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>

    <footer class="auth-footer">
      <p>Secure Academic Examination Platform</p>
    </footer>
  </div>
</div>

<style>
  .auth-page {
    width: 100%;
    min-height: 100dvh;
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--space-6) var(--space-4);
    background-color: var(--color-bg);
  }

  .auth-container {
    width: 100%;
    max-width: 440px;
    margin: auto;
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
    opacity: 0;
    transform: translateY(8px);
    transition: opacity 0.4s var(--ease), transform 0.4s var(--ease);
  }

  .auth-container.visible {
    opacity: 1;
    transform: translateY(0);
  }

  .auth-header {
    text-align: center;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .wordmark {
    font-size: var(--text-2xl);
    font-weight: 300;
    letter-spacing: 6px;
    text-transform: lowercase;
    color: var(--color-text-primary);
    margin: 0;
  }

  .subtitle {
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
    margin: 0;
  }

  .auth-card {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
    padding: var(--space-8);
    background-color: var(--color-bg-elevated);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    box-shadow: var(--shadow-sm);
  }

  .intro-desc {
    font-size: var(--text-xs);
    color: var(--color-text-secondary);
    line-height: 1.5;
    margin: 0;
  }

  .reset-form {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .form-error {
    padding: var(--space-3);
    font-size: var(--text-sm);
    color: var(--color-error);
    background-color: var(--color-error-bg);
    border: 1px solid var(--color-error-border);
    border-radius: var(--radius);
  }

  .actions {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    margin-top: var(--space-2);
  }

  .auth-footer {
    text-align: center;
  }

  .auth-footer p {
    font-size: var(--text-xs);
    color: var(--color-text-muted);
  }
</style>
