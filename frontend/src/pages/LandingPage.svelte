<script lang="ts">
  import { onMount } from 'svelte';
  import { push } from '../lib/router.svelte';
  import Button from '../components/ui/Button.svelte';
  import { appStore } from '../stores/app.store.svelte';

  let mounted = $state(false);

  onMount(() => {
    setTimeout(() => appStore.setPageLoading(false), 200);
    requestAnimationFrame(() => {
      mounted = true;
    });
  });
</script>

<div class="landing-page">
  <!-- Minimalist Top Navigation -->
  <nav class="top-nav" class:visible={mounted}>
    <div class="nav-content">
      <div class="nav-brand">
        <svg class="nav-logo" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <path d="M9 12l2 2 4-4" />
        </svg>
        <span class="nav-wordmark">proctora</span>
      </div>

      <div class="nav-actions">
        <Button variant="ghost" onclick={() => push('/login')}>
          Sign In
        </Button>
        <Button variant="primary" onclick={() => push('/register')}>
          Register
        </Button>
      </div>
    </div>
  </nav>

  <!-- Hero & Main Project Showcase -->
  <main class="hero-section" class:visible={mounted}>
    <div class="hero-container">

      <!-- Main Logo & Emblem -->
      <div class="logo-wrapper">
        <div class="shield-badge">
          <svg class="main-shield" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <path d="M9 12l2 2 4-4" />
          </svg>
        </div>

        <h1 class="project-title">proctora</h1>
        <p class="project-tagline">Real-Time Online Examination System with Proctoring and Suspicious Event Detection</p>
      </div>

      <!-- Mandatory Course Specification Under Logo -->
      <div class="course-banner">
        <span class="banner-bullet"></span>
        <span class="course-text">This project is for the course IT303 : Software Engineering</span>
      </div>

      <!-- Action Buttons -->
      <div class="cta-group">
        <Button variant="primary" size="lg" onclick={() => push('/login')}>
          Candidate Portal
        </Button>
        <Button variant="secondary" size="lg" onclick={() => push('/register')}>
          Register Account
        </Button>
      </div>

      <!-- Project Authors & Academic Credits Card -->
      <div class="credits-card">
        <div class="card-header">
          <h2 class="card-title">Project Authors & Academic Supervision</h2>
          <span class="institution-subtext">Department of Information Technology · NITK Surathkal</span>
        </div>

        <div class="divider-line"></div>

        <div class="authors-grid">
          <div class="author-item">
            <span class="author-label">Author</span>
            <span class="author-name">Adarsh Bellamane</span>
            <span class="author-roll">241IT004</span>
          </div>

          <div class="author-item">
            <span class="author-label">Author</span>
            <span class="author-name">Harshith Vellapha</span>
            <span class="author-roll">241IT033</span>
          </div>

          <div class="author-item">
            <span class="author-label">Author</span>
            <span class="author-name">Rushi Patel</span>
            <span class="author-roll">241IT065</span>
          </div>
        </div>

        <div class="instructor-box">
          <span class="instructor-prefix">Course Instructor :</span>
          <span class="instructor-name">Jaidhar C.D.</span>
        </div>
      </div>

      <!-- System Highlights Grid -->
      <div class="features-grid">
        <div class="feature-card">
          <div class="feature-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z" />
            </svg>
          </div>
          <h3>AI Continuous Proctoring</h3>
          <p>YOLOv8 Pose 3D head pose estimation, gaze tracking, and candidate absence detection with temporal false-positive suppression.</p>
        </div>

        <div class="feature-card">
          <div class="feature-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
            </svg>
          </div>
          <h3>Seating Plan Deconfliction</h3>
          <p>9-color matrix physical classroom tiling ensuring all 8 immediate neighbors receive distinct question set sequences.</p>
        </div>

        <div class="feature-card">
          <div class="feature-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
            </svg>
          </div>
          <h3>Code Telemetry & Playback</h3>
          <p>Frame-by-frame typing telemetry streaming and playback synchronized with browser focus logs and proctor alerts.</p>
        </div>
      </div>

    </div>
  </main>

  <!-- Copyright Footer -->
  <footer class="landing-footer">
    <div class="footer-content">
      <p class="copyright">
        &copy; 2026 Proctora · National Institute of Technology Karnataka, Surathkal. All rights reserved.
      </p>
    </div>
  </footer>
</div>

