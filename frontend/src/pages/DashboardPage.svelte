<script lang="ts">
  import { onMount } from 'svelte';
  import { push } from 'svelte-spa-router';
  import Button from '../components/ui/Button.svelte';
  import { authStore } from '../stores/auth.store.svelte';
  import { appStore } from '../stores/app.store.svelte';

  let mounted = $state(false);

  onMount(() => {
    if (!authStore.isAuthenticated) {
      push('/login');
      return;
    }
    requestAnimationFrame(() => { mounted = true; });
  });

  async function handleLogout() {
    await authStore.logout();
    appStore.addToast('Logged out successfully', 'info');
    push('/login');
  }
</script>

<div class="dashboard-page" class:visible={mounted}>
  <header class="dash-navbar">
    <div class="nav-left">
      <span class="brand-wordmark">proctora</span>
      <span class="nav-role-badge">{authStore.user?.role || 'CANDIDATE'}</span>
    </div>
    <div class="nav-right">
      <span class="user-name">{authStore.user?.name || 'User'}</span>
      <Button variant="ghost" onclick={() => push('/2fa-setup')}>
        2FA Security
      </Button>
      <Button variant="secondary" onclick={handleLogout}>
        Sign out
      </Button>
    </div>
  </header>

  <main class="dash-content">
    <section class="welcome-banner">
      <h1 class="welcome-title">Welcome, {authStore.user?.name || 'Student'}</h1>
      <p class="welcome-sub">
        {#if authStore.user?.role === 'ADMIN'}
          Examination Administration & Real-Time Monitoring Portal
        {:else}
          Upcoming scheduled examinations and active session testing
        {/if}
      </p>
    </section>

    {#if authStore.user?.role === 'ADMIN'}
      <div class="cards-grid">
        <div class="dash-card">
          <div class="card-header">
            <span class="card-badge">Management</span>
            <h2 class="card-title">Exam Configuration</h2>
            <p class="card-desc">Create exams, upload question banks, configure seating arrangements, and set accommodations.</p>
          </div>
          <div class="card-footer">
            <Button variant="primary" fullWidth onclick={() => push('/admin/exams')}>
              Open Exam Manager
            </Button>
          </div>
        </div>

        <div class="dash-card">
          <div class="card-header">
            <span class="card-badge">Live Invigilation</span>
            <h2 class="card-title">Proctoring Monitor</h2>
            <p class="card-desc">Review real-time anomaly alerts, gaze deviations, suspicious focus blurs, and candidate reports.</p>
          </div>
          <div class="card-footer">
            <Button variant="secondary" fullWidth onclick={() => push('/admin/exams/demo-exam-1/monitor')}>
              Open Proctoring Feed
            </Button>
          </div>
        </div>
      </div>
    {:else}
      <div class="cards-grid">
        <div class="dash-card exam-active-card">
          <div class="card-header">
            <div class="status-indicator">
              <span class="status-dot"></span>
              <span class="status-text">Active Session Ready</span>
            </div>
            <h2 class="card-title">Midterm Examination: Algorithms & Data Structures</h2>
            <p class="card-desc">
              Duration: 120 minutes • Automated webcam proctoring • Fullscreen locked
            </p>
          </div>
          <div class="card-metadata">
            <div class="meta-row">
              <span class="meta-label">Candidate Roll:</span>
              <span class="meta-value">{authStore.user?.rollNumber || '21CS001'}</span>
            </div>
            <div class="meta-row">
              <span class="meta-label">System Stage:</span>
              <span class="meta-value">Pre-Check Required</span>
            </div>
          </div>
          <div class="card-footer">
            <Button variant="primary" fullWidth onclick={() => push('/exams/demo-exam-1/device-check')}>
              Start Device Diagnostics
            </Button>
          </div>
        </div>

        <div class="dash-card">
          <div class="card-header">
            <span class="card-badge">Information</span>
            <h2 class="card-title">Proctoring Guidelines</h2>
            <p class="card-desc">
              Ensure your webcam and microphone are operational. Keep gaze centered on the screen. Switching tabs or exiting fullscreen triggers instant invigilator telemetry alerts.
            </p>
          </div>
          <div class="card-footer">
            <Button variant="ghost" fullWidth onclick={() => appStore.addToast('Hardware requirements: 720p webcam, microphone, latest Chromium/Firefox browser', 'info')}>
              View Checklist
            </Button>
          </div>
        </div>
      </div>
    {/if}
  </main>
</div>

<style>
  .dashboard-page {
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    background-color: var(--color-bg);
    opacity: 0;
    transform: translateY(6px);
    transition: opacity 0.4s var(--ease), transform 0.4s var(--ease);
  }

  .dashboard-page.visible {
    opacity: 1;
    transform: translateY(0);
  }

  .dash-navbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-4) var(--space-8);
    background-color: var(--color-bg-elevated);
    border-bottom: 1px solid var(--color-border);
  }

  .nav-left {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .brand-wordmark {
    font-size: var(--text-lg);
    font-weight: 300;
    letter-spacing: 4px;
    text-transform: lowercase;
    color: var(--color-text-primary);
  }

  .nav-role-badge {
    font-size: 0.6875rem;
    font-weight: 600;
    letter-spacing: 0.5px;
    padding: 2px 6px;
    background-color: var(--color-bg-subtle);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    color: var(--color-text-secondary);
  }

  .nav-right {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .user-name {
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--color-text-primary);
  }

  .dash-content {
    flex: 1;
    max-width: 960px;
    width: 100%;
    margin: 0 auto;
    padding: var(--space-8) var(--space-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-8);
  }

  .welcome-banner {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .welcome-title {
    font-size: var(--text-2xl);
    font-weight: 400;
    letter-spacing: -0.3px;
    color: var(--color-text-primary);
    margin: 0;
  }

  .welcome-sub {
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
    margin: 0;
  }

  .cards-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
    gap: var(--space-6);
  }

  .dash-card {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: var(--space-6);
    background-color: var(--color-bg-elevated);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    box-shadow: var(--shadow-sm);
    gap: var(--space-5);
  }

  .card-header {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .card-badge {
    align-self: flex-start;
    font-size: var(--text-xs);
    font-weight: 500;
    color: var(--color-text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .status-indicator {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background-color: var(--color-success);
  }

  .status-text {
    font-size: var(--text-xs);
    font-weight: 500;
    color: var(--color-success);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .card-title {
    font-size: var(--text-lg);
    font-weight: 500;
    color: var(--color-text-primary);
    margin: 0;
  }

  .card-desc {
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
    line-height: 1.5;
    margin: 0;
  }

  .card-metadata {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-3);
    background-color: var(--color-bg-subtle);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
  }

  .meta-row {
    display: flex;
    justify-content: space-between;
    font-size: var(--text-xs);
  }

  .meta-label {
    color: var(--color-text-secondary);
  }

  .meta-value {
    font-weight: 500;
    color: var(--color-text-primary);
    font-family: var(--font-mono);
  }

  .card-footer {
    display: flex;
  }

  @media (max-width: 640px) {
    .dash-navbar {
      padding: var(--space-3) var(--space-4);
      flex-direction: column;
      align-items: flex-start;
      gap: var(--space-3);
    }
  }
</style>
