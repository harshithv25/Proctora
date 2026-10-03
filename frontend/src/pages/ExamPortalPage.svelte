<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { push } from '../lib/router.svelte';
  import Button from '../components/ui/Button.svelte';
  import MonacoEditor from '../components/ui/MonacoEditor.svelte';
  import type { SupportedLanguage } from '../lib/monaco';
  import { api, getErrorMessage } from '../lib/api';
  import { appStore } from '../stores/app.store.svelte';
  import { authStore } from '../stores/auth.store.svelte';

  interface Props {
    params?: { examId?: string };
  }

  let { params }: Props = $props();
  const examId = $derived(params?.examId || 'demo-exam-1');

  interface QuestionItem {
    id: string;
    content: string;
    type: 'descriptive' | 'coding' | 'mcq' | 'multi_correct';
    metadata?: {
      options?: string[];
      language?: SupportedLanguage;
      starterCode?: string;
    };
  }

  let mounted = $state(false);
  let examTitle = $state('Examination Portal');
  let questions = $state<QuestionItem[]>([]);
  let currentIdx = $state(0);
  let answers = $state<Record<string, string>>({});
  let autosaveStatus = $state('All changes saved');
  let autosaveTimer: ReturnType<typeof setTimeout> | null = null;

  // Time-gating states (Requirement 2 & 3)
  let isTimeGateEarly = $state(false);
  let isTimeGateExpired = $state(false);
  let timeGateMessage = $state('');
  let secondsUntilOpen = $state(0);
  let earlyCountdownTimer: ReturnType<typeof setInterval> | null = null;
  let formattedStartTime = $state('');

  // Monaco editor telemetry tracking (Requirement 8)
  let editorTelemetryStats = $state<Record<string, { keystrokes: number; pastes: number; blurs: number; language: string }>>({});

  // Seating Info & Exclusion
  let seatingInfo = $state<{ seatRow: number; seatCol: number; questionSetId: string } | null>(null);
  let seatingExcluded = $state(false);
  let exclusionMessage = $state('');

  // Timer
  let secondsRemaining = $state(3600);
  let timerInterval: ReturnType<typeof setInterval> | null = null;

  // Modals & Proctoring
  let showSubmitModal = $state(false);
  let isSubmitting = $state(false);
  let videoEl = $state<HTMLVideoElement | null>(null);
  let proctorStream = $state<MediaStream | null>(null);
  let violationCount = $state(0);

  const currentQuestion = $derived(questions[currentIdx] || null);
  const answeredCount = $derived(Object.values(answers).filter((a) => a && a.trim().length > 0).length);

  const formattedTime = $derived(() => {
    const hrs = Math.floor(secondsRemaining / 3600);
    const mins = Math.floor((secondsRemaining % 3600) / 60);
    const secs = secondsRemaining % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  });

  const formattedCountdownUntilOpen = $derived(() => {
    const mins = Math.floor(secondsUntilOpen / 60);
    const secs = secondsUntilOpen % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  });

  onMount(async () => {
    if (!authStore.isAuthenticated) {
      push('/login');
      return;
    }

    requestAnimationFrame(() => { mounted = true; });
    await initExamSession();
    setupListeners();
    initWebcam();
  });

  onDestroy(() => {
    if (timerInterval) clearInterval(timerInterval);
    if (earlyCountdownTimer) clearInterval(earlyCountdownTimer);
    if (autosaveTimer) clearTimeout(autosaveTimer);
    if (proctorStream) proctorStream.getTracks().forEach((t) => t.stop());
    teardownListeners();
  });

  function startEarlyCountdown() {
    if (earlyCountdownTimer) clearInterval(earlyCountdownTimer);
    earlyCountdownTimer = setInterval(async () => {
      if (secondsUntilOpen > 0) {
        secondsUntilOpen--;
      } else {
        if (earlyCountdownTimer) clearInterval(earlyCountdownTimer);
        isTimeGateEarly = false;
        await initExamSession();
      }
    }, 1000);
  }

  async function initExamSession() {
    try {
      const configRes = await api.get(`/exams/${examId}/session-config`);
      const cfg = configRes.data?.data;
      if (cfg?.title) examTitle = cfg.title;
      if (cfg?.totalDurationSec) {
        secondsRemaining = cfg.totalDurationSec;
      }
      if (cfg?.startTime) {
        formattedStartTime = new Date(cfg.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }

      if (cfg?.isEarly) {
        isTimeGateEarly = true;
        secondsUntilOpen = cfg.secondsUntilOpen || 60;
        timeGateMessage = `Test has not started yet. Opens at ${formattedStartTime} (Entry opens 1 minute prior).`;
        startEarlyCountdown();
        return;
      }

      if (cfg?.isExpired) {
        isTimeGateExpired = true;
        timeGateMessage = 'This examination session has concluded and is no longer accepting submissions.';
        return;
      }
    } catch {
      // Continue with questions lookup
    }

    try {
      const qRes = await api.get(`/exams/${examId}/questions`);
      const data = qRes.data?.data;
      if (data?.title) examTitle = data.title;
      if (data?.questions && data.questions.length > 0) {
        questions = data.questions;

        // Initialize starter code answers for coding questions if empty
        const initialAnswers: Record<string, string> = {};
        for (const q of questions) {
          if (q.type === 'coding' && q.metadata?.starterCode) {
            initialAnswers[q.id] = q.metadata.starterCode;
          }
        }
        answers = { ...initialAnswers, ...answers };

        if (data.seatRow !== undefined && data.seatCol !== undefined) {
          seatingInfo = {
            seatRow: data.seatRow + 1,
            seatCol: data.seatCol + 1,
            questionSetId: data.questionSetId || 'SET-A',
          };
        }
      }
    } catch (err: any) {
      if (err.response?.data?.error?.code === 'TIME_GATE_EARLY') {
        isTimeGateEarly = true;
        timeGateMessage = getErrorMessage(err) || 'Test has not started yet. (Entry opens 1 minute prior).';
        secondsUntilOpen = 60;
        startEarlyCountdown();
        return;
      }
      if (err.response?.data?.error?.code === 'TIME_GATE_EXPIRED') {
        isTimeGateExpired = true;
        timeGateMessage = getErrorMessage(err) || 'This examination session has concluded and is no longer accepting submissions.';
        return;
      }
      if (
        err.response?.status === 403 ||
        err.response?.data?.error?.code === 'SEATING_PLAN_EXCLUSION' ||
        err.response?.data?.error?.code === 'NO_ROLL_NUMBER'
      ) {
        seatingExcluded = true;
        exclusionMessage =
          getErrorMessage(err) ||
          'Candidate roll number is not assigned in the physical seating plan for this test. You are prohibited from taking this exam.';
        return;
      }
      appStore.addToast(getErrorMessage(err), 'error');
      return;
    }

    // Start countdown timer
    timerInterval = setInterval(() => {
      if (secondsRemaining > 0) {
        secondsRemaining--;
      } else {
        if (timerInterval) clearInterval(timerInterval);
        handleAutoSubmit('timer_expiry');
      }
    }, 1000);
  }

  function setupListeners() {
    window.addEventListener('blur', handleWindowBlur);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    // Request fullscreen on entry
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
      api.post(`/exams/${examId}/fullscreen-event`, { eventType: 'enter' }).catch(() => {});
    }
  }

  function teardownListeners() {
    window.removeEventListener('blur', handleWindowBlur);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }

  function handleWindowBlur() {
    violationCount++;
    appStore.addToast('Warning: Window focus lost. Event logged to proctor.', 'error');
    api.post(`/exams/${examId}/focus-event`, { eventType: 'blur' }).catch(() => {});
  }

  function handleVisibilityChange() {
    if (document.hidden) {
      violationCount++;
      appStore.addToast('Warning: Screen hidden or switched tab. Event logged.', 'error');
      api.post(`/exams/${examId}/focus-event`, { eventType: 'visibility_hidden' }).catch(() => {});
    } else {
      api.post(`/exams/${examId}/focus-event`, { eventType: 'focus' }).catch(() => {});
    }
  }

  function handleFullscreenChange() {
    if (!document.fullscreenElement) {
      violationCount++;
      appStore.addToast('Warning: Fullscreen exited! Please re-enable fullscreen.', 'error');
      api.post(`/exams/${examId}/fullscreen-event`, { eventType: 'exit' }).catch(() => {});
    }
  }

  async function initWebcam() {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: true });
      proctorStream = s;
      if (videoEl) videoEl.srcObject = s;
    } catch (e) {
      console.warn('Proctor video feed fallback', e);
    }
  }

  function handleAnswerChange(val: string) {
    if (!currentQuestion) return;
    answers = { ...answers, [currentQuestion.id]: val };

    // Debounced autosave
    autosaveStatus = 'Saving...';
    if (autosaveTimer) clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(async () => {
      try {
        await api.post(`/exams/${examId}/responses/autosave`, {
          answers: { ...answers, __telemetry: editorTelemetryStats },
        });
        const timeStr = new Date().toLocaleTimeString();
        autosaveStatus = `Autosaved at ${timeStr}`;
      } catch {
        autosaveStatus = 'Saved locally';
      }
    }, 1500);
  }

  function handleMultiOptionToggle(option: string) {
    if (!currentQuestion) return;
    const currentVal = answers[currentQuestion.id] || '';
    let selectedList = currentVal ? currentVal.split('|||') : [];
    if (selectedList.includes(option)) {
      selectedList = selectedList.filter((x) => x !== option);
    } else {
      selectedList = [...selectedList, option];
    }
    handleAnswerChange(selectedList.join('|||'));
  }

  function isMultiOptionSelected(qId: string, option: string): boolean {
    const currentVal = answers[qId] || '';
    return currentVal.split('|||').includes(option);
  }

  function handleMonacoTelemetry(event: any) {
    if (!currentQuestion) return;
    const qId = currentQuestion.id;
    const stats = editorTelemetryStats[qId] || {
      keystrokes: 0,
      pastes: 0,
      blurs: 0,
      language: currentQuestion.metadata?.language || 'python',
    };

    if (event.type === 'keystroke') {
      stats.keystrokes += event.details?.changesCount || 1;
    } else if (event.type === 'paste') {
      stats.pastes += 1;
    } else if (event.type === 'blur') {
      stats.blurs += 1;
    }
    if (event.details?.language) {
      stats.language = String(event.details.language);
    }
    editorTelemetryStats[qId] = stats;

    api.post(`/exams/${examId}/telemetry/editor`, {
      eventType: event.type,
      payload: {
        questionId: qId,
        ...event.details,
      },
    }).catch(() => {});
  }

  async function handleAutoSubmit(reason: 'timer_expiry' | 'auto_logout') {
    try {
      await api.post(`/exams/${examId}/responses/submit`, {
        answers: { ...answers, __telemetry: editorTelemetryStats },
        submittedVia: reason,
      });
      push(`/exams/${examId}/submitted`);
    } catch {
      push(`/exams/${examId}/submitted`);
    }
  }

  async function handleFinalSubmit() {
    isSubmitting = true;
    try {
      await api.post(`/exams/${examId}/responses/submit`, {
        answers: { ...answers, __telemetry: editorTelemetryStats },
        submittedVia: 'manual',
      });
      appStore.addToast('Examination submitted successfully', 'success');
      push(`/exams/${examId}/submitted`);
    } catch (err) {
      appStore.addToast(getErrorMessage(err), 'error');
    } finally {
      isSubmitting = false;
      showSubmitModal = false;
    }
  }