<style>
  .landing-page {
    width: 100%;
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    background-color: var(--color-bg);
    color: var(--color-text-primary);
  }

  /* ---- Top Navigation ---- */
  .top-nav {
    position: sticky;
    top: 0;
    z-index: 50;
    width: 100%;
    background-color: rgba(250, 250, 249, 0.85);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border-bottom: 1px solid var(--color-border);
    opacity: 0;
    transform: translateY(-8px);
    transition: opacity 0.4s var(--ease), transform 0.4s var(--ease);
  }

  .top-nav.visible {
    opacity: 1;
    transform: translateY(0);
  }

  .nav-content {
    max-width: 1100px;
    margin: 0 auto;
    padding: var(--space-3) var(--space-6);
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .nav-brand {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .nav-logo {
    width: 20px;
    height: 20px;
    color: var(--color-text-primary);
  }

  .nav-wordmark {
    font-size: var(--text-lg);
    font-weight: 300;
    letter-spacing: 4px;
    text-transform: lowercase;
    color: var(--color-text-primary);
  }

  .nav-actions {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  /* ---- Hero & Content ---- */
  .hero-section {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: var(--space-12) var(--space-6) var(--space-10);
    opacity: 0;
    transform: translateY(12px);
    transition: opacity 0.5s var(--ease), transform 0.5s var(--ease);
  }

  .hero-section.visible {
    opacity: 1;
    transform: translateY(0);
  }

  .hero-container {
    width: 100%;
    max-width: 860px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-8);
    text-align: center;
  }

  /* ---- Main Logo Section ---- */
  .logo-wrapper {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-3);
  }

  .shield-badge {
    width: 58px;
    height: 58px;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: var(--color-bg-elevated);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    box-shadow: var(--shadow-sm);
    color: var(--color-text-primary);
  }

  .main-shield {
    width: 30px;
    height: 30px;
  }

  .project-title {
    font-size: var(--text-3xl);
    font-weight: 300;
    letter-spacing: 8px;
    text-transform: lowercase;
    color: var(--color-text-primary);
    margin: 0;
  }

  .project-tagline {
    font-size: var(--text-base);
    color: var(--color-text-secondary);
    max-width: 560px;
    line-height: 1.5;
    margin: 0;
  }

  /* ---- Course Banner ---- */
  .course-banner {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-5);
    background-color: var(--color-bg-elevated);
    border: 1px solid var(--color-border);
    border-radius: 9999px;
    box-shadow: var(--shadow-sm);
  }

  .banner-bullet {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background-color: var(--color-success);
  }

  .course-text {
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--color-text-primary);
    letter-spacing: 0.2px;
  }

  /* ---- CTA Buttons ---- */
  .cta-group {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-3);
    flex-wrap: wrap;
  }

  /* ---- Credits Card (Authors & Instructor) ---- */
  .credits-card {
    width: 100%;
    background-color: var(--color-bg-elevated);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    padding: var(--space-6) var(--space-8);
    box-shadow: var(--shadow-sm);
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
    text-align: left;
  }

  .card-header {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .card-title {
    font-size: var(--text-base);
    font-weight: 600;
    color: var(--color-text-primary);
    margin: 0;
    letter-spacing: -0.2px;
  }

  .institution-subtext {
    font-size: var(--text-xs);
    color: var(--color-text-muted);
  }

  .divider-line {
    width: 100%;
    height: 1px;
    background-color: var(--color-border);
  }

  .authors-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: var(--space-4);
  }

  .author-item {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: var(--space-3);
    background-color: var(--color-bg-subtle);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
  }

  .author-label {
    font-size: var(--text-xs);
    font-weight: 500;
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .author-name {
    font-size: var(--text-base);
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .author-roll {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--color-text-secondary);
  }

  .instructor-box {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-4);
    background-color: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    font-size: var(--text-sm);
  }

  .instructor-prefix {
    font-weight: 500;
    color: var(--color-text-secondary);
  }

  .instructor-name {
    font-weight: 600;
    color: var(--color-text-primary);
  }

  /* ---- Feature Highlights Grid ---- */
  .features-grid {
    width: 100%;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: var(--space-4);
    margin-top: var(--space-2);
    text-align: left;
  }

  .feature-card {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-5);
    background-color: var(--color-bg-elevated);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    box-shadow: var(--shadow-sm);
  }

  .feature-icon {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-text-primary);
    background-color: var(--color-bg-subtle);
    border-radius: var(--radius-sm);
    margin-bottom: var(--space-1);
  }

  .feature-icon svg {
    width: 18px;
    height: 18px;
  }

  .feature-card h3 {
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--color-text-primary);
    margin: 0;
  }

  .feature-card p {
    font-size: var(--text-xs);
    color: var(--color-text-secondary);
    line-height: 1.5;
    margin: 0;
  }

  /* ---- Footer ---- */
  .landing-footer {
    width: 100%;
    border-top: 1px solid var(--color-border);
    background-color: var(--color-bg-elevated);
    padding: var(--space-6) var(--space-4);
    margin-top: auto;
  }

  .footer-content {
    max-width: 1100px;
    margin: 0 auto;
    text-align: center;
  }

  .copyright {
    font-size: var(--text-xs);
    color: var(--color-text-muted);
    letter-spacing: 0.2px;
    margin: 0;
  }

  @media (max-width: 640px) {
    .hero-section {
      padding: var(--space-8) var(--space-4);
    }

    .project-title {
      font-size: var(--text-2xl);
      letter-spacing: 5px;
    }

    .credits-card {
      padding: var(--space-5) var(--space-4);
    }
  }
</style>
