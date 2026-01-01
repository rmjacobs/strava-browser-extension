# Strava Activity Notifier & Auto-Kudos Extension

A Chrome browser extension that automatically gives kudos to activities from athletes you follow and sends push notifications about significant activities to your phone.

**Key Features:**
- 🎯 Auto-kudos with smart filtering
- 📱 Push notifications via Pushover (clickable activity links)
- 📋 Review Queue for batch activity review
- ⭐ VIP athlete tracking (get notified for ALL their activities)
- 🎨 Flexible rule engine with presets
- 📊 Activity stats and analytics

## Features

### 🎯 Auto-Kudos
- **Automatically give kudos** to activities from athletes you follow
- **Smart filtering**: Option to only kudos significant activities based on notification rules
- **Rate limiting**: Set daily kudos limits to appear more human-like
- **Customizable delays**: Configure delays between kudos (500ms-10s)
- **Exclude athletes**: Add specific athletes to an exclusion list
- **Group activity support**: Handles activities with multiple participants

### 🔔 Smart Notifications
- **Push notifications**: Pushover integration for phone notifications with clickable activity links
- **Priority system**: 4-level priority system (Low, Medium, High, Critical)
- **Custom rules**: Create your own notification rules based on activity metrics
- **Preset templates**: Choose from pre-built notification presets with detailed rule information
- **VIP athletes**: Get notified about ALL activities from specific athletes (any activity type)
- **Enhanced formatting**: Notifications include athlete name, activity type, stats, and direct links

### 📋 Review Queue
- **Batch review workflow**: Significant activities collected in a dedicated review queue
- **Priority filtering**: Filter by Critical, High, Medium, or All priorities
- **Select all**: Quickly mark multiple activities as reviewed
- **Export to markdown**: Download queue as a formatted markdown file
- **Activity stats**: View distance, speed/pace, elevation, and comment count
- **Direct links**: One-click access to activities on Strava
- **VIP badges**: Easily identify activities from VIP athletes

### 🔄 Auto-Refresh
- **Automatic dashboard refresh**: Configurable interval (1-60 minutes)
- **Background monitoring**: Extension checks for new activities even when tab is not active
- **Seamless updates**: Feed updates without interrupting your browsing

### ⚙️ Flexible Configuration
- **Notification presets**:
  - Don't Miss PRs: Only personal records
  - Impressive Efforts: Notable achievements (50+ mi rides, fast paces)
  - Epic Adventures: Century rides, marathons, huge climbs
  - Everything: All activities
- **Custom rules**: Build rules based on:
  - Activity type (Ride, VirtualRide, Run, Swim, Walk, Hike, or Any)
  - Distance, Speed, Pace, Elevation, Moving Time
  - Comment count (catch activities with high engagement)
  - Personal records (PR badge detection)
  - Custom thresholds and operators (>, >=, <, <=, =)
- **VIP athletes**: Guaranteed notifications for specific athletes regardless of activity details
- **Virtual ride detection**: Automatically detects indoor training (Zwift, Rouvy, etc.)

## Installation

### From Source
1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked"
5. Select the `strava-extension` folder
6. The extension icon should appear in your toolbar

### First-Time Setup
1. Click the extension icon to open the popup
2. Click "⚙️ Settings" to configure
3. Enable Auto-Kudos if you want automatic kudos
4. Enable Notifications and configure your preset (or create custom rules)
5. **Set up Pushover** for phone notifications (required for notifications to work)
   - Create account at pushover.net
   - Purchase Pushover app ($5 one-time)
   - Add your User Key and App Token in settings
6. (Optional) Add VIP athletes for guaranteed notifications
7. Save your settings and return to Strava dashboard

**Alternative to notifications:** If you don't want to use Pushover, you can still use the **Review Queue** feature - it collects significant activities for batch review without sending notifications.

## Usage

