// Parse activity data from Strava's DOM
const ActivityParser = {
  parseActivityCard(element) {
    try {
      const participants = this.extractGroupParticipants(element);
      const extractedName = this.extractAthleteName(element);

      // If we couldn't find the athlete name but have participants, use first participant's name
      const athleteName = (extractedName === 'Unknown' && participants.length > 0)
        ? participants[0].name
        : extractedName;

      const activityType = this.extractActivityType(element);

      const activity = {
        id: this.extractActivityId(element),
        athleteName: athleteName,
        athleteId: this.extractAthleteId(element),
        activityType: activityType,
        isVirtual: activityType === 'VirtualRide',
        title: this.extractTitle(element),
        distance: this.extractDistance(element),
        elevation: this.extractElevation(element),
        movingTime: this.extractMovingTime(element),
        hasPR: this.checkForPR(element),
        hasKudos: this.checkForExistingKudos(element),
        commentCount: this.extractCommentCount(element),
        timestamp: Date.now(),
        element: element,
        // Check for group activity and extract all participants
        isGroupActivity: this.isGroupActivity(element),
        participants: participants
      };

      // Calculate derived metrics
      if (activity.distance && activity.movingTime) {
        activity.speed = this.calculateSpeed(activity);
        activity.pace = this.calculatePace(activity);
      }

      return activity;
    } catch (error) {
      console.error('Error parsing activity:', error);
      return null;
    }
  },

  extractActivityId(element) {
    // Activity ID is typically in the data-activity-id attribute or href
    const link = element.querySelector('a[href*="/activities/"]');
    if (link) {
      const match = link.href.match(/\/activities\/(\d+)/);
      return match ? match[1] : null;
    }
    return element.dataset.activityId || null;
  },

  extractAthleteName(element) {
    // Try multiple selectors for athlete name
    // The <a> tag itself has data-testid="owners-name"
    let nameElement = element.querySelector('a[data-testid="owners-name"]');
    if (!nameElement) {
      // Fallback to older selectors
      nameElement = element.querySelector('[data-testid="owners-name"] a, [data-testid="owner-name"] a');
    }
    if (!nameElement) {
      nameElement = element.querySelector('.entry-athlete, .athlete-name');
    }
    if (!nameElement) {
      // Try getting from first athlete link
      nameElement = element.querySelector('a[href*="/athletes/"]');
    }

    const name = nameElement ? nameElement.textContent.trim() : 'Unknown';
    console.log('[ActivityParser] Extracted athlete name:', name, 'from element:', nameElement);
    return name;
  },

  extractAthleteId(element) {
    const athleteLink = element.querySelector('a[href*="/athletes/"]');
    if (athleteLink) {
      const match = athleteLink.href.match(/\/athletes\/(\d+)/);
      return match ? match[1] : null;
    }
    return null;
  },

  extractActivityType(element) {
    // Look for activity type in icon, class, or text
    const typeElement = element.querySelector('.app-icon, [class*="icon-"], .entry-type');

    let detectedType = 'Other';
    let isVirtual = false;

    // Check for activity type from SVG title (most reliable for virtual rides)
    const svgTitle = element.querySelector('svg[data-testid="activity-icon"] title');
    if (svgTitle) {
      const titleText = svgTitle.textContent.trim();
      console.log('[ActivityParser] SVG title:', titleText);

      if (titleText === 'Virtual Ride') {
        detectedType = 'VirtualRide';
        isVirtual = true;
      } else if (titleText.includes('Ride')) {
        detectedType = 'Ride';
      } else if (titleText.includes('Run')) {
        detectedType = 'Run';
      } else if (titleText.includes('Swim')) {
        detectedType = 'Swim';
      } else if (titleText.includes('Walk')) {
        detectedType = 'Walk';
      } else if (titleText.includes('Hike')) {
        detectedType = 'Hike';
      }
    }

    // Fallback to class-based detection if SVG title didn't work
    if (detectedType === 'Other' && typeElement) {
      const classList = typeElement.className;
      console.log('[ActivityParser] Type element classes:', classList);

      if (classList.includes('icon-run') || classList.includes('Run')) detectedType = 'Run';
      else if (classList.includes('icon-ride') || classList.includes('Ride')) detectedType = 'Ride';
      else if (classList.includes('icon-swim') || classList.includes('Swim')) detectedType = 'Swim';
      else if (classList.includes('icon-walk') || classList.includes('Walk')) detectedType = 'Walk';
      else if (classList.includes('icon-hike') || classList.includes('Hike')) detectedType = 'Hike';
      else if (classList.includes('VirtualRide')) {
        detectedType = 'VirtualRide';
        isVirtual = true;
      }
      else if (classList.includes('icon-virtualride')) {
        detectedType = 'VirtualRide';
        isVirtual = true;
      }
    }

    // Additional virtual ride detection for rides
    if (detectedType === 'Ride' && !isVirtual) {
      // Check for virtual device (Zwift, Rouvy, etc.)
      const deviceElement = element.querySelector('[data-testid="device"]');
      if (deviceElement) {
        const device = deviceElement.textContent.trim().toLowerCase();
        const virtualPlatforms = ['zwift', 'rouvy', 'trainerroad', 'trainer road', 'sufferfest', 'wahoo', 'bkool', 'fulgaz'];

        if (virtualPlatforms.some(platform => device.includes(platform))) {
          console.log('[ActivityParser] Virtual platform detected in device:', device);
          detectedType = 'VirtualRide';
          isVirtual = true;
        }
      }

      // Check for "Virtual" tag on activity
      if (!isVirtual) {
        const virtualTag = element.querySelector('[data-testid="tag"]');
        if (virtualTag && virtualTag.textContent.trim().toLowerCase() === 'virtual') {
          console.log('[ActivityParser] Virtual tag detected');
          detectedType = 'VirtualRide';
          isVirtual = true;
        }
      }
    }

    console.log('[ActivityParser] Detected activity type:', detectedType, 'isVirtual:', isVirtual);
    return detectedType;
  },

  extractTitle(element) {
    // Try multiple selectors for activity title
    let titleElement = element.querySelector('[data-testid="activity_name"]');
    if (!titleElement) {
      titleElement = element.querySelector('.entry-title, [data-testid="activity-name"]');
    }
    return titleElement ? titleElement.textContent.trim() : 'Untitled';
  },

  extractDistance(element) {
    const stats = element.querySelectorAll('li, .stat, [class*="stats"]');
    for (const stat of stats) {
      const text = stat.textContent;

      // Match patterns like "50.2 mi", "80.5 km", "1125 yd", "1500 m"
      // Use word boundaries to avoid matching "6min" as "mi"
      const miMatch = text.match(/([\d,.]+)\s*mi(?:\s|$|les)/i);
      if (miMatch) {
        return { value: parseFloat(miMatch[1].replace(',', '')), unit: 'miles' };
      }

      const kmMatch = text.match(/([\d,.]+)\s*km(?:\s|$)/i);
      if (kmMatch) {
        return { value: parseFloat(kmMatch[1].replace(',', '')), unit: 'km' };
      }

      // Swimming: yards
      const ydMatch = text.match(/([\d,.]+)\s*(?:yd|yds|yards?)(?:\s|$)/i);
      if (ydMatch) {
        return { value: parseFloat(ydMatch[1].replace(',', '')), unit: 'yards' };
      }

      // Swimming: meters (be careful - only match when followed by space/end)
      const mMatch = text.match(/([\d,.]+)\s*m(?:\s|$)(?!i)/i);
      if (mMatch) {
        return { value: parseFloat(mMatch[1].replace(',', '')), unit: 'meters' };
      }
    }
    return null;
  },

  extractElevation(element) {
    const stats = element.querySelectorAll('li, .stat, [class*="stats"]');
    for (const stat of stats) {
      const text = stat.textContent;
      
      // Match patterns like "2,500 ft", "750 m"
      const ftMatch = text.match(/([\d,.]+)\s*ft/i);
      if (ftMatch) {
        return { value: parseFloat(ftMatch[1].replace(',', '')), unit: 'feet' };
      }
      
      const mMatch = text.match(/([\d,.]+)\s*m(?!\w)/i);
      if (mMatch) {
        return { value: parseFloat(mMatch[1].replace(',', '')), unit: 'meters' };
      }
    }
    return null;
  },

  extractMovingTime(element) {
    const stats = element.querySelectorAll('li, .stat, [class*="stats"]');
    for (const stat of stats) {
      const text = stat.textContent;
      
      // Match patterns like "2h 30m", "45m 23s", "1:23:45"
      const colonMatch = text.match(/(\d+):(\d+):(\d+)/);
      if (colonMatch) {
        return parseInt(colonMatch[1]) * 3600 + parseInt(colonMatch[2]) * 60 + parseInt(colonMatch[3]);
      }
      
      const hmMatch = text.match(/(\d+)h\s*(\d+)m/i);
      if (hmMatch) {
        return parseInt(hmMatch[1]) * 3600 + parseInt(hmMatch[2]) * 60;
      }
      
      const mMatch = text.match(/(\d+)m(?:\s*(\d+)s)?/i);
      if (mMatch) {
        return parseInt(mMatch[1]) * 60 + (mMatch[2] ? parseInt(mMatch[2]) : 0);
      }
    }
    return null;
  },

  checkForPR(element) {
    // Look for PR badge/icon/achievement
    const prIndicators = element.querySelectorAll('.pr-badge, [class*="achievement"], [title*="PR"], [alt*="PR"]');
    return prIndicators.length > 0;
  },

  checkForExistingKudos(element) {
    // Check if already given kudos
    const kudosButton = element.querySelector('button[data-testid="kudos_button"], .js-add-kudo, button[class*="kudos"]');
    if (kudosButton) {
      return kudosButton.classList.contains('active') ||
             kudosButton.classList.contains('given') ||
             kudosButton.disabled;
    }
    return false;
  },

  extractCommentCount(element) {
    // Look for the specific comments_count button (most reliable)
    const commentsCountBtn = element.querySelector('[data-testid="comments_count"]');
    if (commentsCountBtn) {
      const text = commentsCountBtn.textContent.trim();
      // Match "X comment" or "X comments" (handles &nbsp; as whitespace)
      const match = text.match(/(\d+)\s+comment(?:s)?/i);
      if (match) {
        console.log('[ActivityParser] Found comment count:', match[1]);
        return parseInt(match[1]);
      }
    }

    // Fallback: Look for comment count in counts wrapper
    const countsWrapper = element.querySelector('[data-testid="counts_wrapper"]');
    if (countsWrapper) {
      const text = countsWrapper.textContent;
      const match = text.match(/(\d+)\s+comment(?:s)?/i);
      if (match) {
        console.log('[ActivityParser] Found comment count in wrapper:', match[1]);
        return parseInt(match[1]);
      }
    }

    // No comments found
    console.log('[ActivityParser] No comments found for activity');
    return 0;
  },

  convertDistanceToMiles(distance) {
    // Convert any distance unit to miles
    let miles = distance.value;

    if (distance.unit === 'km') {
      miles = miles * 0.621371;
    } else if (distance.unit === 'meters') {
      miles = miles * 0.000621371;
    } else if (distance.unit === 'yards') {
      miles = miles * 0.000568182;
    }
    // else distance.unit is already 'miles'

    return miles;
  },

  calculateSpeed(activity) {
    if (!activity.distance || !activity.movingTime) return null;

    // Convert to mph
    const hours = activity.movingTime / 3600;
    const miles = this.convertDistanceToMiles(activity.distance);

    return { value: miles / hours, unit: 'mph' };
  },

  calculatePace(activity) {
    if (!activity.distance || !activity.movingTime) return null;

    // Convert to min/mile
    const minutes = activity.movingTime / 60;
    const miles = this.convertDistanceToMiles(activity.distance);

    return { value: minutes / miles, unit: 'min/mile' };
  },

  isGroupActivity(element) {
    // Get unique participants
    const participants = this.extractGroupParticipants(element);
    
    // Check for group activity text indicators
    const text = element.textContent.toLowerCase();
    const hasGroupText = text.includes(' and ') && (text.includes(' other') || text.includes(' others'));
    
    // It's a group activity if we have multiple UNIQUE participants
    return participants.length > 1 || hasGroupText;
  },

  extractGroupParticipants(element) {
    const participants = [];
    const seen = new Set(); // Track by athlete ID to avoid duplicates
    
    // Find all athlete links in the activity card
    const athleteLinks = element.querySelectorAll('a[href*="/athletes/"]');
    
    console.log(`[ActivityParser] Found ${athleteLinks.length} athlete links`);
    
    athleteLinks.forEach((link, index) => {
      const match = link.href.match(/\/athletes\/(\d+)/);
      if (match) {
        const athleteId = match[1];
        
        // Skip if we've already seen this athlete ID
        if (seen.has(athleteId)) {
          console.log(`[ActivityParser] Link ${index + 1}: Skipping duplicate athlete ID ${athleteId}`);
          return;
        }
        
        // Skip if this athlete link is in a comment section
        // Comments typically have athlete links but aren't part of the activity participants
        const inCommentSection = link.closest('[class*="comment"]') || 
                                 link.closest('[data-testid*="comment"]') ||
                                 link.closest('[class*="Comment"]');
        
        if (inCommentSection) {
          console.log(`[ActivityParser] Link ${index + 1}: Skipping athlete ${athleteId} (in comment section)`);
          return; // Skip athlete links in comments
        }
        
        seen.add(athleteId);
        const athleteName = link.textContent.trim() || link.getAttribute('title') || 'Unknown';
        
        console.log(`[ActivityParser] Link ${index + 1}: Adding participant ${athleteName} (${athleteId})`);
        
        // Only add if name is not empty
        if (athleteName && athleteName !== 'Unknown') {
          participants.push({
            id: athleteId,
            name: athleteName,
            link: link.href
          });
        }
      }
    });
    
    return participants;
  }
};

if (typeof window !== 'undefined') {
  window.ActivityParser = ActivityParser;
}
