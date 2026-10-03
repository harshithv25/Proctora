<script lang="ts">
  import { onMount } from 'svelte';
  import { push } from '../lib/router.svelte';
  import Button from '../components/ui/Button.svelte';
  import { authStore } from '../stores/auth.store.svelte';
  import { appStore } from '../stores/app.store.svelte';
  import { api } from '../lib/api';

  let mounted = $state(false);
  let activeExams = $state<any[]>([]);
  let isLoadingExams = $state(false);

  onMount(async () => {
    if (!authStore.isAuthenticated) {
      push('/login');
      return;
    }
    requestAnimationFrame(() => { mounted = true; });

    if (authStore.user?.role === 'ADMIN') {
      await loadExams();
    }
  });

  async function loadExams() {
    isLoadingExams = true;
    try {
      const res = await api.get('/exams');
      activeExams = res.data?.data?.exams || [];
    } catch {
      appStore.addToast('Failed to load active exams', 'error');
    } finally {
      isLoadingExams = false;
    }
  }

  function copyPortalUrl(exam: any) {
    const testId = exam.testId || exam.id;
    const link = `${window.location.origin}/exams/${testId}/portal`;
    navigator.clipboard.writeText(link);
    appStore.addToast('Copied test portal link to clipboard', 'success');
  }

  function copyTestId(testId: string) {
    navigator.clipboard.writeText(testId);
    appStore.addToast(`Copied Test ID: ${testId}`, 'success');
  }

  function isExamActive(exam: any): boolean {
    if (!exam.startTime || !exam.endTime) return true;
    const now = new Date();
    const start = new Date(exam.startTime);
    const end = new Date(exam.endTime);
    return now >= start && now <= end;
  }

  let candidateExamInput = $state('');

  function handleProceedToExam() {
    const raw = candidateExamInput.trim();
    if (!raw) {
      appStore.addToast('Please enter an exam link or Test ID', 'error');
      return;
    }

    // Extract test ID or exam ID from URL or bare ID
    let extractedId = raw;
    const urlPattern = /(?:exams\/)([a-zA-Z0-9_-]+)/;
    const match = raw.match(urlPattern);
    if (match && match[1]) {
      extractedId = match[1];
    } else {
      // Clean path or pure ID
      extractedId = raw.replace(/^https?:\/\/[^/]+\/?/, '').replace(/^\/+|\/+$/g, '');
      const pathParts = extractedId.split('/');
      if (pathParts.length > 0) {
        extractedId = pathParts[pathParts.length - 1];
        if (extractedId.toLowerCase() === 'portal' && pathParts.length > 1) {
          extractedId = pathParts[pathParts.length - 2];
        }
      }
    }

    if (!extractedId || extractedId.length < 2) {
      appStore.addToast('Invalid exam link or Test ID format', 'error');
      return;
    }

    push(`/exams/${extractedId}/portal`);
  }

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
      <h1 class="welcome-title">Welcome, {authStore.user?.name || 'Administrator'}</h1>
      <p class="welcome-sub">
        {#if authStore.user?.role === 'ADMIN'}
          Institutional Examination Control & Real-Time Test Overview
        {:else}
          Upcoming scheduled examinations and active session testing
        {/if}
      </p>
    </section>

    {#if authStore.user?.role === 'ADMIN'}
      <!-- KPI Stats Strip -->
      <div class="stats-banner">
        <div class="stat-card">
          <span class="stat-label">Active & Configured Tests</span>
          <span class="stat-value">{activeExams.length}</span>
          <span class="stat-sub">Ready in system registry</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Total Seating Capacity</span>
          <span class="stat-value">
            {activeExams.reduce((sum, e) => sum + (e._count?.seatingPlan || 0), 0)}
          </span>
          <span class="stat-sub">Physical desks mapped</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Candidate Submissions</span>
          <span class="stat-value">
            {activeExams.reduce((sum, e) => sum + (e._count?.responses || 0), 0)}
          </span>
          <span class="stat-sub">Completed candidate tests</span>
        </div>
      </div>

      <!-- ACTIVE EXAMINATIONS SECTION DIRECTLY ACCESSIBLE -->
      <section class="active-tests-section">
        <div class="section-header">
          <div class="section-title-group">
            <div class="title-with-badge">
              <h2 class="section-title">Currently Active & Configured Tests</h2>
              <span class="count-pill">{activeExams.length} tests</span>
            </div>
            <p class="section-subtitle">
              Directly view, edit, copy candidate URLs, and launch proctoring monitors from this dashboard.
            </p>
          </div>

          <div class="section-actions">
            <Button variant="ghost" onclick={loadExams} loading={isLoadingExams}>
              Refresh
            </Button>
            <Button variant="primary" onclick={() => push('/admin/exams')}>
              + Create New Test
            </Button>
          </div>
        </div>

        {#if isLoadingExams && activeExams.length === 0}
          <div class="loading-state">
            <div class="loading-spinner"></div>
            <span>Fetching examination records...</span>
          </div>
        {:else if activeExams.length === 0}
          <div class="empty-tests-card">
            <div class="empty-icon-circle">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="2" y="4" width="20" height="16" rx="2"></rect>
                <path d="M7 15h0M2 9.5h20"></path>
              </svg>
            </div>
            <h3 class="empty-title">No examinations configured</h3>
            <p class="empty-desc">Create your first examination to configure questions, duration limits, and classroom seating matrices.</p>
            <Button variant="primary" onclick={() => push('/admin/exams')}>
              Create First Test
            </Button>
          </div>
        {:else}
          <div class="tests-list">
            {#each activeExams as exam}
              <div class="test-entry-card">
                <div class="test-card-top">
                  <div class="test-meta-badge-row">
                    <button
                      type="button"
                      class="test-id-pill"
                      onclick={() => copyTestId(exam.testId || exam.id)}
                      title="Click to copy Test ID"
                    >
                      <span class="id-label">Test ID:</span>
                      <code class="id-code">{exam.testId || exam.id}</code>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                      </svg>
                    </button>

                    {#if isExamActive(exam)}
                      <span class="status-indicator-badge live">
                        <span class="live-dot"></span>
                        Active
                      </span>
                    {:else}
                      <span class="status-indicator-badge scheduled">
                        Scheduled
                      </span>
                    {/if}

                    <span class="meta-chip duration">
                      {exam.duration || 60} mins
                    </span>
                  </div>

                  <h3 class="test-title">{exam.title}</h3>
                  {#if exam.description}
                    <p class="test-desc">{exam.description}</p>
                  {/if}
                </div>

                <div class="test-details-grid">
                  <div class="detail-cell">
                    <span class="cell-label">Questions</span>
                    <span class="cell-val">{exam._count?.questions ?? 0} Enrolled</span>
                  </div>
                  <div class="detail-cell">
                    <span class="cell-label">Location / Room</span>
                    <span class="cell-val">{exam.location || 'Auditorium / Lab'}</span>
                  </div>
                  <div class="detail-cell">
                    <span class="cell-label">Seating Plan</span>
                    <span class="cell-val">{exam._count?.seatingPlan ?? 0} Desks Mapped</span>
                  </div>
                  <div class="detail-cell">
                    <span class="cell-label">Submissions</span>
                    <span class="cell-val">{exam._count?.responses ?? 0} Received</span>
                  </div>
                </div>

                <!-- Direct Student Portal Link Field -->
                <div class="student-link-bar">
                  <span class="link-tag">Candidate URL:</span>
                  <input
                    class="link-field"
                    readonly
                    value={`${window.location.origin}/exams/${exam.testId || exam.id}/portal`}
                  />
                  <Button variant="secondary" onclick={() => copyPortalUrl(exam)}>
                    Copy Link
                  </Button>
                </div>

                <!-- Card Action Footer -->
                <div class="test-card-actions">
                  <Button variant="secondary" onclick={() => push(`/admin/exams?id=${exam.id}`)}>
                    Open Test Studio
                  </Button>
                  <Button variant="primary" onclick={() => push(`/admin/exams/${exam.id}/monitor`)}>
                    Live Invigilation Feed
                  </Button>
                  <Button variant="ghost" onclick={() => push(`/exams/${exam.testId || exam.id}/portal`)}>
                    Open Candidate Portal
                  </Button>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </section>

      <!-- Quick Management Section -->
      <div class="cards-grid">
        <div class="dash-card">
          <div class="card-header">
            <span class="card-badge">Test Studio</span>
            <h2 class="card-title">Exam Configuration Studio</h2>
            <p class="card-desc">Design questions, configure Monaco code editor, set test duration, and upload classroom seating CSV.</p>
          </div>
          <div class="card-footer">
            <Button variant="primary" fullWidth onclick={() => push('/admin/exams')}>
              Open Exam Manager
            </Button>
          </div>
        </div>

        <div class="dash-card">
          <div class="card-header">
            <span class="card-badge">Invigilation Feed</span>
            <h2 class="card-title">Live Anomaly Monitor</h2>
            <p class="card-desc">Review gaze deviations, tab blur violations, face absence alerts, and candidate telemetry reports.</p>
          </div>
          <div class="card-footer">
            <Button
              variant="secondary"
              fullWidth
              onclick={() => {
                const targetId = activeExams[0]?.id || 'demo-exam-1';
                push(`/admin/exams/${targetId}/monitor`);
              }}
            >
              Open Proctoring Feed
            </Button>
          </div>
        </div>
      </div>
    {:else}
      <div class="candidate-portal-wrapper">
        <div class="candidate-portal-card">
          <div class="portal-card-top">
            <div class="status-indicator">
              <span class="status-dot"></span>
              <span class="status-text">Candidate Terminal Ready</span>
            </div>
            <span class="candidate-pill">Roll: {authStore.user?.rollNumber || '21CS001'}</span>
          </div>

          <div class="portal-body">
            <h2 class="portal-main-heading">Candidate Examination Portal</h2>
            <p class="portal-instruction">
              Access your scheduled test by entering the official examination URL or unique Test ID assigned to your sitting.
            </p>

            <div class="portal-form-group">
              <label for="candidate-exam-input" class="portal-label">
                Paste your exam link or Test ID here:
              </label>
              <div class="portal-input-container">
                <input
                  id="candidate-exam-input"
                  type="text"
                  class="portal-text-input"
                  placeholder="e.g., TEST-XXXXXX or http://localhost:5173/exams/TEST-XXXXXX/portal"
                  bind:value={candidateExamInput}
                  onkeydown={(e) => {
                    if (e.key === 'Enter') handleProceedToExam();
                  }}
                  autocomplete="off"
                  spellcheck="false"
                />
                <Button variant="primary" onclick={handleProceedToExam}>
                  Proceed to Examination
                </Button>
              </div>
            </div>

            <div class="portal-info-box">
              <div class="info-row">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <span><strong>Entry Policy:</strong> Entry opens strictly 1 minute prior to scheduled start time.</span>
              </div>
              <div class="info-row">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                </svg>
                <span><strong>Integrity Check:</strong> Physical seating match, webcam stream, and tab focus telemetry will be enforced.</span>
              </div>
            </div>
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
    max-width: 1080px;
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

  /* Stats Banner */
  .stats-banner {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--space-4);
  }

  .stat-card {
    padding: var(--space-4) var(--space-5);
    background-color: var(--color-bg-elevated);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .stat-label {
    font-size: var(--text-xs);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--color-text-secondary);
  }

  .stat-value {
    font-size: 1.75rem;
    font-weight: 600;
    color: var(--color-text-primary);
    font-family: var(--font-mono);
  }

  .stat-sub {
    font-size: var(--text-xs);
    color: var(--color-text-muted);
  }

  /* Active Tests Section */
  .active-tests-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: var(--space-4);
  }

  .section-title-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .title-with-badge {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .section-title {
    font-size: var(--text-lg);
    font-weight: 600;
    color: var(--color-text-primary);
    margin: 0;
  }

  .count-pill {
    font-size: 0.75rem;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: var(--radius-full);
    background-color: var(--color-accent-subtle);
    color: var(--color-accent);
    border: 1px solid var(--color-accent);
  }

  .section-subtitle {
    font-size: var(--text-xs);
    color: var(--color-text-secondary);
    margin: 0;
  }

  .section-actions {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .loading-state {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-3);
    padding: var(--space-8);
    background-color: var(--color-bg-elevated);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    color: var(--color-text-secondary);
    font-size: var(--text-sm);
  }

  .loading-spinner {
    width: 18px;
    height: 18px;
    border: 2px solid var(--color-border);
    border-top-color: var(--color-accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .empty-tests-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: var(--space-8);
    background-color: var(--color-bg-elevated);
    border: 1px dashed var(--color-border);
    border-radius: var(--radius);
    gap: var(--space-3);
  }

  .empty-icon-circle {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background-color: var(--color-bg-subtle);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-text-muted);
  }

  .empty-title {
    font-size: var(--text-base);
    font-weight: 500;
    color: var(--color-text-primary);
    margin: 0;
  }

  .empty-desc {
    font-size: var(--text-xs);
    color: var(--color-text-secondary);
    max-width: 420px;
    line-height: 1.5;
    margin: 0;
  }

  /* Tests List */
  .tests-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .test-entry-card {
    background-color: var(--color-bg-elevated);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    padding: var(--space-5);
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    box-shadow: var(--shadow-sm);
    transition: border-color 0.2s var(--ease);
  }

  .test-entry-card:hover {
    border-color: var(--color-accent);
  }

  .test-card-top {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .test-meta-badge-row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .test-id-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 3px 8px;
    background-color: var(--color-bg-subtle);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-family: inherit;
    transition: background-color 0.2s;
  }

  .test-id-pill:hover {
    background-color: var(--color-bg-elevated);
    border-color: var(--color-accent);
  }

  .id-label {
    font-size: 0.6875rem;
    font-weight: 600;
    color: var(--color-text-secondary);
    text-transform: uppercase;
  }

  .id-code {
    font-size: 0.75rem;
    font-weight: 700;
    color: var(--color-accent);
    font-family: var(--font-mono);
  }

  .status-indicator-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 0.6875rem;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: var(--radius-full);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .status-indicator-badge.live {
    background-color: rgba(52, 211, 153, 0.12);
    color: var(--color-success);
    border: 1px solid rgba(52, 211, 153, 0.3);
  }

  .status-indicator-badge.scheduled {
    background-color: var(--color-bg-subtle);
    color: var(--color-text-secondary);
    border: 1px solid var(--color-border);
  }

  .live-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background-color: var(--color-success);
    animation: livePulse 1.8s infinite;
  }

  @keyframes livePulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.4; transform: scale(0.8); }
  }

  .meta-chip {
    font-size: 0.6875rem;
    padding: 2px 8px;
    border-radius: var(--radius-sm);
    background-color: var(--color-bg-subtle);
    color: var(--color-text-secondary);
    border: 1px solid var(--color-border);
    font-family: var(--font-mono);
  }

  .test-title {
    font-size: 1.125rem;
    font-weight: 500;
    color: var(--color-text-primary);
    margin: 0;
  }

  .test-desc {
    font-size: var(--text-xs);
    color: var(--color-text-secondary);
    margin: 0;
    line-height: 1.5;
  }

  .test-details-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: var(--space-3);
    padding: var(--space-3);
    background-color: var(--color-bg-subtle);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
  }

  .detail-cell {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .cell-label {
    font-size: 0.6875rem;
    font-weight: 500;
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .cell-val {
    font-size: var(--text-xs);
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .student-link-bar {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-2) var(--space-3);
    background-color: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
  }

  .link-tag {
    font-size: 0.6875rem;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--color-text-secondary);
    white-space: nowrap;
  }

  .link-field {
    flex: 1;
    background: transparent;
    border: none;
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--color-accent);
    outline: none;
  }

  .test-card-actions {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding-top: var(--space-2);
    border-top: 1px solid var(--color-border);
    flex-wrap: wrap;
  }

  /* Regular Dashboard Cards */
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

  /* Candidate Minimalist Portal */
  .candidate-portal-wrapper {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
    padding: var(--space-4) 0;
  }

  .candidate-portal-card {
    width: 100%;
    max-width: 680px;
    background: var(--color-bg-elevated);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg, 6px);
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.06);
    overflow: hidden;
  }

  .portal-card-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-4) var(--space-6);
    background: var(--color-bg-subtle);
    border-bottom: 1px solid var(--color-border);
  }

  .candidate-pill {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--color-text-secondary);
    background: var(--color-bg-elevated);
    padding: 3px 8px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--color-border);
  }

  .portal-body {
    padding: var(--space-6) var(--space-6);
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
  }

  .portal-main-heading {
    font-size: var(--text-xl);
    font-weight: 600;
    color: var(--color-text-primary);
    margin: 0;
  }

  .portal-instruction {
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
    line-height: 1.5;
    margin: 0;
  }

  .portal-form-group {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .portal-label {
    font-size: var(--text-xs);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--color-text-primary);
  }

  .portal-input-container {
    display: flex;
    gap: var(--space-3);
  }

  .portal-text-input {
    flex: 1;
    height: 42px;
    padding: 0 var(--space-3);
    background: var(--color-bg-input, #ffffff);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    color: var(--color-text-primary);
    font-size: var(--text-sm);
    font-family: var(--font-mono);
    outline: none;
    transition: border-color 0.2s, box-shadow 0.2s;
  }

  .portal-text-input:focus {
    border-color: var(--color-accent);
    box-shadow: 0 0 0 2px rgba(41, 37, 36, 0.12);
  }

  .portal-info-box {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-4);
    background: var(--color-bg-subtle);
    border: 1px dashed var(--color-border);
    border-radius: var(--radius);
    font-size: var(--text-xs);
    color: var(--color-text-secondary);
  }

  .info-row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .info-row svg {
    color: var(--color-text-secondary);
    flex-shrink: 0;
  }

  .info-row strong {
    color: var(--color-text-primary);
  }

  @media (max-width: 768px) {
    .stats-banner {
      grid-template-columns: 1fr;
    }

    .test-details-grid {
      grid-template-columns: 1fr 1fr;
    }

    .section-header {
      flex-direction: column;
      align-items: flex-start;
    }

    .test-card-actions {
      flex-direction: column;
      align-items: stretch;
    }
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
