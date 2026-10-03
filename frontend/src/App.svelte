<script lang="ts">
  import Router from './lib/Router.svelte';
  import { replace } from './lib/router.svelte';
  import { onMount } from 'svelte';
  import PageLoader from './components/layout/PageLoader.svelte';
  import ToastContainer from './components/layout/ToastContainer.svelte';
  import LoginPage from './pages/LoginPage.svelte';
  import RegisterPage from './pages/RegisterPage.svelte';
  import TwoFactorSetupPage from './pages/TwoFactorSetupPage.svelte';
  import DashboardPage from './pages/DashboardPage.svelte';
  import DeviceCheckPage from './pages/DeviceCheckPage.svelte';
  import ExamPortalPage from './pages/ExamPortalPage.svelte';
  import ExamSubmittedPage from './pages/ExamSubmittedPage.svelte';
  import AdminExamsPage from './pages/AdminExamsPage.svelte';
  import AdminMonitorPage from './pages/AdminMonitorPage.svelte';

  const routes = {
    '/login': LoginPage,
    '/register': RegisterPage,
    '/2fa-setup': TwoFactorSetupPage,
    '/dashboard': DashboardPage,
    '/exams/:examId/device-check': DeviceCheckPage,
    '/exams/:examId/portal': ExamPortalPage,
    '/exams/:examId/submitted': ExamSubmittedPage,
    '/admin/exams': AdminExamsPage,
    '/admin/exams/:examId/monitor': AdminMonitorPage,
  };

  import { appStore } from './stores/app.store.svelte';

  onMount(() => {
    setTimeout(() => appStore.setPageLoading(false), 200);
    if (window.location.pathname === '/' || window.location.pathname === '') {
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
    width: 100%;
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
  }
</style>
