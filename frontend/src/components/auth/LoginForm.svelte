<script lang="ts">
  import { onMount } from 'svelte';
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

    formErrors = errors;
    return Object.keys(errors).length === 0;
  }

  function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (!validate()) return;

    authStore.setLoading(true);
    authStore.setError(null);

    // Simulate API call — will be connected later
    setTimeout(() => {
      authStore.setLoading(false);
      appStore.addToast('Login is not connected to the backend yet.', 'info');
    }, 1200);
  }
</script>

<form class="auth-form" onsubmit={handleSubmit}>
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
</style>
