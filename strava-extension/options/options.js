// Options page script
let currentSettings = null;
let editingRuleIndex = null; // Track which rule is being edited (null = adding new)
let editingVipIndex = null; // Track which VIP is being edited (null = adding new)

const PRESETS = {
  'prs-only': {
    name: "Don't Miss PRs",
    description: "Only notify on personal records",
    icon: '🏆',
    rules: [
      { type: 'has-pr-badge', priority: 'high' }
    ]
  },
  'impressive-efforts': {
    name: "Impressive Efforts",
    description: "Long distances or fast paces",
    icon: '⚡',
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
    icon: '🔥',
    rules: [
      { type: 'ride', condition: 'distance', operator: '>', value: 100, unit: 'miles', priority: 'critical' },
      { type: 'run', condition: 'distance', operator: '>', value: 26.2, unit: 'miles', priority: 'critical' },
      { type: 'any', condition: 'elevation', operator: '>', value: 10000, unit: 'feet', priority: 'critical' }
    ]
  },
  'everything': {
    name: "Everything",
    description: "All activities from followed athletes",
    icon: '📢',
    rules: [
      { type: 'any', priority: 'low' }
    ]
  }
};

document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  renderPresets();
  renderCustomRules();
  renderVipList();
  updateStats();
  setupEventListeners();
});

async function loadSettings() {
  const result = await chrome.storage.local.get('settings');
  currentSettings = result.settings || getDefaultSettings();
  
  // Populate form fields
  document.getElementById('autoKudosEnabled').checked = currentSettings.autoKudos.enabled;
  document.getElementById('onlySignificant').checked = currentSettings.autoKudos.onlySignificant;
  document.getElementById('dailyLimit').value = currentSettings.autoKudos.dailyLimit;
  document.getElementById('delayMs').value = currentSettings.autoKudos.delayMs;

  document.getElementById('notificationsEnabled').checked = currentSettings.notifications.enabled;
  
  // Pushover settings
  if (currentSettings.notifications.pushover) {
    document.getElementById('pushoverEnabled').checked = currentSettings.notifications.pushover.enabled;
    document.getElementById('pushoverUserKey').value = currentSettings.notifications.pushover.userKey || '';
    document.getElementById('pushoverAppToken').value = currentSettings.notifications.pushover.appToken || '';
    document.getElementById('pushoverMinPriority').value = currentSettings.notifications.pushover.minPriority || 'high';
    togglePushoverSettings();
  }
  
  // Auto-refresh settings
  if (currentSettings.autoRefresh) {
    document.getElementById('autoRefreshEnabled').checked = currentSettings.autoRefresh.enabled || false;
    document.getElementById('autoRefreshInterval').value = currentSettings.autoRefresh.intervalMinutes || 5;
    toggleAutoRefreshSettings();
  }
}

