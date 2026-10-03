<script lang="ts">
  import { onMount } from 'svelte';
  import { router, matchRoute, initRouter, type RoutesMap } from './router.svelte';

  interface Props {
    routes: RoutesMap;
  }

  let { routes }: Props = $props();

  onMount(() => {
    return initRouter();
  });

  const matched = $derived(matchRoute(router.path, routes));
  const ActiveComponent = $derived(matched?.component);
</script>

{#if matched && ActiveComponent}
  <ActiveComponent params={matched.params} />
{:else}
  <div class="not-found">
    <h2>404 - Page Not Found</h2>
    <p>The requested page does not exist.</p>
    <a href="/login" class="back-link">Return to Login</a>
  </div>
{/if}

<style>
  .not-found {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-3);
    min-height: 60vh;
    text-align: center;
  }

  .not-found h2 {
    font-size: var(--text-2xl);
    font-weight: 400;
    color: var(--color-text-primary);
  }

  .not-found p {
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
  }

  .back-link {
    font-size: var(--text-sm);
    color: var(--color-accent);
    text-decoration: underline;
    margin-top: var(--space-2);
  }
</style>
