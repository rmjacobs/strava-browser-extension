// Auto-kudos functionality - CLEAN VERSION
class AutoKudos {
  constructor() {
    this.kudosQueue = [];
    this.isProcessingKudos = false;
    this.dailyKudosCount = 0;
    this.lastResetDate = this.getTodayDate();
  }

  async init() {
    console.log('[Strava Extension] Auto-kudos initialized');
    
    // Listen for new activities
    document.addEventListener('stravaActivityDetected', async (e) => {
      await this.handleNewActivity(e.detail);
    });

    // Load daily count
    await this.loadDailyCount();
  }

  async handleNewActivity(activity) {
    console.log('[Auto-Kudos] handleNewActivity called for:', activity.athleteName, activity.id);
    
    const settings = await StorageManager.getSettings();
    
    if (!settings.autoKudos.enabled) {
      console.log('[Auto-Kudos] Auto-kudos disabled in settings');
      return;
    }

    // Check if already has kudos
    if (activity.hasKudos) {
      console.log('[Auto-Kudos] Already has kudos:', activity.id);
      return;
    }

    // Check if athlete is excluded
    if (settings.autoKudos.excludedAthletes.includes(activity.athleteId)) {
      console.log('[Auto-Kudos] Athlete excluded:', activity.athleteName);
      return;
    }

    // Check daily limit
    if (this.dailyKudosCount >= settings.autoKudos.dailyLimit) {
      console.log('[Auto-Kudos] Daily limit reached:', this.dailyKudosCount, '/', settings.autoKudos.dailyLimit);
      return;
    }

    // If onlySignificant is enabled, check if activity is significant
    if (settings.autoKudos.onlySignificant && !activity.evaluation.isSignificant) {
      console.log('[Auto-Kudos] Activity not significant, skipping kudos');
      return;
    }

    console.log('[Auto-Kudos] Adding to queue:', activity.athleteName, activity.id);
    
    // Add to kudos queue
    this.kudosQueue.push(activity);
    
    // Process queue
    if (!this.isProcessingKudos) {
      await this.processKudosQueue();
    }
  }

  async processKudosQueue() {
    this.isProcessingKudos = true;
    const settings = await StorageManager.getSettings();

    while (this.kudosQueue.length > 0) {
      const activity = this.kudosQueue.shift();
      
      try {
        await this.giveKudos(activity);
        
        // Delay between kudos (human-like behavior)
        const delay = settings.autoKudos.delayMs + Math.random() * 1000;
        await this.delay(delay);
        
      } catch (error) {
        console.error('[Auto-Kudos] Error giving kudos:', error);
      }
    }

    this.isProcessingKudos = false;
  }

  async giveKudos(activity) {
    const settings = await StorageManager.getSettings();
    
    // Check daily limit
    if (this.dailyKudosCount >= settings.autoKudos.dailyLimit) {
      console.log('[Auto-Kudos] Daily limit reached, stopping');
      this.kudosQueue = [];
      return;
    }

    // Simple approach: Find ALL kudos buttons in this activity's element
    let kudosButtons = Array.from(activity.element.querySelectorAll('button[data-testid="kudos_button"]'));
    
    // Fallback: search more broadly if none found
    if (kudosButtons.length === 0) {
      const allButtons = Array.from(activity.element.querySelectorAll('button'));
      kudosButtons = allButtons.filter(btn => {
        const testId = btn.getAttribute('data-testid');
        const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
        const title = (btn.getAttribute('title') || '').toLowerCase();
        const text = btn.textContent.toLowerCase();
        
        // Exclude comment buttons
        if (testId === 'comment_button' || title.includes('comment') || ariaLabel.includes('comment')) {
          return false;
        }
        
        // Look for kudos indicators
        return testId === 'kudos_button' || 
               testId === 'kudos-button' ||
               title.includes('kudos') || 
               ariaLabel.includes('kudos') ||
               text.includes('kudos');
      });
    }

    if (kudosButtons.length === 0) {
      console.warn('[Auto-Kudos] No kudos buttons found for activity:', activity.id);
      return;
    }

    console.log(`[Auto-Kudos] Found ${kudosButtons.length} kudos button(s) for activity ${activity.id}`);

    // Click all unclicked kudos buttons
    let clickedCount = 0;
    for (const button of kudosButtons) {
      // Check daily limit before each click
      if (this.dailyKudosCount >= settings.autoKudos.dailyLimit) {
        console.log('[Auto-Kudos] Daily limit reached while processing buttons');
        break;
      }

      // Skip if already clicked
      if (this.hasAlreadyGivenKudos(button)) {
        console.log('[Auto-Kudos] Skipping button - already gave kudos');
        continue;
      }

      // Click it
      button.click();
      clickedCount++;
      
      // Increment counters
      this.dailyKudosCount++;
      await this.saveDailyCount();
      await StorageManager.incrementStats('kudos');
      
      // Small delay between clicks if multiple buttons
      if (kudosButtons.length > 1 && clickedCount < kudosButtons.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    if (clickedCount > 0) {
      console.log(`[Auto-Kudos] Gave ${clickedCount} kudos for activity ${activity.id}`);
      
      // Dispatch event
      const event = new CustomEvent('stravaKudosGiven', {
        detail: activity
      });
      document.dispatchEvent(event);
    } else {
      console.log('[Auto-Kudos] All kudos already given for activity:', activity.id);
    }
  }


  hasAlreadyGivenKudos(button) {
    // Check if kudos already given
    const buttonTitle = button.getAttribute('title')?.toLowerCase() || '';
    if (buttonTitle.includes('view') || buttonTitle.includes('all kudos')) {
      return true;
    }
    
    if (button.classList.contains('active') || 
        button.classList.contains('given') ||
        button.disabled) {
      return true;
    }

    return false;
  }

  async loadDailyCount() {
    const data = await StorageManager.get(['dailyKudosCount', 'lastResetDate']);
    const today = this.getTodayDate();
    
    if (data.lastResetDate !== today) {
      // New day, reset counter
      this.dailyKudosCount = 0;
      this.lastResetDate = today;
      await this.saveDailyCount();
    } else {
      this.dailyKudosCount = data.dailyKudosCount || 0;
      this.lastResetDate = data.lastResetDate;
    }
  }

  async saveDailyCount() {
    await StorageManager.set({
      dailyKudosCount: this.dailyKudosCount,
      lastResetDate: this.lastResetDate
    });
  }

  getTodayDate() {
    return new Date().toISOString().split('T')[0];
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    const autoKudos = new AutoKudos();
    autoKudos.init();
  });
} else {
  const autoKudos = new AutoKudos();
  autoKudos.init();
}
