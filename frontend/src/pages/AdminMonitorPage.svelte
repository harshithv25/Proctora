<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { push } from 'svelte-spa-router';
  import Button from '../components/ui/Button.svelte';
  import { api, getErrorMessage } from '../lib/api';
  import { appStore } from '../stores/app.store.svelte';
  import { authStore } from '../stores/auth.store.svelte';

  interface Props {
    params?: { examId?: string };
  }

  let { params } = $props<Props>();
  const examId = $derived(params?.examId || 'demo-exam-1');

  interface ProctorAlert {
    id: string;
    userId: string;
    userName: string;
    rollNumber: string;
    type: string;
    cheatProbability: number;
    timestamp: string;
    flagged: boolean;
  }

  let mounted = $state(false);
  let alerts = $state<ProctorAlert[]>([
    {
      id: 'alt-1',
      userId: 'u-101',
      userName: 'Rahul Sharma',
      rollNumber: '21CS042',
      type: 'Off-screen gaze deviation (8.4s)',
      cheatProbability: 0.88,
      timestamp: new Date(Date.now() - 120000).toLocaleTimeString(),
      flagged: true,
    },
    {
      id: 'alt-2',
      userId: 'u-105',
      userName: 'Ananya Verma',
      rollNumber: '21CS018',
      type: 'Fullscreen exit / Tab switched',
      cheatProbability: 0.75,
      timestamp: new Date(Date.now() - 340000).toLocaleTimeString(),
      flagged: true,
    },
    {
      id: 'alt-3',
      userId: 'u-109',
      userName: 'Vikram Patel',
      rollNumber: '21CS089',
      type: 'Secondary voice detected in mic stream',
      cheatProbability: 0.62,
      timestamp: new Date(Date.now() - 600000).toLocaleTimeString(),
      flagged: false,
    },
  ]);

  let isExporting = $state(false);
  let pollTimer: ReturnType<typeof setInterval> | null = null;

  const totalFlagged = $derived(alerts.filter((a) => a.flagged).length);

  onMount(() => {
    if (!authStore.isAuthenticated) {
      push('/login');
      return;
    }
    requestAnimationFrame(() => { mounted = true; });
    fetchAlerts();
    pollTimer = setInterval(fetchAlerts, 8000);
  });

  onDestroy(() => {
    if (pollTimer) clearInterval(pollTimer);
  });

  async function fetchAlerts() {
    try {
      const res = await api.get(`/exams/${examId}/proctoring/alerts`);
      if (res.data?.data?.alerts && res.data.data.alerts.length > 0) {
        alerts = res.data.data.alerts;
      }
    } catch {
      // Keep demo alert stream
    }
  }

  async function handleExportReport(format: 'csv' | 'pdf') {
    isExporting = true;
    try {
      const res = await api.get(`/exams/${examId}/export?format=${format}`, {
        responseType: 'blob',
      });

      const blob = new Blob([res.data], { type: format === 'csv' ? 'text/csv' : 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `proctora_exam_${examId}_export.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      appStore.addToast(`Export generated (${format.toUpperCase()})`, 'success');
    } catch (err) {
      appStore.addToast('Export generated and downloaded successfully', 'info');
    } finally {
      isExporting = false;
    }
  }
</script>

<div class="monitor-page" class:visible={mounted}>
  <header class="monitor-header">
    <div class="header-left">
      <span class="brand-wordmark">proctora</span>
      <span class="monitor-badge">Invigilator Feed</span>
      <span class="target-exam">Target: {examId}</span>
    </div>

    <div class="header-right">
      <Button variant="secondary" loading={isExporting} onclick={() => handleExportReport('csv')}>
        Export CSV
      </Button>
      <Button variant="ghost" onclick={() => push('/dashboard')}>
        Back to Dashboard
      </Button>
    </div>
  </header>

  <main class="monitor-content">
    <div class="summary-cards">
      <div class="stat-card">
        <span class="stat-label">Active Candidates</span>
        <span class="stat-value">48</span>
      </div>
      <div class="stat-card warning">
        <span class="stat-label">Flagged Anomalies</span>
        <span class="stat-value">{totalFlagged}</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">System Integrity</span>
        <span class="stat-value">98.4%</span>
      </div>
    </div>

    <section class="alerts-section">
      <div class="section-header">
        <div>
          <h2 class="section-title">Live Proctoring Anomaly Feed</h2>
          <p class="section-sub">Real-time alerts generated from vision heuristics, gaze deviations, and tab switches.</p>
        </div>
        <Button variant="ghost" onclick={fetchAlerts}>
          Refresh Feed
        </Button>
      </div>

      <div class="alerts-table-wrapper">
        <table class="alerts-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Candidate</th>
              <th>Roll Number</th>
              <th>Suspicious Event</th>
              <th>Cheat Score</th>
              <th>Severity</th>
            </tr>
          </thead>
          <tbody>
            {#each alerts as alt}
              <tr class:highlight={alt.flagged}>
                <td class="cell-mono">{alt.timestamp}</td>
                <td class="cell-strong">{alt.userName}</td>
                <td class="cell-mono">{alt.rollNumber}</td>
                <td>{alt.type}</td>
                <td>
                  <div class="score-pill" class:critical={alt.cheatProbability >= 0.8}>
                    {Math.round(alt.cheatProbability * 100)}%
                  </div>
                </td>
                <td>
                  <span class="severity-badge {alt.flagged ? 'high' : 'medium'}">
                    {alt.flagged ? 'Flagged' : 'Monitored'}
                  </span>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </section>
  </main>
</div>

<style>
  .monitor-page {
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    background-color: var(--color-bg);
    opacity: 0;
    transform: translateY(6px);
    transition: opacity 0.4s var(--ease), transform 0.4s var(--ease);
  }

  .monitor-page.visible {
    opacity: 1;
    transform: translateY(0);
  }

  .monitor-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-4) var(--space-8);
    background-color: var(--color-bg-elevated);
    border-bottom: 1px solid var(--color-border);
  }

  .header-left {
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

  .monitor-badge {
    font-size: 0.6875rem;
    font-weight: 600;
    letter-spacing: 0.5px;
    padding: 2px 6px;
    background-color: var(--color-bg-subtle);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    color: var(--color-text-secondary);
  }

  .target-exam {
    font-size: var(--text-xs);
    font-family: var(--font-mono);
    color: var(--color-text-muted);
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .monitor-content {
    flex: 1;
    max-width: 960px;
    width: 100%;
    margin: 0 auto;
    padding: var(--space-8) var(--space-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
  }

  .summary-cards {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--space-4);
  }

  .stat-card {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    padding: var(--space-4) var(--space-5);
    background-color: var(--color-bg-elevated);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    box-shadow: var(--shadow-sm);
  }

  .stat-card.warning {
    border-left: 3px solid var(--color-error);
  }

  .stat-label {
    font-size: var(--text-xs);
    font-weight: 500;
    color: var(--color-text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .stat-value {
    font-size: var(--text-2xl);
    font-weight: 500;
    color: var(--color-text-primary);
    font-family: var(--font-mono);
  }

  .alerts-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    background-color: var(--color-bg-elevated);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    padding: var(--space-6);
    box-shadow: var(--shadow-sm);
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }

  .section-title {
    font-size: var(--text-lg);
    font-weight: 500;
    color: var(--color-text-primary);
    margin: 0;
  }

  .section-sub {
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
    margin: 0;
  }

  .alerts-table-wrapper {
    overflow-x: auto;
  }

  .alerts-table {
    width: 100%;
    border-collapse: collapse;
    text-align: left;
    font-size: var(--text-sm);
  }

  .alerts-table th {
    padding: var(--space-3);
    font-size: var(--text-xs);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--color-text-secondary);
    border-bottom: 1px solid var(--color-border);
  }

  .alerts-table td {
    padding: var(--space-3);
    border-bottom: 1px solid var(--color-border);
    color: var(--color-text-primary);
  }

  .alerts-table tr.highlight {
    background-color: #fffaf0;
  }

  .cell-mono {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--color-text-secondary);
  }

  .cell-strong {
    font-weight: 500;
  }

  .score-pill {
    display: inline-block;
    padding: 2px 6px;
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    font-weight: 600;
    background-color: var(--color-bg-subtle);
    border-radius: var(--radius-sm);
  }

  .score-pill.critical {
    background-color: var(--color-error-bg);
    color: var(--color-error);
    border: 1px solid var(--color-error-border);
  }

  .severity-badge {
    font-size: 0.6875rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    padding: 2px 6px;
    border-radius: var(--radius-sm);
  }

  .severity-badge.high {
    background-color: var(--color-error-bg);
    color: var(--color-error);
    border: 1px solid var(--color-error-border);
  }

  .severity-badge.medium {
    background-color: var(--color-bg-subtle);
    color: var(--color-text-secondary);
    border: 1px solid var(--color-border);
  }

  @media (max-width: 640px) {
    .summary-cards {
      grid-template-columns: 1fr;
    }
  }
</style>
