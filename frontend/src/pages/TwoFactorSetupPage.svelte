<script lang="ts">
  import { onMount } from 'svelte';
  import { push } from 'svelte-spa-router';
  import Button from '../components/ui/Button.svelte';
  import Input from '../components/ui/Input.svelte';
  import { authStore } from '../stores/auth.store.svelte';
  import { appStore } from '../stores/app.store.svelte';

  let mounted = $state(false);
  let secret = $state<string | null>(null);
  let otpauthUrl = $state<string | null>(null);
  let verifyCode = $state('');
  let verifyError = $state<string | null>(null);
  let isCopied = $state(false);

  onMount(async () => {
    requestAnimationFrame(() => { mounted = true; });
    await loadSetup();
  });

  async function loadSetup() {
    const res = await authStore.setup2FA();
    if (res.success && res.data) {
      secret = res.data.secret;
      otpauthUrl = res.data.otpauthUrl;
    } else {
      appStore.addToast(res.error || 'Failed to initialize 2FA setup', 'error');
    }
  }

  function handleCopySecret() {
    if (!secret) return;
    navigator.clipboard.writeText(secret);
    isCopied = true;
    appStore.addToast('Secret copied to clipboard', 'info');
    setTimeout(() => { isCopied = false; }, 2000);
  }

  function handleContinue() {
    appStore.addToast('Two-Factor Authentication configured successfully', 'success');
    push('/dashboard');
  }
</script>

<div class="auth-page">
  <div class="auth-container" class:visible={mounted}>
    <header class="auth-header">
      <h1 class="wordmark">proctora</h1>
      <p class="subtitle">Two-Factor Authentication Setup</p>
    </header>

    <div class="auth-card">
      <div class="setup-intro">
        <p class="step-desc">
          Secure your account using an authenticator app (e.g. Google Authenticator, Authy, or 1Password).
        </p>
      </div>

      {#if authStore.isLoading && !secret}
        <div class="loading-box">
          <p class="muted-text">Generating secure key...</p>
        </div>
      {:else if secret}
        <div class="secret-box">
          <label class="field-label" for="secret-display">Your Secret Key</label>
          <div class="key-container">
            <code id="secret-display" class="secret-code">{secret}</code>
            <Button variant="secondary" onclick={handleCopySecret}>
              {isCopied ? 'Copied' : 'Copy'}
            </Button>
          </div>
          <p class="key-help">
            Enter this secret key manually into your authenticator app to generate OTP codes.
          </p>
        </div>

        {#if otpauthUrl}
          <div class="uri-container">
            <label class="field-label" for="otpauth-display">Authenticator URI</label>
            <input
              id="otpauth-display"
              class="uri-input"
              type="text"
              readonly
              value={otpauthUrl}
              onclick={(e) => (e.currentTarget as HTMLInputElement).select()}
            />
          </div>
        {/if}

        <div class="actions">
          <Button variant="primary" fullWidth onclick={handleContinue}>
            Done & Proceed
          </Button>
          <Button variant="ghost" fullWidth onclick={() => push('/dashboard')}>
            Skip for now
          </Button>
        </div>
      {/if}
    </div>

    <footer class="auth-footer">
      <p>Online Examination & Proctoring System</p>
    </footer>
  </div>
</div>

<style>
  .auth-page {
    min-height: 100dvh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-4);
    background-color: var(--color-bg);
  }

  .auth-container {
    width: 100%;
    max-width: 440px;
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
    opacity: 0;
    transform: translateY(8px);
    transition:
      opacity 0.5s var(--ease),
      transform 0.5s var(--ease);
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

  .step-desc {
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
    line-height: 1.5;
    margin: 0;
  }

  .field-label {
    display: block;
    font-size: var(--text-xs);
    font-weight: 500;
    color: var(--color-text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: var(--space-2);
  }

  .secret-box {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .key-container {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .secret-code {
    flex: 1;
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    font-weight: 600;
    letter-spacing: 2px;
    color: var(--color-text-primary);
    padding: var(--space-3);
    background-color: var(--color-bg-subtle);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    user-select: all;
    overflow-x: auto;
  }

  .key-help {
    font-size: var(--text-xs);
    color: var(--color-text-muted);
    line-height: 1.4;
    margin: 0;
  }

  .uri-container {
    display: flex;
    flex-direction: column;
  }

  .uri-input {
    width: 100%;
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--color-text-secondary);
    padding: var(--space-2) var(--space-3);
    background-color: var(--color-bg-subtle);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    outline: none;
  }

  .actions {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    margin-top: var(--space-2);
  }

  .loading-box {
    padding: var(--space-6);
    text-align: center;
  }

  .muted-text {
    font-size: var(--text-sm);
    color: var(--color-text-muted);
  }

  .auth-footer {
    text-align: center;
  }

  .auth-footer p {
    font-size: var(--text-xs);
    color: var(--color-text-muted);
    letter-spacing: 0.3px;
  }
</style>