### Basic Operation
1. Navigate to your [Strava Dashboard](https://www.strava.com/dashboard)
2. The extension automatically monitors your feed
3. New activities are detected every 30 seconds
4. Kudos are given automatically based on your settings
5. Push notifications sent to your phone for significant activities (if Pushover configured)
6. Significant activities collected in Review Queue for batch review

### Quick Controls (Popup)
Click the extension icon to access:
- **Quick toggles**: Turn auto-kudos and notifications on/off
- **Today's stats**: View kudos given and notifications sent
- **Preset selector**: Quick switch between notification presets
- **Review Queue**: Access your activity review queue (shows count badge)
- **Settings link**: Access full configuration
- **Open Strava**: Quick link to Strava dashboard

### Full Settings (Options Page)
Right-click the extension icon → "Options" or click "⚙️ Settings" in popup to access:
- Complete auto-kudos configuration
- Notification settings and rules
- Pushover integration
- VIP athlete management
- Statistics and diagnostics

## Configuration Guide

### Auto-Kudos Settings

| Setting | Description | Default |
|---------|-------------|---------|
| Enable Auto-Kudos | Master switch for auto-kudos feature | ✅ On |
| Only Kudos Significant | Only kudos activities matching notification rules | ❌ Off |
| Daily Limit | Maximum kudos per day (1-500) | 100 |
| Delay | Milliseconds between kudos (500-10000) | 2000 |

### Notification Settings

| Setting | Description | Default |
|---------|-------------|---------|
| Enable Notifications | Master switch for notifications | ✅ On |
| Preset | Pre-configured notification rules | Impressive Efforts |
| Custom Rules | Add your own notification rules | (empty) |
| VIP Athletes | Athletes who trigger notifications for all activities | (empty) |

### Pushover Integration

Pushover enables push notifications to your phone ($5 one-time per platform).

**Setup Steps:**
1. Create account at [pushover.net](https://pushover.net)
2. Purchase Pushover app for your platform (iOS/Android)
3. Copy your User Key from pushover.net after login
4. Create an application at [pushover.net/apps/build](https://pushover.net/apps/build)
5. Copy the Application Token
6. Paste both keys into extension settings
7. Set minimum priority threshold (recommended: High)
8. Click "Test Pushover" to verify

**Notification Features:**
- **Athlete name in title**: Quickly identify who posted (e.g., "⚡ Rebecca Jacobs")
- **Activity stats in message**: Distance, speed/pace, elevation, PR badges
- **Clickable links**: Tap notification to open activity directly on Strava
- **Multi-line formatting**: Optimized for mobile readability

**Priority Levels:**
- **Low**: All significant activities → Pushover priority 0 (normal)
- **Medium**: Medium+ activities → Pushover priority 0 (normal)
- **High** (recommended): High+ activities → Pushover priority 1 (high priority sound)
- **Critical**: Only critical activities → Pushover priority 2 (emergency, requires acknowledgment)

### Auto-Refresh Settings

| Setting | Description | Recommended |
|---------|-------------|-------------|
| Enable Auto-Refresh | Automatically refresh dashboard | ✅ On |
| Interval | Minutes between refreshes (1-60) | 5-10 minutes |

**Note**: Auto-refresh helps ensure you never miss activities, especially when the dashboard is open in a background tab.

## Creating Custom Rules

### Rule Structure
Each rule consists of:
1. **Activity Type**: Any, Ride, VirtualRide, Run, Swim, Walk, Hike, or Has PR Badge
2. **Condition** (optional): Distance, Speed, Pace, Elevation, Moving Time, or Comments
3. **Operator**: >, >=, <, <=, =
4. **Value**: Numeric threshold
5. **Unit**: Appropriate unit for the condition
6. **Priority**: Critical, High, Medium, or Low

### Special Rule Types
- **Has PR Badge**: Matches any activity with a personal record
- **VIP Only**: Automatically added when VIP athletes are configured (matches ALL their activities)

### Example Rules

**Century Ride Alert (Critical Priority)**
- Type: Ride
- Condition: Distance > 100 miles
- Priority: Critical

**Fast Marathon (High Priority)**
- Type: Run
- Condition: Distance >= 26.2 miles AND Pace < 7:00 min/mile
- Priority: High

**Big Climb (Medium Priority)**
- Type: Any
- Condition: Elevation > 5000 feet
- Priority: Medium

**High Engagement (Medium Priority)**
- Type: Any
- Condition: Comments > 5
- Priority: Medium
- *Catches activities that are generating discussion*

**Virtual Century (High Priority)**
- Type: VirtualRide
- Condition: Distance > 100 km
- Priority: High
- *Zwift/Rouvy century rides*

**Personal Records (High Priority)**
- Type: Has PR Badge
- Priority: High
- *Don't miss any PRs*

## VIP Athletes

**Add VIP Athletes** to receive notifications for ALL their activities regardless of type or metrics:
1. Enter athlete name in "VIP Athletes" section
2. (Optional) Add their Strava athlete ID for more accurate matching
3. Click "Add VIP"
4. VIP activities automatically receive High priority

**Key Features:**
- **Guaranteed notifications**: VIP athletes trigger notifications for ANY activity type (Ride, Run, Walk, Weight Training, etc.)
- **Bypasses all rules**: No conditions needed - if a VIP posts, you're notified
- **Works with Review Queue**: VIP activities appear in queue with ⭐ VIP badge
- **ID or name matching**: Matches by athlete ID (most reliable) or name (case-insensitive)

**Finding Athlete ID:**
- Visit athlete's Strava profile
- Look at URL: `strava.com/athletes/[ID]`
- Example: `strava.com/athletes/12345678` → ID is `12345678`

## Review Queue

The **Review Queue** collects significant activities for batch review, perfect for commenting on multiple activities at once.

**Features:**
- **Automatic collection**: Significant activities are automatically added to the queue
- **Priority filtering**: Filter by Critical, High, Medium, or view All
- **Batch management**: Select all activities matching current filter
- **Mark as reviewed**: Check off activities you've handled
- **Export to markdown**: Download queue for external tracking
- **Direct links**: Click "View Activity" to open on Strava
- **Activity details**: See distance, speed/pace, elevation, and comment count

**Workflow:**
1. Significant activities appear in queue automatically
2. Click extension icon → "📋 Review Queue" (badge shows unreviewed count)
3. Review activities, click links to comment
4. Check off activities you've reviewed
5. Click "🗑️ Clear Reviewed" to remove completed items
6. Export queue as markdown for record-keeping

**Use Cases:**
- Comment on multiple impressive activities at once
- Keep track of VIP athlete activities
- Don't miss activities with high engagement (many comments)
- Review daily/weekly achievements in batch

## Notification Flow

```
Activity Posted → Feed Monitor Detects → Parse Details → Evaluate Rules
                                                              ↓
                                          ┌──────────────────┴──────────────────┐
                                          ↓                                     ↓
                                    Not Significant                      Significant!
                                          ↓                                     ↓
                                    No Action                        Determine Priority
                                                                              ↓
                                          ┌───────────────────────────────────┤
                                          ↓                                   ↓
                                    Auto-Kudos                        Notifications
                                    (if enabled)                      (if enabled)
                                          ↓                                   ↓
                                    Give Kudos                    ┌───────────┴──────────┐
                                                                  ↓                      ↓
                                                           Pushover (Phone)      Review Queue
                                                                                         ↓
                                                                                  Store for Batch
                                                                                     Review
```

## Technical Details

### Architecture

**Manifest Version**: 3 (Latest Chrome Extension API)

**Components:**
- `manifest.json`: Extension configuration and permissions
- `background/service-worker.js`: Background processing and alarms
- `content-scripts/`: Scripts that run on Strava pages
  - `feed-monitor.js`: Monitors dashboard for new activities
  - `auto-kudos.js`: Handles automatic kudos
  - `ui-enhancer.js`: UI improvements
- `utils/`: Shared utilities
  - `storage.js`: Chrome storage wrapper
  - `activity-parser.js`: Extracts activity data from DOM
  - `rule-engine.js`: Evaluates activities against rules
- `popup/`: Extension popup UI
- `options/`: Settings page UI

### Permissions

| Permission | Purpose |
|------------|---------|
| `storage` | Store settings and processed activities |
| `notifications` | Show desktop notifications |
| `alarms` | Schedule periodic tasks (cleanup, auto-refresh) |
| `https://www.strava.com/*` | Access Strava dashboard and give kudos |
| `https://api.pushover.net/*` | Send push notifications via Pushover |

### Data Storage

All data is stored locally using Chrome's `chrome.storage.local` API:
- Settings and configuration
- List of processed activities (last 1000, prevents duplicate kudos)
- VIP athlete list (stored with IDs and names)
- Custom notification rules
- Review queue (last 100 significant activities)
- Statistics and usage metrics

**No data is sent to external servers** except:
- Pushover API (only if enabled and configured for notifications)
- Strava.com (to give kudos and fetch activity data)

**Privacy:**
- No analytics or tracking
- No data shared with third parties
- All settings and data remain on your device
- Open source code for transparency

## Performance & Privacy

### Performance
- **Lightweight**: Minimal CPU and memory usage
- **Efficient scanning**: Only scans visible activities
- **Rate limiting**: Delays between kudos prevent spam detection
- **Smart caching**: Tracks processed activities to avoid duplicates

### Privacy
- **No analytics**: Extension does not collect or transmit usage data
- **Local storage**: All settings and data stored locally on your device
- **No tracking**: Extension does not track your browsing
- **Open source**: Code is available for inspection

## Troubleshooting

### Extension Not Working

**Check these items:**
1. Extension is enabled at `chrome://extensions/`
2. You're logged into Strava
3. You're on the dashboard page (`strava.com/dashboard`)
4. Open browser console (F12) and look for `[Feed Monitor]` logs

### No Kudos Being Given

**Common causes:**
1. Auto-kudos is disabled in settings
2. Daily limit reached
3. Activities already have kudos from you
4. Athletes are on exclusion list
5. "Only kudos significant" is enabled but activities don't match rules

**Debug steps:**
1. Open console (F12) on Strava dashboard
2. Look for `[Auto-Kudos]` messages
3. Check for errors or "already has kudos" messages

### No Notifications Appearing

**Common causes:**
1. Notifications disabled in extension settings
2. Pushover not configured or disabled
3. Activities don't match your notification rules
4. Notification priority below Pushover minimum threshold
5. Pushover credentials invalid

**Debug steps:**
1. Verify Pushover is enabled and configured correctly
2. Click "Test Pushover" button in settings
3. Test with "Everything" preset to see if rules are the issue
4. Review console logs for `[RuleEngine]` messages showing rule evaluation
5. Check if activities are being detected (`[Feed Monitor]` logs)

### Pushover Not Working

**Checklist:**
- [ ] Pushover is enabled in settings
- [ ] User Key is correct (30 characters)
- [ ] App Token is correct (30 characters)
- [ ] Activity priority meets minimum threshold
- [ ] You have the Pushover app installed on your phone
- [ ] Click "Test Pushover" button to verify connection

**Test notification:** Click the test button in settings. You should see a test notification on your phone within seconds.

### Activities Being Processed Multiple Times

**Solution:** Clear processed activities:
1. Method 1: Remove and re-add extension at `chrome://extensions/`
2. Method 2: Run `clear-storage.js` script from console
3. Method 3: Reset statistics in settings (preserves settings)

## Development

### File Structure
```
strava-extension/
├── manifest.json           # Extension manifest
├── background/
│   └── service-worker.js   # Background service worker
├── content-scripts/
│   ├── feed-monitor.js     # Activity detection
│   ├── auto-kudos.js       # Auto-kudos logic
│   ├── ui-enhancer.js      # UI improvements
│   └── styles.css          # Injected styles
├── utils/
│   ├── storage.js          # Storage utilities
│   ├── activity-parser.js  # Activity parsing
│   └── rule-engine.js      # Rule evaluation
├── popup/
│   ├── popup.html          # Popup UI
│   ├── popup.js            # Popup logic
│   └── popup.css           # Popup styles
├── options/
│   ├── options.html        # Settings page
│   ├── options.js          # Settings logic
│   └── options.css         # Settings styles
├── review-queue/
│   ├── review-queue.html   # Review queue page
│   ├── review-queue.js     # Review queue logic
│   └── review-queue.css    # Review queue styles
└── icons/
    ├── icon16.png          # 16x16 icon
    ├── icon48.png          # 48x48 icon
    └── icon128.png         # 128x128 icon
```

### Debugging

**Enable verbose logging:**
1. Open console (F12) on Strava dashboard
2. Look for messages prefixed with:
   - `[Feed Monitor]`: Activity detection
   - `[Auto-Kudos]`: Kudos processing
   - `[Service Worker]`: Background tasks
   - `[RuleEngine]`: Rule evaluation, VIP matching, activity significance
   - `[StorageManager]`: Rule loading, VIP configuration
   - `[ActivityParser]`: DOM parsing, activity data extraction

**Debug scripts provided:**
- `debug-extension.js`: Puppeteer-based debugging
- `monitor-console.js`: Console monitoring
- `clear-storage.js`: Clear stored data
- `debug-notifications.js`: Test notifications

### Testing Changes
1. Make code changes
2. Go to `chrome://extensions/`
3. Click reload icon for the extension
4. Refresh Strava dashboard
5. Check console for errors

## Version History

### v1.0.0 - Current Release
**Core Features:**
- ✅ Auto-kudos functionality with rate limiting
- ✅ Pushover integration with clickable activity links
- ✅ Custom rules engine with priority system
- ✅ VIP athletes (guaranteed notifications for all activity types)
- ✅ Auto-refresh dashboard
- ✅ Statistics tracking
- ✅ Preset templates with detailed rule information

**Recent Enhancements:**
- ✅ Review Queue for batch activity review
- ✅ Comment count condition for notification rules
- ✅ Virtual ride detection (Zwift, Rouvy, etc.)
- ✅ Group activity support with multiple participant parsing
- ✅ Enhanced Pushover notifications (athlete names, stats, links)
- ✅ Select all functionality in Review Queue
- ✅ Export queue to markdown
- ✅ Improved activity title parsing
- ✅ VIP matching by ID or name

## Known Limitations

1. **Feed-based detection**: Only detects activities visible in your dashboard feed (not historical activities)
2. **Strava API**: Extension does not use official Strava API (relies on DOM parsing, subject to Strava UI changes)
3. **Rate limits**: Excessive kudos may trigger Strava's rate limiting (use reasonable daily limits)
4. **Browser-only**: Requires Strava dashboard to be open in Chrome to monitor activities
5. **Virtual ride detection**: May occasionally misclassify outdoor rides as virtual or vice versa

## Future Enhancements

Potential features for future versions:
- [ ] Activity comments automation with templates
- [ ] More notification channels (Slack, Discord, Email, Telegram)
- [ ] Weekly/monthly digest reports and analytics
- [ ] Export statistics to CSV
- [ ] Club activity monitoring
- [ ] Segment leader notifications
- [ ] AI-powered comment suggestions
- [ ] Multi-kudos for group activities (all participants at once)
- [ ] Integration with training platforms (TrainingPeaks, etc.)
- [ ] Custom notification sounds per priority level

## FAQ

**Q: Is this extension safe?**
A: Yes. The extension only accesses Strava pages you visit and stores data locally. Code is available for inspection.

**Q: Will Strava ban me for using this?**
A: The extension mimics human behavior with delays and rate limits. Use reasonable settings (don't kudos 500 activities per day).

**Q: Do I need Pushover?**
A: Yes, if you want notifications. The extension uses Pushover for push notifications to your phone. Desktop browser notifications have been removed in favor of the superior mobile experience.

**Q: Can I get notifications without Pushover?**
A: Not currently. However, the Review Queue feature can serve as an alternative - it collects significant activities for you to review in batch without notifications.

**Q: Can I use this on Firefox or Safari?**
A: Not yet. Currently Chrome/Edge only (Manifest V3). Firefox support may come in future.

**Q: Does this work on mobile?**
A: No. Chrome extensions only work on desktop browsers. However, you'll receive Pushover notifications on your mobile device.

**Q: How much does Pushover cost?**
A: $5 one-time purchase per platform (iOS/Android). No subscription. Well worth it for reliable notifications.

**Q: Can I kudos activities older than what's in my feed?**
A: No. Extension only processes activities visible in your dashboard feed.

**Q: Will this drain my battery?**
A: No significant impact. Extension only runs when Strava dashboard is open in your browser.

**Q: How does the Review Queue work?**
A: The Review Queue automatically collects significant activities based on your rules. Access it from the popup to review, comment on, and mark activities as handled. Think of it as a notification inbox for activities.

**Q: What's the difference between a VIP athlete and a custom rule?**
A: VIP athletes trigger notifications for EVERY activity they post (walks, weight training, everything). Custom rules only trigger when specific conditions are met (distance, speed, etc.).

## Support

For issues, questions, or feature requests:
1. Check the troubleshooting section above
2. Review console logs for error messages
3. Check Chrome extension logs at `chrome://extensions/`

## License

This project is provided as-is for personal use. See LICENSE file for details.

## Credits

Built with ❤️ for the Strava community.

**Technologies:**
- Chrome Extension Manifest V3
- Vanilla JavaScript (no frameworks)
- Chrome Storage API
- Chrome Notifications API
- Chrome Alarms API
- Pushover API

---

*Happy riding! 🚴*
