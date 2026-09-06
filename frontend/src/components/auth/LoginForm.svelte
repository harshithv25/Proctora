<script lang="ts">
  import { onMount } from 'svelte';
  import { push } from 'svelte-spa-router';
  import Input from '../ui/Input.svelte';
  import Button from '../ui/Button.svelte';
  import { authStore } from '../../stores/auth.store.svelte';
  import { appStore } from '../../stores/app.store.svelte';

  let formErrors = $state<Record<string, string>>({});

  onMount(() => {
    authStore.resetForm();
    authStore.setError(null);
  });

  function validate(): boolean {
    const errors: Record<string, string> = {};

    if (!authStore.requires2fa) {
      if (!authStore.form.email.trim()) {
        errors.email = 'Email is required';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(authStore.form.email)) {
        errors.email = 'Enter a valid email';
      }

      if (!authStore.form.password) {
        errors.password = 'Password is required';
      } else if (authStore.form.password.length < 8) {
        errors.password = 'Minimum 8 characters';
      }
    } else {
      if (!authStore.form.totpCode.trim()) {
        errors.totpCode = '6-digit OTP code is required';
      } else if (!/^\d{6}$/.test(authStore.form.totpCode.trim())) {
        errors.totpCode = 'Must be exactly 6 digits';
      }
    }

    formErrors = errors;
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (!validate()) return;

    const result = await authStore.login(
      authStore.form.email,
      authStore.form.password,
      authStore.requires2fa ? authStore.form.totpCode : undefined
    );

    if (result.success && result.user) {
      appStore.addToast(`Welcome back, ${result.user.name}`, 'success');
      push('/dashboard');
    } else if (result.requires2fa) {
      appStore.addToast('2-Factor authentication required. Enter your code.', 'info');
    }
  }

  function handleBackToPassword() {
    authStore.setRequires2FA(false);
    authStore.updateField('totpCode', '');
    authStore.setError(null);
    formErrors = {};
  }
</script>

<form class="auth-form" onsubmit={handleSubmit}>
  {#if !authStore.requires2fa}
    <div class="form-fields">
      <Input
        id="login-email"
        type="email"
        label="Email"
        value={authStore.form.email}
        placeholder="you@institution.edu"
        error={formErrors.email}
        autocomplete="email"
        oninput={(v) => authStore.updateField('email', v)}
      />

      <Input
        id="login-password"
        type="password"
        label="Password"
        value={authStore.form.password}
        placeholder="••••••••"
        error={formErrors.password}
        autocomplete="current-password"
        oninput={(v) => authStore.updateField('password', v)}
      />
    </div>

    {#if authStore.error}
      <div class="form-error">
        {authStore.error}
      </div>
    {/if}

    <Button
      type="submit"
      variant="primary"
      fullWidth
      loading={authStore.isLoading}
      disabled={authStore.isLoading}
    >
      Sign in
    </Button>
  {:else}
    <div class="otp-verification-stage">
      <div class="otp-header">
        <p class="otp-instruction">
          Enter the 6-digit verification code from your authenticator app.
        </p>
      </div>

      <div class="form-fields">
        <Input
          id="login-totp"
          type="text"
          label="Verification Code (OTP)"
          value={authStore.form.totpCode}
          placeholder="000000"
          error={formErrors.totpCode}
          autocomplete="one-time-code"
          oninput={(v) => authStore.updateField('totpCode', v.replace(/\D/g, '').slice(0, 6))}
        />
      </div>

      {#if authStore.error}
        <div class="form-error">
          {authStore.error}
        </div>
      {/if}

      <div class="otp-actions">
        <Button
          type="submit"
          variant="primary"
          fullWidth
          loading={authStore.isLoading}
          disabled={authStore.isLoading}
        >
          Verify & Sign In
        </Button>

        <Button
          type="button"
          variant="ghost"
          fullWidth
          disabled={authStore.isLoading}
          onclick={handleBackToPassword}
        >
          Back to login
        </Button>
      </div>
    </div>
  {/if}
</form>

<style>
  .auth-form {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
    animation: slideUp 0.4s var(--ease) both;
  }

  .form-fields {
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

  .otp-verification-stage {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    animation: fadeIn 0.3s var(--ease) both;
  }

  .otp-instruction {
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
    line-height: 1.5;
    margin: 0;
  }

  .otp-actions {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
</style>
