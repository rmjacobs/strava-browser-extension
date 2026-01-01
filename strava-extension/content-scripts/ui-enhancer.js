// UI enhancements for significant activities
class UIEnhancer {
  constructor() {
    this.activityBadges = new Map();
  }

  async init() {
    console.log('[Strava Extension] UI enhancer initialized');
    
    // Listen for new activities
    document.addEventListener('stravaActivityDetected', async (e) => {
      await this.enhanceActivity(e.detail);
    });

    // Listen for kudos events
    document.addEventListener('stravaKudosGiven', (e) => {
      this.markKudosGiven(e.detail);
    });
  }

  async enhanceActivity(activity) {
    if (!activity.evaluation.isSignificant) {
      return;
    }

    const element = activity.element;

    // Add visual indicator
    this.addPriorityBadge(element, activity);

    // Add glow effect for high priority
    if (activity.evaluation.priority === 'critical' || activity.evaluation.priority === 'high') {
      this.addGlowEffect(element, activity.evaluation.priority);
    }

    // Add to review queue
    await StorageManager.addToReviewQueue(activity);

    // Send browser notification
    await this.sendNotification(activity);
  }

  addPriorityBadge(element, activity) {
    // Check if badge already exists
    if (element.querySelector('.strava-ext-badge')) {
      return;
    }

    const badge = document.createElement('div');
    badge.className = `strava-ext-badge strava-ext-priority-${activity.evaluation.priority}`;
    
    const icon = this.getPriorityIcon(activity.evaluation.priority);
    const text = activity.evaluation.isVIP ? '⭐ VIP' : this.getPriorityText(activity.evaluation.priority);
    
    badge.innerHTML = `${icon} ${text}`;
    badge.title = RuleEngine.formatActivitySummary(activity, activity.evaluation);
    
    // Insert badge at the top of the activity card
    const header = element.querySelector('.entry-header, [class*="Header"]') || element;
    header.style.position = 'relative';
    header.insertBefore(badge, header.firstChild);
    
    this.activityBadges.set(activity.id, badge);
  }

  addGlowEffect(element, priority) {
    element.classList.add('strava-ext-highlight');
    element.classList.add(`strava-ext-highlight-${priority}`);
  }

  getPriorityIcon(priority) {
    const icons = {
      'critical': '🔥',
      'high': '⚡',
      'medium': '✨',
      'low': '👍'
    };
    return icons[priority] || '📍';
  }

  getPriorityText(priority) {
    const texts = {
      'critical': 'EPIC',
      'high': 'Impressive',
      'medium': 'Notable',
      'low': 'Activity'
    };
    return texts[priority] || '';
  }

  async sendNotification(activity) {
    const settings = await StorageManager.getSettings();

    if (!settings.notifications.enabled) {
      console.log('[UI Enhancer] Notifications disabled in settings');
      return;
    }

    // Check if we've already notified for this activity (prevent duplicates)
    const alreadyNotified = await StorageManager.isActivityProcessed(activity.id);
    if (alreadyNotified) {
      console.log('[UI Enhancer] Already notified for activity:', activity.id);
      return;
    }

    const summary = RuleEngine.formatActivitySummary(activity, activity.evaluation);
    const icon = activity.evaluation.priority === 'critical' ? '🔥' : '⚡';
    const title = `${icon} ${activity.athleteName}`;

    console.log('[UI Enhancer] Sending notification for activity:', activity.id, summary);

    // Send to background script to create Pushover notification
    chrome.runtime.sendMessage({
      type: 'showNotification',
      data: {
        title: title,
        message: summary,
        activityId: activity.id,
        priority: activity.evaluation.priority
      }
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('[UI Enhancer] Error sending notification message:', chrome.runtime.lastError);
      } else {
        console.log('[UI Enhancer] Notification message sent successfully:', response);
      }
    });

    // Mark activity as processed so we don't notify again
    await StorageManager.addProcessedActivity(activity.id);
    await StorageManager.incrementStats('notification');
  }

  markKudosGiven(activity) {
    const badge = this.activityBadges.get(activity.id);
    if (badge) {
      const kudosIndicator = document.createElement('span');
      kudosIndicator.className = 'strava-ext-kudos-indicator';
      kudosIndicator.innerHTML = ' 👍';
      badge.appendChild(kudosIndicator);
    }
  }
}

// Initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    const enhancer = new UIEnhancer();
    enhancer.init();
  });
} else {
  const enhancer = new UIEnhancer();
  enhancer.init();
}