function getDefaultSettings() {
  return {
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
}

function renderPresets() {
  const grid = document.getElementById('presetGrid');
  grid.innerHTML = '';

  for (const [key, preset] of Object.entries(PRESETS)) {
    const card = document.createElement('div');
    card.className = 'preset-card';
    if (currentSettings.notifications.preset === key) {
      card.classList.add('active');
    }

    card.innerHTML = `
      <div class="preset-icon">${preset.icon}</div>
      <h3>${preset.name}</h3>
      <p>${preset.description}</p>
      <div class="preset-rules-count">${preset.rules.length} rule${preset.rules.length !== 1 ? 's' : ''}</div>
    `;

    card.addEventListener('click', () => {
      document.querySelectorAll('.preset-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      currentSettings.notifications.preset = key;
      renderPresetRulesDetail(key);
    });

    grid.appendChild(card);
  }

  // Show rules for currently active preset
  if (currentSettings.notifications.preset) {
    renderPresetRulesDetail(currentSettings.notifications.preset);
  }
}

function renderPresetRulesDetail(presetKey) {
  const preset = PRESETS[presetKey];
  if (!preset) return;

  const detailSection = document.getElementById('presetRulesDetail');
  const rulesList = document.getElementById('presetRulesList');

  rulesList.innerHTML = '';

  preset.rules.forEach((rule, index) => {
    const ruleCard = document.createElement('div');
    ruleCard.className = 'rule-card';
    ruleCard.style.marginBottom = '12px';

    const summary = formatRuleSummary(rule);
    const priorityColor = getPriorityColor(rule.priority);

    ruleCard.innerHTML = `
      <div class="rule-content">
        <div class="rule-priority" style="background-color: ${priorityColor}"></div>
        <div class="rule-summary">${summary}</div>
      </div>
    `;

    rulesList.appendChild(ruleCard);
  });

  detailSection.style.display = 'block';
}

function renderCustomRules() {
  const list = document.getElementById('customRulesList');
  list.innerHTML = '';
  
  if (currentSettings.notifications.customRules.length === 0) {
    list.innerHTML = '<p class="empty-state">No custom rules yet. Click "Add Custom Rule" to create one.</p>';
    return;
  }
  
  currentSettings.notifications.customRules.forEach((rule, index) => {
    const ruleCard = document.createElement('div');
    ruleCard.className = 'rule-card';
    
    const summary = formatRuleSummary(rule);
    const priorityColor = getPriorityColor(rule.priority);
    
    ruleCard.innerHTML = `
      <div class="rule-content">
        <div class="rule-priority" style="background-color: ${priorityColor}"></div>
        <div class="rule-summary">${summary}</div>
      </div>
      <div class="rule-actions">
        <button class="btn-icon edit-rule" data-index="${index}" title="Edit rule">✏️</button>
        <button class="btn-icon delete-rule" data-index="${index}" title="Delete rule">🗑️</button>
      </div>
    `;

    list.appendChild(ruleCard);
  });

  // Add edit listeners
  document.querySelectorAll('.edit-rule').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const index = parseInt(e.target.dataset.index);
      editRule(index);
    });
  });

  // Add delete listeners
  document.querySelectorAll('.delete-rule').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const index = parseInt(e.target.dataset.index);
      currentSettings.notifications.customRules.splice(index, 1);
      renderCustomRules();
    });
  });
}

function formatRuleSummary(rule) {
  let parts = [];

  // Activity type - handle virtual ride display
  let typeDisplay;
  if (rule.type === 'any') {
    typeDisplay = 'Any';
  } else if (rule.type === 'virtualride') {
    typeDisplay = 'Virtual Ride';
  } else {
    typeDisplay = rule.type.charAt(0).toUpperCase() + rule.type.slice(1);
  }
  parts.push(`<strong>${typeDisplay}</strong>`);
  
  // Condition
  if (rule.condition) {
    const conditionName = rule.condition.replace('-', ' ');
    parts.push(`${conditionName} ${rule.operator} ${rule.value} ${rule.unit}`);
  }
  
  // Priority
  const priorityEmoji = { critical: '🔥', high: '⚡', medium: '✨', low: '👍' };
  parts.push(`${priorityEmoji[rule.priority]} ${rule.priority}`);
  
  return parts.join(' • ');
}

function getPriorityColor(priority) {
  const colors = {
    critical: '#fc4c02',
    high: '#ff6b35',
    medium: '#f7931e',
    low: '#4a90e2'
  };
  return colors[priority] || '#999';
}

