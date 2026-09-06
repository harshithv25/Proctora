<script lang="ts">
  import { onMount } from 'svelte';
  import { push } from 'svelte-spa-router';
  import Button from '../components/ui/Button.svelte';
  import Input from '../components/ui/Input.svelte';
  import { api, getErrorMessage } from '../lib/api';
  import { appStore } from '../stores/app.store.svelte';
  import { authStore } from '../stores/auth.store.svelte';

  let mounted = $state(false);
  let activeTab = $state<'create' | 'questions' | 'seating' | 'accommodations'>('create');

  // Exam Form
  let examTitle = $state('Midterm Examination: Computer Networks');
  let startTime = $state(new Date(Date.now() + 3600000).toISOString().slice(0, 16));
  let endTime = $state(new Date(Date.now() + 10800000).toISOString().slice(0, 16));
  let idleTimeoutSec = $state(300);
  let createdExamId = $state('demo-exam-1');
  let isCreatingExam = $state(false);

  // Question Form
  let qContent = $state('');
  let qType = $state<'mcq' | 'code'>('mcq');
  let qOptions = $state('TCP, UDP, ICMP, ARP');
  let questionsList = $state<Array<{ content: string; type: 'mcq' | 'code'; metadata?: any }>>([]);
  let isAddingQuestions = $state(false);

  // Seating Form
  let seatRoll = $state('21CS001');
  let seatRow = $state(1);
  let seatCol = $state(1);
  let isSavingSeating = $state(false);

  // Accommodations Form
  let accommUserId = $state('');
  let extraMinutes = $state(30);
  let isSavingAccomm = $state(false);

  onMount(() => {
    if (!authStore.isAuthenticated) {
      push('/login');
      return;
    }
    requestAnimationFrame(() => { mounted = true; });
  });

  async function handleCreateExam() {
    isCreatingExam = true;
    try {
      const res = await api.post('/exams', {
        title: examTitle.trim(),
        startTime: new Date(startTime).toISOString(),
        endTime: new Date(endTime).toISOString(),
        idleTimeoutSec: Number(idleTimeoutSec),
      });

      const newId = res.data?.data?.exam?.id || res.data?.data?.id || 'demo-exam-1';
      createdExamId = newId;
      appStore.addToast('Exam created successfully', 'success');
      activeTab = 'questions';
    } catch (err) {
      appStore.addToast(getErrorMessage(err), 'error');
    } finally {
      isCreatingExam = false;
    }
  }

  function handleAddQuestionLocal() {
    if (!qContent.trim()) {
      appStore.addToast('Please provide question content', 'error');
      return;
    }

    const newQ = {
      content: qContent.trim(),
      type: qType,
      metadata: qType === 'mcq' ? { options: qOptions.split(',').map((s) => s.trim()).filter(Boolean) } : undefined,
    };

    questionsList = [...questionsList, newQ];
    qContent = '';
    appStore.addToast('Question queued', 'info');
  }

  async function handleUploadQuestions() {
    if (questionsList.length === 0) {
      appStore.addToast('Add at least one question first', 'error');
      return;
    }

    isAddingQuestions = true;
    try {
      await api.post(`/exams/${createdExamId}/questions`, {
        questions: questionsList,
      });
      appStore.addToast('Questions uploaded successfully to exam bank', 'success');
      activeTab = 'seating';
    } catch (err) {
      appStore.addToast(getErrorMessage(err), 'error');
    } finally {
      isAddingQuestions = false;
    }
  }

  async function handleSaveSeating() {
    isSavingSeating = true;
    try {
      await api.post(`/exams/${createdExamId}/seating-plan`, {
        assignments: [
          {
            rollNumber: seatRoll.trim(),
            seatRow: Number(seatRow),
            seatCol: Number(seatCol),
          },
        ],
      });
      appStore.addToast('Seating arrangement saved', 'success');
      activeTab = 'accommodations';
    } catch (err) {
      appStore.addToast(getErrorMessage(err), 'error');
    } finally {
      isSavingSeating = false;
    }
  }

  async function handleSaveAccommodation() {
    if (!accommUserId.trim()) {
      appStore.addToast('Valid user UUID is required', 'error');
      return;
    }

    isSavingAccomm = true;
    try {
      await api.post(`/exams/${createdExamId}/accommodations`, {
        userId: accommUserId.trim(),
        extraTimeSec: Number(extraMinutes) * 60,
      });
      appStore.addToast('Accommodation granted', 'success');
    } catch (err) {
      appStore.addToast(getErrorMessage(err), 'error');
    } finally {
      isSavingAccomm = false;
    }
  }
</script>

