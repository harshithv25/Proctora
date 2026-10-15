<script lang="ts">
  import { onMount } from 'svelte';
  import { push } from '../lib/router.svelte.ts';
  import Button from '../components/ui/Button.svelte';
  import Input from '../components/ui/Input.svelte';
  import { authStore } from '../stores/auth.store.svelte';
  import { appStore } from '../stores/app.store.svelte';

  let mounted = $state(false);
  let email = $state(authStore.form.email || '');
  let totpPin = $state('');
  let emailError = $state<string | null>(null);
  let pinError = $state<string | null>(null);

  onMount(() => {
    requestAnimationFrame(() => { mounted = true; });
  });

  function validate(): boolean {
    emailError = null;
    pinError = null;
    let valid = true;

    if (!email.trim()) {
      emailError = 'Registered email is required';
      valid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      emailError = 'Enter a valid email address';
      valid = false;
    }

    if (!totpPin.trim()) {
      pinError = '2FA PIN code is required';
      valid = false;
    } else if (!/^\d{6}$/.test(totpPin.trim())) {
      pinError = '2FA PIN must be exactly 6 digits';
      valid = false;
    }

    return valid;
  }

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (!validate()) return;

    const res = await authStore.verify2FaForReset(email.trim(), totpPin.trim());
    if (res.success && res.resetToken) {
      appStore.addToast('2FA verification successful. Set your new password.', 'success');
      // Store or pass reset token
      sessionStorage.setItem('proctora_reset_token', res.resetToken);
      sessionStorage.setItem('proctora_reset_email', email.trim());
      push(`/reset-password?token=${encodeURIComponent(res.resetToken)}`);
    } else {
      appStore.addToast(res.error || 'Failed to verify 2FA PIN', 'error');
    }
  }
</script>

<div class="auth-page">
  <div class="auth-container" class:visible={mounted}>
    <header class="auth-header">
      <h1 class="wordmark">proctora</h1>
      <p class="subtitle">Two-Factor Password Recovery</p>
    </header>

    <div class="auth-card">
      <div class="reset-intro">
        <div class="shield-badge">2FA</div>
        <p class="step-desc">
          Enter your registered email and the 6-digit PIN from your authenticator app to verify your identity and reset your password.
        </p>
      </div>

      <form class="recovery-form" onsubmit={handleSubmit}>
        <Input
          id="recovery-email"
          type="email"
          label="Registered Email"
          value={email}
          placeholder="you@institution.edu"
          error={emailError ?? undefined}
          autocomplete="email"
          oninput={(v) => { email = v; emailError = null; }}
        />

        <Input
          id="recovery-pin"
          type="text"
          label="2FA Authenticator PIN (OTP)"
          value={totpPin}
          placeholder="000000"
          error={pinError ?? undefined}
          autocomplete="one-time-code"
          oninput={(v) => { totpPin = v.replace(/\D/g, '').slice(0, 6); pinError = null; }}
        />

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
            Verify 2FA PIN & Proceed
          </Button>

          <Button
            type="button"
            variant="ghost"
            fullWidth
            disabled={authStore.isLoading}
            onclick={() => push('/login')}
          >
            Back to Sign In
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

  .reset-intro {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4);
    background: var(--color-bg-subtle);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
  }

  .shield-badge {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 4px 8px;
    background: var(--color-accent);
    color: #fff;
    font-size: 11px;
    font-weight: 700;
    border-radius: 4px;
    letter-spacing: 1px;
  }

  .step-desc {
    font-size: var(--text-xs);
    color: var(--color-text-secondary);
    line-height: 1.4;
    margin: 0;
  }

  .recovery-form {
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
