// Storage utility for managing extension settings
const StorageManager = {
  DEFAULT_SETTINGS: {
    autoKudos: {
      enabled: true,
      onlySignificant: false,
      excludedAthletes: [],
      dailyLimit: 100,
      delayMs: 2000
    },
    notifications: {
      enabled: true,
      preset: 'impressive-efforts', // 'prs-only', 'impressive-efforts', 'epic-adventures', 'everything'
      customRules: [],
      pushover: {
        enabled: false,
        userKey: '',
        appToken: '',
        minPriority: 'high' // 'critical', 'high', 'medium', 'low'
      }
    },
    autoRefresh: {
      enabled: false,
      intervalMinutes: 5 // Refresh interval in minutes (1-60)
    },
    vipAthletes: [], // Athletes with special notification rules
    reviewQueue: [], // Activities queued for review/commenting
    processedActivities: [], // Track kudos'd activities (limit to last 1000)
    stats: {
      totalKudos: 0,
      totalNotifications: 0,
      lastReset: Date.now()
    }
  },

  PRESETS: {
    'prs-only': {
      name: "Don't Miss PRs",
      description: "Only notify on personal records",
      rules: [
        { type: 'has-pr-badge', priority: 'high' }
      ]
    },
    'impressive-efforts': {
      name: "Impressive Efforts",
      description: "Long distances or fast paces",
      rules: [
        { type: 'ride', condition: 'distance', operator: '>', value: 50, unit: 'miles', priority: 'high' },
        { type: 'ride', condition: 'speed', operator: '>', value: 20, unit: 'mph', priority: 'high' },
        { type: 'run', condition: 'distance', operator: '>', value: 13.1, unit: 'miles', priority: 'high' },
        { type: 'run', condition: 'pace', operator: '<', value: 7, unit: 'min/mile', priority: 'medium' },
        { type: 'any', condition: 'elevation', operator: '>', value: 5000, unit: 'feet', priority: 'medium' }
      ]
    },
    'epic-adventures': {
      name: "Epic Adventures",
      description: "Extreme distances and elevation",
      rules: [
        { type: 'ride', condition: 'distance', operator: '>', value: 100, unit: 'miles', priority: 'critical' },
        { type: 'run', condition: 'distance', operator: '>', value: 26.2, unit: 'miles', priority: 'critical' },
        { type: 'any', condition: 'elevation', operator: '>', value: 10000, unit: 'feet', priority: 'critical' }
      ]
    },
    'everything': {
      name: "Everything",
      description: "All activities from followed athletes",
      rules: [
        { type: 'any', priority: 'low' }
      ]
    }
  },

  async get(keys = null) {
    return new Promise((resolve) => {
      chrome.storage.local.get(keys, (result) => {
        resolve(result);
      });
    });
  },

  async set(data) {
    return new Promise((resolve) => {
      chrome.storage.local.set(data, resolve);
    });
  },

  async getSettings() {
    const data = await this.get('settings');
    return data.settings || this.DEFAULT_SETTINGS;
  },

  async updateSettings(updates) {
    const settings = await this.getSettings();
    const merged = { ...settings, ...updates };
    await this.set({ settings: merged });
    return merged;
  },

  async addProcessedActivity(activityId) {
    const settings = await this.getSettings();
    settings.processedActivities.push({
      id: activityId,
      timestamp: Date.now()
    });
    
    // Keep only last 1000 activities
    if (settings.processedActivities.length > 1000) {
      settings.processedActivities = settings.processedActivities.slice(-1000);
    }
    
    await this.set({ settings });
  },

  async isActivityProcessed(activityId) {
    const settings = await this.getSettings();
    return settings.processedActivities.some(a => a.id === activityId);
  },

  async incrementStats(type) {
    const settings = await this.getSettings();
    if (type === 'kudos') settings.stats.totalKudos++;
    if (type === 'notification') settings.stats.totalNotifications++;
    await this.set({ settings });
  },

  async getActiveRules() {
    const settings = await this.getSettings();
    const preset = this.PRESETS[settings.notifications.preset];

    if (!preset) return [];

    // Start with preset rules and custom rules
    const rules = [...preset.rules, ...settings.notifications.customRules];

    console.log('[StorageManager] Preset rules:', preset.rules.length);
    console.log('[StorageManager] Custom rules:', settings.notifications.customRules.length);
    console.log('[StorageManager] VIP athletes count:', settings.vipAthletes?.length || 0);

    // Add automatic VIP rule if there are VIP athletes
    if (settings.vipAthletes && settings.vipAthletes.length > 0) {
      console.log('[StorageManager] Adding VIP-only rule for', settings.vipAthletes.length, 'VIP athletes');
      rules.push({
        type: 'vip-only',
        priority: 'high',
        description: 'VIP Athletes'
      });
    } else {
      console.log('[StorageManager] No VIP athletes, not adding VIP rule');
    }

    console.log('[StorageManager] Total rules:', rules.length);

    return rules;
  },

  async addToReviewQueue(activity) {
    const settings = await this.getSettings();
    if (!settings.reviewQueue) {
      settings.reviewQueue = [];
    }

    // Check if activity already in queue
    const exists = settings.reviewQueue.some(item => item.activityId === activity.id);
    if (exists) return;

    settings.reviewQueue.push({
      activityId: activity.id,
      athleteName: activity.athleteName,
      athleteId: activity.athleteId,
      activityType: activity.activityType,
      title: activity.title,
      distance: activity.distance,
      elevation: activity.elevation,
      speed: activity.speed,
      pace: activity.pace,
      hasPR: activity.hasPR,
      commentCount: activity.commentCount,
      priority: activity.evaluation.priority,
      isVIP: activity.evaluation.isVIP,
      addedAt: Date.now(),
      reviewed: false
    });

    // Keep only last 100 items
    if (settings.reviewQueue.length > 100) {
      settings.reviewQueue = settings.reviewQueue.slice(-100);
    }

    await this.set({ settings });
  },

  async getReviewQueue() {
    const settings = await this.getSettings();
    return settings.reviewQueue || [];
  },

  async markReviewQueueItem(activityId, reviewed) {
    const settings = await this.getSettings();
    if (!settings.reviewQueue) return;

    const item = settings.reviewQueue.find(i => i.activityId === activityId);
    if (item) {
      item.reviewed = reviewed;
      await this.set({ settings });
    }
  },

  async clearReviewedItems() {
    const settings = await this.getSettings();
    if (!settings.reviewQueue) return;

    settings.reviewQueue = settings.reviewQueue.filter(item => !item.reviewed);
    await this.set({ settings });
  },

  async getReviewQueueCount() {
    const queue = await this.getReviewQueue();
    return queue.filter(item => !item.reviewed).length;
  }
};

// Make available globally
if (typeof window !== 'undefined') {
  window.StorageManager = StorageManager;
}
