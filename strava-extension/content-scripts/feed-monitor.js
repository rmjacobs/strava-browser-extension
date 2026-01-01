// Monitor Strava feed for new activities - CLEAN MINIMAL VERSION
class FeedMonitor {
  constructor() {
    this.observedActivities = new Set();
    this.processingQueue = [];
    this.isProcessing = false;
  }

  async init() {
    console.log('[Feed Monitor] Initializing...');
    
    // Do ONE initial scan - process all activities on page load
    await this.scanFeed(true); // Pass true for initial scan
    
    // Set up periodic rescan every 30 seconds (for auto-refresh)
    setInterval(() => {
      console.log('[Feed Monitor] Periodic scan...');
      this.scanFeed(false); // Pass false for subsequent scans
    }, 30000);
    
    console.log('[Feed Monitor] Initialized successfully');
  }

  async scanFeed(isInitialScan = false) {
    // Find activity cards using the most reliable selector
    const activityElements = document.querySelectorAll('[data-testid="web-feed-entry"]');
    
    console.log(`[Feed Monitor] Found ${activityElements.length} entries${isInitialScan ? ' (initial scan)' : ''}`);

    let newActivitiesCount = 0;
    
    for (const element of activityElements) {
      // Skip challenges (they look like activities but aren't)
      if (this.isChallenge(element)) {
        continue;
      }
      
      const activityId = this.getActivityId(element);
      
      if (!activityId) {
        continue;
      }
      
      // On subsequent scans, skip if already seen in memory
      // On initial scan, process everything (storage check happens in processActivity)
      if (!isInitialScan && this.observedActivities.has(activityId)) {
        continue;
      }

      console.log(`[Feed Monitor] New activity: ${activityId}`);
      this.observedActivities.add(activityId);
      this.processingQueue.push(element);
      newActivitiesCount++;
    }
    
    if (newActivitiesCount > 0) {
      console.log(`[Feed Monitor] Added ${newActivitiesCount} new activities`);
      
      // Process queue if not already processing
      if (!this.isProcessing) {
        await this.processQueue();
      }
    }
  }

  isChallenge(element) {
    // Check if this is a challenge entry (not an activity)
    // Key distinction: Real challenges DON'T have activity links
    const hasActivityLink = element.querySelector('a[href*="/activities/"]');
    
    // If it has an activity link, it's NOT a challenge (it's a real activity)
    // Even if the text mentions "challenge" (like challenge badges)
    if (hasActivityLink) {
      return false;
    }
    
    // No activity link + challenge indicators = it's a challenge
    const hasChallengeIndicator = element.querySelector('[data-testid*="challenge"]') ||
                                   element.textContent.toLowerCase().includes('challenge');
    
    return !hasActivityLink || hasChallengeIndicator;
  }

  getActivityId(element) {
    // Find activity link and extract ID
    const link = element.querySelector('a[href*="/activities/"]');
    if (!link) return null;
    
    const match = link.href.match(/\/activities\/(\d+)/);
    return match ? match[1] : null;
  }

  async processQueue() {
    this.isProcessing = true;
    console.log(`[Feed Monitor] Processing ${this.processingQueue.length} activities...`);

    while (this.processingQueue.length > 0) {
      const element = this.processingQueue.shift();
      await this.processActivity(element);
      
      // Small delay between processing
      await this.delay(100);
    }

    this.isProcessing = false;
    console.log('[Feed Monitor] Processing complete');
  }

  async processActivity(element) {
    try {
      // Parse activity data
      const activity = ActivityParser.parseActivityCard(element);
      
      if (!activity || !activity.id) {
        console.warn('[Feed Monitor] Could not parse activity');
        return;
      }

      console.log(`[Feed Monitor] Processing: ${activity.athleteName} - ${activity.title}`);

      // Evaluate activity significance
      const evaluation = await RuleEngine.evaluateActivity(activity);
      activity.evaluation = evaluation;

      // Dispatch event for other modules (auto-kudos, notifications, etc)
      // Note: Auto-kudos checks button state to avoid duplicates
      this.dispatchActivityEvent(activity);

    } catch (error) {
      console.error('[Feed Monitor] Error processing activity:', error);
    }
  }

  dispatchActivityEvent(activity) {
    const event = new CustomEvent('stravaActivityDetected', {
      detail: activity
    });
    document.dispatchEvent(event);
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Initialize when page is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    const feedMonitor = new FeedMonitor();
    feedMonitor.init();
  });
} else {
  const feedMonitor = new FeedMonitor();
  feedMonitor.init();
}
