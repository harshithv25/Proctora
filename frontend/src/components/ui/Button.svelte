<!--
  Reusable button component.
  Variants: primary (filled dark), secondary (outlined), ghost (text-only).
  Includes loading spinner state.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    variant?: 'primary' | 'secondary' | 'ghost';
    type?: 'button' | 'submit' | 'reset';
    disabled?: boolean;
    loading?: boolean;
    fullWidth?: boolean;
    onclick?: () => void;
    children: Snippet;
  }

  let {
    variant = 'primary',
    type = 'button',
    disabled = false,
    loading = false,
    fullWidth = false,
    onclick,
    children,
  }: Props = $props();
</script>

<button
  {type}
  class="btn btn-{variant}"
  class:full-width={fullWidth}
  disabled={disabled || loading}
  {onclick}
>
  {#if loading}
    <span class="spinner"></span>
  {/if}
  <span class="btn-text" class:invisible={loading}>
    {@render children()}
  </span>
</button>

<style>
  .btn {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-5);
    font-size: var(--text-base);
    font-weight: 500;
    letter-spacing: 0.2px;
    border-radius: var(--radius);
    transition:
      background-color var(--duration-fast) var(--ease),
      border-color var(--duration-fast) var(--ease),
      color var(--duration-fast) var(--ease),
      opacity var(--duration-fast) var(--ease);
    white-space: nowrap;
    user-select: none;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .full-width {
    width: 100%;
  }

  /* Primary — dark fill */
  .btn-primary {
    background-color: var(--color-accent);
    color: var(--color-text-inverse);
    border: 1px solid var(--color-accent);
  }

  .btn-primary:not(:disabled):hover {
    background-color: var(--color-accent-hover);
    border-color: var(--color-accent-hover);
  }

  /* Secondary — outlined */
  .btn-secondary {
    background-color: transparent;
    color: var(--color-text-primary);
    border: 1px solid var(--color-border);
  }

  .btn-secondary:not(:disabled):hover {
    background-color: var(--color-bg-subtle);
    border-color: var(--color-border-focus);
  }

  /* Ghost — text only */
  .btn-ghost {
    background-color: transparent;
    color: var(--color-text-secondary);
    border: 1px solid transparent;
  }

  .btn-ghost:not(:disabled):hover {
    color: var(--color-text-primary);
    background-color: var(--color-bg-subtle);
  }

  /* Loading spinner */
  .spinner {
    position: absolute;
    width: 16px;
    height: 16px;
    border: 2px solid transparent;
    border-top-color: currentColor;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .invisible {
    visibility: hidden;
  }
</style>