</script>

<div class="portal-page" class:visible={mounted}>
  <!-- LOCKED COUNTDOWN SCREEN (Requirement 2 & 3: Before start window) -->
  {#if isTimeGateEarly}
    <div class="exclusion-backdrop">
      <div class="exclusion-card">
        <div class="exclusion-icon-box time-gate-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
        </div>
        <h2 class="exclusion-title">Test Has Not Started Yet</h2>
        <p class="exclusion-msg">
          {timeGateMessage || `Test has not started yet. Opens at ${formattedStartTime} (Entry opens 1 minute prior).`}
        </p>

        <div class="time-gate-countdown-panel">
          <span class="countdown-label">Entry Window Opens In</span>
          <span class="countdown-digits">{formattedCountdownUntilOpen()}</span>
          <span class="countdown-sub">The test portal will automatically unlock once the entry window opens.</span>
        </div>

        <div class="exclusion-actions">
          <Button variant="ghost" onclick={() => push('/dashboard')}>
            Return to Dashboard
          </Button>
          <Button variant="primary" onclick={initExamSession}>
            Check Now
          </Button>
        </div>
      </div>
    </div>
  <!-- EXPIRED NOTICE SCREEN (Requirement 2 & 3: After end time) -->
  {:else if isTimeGateExpired}
    <div class="exclusion-backdrop">
      <div class="exclusion-card">
        <div class="exclusion-icon-box time-gate-expired-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="16" y1="2" x2="16" y2="6"></line>
            <line x1="8" y1="2" x2="8" y2="6"></line>
            <line x1="3" y1="10" x2="21" y2="10"></line>
          </svg>
        </div>
        <h2 class="exclusion-title">Examination Session Concluded</h2>
        <p class="exclusion-msg">
          This examination session has concluded and is no longer accepting submissions.
        </p>
        <div class="exclusion-notice">
          <strong>Institutional Regulation:</strong>
          The scheduled examination submission window has closed. All unsaved responses or post-deadline submissions are rejected in compliance with academic integrity standards.
        </div>
        <div class="exclusion-actions">
          <Button variant="primary" onclick={() => push('/dashboard')}>
            Return to Dashboard
          </Button>
        </div>
      </div>
    </div>
  <!-- SEATING EXCLUSION SCREEN (Requirement 1.6: unlisted students prohibited) -->
  {:else if seatingExcluded}
    <div class="exclusion-backdrop">
      <div class="exclusion-card">
        <div class="exclusion-icon-box">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
          </svg>
        </div>
        <h2 class="exclusion-title">Access Prohibited: Seating Plan Exclusion</h2>
        <p class="exclusion-msg">
          {exclusionMessage}
        </p>
        <div class="exclusion-notice">
          <strong>Physical Classroom Rule:</strong>
          In accordance with examination proctoring regulations, all candidate terminals are strictly paired
          with the instructor's physical classroom seating matrix to prevent unauthorized exam sitting.
        </div>
        <div class="exclusion-actions">
          <Button variant="primary" onclick={() => push('/dashboard')}>
            Return to Dashboard
          </Button>
        </div>
      </div>
    </div>
  {:else}
    <!-- Top Navigation & Proctoring Bar -->
    <header class="portal-header">
      <div class="header-left">
        <span class="portal-title">{examTitle}</span>
        <span class="exam-code">ID: {examId}</span>

        {#if seatingInfo}
          <div class="seat-badge">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
              <circle cx="12" cy="10" r="3"></circle>
            </svg>
            <span>Desk: Row {seatingInfo.seatRow}, Col {seatingInfo.seatCol}</span>
            <span class="set-pill">{seatingInfo.questionSetId}</span>
          </div>
        {/if}
      </div>

      <div class="header-center">
        <div class="timer-box">
          <span class="timer-label">Time Left:</span>
          <span class="timer-digits">{formattedTime()}</span>
        </div>
        <div class="autosave-tag">
          <span class="save-dot"></span>
          <span class="save-text">{autosaveStatus}</span>
        </div>
      </div>

      <div class="header-right">
        <Button variant="primary" onclick={() => { showSubmitModal = true; }}>
          Submit Exam
        </Button>
      </div>
    </header>

    <!-- Main Workspace -->
    <div class="portal-workspace">
      <!-- Left: Question Palette Sidebar -->
      <aside class="palette-sidebar">
        <div class="palette-header">
          <span class="palette-heading">Questions</span>
          <span class="palette-count">{answeredCount} of {questions.length} answered</span>
        </div>

        <div class="palette-grid">
          {#each questions as q, idx}
            <button
              type="button"
              class="palette-chip"
              class:active={idx === currentIdx}
              class:answered={answers[q.id] && answers[q.id].trim().length > 0}
              onclick={() => { currentIdx = idx; }}
            >
              <span class="chip-num">{idx + 1}</span>
              <span class="chip-type-tiny">{q.type === 'coding' ? 'CODE' : q.type === 'multi_correct' ? 'MULT' : q.type === 'descriptive' ? 'DESC' : 'MCQ'}</span>
            </button>
          {/each}
        </div>

        <!-- Live Proctor Widget -->
        <div class="proctor-widget">
          <div class="video-container">
            <video bind:this={videoEl} autoplay playsinline muted class="proctor-video">
              <track kind="captions" />
            </video>
            <div class="proctor-badge">
              <span class="live-dot"></span>
              Proctor AI Active
            </div>
          </div>
          {#if violationCount > 0}
            <div class="violation-alert">
              {violationCount} suspicious focus event{violationCount > 1 ? 's' : ''} detected
            </div>
          {/if}
        </div>
      </aside>

      <!-- Right: Main Question & Answer Container (SPLIT LAYOUT: Question on Left, Answer on Right; Phone = Top/Bottom) -->
      <main class="question-main-area">
        {#if currentQuestion}
          <div class="qa-candidate-split">
            <!-- LEFT PANE: Question Prompt -->
            <div class="candidate-pane question-pane">
              <div class="q-meta-row">
                <span class="q-number-tag">Question {currentIdx + 1} of {questions.length}</span>
                <span class="q-type-badge {currentQuestion.type}">
                  {currentQuestion.type.toUpperCase().replace('_', ' ')}
                </span>
              </div>

              <div class="question-body">
                <p class="q-statement">{currentQuestion.content}</p>
              </div>

              {#if currentQuestion.type === 'coding'}
                <div class="coding-instructions-box">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="16" x2="12" y2="12"></line>
                    <line x1="12" y1="8" x2="12.01" y2="8"></line>
                  </svg>
                  <span>
                    Write your complete implementation in the Monaco editor on the right.
                    Keystrokes and editor events are continuously captured for telemetry proctoring.
                  </span>
                </div>
              {/if}
            </div>

            <!-- RIGHT PANE: Candidate Response Area -->
            <div class="candidate-pane answer-pane">
              <div class="pane-header">
                <span class="answer-header-title">Your Answer</span>
                {#if currentQuestion.type === 'coding'}
                  <span class="editor-lang-tag">
                    {(currentQuestion.metadata?.language || 'python').toUpperCase()}
                  </span>
                {/if}
              </div>

              <!-- MCQ -->
              {#if currentQuestion.type === 'mcq'}
                <div class="mcq-options-container">
                  {#each currentQuestion.metadata?.options || [] as option}
                    <label class="mcq-option-label" class:selected={answers[currentQuestion.id] === option}>
                      <input
                        type="radio"
                        name="option-{currentQuestion.id}"
                        value={option}
                        checked={answers[currentQuestion.id] === option}
                        onchange={() => handleAnswerChange(option)}
                      />
                      <span class="option-custom-radio"></span>
                      <span class="option-text">{option}</span>
                    </label>
                  {/each}
                </div>

              <!-- Multi-Correct -->
              {:else if currentQuestion.type === 'multi_correct'}
                <div class="mcq-options-container">
                  {#each currentQuestion.metadata?.options || [] as option}
                    <label class="mcq-option-label" class:selected={isMultiOptionSelected(currentQuestion.id, option)}>
                      <input
                        type="checkbox"
                        value={option}
                        checked={isMultiOptionSelected(currentQuestion.id, option)}
                        onchange={() => handleMultiOptionToggle(option)}
                      />
                      <span class="option-custom-checkbox"></span>
                      <span class="option-text">{option}</span>
                    </label>
                  {/each}
                </div>

              <!-- Coding (Monaco Editor with Telemetry) -->
              {:else if currentQuestion.type === 'coding'}
                <div class="monaco-portal-wrapper">
                  <MonacoEditor
                    value={answers[currentQuestion.id] || currentQuestion.metadata?.starterCode || ''}
                    language={currentQuestion.metadata?.language || 'python'}
                    height="420px"
                    onchange={handleAnswerChange}
                    ontelemetry={handleMonacoTelemetry}
                  />
                </div>

              <!-- Descriptive -->
              {:else if currentQuestion.type === 'descriptive'}
                <div class="descriptive-answer-box">
                  <textarea
                    class="descriptive-textarea"
                    rows="14"
                    placeholder="Type your detailed answer and explanation here..."
                    value={answers[currentQuestion.id] || ''}
                    oninput={(e) => handleAnswerChange((e.currentTarget as HTMLTextAreaElement).value)}
                  ></textarea>
                  <div class="word-count-bar">
                    {(answers[currentQuestion.id] || '').trim().split(/\s+/).filter(Boolean).length} words
                  </div>
                </div>
              {/if}
            </div>
          </div>

          <!-- Bottom Pagination Controls -->
          <div class="portal-pagination">
            <Button
              variant="secondary"
              disabled={currentIdx === 0}
              onclick={() => { currentIdx = Math.max(0, currentIdx - 1); }}
            >
              ← Previous Question
            </Button>

            <span class="page-indicator">{currentIdx + 1} / {questions.length}</span>

            <Button
              variant="secondary"
              disabled={currentIdx === questions.length - 1}
              onclick={() => { currentIdx = Math.min(questions.length - 1, currentIdx + 1); }}
            >
              Next Question →
            </Button>
          </div>
        {/if}
      </main>
    </div>
  {/if}
</div>

<!-- Submit Confirmation Modal -->
{#if showSubmitModal}
  <div class="modal-backdrop" onclick={() => { showSubmitModal = false; }} role="presentation">
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div class="modal-card" onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" tabindex="-1">
      <h3 class="modal-title">Confirm Final Submission</h3>
      <p class="modal-message">
        You have answered <strong>{answeredCount}</strong> out of <strong>{questions.length}</strong> questions.
        Once submitted, your answers will be securely sealed and logged for evaluation.
      </p>

      <div class="modal-actions">
        <Button variant="primary" loading={isSubmitting} onclick={handleFinalSubmit}>
          Confirm & Submit Exam
        </Button>
        <Button variant="ghost" onclick={() => { showSubmitModal = false; }}>
          Return to Exam
        </Button>
      </div>
    </div>
  </div>
{/if}

<style>
  .portal-page {
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    background-color: var(--color-bg);
    opacity: 0;
    transition: opacity 0.3s var(--ease);
  }

  .portal-page.visible {
    opacity: 1;
  }

  /* Exclusion Screen */
  .exclusion-backdrop {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-6);
  }

  .exclusion-card {
    max-width: 540px;
    width: 100%;
    background-color: var(--color-bg-elevated);
    border: 1px solid #fca5a5;
    border-radius: var(--radius);
    padding: var(--space-8);
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: var(--space-4);
    box-shadow: var(--shadow);
  }

  .exclusion-icon-box {
    font-size: 2.5rem;
    color: #ef4444;
  }

  .exclusion-icon-box.time-gate-icon {
    color: #3b82f6;
  }

  .exclusion-icon-box.time-gate-expired-icon {
    color: #f59e0b;
  }

  .exclusion-title {
    font-size: var(--text-xl);
    font-weight: 700;
    color: var(--color-text-primary);
    margin: 0;
  }

  .exclusion-msg {
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
    line-height: 1.6;
    margin: 0;
  }

  .time-gate-countdown-panel {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-4) var(--space-6);
    background: #09090b;
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    width: 100%;
  }

  .countdown-label {
    font-size: 0.6875rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: var(--color-text-secondary);
  }

  .countdown-digits {
    font-family: var(--font-mono);
    font-size: 2.5rem;
    font-weight: 700;
    color: #38bdf8;
    letter-spacing: 2px;
  }

  .countdown-sub {
    font-size: 0.75rem;
    color: var(--color-text-muted);
  }

  .exclusion-notice {
    font-size: var(--text-xs);
    color: var(--color-text-secondary);
    background-color: var(--color-bg-subtle);
    border: 1px solid var(--color-border);
    padding: var(--space-3);
    border-radius: var(--radius);
    line-height: 1.5;
  }

  .exclusion-actions {
    margin-top: var(--space-2);
    display: flex;
    gap: var(--space-3);
  }

  /* Portal Header */
  .portal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-3) var(--space-6);
    background-color: var(--color-bg-elevated);
    border-bottom: 1px solid var(--color-border);
    flex-wrap: wrap;
    gap: var(--space-3);
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .portal-title {
    font-size: var(--text-base);
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .exam-code {
    font-size: var(--text-xs);
    font-family: var(--font-mono);
    color: var(--color-text-muted);
  }

  .seat-badge {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: 3px 8px;
    background-color: rgba(56, 189, 248, 0.08);
    border: 1px solid rgba(56, 189, 248, 0.25);
    border-radius: var(--radius-sm);
    font-size: var(--text-xs);
    font-weight: 600;
    color: #0369a1;
  }

  .set-pill {
    padding: 1px 5px;
    background-color: #0284c7;
    color: #ffffff;
    border-radius: var(--radius-sm);
    font-family: var(--font-mono);
    font-size: 0.625rem;
  }

  .header-center {
    display: flex;
    align-items: center;
    gap: var(--space-5);
  }

  .timer-box {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-1) var(--space-3);
    background-color: var(--color-bg-subtle);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
  }

  .timer-label {
    font-size: var(--text-xs);
    color: var(--color-text-secondary);
    text-transform: uppercase;
  }

  .timer-digits {
    font-family: var(--font-mono);
    font-size: var(--text-base);
    font-weight: 700;
    color: var(--color-text-primary);
  }

  .autosave-tag {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--text-xs);
    color: var(--color-text-muted);
  }

  .save-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background-color: var(--color-success);
  }

  /* Workspace Layout */
  .portal-workspace {
    flex: 1;
    display: flex;
    overflow: hidden;
  }

  .palette-sidebar {
    width: 240px;
    background-color: var(--color-bg-elevated);
    border-right: 1px solid var(--color-border);
    padding: var(--space-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .palette-header {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .palette-heading {
    font-size: var(--text-xs);
    font-weight: 700;
    color: var(--color-text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .palette-count {
    font-size: 0.6875rem;
    color: var(--color-text-muted);
  }

  .palette-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: var(--space-2);
  }

  .palette-chip {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 40px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    background-color: var(--color-bg-subtle);
    cursor: pointer;
    transition: all var(--duration-fast) var(--ease);
  }

  .palette-chip:hover {
    border-color: #0284c7;
  }

  .palette-chip.active {
    border-color: #0284c7;
    background-color: rgba(56, 189, 248, 0.1);
    box-shadow: 0 0 0 1px #0284c7;
  }

  .palette-chip.answered {
    background-color: #ecfdf5;
    border-color: #a7f3d0;
  }

  .chip-num {
    font-size: var(--text-xs);
    font-weight: 700;
  }

  .chip-type-tiny {
    font-size: 0.5rem;
    font-weight: 600;
    color: var(--color-text-muted);
  }

  .proctor-widget {
    margin-top: auto;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .video-container {
    position: relative;
    width: 100%;
    height: 120px;
    background-color: #000000;
    border-radius: var(--radius);
    overflow: hidden;
    border: 1px solid var(--color-border);
  }

  .proctor-video {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .proctor-badge {
    position: absolute;
    bottom: 6px;
    left: 6px;
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 2px 6px;
    background: rgba(0, 0, 0, 0.7);
    color: #ffffff;
    font-size: 0.5625rem;
    border-radius: var(--radius-sm);
  }

  .live-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background-color: #ef4444;
    animation: pulse 1.5s infinite;
  }

  .violation-alert {
    padding: 4px 8px;
    background: #fee2e2;
    border: 1px solid #fca5a5;
    color: #b91c1c;
    border-radius: var(--radius-sm);
    font-size: 0.6875rem;
    text-align: center;
  }

  /* Main Question Container */
  .question-main-area {
    flex: 1;
    overflow-y: auto;
    padding: var(--space-6);
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  /* SPLIT LAYOUT (Requirement 1.4: Left = Question, Right = Answer; Phone = Top/Bottom) */
  .qa-candidate-split {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-6);
    flex: 1;
  }

  @media (max-width: 860px) {
    .qa-candidate-split {
      grid-template-columns: 1fr;
    }
    .palette-sidebar {
      display: none;
    }
  }

  .candidate-pane {
    background-color: var(--color-bg-elevated);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    padding: var(--space-6);
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    box-shadow: var(--shadow-sm);
  }

  .q-meta-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid var(--color-border);
    padding-bottom: var(--space-3);
  }

  .q-number-tag {
    font-size: var(--text-sm);
    font-weight: 700;
    color: var(--color-text-primary);
  }

  .q-type-badge {
    font-size: 0.625rem;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: var(--radius-sm);
    letter-spacing: 0.5px;
  }

  .q-type-badge.mcq { background: #e0f2fe; color: #0369a1; }
  .q-type-badge.multi_correct { background: #fef3c7; color: #b45309; }
  .q-type-badge.coding { background: #ecfdf5; color: #047857; }
  .q-type-badge.descriptive { background: #f3e8ff; color: #7e22ce; }

  .q-statement {
    font-size: var(--text-base);
    line-height: 1.7;
    color: var(--color-text-primary);
    white-space: pre-wrap;
  }

  .coding-instructions-box {
    margin-top: auto;
    display: flex;
    gap: var(--space-2);
    padding: var(--space-3);
    background-color: var(--color-bg-subtle);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    font-size: var(--text-xs);
    color: var(--color-text-secondary);
    line-height: 1.5;
  }

  .pane-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid var(--color-border);
    padding-bottom: var(--space-3);
  }

  .answer-header-title {
    font-size: var(--text-sm);
    font-weight: 700;
    color: var(--color-text-primary);
  }

  .editor-lang-tag {
    font-family: var(--font-mono);
    font-size: 0.6875rem;
    font-weight: 700;
    color: #0284c7;
    padding: 2px 6px;
    background: rgba(56, 189, 248, 0.1);
    border-radius: var(--radius-sm);
  }

  /* Option labels */
  .mcq-options-container {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .mcq-option-label {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4);
    background-color: var(--color-bg-subtle);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    cursor: pointer;
    transition: all var(--duration-fast) var(--ease);
  }

  .mcq-option-label:hover {
    border-color: #0284c7;
    background-color: var(--color-bg-elevated);
  }

  .mcq-option-label.selected {
    border-color: #0284c7;
    background-color: rgba(56, 189, 248, 0.08);
  }

  .option-text {
    font-size: var(--text-sm);
    color: var(--color-text-primary);
  }

  .descriptive-answer-box {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .descriptive-textarea {
    width: 100%;
    padding: var(--space-4);
    font-family: var(--font-sans);
    font-size: var(--text-sm);
    line-height: 1.6;
    color: var(--color-text-primary);
    background-color: var(--color-bg-input);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    outline: none;
    resize: vertical;
  }

  .word-count-bar {
    text-align: right;
    font-size: var(--text-xs);
    color: var(--color-text-muted);
  }

  .portal-pagination {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background-color: var(--color-bg-elevated);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    padding: var(--space-3) var(--space-5);
  }

  .page-indicator {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    font-weight: 600;
    color: var(--color-text-secondary);
  }

  /* Modal */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: var(--space-4);
  }

  .modal-card {
    background-color: var(--color-bg-elevated);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    padding: var(--space-6);
    max-width: 440px;
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    box-shadow: var(--shadow);
  }

  .modal-title {
    font-size: var(--text-lg);
    font-weight: 600;
    color: var(--color-text-primary);
    margin: 0;
  }

  .modal-message {
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
    line-height: 1.5;
    margin: 0;
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-3);
  }
</style>
