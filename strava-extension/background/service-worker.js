// Background service worker
console.log('[Strava Extension] Service worker loaded');

// Handle installation
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('[Strava Extension] Installed:', details.reason);
  
  if (details.reason === 'install') {
    // Set default settings on first install
    const defaultSettings = {
      autoKudos: {
        enabled: true,
        onlySignificant: false,
        excludedAthletes: [],
        dailyLimit: 100,
        delayMs: 2000
      },
      notifications: {
        enabled: true,
        preset: 'impressive-efforts',
        customRules: [],
        pushover: {
          enabled: false,
          userKey: '',
          appToken: '',
          minPriority: 'high'
        }
      },
      autoRefresh: {
        enabled: false,
        intervalMinutes: 5
      },
      vipAthletes: [],
      processedActivities: [],
      stats: {
        totalKudos: 0,
        totalNotifications: 0,
        lastReset: Date.now()
      }
    };
    
    await chrome.storage.local.set({ settings: defaultSettings });
    
    // Setup auto-refresh alarm if needed
    setupAutoRefreshAlarm(defaultSettings);
    
    // Open options page
    chrome.runtime.openOptionsPage();
  }
});

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Service Worker] Message received:', message.type);
  
  if (message.type === 'showNotification') {
    showNotification(message.data).then(() => {
      sendResponse({ success: true });
    }).catch((error) => {
      console.error('[Service Worker] Notification error:', error);
      sendResponse({ success: false, error: error.message });
    });
    return true; // Keep channel open for async response
  }
  
  if (message.type === 'getSettings') {
    chrome.storage.local.get('settings', (data) => {
      sendResponse(data.settings);
    });
    return true; // Keep channel open for async response
  }
  
  if (message.type === 'updateSettings') {
    chrome.storage.local.get('settings', (data) => {
      const updated = { ...data.settings, ...message.data };
      chrome.storage.local.set({ settings: updated }, () => {
        // Update auto-refresh alarm when settings change
        setupAutoRefreshAlarm(updated);
        sendResponse({ success: true });
      });
    });
    return true;
  }
});

// Setup auto-refresh alarm
async function setupAutoRefreshAlarm(settings) {
  // Clear existing alarm
  await chrome.alarms.clear('autoRefresh');
  
  if (!settings || !settings.autoRefresh || !settings.autoRefresh.enabled) {
    console.log('[Service Worker] Auto-refresh disabled, alarm cleared');
    return;
  }
  
  const intervalMinutes = settings.autoRefresh.intervalMinutes || 5;
  console.log(`[Service Worker] Setting up auto-refresh alarm: every ${intervalMinutes} minutes`);
  
  // Create alarm that repeats at the specified interval
  await chrome.alarms.create('autoRefresh', {
    delayInMinutes: intervalMinutes,
    periodInMinutes: intervalMinutes
  });
}

// Load settings and setup auto-refresh on startup
chrome.storage.local.get('settings', (result) => {
  if (result.settings) {
    setupAutoRefreshAlarm(result.settings);
  }
});

// Show Pushover notification only
async function showNotification(data) {
  const { title, message, activityId, priority } = data;

  console.log('[Service Worker] Received notification request:', { title, message, activityId, priority });

  // Get notification settings
  const result = await chrome.storage.local.get('settings');
  const settings = result.settings;

  if (!settings || !settings.notifications.enabled) {
    console.log('[Service Worker] Notifications disabled in settings');
    return;
  }

  // Only Pushover notifications now
  if (settings.notifications.pushover && settings.notifications.pushover.enabled) {
    console.log('[Service Worker] Sending Pushover notification');
    await sendPushoverNotification(settings.notifications.pushover, title, message, priority, activityId);
  } else {
    console.log('[Service Worker] Pushover not configured, skipping notification');
  }
}

async function sendPushoverNotification(pushoverConfig, title, message, priority, activityId) {
  const { userKey, appToken } = pushoverConfig;
  
  console.log('[Service Worker] Sending Pushover notification');
  
  if (!userKey || !appToken) {
    console.log('[Service Worker] Pushover not configured (missing credentials), skipping');
    return;
  }
  
  // Map priority to Pushover priority (-2 to 2)
  let pushoverPriority = 0; // Normal
  if (priority === 'critical') {
    pushoverPriority = 2; // Emergency (requires acknowledgment)
  } else if (priority === 'high') {
    pushoverPriority = 1; // High priority
  }

  // Construct activity URL for clickable notification
  const activityUrl = `https://www.strava.com/activities/${activityId}`;

  console.log('[Service Worker] Sending Pushover notification:', { title, priority, pushoverPriority, url: activityUrl });

  try {
    const response = await fetch('https://api.pushover.net/1/messages.json', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        token: appToken,
        user: userKey,
        message: message,
        title: title,
        priority: pushoverPriority,
        sound: 'pushover',
        url: activityUrl,
        url_title: 'View Activity'
      })
    });
    
    const data = await response.json();
    
    if (data.status === 1) {
      console.log('[Service Worker] Pushover notification sent successfully');
    } else {
      console.error('[Service Worker] Pushover error:', data.errors);
    }
  } catch (error) {
    console.error('[Service Worker] Failed to send Pushover notification:', error);
  }
}

// Periodic cleanup of old processed activities
chrome.alarms.create('cleanup', { periodInMinutes: 60 });

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'cleanup') {
    const result = await chrome.storage.local.get('settings');
    const settings = result.settings;
    
    if (settings && settings.processedActivities) {
      // Remove activities older than 7 days
      const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
      settings.processedActivities = settings.processedActivities.filter(
        a => a.timestamp > sevenDaysAgo
      );
      
      await chrome.storage.local.set({ settings });
      console.log('[Strava Extension] Cleaned up old activities');
    }
  }
  
  if (alarm.name === 'autoRefresh') {
    console.log('[Service Worker] Auto-refresh alarm triggered');
    
    // Find all Strava dashboard tabs and reload them
    const tabs = await chrome.tabs.query({
      url: 'https://www.strava.com/dashboard*'
    });
    
    console.log(`[Service Worker] Found ${tabs.length} dashboard tab(s) to refresh`);
    
    for (const tab of tabs) {
      try {
        await chrome.tabs.reload(tab.id);
        console.log(`[Service Worker] Refreshed tab ${tab.id}`);
      } catch (error) {
        console.error(`[Service Worker] Failed to refresh tab ${tab.id}:`, error);
      }
    }
  }
});
