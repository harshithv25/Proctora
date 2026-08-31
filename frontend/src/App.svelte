<script lang="ts">
  import Router from 'svelte-spa-router';
  import { replace } from 'svelte-spa-router';
  import { onMount } from 'svelte';
  import PageLoader from './components/layout/PageLoader.svelte';
  import ToastContainer from './components/layout/ToastContainer.svelte';
  import LoginPage from './pages/LoginPage.svelte';
  import RegisterPage from './pages/RegisterPage.svelte';

  const routes = {
    '/login': LoginPage,
    '/register': RegisterPage,
  };

  onMount(() => {
    if (!window.location.hash || window.location.hash === '#/' || window.location.hash === '#') {
      replace('/login');
    }
  });
</script>

<PageLoader />
<ToastContainer />

<main>
  <Router {routes} />
</main>

<style>
  main {
    flex: 1;
    display: flex;
    flex-direction: column;
  }
</style>