function renderVipList() {
  const list = document.getElementById('vipList');
  list.innerHTML = '';
  
  if (currentSettings.vipAthletes.length === 0) {
    list.innerHTML = '<p class="empty-state">No VIP athletes yet.</p>';
    return;
  }
  
  currentSettings.vipAthletes.forEach((vip, index) => {
    const vipCard = document.createElement('div');
    vipCard.className = 'vip-card';
    
    vipCard.innerHTML = `
      <div class="vip-info">
        <span class="vip-icon">⭐</span>
        <span class="vip-name">${vip.name}</span>
        ${vip.id ? `<span class="vip-id">ID: ${vip.id}</span>` : ''}
      </div>
      <div class="vip-actions">
        <button class="btn-icon edit-vip" data-index="${index}" title="Edit VIP">✏️</button>
        <button class="btn-icon delete-vip" data-index="${index}" title="Delete VIP">🗑️</button>
      </div>
    `;

    list.appendChild(vipCard);
  });

  // Add edit listeners
  document.querySelectorAll('.edit-vip').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const index = parseInt(e.target.dataset.index);
      editVip(index);
    });
  });

  // Add delete listeners
  document.querySelectorAll('.delete-vip').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const index = parseInt(e.target.dataset.index);
      currentSettings.vipAthletes.splice(index, 1);
      renderVipList();
    });
  });
}

function updateStats() {
  document.getElementById('totalKudos').textContent = currentSettings.stats.totalKudos.toLocaleString();
  document.getElementById('totalNotifications').textContent = currentSettings.stats.totalNotifications.toLocaleString();
  document.getElementById('activitiesProcessed').textContent = currentSettings.processedActivities.length.toLocaleString();
}

function setupEventListeners() {
  // Save button
  document.getElementById('saveBtn').addEventListener('click', saveSettings);
  
  // Add rule button
  document.getElementById('addRuleBtn').addEventListener('click', openRuleModal);
  
  // Add VIP button
  document.getElementById('addVipBtn').addEventListener('click', addVipAthlete);
  
  // Reset stats button
  document.getElementById('resetStatsBtn').addEventListener('click', resetStats);
  
  // Pushover toggle
  document.getElementById('pushoverEnabled').addEventListener('change', togglePushoverSettings);
  
  // Test Pushover button
  document.getElementById('testPushoverBtn').addEventListener('click', testPushover);
  
  // Auto-refresh toggle
  document.getElementById('autoRefreshEnabled').addEventListener('change', toggleAutoRefreshSettings);
  
  // Rule modal
  setupRuleModal();
}

function setupRuleModal() {
  const modal = document.getElementById('ruleModal');
  const closeBtn = modal.querySelector('.close');
  const cancelBtn = document.getElementById('cancelRuleBtn');
  const saveBtn = document.getElementById('saveRuleBtn');
  const conditionSelect = document.getElementById('ruleCondition');
  
  closeBtn.addEventListener('click', () => {
    modal.style.display = 'none';
  });
  
  cancelBtn.addEventListener('click', () => {
    modal.style.display = 'none';
  });
  
  saveBtn.addEventListener('click', saveCustomRule);
  
  // Show/hide condition inputs
  conditionSelect.addEventListener('change', (e) => {
    const conditionInputs = document.getElementById('conditionInputs');
    const unitSelect = document.getElementById('ruleUnit');
    
    if (e.target.value) {
      conditionInputs.style.display = 'block';
      
      // Update unit options based on condition
      updateUnitOptions(e.target.value, unitSelect);
    } else {
      conditionInputs.style.display = 'none';
    }
  });
  
  // Close modal when clicking outside
  window.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.style.display = 'none';
    }
  });
}

function updateUnitOptions(condition, unitSelect) {
  const units = {
    distance: ['miles', 'km'],
    speed: ['mph', 'kph'],
    pace: ['min/mile', 'min/km'],
    elevation: ['feet', 'meters'],
    'moving-time': ['minutes', 'hours'],
    comments: ['comments']
  };

  unitSelect.innerHTML = '';
  (units[condition] || []).forEach(unit => {
    const option = document.createElement('option');
    option.value = unit;
    option.textContent = unit;
    unitSelect.appendChild(option);
  });
}

