// Review Queue script
let currentQueue = [];
let currentFilter = 'all';

document.addEventListener('DOMContentLoaded', async () => {
  await loadQueue();
  setupEventListeners();
});

async function loadQueue() {
  currentQueue = await StorageManager.getReviewQueue();
  renderQueue();
}

function setupEventListeners() {
  // Select all checkbox
  document.getElementById('selectAllCheckbox').addEventListener('change', async (e) => {
    const checked = e.target.checked;

    // Get currently filtered items
    let filteredQueue = currentQueue;
    if (currentFilter === 'critical') {
      filteredQueue = currentQueue.filter(item => item.priority === 'critical');
    } else if (currentFilter === 'high') {
      filteredQueue = currentQueue.filter(item =>
        item.priority === 'critical' || item.priority === 'high'
      );
    } else if (currentFilter === 'medium') {
      filteredQueue = currentQueue.filter(item =>
        item.priority === 'critical' || item.priority === 'high' || item.priority === 'medium'
      );
    }

    // Mark all filtered items
    for (const item of filteredQueue) {
      await StorageManager.markReviewQueueItem(item.activityId, checked);
      item.reviewed = checked;
    }

    renderQueue();
  });

  // Priority filter
  document.getElementById('priorityFilter').addEventListener('change', (e) => {
    currentFilter = e.target.value;
    document.getElementById('selectAllCheckbox').checked = false;
    renderQueue();
  });

  // Clear reviewed button
  document.getElementById('clearReviewedBtn').addEventListener('click', async () => {
    if (confirm('Remove all reviewed items from the queue?')) {
      await StorageManager.clearReviewedItems();
      await loadQueue();
      document.getElementById('selectAllCheckbox').checked = false;
    }
  });

  // Export button
  document.getElementById('exportBtn').addEventListener('click', exportToMarkdown);

  // Back button
  document.getElementById('backBtn').addEventListener('click', () => {
    window.close();
  });
}

function renderQueue() {
  const list = document.getElementById('queueList');
  const emptyState = document.getElementById('emptyState');
  const countBadge = document.getElementById('queueCount');
  const selectAllCheckbox = document.getElementById('selectAllCheckbox');

  // Filter queue
  let filteredQueue = currentQueue;

  if (currentFilter === 'critical') {
    filteredQueue = currentQueue.filter(item => item.priority === 'critical');
  } else if (currentFilter === 'high') {
    filteredQueue = currentQueue.filter(item =>
      item.priority === 'critical' || item.priority === 'high'
    );
  } else if (currentFilter === 'medium') {
    filteredQueue = currentQueue.filter(item =>
      item.priority === 'critical' || item.priority === 'high' || item.priority === 'medium'
    );
  }

  // Sort by priority (critical first) then by date (newest first)
  const priorityValues = { critical: 4, high: 3, medium: 2, low: 1 };
  filteredQueue.sort((a, b) => {
    const priorityDiff = priorityValues[b.priority] - priorityValues[a.priority];
    if (priorityDiff !== 0) return priorityDiff;
    return b.addedAt - a.addedAt;
  });

  // Update count
  const unreviewedCount = filteredQueue.filter(item => !item.reviewed).length;
  countBadge.textContent = unreviewedCount;

  // Update "Select All" checkbox state
  if (filteredQueue.length > 0) {
    const allChecked = filteredQueue.every(item => item.reviewed);
    selectAllCheckbox.checked = allChecked;
  } else {
    selectAllCheckbox.checked = false;
  }

  // Show empty state if no items
  if (filteredQueue.length === 0) {
    list.style.display = 'none';
    emptyState.style.display = 'block';
    return;
  }

  list.style.display = 'flex';
  emptyState.style.display = 'none';
  list.innerHTML = '';

  filteredQueue.forEach(item => {
    const queueItem = createQueueItem(item);
    list.appendChild(queueItem);
  });
}

