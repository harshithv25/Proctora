<script lang="ts">
  import { onMount } from 'svelte';
  import { push } from 'svelte-spa-router';
  import Button from '../components/ui/Button.svelte';
  import { authStore } from '../stores/auth.store.svelte';

  interface Props {
    params?: { examId?: string };
  }

  let { params } = $props<Props>();
  const examId = $derived(params?.examId || 'demo-exam-1');

  let mounted = $state(false);
  const submittedAt = new Date().toLocaleString();

  onMount(() => {
    requestAnimationFrame(() => { mounted = true; });
  });
</script>

<div class="submitted-page">
  <div class="submitted-container" class:visible={mounted}>
    <header class="submitted-header">
      <h1 class="wordmark">proctora</h1>
      <p class="subtitle">Online Examination & Proctoring System</p>
    </header>

    <div class="submitted-card">
      <div class="confirmation-badge">
        <span class="badge-icon">✓</span>
        <span class="badge-label">Submission Confirmed</span>
      </div>

      <div class="confirmation-content">
        <h2 class="confirm-title">Examination Completed</h2>
        <p class="confirm-desc">
          Your responses and proctoring telemetry data have been sealed, encrypted, and recorded in the evaluation repository.
        </p>
      </div>

      <div class="receipt-box">
        <div class="receipt-row">
          <span class="r-label">Candidate Name:</span>
          <span class="r-value">{authStore.user?.name || 'Candidate'}</span>
        </div>
        <div class="receipt-row">
          <span class="r-label">Roll Number:</span>
          <span class="r-value">{authStore.user?.rollNumber || '21CS001'}</span>
        </div>
        <div class="receipt-row">
          <span class="r-label">Exam Identifier:</span>
          <span class="r-value">{examId}</span>
        </div>
        <div class="receipt-row">
          <span class="r-label">Submission Timestamp:</span>
          <span class="r-value">{submittedAt}</span>
        </div>
      </div>

      <div class="actions">
        <Button variant="primary" fullWidth onclick={() => push('/dashboard')}>
          Return to Dashboard
        </Button>
      </div>
    </div>

    <footer class="submitted-footer">
      <p>Secure Academic Integrity Record • NITK Online Examination</p>
    </footer>
  </div>
</div>

<style>
  .submitted-page {
    min-height: 100dvh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-4);
    background-color: var(--color-bg);
  }

  .submitted-container {
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

  .submitted-container.visible {
    opacity: 1;
    transform: translateY(0);
  }

  .submitted-header {
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

  .submitted-card {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
    padding: var(--space-8);
    background-color: var(--color-bg-elevated);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    box-shadow: var(--shadow-sm);
  }

  .confirmation-badge {
    align-self: flex-start;
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: 3px 8px;
    background-color: #f0fdf4;
    border: 1px solid #bbf7d0;
    border-radius: var(--radius-sm);
    color: var(--color-success);
    font-size: var(--text-xs);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .badge-icon {
    font-weight: bold;
  }

  .confirmation-content {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .confirm-title {
    font-size: var(--text-xl);
    font-weight: 500;
    color: var(--color-text-primary);
    margin: 0;
  }

  .confirm-desc {
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
    line-height: 1.5;
    margin: 0;
  }

  .receipt-box {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-4);
    background-color: var(--color-bg-subtle);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
  }

  .receipt-row {
    display: flex;
    justify-content: space-between;
    font-size: var(--text-xs);
  }

  .r-label {
    color: var(--color-text-secondary);
  }

  .r-value {
    font-weight: 500;
    font-family: var(--font-mono);
    color: var(--color-text-primary);
  }

  .actions {
    margin-top: var(--space-2);
  }

  .submitted-footer {
    text-align: center;
  }

  .submitted-footer p {
    font-size: var(--text-xs);
    color: var(--color-text-muted);
    letter-spacing: 0.3px;
  }
</style>