function openRuleModal() {
  const modal = document.getElementById('ruleModal');
  modal.style.display = 'flex';

  // Reset editing state
  editingRuleIndex = null;

  // Reset form
  document.getElementById('ruleType').value = 'any';
  document.getElementById('ruleCondition').value = '';
  document.getElementById('ruleOperator').value = '>';
  document.getElementById('ruleValue').value = '';
  document.getElementById('rulePriority').value = 'medium';
  document.getElementById('conditionInputs').style.display = 'none';

  // Update modal title
  document.querySelector('#ruleModal .modal-header h2').textContent = 'Add Custom Rule';
}

function editRule(index) {
  const rule = currentSettings.notifications.customRules[index];
  editingRuleIndex = index;

  const modal = document.getElementById('ruleModal');
  modal.style.display = 'flex';

  // Populate form with existing rule data
  document.getElementById('ruleType').value = rule.type;
  document.getElementById('rulePriority').value = rule.priority;

  if (rule.condition) {
    // Set condition first
    document.getElementById('ruleCondition').value = rule.condition;
    document.getElementById('conditionInputs').style.display = 'block';

    // Update unit options based on condition (this repopulates the dropdown)
    const unitSelect = document.getElementById('ruleUnit');
    updateUnitOptions(rule.condition, unitSelect);

    // NOW set the operator, value, and unit after dropdown is repopulated
    document.getElementById('ruleOperator').value = rule.operator;
    document.getElementById('ruleValue').value = rule.value;
    document.getElementById('ruleUnit').value = rule.unit;
  } else {
    document.getElementById('ruleCondition').value = '';
    document.getElementById('conditionInputs').style.display = 'none';
  }

  // Update modal title
  document.querySelector('#ruleModal .modal-header h2').textContent = 'Edit Rule';
}

function saveCustomRule() {
  const rule = {
    type: document.getElementById('ruleType').value,
    priority: document.getElementById('rulePriority').value
  };

  const condition = document.getElementById('ruleCondition').value;
  if (condition) {
    rule.condition = condition;
    rule.operator = document.getElementById('ruleOperator').value;
    rule.value = parseFloat(document.getElementById('ruleValue').value);
    rule.unit = document.getElementById('ruleUnit').value;
  }

  if (editingRuleIndex !== null) {
    // Update existing rule
    currentSettings.notifications.customRules[editingRuleIndex] = rule;
  } else {
    // Add new rule
    currentSettings.notifications.customRules.push(rule);
  }

  renderCustomRules();
  document.getElementById('ruleModal').style.display = 'none';
  editingRuleIndex = null; // Reset editing state
}

function editVip(index) {
  const vip = currentSettings.vipAthletes[index];
  editingVipIndex = index;

  // Populate form with existing VIP data
  document.getElementById('vipAthleteName').value = vip.name;
  document.getElementById('vipAthleteId').value = vip.id || '';

  // Update button text
  const addButton = document.getElementById('addVipBtn');
  addButton.textContent = 'Update VIP';

  // Scroll to form
  document.getElementById('vipAthleteName').scrollIntoView({ behavior: 'smooth', block: 'center' });
  document.getElementById('vipAthleteName').focus();
}

function addVipAthlete() {
  const name = document.getElementById('vipAthleteName').value.trim();
  const id = document.getElementById('vipAthleteId').value.trim();

  if (!name) {
    alert('Please enter an athlete name');
    return;
  }

  const vip = {
    name,
    id: id || null
  };

  if (editingVipIndex !== null) {
    // Update existing VIP
    currentSettings.vipAthletes[editingVipIndex] = vip;
    editingVipIndex = null;

    // Reset button text
    document.getElementById('addVipBtn').textContent = 'Add VIP';
  } else {
    // Add new VIP
    currentSettings.vipAthletes.push(vip);
  }

  renderVipList();

  // Clear inputs
  document.getElementById('vipAthleteName').value = '';
  document.getElementById('vipAthleteId').value = '';
}

