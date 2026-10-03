<script lang="ts">
  import { onMount } from 'svelte';
  import { push } from '../lib/router.svelte';
  import Button from '../components/ui/Button.svelte';
  import Input from '../components/ui/Input.svelte';
  import MonacoEditor from '../components/ui/MonacoEditor.svelte';
  import { LANGUAGE_OPTIONS, type SupportedLanguage } from '../lib/monaco';
  import { api, getErrorMessage } from '../lib/api';
  import { appStore } from '../stores/app.store.svelte';
  import { authStore } from '../stores/auth.store.svelte';

  type QuestionType = 'descriptive' | 'coding' | 'mcq' | 'multi_correct';

  interface QuestionDraft {
    id?: string;
    content: string;
    type: QuestionType;
    order: number;
    points: number;
    metadata: {
      options?: string[];
      correctAnswer?: string;
      correctAnswers?: string[];
      language?: SupportedLanguage;
      starterCode?: string;
      solutionCode?: string;
      sampleAnswer?: string;
      rubric?: string;
    };
  }

  let mounted = $state(false);
  let activeStep = $state<'metadata' | 'questions' | 'timing' | 'seating' | 'publish'>('metadata');
  let isSavingAll = $state(false);
  let existingExams = $state<any[]>([]);
  let isLoadingExams = $state(false);

  // Metadata
  let examDbId = $state<string | null>(null);
  let testId = $state('TEST-' + Math.random().toString(36).substring(2, 8).toUpperCase());
  let title = $state('Advanced Systems & Algorithms Midterm');
  let description = $state('Official proctored examination. Candidates must complete all sections within the allotted time.');
  let location = $state('Engineering Block 4 - Hall 202');
  let maxStudents = $state(45);
  let idleTimeoutSec = $state(300);

  // Timing
  let durationMinutes = $state(90);
  let startTime = $state(new Date(Date.now() + 3600000).toISOString().slice(0, 16));
  let endTime = $state(new Date(Date.now() + 3600000 + 90 * 60000).toISOString().slice(0, 16));

  // Questions Bank
  let questions = $state<QuestionDraft[]>([
    {
      content: 'Which of the following data structures achieves amortized O(1) average time complexity for key-value lookups?',
      type: 'mcq',
      order: 0,
      points: 2,
      metadata: {
        options: ['Binary Search Tree', 'Hash Map', 'Red-Black Tree', 'Skip List'],
        correctAnswer: 'Hash Map',
      },
    },
    {
      content: 'Implement an in-place algorithm to reverse a singly linked list in Python. Provide clean, well-commented code.',
      type: 'coding',
      order: 1,
      points: 10,
      metadata: {
        language: 'python',
        starterCode: 'class ListNode:\n    def __init__(self, val=0, next=None):\n        self.val = val\n        self.next = next\n\ndef reverse_list(head: ListNode) -> ListNode:\n    # Implement in-place reversal\n    pass\n',
        solutionCode: 'def reverse_list(head):\n    prev = None\n    curr = head\n    while curr:\n        nxt = curr.next\n        curr.next = prev\n        prev = curr\n        curr = nxt\n    return prev\n',
      },
    },
    {
      content: 'Select ALL sorting algorithms that guarantee worst-case O(n log n) runtime complexity.',
      type: 'multi_correct',
      order: 2,
      points: 4,
      metadata: {
        options: ['Merge Sort', 'Quick Sort', 'Heap Sort', 'Bubble Sort'],
        correctAnswers: ['Merge Sort', 'Heap Sort'],
      },
    },
    {
      content: 'Explain the Byzantine Generals Problem in distributed computing and describe how practical Byzantine Fault Tolerance (pBFT) establishes consensus.',
      type: 'descriptive',
      order: 3,
      points: 8,
      metadata: {
        sampleAnswer: 'The Byzantine Generals Problem illustrates the challenge of reaching consensus in a decentralized network where nodes or communication channels may act maliciously or fail. Consensus is possible if at most (n-1)/3 nodes are faulty.',
        rubric: 'Clear definition of consensus challenge (3 pts), Byzantine nodes vs fail-stop nodes (2 pts), tolerance threshold (3 pts).',
      },
    },
  ]);

  let selectedQIndex = $state(0);
  const currentQ = $derived(questions[selectedQIndex] || null);

  // Seating Plan
  let seatingCsv = $state(
    '21CS001,21CS002,21CS003,21CS004\n21CS005,21CS006,21CS007,21CS008\n21CS009,21CS010,21CS011,21CS012\n21CS013,21CS014,-,21CS015'
  );
  let parsedSeatingGrid = $state<string[][]>([]);
  let seatingAssignments = $state<any[]>([]);
  let csvError = $state<string | null>(null);

  // Parse CSV live into grid & neighbor-shuffled sets
  $effect(() => {
    recomputeSeatingPreview(seatingCsv);
  });

  function recomputeSeatingPreview(raw: string) {
    csvError = null;
    const lines = raw
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length === 0) {
      parsedSeatingGrid = [];
      seatingAssignments = [];
      return;
    }

    const grid = lines.map((line) => line.split(',').map((cell) => cell.trim()));
    parsedSeatingGrid = grid;

    const assignments: any[] = [];
    const rollSet = new Set<string>();

    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < grid[r].length; c++) {
        const roll = grid[r][c];
        if (!roll || roll === '-' || roll.toUpperCase() === 'EMPTY') continue;

        const norm = roll.toUpperCase();
        if (rollSet.has(norm)) {
          csvError = `Duplicate roll number "${roll}" at Row ${r + 1}, Col ${c + 1}`;
        }
        rollSet.add(norm);

        // 9-color neighbor derangement pattern
        const setIdx = ((r % 3) * 3 + (c % 3)) % 9;
        const setId = `SET-${String.fromCharCode(65 + setIdx)}`;

        assignments.push({
          rollNumber: norm,
          row: r + 1,
          col: c + 1,
          setId,
          setIdx,
        });
      }
    }

    seatingAssignments = assignments;
  }

  onMount(async () => {
    if (!authStore.isAuthenticated) {
      push('/login');
      return;
    }
    requestAnimationFrame(() => { mounted = true; });
    await loadExamsList();

    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const initialId = urlParams.get('id');
      if (initialId && existingExams.length > 0) {
        const match = existingExams.find((x) => x.id === initialId || x.testId === initialId);
        if (match) await selectExistingExam(match);
      }
    }
  });

  async function loadExamsList() {
    isLoadingExams = true;
    try {
      const res = await api.get('/exams');
      existingExams = res.data?.data?.exams || [];
    } catch {
      // Fallback
    } finally {
      isLoadingExams = false;
    }
  }

  async function selectExistingExam(exam: any) {
    try {
      appStore.setPageLoading(true);
      const res = await api.get(`/exams/${exam.id}`);
      const data = res.data?.data?.exam;
      if (data) {
        examDbId = data.id;
        testId = data.testId || data.id;
        title = data.title;
        description = data.description || '';
        location = data.location || '';
        maxStudents = data.maxStudents || 40;
        durationMinutes = data.duration || 60;
        idleTimeoutSec = data.idleTimeoutSec || 300;
        if (data.startTime) startTime = new Date(data.startTime).toISOString().slice(0, 16);
        if (data.endTime) endTime = new Date(data.endTime).toISOString().slice(0, 16);

        if (data.questions && data.questions.length > 0) {
          questions = data.questions.map((q: any, i: number) => ({
            id: q.id,
            content: q.content,
            type: q.type as QuestionType,
            order: q.order ?? i,
            points: 5,
            metadata: q.metadata || {},
          }));
          selectedQIndex = 0;
        }

        if (data.seatingCsv) {
          seatingCsv = data.seatingCsv;
        }

        appStore.addToast(`Loaded exam: ${data.title}`, 'success');
      }
    } catch (err) {
      appStore.addToast(getErrorMessage(err), 'error');
    } finally {
      appStore.setPageLoading(false);
    }
  }

  function handleCreateNewTest() {
    examDbId = null;
    testId = 'TEST-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    title = 'New Examination';
    description = '';
    location = 'Main Campus';
    maxStudents = 50;
    durationMinutes = 60;
    activeStep = 'metadata';
    appStore.addToast('Created new draft test', 'info');
  }

  // Question manipulation
  function handleAddQuestion(type: QuestionType) {
    let metadata: QuestionDraft['metadata'] = {};
    let defaultPrompt = '';

    if (type === 'mcq') {
      defaultPrompt = 'Which of the following statements is true regarding ...?';
      metadata = {
        options: ['Option 1', 'Option 2', 'Option 3', 'Option 4'],
        correctAnswer: 'Option 1',
      };
    } else if (type === 'multi_correct') {
      defaultPrompt = 'Select ALL properties that apply to ...';
      metadata = {
        options: ['Property A', 'Property B', 'Property C', 'Property D'],
        correctAnswers: ['Property A', 'Property C'],
      };
    } else if (type === 'coding') {
      defaultPrompt = 'Write a function in Python that takes a list of integers and returns ...';
      const langOption = LANGUAGE_OPTIONS.find((l) => l.id === 'python') || LANGUAGE_OPTIONS[0];
      metadata = {
        language: 'python',
        starterCode: langOption.defaultBoilerplate,
        solutionCode: '# Reference solution\n',
      };
    } else if (type === 'descriptive') {
      defaultPrompt = 'Discuss the trade-offs between consistency and availability in distributed storage systems.';
      metadata = {
        sampleAnswer: 'Consistency ensures all nodes return the latest written data, whereas availability ensures every non-failing node responds...',
        rubric: 'Score based on CAP theorem understanding (4 pts) and real-world examples (4 pts).',
      };
    }

    const newQ: QuestionDraft = {
      content: defaultPrompt,
      type,
      order: questions.length,
      points: type === 'coding' ? 10 : type === 'descriptive' ? 8 : 4,
      metadata,
    };

    questions = [...questions, newQ];
    selectedQIndex = questions.length - 1;
    appStore.addToast(`Added new ${type.replace('_', ' ')} question`, 'info');
  }

  function handleDeleteQuestion(idx: number) {
    if (questions.length <= 1) {
      appStore.addToast('Test must contain at least one question', 'error');
      return;
    }
    questions = questions.filter((_, i) => i !== idx).map((q, i) => ({ ...q, order: i }));
    selectedQIndex = Math.max(0, Math.min(selectedQIndex, questions.length - 1));
    appStore.addToast('Question removed', 'info');
  }

  function handleMoveQuestion(idx: number, dir: -1 | 1) {
    const target = idx + dir;
    if (target < 0 || target >= questions.length) return;
    const copy = [...questions];
    const temp = copy[idx];
    copy[idx] = copy[target];
    copy[target] = temp;
    copy.forEach((q, i) => { q.order = i; });
    questions = copy;
    selectedQIndex = target;
  }

  function handleAddMcqOption() {
    if (!currentQ) return;
    const opts = currentQ.metadata.options || [];
    const nextChar = String.fromCharCode(65 + opts.length);
    const updated = [...opts, `Option ${nextChar}`];
    currentQ.metadata.options = updated;
  }

  function handleRemoveMcqOption(idx: number) {
    if (!currentQ) return;
    const opts = currentQ.metadata.options || [];
    if (opts.length <= 2) {
      appStore.addToast('Question must have at least 2 options', 'error');
      return;
    }
    const removedVal = opts[idx];
    const updated = opts.filter((_, i) => i !== idx);
    currentQ.metadata.options = updated;

    if (currentQ.type === 'mcq' && currentQ.metadata.correctAnswer === removedVal) {
      currentQ.metadata.correctAnswer = updated[0];
    } else if (currentQ.type === 'multi_correct') {
      currentQ.metadata.correctAnswers = (currentQ.metadata.correctAnswers || []).filter((a) => a !== removedVal);
    }
  }

  function toggleMultiCorrect(option: string) {
    if (!currentQ) return;
    const current = new Set(currentQ.metadata.correctAnswers || []);
    if (current.has(option)) {
      current.delete(option);
    } else {
      current.add(option);
    }
    currentQ.metadata.correctAnswers = Array.from(current);
  }

  function handleCodingLanguageChange(lang: SupportedLanguage) {
    if (!currentQ) return;
    currentQ.metadata.language = lang;
    const boilerplate = LANGUAGE_OPTIONS.find((l) => l.id === lang)?.defaultBoilerplate || '';
    if (!currentQ.metadata.starterCode || currentQ.metadata.starterCode.trim().length === 0) {
      currentQ.metadata.starterCode = boilerplate;
    }
  }

  function loadSampleCsv() {
    seatingCsv = `21CS001,21CS002,21CS003,21CS004\n21CS005,21CS006,21CS007,21CS008\n21CS009,21CS010,21CS011,21CS012\n21CS013,21CS014,21CS015,21CS016`;
    appStore.addToast('Sample 4x4 classroom seating plan loaded', 'info');
  }

  function handleFileUpload(event: Event) {
    const target = event.target as HTMLInputElement;
    if (!target.files || target.files.length === 0) return;
    const file = target.files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content) {
        seatingCsv = content;
        appStore.addToast(`Uploaded ${file.name} successfully`, 'success');
      }
    };
    reader.readAsText(file);
  }

  // Master Save Routine
  async function handleSaveEntireTest() {
    if (!title.trim()) {
      appStore.addToast('Please enter an examination title', 'error');
      activeStep = 'metadata';
      return;
    }

    if (questions.length === 0) {
      appStore.addToast('Please add at least one question', 'error');
      activeStep = 'questions';
      return;
    }

    if (csvError) {
      appStore.addToast(csvError, 'error');
      activeStep = 'seating';
      return;
    }

    if (seatingAssignments.length === 0) {
      appStore.addToast('Please upload or enter a seating plan CSV', 'error');
      activeStep = 'seating';
      return;
    }

    isSavingAll = true;

    try {
      // 1. Create or Update Exam
      let examId = examDbId;
      if (!examId) {
        const createRes = await api.post('/exams', {
          title: title.trim(),
          testId: testId.trim().toUpperCase(),
          description: description.trim(),
          location: location.trim(),
          maxStudents: seatingAssignments.length,
          duration: Number(durationMinutes) || 60,
          idleTimeoutSec: Number(idleTimeoutSec) || 300,
          startTime: new Date(startTime).toISOString(),
          endTime: new Date(endTime).toISOString(),
        });
        examId = createRes.data?.data?.exam?.id;
        examDbId = examId;
        testId = createRes.data?.data?.exam?.testId || testId;
      } else {
        await api.put(`/exams/${examId}`, {
          title: title.trim(),
          testId: testId.trim().toUpperCase(),
          description: description.trim(),
          location: location.trim(),
          maxStudents: seatingAssignments.length,
          duration: Number(durationMinutes) || 60,
          idleTimeoutSec: Number(idleTimeoutSec) || 300,
          startTime: new Date(startTime).toISOString(),
          endTime: new Date(endTime).toISOString(),
        });
      }

      // 2. Save Questions
      const formattedQuestions = questions.map((q, idx) => ({
        content: q.content.trim(),
        type: q.type,
        order: idx,
        metadata: q.metadata,
      }));

      await api.post(`/exams/${examId}/questions`, {
        questions: formattedQuestions,
      });

      // 3. Upload & Apply Seating Plan CSV
      await api.post(`/exams/${examId}/seating-plan/csv`, {
        csvContent: seatingCsv.trim(),
        hasHeader: false,
      });

      appStore.addToast('Test successfully saved and seating plan configured!', 'success');
      activeStep = 'publish';
      await loadExamsList();
    } catch (err) {
      appStore.addToast(getErrorMessage(err), 'error');
    } finally {
      isSavingAll = false;
    }
  }

  function copyCandidateTestLink() {
    const link = `${window.location.origin}/exams/${testId}/portal`;
    navigator.clipboard.writeText(link);
    appStore.addToast('Copied student test portal URL to clipboard', 'success');
  }

  function copyTestId() {
    navigator.clipboard.writeText(testId);
    appStore.addToast('Copied Test ID to clipboard', 'success');
  }
