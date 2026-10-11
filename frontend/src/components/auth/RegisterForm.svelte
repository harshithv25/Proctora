<script lang="ts">
  import { onMount } from 'svelte';
  import { push } from '../../lib/router.svelte';
  import Input from '../ui/Input.svelte';
  import Button from '../ui/Button.svelte';
  import PasswordStrengthIndicator from './PasswordStrengthIndicator.svelte';
  import { authStore } from '../../stores/auth.store.svelte';
  import { appStore } from '../../stores/app.store.svelte';

  let formErrors = $state<Record<string, string>>({});

  onMount(() => {
    authStore.resetForm();
    authStore.setError(null);
  });

  function validate(): boolean {
    const errors: Record<string, string> = {};

    if (!authStore.form.name.trim()) {
      errors.name = 'Full name is required';
    }

    if (!authStore.form.email.trim()) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(authStore.form.email)) {
      errors.email = 'Enter a valid email';
    }

    if (!authStore.form.rollNumber.trim()) {
      errors.rollNumber = 'Roll number is required';
    }

    const hasSpecial = /[^A-Za-z0-9]/.test(authStore.form.password);
    const hasNumber = /[0-9]/.test(authStore.form.password);
    const hasMixedCase = /[a-z]/.test(authStore.form.password) && /[A-Z]/.test(authStore.form.password);

    if (!authStore.form.password) {
      errors.password = 'Password is required';
    } else if (authStore.form.password.length < 8) {
      errors.password = 'Minimum 8 characters';
    } else if (!hasSpecial || !hasNumber || !hasMixedCase) {
      errors.password = 'Password must satisfy all strength rules below';
    }

    if (!authStore.form.confirmPassword) {
      errors.confirmPassword = 'Confirm your password';
    } else if (authStore.form.password !== authStore.form.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    formErrors = errors;
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (!validate()) return;

    const result = await authStore.register({
      name: authStore.form.name,
      email: authStore.form.email,
      rollNumber: authStore.form.rollNumber,
      password: authStore.form.password,
    });

    if (result.success) {
      appStore.addToast('Account created! Please complete mandatory 2FA setup to secure your account.', 'info');
      push('/2fa-setup');
    }
  }
</script>

<form class="auth-form" onsubmit={handleSubmit}>
  <div class="form-fields">
    <Input
      id="register-name"
      type="text"
      label="Full Name"
      value={authStore.form.name}
      placeholder="Jane Doe"
      error={formErrors.name}
      autocomplete="name"
      oninput={(v) => authStore.updateField('name', v)}
    />

    <Input
      id="register-email"
      type="email"
      label="Institutional Email"
      value={authStore.form.email}
      placeholder="you@institution.edu"
      error={formErrors.email}
      autocomplete="email"
      oninput={(v) => authStore.updateField('email', v)}
    />

    <Input
      id="register-roll"
      type="text"
      label="Roll Number"
      value={authStore.form.rollNumber}
      placeholder="21CS001"
      error={formErrors.rollNumber}
      oninput={(v) => authStore.updateField('rollNumber', v)}
    />

    <div class="field-row">
      <Input
        id="register-password"
        type="password"
        label="Password"
        value={authStore.form.password}
        placeholder="••••••••"
        error={formErrors.password}
        autocomplete="new-password"
        oninput={(v) => authStore.updateField('password', v)}
      />

      <Input
        id="register-confirm"
        type="password"
        label="Confirm Password"
        value={authStore.form.confirmPassword}
        placeholder="••••••••"
        error={formErrors.confirmPassword}
        autocomplete="new-password"
        oninput={(v) => authStore.updateField('confirmPassword', v)}
      />
    </div>

    <!-- Password strength indicator below password text field -->
    <PasswordStrengthIndicator password={authStore.form.password} />
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
    Create account
  </Button>
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

  .field-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-4);
  }

  @media (max-width: 480px) {
    .field-row {
      grid-template-columns: 1fr;
    }
  }

  .form-error {
    padding: var(--space-3);
    font-size: var(--text-sm);
    color: var(--color-error);
    background-color: var(--color-error-bg);
    border: 1px solid var(--color-error-border);
    border-radius: var(--radius);
  }
</style>
