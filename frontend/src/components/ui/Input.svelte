<!--
  Reusable text input component.
  Minimalistic with subtle border, smooth focus transitions,
  and optional error message display.
-->
<script lang="ts">
  interface Props {
    id: string;
    type?: string;
    label: string;
    value: string;
    placeholder?: string;
    error?: string;
    disabled?: boolean;
    autocomplete?: string;
    oninput?: (value: string) => void;
  }

  let {
    id,
    type = 'text',
    label,
    value,
    placeholder = '',
    error = '',
    disabled = false,
    autocomplete = 'off',
    oninput,
  }: Props = $props();
</script>

<div class="input-group" class:has-error={!!error}>
  <label for={id}>{label}</label>
  <input
    {id}
    {type}
    {value}
    {placeholder}
    {disabled}
    {autocomplete}
    oninput={(e) => oninput?.((e.target as HTMLInputElement).value)}
  />
  {#if error}
    <span class="error-text">{error}</span>
  {/if}
</div>

<style>
  .input-group {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    width: 100%;
  }

  label {
    font-size: var(--text-xs);
    font-weight: 500;
    color: var(--color-text-secondary);
    letter-spacing: 0.3px;
    text-transform: uppercase;
  }

  input {
    width: 100%;
    padding: var(--space-3) var(--space-3);
    font-size: var(--text-base);
    color: var(--color-text-primary);
    background: var(--color-bg-input);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    outline: none;
    transition:
      border-color var(--duration-fast) var(--ease),
      box-shadow var(--duration-fast) var(--ease);
  }

  input::placeholder {
    color: var(--color-text-muted);
  }

  input:focus {
    border-color: var(--color-border-focus);
    box-shadow: 0 0 0 2px rgba(168, 162, 158, 0.15);
  }

  input:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .has-error input {
    border-color: var(--color-error);
  }

  .has-error input:focus {
    box-shadow: 0 0 0 2px rgba(185, 28, 28, 0.1);
  }

  .error-text {
    font-size: var(--text-xs);
    color: var(--color-error);
  }
</style>