</script>

<div class="test-creator-page" class:visible={mounted}>
  <!-- Top Navigation & Controls Header -->
  <header class="studio-header">
    <div class="header-left">
      <span class="brand-title">proctora</span>
      <span class="studio-tag">Instructor Test Studio</span>
      <button type="button" class="test-id-pill" onclick={copyTestId} title="Click to copy Test ID">
        <span class="id-label">Test ID:</span>
        <code class="id-code">{testId}</code>
        <svg class="copy-svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg>
      </button>
    </div>

    <div class="header-right">
      <div class="exams-selector">
        <select
          class="existing-select"
          onchange={(e) => {
            const val = (e.currentTarget as HTMLSelectElement).value;
            if (val === 'new') handleCreateNewTest();
            else {
              const selected = existingExams.find((x) => x.id === val);
              if (selected) selectExistingExam(selected);
            }
          }}
        >
          <option value="new">+ Create New Test</option>
          {#each existingExams as item}
            <option value={item.id} selected={item.id === examDbId}>
              {item.testId}: {item.title.substring(0, 24)}...
            </option>
          {/each}
        </select>
      </div>

      <Button variant="primary" loading={isSavingAll} onclick={handleSaveEntireTest}>
        Save Test to Database
      </Button>

      <Button variant="ghost" onclick={() => push('/dashboard')}>
        Dashboard
      </Button>
    </div>
  </header>

  <!-- Flow Tabs Navigation -->
  <nav class="flow-tabs">
    <button
      class="flow-tab"
      class:active={activeStep === 'metadata'}
      onclick={() => { activeStep = 'metadata'; }}
    >
      <span class="step-num">1</span>
      <span class="step-label">Metadata & Details</span>
    </button>

    <button
      class="flow-tab"
      class:active={activeStep === 'questions'}
      onclick={() => { activeStep = 'questions'; }}
    >
      <span class="step-num">2</span>
      <span class="step-label">Question Maker ({questions.length})</span>
    </button>

    <button
      class="flow-tab"
      class:active={activeStep === 'timing'}
      onclick={() => { activeStep = 'timing'; }}
    >
      <span class="step-num">3</span>
      <span class="step-label">Time Limit ({durationMinutes}m)</span>
    </button>

    <button
      class="flow-tab"
      class:active={activeStep === 'seating'}
      onclick={() => { activeStep = 'seating'; }}
    >
      <span class="step-num">4</span>
      <span class="step-label">Seating CSV ({seatingAssignments.length} Seats)</span>
    </button>

    <button
      class="flow-tab"
      class:active={activeStep === 'publish'}
      onclick={() => { activeStep = 'publish'; }}
    >
      <span class="step-num">5</span>
      <span class="step-label">Review & Publish</span>
    </button>
  </nav>

  <!-- Main Content Workspace -->
  <main class="studio-workspace">
    <!-- STEP 1: Metadata & Details -->
    {#if activeStep === 'metadata'}
      <div class="workspace-card">
        <div class="card-header">
          <div>
            <h2 class="card-title">1. Test Information & Specifications</h2>
            <p class="card-subtitle">Define the test identifier, title, description, and physical location.</p>
          </div>
          <span class="badge-status">Step 1 of 5</span>
        </div>

        <div class="form-grid">
          <div class="field-row">
            <Input
              id="test-id-input"
              label="Unique Test ID (Alphanumeric Code)"
              value={testId}
              placeholder="e.g. CS301-MIDTERM"
              oninput={(v) => { testId = v.toUpperCase(); }}
            />

            <Input
              id="test-title-input"
              label="Examination Title *"
              value={title}
              placeholder="e.g. Database Systems Midterm Exam"
              oninput={(v) => { title = v; }}
            />
          </div>

          <div class="field-group">
            <label class="field-label" for="test-desc">Description & Candidate Instructions</label>
            <textarea
              id="test-desc"
              class="textarea-input"
              rows="3"
              placeholder="Enter instructions, syllabus details, or rules for students..."
              value={description}
              oninput={(e) => { description = (e.currentTarget as HTMLTextAreaElement).value; }}
            ></textarea>
          </div>

          <div class="field-row">
            <Input
              id="test-location"
              label="Physical Classroom / Examination Hall"
              value={location}
              placeholder="e.g. Science Block - Hall 104"
              oninput={(v) => { location = v; }}
            />

            <Input
              id="test-students-count"
              label="Target Student Capacity"
              type="number"
              value={maxStudents.toString()}
              placeholder="50"
              oninput={(v) => { maxStudents = Number(v) || 50; }}
            />
          </div>

          <div class="field-row">
            <Input
              id="idle-timeout-input"
              label="Candidate Idle Warning Timeout (Seconds)"
              type="number"
              value={idleTimeoutSec.toString()}
              placeholder="300"
              oninput={(v) => { idleTimeoutSec = Number(v) || 300; }}
            />
          </div>
        </div>

        <div class="action-bar">
          <div></div>
          <Button variant="primary" onclick={() => { activeStep = 'questions'; }}>
            Continue to Question Maker →
          </Button>
        </div>
      </div>
    {/if}

    <!-- STEP 2: Question Maker & Split Layout -->
    {#if activeStep === 'questions'}
      <div class="question-maker-container">
        <!-- Top Toolbar for Questions -->
        <div class="qm-toolbar">
          <div class="qm-left">
            <span class="qm-title">Questions ({questions.length})</span>
            <span class="qm-sub">Add descriptive, coding, MCQ, or multi-correct questions.</span>
          </div>

          <div class="type-picker-buttons">
            <button class="add-btn mcq" onclick={() => handleAddQuestion('mcq')}>
              + MCQ (Single)
            </button>
            <button class="add-btn multi" onclick={() => handleAddQuestion('multi_correct')}>
              + Multi-Correct
            </button>
            <button class="add-btn code" onclick={() => handleAddQuestion('coding')}>
              + Coding (Monaco)
            </button>
            <button class="add-btn desc" onclick={() => handleAddQuestion('descriptive')}>
              + Descriptive
            </button>
          </div>
        </div>

        <!-- Question Carousel / Selector Strip -->
        <div class="questions-nav-strip">
          {#each questions as q, idx}
            <button
              class="q-chip"
              class:active={selectedQIndex === idx}
              onclick={() => { selectedQIndex = idx; }}
            >
              <span class="chip-num">Q{idx + 1}</span>
              <span class="chip-type {q.type}">{q.type.replace('_', ' ')}</span>
            </button>
          {/each}
        </div>

        <!-- SPLIT LAYOUT: Question on Left, Answer on Right (Stacked on Mobile!) -->
        {#if currentQ}
          <div class="qa-split-layout">
            <!-- LEFT PANE: Question Prompt & Instructions -->
            <div class="pane left-pane">
              <div class="pane-header">
                <div class="pane-meta">
                  <span class="q-badge-large {currentQ.type}">
                    {currentQ.type.toUpperCase().replace('_', ' ')}
                  </span>
                  <span class="q-order-label">Question {selectedQIndex + 1} of {questions.length}</span>
                </div>

                <div class="pane-actions">
                  <button
                    class="icon-action-btn"
                    disabled={selectedQIndex === 0}
                    onclick={() => handleMoveQuestion(selectedQIndex, -1)}
                    title="Move Up"
                  >
                    ↑
                  </button>
                  <button
                    class="icon-action-btn"
                    disabled={selectedQIndex === questions.length - 1}
                    onclick={() => handleMoveQuestion(selectedQIndex, 1)}
                    title="Move Down"
                  >
                    ↓
                  </button>
                  <button
                    class="icon-action-btn danger"
                    onclick={() => handleDeleteQuestion(selectedQIndex)}
                    title="Delete Question"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <div class="field-group">
                <label class="field-label" for="q-statement">
                  Question Statement / Problem Prompt *
                </label>
                <textarea
                  id="q-statement"
                  class="textarea-input q-prompt-area"
                  rows="10"
                  placeholder="Type your question statement here..."
                  bind:value={currentQ.content}
                ></textarea>
              </div>

              <div class="field-row">
                <div class="field-group">
                  <label class="field-label" for="q-type-select">Change Question Type</label>
                  <select
                    id="q-type-select"
                    class="select-input"
                    bind:value={currentQ.type}
                    onchange={() => {
                      // initialize defaults for newly selected type
                      if (currentQ.type === 'coding' && !currentQ.metadata.language) {
                        currentQ.metadata.language = 'python';
                        currentQ.metadata.starterCode = LANGUAGE_OPTIONS.find((l) => l.id === 'python')?.defaultBoilerplate;
                      } else if ((currentQ.type === 'mcq' || currentQ.type === 'multi_correct') && (!currentQ.metadata.options || currentQ.metadata.options.length === 0)) {
                        currentQ.metadata.options = ['Option A', 'Option B', 'Option C', 'Option D'];
                        currentQ.metadata.correctAnswer = 'Option A';
                      }
                    }}
                  >
                    <option value="mcq">Multiple Choice (Single Answer)</option>
                    <option value="multi_correct">Multi-Correct (Multiple Answers)</option>
                    <option value="coding">Coding (Monaco Editor)</option>
                    <option value="descriptive">Descriptive (Written Response)</option>
                  </select>
                </div>

                <div class="field-group">
                  <label class="field-label" for="q-points">Score Points</label>
                  <input
                    id="q-points"
                    class="number-input"
                    type="number"
                    min="1"
                    bind:value={currentQ.points}
                  />
                </div>
              </div>
            </div>

            <!-- RIGHT PANE: Answer / Options / Monaco Editor -->
            <div class="pane right-pane">
              <div class="pane-header">
                <span class="pane-title">
                  {#if currentQ.type === 'mcq'}
                    Multiple Choice: Options & Correct Answer
                  {:else if currentQ.type === 'multi_correct'}
                    Multi-Correct: Select All Correct Options
                  {:else if currentQ.type === 'coding'}
                    Coding: Language & Starter Code (Monaco Editor)
                  {:else}
                    Descriptive: Reference Solution & Rubric
                  {/if}
                </span>
                <span class="pane-badge">Right Panel</span>
              </div>

              <!-- MCQ Mode -->
              {#if currentQ.type === 'mcq'}
                <div class="answer-config-box">
                  <p class="config-instructions">
                    Provide the choices below and select the radio button corresponding to the <strong>single correct answer</strong>.
                  </p>

                  <div class="options-list">
                    {#each currentQ.metadata.options || [] as option, optIdx}
                      <div class="option-row">
                        <label class="radio-label">
                          <input
                            type="radio"
                            name="correct-mcq-{selectedQIndex}"
                            value={option}
                            checked={currentQ.metadata.correctAnswer === option}
                            onchange={() => { currentQ.metadata.correctAnswer = option; }}
                          />
                          <span class="radio-custom"></span>
                        </label>

                        <input
                          class="option-text-input"
                          type="text"
                          value={option}
                          oninput={(e) => {
                            const val = (e.currentTarget as HTMLInputElement).value;
                            if (currentQ.metadata.options) {
                              const oldVal = currentQ.metadata.options[optIdx];
                              currentQ.metadata.options[optIdx] = val;
                              if (currentQ.metadata.correctAnswer === oldVal) {
                                currentQ.metadata.correctAnswer = val;
                              }
                            }
                          }}
                        />

                        <button
                          class="opt-delete-btn"
                          onclick={() => handleRemoveMcqOption(optIdx)}
                          title="Remove option"
                        >
                          ✕
                        </button>
                      </div>
                    {/each}
                  </div>

                  <div class="opt-actions">
                    <Button variant="secondary" onclick={handleAddMcqOption}>
                      + Add Another Choice
                    </Button>
                    <span class="correct-tag">
                      Correct Answer: <strong>{currentQ.metadata.correctAnswer || 'None Selected'}</strong>
                    </span>
                  </div>
                </div>

              <!-- Multi-Correct Mode -->
              {:else if currentQ.type === 'multi_correct'}
                <div class="answer-config-box">
                  <p class="config-instructions">
                    Provide the choices below and check the boxes next to <strong>all valid correct answers</strong>.
                  </p>

                  <div class="options-list">
                    {#each currentQ.metadata.options || [] as option, optIdx}
                      <div class="option-row">
                        <label class="checkbox-label">
                          <input
                            type="checkbox"
                            value={option}
                            checked={(currentQ.metadata.correctAnswers || []).includes(option)}
                            onchange={() => toggleMultiCorrect(option)}
                          />
                          <span class="checkbox-custom"></span>
                        </label>

                        <input
                          class="option-text-input"
                          type="text"
                          value={option}
                          oninput={(e) => {
                            const val = (e.currentTarget as HTMLInputElement).value;
                            if (currentQ.metadata.options) {
                              const oldVal = currentQ.metadata.options[optIdx];
                              currentQ.metadata.options[optIdx] = val;
                              if (currentQ.metadata.correctAnswers) {
                                currentQ.metadata.correctAnswers = currentQ.metadata.correctAnswers.map((a) => (a === oldVal ? val : a));
                              }
                            }
                          }}
                        />

                        <button
                          class="opt-delete-btn"
                          onclick={() => handleRemoveMcqOption(optIdx)}
                          title="Remove option"
                        >
                          ✕
                        </button>
                      </div>
                    {/each}
                  </div>

                  <div class="opt-actions">
                    <Button variant="secondary" onclick={handleAddMcqOption}>
                      + Add Another Choice
                    </Button>
                    <span class="correct-tag">
                      {(currentQ.metadata.correctAnswers || []).length} Correct Selected
                    </span>
                  </div>
                </div>

              <!-- Coding Mode (Monaco Editor) -->
              {:else if currentQ.type === 'coding'}
                <div class="answer-config-box">
                  <div class="lang-selector-bar">
                    <span class="lang-selector-label">Programming Language:</span>
                    <div class="lang-pills">
                      {#each LANGUAGE_OPTIONS as lang}
                        <button
                          class="lang-pill-btn"
                          class:active={currentQ.metadata.language === lang.id}
                          onclick={() => handleCodingLanguageChange(lang.id)}
                        >
                          {lang.label}
                        </button>
                      {/each}
                    </div>
                  </div>

                  <div class="code-editor-header">
                    <span class="editor-title">Candidate Starter Code Template (Monaco Editor):</span>
                    <span class="telemetry-info">Telemetry Tracking Enabled</span>
                  </div>

                  <!-- MONACO EDITOR COMPONENT WITH TELEMETRY -->
                  <MonacoEditor
                    bind:value={currentQ.metadata.starterCode}
                    language={currentQ.metadata.language || 'python'}
                    height="280px"
                  />

                  <div class="solution-header">
                    <span class="editor-title">Reference Solution / Grading Code:</span>
                  </div>

                  <MonacoEditor
                    bind:value={currentQ.metadata.solutionCode}
                    language={currentQ.metadata.language || 'python'}
                    height="180px"
                    showTelemetryBadge={false}
                  />
                </div>

              <!-- Descriptive Mode -->
              {:else if currentQ.type === 'descriptive'}
                <div class="answer-config-box">
                  <p class="config-instructions">
                    Set the reference answer and key scoring criteria for grading student descriptive submissions.
                  </p>

                  <div class="field-group">
                    <label class="field-label" for="desc-sample">Reference Model Solution</label>
                    <textarea
                      id="desc-sample"
                      class="textarea-input"
                      rows="6"
                      placeholder="Type the ideal sample response..."
                      bind:value={currentQ.metadata.sampleAnswer}
                    ></textarea>
                  </div>

                  <div class="field-group">
                    <label class="field-label" for="desc-rubric">Scoring Rubric & Evaluation Keywords</label>
                    <textarea
                      id="desc-rubric"
                      class="textarea-input"
                      rows="5"
                      placeholder="e.g. Award 3 points for identifying X, 3 points for analyzing Y..."
                      bind:value={currentQ.metadata.rubric}
                    ></textarea>
                  </div>
                </div>
              {/if}
            </div>
          </div>
        {/if}

        <!-- Bottom Action Bar -->
        <div class="action-bar">
          <Button variant="ghost" onclick={() => { activeStep = 'metadata'; }}>
            ← Back to Metadata
          </Button>

          <Button variant="primary" onclick={() => { activeStep = 'timing'; }}>
            Continue to Time Limit ({durationMinutes}m) →
          </Button>
        </div>
      </div>
    {/if}

    <!-- STEP 3: Time Limit & Scheduling -->
    {#if activeStep === 'timing'}
      <div class="workspace-card">
        <div class="card-header">
          <div>
            <h2 class="card-title">3. Examination Time Limit & Window</h2>
            <p class="card-subtitle">Set the total duration allocated for candidates to solve the test.</p>
          </div>
          <span class="badge-status">Step 3 of 5</span>
        </div>

        <div class="form-grid">
          <div class="field-group">
            <label class="field-label" for="duration-input">
              Total Test Duration (Minutes) *
            </label>
            <div class="duration-control">
              <input
                id="duration-input"
                class="duration-number-input"
                type="number"
                min="5"
                max="1440"
                bind:value={durationMinutes}
              />
              <span class="duration-unit">minutes ({Math.floor(durationMinutes / 60)}h {durationMinutes % 60}m)</span>
            </div>

            <!-- Quick Duration Chips -->
            <div class="duration-presets">
              {#each [30, 45, 60, 90, 120, 180] as preset}
                <button
                  class="preset-chip"
                  class:selected={durationMinutes === preset}
                  onclick={() => { durationMinutes = preset; }}
                >
                  {preset} mins
                </button>
              {/each}
            </div>
          </div>

          <div class="field-row">
            <div class="field-group">
              <label class="field-label" for="sched-start">Scheduled Start Window</label>
              <input
                id="sched-start"
                class="datetime-input"
                type="datetime-local"
                bind:value={startTime}
              />
            </div>

            <div class="field-group">
              <label class="field-label" for="sched-end">Scheduled End Window</label>
              <input
                id="sched-end"
                class="datetime-input"
                type="datetime-local"
                bind:value={endTime}
              />
            </div>
          </div>

          <div class="info-alert">
            <svg class="alert-icon-svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            <div>
              <strong>Candidate Countdown Behavior:</strong>
              Once a candidate logs into the examination portal, their local countdown timer starts with
              <strong>{durationMinutes} minutes</strong>. Auto-submission triggers automatically upon timer expiration.
            </div>
          </div>
        </div>

        <div class="action-bar">
          <Button variant="ghost" onclick={() => { activeStep = 'questions'; }}>
            ← Back to Questions
          </Button>

          <Button variant="primary" onclick={() => { activeStep = 'seating'; }}>
            Continue to Seating Plan CSV →
          </Button>
        </div>
      </div>
    {/if}

    <!-- STEP 4: Seating Plan CSV & Neighbor Shuffle -->
    {#if activeStep === 'seating'}
      <div class="workspace-card">
        <div class="card-header">
          <div>
            <h2 class="card-title">4. Classroom Seating Plan CSV & Neighbor Shuffling</h2>
            <p class="card-subtitle">
              First column in CSV = First physical column in the classroom.
              Surrounding neighbors get shuffled question sets. Unlisted candidates are rejected.
            </p>
          </div>
          <span class="badge-status">Step 4 of 5</span>
        </div>

        <div class="seating-flow">
          <!-- CSV upload & direct input -->
          <div class="csv-upload-section">
            <div class="upload-top-row">
              <div class="file-picker-wrapper">
                <input
                  type="file"
                  id="csv-file-picker"
                  accept=".csv,text/csv"
                  class="hidden-file-input"
                  onchange={handleFileUpload}
                />
                <label for="csv-file-picker" class="file-picker-label">
                  Upload CSV File
                </label>
              </div>

              <button class="sample-load-btn" onclick={loadSampleCsv}>
                Load Sample 4x4 Room CSV
              </button>

              <span class="assigned-counter">
                Seats Mapped: <strong>{seatingAssignments.length}</strong>
              </span>
            </div>

            <div class="field-group">
              <label class="field-label" for="csv-textarea">
                Classroom Seating CSV Matrix (Row 1 = Front row; Col 1 = Physical Column 1)
              </label>
              <textarea
                id="csv-textarea"
                class="textarea-input font-mono-area"
                rows="6"
                placeholder="21CS001,21CS002,21CS003&#10;21CS004,21CS005,21CS006"
                bind:value={seatingCsv}
              ></textarea>
            </div>

            {#if csvError}
              <div class="csv-error-alert">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <span>{csvError}</span>
              </div>
            {/if}
          </div>

          <!-- Classroom Visual Matrix Preview -->
          <div class="classroom-preview-card">
            <div class="preview-header">
              <span class="preview-title">Physical Classroom Layout Preview</span>
              <div class="legend-strip">
                <span class="legend-item"><span class="legend-dot set-a"></span> Set A</span>
                <span class="legend-item"><span class="legend-dot set-b"></span> Set B</span>
                <span class="legend-item"><span class="legend-dot set-c"></span> Set C</span>
                <span class="legend-item"><span class="legend-dot set-d"></span> Set D+</span>
                <span class="legend-item"><span class="legend-dot vacant"></span> Vacant</span>
              </div>
            </div>

            <div class="blackboard-indicator">
              <span>━━ TEACHER PODIUM / BLACKBOARD (FRONT OF ROOM) ━━</span>
            </div>

            <div class="classroom-grid-wrapper">
              {#if parsedSeatingGrid.length > 0}
                <div
                  class="classroom-grid"
                  style="grid-template-columns: repeat({Math.max(...parsedSeatingGrid.map((r) => r.length))}, minmax(110px, 1fr));"
                >
                  {#each parsedSeatingGrid as rowArr, rIdx}
                    {#each rowArr as roll, cIdx}
                      {@const norm = roll.toUpperCase()}
                      {@const isVacant = !roll || roll === '-' || norm === 'EMPTY'}
                      {@const setIdx = isVacant ? -1 : ((rIdx % 3) * 3 + (cIdx % 3)) % 9}
                      {@const setId = isVacant ? '' : `SET-${String.fromCharCode(65 + setIdx)}`}

                      <div
                        class="seat-desk"
                        class:vacant={isVacant}
                        class:set-a={setIdx === 0}
                        class:set-b={setIdx === 1}
                        class:set-c={setIdx === 2}
                        class:set-other={setIdx >= 3}
                      >
                        <div class="desk-coord">R{rIdx + 1}:C{cIdx + 1}</div>
                        <div class="desk-roll">{isVacant ? 'EMPTY' : norm}</div>
                        {#if !isVacant}
                          <div class="desk-set-badge">{setId}</div>
                        {/if}
                      </div>
                    {/each}
                  {/each}
                </div>
              {:else}
                <div class="empty-grid-msg">
                  Upload or type a CSV above to preview the classroom seating arrangement.
                </div>
              {/if}
            </div>

            <div class="neighbor-shuffle-note">
              <span class="check-icon">✓</span>
              <span>
                <strong>Neighbor Shuffling Verified:</strong>
                Each occupied seat $(r, c)$ receives a deterministic question set distinct from all 8 adjacent desks
                (left, right, front, back, diagonals) to prevent line-of-sight cheating.
              </span>
            </div>
          </div>
        </div>

        <div class="action-bar">
          <Button variant="ghost" onclick={() => { activeStep = 'timing'; }}>
            ← Back to Time Limit
          </Button>

          <Button variant="primary" onclick={() => { activeStep = 'publish'; }}>
            Continue to Review & Publish →
          </Button>
        </div>
      </div>
    {/if}

    <!-- STEP 5: Review & Publish -->
    {#if activeStep === 'publish'}
      <div class="workspace-card">
        <div class="card-header">
          <div>
            <h2 class="card-title">5. Review & Finalize Examination</h2>
            <p class="card-subtitle">Verify specifications and publish the test to the Proctora database.</p>
          </div>
          <span class="badge-status success">Ready to Save</span>
        </div>

        <div class="review-grid">
          <div class="summary-box">
            <span class="summary-label">Test Identifier</span>
            <div class="summary-value-id">
              <code>{testId}</code>
              <button class="copy-small-btn" onclick={copyTestId}>Copy</button>
            </div>
          </div>

          <div class="summary-box">
            <span class="summary-label">Title</span>
            <span class="summary-value">{title}</span>
          </div>

          <div class="summary-box">
            <span class="summary-label">Time Limit</span>
            <span class="summary-value">{durationMinutes} Minutes</span>
          </div>

          <div class="summary-box">
            <span class="summary-label">Questions Enrolled</span>
            <span class="summary-value">{questions.length} Questions</span>
          </div>

          <div class="summary-box">
            <span class="summary-label">Classroom Location</span>
            <span class="summary-value">{location || 'Standard Room'}</span>
          </div>

          <div class="summary-box">
            <span class="summary-label">Seating Assignments</span>
            <span class="summary-value">{seatingAssignments.length} Candidates Enrolled</span>
          </div>
        </div>

        <!-- Candidate Direct Test Link -->
        <div class="direct-link-card">
          <span class="link-label">Candidate Test Portal Link:</span>
          <div class="link-row">
            <input
              class="link-input"
              readonly
              value={`${window.location.origin}/exams/${testId}/portal`}
            />
            <Button variant="secondary" onclick={copyCandidateTestLink}>
              Copy Student Link
            </Button>
          </div>
          <span class="link-note">
            Enrolled candidates will log in and receive their assigned seat's shuffled question set.
          </span>
        </div>

        <div class="action-bar">
          <Button variant="ghost" onclick={() => { activeStep = 'seating'; }}>
            ← Back to Seating Plan
          </Button>

          <Button
            variant="primary"
            loading={isSavingAll}
            onclick={handleSaveEntireTest}
          >
            Publish & Save Everything to Database
          </Button>
        </div>
      </div>
    {/if}
  </main>
</div>

<style>
  .test-creator-page {
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    background-color: var(--color-bg);
    opacity: 0;
    transform: translateY(6px);
    transition: opacity 0.4s var(--ease), transform 0.4s var(--ease);
  }

  .test-creator-page.visible {
    opacity: 1;
    transform: translateY(0);
  }

  /* Header */
  .studio-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-3) var(--space-8);
    background-color: var(--color-bg-elevated);
    border-bottom: 1px solid var(--color-border);
    flex-wrap: wrap;
    gap: var(--space-4);
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .brand-title {
    font-size: var(--text-lg);
    font-weight: 300;
    letter-spacing: 4px;
    text-transform: lowercase;
    color: var(--color-text-primary);
  }

  .studio-tag {
    font-size: 0.6875rem;
    font-weight: 600;
    letter-spacing: 0.5px;
    padding: 2px 8px;
    background-color: var(--color-bg-subtle);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    color: var(--color-text-secondary);
  }

  .test-id-pill {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: 3px 10px;
    background-color: rgba(56, 189, 248, 0.08);
    border: 1px solid rgba(56, 189, 248, 0.25);
    border-radius: var(--radius);
    cursor: pointer;
    transition: background-color var(--duration-fast) var(--ease);
  }

  .test-id-pill:hover {
    background-color: rgba(56, 189, 248, 0.15);
  }

  .id-label {
    font-size: var(--text-xs);
    color: var(--color-text-secondary);
    font-weight: 500;
  }

  .id-code {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    font-weight: 700;
    color: #0284c7;
  }

  .copy-icon {
    font-size: 0.75rem;
    opacity: 0.7;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .existing-select {
    padding: var(--space-2) var(--space-3);
    font-size: var(--text-xs);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    background-color: var(--color-bg-input);
    color: var(--color-text-primary);
    outline: none;
    max-width: 220px;
  }

  /* Flow Tabs */
  .flow-tabs {
    display: flex;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-8);
    background-color: var(--color-bg-subtle);
    border-bottom: 1px solid var(--color-border);
    overflow-x: auto;
  }

  .flow-tab {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-4);
    font-size: var(--text-xs);
    font-weight: 500;
    color: var(--color-text-secondary);
    border-radius: var(--radius);
    background: transparent;
    border: 1px solid transparent;
    cursor: pointer;
    white-space: nowrap;
    transition: all var(--duration-fast) var(--ease);
  }

  .flow-tab:hover {
    color: var(--color-text-primary);
    background-color: var(--color-bg-elevated);
  }

  .flow-tab.active {
    color: var(--color-text-primary);
    background-color: var(--color-bg-elevated);
    border-color: var(--color-border);
    font-weight: 600;
    box-shadow: var(--shadow-sm);
  }

  .step-num {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background-color: var(--color-border);
    color: var(--color-text-primary);
    font-size: 0.625rem;
    font-weight: 700;
  }

  .flow-tab.active .step-num {
    background-color: #0284c7;
    color: #ffffff;
  }

  /* Workspace */
  .studio-workspace {
    flex: 1;
    max-width: 1200px;
    width: 100%;
    margin: 0 auto;
    padding: var(--space-6) var(--space-6);
  }

  .workspace-card {
    background-color: var(--color-bg-elevated);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    padding: var(--space-6);
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
    box-shadow: var(--shadow-sm);
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 1px solid var(--color-border);
    padding-bottom: var(--space-4);
  }

  .card-title {
    font-size: var(--text-lg);
    font-weight: 600;
    color: var(--color-text-primary);
    margin: 0;
  }

  .card-subtitle {
    font-size: var(--text-xs);
    color: var(--color-text-secondary);
    margin-top: 4px;
  }

  .badge-status {
    font-size: 0.6875rem;
    font-weight: 600;
    padding: 3px 8px;
    background-color: var(--color-bg-subtle);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    color: var(--color-text-secondary);
  }

  .badge-status.success {
    background-color: #ecfdf5;
    color: #059669;
    border-color: #a7f3d0;
  }

  .form-grid {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
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
    font-weight: 600;
    color: var(--color-text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .textarea-input {
    width: 100%;
    padding: var(--space-3);
    font-family: var(--font-sans);
    font-size: var(--text-sm);
    color: var(--color-text-primary);
    background-color: var(--color-bg-input);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    outline: none;
    resize: vertical;
  }

  .font-mono-area {
    font-family: var(--font-mono);
    font-size: 0.8125rem;
    line-height: 1.5;
  }

  .datetime-input,
  .select-input,
  .number-input {
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

  .action-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-top: 1px solid var(--color-border);
    padding-top: var(--space-4);
  }

  /* Question Maker & Split Layout */
  .question-maker-container {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .qm-toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background-color: var(--color-bg-elevated);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    padding: var(--space-3) var(--space-5);
    flex-wrap: wrap;
    gap: var(--space-3);
  }

  .qm-title {
    font-size: var(--text-base);
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .qm-sub {
    font-size: var(--text-xs);
    color: var(--color-text-secondary);
    margin-left: var(--space-3);
  }

  .type-picker-buttons {
    display: flex;
    gap: var(--space-2);
    flex-wrap: wrap;
  }

  .add-btn {
    font-size: var(--text-xs);
    font-weight: 600;
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius);
    border: 1px solid var(--color-border);
    background-color: var(--color-bg-subtle);
    color: var(--color-text-primary);
    cursor: pointer;
    transition: all var(--duration-fast) var(--ease);
  }

  .add-btn:hover {
    background-color: var(--color-bg-elevated);
    border-color: #0284c7;
    color: #0284c7;
  }

  /* Question Navigation Chips */
  .questions-nav-strip {
    display: flex;
    gap: var(--space-2);
    overflow-x: auto;
    padding-bottom: 4px;
  }

  .q-chip {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: 6px 12px;
    background-color: var(--color-bg-elevated);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    cursor: pointer;
    white-space: nowrap;
    transition: all var(--duration-fast) var(--ease);
  }

  .q-chip:hover {
    border-color: #a8a29e;
  }

  .q-chip.active {
    border-color: #0284c7;
    background-color: rgba(56, 189, 248, 0.08);
  }

  .chip-num {
    font-size: var(--text-xs);
    font-weight: 700;
    color: var(--color-text-primary);
  }

  .chip-type {
    font-size: 0.625rem;
    font-weight: 600;
    padding: 1px 5px;
    border-radius: var(--radius-sm);
    text-transform: uppercase;
  }

  .chip-type.mcq { background: #e0f2fe; color: #0369a1; }
  .chip-type.multi_correct { background: #fef3c7; color: #b45309; }
  .chip-type.coding { background: #ecfdf5; color: #047857; }
  .chip-type.descriptive { background: #f3e8ff; color: #7e22ce; }

  /* SPLIT LAYOUT (Requirement 1.4: Left = Question, Right = Answer; Phone = Top/Bottom) */
  .qa-split-layout {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-5);
    min-height: 520px;
  }

  /* Phone / Responsive: Stacked top and bottom */
  @media (max-width: 860px) {
    .qa-split-layout {
      grid-template-columns: 1fr;
    }
  }

  .pane {
    background-color: var(--color-bg-elevated);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    padding: var(--space-5);
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    box-shadow: var(--shadow-sm);
  }

  .pane-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid var(--color-border);
    padding-bottom: var(--space-3);
  }

  .pane-meta {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .q-badge-large {
    font-size: 0.6875rem;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: var(--radius-sm);
    letter-spacing: 0.5px;
  }

  .q-badge-large.mcq { background: #e0f2fe; color: #0369a1; }
  .q-badge-large.multi_correct { background: #fef3c7; color: #b45309; }
  .q-badge-large.coding { background: #ecfdf5; color: #047857; }
  .q-badge-large.descriptive { background: #f3e8ff; color: #7e22ce; }

  .q-order-label {
    font-size: var(--text-xs);
    color: var(--color-text-secondary);
    font-weight: 500;
  }

  .pane-actions {
    display: flex;
    gap: 4px;
  }

  .icon-action-btn {
    width: 26px;
    height: 26px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--color-border);
    background-color: var(--color-bg-subtle);
    border-radius: var(--radius-sm);
    font-size: 0.75rem;
    cursor: pointer;
    transition: all var(--duration-fast) var(--ease);
  }

  .icon-action-btn:hover:not(:disabled) {
    background-color: var(--color-bg-elevated);
    border-color: #a8a29e;
  }

  .icon-action-btn.danger:hover {
    background-color: #fee2e2;
    border-color: #ef4444;
    color: #b91c1c;
  }

  .q-prompt-area {
    font-size: var(--text-sm);
    line-height: 1.6;
    min-height: 180px;
  }

  .pane-title {
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .pane-badge {
    font-size: 0.625rem;
    font-weight: 600;
    color: var(--color-text-secondary);
    background: var(--color-bg-subtle);
    padding: 2px 6px;
    border-radius: var(--radius-sm);
  }

  /* Answer Config Box */
  .answer-config-box {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .config-instructions {
    font-size: var(--text-xs);
    color: var(--color-text-secondary);
    line-height: 1.5;
  }

  .options-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .option-row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .radio-label,
  .checkbox-label {
    display: flex;
    align-items: center;
    cursor: pointer;
  }

  .option-text-input {
    flex: 1;
    padding: var(--space-2) var(--space-3);
    font-size: var(--text-sm);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    background-color: var(--color-bg-input);
    color: var(--color-text-primary);
    outline: none;
  }

  .opt-delete-btn {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid transparent;
    background: transparent;
    color: var(--color-text-secondary);
    border-radius: var(--radius-sm);
    cursor: pointer;
  }

  .opt-delete-btn:hover {
    color: #b91c1c;
    background-color: #fee2e2;
  }

  .opt-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .correct-tag {
    font-size: var(--text-xs);
    color: #0369a1;
  }

  /* Coding language selectors */
  .lang-selector-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-2) var(--space-3);
    background-color: var(--color-bg-subtle);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .lang-selector-label {
    font-size: var(--text-xs);
    font-weight: 600;
    color: var(--color-text-secondary);
  }

  .lang-pills {
    display: flex;
    gap: 4px;
  }

  .lang-pill-btn {
    font-size: 0.6875rem;
    font-weight: 600;
    padding: 3px 8px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--color-border);
    background: var(--color-bg-elevated);
    color: var(--color-text-secondary);
    cursor: pointer;
    transition: all var(--duration-fast) var(--ease);
  }

  .lang-pill-btn.active {
    background-color: #0284c7;
    color: #ffffff;
    border-color: #0284c7;
  }

  .code-editor-header,
  .solution-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: var(--space-2);
  }

  .editor-title {
    font-size: var(--text-xs);
    font-weight: 600;
    color: var(--color-text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .telemetry-info {
    font-size: 0.625rem;
    font-weight: 600;
    color: #059669;
    background: #ecfdf5;
    padding: 1px 6px;
    border-radius: var(--radius-sm);
  }

  /* Timing Tab */
  .duration-control {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .duration-number-input {
    width: 120px;
    padding: var(--space-3);
    font-family: var(--font-mono);
    font-size: var(--text-xl);
    font-weight: 700;
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    outline: none;
    text-align: center;
  }

  .duration-unit {
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
  }

  .duration-presets {
    display: flex;
    gap: var(--space-2);
    margin-top: var(--space-2);
    flex-wrap: wrap;
  }

  .preset-chip {
    padding: var(--space-2) var(--space-3);
    font-size: var(--text-xs);
    font-weight: 600;
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    background-color: var(--color-bg-subtle);
    color: var(--color-text-secondary);
    cursor: pointer;
    transition: all var(--duration-fast) var(--ease);
  }

  .preset-chip.selected {
    background-color: #0284c7;
    color: #ffffff;
    border-color: #0284c7;
  }

  .info-alert {
    display: flex;
    gap: var(--space-3);
    padding: var(--space-4);
    background-color: rgba(56, 189, 248, 0.08);
    border: 1px solid rgba(56, 189, 248, 0.25);
    border-radius: var(--radius);
    font-size: var(--text-xs);
    line-height: 1.6;
    color: var(--color-text-primary);
  }

  /* Seating Plan Tab */
  .seating-flow {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
  }

  .upload-top-row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    flex-wrap: wrap;
  }

  .hidden-file-input {
    display: none;
  }

  .file-picker-label {
    padding: var(--space-2) var(--space-4);
    font-size: var(--text-xs);
    font-weight: 600;
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    background-color: var(--color-bg-elevated);
    color: var(--color-text-primary);
    cursor: pointer;
    transition: all var(--duration-fast) var(--ease);
  }

  .file-picker-label:hover {
    border-color: #0284c7;
    color: #0284c7;
  }

  .sample-load-btn {
    padding: var(--space-2) var(--space-3);
    font-size: var(--text-xs);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    background-color: var(--color-bg-subtle);
    color: var(--color-text-secondary);
    cursor: pointer;
  }

  .sample-load-btn:hover {
    color: var(--color-text-primary);
    background-color: var(--color-bg-elevated);
  }

  .assigned-counter {
    margin-left: auto;
    font-size: var(--text-xs);
    color: var(--color-text-secondary);
  }

  .csv-error-alert {
    padding: var(--space-2) var(--space-3);
    background-color: #fee2e2;
    border: 1px solid #fca5a5;
    color: #b91c1c;
    border-radius: var(--radius);
    font-size: var(--text-xs);
  }

  /* Classroom Visual Grid */
  .classroom-preview-card {
    background-color: var(--color-bg-subtle);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    padding: var(--space-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .preview-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .preview-title {
    font-size: var(--text-xs);
    font-weight: 600;
    color: var(--color-text-secondary);
    text-transform: uppercase;
  }

  .legend-strip {
    display: flex;
    gap: var(--space-3);
    font-size: 0.6875rem;
    color: var(--color-text-secondary);
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .legend-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  .legend-dot.set-a { background-color: #38bdf8; }
  .legend-dot.set-b { background-color: #f59e0b; }
  .legend-dot.set-c { background-color: #10b981; }
  .legend-dot.set-d { background-color: #a855f7; }
  .legend-dot.vacant { background-color: #94a3b8; }

  .blackboard-indicator {
    text-align: center;
    font-family: var(--font-mono);
    font-size: 0.625rem;
    font-weight: 700;
    color: var(--color-text-muted);
    letter-spacing: 1px;
    padding: 4px;
    border-bottom: 1px dashed var(--color-border);
  }

  .classroom-grid-wrapper {
    overflow-x: auto;
    padding: var(--space-3) 0;
  }

  .classroom-grid {
    display: grid;
    gap: var(--space-3);
    min-width: 500px;
  }

  .seat-desk {
    background-color: var(--color-bg-elevated);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    padding: var(--space-2);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    transition: transform 0.15s ease;
  }

  .seat-desk:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-sm);
  }

  .seat-desk.vacant {
    opacity: 0.4;
    background-color: transparent;
    border-style: dashed;
  }

  .seat-desk.set-a { border-top: 3px solid #38bdf8; }
  .seat-desk.set-b { border-top: 3px solid #f59e0b; }
  .seat-desk.set-c { border-top: 3px solid #10b981; }
  .seat-desk.set-other { border-top: 3px solid #a855f7; }

  .desk-coord {
    font-size: 0.5625rem;
    font-family: var(--font-mono);
    color: var(--color-text-muted);
  }

  .desk-roll {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    font-weight: 700;
    color: var(--color-text-primary);
  }

  .desk-set-badge {
    font-size: 0.5625rem;
    font-weight: 700;
    padding: 1px 4px;
    background-color: var(--color-bg-subtle);
    border-radius: var(--radius-sm);
    color: var(--color-text-secondary);
  }

  .neighbor-shuffle-note {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    background-color: #ecfdf5;
    border: 1px solid #a7f3d0;
    border-radius: var(--radius);
    font-size: var(--text-xs);
    color: #065f46;
  }

  .check-icon {
    font-weight: 700;
    color: #059669;
  }

  .empty-grid-msg {
    text-align: center;
    padding: var(--space-8);
    font-size: var(--text-xs);
    color: var(--color-text-secondary);
  }

  /* Review Step */
  .review-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: var(--space-4);
  }

  .summary-box {
    background-color: var(--color-bg-subtle);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    padding: var(--space-4);
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .summary-label {
    font-size: var(--text-xs);
    font-weight: 600;
    color: var(--color-text-secondary);
    text-transform: uppercase;
  }

  .summary-value {
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .summary-value-id {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .summary-value-id code {
    font-family: var(--font-mono);
    font-size: var(--text-base);
    font-weight: 700;
    color: #0284c7;
  }

  .copy-small-btn {
    padding: 2px 6px;
    font-size: 0.625rem;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    background: var(--color-bg-elevated);
    cursor: pointer;
  }

  .direct-link-card {
    background-color: rgba(56, 189, 248, 0.05);
    border: 1px solid rgba(56, 189, 248, 0.2);
    border-radius: var(--radius);
    padding: var(--space-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .link-label {
    font-size: var(--text-xs);
    font-weight: 600;
    color: var(--color-text-secondary);
  }

  .link-row {
    display: flex;
    gap: var(--space-2);
  }

  .link-input {
    flex: 1;
    padding: var(--space-2) var(--space-3);
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    background: var(--color-bg-input);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    color: var(--color-text-primary);
  }

  .link-note {
    font-size: 0.6875rem;
    color: var(--color-text-secondary);
  }
</style>
