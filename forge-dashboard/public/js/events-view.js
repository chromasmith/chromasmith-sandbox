/**
 * Events View Controller
 * Displays event timeline with filtering and auto-refresh
 */

const { fetchAPI, showError, showEmpty, formatTimestamp } = window.DashboardUtils;

let autoRefreshInterval = null;
let currentModuleFilter = 'all';

// Load events view
async function loadEventsView() {
  const container = document.getElementById('events-timeline');
  
  try {
    const data = await fetchAPI('/api/events');
    
    // Filter events if needed
    const filteredEvents = currentModuleFilter === 'all' 
      ? data 
      : data.filter(evt => evt.module === currentModuleFilter);
    
    // Render events (newest first)
    renderEventsTimeline(container, filteredEvents.slice(0, 100));
    
  } catch (err) {
    console.error('[EVENTS] Error loading events:', err);
    showError(container, err.message);
  }
}

// Render events timeline
function renderEventsTimeline(container, events) {
  if (!events || events.length === 0) {
    showEmpty(container, 'No events found');
    return;
  }
  
  const html = events.map(evt => {
    const typeClass = getEventTypeClass(evt.event_type);
    
    return `
      <div class="event-row ${typeClass}">
        <div class="event-timestamp">${formatTimestamp(evt.timestamp)}</div>
        <div class="event-module">${evt.module}</div>
        <div class="event-type">
          <span class="event-badge ${typeClass}">${evt.event_type}</span>
        </div>
        <div class="event-details">${formatEventDetails(evt.details)}</div>
      </div>
    `;
  }).join('');
  
  container.innerHTML = html;
}

// Get CSS class for event type
function getEventTypeClass(eventType) {
  const type = eventType.toLowerCase();
  if (type.includes('error') || type.includes('fail')) return 'error';
  if (type.includes('warn')) return 'warning';
  if (type.includes('success')) return 'success';
  return 'info';
}

// Format event details
function formatEventDetails(details) {
  if (typeof details === 'string') return details;
  if (typeof details === 'object') return JSON.stringify(details, null, 2);
  return String(details);
}

// Populate module filter dropdown
async function populateModuleFilter() {
  try {
    const healthData = await fetchAPI('/api/health');
    const select = document.getElementById('module-filter');
    
    if (select && healthData.modules) {
      const modules = healthData.modules.map(m => m.name).sort();
      select.innerHTML = '<option value="all">All Modules</option>' +
        modules.map(m => `<option value="${m}">${m}</option>`).join('');
    }
  } catch (err) {
    console.error('[EVENTS] Error loading modules:', err);
  }
}

// Setup auto-refresh
function toggleAutoRefresh(enabled) {
  if (enabled) {
    autoRefreshInterval = setInterval(() => {
      console.log('[EVENTS] Auto-refresh triggered');
      loadEventsView();
    }, 5000);
  } else {
    if (autoRefreshInterval) {
      clearInterval(autoRefreshInterval);
      autoRefreshInterval = null;
    }
  }
}

// Setup event listeners
document.addEventListener('DOMContentLoaded', () => {
  // Refresh button
  const refreshBtn = document.getElementById('refresh-events');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      console.log('[EVENTS] Manual refresh');
      loadEventsView();
    });
  }
  
  // Module filter
  const moduleFilter = document.getElementById('module-filter');
  if (moduleFilter) {
    moduleFilter.addEventListener('change', (e) => {
      currentModuleFilter = e.target.value;
      console.log('[EVENTS] Filter changed:', currentModuleFilter);
      loadEventsView();
    });
  }
  
  // Auto-refresh toggle
  const autoRefreshToggle = document.getElementById('auto-refresh');
  if (autoRefreshToggle) {
    autoRefreshToggle.addEventListener('change', (e) => {
      console.log('[EVENTS] Auto-refresh:', e.target.checked);
      toggleAutoRefresh(e.target.checked);
    });
  }
  
  // Populate module filter
  populateModuleFilter();
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (autoRefreshInterval) {
    clearInterval(autoRefreshInterval);
  }
});

// Export for global access
window.loadEventsView = loadEventsView;
