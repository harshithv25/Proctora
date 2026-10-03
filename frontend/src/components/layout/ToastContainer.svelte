<!--
  Toast notification container.
  Renders toasts as flying bubble notifications floating at the bottom-center of the screen.
  Each toast auto-dismisses after 4 seconds.
-->
<script lang="ts">
  import { appStore } from '../../stores/app.store.svelte';
</script>

{#if appStore.toasts.length > 0}
  <div class="toast-container" aria-live="polite">
    {#each appStore.toasts as toast (toast.id)}
      <div class="toast-bubble toast-{toast.type}">
        <span class="bubble-indicator"></span>
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
    bottom: var(--space-6);
    left: 50%;
    transform: translateX(-50%);
    z-index: 10000;
    display: flex;
    flex-direction: column-reverse;
    align-items: center;
    gap: var(--space-2);
    pointer-events: none;
    max-width: 90vw;
  }

  .toast-bubble {
    pointer-events: auto;
    display: inline-flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-2) var(--space-4);
    background: rgba(28, 25, 23, 0.94);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    color: #fafaf9;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 9999px;
    box-shadow:
      0 12px 28px -4px rgba(0, 0, 0, 0.22),
      0 6px 12px -2px rgba(0, 0, 0, 0.14);
    animation: flyBubble 0.38s cubic-bezier(0.16, 1, 0.3, 1) both;
    white-space: nowrap;
  }

  .bubble-indicator {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .toast-info .bubble-indicator {
    background-color: #a8a29e;
  }

  .toast-success .bubble-indicator {
    background-color: #22c55e;
    box-shadow: 0 0 6px rgba(34, 197, 94, 0.6);
  }

  .toast-error .bubble-indicator {
    background-color: #ef4444;
    box-shadow: 0 0 6px rgba(239, 68, 68, 0.6);
  }

  .toast-message {
    font-size: var(--text-xs);
    font-weight: 500;
    letter-spacing: 0.2px;
    color: #fafaf9;
  }

  .toast-close {
    font-size: var(--text-base);
    color: #a8a29e;
    line-height: 1;
    padding: 0;
    background: transparent;
    border: none;
    cursor: pointer;
    margin-left: var(--space-1);
    transition: color var(--duration-fast) var(--ease);
  }

  .toast-close:hover {
    color: #fafaf9;
  }

  @keyframes flyBubble {
    0% {
      opacity: 0;
      transform: translateY(24px) scale(0.88);
    }
    65% {
      transform: translateY(-4px) scale(1.02);
    }
    100% {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }
</style>
