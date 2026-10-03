<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { monaco, getMonacoLanguage, type SupportedLanguage } from '../../lib/monaco';

  export interface TelemetryEvent {
    type: 'keystroke' | 'paste' | 'cut' | 'copy' | 'blur' | 'focus' | 'key_combo';
    timestamp: number;
    details?: Record<string, unknown>;
  }

  interface Props {
    value?: string;
    language?: SupportedLanguage;
    readOnly?: boolean;
    height?: string;
    placeholder?: string;
    showTelemetryBadge?: boolean;
    onchange?: (val: string) => void;
    ontelemetry?: (event: TelemetryEvent) => void;
  }

  let {
    value = $bindable(''),
    language = 'python',
    readOnly = false,
    height = '360px',
    placeholder = '// Write code here...',
    showTelemetryBadge = true,
    onchange,
    ontelemetry,
  }: Props = $props();

  let containerEl = $state<HTMLDivElement | null>(null);
  let editor = $state<monaco.editor.IStandaloneCodeEditor | null>(null);
  let keystrokeCount = $state(0);
  let pasteCount = $state(0);
  let blurCount = $state(0);
  let lastActiveTimestamp = $state(Date.now());

  function recordTelemetry(type: TelemetryEvent['type'], details?: Record<string, unknown>) {
    const evt: TelemetryEvent = {
      type,
      timestamp: Date.now(),
      details: {
        ...details,
        language,
        totalKeystrokes: keystrokeCount,
        totalPastes: pasteCount,
      },
    };
    lastActiveTimestamp = evt.timestamp;
    if (ontelemetry) {
      ontelemetry(evt);
    }
  }

  onMount(() => {
    if (!containerEl) return;

    editor = monaco.editor.create(containerEl, {
      value: value || '',
      language: getMonacoLanguage(language),
      theme: 'vs-dark',
      readOnly,
      automaticLayout: true,
      minimap: { enabled: false },
      fontSize: 13,
      fontFamily: "'JetBrains Mono', 'Fira Code', Menlo, Monaco, Consolas, monospace",
      scrollBeyondLastLine: false,
      renderLineHighlight: 'all',
      tabSize: 4,
      smoothScrolling: true,
      cursorBlinking: 'smooth',
      lineNumbersMinChars: 3,
      padding: { top: 12, bottom: 12 },
    });

    // Content change telemetry & sync
    editor.onDidChangeModelContent((e) => {
      if (!editor) return;
      const currentVal = editor.getValue();
      if (currentVal !== value) {
        value = currentVal;
        if (onchange) onchange(currentVal);
      }

      keystrokeCount += e.changes.length;
      recordTelemetry('keystroke', {
        changesCount: e.changes.length,
        textLength: currentVal.length,
        lines: editor.getModel()?.getLineCount() || 0,
      });
    });

    // Paste capture telemetry
    editor.onDidPaste((e) => {
      pasteCount++;
      recordTelemetry('paste', {
        range: e.range,
      });
    });

    // Focus & Blur telemetry
    editor.onDidFocusEditorText(() => {
      recordTelemetry('focus');
    });

    editor.onDidBlurEditorText(() => {
      blurCount++;
      recordTelemetry('blur');
    });

    // Keydown tracker for shortcuts
    editor.onKeyDown((e) => {
      if (e.ctrlKey || e.metaKey) {
        recordTelemetry('key_combo', {
          browserCode: e.browserEvent.key,
          ctrl: e.ctrlKey,
          meta: e.metaKey,
          alt: e.altKey,
          shift: e.shiftKey,
        });
      }
    });
  });

  // Watch for language changes
  $effect(() => {
    if (editor) {
      const model = editor.getModel();
      if (model) {
        const monacoLang = getMonacoLanguage(language);
        monaco.editor.setModelLanguage(model, monacoLang);
      }
    }
  });

  // Watch for external value changes
  $effect(() => {
    if (editor && value !== undefined) {
      const currentVal = editor.getValue();
      if (currentVal !== value) {
        editor.setValue(value);
      }
    }
  });

  onDestroy(() => {
    if (editor) {
      editor.dispose();
      editor = null;
    }
  });
</script>

<div class="monaco-wrapper">
  {#if showTelemetryBadge}
    <div class="monaco-telemetry-header">
      <div class="telemetry-status">
        <span class="pulse-dot"></span>
        <span class="telemetry-label">Telemetry Active:</span>
        <span class="telemetry-stat">{keystrokeCount} keys</span>
        <span class="stat-sep">•</span>
        <span class="telemetry-stat">{pasteCount} pastes</span>
        <span class="stat-sep">•</span>
        <span class="telemetry-stat">{blurCount} blur events</span>
      </div>
      <div class="lang-tag">
        {language.toUpperCase()}
      </div>
    </div>
  {/if}

  <div
    bind:this={containerEl}
    class="monaco-container"
    style="height: {height};"
  ></div>
</div>

<style>
  .monaco-wrapper {
    display: flex;
    flex-direction: column;
    width: 100%;
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    overflow: hidden;
    background-color: #1e1e1e;
    box-shadow: var(--shadow-sm);
  }

  .monaco-telemetry-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-2) var(--space-3);
    background-color: #181818;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    font-size: 0.6875rem;
    color: var(--color-text-secondary);
  }

  .telemetry-status {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .pulse-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background-color: #10b981;
    box-shadow: 0 0 6px #10b981;
    animation: pulse 2s infinite ease-in-out;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.4; transform: scale(0.85); }
  }

  .telemetry-label {
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .telemetry-stat {
    font-family: var(--font-mono);
    color: var(--color-text-secondary);
  }

  .stat-sep {
    opacity: 0.3;
  }

  .lang-tag {
    font-family: var(--font-mono);
    font-size: 0.625rem;
    font-weight: 700;
    padding: 1px 6px;
    background: rgba(255, 255, 255, 0.08);
    border-radius: var(--radius-sm);
    color: #38bdf8;
  }

  .monaco-container {
    width: 100%;
    position: relative;
  }
</style>
