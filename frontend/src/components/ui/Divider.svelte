<!--
  Horizontal divider with optional centered text label.
  Used for "or" separators in auth forms.
-->
<script lang="ts">
  interface Props {
    text?: string;
  }

  let { text = '' }: Props = $props();
</script>

<div class="divider">
  <span class="line"></span>
  {#if text}
    <span class="label">{text}</span>
  {/if}
  <span class="line"></span>
</div>

<style>
  .divider {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    width: 100%;
    margin: var(--space-2) 0;
  }

  .line {
    flex: 1;
    height: 1px;
    background-color: var(--color-border);
  }

  .label {
    font-size: var(--text-xs);
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    white-space: nowrap;
  }
</style>
