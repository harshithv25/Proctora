<!--
  Full-page loading screen.
  Displayed on initial page load with a smooth fade-out animation.
  Uses the Proctora wordmark + a minimal pulse animation with a strict failsafe auto-dismiss.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { appStore } from '../../stores/app.store.svelte';

  let visible = $state(true);
  let fadingOut = $state(false);

  function dismiss() {
    if (fadingOut) return;
    fadingOut = true;
    setTimeout(() => {
      visible = false;
      appStore.setPageLoading(false);
    }, 300);
  }

  onMount(() => {
    const timer = setTimeout(() => {
      dismiss();
    }, 450);
    return () => clearTimeout(timer);
  });

  $effect(() => {
    if (!appStore.isPageLoading && visible && !fadingOut) {
      dismiss();
    }
  });
</script>

{#if visible}
  <div class="page-loader" class:fading-out={fadingOut}>
    <div class="loader-content">
      <div class="wordmark">proctora</div>
      <div class="loader-bar">
        <div class="loader-bar-fill"></div>
      </div>
    </div>
  </div>
{/if}

<style>
  .page-loader {
    position: fixed;
    inset: 0;
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: var(--color-bg);
    transition: opacity 0.3s var(--ease);
  }

  .page-loader.fading-out {
    opacity: 0;
    pointer-events: none;
  }

  .loader-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-6);
  }

  .wordmark {
    font-size: var(--text-2xl);
    font-weight: 300;
    letter-spacing: 6px;
    text-transform: lowercase;
    color: var(--color-text-primary);
    animation: fadeIn 0.4s var(--ease) both;
  }

  .loader-bar {
    width: 120px;
    height: 2px;
    background-color: var(--color-border);
    border-radius: var(--radius);
    overflow: hidden;
  }

  .loader-bar-fill {
    width: 40%;
    height: 100%;
    background-color: var(--color-text-muted);
    border-radius: var(--radius);
    animation: slide 1.2s var(--ease) infinite;
  }

  @keyframes slide {
    0% {
      transform: translateX(-100%);
    }
    100% {
      transform: translateX(350%);
    }
  }
</style>
