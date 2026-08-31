<!--
  Toast notification container.
  Renders toasts from the appStore at the top-right of the viewport.
  Each toast auto-dismisses after 4 seconds.
-->
<script lang="ts">
  import { appStore } from '../../stores/app.store.svelte';
</script>

{#if appStore.toasts.length > 0}
  <div class="toast-container">
    {#each appStore.toasts as toast (toast.id)}
      <div class="toast toast-{toast.type}">
        <span class="toast-message">{toast.message}</span>
        <button
          class="toast-close"
          onclick={() => appStore.removeToast(toast.id)}
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
    {/each}
  </div>
{/if}

<style>
  .toast-container {
    position: fixed;
    top: var(--space-4);
    right: var(--space-4);
    z-index: 10000;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    max-width: 360px;
  }

  .toast {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4);
    background-color: var(--color-bg-elevated);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
    animation: slideIn 0.25s var(--ease) both;
  }

  .toast-info {
    border-left: 3px solid var(--color-text-muted);
  }

  .toast-success {
    border-left: 3px solid var(--color-success);
  }

  .toast-error {
    border-left: 3px solid var(--color-error);
  }

  .toast-message {
    font-size: var(--text-sm);
    color: var(--color-text-primary);
  }

  .toast-close {
    font-size: var(--text-lg);
    color: var(--color-text-muted);
    line-height: 1;
    padding: 0;
    transition: color var(--duration-fast) var(--ease);
  }

  .toast-close:hover {
    color: var(--color-text-primary);
  }

  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateX(12px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }
</style>
