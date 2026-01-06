# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Chrome browser extension (Manifest V3) that monitors your Strava dashboard, automatically gives kudos to activities, and sends notifications for significant athletic achievements. The extension uses DOM parsing (no official Strava API) to detect activities in real-time.

## Development Commands

```bash
# Install dependencies (for Puppeteer debugging scripts)
npm install

# Load extension in Chrome
# 1. Navigate to chrome://extensions/
# 2. Enable "Developer mode"
# 3. Click "Load unpacked"
# 4. Select the strava-extension/ folder

# After making changes, reload extension:
# - Go to chrome://extensions/
# - Click reload icon for the extension
# - Refresh any open Strava dashboard tabs

# View logs:
# - Open Chrome DevTools (F12) on Strava dashboard
# - Look for prefixed messages: [Feed Monitor], [Auto-Kudos], [Service Worker]
```

## Architecture

### Component Structure

**manifest.json** - Extension configuration declaring permissions, content scripts, and background workers

**background/service-worker.js** - Background service worker that:
- Handles Chrome alarms for cleanup and auto-refresh
- Sends notifications to multiple providers (Pushover, Discord, Slack, Generic Webhook)
- Manages settings updates and storage
- Handles provider-specific notification formatting and delivery

**utils/** - Shared utilities loaded into content script context:
- `storage.js` - StorageManager handles all Chrome storage operations, default settings, and notification presets
- `activity-parser.js` - ActivityParser extracts activity data from Strava's DOM (distance, pace, elevation, athlete info, etc.)
- `rule-engine.js` - RuleEngine evaluates activities against notification rules and determines priority levels

**content-scripts/** - Scripts injected into Strava dashboard:
- `feed-monitor.js` - FeedMonitor class scans dashboard every 30s, detects new activities, dispatches custom events
- `auto-kudos.js` - AutoKudos class listens for activity events, queues kudos with delays to mimic human behavior
- `ui-enhancer.js` - Minor UI improvements

**popup/** - Extension popup UI (quick toggles, stats, preset selector)

**options/** - Full settings page (rules, VIP athletes, notification provider configuration)

### Data Flow

1. **Activity Detection**: FeedMonitor scans DOM using `[data-testid="web-feed-entry"]` selector
2. **Parsing**: ActivityParser extracts metrics (distance, pace, elevation, time) from activity card DOM
3. **Evaluation**: RuleEngine evaluates against active preset rules + custom rules + VIP status
4. **Notification**: If significant, service worker sends notifications to all enabled providers (Pushover, Discord, Slack, Generic Webhook) that meet their minimum priority threshold
5. **Auto-Kudos**: If enabled, AutoKudos clicks kudos button with delay (2s default + random jitter)

### Key Concepts

**Processed Activities**: Extension tracks processed activity IDs in storage to avoid duplicate kudos. Storage is cleaned every 7 days.

**Notification Presets**: Pre-configured rule sets (PRs only, impressive efforts, epic adventures, everything) stored in `StorageManager.PRESETS`.

**VIP Athletes**: Athletes who always trigger notifications regardless of rules. Matched by athlete ID or name.

**Priority Levels**:
- Critical (4): Century rides, marathons, extreme elevation
- High (3): 50+ mile rides, half marathons, fast paces
- Medium (2): Moderate achievements
- Low (1): All activities

**Group Activities**: Extension extracts all participants from group activities but currently only gives kudos to the first participant.

## Important Implementation Details

### DOM Parsing Reliability

The extension relies on Strava's DOM structure. Key selectors:
- Feed entries: `[data-testid="web-feed-entry"]`
- Activity links: `a[href*="/activities/"]`
- Athlete links: `a[href*="/athletes/"]`
- Kudos buttons: `button[data-testid="kudos_button"]`

Changes to Strava's HTML may break parsing. Always test after Strava updates.

### Challenge Filtering

The `isChallenge()` method in FeedMonitor filters out challenge announcements that appear in the feed. A true challenge has NO activity link. Activities with "challenge" in the text but WITH activity links are real activities (e.g., activity that completed a challenge).

### Rate Limiting

Auto-kudos includes:
- Daily limit (default 100)
- Delay between kudos (default 2000ms + random jitter)
- Queue processing to prevent concurrent kudos

This mimics human behavior to avoid Strava rate limiting.

### Storage Structure

All data stored in `chrome.storage.local` under a single `settings` key containing:
```javascript
{
  autoKudos: { enabled, onlySignificant, excludedAthletes, dailyLimit, delayMs },
  notifications: {
    enabled,
    preset,
    customRules,
    providers: {
      pushover: { enabled, minPriority, userKey, appToken },
      discord: { enabled, minPriority, webhookUrl },
      slack: { enabled, minPriority, webhookUrl },
      genericWebhook: { enabled, minPriority, url, method, headers }
    }
  },
  autoRefresh: { enabled, intervalMinutes },
  vipAthletes: [...],
  processedActivities: [{ id, timestamp }, ...],
  stats: { totalKudos, totalNotifications, lastReset }
}
```

### Event Communication

Content scripts communicate via:
- Custom DOM events: `stravaActivityDetected` dispatched when new activity found
- Chrome runtime messages: `showNotification`, `getSettings`, `updateSettings`

### Notification Providers

The extension supports multiple notification providers that can be enabled simultaneously. Each provider has its own minimum priority threshold, allowing fine-grained control over which activities trigger notifications to which services.

**Multiple Provider Support**:
- Users can enable multiple providers at once (e.g., Discord + Pushover + Slack)
- Each provider independently checks if the activity priority meets its minimum threshold
- Notifications are sent in parallel using `Promise.allSettled()` to prevent one failure from blocking others
- Priority comparison: low (1) < medium (2) < high (3) < critical (4)

**Available Providers**:

1. **Pushover** - Mobile push notifications ($5 one-time purchase per platform)
   - Configuration: userKey, appToken, minPriority
   - Priority mapping: low/medium → 0 (normal), high → 1 (high priority), critical → 2 (emergency, requires acknowledgment)
   - Notifications include clickable activity URL

2. **Discord** - Rich embeds to Discord channels via webhooks
   - Configuration: webhookUrl, minPriority
   - Rich formatting with color-coded embeds: blue (low), yellow (medium), orange (high), red (critical)
   - Includes activity emoji indicators: 🎯 (low/medium), ⚡ (high), 🔥 (critical)
   - Clickable embed title links to activity

3. **Slack** - Formatted messages to Slack channels via webhooks
   - Configuration: webhookUrl, minPriority
   - Color-coded attachments matching Discord's scheme
   - Emoji indicators in title: :dart:, :zap:, :fire:
   - Clickable title links to activity

4. **Generic Webhook** - POST JSON to any custom endpoint
   - Configuration: url, method (POST/PUT/PATCH), minPriority, headers
   - Standard JSON payload format:
     ```json
     {
       "title": "Activity Title",
       "message": "Activity details",
       "priority": "high",
       "activityId": "12345",
       "activityUrl": "https://strava.com/activities/12345",
       "timestamp": "2024-01-01T00:00:00.000Z"
     }
     ```
   - Useful for custom integrations, IFTTT, Zapier, n8n, etc.

**Provider Migration**:
- Old Pushover-only configurations are automatically migrated to the new `providers` structure
- Migration happens in `StorageManager.migrateNotificationSettings()` on first load
- Original Pushover settings are preserved and moved to `notifications.providers.pushover`

## Testing Changes

1. Make code changes in `strava-extension/` directory
2. Go to chrome://extensions/ and reload the extension
3. Refresh Strava dashboard (https://www.strava.com/dashboard)
4. Open Chrome DevTools console to view logs
5. Verify behavior by watching for new activities in feed

## Common Pitfalls

- **Don't forget to reload extension** after code changes (not just refresh page)
- **Content script changes require both** extension reload AND page refresh
- **Background script logs** appear in extension service worker console (chrome://extensions/ → "Service Worker" link), not page console
- **DOM selectors may break** if Strava updates their HTML structure
- **Duplicate kudos prevention** relies on storage, so clearing storage will cause re-processing
- **Group activities** currently only kudos the first participant (known limitation)

## File Naming Conventions

Files with `-backup` or `-clean` suffixes are development iterations. The active files have no suffix:
- `feed-monitor.js` (active)
- `auto-kudos.js` (active)
- NOT `feed-monitor-backup.js` or `auto-kudos-clean.js`
