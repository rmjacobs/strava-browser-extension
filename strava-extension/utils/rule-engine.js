// Rule engine for evaluating activity significance
const RuleEngine = {
  async evaluateActivity(activity) {
    const rules = await StorageManager.getActiveRules();
    const settings = await StorageManager.getSettings();

    let matchedRules = [];
    let highestPriority = null;

    // Check VIP athletes first (match by ID or name)
    console.log('[RuleEngine] Checking VIP status for:', activity.athleteName);
    console.log('[RuleEngine] VIP athletes list:', settings.vipAthletes);

    const isVIP = settings.vipAthletes.some(vip => {
      // Match by ID if both exist
      if (vip.id && activity.athleteId && vip.id === activity.athleteId) {
        console.log('[RuleEngine] VIP matched by ID:', vip.name, '(', vip.id, ')');
        return true;
      }
      // Match by name (case-insensitive)
      if (vip.name && activity.athleteName) {
        const vipNameNormalized = vip.name.toLowerCase().trim();
        const athleteNameNormalized = activity.athleteName.toLowerCase().trim();
        console.log('[RuleEngine] Comparing VIP name:', vipNameNormalized, 'with athlete:', athleteNameNormalized);
        if (vipNameNormalized === athleteNameNormalized) {
          console.log('[RuleEngine] VIP matched by name:', vip.name);
          return true;
        }
      }
      return false;
    });

    console.log('[RuleEngine] Is VIP?', isVIP);
    console.log('[RuleEngine] Evaluating', rules.length, 'rules');

    for (const rule of rules) {
      console.log('[RuleEngine] Checking rule:', rule.type, rule);
      if (this.matchesRule(activity, rule, isVIP)) {
        console.log('[RuleEngine] ✓ Rule matched!');
        matchedRules.push(rule);

        // Track highest priority
        const priority = this.getPriorityValue(rule.priority);
        if (!highestPriority || priority > this.getPriorityValue(highestPriority)) {
          highestPriority = rule.priority;
        }
      } else {
        console.log('[RuleEngine] ✗ Rule did not match');
      }
    }

    console.log('[RuleEngine] Total matched rules:', matchedRules.length);
    console.log('[RuleEngine] Is significant?', matchedRules.length > 0);

    return {
      isSignificant: matchedRules.length > 0,
      matchedRules,
      priority: highestPriority || 'none',
      isVIP
    };
  },

  matchesRule(activity, rule, isVIP) {
    // Handle special rule types FIRST (these bypass activity type checking)
    if (rule.type === 'has-pr-badge') {
      return activity.hasPR;
    }

    if (rule.type === 'vip-only') {
      return isVIP;
    }

    // Check activity type match
    if (rule.type !== 'any') {
      const activityType = activity.activityType.toLowerCase();
      const ruleType = rule.type.toLowerCase();

      // Handle VirtualRide matching
      if (ruleType === 'ride') {
        // 'ride' rule matches both Ride and VirtualRide (backward compatible)
        if (!activityType.includes('ride')) {
          return false;
        }
      } else if (ruleType === 'virtualride') {
        // 'virtualride' rule matches only VirtualRide
        if (activityType !== 'virtualride') {
          return false;
        }
      } else {
        // Other types use standard matching
        if (!activityType.includes(ruleType)) {
          return false;
        }
      }
    }

    // No condition means match all of this type
    if (!rule.condition) {
      return true;
    }

    // Evaluate condition
    return this.evaluateCondition(activity, rule);
  },

  evaluateCondition(activity, rule) {
    const { condition, operator, value, unit } = rule;

    let activityValue = null;

    switch (condition) {
      case 'distance':
        if (!activity.distance) return false;
        activityValue = this.normalizeDistance(activity.distance, unit);
        break;

      case 'elevation':
        if (!activity.elevation) return false;
        activityValue = this.normalizeElevation(activity.elevation, unit);
        break;

      case 'speed':
        if (!activity.speed) return false;
        activityValue = this.normalizeSpeed(activity.speed, unit);
        break;

      case 'pace':
        if (!activity.pace) return false;
        activityValue = this.normalizePace(activity.pace, unit);
        break;

      case 'moving-time':
        if (!activity.movingTime) return false;
        activityValue = activity.movingTime / 60; // Convert to minutes
        break;

      case 'comments':
        activityValue = activity.commentCount || 0;
        break;

      default:
        return false;
    }

    return this.compareValues(activityValue, operator, value);
  },

  compareValues(activityValue, operator, ruleValue) {
    switch (operator) {
      case '>': return activityValue > ruleValue;
      case '>=': return activityValue >= ruleValue;
      case '<': return activityValue < ruleValue;
      case '<=': return activityValue <= ruleValue;
      case '=': return Math.abs(activityValue - ruleValue) < 0.01;
      default: return false;
    }
  },

  normalizeDistance(distance, targetUnit) {
    let miles = distance.value;
    if (distance.unit === 'km') {
      miles = miles * 0.621371;
    }
    
    if (targetUnit === 'km') {
      return miles / 0.621371;
    }
    return miles;
  },

  normalizeElevation(elevation, targetUnit) {
    let feet = elevation.value;
    if (elevation.unit === 'meters') {
      feet = feet * 3.28084;
    }
    
    if (targetUnit === 'meters') {
      return feet / 3.28084;
    }
    return feet;
  },

  normalizeSpeed(speed, targetUnit) {
    // Speed is stored as mph
    if (targetUnit === 'kph') {
      return speed.value * 1.60934;
    }
    return speed.value;
  },

  normalizePace(pace, targetUnit) {
    // Pace is stored as min/mile
    if (targetUnit === 'min/km') {
      return pace.value / 1.60934;
    }
    return pace.value;
  },

  getPriorityValue(priority) {
    const values = {
      'critical': 4,
      'high': 3,
      'medium': 2,
      'low': 1,
      'none': 0
    };
    return values[priority] || 0;
  },

  getPriorityColor(priority) {
    const colors = {
      'critical': '#fc4c02',
      'high': '#ff6b35',
      'medium': '#f7931e',
      'low': '#4a90e2',
      'none': '#999999'
    };
    return colors[priority] || colors.none;
  },

  formatActivitySummary(activity, evaluation) {
    const parts = [];

    // Display "Virtual Ride" instead of "VirtualRide"
    let activityTypeDisplay = activity.activityType;
    if (activity.activityType === 'VirtualRide') {
      activityTypeDisplay = 'Virtual Ride';
    }

    // Activity type and title
    parts.push(`${activityTypeDisplay}: ${activity.title}`);

    // Build stats line
    const stats = [];

    if (activity.distance) {
      stats.push(`${activity.distance.value.toFixed(1)} ${activity.distance.unit}`);
    }

    if (activity.speed && (activity.activityType.toLowerCase() === 'ride' || activity.activityType.toLowerCase() === 'virtualride')) {
      stats.push(`${activity.speed.value.toFixed(1)} ${activity.speed.unit} avg`);
    }

    if (activity.pace && activity.activityType.toLowerCase() === 'run') {
      stats.push(`${this.formatPace(activity.pace.value)} pace`);
    }

    if (activity.elevation && activity.elevation.value > 0) {
      stats.push(`${activity.elevation.value.toLocaleString()} ${activity.elevation.unit} elev`);
    }

    if (stats.length > 0) {
      parts.push(stats.join(' • '));
    }

    if (activity.hasPR) {
      parts.push('🏆 PR');
    }

    // Join with newlines for better mobile readability
    return parts.join('\n');
  },

  formatPace(minutesPerMile) {
    const minutes = Math.floor(minutesPerMile);
    const seconds = Math.round((minutesPerMile - minutes) * 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
};

if (typeof window !== 'undefined') {
  window.RuleEngine = RuleEngine;
}
