<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { push } from '../lib/router.svelte';
  import { api, getErrorMessage } from '../lib/api';
  import { authStore } from '../stores/auth.store.svelte';
  import { appStore } from '../stores/app.store.svelte';
  import Button from '../components/ui/Button.svelte';

  interface LogItem {
    id: string;
    eventType: string;
    userId: string | null;
    username: string | null;
    userEmail: string | null;
    timestamp: string;
    details: any;
    ipAddress: string | null;
    userAgent: string | null;
  }

  interface LogStats {
    totalLogs: number;
    uniqueUsers: number;
    authEvents: number;
    testEvents: number;
    anomalies: number;
  }

  let mounted = $state(false);
  let logs = $state<LogItem[]>([]);
  let total = $state(0);
  let availableEventTypes = $state<string[]>([]);
  let stats = $state<LogStats>({
    totalLogs: 0,
    uniqueUsers: 0,
    authEvents: 0,
    testEvents: 0,
    anomalies: 0,
  });

  let isLoading = $state(true);
  let autoRefresh = $state(false);
  let refreshTimer: any = null;

  // Filter states
  let search = $state('');
  let selectedEventType = $state('all');
  let filterUsername = $state('');
  let filterEmail = $state('');
  let timeframe = $state('all');

  // Pagination
  let page = $state(1);
  const pageSize = 25;

  // Selected log for detailed JSON modal
  let selectedLog = $state<LogItem | null>(null);

  const eventTypeBadges: Record<string, { label: string; class: string }> = {
    test_create: { label: 'Test Created', class: 'badge-purple' },
    test_edit: { label: 'Test Edited', class: 'badge-indigo' },
    test_delete: { label: 'Test Deleted', class: 'badge-danger' },
    test_attempt: { label: 'Test Attempt', class: 'badge-blue' },
    test_finish: { label: 'Test Finished', class: 'badge-success' },
    sign_up: { label: 'Sign Up', class: 'badge-teal' },
    sign_in: { label: 'Sign In', class: 'badge-teal' },
    log_out: { label: 'Log Out', class: 'badge-gray' },
    password_reset: { label: 'Password Reset', class: 'badge-emerald' },
    '2fa_setup': { label: '2FA Configured', class: 'badge-emerald' },
    admin_create: { label: 'Admin Created', class: 'badge-purple' },
    anomaly_detected: { label: 'Anomaly Flagged', class: 'badge-warning' },
    fullscreen_exit: { label: 'Fullscreen Exit', class: 'badge-warning' },
    fullscreen_event: { label: 'Fullscreen Event', class: 'badge-gray' },
    auto_logout: { label: 'Auto Logout', class: 'badge-danger' },
  };

  onMount(async () => {
    // Ensure user is authenticated and authorized (SUPER_ADMIN or ADMIN)
    if (!authStore.isAuthenticated) {
      appStore.addToast('Authentication required for Super Admin', 'error');
      push('/login');
      return;
    }
    requestAnimationFrame(() => {
      mounted = true;
    });
    await loadLogs();
  });

  onDestroy(() => {
    if (refreshTimer) clearInterval(refreshTimer);
  });

  $effect(() => {
    if (autoRefresh) {
      refreshTimer = setInterval(() => loadLogs(false), 8000);
    } else if (refreshTimer) {
      clearInterval(refreshTimer);
      refreshTimer = null;
    }
  });

  async function loadLogs(showLoading = true) {
    if (showLoading) isLoading = true;

    try {
      const params = new URLSearchParams();
      if (search.trim()) params.append('search', search.trim());
      if (selectedEventType !== 'all') params.append('eventType', selectedEventType);
      if (filterUsername.trim()) params.append('username', filterUsername.trim());
      if (filterEmail.trim()) params.append('userEmail', filterEmail.trim());

      if (timeframe === 'today') {
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        params.append('startDate', start.toISOString());
      } else if (timeframe === '24h') {
        const start = new Date(Date.now() - 24 * 60 * 60 * 1000);
        params.append('startDate', start.toISOString());
      } else if (timeframe === '7d') {
        const start = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        params.append('startDate', start.toISOString());
      }

      params.append('limit', String(pageSize));
      params.append('offset', String((page - 1) * pageSize));

      const res = await api.get(`/super-admin/logs?${params.toString()}`);
      const data = res.data.data;

      logs = data.logs || [];
      total = data.total || 0;
      if (data.eventTypes) availableEventTypes = data.eventTypes;
      if (data.stats) stats = data.stats;
    } catch (err) {
      const msg = getErrorMessage(err);
      appStore.addToast(`Failed to load logs: ${msg}`, 'error');
    } finally {
      if (showLoading) isLoading = false;
    }
  }

  function handleFilterChange() {
    page = 1;
    loadLogs(true);
  }

  function resetFilters() {
    search = '';
    selectedEventType = 'all';
    filterUsername = '';
    filterEmail = '';
    timeframe = 'all';
    page = 1;
    loadLogs(true);
  }

  function exportCsv() {
    if (logs.length === 0) {
      appStore.addToast('No logs available to export', 'info');
      return;
    }

    const headers = ['Timestamp', 'Event Type', 'Username', 'Email', 'IP Address', 'Details'];
    const rows = logs.map((l) => [
      `"${new Date(l.timestamp).toISOString()}"`,
      `"${l.eventType}"`,
      `"${l.username || ''}"`,
      `"${l.userEmail || ''}"`,
      `"${l.ipAddress || ''}"`,
      `"${JSON.stringify(l.details || {}).replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `proctora_audit_logs_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    appStore.addToast('Logs CSV exported successfully', 'success');
  }

  function formatTime(iso: string) {
    const d = new Date(iso);
    return d.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  }

  function getBadge(eventType: string) {
    return eventTypeBadges[eventType] || { label: eventType, class: 'badge-gray' };
  }

  const totalPages = $derived(Math.max(1, Math.ceil(total / pageSize)));
</script>

<div class="super-admin-page" class:visible={mounted}>
  <!-- Top Navigation Bar -->
  <header class="super-navbar">
    <div class="nav-left">
      <div
        class="nav-brand"
        onclick={() => push('/')}
        role="button"
        tabindex="0"
        onkeydown={(e) => e.key === 'Enter' && push('/')}
      >
        <svg
          class="nav-logo"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <path d="M9 12l2 2 4-4" />
        </svg>
        <span class="brand-wordmark">proctora</span>
      </div>
      <span class="nav-role-badge">SUPER ADMIN</span>
    </div>

    <div class="nav-right">
      <div class="live-pill" class:active={autoRefresh}>
        <span class="live-dot"></span>
        <label class="auto-refresh-label">
          <input type="checkbox" bind:checked={autoRefresh} />
          <span>Auto-refresh (8s)</span>
        </label>
      </div>

      <div class="user-info">
        <span class="user-email">{authStore.user?.email || 'superadmin@proctora.edu'}</span>
      </div>

      <Button variant="ghost" onclick={() => push('/dashboard')}>
        Dashboard
      </Button>

      <Button
        variant="secondary"
        onclick={async () => {
          await authStore.logout();
          push('/login');
        }}
      >
        Sign out
      </Button>
    </div>
  </header>

  <!-- Main Content Area -->
  <main class="super-content">
    <!-- Welcome Banner Section -->
    <section class="banner-section">
      <div class="banner-title-group">
        <h1 class="welcome-title">Super Administrator Audit Stream</h1>
        <p class="welcome-sub">
          Centralized immutable audit stream & real-time system event telemetry across all examinations
        </p>
      </div>
    </section>

    <!-- Metrics Grid -->
    <section class="metrics-grid">
      <div class="metric-card">
        <span class="metric-label">Total Logs Recorded</span>
        <span class="metric-value">{stats.totalLogs.toLocaleString()}</span>
        <span class="metric-sub">Full immutable audit stream</span>
      </div>

      <div class="metric-card">
        <span class="metric-label">Unique Users Tracked</span>
        <span class="metric-value">{stats.uniqueUsers.toLocaleString()}</span>
        <span class="metric-sub">Students & test creator administrators</span>
      </div>

      <div class="metric-card">
        <span class="metric-label">Exam Events</span>
        <span class="metric-value">{stats.testEvents.toLocaleString()}</span>
        <span class="metric-sub">Create, edit, attempt, finish</span>
      </div>

      <div class="metric-card">
        <span class="metric-label">Authentication Events</span>
        <span class="metric-value">{stats.authEvents.toLocaleString()}</span>
        <span class="metric-sub">Sign up, 2FA, sign in, reset</span>
      </div>

      <div class="metric-card metric-warning">
        <span class="metric-label">Flagged Anomalies</span>
        <span class="metric-value">{stats.anomalies.toLocaleString()}</span>
        <span class="metric-sub">Fullscreen exits & cheat alerts</span>
      </div>
    </section>

    <!-- Filter Control Panel -->
    <section class="filters-panel">
      <div class="filter-header">
        <div class="filter-title-group">
          <h2 class="panel-title">Audit Stream Filters</h2>
          <span class="panel-sub">Query events by keyword, event category, or time window</span>
        </div>
        <div class="filter-actions-top">
          <Button variant="ghost" onclick={resetFilters}>
            Reset Filters
          </Button>
          <Button variant="secondary" onclick={exportCsv}>
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              style="margin-right: 4px;"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            Export CSV
          </Button>
        </div>
      </div>

      <div class="filter-row">
        <div class="search-box">
          <svg
            class="search-icon"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input
            type="text"
            class="filter-input search-input"
            placeholder="Search username, email, event, or details..."
            bind:value={search}
            onkeydown={(e) => e.key === 'Enter' && handleFilterChange()}
          />
        </div>

        <div class="select-group">
          <select class="filter-select" bind:value={selectedEventType} onchange={handleFilterChange}>
            <option value="all">All Event Types ({availableEventTypes.length})</option>
            {#each availableEventTypes as et}
              <option value={et}>{et}</option>
            {/each}
          </select>

          <select class="filter-select" bind:value={timeframe} onchange={handleFilterChange}>
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="24h">Past 24 Hours</option>
            <option value="7d">Past 7 Days</option>
          </select>
        </div>

        <div class="filter-btn-group">
          <Button variant="primary" onclick={handleFilterChange}>
            Apply Filters
          </Button>
        </div>
      </div>
    </section>

    <!-- Logs Table Section -->
    <section class="table-section">
      <div class="table-card">
        <div class="table-header-strip">
          <div class="table-heading-group">
            <h3 class="table-title">Activity Stream</h3>
            <span class="count-pill">{total.toLocaleString()} records</span>
          </div>
          {#if isLoading}
            <div class="sync-indicator">
              <span class="sync-dot"></span>
              <span>Syncing feed...</span>
            </div>
          {/if}
        </div>

        {#if isLoading && logs.length === 0}
          <div class="loading-state">
            <span class="spinner-dot"></span>
            <p>Loading system audit logs...</p>
          </div>
        {:else if logs.length === 0}
          <div class="empty-state">
            <p class="empty-title">No audit logs found</p>
            <p class="empty-desc">No events match your current filter criteria or timeframe.</p>
            <div class="empty-action">
              <Button variant="secondary" onclick={resetFilters}>
                Reset Filters
              </Button>
            </div>
          </div>
        {:else}
          <div class="table-wrapper">
            <table class="logs-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Event Type</th>
                  <th>User / Email</th>
                  <th>IP Address</th>
                  <th>Details Payload</th>
                  <th class="th-action">Inspect</th>
                </tr>
              </thead>
              <tbody>
                {#each logs as log (log.id)}
                  {@const badge = getBadge(log.eventType)}
                  <tr>
                    <td class="time-cell">
                      <span class="time-primary">{formatTime(log.timestamp)}</span>
                      <span class="time-raw">{new Date(log.timestamp).toISOString().slice(11, 19)}</span>
                    </td>
                    <td>
                      <span class="event-badge {badge.class}">{badge.label}</span>
                    </td>
                    <td class="user-cell">
                      {#if log.username || log.userEmail}
                        <span class="user-name">{log.username || 'System User'}</span>
                        <span class="user-email-text">{log.userEmail || '—'}</span>
                      {:else}
                        <span class="muted-text">Anonymous / System</span>
                      {/if}
                    </td>
                    <td class="ip-cell">
                      <span>{log.ipAddress || '—'}</span>
                    </td>
                    <td class="payload-cell">
                      {#if log.details}
                        <code class="code-preview">
                          {JSON.stringify(log.details).slice(0, 75)}{JSON.stringify(log.details).length > 75 ? '...' : ''}
                        </code>
                      {:else}
                        <span class="muted-text">None</span>
                      {/if}
                    </td>
                    <td class="action-cell">
                      <button
                        type="button"
                        class="inspect-btn"
                        onclick={() => { selectedLog = log; }}
                      >
                        View JSON
                      </button>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>

          <!-- Pagination Bar -->
          <footer class="pagination-footer">
            <span class="pagination-info">
              Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, total)} of {total.toLocaleString()} total logs
            </span>

            <div class="pagination-controls">
              <Button
                variant="secondary"
                disabled={page <= 1}
                onclick={() => { page--; loadLogs(); }}
              >
                Previous
              </Button>
              <span class="page-indicator">Page {page} of {totalPages}</span>
              <Button
                variant="secondary"
                disabled={page >= totalPages}
                onclick={() => { page++; loadLogs(); }}
              >
                Next
              </Button>
            </div>
          </footer>
        {/if}
      </div>
    </section>
  </main>

  <!-- Detailed JSON Inspector Modal -->
  {#if selectedLog}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div
      class="modal-backdrop"
      onclick={() => { selectedLog = null; }}
      role="presentation"
    >
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
      <div
        class="modal-dialog"
        onclick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-inspector-title"
      >
        <header class="modal-header">
          <div>
            <h3 id="modal-inspector-title" class="modal-title">Audit Event Inspector</h3>
            <p class="modal-sub">Log ID: <code>{selectedLog.id}</code></p>
          </div>
          <button class="close-btn" onclick={() => { selectedLog = null; }} aria-label="Close modal">✕</button>
        </header>

        <div class="modal-body">
          <div class="meta-grid">
            <div class="meta-item">
              <span class="meta-lbl">Event Type</span>
              <span class="meta-val">{selectedLog.eventType}</span>
            </div>
            <div class="meta-item">
              <span class="meta-lbl">Timestamp</span>
              <span class="meta-val">{new Date(selectedLog.timestamp).toISOString()}</span>
            </div>
            <div class="meta-item">
              <span class="meta-lbl">User</span>
              <span class="meta-val">{selectedLog.username || 'N/A'} ({selectedLog.userEmail || 'N/A'})</span>
            </div>
            <div class="meta-item">
              <span class="meta-lbl">IP Address</span>
              <span class="meta-val">{selectedLog.ipAddress || 'N/A'}</span>
            </div>
            {#if selectedLog.userAgent}
              <div class="meta-item full-width">
                <span class="meta-lbl">User Agent</span>
                <span class="meta-val text-break">{selectedLog.userAgent}</span>
              </div>
            {/if}
          </div>

          <div class="json-box">
            <label class="json-label" for="json-payload-view">Event Details Payload</label>
            <pre id="json-payload-view" class="json-code">{JSON.stringify(selectedLog.details, null, 2) || '{}'}</pre>
          </div>
        </div>

        <footer class="modal-footer">
          <Button variant="secondary" onclick={() => { selectedLog = null; }}>
            Close
          </Button>
        </footer>
      </div>
    </div>
  {/if}
</div>

<style>
  .super-admin-page {
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    background-color: var(--color-bg);
    color: var(--color-text-primary);
    opacity: 0;
    transform: translateY(6px);
    transition: opacity 0.4s var(--ease), transform 0.4s var(--ease);
  }

  .super-admin-page.visible {
    opacity: 1;
    transform: translateY(0);
  }

  /* Navigation Bar — Warm Stone Proctora Aesthetic */
  .super-navbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-4) var(--space-8);
    background-color: var(--color-bg-elevated);
    border-bottom: 1px solid var(--color-border);
    position: sticky;
    top: 0;
    z-index: 50;
  }

  .nav-left {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .nav-brand {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    cursor: pointer;
    user-select: none;
  }

  .nav-logo {
    width: 20px;
    height: 20px;
    color: var(--color-text-primary);
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

  .live-pill {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: 4px 10px;
    background-color: var(--color-bg-subtle);
    border: 1px solid var(--color-border);
    border-radius: 9999px;
    font-size: var(--text-xs);
    color: var(--color-text-secondary);
  }

  .live-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background-color: var(--color-text-muted);
    transition: background-color var(--duration-fast) var(--ease);
  }

  .live-pill.active .live-dot {
    background-color: var(--color-success);
    box-shadow: 0 0 6px rgba(21, 128, 61, 0.5);
  }

  .auto-refresh-label {
    display: flex;
    align-items: center;
    gap: 4px;
    cursor: pointer;
    user-select: none;
    font-size: var(--text-xs);
  }

  .auto-refresh-label input {
    cursor: pointer;
  }

  .user-info {
    display: flex;
    align-items: center;
  }

  .user-email {
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--color-text-secondary);
  }

  /* Main Container */
  .super-content {
    flex: 1;
    max-width: 1400px;
    width: 100%;
    margin: 0 auto;
    padding: var(--space-8) var(--space-6);
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
  }

  /* Banner Section */
  .banner-section {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }

  .banner-title-group {
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

  /* Metrics Grid */
  .metrics-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
    gap: var(--space-4);
  }

  .metric-card {
    padding: var(--space-4) var(--space-5);
    background-color: var(--color-bg-elevated);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    display: flex;
    flex-direction: column;
    gap: 4px;
    box-shadow: var(--shadow-sm);
    transition: border-color var(--duration-fast) var(--ease);
  }

  .metric-card:hover {
    border-color: var(--color-border-focus);
  }

  .metric-label {
    font-size: var(--text-xs);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--color-text-secondary);
  }

  .metric-value {
    font-size: 1.75rem;
    font-weight: 600;
    color: var(--color-text-primary);
    font-family: var(--font-mono);
  }

  .metric-sub {
    font-size: var(--text-xs);
    color: var(--color-text-muted);
  }

  .metric-warning .metric-value {
    color: var(--color-error);
  }

  /* Filters Panel */
  .filters-panel {
    background-color: var(--color-bg-elevated);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    box-shadow: var(--shadow-sm);
    padding: var(--space-5);
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .filter-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid var(--color-border);
    padding-bottom: var(--space-3);
  }

  .filter-title-group {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .panel-title {
    font-size: var(--text-base);
    font-weight: 600;
    color: var(--color-text-primary);
    margin: 0;
  }

  .panel-sub {
    font-size: var(--text-xs);
    color: var(--color-text-secondary);
  }

  .filter-actions-top {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .filter-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-3);
  }

  .search-box {
    position: relative;
    flex: 2;
    min-width: 280px;
    display: flex;
    align-items: center;
  }

  .search-icon {
    position: absolute;
    left: var(--space-3);
    color: var(--color-text-muted);
    pointer-events: none;
  }

  .filter-input {
    width: 100%;
    padding: var(--space-2) var(--space-3) var(--space-2) 2.25rem;
    font-size: var(--text-sm);
    color: var(--color-text-primary);
    background-color: var(--color-bg-input);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    transition: border-color var(--duration-fast) var(--ease);
    outline: none;
  }

  .filter-input:focus {
    border-color: var(--color-border-focus);
  }

  .select-group {
    display: flex;
    gap: var(--space-2);
    flex: 1.5;
    min-width: 260px;
  }

  .filter-select {
    flex: 1;
    padding: var(--space-2) var(--space-3);
    font-size: var(--text-sm);
    color: var(--color-text-primary);
    background-color: var(--color-bg-input);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    transition: border-color var(--duration-fast) var(--ease);
    outline: none;
    cursor: pointer;
  }

  .filter-select:focus {
    border-color: var(--color-border-focus);
  }

  .filter-btn-group {
    display: flex;
    align-items: center;
  }

  /* Table Section */
  .table-section {
    flex: 1;
  }

  .table-card {
    background-color: var(--color-bg-elevated);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    box-shadow: var(--shadow-sm);
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .table-header-strip {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-3) var(--space-5);
    background-color: var(--color-bg-subtle);
    border-bottom: 1px solid var(--color-border);
  }

  .table-heading-group {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .table-title {
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--color-text-primary);
    margin: 0;
  }

  .count-pill {
    font-size: 0.6875rem;
    font-weight: 600;
    padding: 2px 8px;
    background-color: var(--color-bg-elevated);
    border: 1px solid var(--color-border);
    border-radius: 9999px;
    color: var(--color-text-secondary);
  }

  .sync-indicator {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--text-xs);
    color: var(--color-text-secondary);
  }

  .sync-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background-color: var(--color-accent);
    animation: pulse 1.2s infinite;
  }

  .table-wrapper {
    overflow-x: auto;
  }

  .logs-table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--text-sm);
    text-align: left;
  }

  .logs-table th {
    padding: var(--space-3) var(--space-4);
    background-color: var(--color-bg-subtle);
    color: var(--color-text-secondary);
    font-size: var(--text-xs);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    border-bottom: 1px solid var(--color-border);
    white-space: nowrap;
  }

  .logs-table td {
    padding: var(--space-3) var(--space-4);
    border-bottom: 1px solid var(--color-border);
    vertical-align: middle;
    color: var(--color-text-primary);
  }

  .logs-table tbody tr:hover {
    background-color: var(--color-bg-subtle);
  }

  .time-cell {
    display: flex;
    flex-direction: column;
    gap: 2px;
    white-space: nowrap;
  }

  .time-primary {
    color: var(--color-text-primary);
    font-size: var(--text-xs);
    font-weight: 500;
  }

  .time-raw {
    font-family: var(--font-mono);
    font-size: 0.6875rem;
    color: var(--color-text-muted);
  }

  /* Harmonious Stone Badges */
  .event-badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: var(--radius-sm);
    font-size: var(--text-xs);
    font-weight: 500;
    letter-spacing: 0.2px;
    line-height: 1.4;
    white-space: nowrap;
  }

  .badge-purple {
    background: #f5f3ff;
    color: #6b21a8;
    border: 1px solid #ddd6fe;
  }

  .badge-indigo {
    background: #eef2ff;
    color: #3730a3;
    border: 1px solid #c7d2fe;
  }

  .badge-blue {
    background: #eff6ff;
    color: #1e40af;
    border: 1px solid #bfdbfe;
  }

  .badge-success {
    background: #f0fdf4;
    color: #15803d;
    border: 1px solid #bbf7d0;
  }

  .badge-teal {
    background: #f0fdfa;
    color: #115e59;
    border: 1px solid #99f6e4;
  }

  .badge-emerald {
    background: #ecfdf5;
    color: #065f46;
    border: 1px solid #a7f3d0;
  }

  .badge-warning {
    background: #fffbeb;
    color: #92400e;
    border: 1px solid #fde68a;
  }

  .badge-danger {
    background: var(--color-error-bg);
    color: var(--color-error);
    border: 1px solid var(--color-error-border);
  }

  .badge-gray {
    background: var(--color-bg-subtle);
    color: var(--color-text-secondary);
    border: 1px solid var(--color-border);
  }

  .user-cell {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .user-name {
    font-weight: 500;
    color: var(--color-text-primary);
  }

  .user-email-text {
    font-size: var(--text-xs);
    color: var(--color-text-secondary);
  }

  .ip-cell {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--color-text-secondary);
    white-space: nowrap;
  }

  .payload-cell {
    max-width: 320px;
  }

  .code-preview {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--color-text-secondary);
    background: var(--color-bg-subtle);
    border: 1px solid var(--color-border);
    padding: 2px 6px;
    border-radius: var(--radius-sm);
    display: inline-block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 100%;
  }

  .th-action {
    text-align: right;
  }

  .action-cell {
    text-align: right;
    white-space: nowrap;
  }

  .inspect-btn {
    background: var(--color-bg-elevated);
    border: 1px solid var(--color-border);
    color: var(--color-text-primary);
    padding: 3px 10px;
    border-radius: var(--radius-sm);
    font-size: var(--text-xs);
    font-weight: 500;
    cursor: pointer;
    transition: background-color var(--duration-fast) var(--ease), border-color var(--duration-fast) var(--ease);
  }

  .inspect-btn:hover {
    background: var(--color-bg-subtle);
    border-color: var(--color-border-focus);
  }

  .muted-text {
    color: var(--color-text-muted);
    font-size: var(--text-xs);
  }

  /* Pagination Bar */
  .pagination-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-3) var(--space-5);
    background-color: var(--color-bg-subtle);
    border-top: 1px solid var(--color-border);
    font-size: var(--text-xs);
    color: var(--color-text-secondary);
  }

  .pagination-controls {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .page-indicator {
    font-size: var(--text-xs);
    color: var(--color-text-primary);
    font-weight: 500;
  }

  .loading-state,
  .empty-state {
    padding: var(--space-12) var(--space-4);
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
    color: var(--color-text-secondary);
  }

  .empty-title {
    font-size: var(--text-base);
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .empty-desc {
    font-size: var(--text-xs);
    color: var(--color-text-secondary);
    max-width: 380px;
    margin-bottom: var(--space-2);
  }

  .empty-action {
    margin-top: var(--space-2);
  }

  /* Modal Dialog */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background-color: rgba(28, 25, 23, 0.4);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: var(--space-4);
  }

  .modal-dialog {
    background-color: var(--color-bg-elevated);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    width: 100%;
    max-width: 680px;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: var(--shadow);
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: var(--space-4) var(--space-5);
    border-bottom: 1px solid var(--color-border);
    background-color: var(--color-bg-elevated);
  }

  .modal-title {
    margin: 0;
    font-size: var(--text-lg);
    font-weight: 500;
    color: var(--color-text-primary);
  }

  .modal-sub {
    margin: 2px 0 0;
    font-size: var(--text-xs);
    color: var(--color-text-secondary);
  }

  .modal-sub code {
    font-family: var(--font-mono);
    color: var(--color-text-primary);
  }

  .close-btn {
    background: none;
    border: none;
    color: var(--color-text-muted);
    font-size: 1.25rem;
    cursor: pointer;
    padding: 2px 6px;
    line-height: 1;
    border-radius: var(--radius-sm);
    transition: color var(--duration-fast) var(--ease);
  }

  .close-btn:hover {
    color: var(--color-text-primary);
  }

  .modal-body {
    padding: var(--space-5);
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .meta-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-3) var(--space-4);
    background-color: var(--color-bg-subtle);
    padding: var(--space-4);
    border-radius: var(--radius-sm);
    border: 1px solid var(--color-border);
  }

  .meta-item {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .meta-item.full-width {
    grid-column: span 2;
  }

  .meta-lbl {
    color: var(--color-text-secondary);
    font-size: 0.6875rem;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    font-weight: 500;
  }

  .meta-val {
    color: var(--color-text-primary);
    font-weight: 500;
    font-size: var(--text-sm);
  }

  .text-break {
    word-break: break-all;
    font-family: var(--font-mono);
    font-size: var(--text-xs);
  }

  .json-box {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .json-label {
    font-size: var(--text-xs);
    font-weight: 600;
    color: var(--color-text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .json-code {
    background-color: var(--color-bg-subtle);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    padding: var(--space-4);
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--color-text-primary);
    overflow-x: auto;
    max-height: 280px;
    margin: 0;
    line-height: 1.5;
  }

  .modal-footer {
    padding: var(--space-3) var(--space-5);
    border-top: 1px solid var(--color-border);
    display: flex;
    justify-content: flex-end;
    background-color: var(--color-bg-elevated);
  }
</style>
