<script lang="ts">
  interface Props {
    password: string;
  }

  let { password = '' }: Props = $props();

  // Rule 1: At least one special character
  let hasSpecial = $derived(/[^A-Za-z0-9]/.test(password));

  // Rule 2: At least one number
  let hasNumber = $derived(/[0-9]/.test(password));

  // Rule 3: Mixed case: has lowercase and has uppercase (not all upper or all lower)
  let hasMixedCase = $derived(/[a-z]/.test(password) && /[A-Z]/.test(password));

  // Satisfied rules count
  let satisfiedCount = $derived(
    (hasSpecial ? 1 : 0) + (hasNumber ? 1 : 0) + (hasMixedCase ? 1 : 0)
  );

  // User specification:
  // "once all these are satisfied, it should become green, if atleast one of them is satisfied it has to be orange. if none are satisfied it has to be red."
  let strengthState = $derived.by(() => {
    if (satisfiedCount === 3) {
      return {
        level: 'strong',
        label: 'Strong Password',
        color: 'var(--strength-green, #10b981)',
        barWidth: '100%',
        class: 'strength-green',
      };
    } else if (satisfiedCount >= 1) {
      return {
        level: 'medium',
        label: 'Moderate Password',
        color: 'var(--strength-orange, #f59e0b)',
        barWidth: satisfiedCount === 2 ? '66%' : '33%',
        class: 'strength-orange',
      };
    } else {
      return {
        level: 'weak',
        label: 'Weak Password',
        color: 'var(--strength-red, #ef4444)',
        barWidth: password.length > 0 ? '15%' : '0%',
        class: 'strength-red',
      };
    }
  });
</script>

<div class="password-strength-container {strengthState.class}">
  <div class="strength-header">
    <span class="strength-title">Password Strength</span>
    <span class="strength-badge" style="color: {strengthState.color}">
      {strengthState.label}
    </span>
  </div>

  <div class="strength-track" aria-hidden="true">
    <div
      class="strength-fill"
      style="width: {strengthState.barWidth}; background-color: {strengthState.color}"
    ></div>
  </div>

  <div class="rules-list">
    <div class="rule-item" class:satisfied={hasSpecial}>
      <span class="rule-icon">{hasSpecial ? '✓' : '•'}</span>
      <span class="rule-text">At least one special character</span>
    </div>
    <div class="rule-item" class:satisfied={hasNumber}>
      <span class="rule-icon">{hasNumber ? '✓' : '•'}</span>
      <span class="rule-text">At least one number</span>
    </div>
    <div class="rule-item" class:satisfied={hasMixedCase}>
      <span class="rule-icon">{hasMixedCase ? '✓' : '•'}</span>
      <span class="rule-text">Both uppercase & lowercase letters</span>
    </div>
  </div>
</div>

<style>
  :root {
    --strength-green: #10b981;
    --strength-orange: #f59e0b;
    --strength-red: #ef4444;
  }

  .password-strength-container {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 10px 14px;
    background: var(--color-bg-subtle, rgba(255, 255, 255, 0.03));
    border: 1px solid var(--color-border, rgba(255, 255, 255, 0.1));
    border-radius: var(--radius, 8px);
    transition: all 0.25s ease;
  }

  .strength-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: var(--text-xs, 12px);
  }

  .strength-title {
    color: var(--color-text-secondary, #9ca3af);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .strength-badge {
    font-weight: 600;
    font-size: 11px;
    letter-spacing: 0.3px;
    transition: color 0.3s ease;
  }

  .strength-track {
    width: 100%;
    height: 4px;
    background: var(--color-border, rgba(255, 255, 255, 0.1));
    border-radius: 999px;
    overflow: hidden;
  }

  .strength-fill {
    height: 100%;
    transition: width 0.35s ease, background-color 0.35s ease;
  }

  .rules-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-top: 2px;
  }

  .rule-item {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    color: var(--color-text-muted, #6b7280);
    transition: color 0.2s ease;
  }

  .rule-item.satisfied {
    color: var(--color-text-primary, #e5e7eb);
  }

  .rule-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 14px;
    height: 14px;
    font-size: 10px;
    font-weight: bold;
    border-radius: 50%;
  }

  .rule-item.satisfied .rule-icon {
    color: var(--strength-green, #10b981);
  }

  .rule-text {
    line-height: 1.2;
  }

  /* Specific states styling */
  .strength-green {
    border-color: rgba(16, 185, 129, 0.3);
  }

  .strength-orange {
    border-color: rgba(245, 158, 11, 0.3);
  }

  .strength-red {
    border-color: rgba(239, 68, 68, 0.25);
  }
</style>