<div class="admin-page" class:visible={mounted}>
  <header class="admin-header">
    <div class="header-left">
      <span class="brand-wordmark">proctora</span>
      <span class="admin-badge">Admin Suite</span>
    </div>
    <div class="header-right">
      <Button variant="ghost" onclick={() => push('/dashboard')}>
        Back to Dashboard
      </Button>
    </div>
  </header>

  <main class="admin-content">
    <div class="page-title-row">
      <div>
        <h1 class="page-title">Exam Configuration Manager</h1>
        <p class="page-sub">Configure schedules, question banks, seating plans, and accommodations.</p>
      </div>
      {#if createdExamId}
        <div class="exam-id-badge">
          <span>Active Target:</span>
          <code>{createdExamId}</code>
        </div>
      {/if}
    </div>

    <!-- Navigation Tabs -->
    <div class="tabs-nav">
      <button class="tab-btn" class:active={activeTab === 'create'} onclick={() => { activeTab = 'create'; }}>
        1. Schedule Exam
      </button>
      <button class="tab-btn" class:active={activeTab === 'questions'} onclick={() => { activeTab = 'questions'; }}>
        2. Questions Bank
      </button>
      <button class="tab-btn" class:active={activeTab === 'seating'} onclick={() => { activeTab = 'seating'; }}>
        3. Seating Plan
      </button>
      <button class="tab-btn" class:active={activeTab === 'accommodations'} onclick={() => { activeTab = 'accommodations'; }}>
        4. Accommodations
      </button>
    </div>

    <!-- Tab 1: Create Exam -->
    {#if activeTab === 'create'}
      <div class="config-card">
        <h2 class="section-title">Schedule New Examination</h2>
        <div class="form-grid">
          <Input
            id="exam-title"
            label="Examination Title"
            value={examTitle}
            placeholder="e.g. Distributed Systems Midterm"
            oninput={(v) => { examTitle = v; }}
          />

          <div class="field-row">
            <div class="field-group">
              <label class="field-label" for="start-time">Start Time</label>
              <input id="start-time" class="datetime-input" type="datetime-local" bind:value={startTime} />
            </div>

            <div class="field-group">
              <label class="field-label" for="end-time">End Time</label>
              <input id="end-time" class="datetime-input" type="datetime-local" bind:value={endTime} />
            </div>
          </div>

          <Input
            id="idle-timeout"
            label="Candidate Idle Timeout (Seconds)"
            type="number"
            value={idleTimeoutSec.toString()}
            placeholder="300"
            oninput={(v) => { idleTimeoutSec = Number(v) || 300; }}
          />
        </div>

        <div class="card-action">
          <Button variant="primary" loading={isCreatingExam} onclick={handleCreateExam}>
            Create Examination
          </Button>
        </div>
      </div>
    {/if}

    <!-- Tab 2: Questions Bank -->
    {#if activeTab === 'questions'}
      <div class="config-card">
        <h2 class="section-title">Add Questions to Exam ({createdExamId})</h2>
        <div class="form-grid">
          <Input
            id="q-content"
            label="Question Statement"
            value={qContent}
            placeholder="e.g. Describe the Byzantine Generals Problem..."
            oninput={(v) => { qContent = v; }}
          />

          <div class="field-row">
            <div class="field-group">
              <label class="field-label" for="q-type">Question Type</label>
              <select id="q-type" class="select-input" bind:value={qType}>
                <option value="mcq">Multiple Choice (MCQ)</option>
                <option value="code">Code Implementation</option>
              </select>
            </div>

            {#if qType === 'mcq'}
              <Input
                id="q-options"
                label="Options (Comma-separated)"
                value={qOptions}
                placeholder="Option A, Option B, Option C, Option D"
                oninput={(v) => { qOptions = v; }}
              />
            {/if}
          </div>

          <Button variant="secondary" onclick={handleAddQuestionLocal}>
            + Queue Question
          </Button>
        </div>

        {#if questionsList.length > 0}
          <div class="queued-list">
            <span class="field-label">Queued Questions ({questionsList.length})</span>
            {#each questionsList as q, i}
              <div class="queued-item">
                <span class="q-badge">{q.type.toUpperCase()}</span>
                <span class="q-text">{i + 1}. {q.content}</span>
              </div>
            {/each}
          </div>
        {/if}

        <div class="card-action">
          <Button variant="primary" loading={isAddingQuestions} onclick={handleUploadQuestions}>
            Upload Questions to Examination
          </Button>
        </div>
      </div>
    {/if}

    <!-- Tab 3: Seating Plan -->
    {#if activeTab === 'seating'}
      <div class="config-card">
        <h2 class="section-title">Generate Seating Assignments ({createdExamId})</h2>
        <p class="section-sub">Map candidates to randomized rows and columns to prevent visual sharing.</p>

        <div class="form-grid">
          <Input
            id="seat-roll"
            label="Candidate Roll Number"
            value={seatRoll}
            placeholder="21CS001"
            oninput={(v) => { seatRoll = v; }}
          />

          <div class="field-row">
            <Input
              id="seat-row"
              label="Assigned Row"
              type="number"
              value={seatRow.toString()}
              oninput={(v) => { seatRow = Number(v) || 1; }}
            />
            <Input
              id="seat-col"
              label="Assigned Column"
              type="number"
              value={seatCol.toString()}
              oninput={(v) => { seatCol = Number(v) || 1; }}
            />
          </div>
        </div>

        <div class="card-action">
          <Button variant="primary" loading={isSavingSeating} onclick={handleSaveSeating}>
            Save Seating Mapping
          </Button>
        </div>
      </div>
    {/if}

    <!-- Tab 4: Accommodations -->
    {#if activeTab === 'accommodations'}
      <div class="config-card">
        <h2 class="section-title">Grant Extended Accommodation Timer</h2>
        <p class="section-sub">Add extra time allocation for approved students with special accommodations.</p>

        <div class="form-grid">
          <Input
            id="accomm-user"
            label="Candidate User UUID"
            value={accommUserId}
            placeholder="e.g. 123e4567-e89b-12d3-a456-426614174000"
            oninput={(v) => { accommUserId = v; }}
          />

          <Input
            id="extra-mins"
            label="Extra Time (Minutes)"
            type="number"
            value={extraMinutes.toString()}
            placeholder="30"
            oninput={(v) => { extraMinutes = Number(v) || 0; }}
          />
        </div>

        <div class="card-action">
          <Button variant="primary" loading={isSavingAccomm} onclick={handleSaveAccommodation}>
            Grant Accommodation
          </Button>
        </div>
      </div>
    {/if}
  </main>
</div>

<style>
  .admin-page {
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    background-color: var(--color-bg);
    opacity: 0;
    transform: translateY(6px);
    transition: opacity 0.4s var(--ease), transform 0.4s var(--ease);
  }

  .admin-page.visible {
    opacity: 1;
    transform: translateY(0);
  }

  .admin-header {
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

  .admin-badge {
    font-size: 0.6875rem;
    font-weight: 600;
    letter-spacing: 0.5px;
    padding: 2px 6px;
    background-color: var(--color-bg-subtle);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    color: var(--color-text-secondary);
  }

  .admin-content {
    flex: 1;
    max-width: 860px;
    width: 100%;
    margin: 0 auto;
    padding: var(--space-8) var(--space-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
  }

  .page-title-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    flex-wrap: wrap;
    gap: var(--space-3);
  }

  .page-title {
    font-size: var(--text-2xl);
    font-weight: 400;
    color: var(--color-text-primary);
    margin: 0;
  }

  .page-sub {
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
    margin: 0;
  }

  .exam-id-badge {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--text-xs);
    color: var(--color-text-secondary);
  }

  .exam-id-badge code {
    font-family: var(--font-mono);
    padding: 2px 6px;
    background: var(--color-bg-subtle);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
  }

  .tabs-nav {
    display: flex;
    gap: var(--space-2);
    border-bottom: 1px solid var(--color-border);
    padding-bottom: var(--space-2);
    overflow-x: auto;
  }

  .tab-btn {
    padding: var(--space-2) var(--space-4);
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--color-text-secondary);
    border-radius: var(--radius);
    transition: all var(--duration-fast) var(--ease);
    white-space: nowrap;
  }

  .tab-btn:hover {
    color: var(--color-text-primary);
    background-color: var(--color-bg-subtle);
  }

  .tab-btn.active {
    color: var(--color-text-primary);
    background-color: var(--color-bg-elevated);
    border: 1px solid var(--color-border);
    font-weight: 600;
  }

  .config-card {
    background-color: var(--color-bg-elevated);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    padding: var(--space-6);
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
    box-shadow: var(--shadow-sm);
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

  .form-grid {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .field-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-4);
  }

  .field-group {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .field-label {
    font-size: var(--text-xs);
    font-weight: 500;
    color: var(--color-text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .datetime-input,
  .select-input {
    width: 100%;
    padding: var(--space-2) var(--space-3);
    font-family: var(--font-sans);
    font-size: var(--text-sm);
    color: var(--color-text-primary);
    background-color: var(--color-bg-input);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    outline: none;
  }

  .queued-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-3);
    background-color: var(--color-bg-subtle);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
  }

  .queued-item {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--text-xs);
  }

  .q-badge {
    font-size: 0.625rem;
    font-weight: 600;
    padding: 1px 4px;
    background-color: var(--color-bg-elevated);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
  }

  .q-text {
    color: var(--color-text-primary);
  }

  .card-action {
    display: flex;
    justify-content: flex-end;
  }

  @media (max-width: 640px) {
    .field-row {
      grid-template-columns: 1fr;
    }
  }
</style>
