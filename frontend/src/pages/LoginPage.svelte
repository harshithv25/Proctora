<script lang="ts">
  import { onMount } from 'svelte';
  import { push } from 'svelte-spa-router';
  import LoginForm from '../components/auth/LoginForm.svelte';
  import Divider from '../components/ui/Divider.svelte';
  import Button from '../components/ui/Button.svelte';
  import { appStore } from '../stores/app.store.svelte';

  let mounted = $state(false);

  onMount(() => {
    setTimeout(() => appStore.setPageLoading(false), 800);
    requestAnimationFrame(() => { mounted = true; });
  });
</script>

<div class="auth-page">
  <div class="auth-container" class:visible={mounted}>
    <header class="auth-header">
      <h1 class="wordmark">proctora</h1>
      <p class="subtitle">Sign in to your account</p>
    </header>

    <div class="auth-card">
      <LoginForm />

      <Divider text="or" />

      <div class="mode-toggle">
        <span class="toggle-text">Don't have an account?</span>
        <Button variant="ghost" onclick={() => push('/register')}>
          Register
        </Button>
      </div>
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
    max-width: 400px;
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

  .mode-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-1);
  }

  .toggle-text {
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