function createQueueItem(item) {
  const div = document.createElement('div');
  div.className = `queue-item ${item.reviewed ? 'reviewed' : ''}`;

  const priorityEmoji = {
    critical: '🔥',
    high: '⚡',
    medium: '✨',
    low: '👍'
  };

  // Format activity type display
  let activityTypeDisplay = item.activityType;
  if (item.activityType === 'VirtualRide') {
    activityTypeDisplay = 'Virtual Ride';
  }

  // Build stats
  const stats = [];
  if (item.distance) {
    stats.push(`<div class="stat-item"><span class="stat-label">Distance:</span> ${item.distance.value.toFixed(1)} ${item.distance.unit}</div>`);
  }
  if (item.speed && (item.activityType.toLowerCase() === 'ride' || item.activityType.toLowerCase() === 'virtualride')) {
    stats.push(`<div class="stat-item"><span class="stat-label">Speed:</span> ${item.speed.value.toFixed(1)} ${item.speed.unit} avg</div>`);
  }
  if (item.pace && item.activityType.toLowerCase() === 'run') {
    const pace = formatPace(item.pace.value);
    stats.push(`<div class="stat-item"><span class="stat-label">Pace:</span> ${pace}</div>`);
  }
  if (item.elevation && item.elevation.value > 0) {
    stats.push(`<div class="stat-item"><span class="stat-label">Elevation:</span> ${item.elevation.value.toLocaleString()} ${item.elevation.unit}</div>`);
  }
  if (item.commentCount && item.commentCount > 0) {
    stats.push(`<div class="stat-item"><span class="stat-label">💬 Comments:</span> ${item.commentCount}</div>`);
  }

  const timeAgo = getTimeAgo(item.addedAt);

  div.innerHTML = `
    <div class="queue-item-checkbox">
      <input type="checkbox" ${item.reviewed ? 'checked' : ''} data-activity-id="${item.activityId}">
    </div>
    <div class="queue-item-content">
      <div class="queue-item-header">
        <span class="athlete-name">${item.athleteName}</span>
        ${item.isVIP ? '<span class="vip-badge">⭐ VIP</span>' : ''}
        <span class="priority-badge ${item.priority}">${priorityEmoji[item.priority]} ${item.priority.toUpperCase()}</span>
      </div>
      <div class="activity-title">
        <strong>${activityTypeDisplay}:</strong> ${item.title}
        ${item.hasPR ? '🏆 <strong>PR</strong>' : ''}
      </div>
      <div class="activity-stats">
        ${stats.join('')}
      </div>
      <div class="timestamp">Added ${timeAgo}</div>
    </div>
    <div class="queue-item-actions">
      <a href="https://www.strava.com/activities/${item.activityId}" target="_blank" class="btn btn-primary btn-small">
        View Activity
      </a>
    </div>
  `;

  // Add checkbox listener
  const checkbox = div.querySelector('input[type="checkbox"]');
  checkbox.addEventListener('change', async (e) => {
    await StorageManager.markReviewQueueItem(item.activityId, e.target.checked);
    item.reviewed = e.target.checked;
    div.classList.toggle('reviewed', e.target.checked);
    renderQueue();
  });

  return div;
}

function formatPace(minutesPerMile) {
  const minutes = Math.floor(minutesPerMile);
  const seconds = Math.round((minutesPerMile - minutes) * 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')} /mi`;
}

function getTimeAgo(timestamp) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

function exportToMarkdown() {
  const filteredQueue = currentQueue.filter(item => {
    if (currentFilter === 'critical') return item.priority === 'critical';
    if (currentFilter === 'high') return item.priority === 'critical' || item.priority === 'high';
    if (currentFilter === 'medium') return ['critical', 'high', 'medium'].includes(item.priority);
    return true;
  });

  if (filteredQueue.length === 0) {
    alert('No activities to export');
    return;
  }

  let markdown = `# Strava Activities to Review\n\n`;
  markdown += `Generated: ${new Date().toLocaleString()}\n\n`;
  markdown += `---\n\n`;

  filteredQueue.forEach(item => {
    const priorityEmoji = { critical: '🔥', high: '⚡', medium: '✨', low: '👍' };
    const checked = item.reviewed ? 'x' : ' ';

    let activityTypeDisplay = item.activityType;
    if (item.activityType === 'VirtualRide') {
      activityTypeDisplay = 'Virtual Ride';
    }

    markdown += `- [${checked}] **${item.athleteName}** - ${priorityEmoji[item.priority]} ${item.priority.toUpperCase()}`;
    if (item.isVIP) markdown += ` ⭐ VIP`;
    markdown += `\n`;
    markdown += `  - ${activityTypeDisplay}: ${item.title}`;
    if (item.hasPR) markdown += ` 🏆 PR`;
    markdown += `\n`;

    if (item.distance) {
      markdown += `  - Distance: ${item.distance.value.toFixed(1)} ${item.distance.unit}\n`;
    }
    if (item.speed && (item.activityType.toLowerCase() === 'ride' || item.activityType.toLowerCase() === 'virtualride')) {
      markdown += `  - Speed: ${item.speed.value.toFixed(1)} ${item.speed.unit} avg\n`;
    }
    if (item.pace && item.activityType.toLowerCase() === 'run') {
      markdown += `  - Pace: ${formatPace(item.pace.value)}\n`;
    }
    if (item.elevation && item.elevation.value > 0) {
      markdown += `  - Elevation: ${item.elevation.value.toLocaleString()} ${item.elevation.unit}\n`;
    }
    if (item.commentCount && item.commentCount > 0) {
      markdown += `  - 💬 Comments: ${item.commentCount}\n`;
    }

    markdown += `  - [View on Strava](https://www.strava.com/activities/${item.activityId})\n\n`;
  });

  // Download the file
  const blob = new Blob([markdown], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `strava-review-queue-${new Date().toISOString().split('T')[0]}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
