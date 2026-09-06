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

  interface QuestionItem {
    id: string;
    content: string;
    type: 'mcq' | 'code';
    metadata?: { options?: string[] };
  }

  let mounted = $state(false);
  let questions = $state<QuestionItem[]>([
    {
      id: 'q-1',
      content: 'Which data structure offers amortized O(1) average time complexity for key-value insertions and lookups?',
      type: 'mcq',
      metadata: { options: ['Binary Search Tree', 'Hash Map', 'Red-Black Tree', 'Skip List'] },
    },
    {
      id: 'q-2',
      content: 'Implement an in-place function in TypeScript/JavaScript to reverse a singly-linked list given its head pointer.',
      type: 'code',
    },
    {
      id: 'q-3',
      content: 'What is the worst-case time complexity of QuickSort when selecting the first element as the pivot in an already sorted array?',
      type: 'mcq',
      metadata: { options: ['O(n)', 'O(n log n)', 'O(n^2)', 'O(log n)'] },
    },
  ]);

  let currentIdx = $state(0);
  let answers = $state<Record<string, string>>({});
  let autosaveStatus = $state('All changes saved');
  let autosaveTimer: ReturnType<typeof setTimeout> | null = null;

  // Timer
  let secondsRemaining = $state(7200); // 120 minutes default
  let timerInterval: ReturnType<typeof setInterval> | null = null;

  // Modals & Proctoring
  let showSubmitModal = $state(false);
  let isSubmitting = $state(false);
  let videoEl = $state<HTMLVideoElement | null>(null);
  let proctorStream = $state<MediaStream | null>(null);
  let violationCount = $state(0);

  const currentQuestion = $derived(questions[currentIdx]);
  const answeredCount = $derived(Object.values(answers).filter((a) => a && a.trim().length > 0).length);

  const formattedTime = $derived(() => {
    const hrs = Math.floor(secondsRemaining / 3600);
    const mins = Math.floor((secondsRemaining % 3600) / 60);
    const secs = secondsRemaining % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
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
    if (autosaveTimer) clearTimeout(autosaveTimer);
    if (proctorStream) proctorStream.getTracks().forEach((t) => t.stop());
    teardownListeners();
  });

  async function initExamSession() {
    try {
      const configRes = await api.get(`/exams/${examId}/session-config`);
      const cfg = configRes.data?.data;
      if (cfg?.idleTimeoutSec) {
        // apply config if given
      }
    } catch {
      // Demo fallback configuration
    }

    try {
      const qRes = await api.get(`/exams/${examId}/questions`);
      if (qRes.data?.data?.questions && qRes.data.data.questions.length > 0) {
        questions = qRes.data.data.questions;
      }
    } catch {
      // Keep default algorithm questions
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

    // Telemetry ping
    api.post(`/exams/${examId}/telemetry/editor`, {
      eventType: 'keystroke',
      payload: { questionId: currentQuestion.id, length: val.length },
    }).catch(() => {});

    // Debounced autosave
    autosaveStatus = 'Saving...';
    if (autosaveTimer) clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(async () => {
      try {
        await api.post(`/exams/${examId}/responses/autosave`, { answers });
        const timeStr = new Date().toLocaleTimeString();
        autosaveStatus = `Autosaved at ${timeStr}`;
      } catch {
        autosaveStatus = 'Saved locally';
      }
    }, 1500);
  }

  async function handleAutoSubmit(reason: 'timer_expiry' | 'auto_logout') {
    try {
      await api.post(`/exams/${examId}/responses/submit`, {
        answers,
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
        answers,
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
  <!-- Top Navigation & Proctoring Bar -->
  <header class="portal-header">
    <div class="header-left">
      <span class="portal-title">Midterm Examination</span>
      <span class="exam-code">ID: {examId}</span>
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
    <!-- Left: Question Palette -->
    <aside class="palette-sidebar">
      <div class="palette-header">
        <span class="palette-heading">Questions Overview</span>
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
            {idx + 1}
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

    <!-- Right: Question & Response Editor Area -->
    <main class="question-container">
      {#if currentQuestion}
        <div class="question-card">
          <div class="question-meta">
            <span class="q-number">Question {currentIdx + 1} of {questions.length}</span>
            <span class="q-type-badge">{currentQuestion.type === 'code' ? 'Code Implementation' : 'Multiple Choice'}</span>
          </div>

          <p class="question-content">{currentQuestion.content}</p>

          <div class="answer-section">
            {#if currentQuestion.type === 'mcq'}
              <div class="mcq-options">
                {#each currentQuestion.metadata?.options || [] as option}
                  <label class="mcq-option-label" class:selected={answers[currentQuestion.id] === option}>
                    <input
                      type="radio"
                      name="option-{currentQuestion.id}"
                      value={option}
                      checked={answers[currentQuestion.id] === option}
                      onchange={() => handleAnswerChange(option)}
                    />
                    <span class="option-text">{option}</span>
                  </label>
                {/each}
              </div>
            {:else}
              <div class="code-editor-box">
                <div class="editor-bar">
                  <span class="editor-lang">TypeScript / JavaScript</span>
                  <span class="editor-tip">Monospace code editor</span>
                </div>
                <textarea
                  class="code-textarea"
                  placeholder="// Write your solution here..."
                  rows="14"
                  value={answers[currentQuestion.id] || ''}
                  oninput={(e) => handleAnswerChange((e.currentTarget as HTMLTextAreaElement).value)}
                ></textarea>
              </div>
            {/if}
          </div>
        </div>

        <div class="pagination-footer">
          <Button
            variant="secondary"
            disabled={currentIdx === 0}
            onclick={() => { currentIdx = Math.max(0, currentIdx - 1); }}
          >
            Previous
          </Button>

          <Button
            variant="secondary"
            disabled={currentIdx === questions.length - 1}
            onclick={() => { currentIdx = Math.min(questions.length - 1, currentIdx + 1); }}
          >
            Next Question
          </Button>
        </div>
      {/if}
    </main>
  </div>
</div>

<!-- Submit Confirmation Modal -->
{#if showSubmitModal}
  <div class="modal-backdrop" onclick={() => { showSubmitModal = false; }} role="presentation">
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div class="modal-card" onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" tabindex="-1">
      <h3 class="modal-title">Confirm Final Submission</h3>
      <p class="modal-message">
        You have answered <strong>{answeredCount}</strong> out of <strong>{questions.length}</strong> questions.
        Once submitted, your answers will be securely sealed and evaluated.
      </p>

      <div class="modal-actions">
        <Button variant="primary" loading={isSubmitting} onclick={handleFinalSubmit}>
          Confirm & Submit
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

  .portal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-3) var(--space-6);
    background-color: var(--color-bg-elevated);
    border-bottom: 1px solid var(--color-border);
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .portal-title {
    font-size: var(--text-base);
    font-weight: 500;
    color: var(--color-text-primary);
  }

  .exam-code {
    font-size: var(--text-xs);
    font-family: var(--font-mono);
    color: var(--color-text-muted);
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
    font-weight: 600;
    color: var(--color-text-primary);
    letter-spacing: 1px;
  }

  .autosave-tag {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .save-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background-color: var(--color-success);
  }

  .save-text {
    font-size: var(--text-xs);
    color: var(--color-text-muted);
  }

  .portal-workspace {
    flex: 1;
    display: flex;
    overflow: hidden;
  }

  .palette-sidebar {
    width: 280px;
    background-color: var(--color-bg-elevated);
    border-right: 1px solid var(--color-border);
    padding: var(--space-5);
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: var(--space-5);
  }

  .palette-header {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .palette-heading {
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--color-text-primary);
  }

  .palette-count {
    font-size: var(--text-xs);
    color: var(--color-text-muted);
  }

  .palette-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: var(--space-2);
  }

  .palette-chip {
    height: 38px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--color-text-secondary);
    background-color: var(--color-bg-subtle);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    cursor: pointer;
    transition: all var(--duration-fast) var(--ease);
  }

  .palette-chip.active {
    border-color: var(--color-accent);
    color: var(--color-text-primary);
    font-weight: 600;
    outline: 2px solid var(--color-accent);
    outline-offset: -2px;
  }

  .palette-chip.answered {
    background-color: #f0fdf4;
    border-color: #bbf7d0;
    color: var(--color-success);
  }

  .proctor-widget {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .video-container {
    position: relative;
    width: 100%;
    aspect-ratio: 4 / 3;
    background-color: #000;
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    overflow: hidden;
  }

  .proctor-video {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transform: scaleX(-1);
  }

  .proctor-badge {
    position: absolute;
    top: var(--space-2);
    left: var(--space-2);
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 0.625rem;
    font-weight: 600;
    color: #fff;
    background: rgba(0, 0, 0, 0.7);
    padding: 2px 6px;
    border-radius: var(--radius-sm);
  }

  .live-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background-color: #ef4444;
  }

  .violation-alert {
    font-size: var(--text-xs);
    color: var(--color-error);
    background-color: var(--color-error-bg);
    padding: var(--space-2);
    border: 1px solid var(--color-error-border);
    border-radius: var(--radius);
  }

  .question-container {
    flex: 1;
    padding: var(--space-6) var(--space-8);
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    overflow-y: auto;
    gap: var(--space-6);
  }

  .question-card {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
    background-color: var(--color-bg-elevated);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    padding: var(--space-6);
    box-shadow: var(--shadow-sm);
  }

  .question-meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .q-number {
    font-size: var(--text-xs);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--color-text-secondary);
  }

  .q-type-badge {
    font-size: 0.6875rem;
    font-weight: 500;
    padding: 2px 6px;
    background-color: var(--color-bg-subtle);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    color: var(--color-text-secondary);
  }

  .question-content {
    font-size: var(--text-base);
    color: var(--color-text-primary);
    line-height: 1.6;
    margin: 0;
  }

  .mcq-options {
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
    border-color: var(--color-border-focus);
  }

  .mcq-option-label.selected {
    border-color: var(--color-accent);
    background-color: var(--color-bg-elevated);
  }

  .option-text {
    font-size: var(--text-sm);
    color: var(--color-text-primary);
  }

  .code-editor-box {
    display: flex;
    flex-direction: column;
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    overflow: hidden;
  }

  .editor-bar {
    display: flex;
    justify-content: space-between;
    padding: var(--space-2) var(--space-3);
    background-color: var(--color-bg-subtle);
    border-bottom: 1px solid var(--color-border);
    font-size: var(--text-xs);
    color: var(--color-text-secondary);
  }

  .editor-lang {
    font-weight: 500;
  }

  .code-textarea {
    width: 100%;
    padding: var(--space-4);
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    line-height: 1.5;
    color: var(--color-text-primary);
    background-color: var(--color-bg-elevated);
    border: none;
    outline: none;
    resize: vertical;
    tab-size: 2;
  }

  .pagination-footer {
    display: flex;
    justify-content: space-between;
  }

  /* Modal */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background-color: rgba(28, 25, 23, 0.4);
    backdrop-filter: blur(2px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-4);
    z-index: 50;
  }

  .modal-card {
    width: 100%;
    max-width: 440px;
    background-color: var(--color-bg-elevated);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    padding: var(--space-6);
    box-shadow: var(--shadow);
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .modal-title {
    font-size: var(--text-lg);
    font-weight: 500;
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
    gap: var(--space-2);
    margin-top: var(--space-2);
  }

  @media (max-width: 768px) {
    .portal-workspace {
      flex-direction: column;
    }
    .palette-sidebar {
      width: 100%;
      border-right: none;
      border-bottom: 1px solid var(--color-border);
    }
  }
</style>
