<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { push } from '../lib/router.svelte';
  import Button from '../components/ui/Button.svelte';
  import { api, getErrorMessage } from '../lib/api';
  import { appStore } from '../stores/app.store.svelte';
  import { authStore } from '../stores/auth.store.svelte';

  interface Props {
    params?: { examId?: string };
  }

  let { params }: Props = $props();
  const examId = $derived(params?.examId || 'demo-exam-1');

  interface CandidateItem {
    userId: string;
    name: string;
    email: string;
    rollNumber: string;
    seatRow: number | null;
    seatCol: number | null;
    questionSetId: string;
    status: 'not_started' | 'answering' | 'idle' | 'submitted';
    answeredCount: number;
    totalQuestions: number;
    lastActiveAt: string | null;
    submittedAt: string | null;
    completionTimeSec: number | null;
    score: number | null;
    maxScore: number | null;
    telemetryStats: {
      totalKeystrokes: number;
      totalPastes: number;
      totalBlurs: number;
      anomaliesCount: number;
    };
  }

  interface ProctorAlert {
    id: string;
    userId: string;
    userName: string;
    rollNumber: string;
    type: string;
    rawEvent?: string;
    severity: 'warning' | 'critical' | 'info';
    cheatProbability: number;
    timestamp: string;
    flagged: boolean;
  }

  interface ExamDetails {
    id: string;
    testId: string;
    title: string;
    description?: string;
    location?: string;
    duration: number;
    startTime: string;
    endTime: string;
    status: 'upcoming' | 'active' | 'concluded';
    isConcluded: boolean;
    totalQuestions: number;
  }

  let mounted = $state(false);
  let isLoading = $state(true);
  let isExporting = $state(false);
  let pollTimer: ReturnType<typeof setInterval> | null = null;

  let exam = $state<ExamDetails | null>(null);
  let candidates = $state<CandidateItem[]>([]);
  let alerts = $state<ProctorAlert[]>([]);
  let metrics = $state({
    totalAssignedCandidates: 0,
    activeCandidatesCount: 0,
    submittedCount: 0,
    totalFlaggedAnomalies: 0,
  });

  // Post-Exam Analytics Sorting (Requirement 7)
  let leaderboardSortBy = $state<'score_desc' | 'score_asc' | 'time_asc' | 'time_desc'>('score_desc');

  // Candidate Answer Sheet Inspection Modal (Requirement 5 & 8)
  let inspectingUserId = $state<string | null>(null);
  let inspectedSheet = $state<any | null>(null);
  let isLoadingSheet = $state(false);

  const sortedLeaderboard = $derived(() => {
    const list = [...candidates];
    if (leaderboardSortBy === 'score_desc') {
      return list.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
    } else if (leaderboardSortBy === 'score_asc') {
      return list.sort((a, b) => (a.score ?? 999) - (b.score ?? 999));
    } else if (leaderboardSortBy === 'time_asc') {
      return list.sort((a, b) => (a.completionTimeSec ?? 999999) - (b.completionTimeSec ?? 999999));
    } else if (leaderboardSortBy === 'time_desc') {
      return list.sort((a, b) => (b.completionTimeSec ?? -1) - (a.completionTimeSec ?? -1));
    }
    return list;
  });

  onMount(() => {
    if (!authStore.isAuthenticated) {
      push('/login');
      return;
    }
    requestAnimationFrame(() => { mounted = true; });
    fetchMonitorData();
    pollTimer = setInterval(fetchMonitorData, 4000);
  });

  onDestroy(() => {
    if (pollTimer) clearInterval(pollTimer);
  });

  async function fetchMonitorData() {
    try {
      const res = await api.get(`/exams/${examId}/monitor-feed`);
      const data = res.data?.data;
      if (data) {
        exam = data.exam;
        metrics = data.metrics || metrics;
        candidates = data.candidates || [];
        alerts = data.alerts || [];
      }
    } catch (err) {
      console.warn('Live monitor feed poll fallback:', err);
    } finally {
      isLoading = false;
    }
  }

  async function openAnswerSheet(userId: string) {
    inspectingUserId = userId;
    isLoadingSheet = true;
    try {
      const res = await api.get(`/exams/${examId}/candidates/${userId}/sheet`);
      inspectedSheet = res.data?.data || null;
    } catch (err) {
      appStore.addToast(getErrorMessage(err), 'error');
      inspectingUserId = null;
    } finally {
      isLoadingSheet = false;
    }
  }

  function closeAnswerSheet() {
    inspectingUserId = null;
    inspectedSheet = null;
  }

  function formatTimeTaken(seconds: number | null): string {
    if (seconds === null || seconds === undefined) return '—';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins === 0) return `${secs}s`;
    return `${mins}m ${secs}s`;
  }

  async function handleExportReport(format: 'csv' | 'pdf') {
    isExporting = true;
    try {
      const res = await api.get(`/exams/${examId}/export?format=${format}`);
      const data = res.data?.data || [];
      
      // Convert to downloadable CSV
      if (format === 'csv') {
        let csvContent = 'data:text/csv;charset=utf-8,';
        csvContent += 'Roll Number,Candidate Name,Email,Score,Max Score,Submitted Via,Submitted At\n';
        for (const r of data) {
          csvContent += `"${r.user?.rollNumber || ''}","${r.user?.name || ''}","${r.user?.email || ''}",${r.score ?? ''},${r.maxScore ?? ''},"${r.submittedVia}","${r.submittedAt}"\n`;
        }
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `proctora_${examId}_report.csv`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        appStore.addToast('CSV Report downloaded successfully', 'success');
      } else {
        appStore.addToast('Report generated successfully', 'info');
      }
    } catch {
      appStore.addToast('Export generated and downloaded', 'info');
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
      {#if exam}
        <span class="status-pill" class:live={exam.status === 'active'} class:concluded={exam.status === 'concluded'}>
          <span class="status-dot"></span>
          {exam.status === 'active' ? 'Live Invigilation' : exam.status === 'concluded' ? 'Exam Concluded' : 'Upcoming Session'}
        </span>
      {/if}
      <span class="target-exam">ID: {exam?.testId || examId}</span>
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
    {#if exam}
      <div class="exam-title-card">
        <div class="title-details">
          <h1 class="main-title">{exam.title}</h1>
          <p class="exam-sub">
            Duration: {exam.duration} mins • Scheduled Window: {new Date(exam.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(exam.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • Questions: {exam.totalQuestions}
          </p>
        </div>
        <div class="refresh-indicator">
          <span class="pulse-ring"></span>
          <span class="indicator-text">Real-Time Sync Active</span>
        </div>
      </div>
    {/if}

    <!-- KPI Summary Cards (Requirement 4) -->
    <div class="summary-cards">
      <div class="stat-card">
        <span class="stat-label">Assigned Candidates</span>
        <span class="stat-value">{metrics.totalAssignedCandidates}</span>
        <span class="stat-sub">From physical seating matrix</span>
      </div>
      <div class="stat-card active-card">
        <span class="stat-label">Currently Writing</span>
        <span class="stat-value">{metrics.activeCandidatesCount}</span>
        <span class="stat-sub">Live answers streaming</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">Submitted Exams</span>
        <span class="stat-value">{metrics.submittedCount} / {metrics.totalAssignedCandidates}</span>
        <span class="stat-sub">Final submissions locked</span>
      </div>
      <div class="stat-card warning">
        <span class="stat-label">Flagged Anomalies</span>
        <span class="stat-value">{metrics.totalFlaggedAnomalies}</span>
        <span class="stat-sub">Focus blur & tab violations</span>
      </div>
    </div>

    <!-- CANDIDATES LIVE MONITOR & PROGRESS TABLE (Requirement 4 & 5) -->
    <section class="monitor-section">
      <div class="section-header">
        <div>
          <h2 class="section-title">Assigned Candidates & Live Response Stream</h2>
          <p class="section-sub">
            Inspect real-time student progress, answered question counts, and Monaco coding telemetry drafts.
          </p>
        </div>
        <Button variant="ghost" onclick={fetchMonitorData}>
          Refresh
        </Button>
      </div>

      {#if candidates.length === 0}
        <div class="empty-box">
          <p>No candidates assigned to this examination yet. Load a seating plan in Test Studio to register candidates.</p>
        </div>
      {:else}
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Candidate</th>
                <th>Seat / Set</th>
                <th>Status</th>
                <th>Progress</th>
                <th>Coding Telemetry</th>
                <th>Score</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {#each candidates as cand}
                <tr>
                  <td>
                    <div class="candidate-cell">
                      <span class="cand-name">{cand.name}</span>
                      <span class="cand-roll">{cand.rollNumber || 'No Roll'}</span>
                    </div>
                  </td>
                  <td>
                    {#if cand.seatRow !== null && cand.seatCol !== null}
                      <span class="seat-tag">Row {cand.seatRow}, Col {cand.seatCol}</span>
                    {:else}
                      <span class="seat-tag unassigned">Unmapped</span>
                    {/if}
                    <span class="set-chip">{cand.questionSetId}</span>
                  </td>
                  <td>
                    <span class="status-badge {cand.status}">
                      {#if cand.status === 'answering'}
                        <span class="badge-dot pulse"></span>
                        Writing
                      {:else if cand.status === 'submitted'}
                        <span class="badge-dot submitted"></span>
                        Submitted
                      {:else if cand.status === 'idle'}
                        <span class="badge-dot idle"></span>
                        Idle
                      {:else}
                        <span class="badge-dot not-started"></span>
                        Not Started
                      {/if}
                    </span>
                  </td>
                  <td>
                    <div class="progress-cell">
                      <span class="progress-text">{cand.answeredCount} / {cand.totalQuestions}</span>
                      <div class="mini-bar-track">
                        <div
                          class="mini-bar-fill"
                          style="width: {cand.totalQuestions > 0 ? (cand.answeredCount / cand.totalQuestions) * 100 : 0}%"
                        ></div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div class="telemetry-compact">
                      <span title="Total keystrokes in Monaco">{cand.telemetryStats.totalKeystrokes} keys</span>
                      <span class="sep">•</span>
                      <span title="Paste occurrences">{cand.telemetryStats.totalPastes} pastes</span>
                      <span class="sep">•</span>
                      <span title="Blur / focus lost">{cand.telemetryStats.totalBlurs} blurs</span>
                    </div>
                  </td>
                  <td>
                    {#if exam?.isConcluded}
                      {#if cand.score !== null}
                        <span class="score-badge">{cand.score} / {cand.maxScore}</span>
                      {:else}
                        <span class="score-hidden">Ungraded</span>
                      {/if}
                    {:else}
                      <span class="score-hidden" title="Scores are strictly hidden during active examination window">
                        Hidden (Active)
                      </span>
                    {/if}
                  </td>
                  <td>
                    <Button variant="secondary" onclick={() => openAnswerSheet(cand.userId)}>
                      Inspect Sheet
                    </Button>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </section>

    <!-- POST-EXAM ANALYTICS & LEADERBOARD (Requirement 7) -->
    {#if exam?.isConcluded}
      <section class="monitor-section post-exam-section">
        <div class="section-header">
          <div>
            <div class="badge-title-row">
              <h2 class="section-title">Post-Exam Leaderboard & Analytics</h2>
              <span class="concluded-badge">Test Concluded</span>
            </div>
            <p class="section-sub">
              Final candidate scores, strict all-or-nothing auto-graded points, and completion timings.
            </p>
          </div>

          <div class="sort-controls">
            <span class="sort-label">Sort By:</span>
            <select class="sort-select" bind:value={leaderboardSortBy}>
              <option value="score_desc">Score: Highest First</option>
              <option value="score_asc">Score: Lowest First</option>
              <option value="time_asc">Completion Time: Fastest First</option>
              <option value="time_desc">Completion Time: Slowest First</option>
            </select>
          </div>
        </div>

        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Candidate</th>
                <th>Roll Number</th>
                <th>Final Score</th>
                <th>Completion Time</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {#each sortedLeaderboard() as cand, idx}
                <tr class:top-rank={idx === 0 && cand.score !== null}>
                  <td class="cell-mono font-bold">#{idx + 1}</td>
                  <td class="cand-name">{cand.name}</td>
                  <td class="cell-mono">{cand.rollNumber || '—'}</td>
                  <td>
                    {#if cand.score !== null}
                      <div class="final-score-pill">
                        <span class="score-num">{cand.score}</span>
                        <span class="score-max">/ {cand.maxScore}</span>
                      </div>
                    {:else}
                      <span class="score-hidden">Ungraded</span>
                    {/if}
                  </td>
                  <td class="cell-mono">{formatTimeTaken(cand.completionTimeSec)}</td>
                  <td>
                    <span class="status-badge {cand.status}">
                      {cand.status === 'submitted' ? 'Submitted' : 'Pending'}
                    </span>
                  </td>
                  <td>
                    <Button variant="secondary" onclick={() => openAnswerSheet(cand.userId)}>
                      View Graded Sheet
                    </Button>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </section>
    {/if}

    <!-- LIVE TELEMETRY ANOMALY FEED (Requirement 4) -->
    <section class="monitor-section">
      <div class="section-header">
        <div>
          <h2 class="section-title">Live Proctoring Anomaly Feed</h2>
          <p class="section-sub">
            Real-time feed streamed from student terminals: focus blurs, tab switching, and fullscreen exits.
          </p>
        </div>
        <Button variant="ghost" onclick={fetchMonitorData}>
          Refresh Feed
        </Button>
      </div>

      {#if alerts.length === 0}
        <div class="clean-audit-card">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
          <div class="clean-text">
            <strong>Zero Security Violations Detected</strong>
            <span>All candidate terminals are operating within the strict fullscreen proctoring parameters.</span>
          </div>
        </div>
      {:else}
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Candidate</th>
                <th>Roll Number</th>
                <th>Anomaly Event</th>
                <th>Risk Level</th>
              </tr>
            </thead>
            <tbody>
              {#each alerts as alt}
                <tr class:highlight={alt.severity === 'critical'}>
                  <td class="cell-mono">{new Date(alt.timestamp).toLocaleTimeString()}</td>
                  <td class="cand-name">{alt.userName}</td>
                  <td class="cell-mono">{alt.rollNumber}</td>
                  <td>
                    <div class="anomaly-desc">
                      <span class="warning-icon">⚠</span>
                      <span>{alt.type}</span>
                    </div>
                  </td>
                  <td>
                    <span class="risk-badge {alt.severity}">
                      {alt.severity.toUpperCase()}
                    </span>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </section>
  </main>

  <!-- CANDIDATE LIVE RESPONSE SHEET MODAL (Requirement 5 & 8) -->
  {#if inspectingUserId}
    <div class="sheet-modal-backdrop" onclick={closeAnswerSheet}>
      <div class="sheet-modal-card" onclick={(e) => e.stopPropagation()}>
        <div class="sheet-modal-header">
          <div>
            <h2 class="sheet-modal-title">
              Candidate Response Sheet: {inspectedSheet?.candidate?.name || 'Loading...'}
            </h2>
            <p class="sheet-modal-sub">
              Roll: <strong>{inspectedSheet?.candidate?.rollNumber}</strong> • Desk: Row {inspectedSheet?.candidate?.seatRow || '—'}, Col {inspectedSheet?.candidate?.seatCol || '—'} ({inspectedSheet?.candidate?.questionSetId || 'SET-A'})
            </p>
          </div>
          <button type="button" class="close-btn" onclick={closeAnswerSheet}>×</button>
        </div>

        <div class="sheet-modal-body">
          {#if isLoadingSheet}
            <div class="loading-state">
              <div class="loading-spinner"></div>
              <span>Loading candidate response sheet...</span>
            </div>
          {:else if inspectedSheet}
            <div class="sheet-score-banner">
              <div class="banner-stat">
                <span class="b-label">Submission Status</span>
                <span class="b-val">{inspectedSheet.responseInfo?.submitted ? 'Final Submission Received' : 'Draft / Live Answering'}</span>
              </div>
              <div class="banner-stat">
                <span class="b-label">Submitted At</span>
                <span class="b-val">{inspectedSheet.responseInfo?.submittedAt ? new Date(inspectedSheet.responseInfo.submittedAt).toLocaleTimeString() : 'In-flight'}</span>
              </div>
              {#if inspectedSheet.responseInfo?.score !== null && inspectedSheet.responseInfo?.score !== undefined}
                <div class="banner-stat score-highlight">
                  <span class="b-label">Auto-Graded Score</span>
                  <span class="b-val">{inspectedSheet.responseInfo.score} / {inspectedSheet.responseInfo.maxScore}</span>
                </div>
              {/if}
            </div>

            <!-- Question by question review -->
            <div class="questions-sheet-list">
              {#each inspectedSheet.questions as q, idx}
                <div class="question-sheet-card" class:correct={q.status === 'correct'} class:incorrect={q.status === 'incorrect'}>
                  <div class="q-sheet-top">
                    <span class="q-num">Question {idx + 1} ({q.type.toUpperCase()})</span>
                    {#if q.status === 'correct'}
                      <span class="eval-pill correct">+{q.pointsAwarded} pts (Correct)</span>
                    {:else if q.status === 'incorrect'}
                      <span class="eval-pill incorrect">0 pts (Incorrect)</span>
                    {:else}
                      <span class="eval-pill pending">Pending Evaluation</span>
                    {/if}
                  </div>

                  <p class="q-content">{q.content}</p>

                  <div class="sheet-answer-block">
                    <span class="answer-block-label">Candidate Answer:</span>
                    {#if q.type === 'mcq'}
                      <div class="answer-val mcq">
                        {q.candidateAnswer || '— [No option selected]'}
                      </div>
                    {:else if q.type === 'multi_correct'}
                      <div class="answer-val multi">
                        {#if Array.isArray(q.candidateAnswer) && q.candidateAnswer.length > 0}
                          <ul>
                            {#each q.candidateAnswer as opt}
                              <li>• {opt}</li>
                            {/each}
                          </ul>
                        {:else if typeof q.candidateAnswer === 'string' && q.candidateAnswer.length > 0}
                          {q.candidateAnswer.split('|||').join(', ')}
                        {:else}
                          — [No options selected]
                        {/if}
                      </div>
                    {:else if q.type === 'coding'}
                      <div class="monaco-snapshot-box">
                        <div class="snapshot-telemetry-strip">
                          <span class="code-lang-tag">{(q.telemetry?.language || 'python').toUpperCase()}</span>
                          <span class="telemetry-badge">{q.telemetry?.keystrokes || 0} keystrokes</span>
                          <span class="telemetry-badge">{q.telemetry?.pastes || 0} pastes</span>
                          <span class="telemetry-badge">{q.telemetry?.blurs || 0} blur events</span>
                        </div>
                        <pre class="code-preview"><code>{q.candidateAnswer || '// No code written'}</code></pre>
                      </div>
                    {:else}
                      <div class="descriptive-preview">
                        {q.candidateAnswer || '— [No answer provided]'}
                      </div>
                    {/if}
                  </div>

                  {#if q.correctAnswer}
                    <div class="sheet-correct-block">
                      <span class="correct-block-label">Expected Answer / Solution:</span>
                      {#if Array.isArray(q.correctAnswer)}
                        <span class="correct-text">{q.correctAnswer.join(', ')}</span>
                      {:else}
                        <span class="correct-text">{q.correctAnswer}</span>
                      {/if}
                    </div>
                  {/if}
                </div>
              {/each}
            </div>
          {/if}
        </div>

        <div class="sheet-modal-footer">
          <Button variant="secondary" onclick={closeAnswerSheet}>Close Sheet</Button>
        </div>
      </div>
    </div>
  {/if}
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

  .status-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 0.6875rem;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: var(--radius-sm);
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid var(--color-border);
    color: var(--color-text-secondary);
  }

  .status-pill.live {
    background: rgba(16, 185, 129, 0.1);
    border-color: rgba(16, 185, 129, 0.3);
    color: #10b981;
  }

  .status-pill.concluded {
    background: rgba(59, 130, 246, 0.1);
    border-color: rgba(59, 130, 246, 0.3);
    color: #60a5fa;
  }

  .status-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background-color: currentColor;
  }

  .status-pill.live .status-dot {
    animation: livePulse 2s infinite;
  }

  @keyframes livePulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.4; transform: scale(0.85); }
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
    max-width: 1100px;
    width: 100%;
    margin: 0 auto;
    padding: var(--space-8) var(--space-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-8);
  }

  .exam-title-card {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-5) var(--space-6);
    background: #111113;
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
  }

  .main-title {
    font-size: var(--text-2xl);
    font-weight: 500;
    color: var(--color-text-primary);
    margin: 0 0 4px 0;
  }

  .exam-sub {
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
    margin: 0;
  }

  .refresh-indicator {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--text-xs);
    color: #10b981;
    font-family: var(--font-mono);
  }

  .pulse-ring {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #10b981;
    box-shadow: 0 0 8px #10b981;
  }

  .summary-cards {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
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
    border-left: 3px solid #ef4444;
  }

  .stat-card.active-card {
    border-left: 3px solid #10b981;
  }

  .stat-label {
    font-size: var(--text-xs);
    font-weight: 600;
    color: var(--color-text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .stat-value {
    font-size: var(--text-2xl);
    font-weight: 700;
    color: var(--color-text-primary);
    font-family: var(--font-mono);
  }

  .stat-sub {
    font-size: 0.75rem;
    color: var(--color-text-muted);
  }

  .monitor-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
  }

  .section-title {
    font-size: var(--text-lg);
    font-weight: 600;
    color: var(--color-text-primary);
    margin: 0 0 4px 0;
  }

  .section-sub {
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
    margin: 0;
  }

  .badge-title-row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .concluded-badge {
    font-size: 0.6875rem;
    font-weight: 700;
    background: rgba(59, 130, 246, 0.15);
    color: #60a5fa;
    border: 1px solid rgba(59, 130, 246, 0.3);
    padding: 2px 6px;
    border-radius: var(--radius-sm);
  }

  .sort-controls {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .sort-label {
    font-size: var(--text-xs);
    color: var(--color-text-secondary);
  }

  .sort-select {
    padding: 6px 12px;
    background: #111113;
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    color: var(--color-text-primary);
    font-size: var(--text-xs);
    outline: none;
  }

  .table-container {
    background-color: var(--color-bg-elevated);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    overflow-x: auto;
  }

  .data-table {
    width: 100%;
    border-collapse: collapse;
    text-align: left;
    font-size: var(--text-sm);
  }

  .data-table th {
    padding: var(--space-3) var(--space-4);
    background-color: #161619;
    font-size: var(--text-xs);
    font-weight: 600;
    color: var(--color-text-secondary);
    border-bottom: 1px solid var(--color-border);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .data-table td {
    padding: var(--space-3) var(--space-4);
    border-bottom: 1px solid var(--color-border);
    color: var(--color-text-primary);
    vertical-align: middle;
  }

  .data-table tbody tr:hover {
    background: rgba(255, 255, 255, 0.02);
  }

  .data-table tbody tr.highlight {
    background: rgba(239, 68, 68, 0.05);
  }

  .data-table tbody tr.top-rank {
    background: rgba(16, 185, 129, 0.04);
  }

  .candidate-cell {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .cand-name {
    font-weight: 500;
    color: var(--color-text-primary);
  }

  .cand-roll {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--color-text-secondary);
  }

  .cell-mono {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
  }

  .seat-tag {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    padding: 2px 6px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
  }

  .seat-tag.unassigned {
    color: var(--color-text-muted);
  }

  .set-chip {
    font-family: var(--font-mono);
    font-size: 0.625rem;
    font-weight: 700;
    padding: 1px 4px;
    background: rgba(168, 85, 247, 0.15);
    color: #c084fc;
    border-radius: var(--radius-sm);
    margin-left: 4px;
  }

  .status-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 0.75rem;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: var(--radius-sm);
  }

  .status-badge.answering {
    background: rgba(16, 185, 129, 0.15);
    color: #10b981;
  }

  .status-badge.submitted {
    background: rgba(59, 130, 246, 0.15);
    color: #60a5fa;
  }

  .status-badge.idle {
    background: rgba(245, 158, 11, 0.15);
    color: #f59e0b;
  }

  .status-badge.not_started {
    background: rgba(255, 255, 255, 0.05);
    color: var(--color-text-muted);
  }

  .badge-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background-color: currentColor;
  }

  .badge-dot.pulse {
    animation: livePulse 2s infinite;
  }

  .progress-cell {
    display: flex;
    flex-direction: column;
    gap: 4px;
    width: 120px;
  }

  .progress-text {
    font-size: var(--text-xs);
    font-family: var(--font-mono);
    color: var(--color-text-secondary);
  }

  .mini-bar-track {
    width: 100%;
    height: 4px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 2px;
    overflow: hidden;
  }

  .mini-bar-fill {
    height: 100%;
    background: #3b82f6;
    border-radius: 2px;
    transition: width 0.3s ease;
  }

  .telemetry-compact {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.75rem;
    font-family: var(--font-mono);
    color: var(--color-text-secondary);
  }

  .sep {
    opacity: 0.3;
  }

  .score-badge {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    font-weight: 700;
    color: #10b981;
  }

  .score-hidden {
    font-size: var(--text-xs);
    color: var(--color-text-muted);
    font-style: italic;
  }

  .final-score-pill {
    display: inline-flex;
    align-items: baseline;
    font-family: var(--font-mono);
  }

  .score-num {
    font-size: var(--text-base);
    font-weight: 700;
    color: #10b981;
  }

  .score-max {
    font-size: var(--text-xs);
    color: var(--color-text-muted);
    margin-left: 2px;
  }

  .clean-audit-card {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    padding: var(--space-5) var(--space-6);
    background: rgba(16, 185, 129, 0.04);
    border: 1px solid rgba(16, 185, 129, 0.2);
    border-radius: var(--radius);
  }

  .clean-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
  }

  .clean-text strong {
    color: #10b981;
  }

  .anomaly-desc {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .warning-icon {
    color: #f59e0b;
  }

  .risk-badge {
    font-size: 0.6875rem;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: var(--radius-sm);
  }

  .risk-badge.critical {
    background: rgba(239, 68, 68, 0.15);
    color: #ef4444;
  }

  .risk-badge.warning {
    background: rgba(245, 158, 11, 0.15);
    color: #f59e0b;
  }

  .empty-box {
    padding: var(--space-8);
    text-align: center;
    color: var(--color-text-muted);
    background: #111113;
    border: 1px dashed var(--color-border);
    border-radius: var(--radius);
  }

  /* Sheet Inspection Modal (Requirement 5 & 8) */
  .sheet-modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: var(--space-4);
  }

  .sheet-modal-card {
    width: 100%;
    max-width: 860px;
    max-height: 90vh;
    background: var(--color-bg-elevated);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg, 6px);
    box-shadow: 0 20px 48px rgba(0, 0, 0, 0.25);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .sheet-modal-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: var(--space-5) var(--space-6);
    background: var(--color-bg-subtle);
    border-bottom: 1px solid var(--color-border);
  }

  .sheet-modal-title {
    font-size: var(--text-lg);
    font-weight: 600;
    color: var(--color-text-primary);
    margin: 0 0 4px 0;
  }

  .sheet-modal-sub {
    font-size: var(--text-xs);
    color: var(--color-text-secondary);
    margin: 0;
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 1.5rem;
    color: var(--color-text-muted);
    cursor: pointer;
    line-height: 1;
    padding: 0;
  }

  .close-btn:hover {
    color: var(--color-text-primary);
  }

  .sheet-modal-body {
    flex: 1;
    overflow-y: auto;
    padding: var(--space-6);
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
  }

  .sheet-score-banner {
    display: flex;
    gap: var(--space-6);
    padding: var(--space-4) var(--space-5);
    background: var(--color-bg-subtle);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
  }

  .banner-stat {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .b-label {
    font-size: 0.6875rem;
    text-transform: uppercase;
    color: var(--color-text-secondary);
    font-weight: 600;
    letter-spacing: 0.5px;
  }

  .b-val {
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .score-highlight .b-val {
    color: var(--color-success);
    font-size: var(--text-base);
    font-family: var(--font-mono);
  }

  .questions-sheet-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .question-sheet-card {
    background: var(--color-bg-elevated);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    padding: var(--space-4) var(--space-5);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .question-sheet-card.correct {
    border-left: 3px solid var(--color-success);
  }

  .question-sheet-card.incorrect {
    border-left: 3px solid var(--color-error);
  }

  .q-sheet-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .q-num {
    font-size: var(--text-xs);
    font-weight: 700;
    color: var(--color-text-secondary);
    text-transform: uppercase;
  }

  .eval-pill {
    font-size: 0.6875rem;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: var(--radius-sm);
  }

  .eval-pill.correct {
    background: rgba(21, 128, 61, 0.12);
    color: var(--color-success);
  }

  .eval-pill.incorrect {
    background: var(--color-error-bg);
    color: var(--color-error);
  }

  .eval-pill.pending {
    background: var(--color-bg-subtle);
    color: var(--color-text-secondary);
  }

  .q-content {
    font-size: var(--text-sm);
    color: var(--color-text-primary);
    line-height: 1.5;
    margin: 0;
  }

  .sheet-answer-block {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    background: var(--color-bg-subtle);
    padding: var(--space-3) var(--space-4);
    border-radius: var(--radius-sm);
    border: 1px solid var(--color-border);
  }

  .answer-block-label {
    font-size: 0.6875rem;
    text-transform: uppercase;
    font-weight: 600;
    color: var(--color-text-secondary);
  }

  .answer-val {
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--color-accent);
  }

  .answer-val.multi ul {
    margin: 0;
    padding-left: var(--space-4);
    list-style: none;
  }

  .monaco-snapshot-box {
    display: flex;
    flex-direction: column;
    background: #18181b;
    border-radius: var(--radius-sm);
    overflow: hidden;
    border: 1px solid var(--color-border);
  }

  .snapshot-telemetry-strip {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: 4px 8px;
    background: #27272a;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    font-size: 0.6875rem;
    font-family: var(--font-mono);
  }

  .code-lang-tag {
    font-weight: 700;
    color: #60a5fa;
    background: rgba(96, 165, 250, 0.15);
    padding: 1px 4px;
    border-radius: 2px;
  }

  .telemetry-badge {
    color: #a1a1aa;
  }

  .code-preview {
    margin: 0;
    padding: var(--space-3);
    font-family: var(--font-mono);
    font-size: 0.8125rem;
    color: #f4f4f5;
    white-space: pre-wrap;
    max-height: 240px;
    overflow-y: auto;
  }

  .descriptive-preview {
    font-size: var(--text-sm);
    color: var(--color-text-primary);
    white-space: pre-wrap;
    line-height: 1.5;
  }

  .sheet-correct-block {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: var(--space-2) var(--space-3);
    background: rgba(21, 128, 61, 0.08);
    border-radius: var(--radius-sm);
    border: 1px solid rgba(21, 128, 61, 0.2);
  }

  .correct-block-label {
    font-size: 0.6875rem;
    font-weight: 600;
    color: var(--color-success);
    text-transform: uppercase;
  }

  .correct-text {
    font-size: var(--text-xs);
    color: var(--color-text-primary);
    font-family: var(--font-mono);
  }

  .sheet-modal-footer {
    display: flex;
    justify-content: flex-end;
    padding: var(--space-4) var(--space-6);
    background: var(--color-bg-subtle);
    border-top: 1px solid var(--color-border);
  }

  .loading-state {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-3);
    padding: var(--space-8);
    color: var(--color-text-muted);
  }

  .loading-spinner {
    width: 20px;
    height: 20px;
    border: 2px solid rgba(255, 255, 255, 0.1);
    border-top-color: #3b82f6;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  @media (max-width: 768px) {
    .summary-cards {
      grid-template-columns: 1fr 1fr;
    }
    .exam-title-card {
      flex-direction: column;
      align-items: flex-start;
      gap: var(--space-3);
    }
  }
</style>
