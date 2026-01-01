// Popup script
const PRESET_INFO = {
  'prs-only': {
    description: "Only notify on personal records",
    details: ["High priority for any activity with a PR badge"]
  },
  'impressive-efforts': {
    description: "Long distances or fast paces",
    details: [
      "Rides: >50 mi or >20 mph",
      "Runs: >13.1 mi or <7 min/mile pace",
      "Any: >5,000 ft elevation"
    ]
  },
  'epic-adventures': {
    description: "Extreme distances and elevation",
    details: [
      "Rides: >100 miles",
      "Runs: >26.2 miles (marathon+)",
      "Any: >10,000 ft elevation gain"
    ]
  },
  'everything': {
    description: "All activities from followed athletes",
    details: ["Low priority notification for every activity"]
  }
};

document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  await loadStats();
  await loadQueueCount();
  setupEventListeners();
  updatePresetDescription();
});

async function loadSettings() {
  const result = await chrome.storage.local.get('settings');
  const settings = result.settings;
  
  if (settings) {
    // Set toggles
    document.getElementById('autoKudosToggle').checked = settings.autoKudos.enabled;
    document.getElementById('notificationsToggle').checked = settings.notifications.enabled;
    
    // Set preset
    document.getElementById('presetSelect').value = settings.notifications.preset;
  }
}

async function loadStats() {
  // Load daily kudos count
  const dailyData = await chrome.storage.local.get(['dailyKudosCount']);
  const kudosCount = dailyData.dailyKudosCount || 0;
  document.getElementById('kudosCount').textContent = kudosCount;

  // Load settings for total notifications (approximate)
  const result = await chrome.storage.local.get('settings');
  const settings = result.settings;

  if (settings && settings.stats) {
    // Show notification count (we don't track daily, so show total)
    document.getElementById('notificationCount').textContent = settings.stats.totalNotifications;
  }
}

async function loadQueueCount() {
  const count = await StorageManager.getReviewQueueCount();
  const badge = document.getElementById('queueCountBadge');

  if (count > 0) {
    badge.textContent = count;
  } else {
    badge.textContent = '';
  }
}

function setupEventListeners() {
  // Auto-kudos toggle
  document.getElementById('autoKudosToggle').addEventListener('change', async (e) => {
    const result = await chrome.storage.local.get('settings');
    const settings = result.settings;
    settings.autoKudos.enabled = e.target.checked;
    await chrome.storage.local.set({ settings });
    showToast(e.target.checked ? 'Auto-kudos enabled' : 'Auto-kudos disabled');
  });
  
  // Notifications toggle
  document.getElementById('notificationsToggle').addEventListener('change', async (e) => {
    const result = await chrome.storage.local.get('settings');
    const settings = result.settings;
    settings.notifications.enabled = e.target.checked;
    await chrome.storage.local.set({ settings });
    showToast(e.target.checked ? 'Notifications enabled' : 'Notifications disabled');
  });
  
  // Preset select
  document.getElementById('presetSelect').addEventListener('change', async (e) => {
    const result = await chrome.storage.local.get('settings');
    const settings = result.settings;
    settings.notifications.preset = e.target.value;
    await chrome.storage.local.set({ settings });

    const presetNames = {
      'prs-only': "Don't Miss PRs",
      'impressive-efforts': "Impressive Efforts",
      'epic-adventures': "Epic Adventures",
      'everything': "Everything"
    };
    showToast(`Preset: ${presetNames[e.target.value]}`);
    updatePresetDescription();
  });
  
  // Open Review Queue
  document.getElementById('openReviewQueue').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('review-queue/review-queue.html') });
    window.close();
  });

  // Open options
  document.getElementById('openOptions').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  // Open Strava
  document.getElementById('openStrava').addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://www.strava.com/dashboard' });
    window.close();
  });
}

function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('show');
  }, 10);

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 2000);
}

function updatePresetDescription() {
  const presetSelect = document.getElementById('presetSelect');
  const descriptionDiv = document.getElementById('presetDescription');
  const selectedPreset = presetSelect.value;

  if (!selectedPreset || !PRESET_INFO[selectedPreset]) {
    descriptionDiv.innerHTML = '';
    return;
  }

  const info = PRESET_INFO[selectedPreset];
  const detailsList = info.details.map(detail => `<li>${detail}</li>`).join('');

  descriptionDiv.innerHTML = `
    <strong>${info.description}</strong>
    <ul>${detailsList}</ul>
  `;
}