async function saveSettings() {
  // Update settings from form
  currentSettings.autoKudos.enabled = document.getElementById('autoKudosEnabled').checked;
  currentSettings.autoKudos.onlySignificant = document.getElementById('onlySignificant').checked;
  currentSettings.autoKudos.dailyLimit = parseInt(document.getElementById('dailyLimit').value);
  currentSettings.autoKudos.delayMs = parseInt(document.getElementById('delayMs').value);

  currentSettings.notifications.enabled = document.getElementById('notificationsEnabled').checked;
  
  // Pushover settings
  if (!currentSettings.notifications.pushover) {
    currentSettings.notifications.pushover = {
      enabled: false,
      userKey: '',
      appToken: '',
      minPriority: 'high'
    };
  }
  currentSettings.notifications.pushover.enabled = document.getElementById('pushoverEnabled').checked;
  currentSettings.notifications.pushover.userKey = document.getElementById('pushoverUserKey').value.trim();
  currentSettings.notifications.pushover.appToken = document.getElementById('pushoverAppToken').value.trim();
  currentSettings.notifications.pushover.minPriority = document.getElementById('pushoverMinPriority').value;
  
  // Auto-refresh settings
  if (!currentSettings.autoRefresh) {
    currentSettings.autoRefresh = {
      enabled: false,
      intervalMinutes: 5
    };
  }
  currentSettings.autoRefresh.enabled = document.getElementById('autoRefreshEnabled').checked;
  currentSettings.autoRefresh.intervalMinutes = parseInt(document.getElementById('autoRefreshInterval').value) || 5;
  
  // Save to storage
  await chrome.storage.local.set({ settings: currentSettings });
  
  // Notify background script to update auto-refresh alarm
  chrome.runtime.sendMessage({
    type: 'updateSettings',
    data: currentSettings
  });
  
  // Show success message
  const status = document.getElementById('saveStatus');
  status.textContent = '✅ Settings saved successfully!';
  status.style.color = '#28a745';
  
  setTimeout(() => {
    status.textContent = '';
  }, 3000);
}

async function resetStats() {
  if (!confirm('Are you sure you want to reset all statistics?')) {
    return;
  }
  
  currentSettings.stats = {
    totalKudos: 0,
    totalNotifications: 0,
    lastReset: Date.now()
  };
  
  await chrome.storage.local.set({ 
    settings: currentSettings,
    dailyKudosCount: 0
  });
  
  updateStats();
  
  alert('Statistics have been reset.');
}

function togglePushoverSettings() {
  const enabled = document.getElementById('pushoverEnabled').checked;
  const settingsDiv = document.getElementById('pushoverSettings');
  settingsDiv.style.display = enabled ? 'block' : 'none';
}

function toggleAutoRefreshSettings() {
  const enabled = document.getElementById('autoRefreshEnabled').checked;
  const settingsDiv = document.getElementById('autoRefreshSettings');
  settingsDiv.style.display = enabled ? 'block' : 'none';
}

async function testPushover() {
  const userKey = document.getElementById('pushoverUserKey').value.trim();
  const appToken = document.getElementById('pushoverAppToken').value.trim();
  const resultSpan = document.getElementById('pushoverTestResult');
  
  if (!userKey || !appToken) {
    resultSpan.textContent = '❌ Please enter both User Key and App Token';
    resultSpan.className = 'test-result error';
    return;
  }
  
  resultSpan.textContent = '⏳ Sending test notification...';
  resultSpan.className = 'test-result';
  
  try {
    const response = await fetch('https://api.pushover.net/1/messages.json', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        token: appToken,
        user: userKey,
        message: 'Test notification from Strava Extension! 🚴',
        title: 'Strava Extension Test',
        priority: 0
      })
    });
    
    const data = await response.json();
    
    if (data.status === 1) {
      resultSpan.textContent = '✅ Success! Check your phone for the notification.';
      resultSpan.className = 'test-result success';
    } else {
      resultSpan.textContent = `❌ Error: ${data.errors?.join(', ') || 'Unknown error'}`;
      resultSpan.className = 'test-result error';
    }
  } catch (error) {
    resultSpan.textContent = `❌ Network error: ${error.message}`;
    resultSpan.className = 'test-result error';
  }
}
