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

// Priority level mapping for comparison
const PRIORITY_LEVELS = {
  'low': 1,
  'medium': 2,
  'high': 3,
  'critical': 4
};

// Check if activity priority meets provider's minimum priority threshold
function meetsMinPriority(activityPriority, minPriority) {
  return PRIORITY_LEVELS[activityPriority] >= PRIORITY_LEVELS[minPriority];
}

// Send notifications to all enabled providers
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

  const providers = settings.notifications.providers;

  if (!providers) {
    console.log('[Service Worker] No providers configured');
    return;
  }

  // Collect all notification promises
  const notificationPromises = [];

  // Pushover
  if (providers.pushover && providers.pushover.enabled) {
    if (meetsMinPriority(priority, providers.pushover.minPriority)) {
      console.log('[Service Worker] Sending to Pushover (priority check passed)');
      notificationPromises.push(
        sendPushoverNotification(providers.pushover, title, message, priority, activityId)
      );
    } else {
      console.log('[Service Worker] Skipping Pushover (priority too low)');
    }
  }

  // Webhooks (Discord, Slack, Generic)
  if (providers.webhooks && Array.isArray(providers.webhooks)) {
    providers.webhooks.forEach((webhook) => {
      if (!webhook.enabled) {
        console.log(`[Service Worker] Skipping ${webhook.name} (disabled)`);
        return;
      }

      if (!meetsMinPriority(priority, webhook.minPriority)) {
        console.log(`[Service Worker] Skipping ${webhook.name} (priority too low)`);
        return;
      }

      console.log(`[Service Worker] Sending to ${webhook.name} (${webhook.format}) (priority check passed)`);

      // Route to appropriate function based on format
      if (webhook.format === 'discord') {
        notificationPromises.push(
          sendDiscordNotification(webhook, title, message, priority, activityId)
        );
      } else if (webhook.format === 'slack') {
        notificationPromises.push(
          sendSlackNotification(webhook, title, message, priority, activityId)
        );
      } else if (webhook.format === 'generic') {
        notificationPromises.push(
          sendGenericWebhookNotification(webhook, title, message, priority, activityId)
        );
      } else {
        console.warn(`[Service Worker] Unknown webhook format: ${webhook.format}`);
      }
    });
  }

  if (notificationPromises.length === 0) {
    console.log('[Service Worker] No providers enabled or priority thresholds not met');
    return;
  }

  // Send to all providers in parallel, don't let one failure block others
  console.log(`[Service Worker] Sending to ${notificationPromises.length} provider(s)`);
  const results = await Promise.allSettled(notificationPromises);

  // Log any failures
  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      console.error(`[Service Worker] Provider ${index} failed:`, result.reason);
    }
  });
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

async function sendDiscordNotification(webhook, title, message, priority, activityId) {
  const { url } = webhook;

  console.log('[Service Worker] Sending Discord notification');

  if (!url) {
    console.log('[Service Worker] Discord not configured (missing webhook URL), skipping');
    return;
  }

  // Map priority to Discord embed color
  let color = 0x3498db; // Blue for low/medium
  if (priority === 'critical') {
    color = 0xe74c3c; // Red
  } else if (priority === 'high') {
    color = 0xf39c12; // Orange
  } else if (priority === 'medium') {
    color = 0xf1c40f; // Yellow
  }

  // Activity icon based on priority
  const icon = priority === 'critical' ? '🔥' : priority === 'high' ? '⚡' : '🎯';

  // Construct activity URL
  const activityUrl = `https://www.strava.com/activities/${activityId}`;

  console.log('[Service Worker] Sending Discord notification:', { title, priority, color, url: activityUrl });

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        embeds: [{
          title: `${icon} ${title}`,
          description: message,
          color: color,
          url: activityUrl,
          timestamp: new Date().toISOString()
        }]
      })
    });

    if (response.ok) {
      console.log('[Service Worker] Discord notification sent successfully');
    } else {
      const errorText = await response.text();
      console.error('[Service Worker] Discord error:', response.status, errorText);
    }
  } catch (error) {
    console.error('[Service Worker] Failed to send Discord notification:', error);
  }
}

async function sendSlackNotification(webhook, title, message, priority, activityId) {
  const { url } = webhook;

  console.log('[Service Worker] Sending Slack notification');

  if (!url) {
    console.log('[Service Worker] Slack not configured (missing webhook URL), skipping');
    return;
  }

  // Map priority to Slack color
  let color = '#3498db'; // Blue for low/medium
  if (priority === 'critical') {
    color = '#e74c3c'; // Red
  } else if (priority === 'high') {
    color = '#f39c12'; // Orange
  } else if (priority === 'medium') {
    color = '#f1c40f'; // Yellow
  }

  // Activity icon based on priority
  const icon = priority === 'critical' ? ':fire:' : priority === 'high' ? ':zap:' : ':dart:';

  // Construct activity URL
  const activityUrl = `https://www.strava.com/activities/${activityId}`;

  console.log('[Service Worker] Sending Slack notification:', { title, priority, color, url: activityUrl });

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        attachments: [{
          color: color,
          title: `${icon} ${title}`,
          text: message,
          title_link: activityUrl,
          footer: 'Strava Activity Monitor',
          ts: Math.floor(Date.now() / 1000)
        }]
      })
    });

    if (response.ok) {
      console.log('[Service Worker] Slack notification sent successfully');
    } else {
      const errorText = await response.text();
      console.error('[Service Worker] Slack error:', response.status, errorText);
    }
  } catch (error) {
    console.error('[Service Worker] Failed to send Slack notification:', error);
  }
}

async function sendGenericWebhookNotification(webhook, title, message, priority, activityId) {
  const { url, method, headers } = webhook;

  console.log('[Service Worker] Sending Generic Webhook notification');

  if (!url) {
    console.log('[Service Worker] Generic Webhook not configured (missing URL), skipping');
    return;
  }

  // Construct activity URL
  const activityUrl = `https://www.strava.com/activities/${activityId}`;

  // Payload with all activity data
  const payload = {
    title: title,
    message: message,
    priority: priority,
    activityId: activityId,
    activityUrl: activityUrl,
    timestamp: new Date().toISOString()
  };

  console.log('[Service Worker] Sending Generic Webhook notification:', { url, method, priority });

  try {
    const response = await fetch(url, {
      method: method || 'POST',
      headers: headers || { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      console.log('[Service Worker] Generic Webhook notification sent successfully');
    } else {
      const errorText = await response.text();
      console.error('[Service Worker] Generic Webhook error:', response.status, errorText);
    }
  } catch (error) {
    console.error('[Service Worker] Failed to send Generic Webhook notification:', error);
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
