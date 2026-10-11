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

<div class="super-admin-layout">
  <!-- Independent Super Admin Topbar -->
  <header class="super-header">
    <div class="header-left">
      <div class="brand">
        <span class="wordmark">proctora</span>
        <span class="admin-chip">SUPER ADMIN</span>
      </div>
      <p class="tagline">System Audit & Centralized Event Logging</p>
    </div>

    <div class="header-right">
      <div class="live-pill" class:active={autoRefresh}>
        <span class="dot"></span>
        <label class="auto-refresh-toggle">
          <input type="checkbox" bind:checked={autoRefresh} />
          Auto-refresh (8s)
        </label>
      </div>

      <div class="user-info">
        <span class="user-email">{authStore.user?.email || 'superadmin@proctora.edu'}</span>
        <span class="role-badge">{authStore.user?.role || 'SUPER_ADMIN'}</span>
      </div>

      <Button
        variant="ghost"
        size="sm"
        onclick={async () => {
          await authStore.logout();
          push('/login');
        }}
      >
        Sign out
      </Button>
    </div>
  </header>

  <main class="super-main">
    <!-- Stat Cards Overview -->
    <section class="metrics-grid">
      <div class="metric-card">
        <span class="metric-label">Total Logs Recorded</span>
        <span class="metric-value">{stats.totalLogs.toLocaleString()}</span>
        <span class="metric-sub">Full immutable audit stream</span>
      </div>

      <div class="metric-card">
        <span class="metric-label">Unique Users Tracked</span>
        <span class="metric-value">{stats.uniqueUsers.toLocaleString()}</span>
        <span class="metric-sub">Students & Test Creator Admins</span>
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
      <div class="filter-row">
        <div class="search-box">
          <input
            type="text"
            placeholder="Search by username, email, event, or details..."
            bind:value={search}
            onkeydown={(e) => e.key === 'Enter' && handleFilterChange()}
          />
        </div>

        <div class="select-group">
          <select bind:value={selectedEventType} onchange={handleFilterChange}>
            <option value="all">All Event Types ({availableEventTypes.length})</option>
            {#each availableEventTypes as et}
              <option value={et}>{et}</option>
            {/each}
          </select>

          <select bind:value={timeframe} onchange={handleFilterChange}>
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="24h">Past 24 Hours</option>
            <option value="7d">Past 7 Days</option>
          </select>
        </div>

        <div class="action-buttons">
          <Button variant="primary" size="sm" onclick={handleFilterChange}>
            Apply Filters
          </Button>
          <Button variant="secondary" size="sm" onclick={resetFilters}>
            Reset
          </Button>
          <Button variant="ghost" size="sm" onclick={exportCsv}>
            Export CSV
          </Button>
        </div>
      </div>
    </section>

    <!-- Logs Table -->
    <section class="table-section">
      <div class="table-card">
        {#if isLoading && logs.length === 0}
          <div class="loading-state">
            <p>Loading system audit logs...</p>
          </div>
        {:else if logs.length === 0}
          <div class="empty-state">
            <p class="empty-title">No audit logs found</p>
            <p class="empty-desc">Try clearing filters or checking back as users perform actions.</p>
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
                  <th>Inspect</th>
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
                size="sm"
                disabled={page <= 1}
                onclick={() => { page--; loadLogs(); }}
              >
                Previous
              </Button>
              <span class="page-indicator">Page {page} of {totalPages}</span>
              <Button
                variant="secondary"
                size="sm"
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
    <div class="modal-backdrop" onclick={() => { selectedLog = null; }} role="dialog">
      <div class="modal-dialog" onclick={(e) => e.stopPropagation()}>
        <header class="modal-header">
          <div>
            <h3>Audit Event Inspector</h3>
            <p class="modal-sub">ID: {selectedLog.id}</p>
          </div>
          <button class="close-btn" onclick={() => { selectedLog = null; }}>✕</button>
        </header>

        <div class="modal-body">
          <div class="meta-grid">
            <div class="meta-item">
              <span class="meta-lbl">Event Type:</span>
              <span class="meta-val">{selectedLog.eventType}</span>
            </div>
            <div class="meta-item">
              <span class="meta-lbl">Timestamp:</span>
              <span class="meta-val">{new Date(selectedLog.timestamp).toISOString()}</span>
            </div>
            <div class="meta-item">
              <span class="meta-lbl">User:</span>
              <span class="meta-val">{selectedLog.username || 'N/A'} ({selectedLog.userEmail || 'N/A'})</span>
            </div>
            <div class="meta-item">
              <span class="meta-lbl">IP Address:</span>
              <span class="meta-val">{selectedLog.ipAddress || 'N/A'}</span>
            </div>
            {#if selectedLog.userAgent}
              <div class="meta-item full-width">
                <span class="meta-lbl">User Agent:</span>
                <span class="meta-val text-break">{selectedLog.userAgent}</span>
              </div>
            {/if}
          </div>

          <div class="json-box">
            <label class="json-label">Event Details Payload:</label>
            <pre class="json-code">{JSON.stringify(selectedLog.details, null, 2) || '{}'}</pre>
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
  .super-admin-layout {
    width: 100%;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    background-color: #0b0f19;
    color: #e5e7eb;
    font-family: var(--font-sans, system-ui, -apple-system, sans-serif);
  }

  /* Abstracted Header */
  .super-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 32px;
    background: #111827;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .header-left {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .wordmark {
    font-size: 20px;
    font-weight: 300;
    letter-spacing: 5px;
    text-transform: lowercase;
    color: #fff;
  }

  .admin-chip {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 1.5px;
    padding: 2px 8px;
    background: #3b82f6;
    color: #fff;
    border-radius: 4px;
  }

  .tagline {
    font-size: 12px;
    color: #9ca3af;
    margin: 0;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .live-pill {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 20px;
    font-size: 12px;
  }

  .live-pill .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #6b7280;
    transition: background 0.3s;
  }

  .live-pill.active .dot {
    background: #10b981;
    box-shadow: 0 0 8px #10b981;
  }

  .auto-refresh-toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    user-select: none;
    color: #d1d5db;
  }

  .user-info {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 2px;
  }

  .user-email {
    font-size: 13px;
    font-weight: 500;
    color: #f3f4f6;
  }

  .role-badge {
    font-size: 10px;
    color: #93c5fd;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  /* Main container */
  .super-main {
    flex: 1;
    padding: 24px 32px;
    display: flex;
    flex-direction: column;
    gap: 24px;
    max-width: 1600px;
    width: 100%;
    margin: 0 auto;
  }

  /* Metrics cards */
  .metrics-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 16px;
  }

  .metric-card {
    background: #111827;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    padding: 16px 20px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    transition: transform 0.2s, border-color 0.2s;
  }

  .metric-card:hover {
    border-color: rgba(255, 255, 255, 0.2);
  }

  .metric-label {
    font-size: 11px;
    font-weight: 600;
    color: #9ca3af;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .metric-value {
    font-size: 26px;
    font-weight: 700;
    color: #fff;
    font-family: var(--font-mono, monospace);
  }

  .metric-sub {
    font-size: 11px;
    color: #6b7280;
  }

  .metric-warning .metric-value {
    color: #f87171;
  }

  /* Filters panel */
  .filters-panel {
    background: #111827;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    padding: 14px 20px;
  }

  .filter-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px;
  }

  .search-box {
    flex: 2;
    min-width: 280px;
  }

  .search-box input {
    width: 100%;
    background: #1f2937;
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #f3f4f6;
    padding: 8px 14px;
    border-radius: 6px;
    font-size: 13px;
    outline: none;
  }

  .search-box input:focus {
    border-color: #3b82f6;
  }

  .select-group {
    display: flex;
    gap: 8px;
    flex: 1;
    min-width: 240px;
  }

  .select-group select {
    flex: 1;
    background: #1f2937;
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #f3f4f6;
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 13px;
    outline: none;
    cursor: pointer;
  }

  .action-buttons {
    display: flex;
    gap: 8px;
  }

  /* Table */
  .table-section {
    flex: 1;
  }

  .table-card {
    background: #111827;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .table-wrapper {
    overflow-x: auto;
  }

  .logs-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
    text-align: left;
  }

  .logs-table th {
    padding: 12px 16px;
    background: #1a2234;
    color: #9ca3af;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .logs-table td {
    padding: 12px 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    vertical-align: middle;
  }

  .logs-table tbody tr:hover {
    background: rgba(255, 255, 255, 0.02);
  }

  .time-cell {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .time-primary {
    color: #e5e7eb;
    font-size: 12px;
  }

  .time-raw {
    font-family: monospace;
    font-size: 10px;
    color: #6b7280;
  }

  .event-badge {
    display: inline-block;
    padding: 3px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.3px;
  }

  .badge-purple { background: rgba(168, 85, 247, 0.15); color: #c084fc; border: 1px solid rgba(168, 85, 247, 0.3); }
  .badge-indigo { background: rgba(99, 102, 241, 0.15); color: #818cf8; border: 1px solid rgba(99, 102, 241, 0.3); }
  .badge-blue   { background: rgba(59, 130, 246, 0.15); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.3); }
  .badge-success{ background: rgba(16, 185, 129, 0.15); color: #34d47a; border: 1px solid rgba(16, 185, 129, 0.3); }
  .badge-teal   { background: rgba(20, 184, 166, 0.15); color: #2dd4bf; border: 1px solid rgba(20, 184, 166, 0.3); }
  .badge-emerald{ background: rgba(16, 185, 129, 0.15); color: #6ee7b7; border: 1px solid rgba(16, 185, 129, 0.3); }
  .badge-warning{ background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.3); }
  .badge-danger { background: rgba(239, 68, 68, 0.15);  color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3); }
  .badge-gray   { background: rgba(156, 163, 175, 0.15);color: #9ca3af; border: 1px solid rgba(156, 163, 175, 0.3); }

  .user-cell {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .user-name {
    font-weight: 500;
    color: #f3f4f6;
  }

  .user-email-text {
    font-size: 11px;
    color: #9ca3af;
  }

  .ip-cell {
    font-family: monospace;
    font-size: 12px;
    color: #9ca3af;
  }

  .payload-cell {
    max-width: 320px;
  }

  .code-preview {
    font-family: monospace;
    font-size: 11px;
    color: #93c5fd;
    background: rgba(0, 0, 0, 0.25);
    padding: 2px 6px;
    border-radius: 4px;
    display: inline-block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 100%;
  }

  .inspect-btn {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #60a5fa;
    padding: 4px 10px;
    border-radius: 4px;
    font-size: 11px;
    cursor: pointer;
    transition: background 0.2s;
  }

  .inspect-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #93c5fd;
  }

  .muted-text {
    color: #6b7280;
    font-size: 12px;
  }

  /* Pagination */
  .pagination-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 20px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    background: #111827;
    font-size: 12px;
    color: #9ca3af;
  }

  .pagination-controls {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .page-indicator {
    font-size: 12px;
    color: #d1d5db;
  }

  .loading-state,
  .empty-state {
    padding: 60px 20px;
    text-align: center;
    color: #9ca3af;
  }

  .empty-title {
    font-size: 16px;
    font-weight: 600;
    color: #e5e7eb;
    margin-bottom: 4px;
  }

  .empty-desc {
    font-size: 13px;
    color: #6b7280;
  }

  /* Modal */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 20px;
  }

  .modal-dialog {
    background: #111827;
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 12px;
    width: 100%;
    max-width: 650px;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 16px 20px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .modal-header h3 {
    margin: 0;
    font-size: 16px;
    color: #fff;
  }

  .modal-sub {
    margin: 2px 0 0;
    font-size: 11px;
    color: #6b7280;
    font-family: monospace;
  }

  .close-btn {
    background: none;
    border: none;
    color: #9ca3af;
    font-size: 16px;
    cursor: pointer;
    padding: 4px;
  }

  .close-btn:hover {
    color: #fff;
  }

  .modal-body {
    padding: 20px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .meta-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px 16px;
    background: #1a2234;
    padding: 12px 16px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.05);
  }

  .meta-item {
    display: flex;
    flex-direction: column;
    font-size: 12px;
  }

  .meta-item.full-width {
    grid-column: span 2;
  }

  .meta-lbl {
    color: #9ca3af;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .meta-val {
    color: #f3f4f6;
    font-weight: 500;
  }

  .text-break {
    word-break: break-all;
    font-family: monospace;
    font-size: 11px;
  }

  .json-box {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .json-label {
    font-size: 11px;
    font-weight: 600;
    color: #9ca3af;
    text-transform: uppercase;
  }

  .json-code {
    background: #0d1117;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    padding: 14px;
    font-family: monospace;
    font-size: 12px;
    color: #a5d6ff;
    overflow-x: auto;
    max-height: 280px;
    margin: 0;
  }

  .modal-footer {
    padding: 14px 20px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    display: flex;
    justify-content: flex-end;
  }
</style>
