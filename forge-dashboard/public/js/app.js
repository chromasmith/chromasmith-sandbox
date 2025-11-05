/**
 * Main Dashboard Application
 * Handles navigation and common utilities
 */

const API_BASE = window.location.origin;

// Navigation
function initNavigation() {
  const navButtons = document.querySelectorAll('.nav-btn');
  const views = document.querySelectorAll('.view');

  navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const viewName = btn.dataset.view;

      // Update active nav button
      navButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Update active view
      views.forEach(v => v.classList.remove('active'));
      document.getElementById(`${viewName}-view`).classList.add('active');

      // Load view data
      loadView(viewName);
    });
  });
}

// Load view data
function loadView(viewName) {
  switch (viewName) {
    case 'health':
      if (window.loadHealthView) window.loadHealthView();
      break;
    case 'audit':
      if (window.loadAuditView) window.loadAuditView();
      break;
    case 'dlq':
      if (window.loadDLQView) window.loadDLQView();
      break;
    case 'events':
      if (window.loadEventsView) window.loadEventsView();
      break;
  }
}

// Show loading overlay
function showLoading() {
  document.getElementById('loading-overlay').style.display = 'flex';
}

// Hide loading overlay
function hideLoading() {
  document.getElementById('loading-overlay').style.display = 'none';
}

// Show error message
function showError(container, message) {
  container.innerHTML = `
    <div class="error-message">
      <p><strong>Error:</strong> ${message}</p>
    </div>
  `;
}

// Show empty state
function showEmpty(container, message) {
  container.innerHTML = `
    <div class="empty-state">
      <p>${message}</p>
    </div>
  `;
}

// Format timestamp
function formatTimestamp(timestamp) {
  if (!timestamp) return 'N/A';
  const date = new Date(timestamp);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

// Format time ago
function timeAgo(timestamp) {
  if (!timestamp) return 'N/A';
  const now = new Date();
  const then = new Date(timestamp);
  const seconds = Math.floor((now - then) / 1000);

  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

// Fetch API helper
async function fetchAPI(endpoint) {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return await response.json();
  } catch (err) {
    console.error(`[API ERROR] ${endpoint}:`, err);
    throw err;
  }
}

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
  console.log('[DASHBOARD] Initializing...');
  initNavigation();
  
  // Load initial view (health)
  if (window.loadHealthView) {
    window.loadHealthView();
  }
});

// Export utilities
window.DashboardUtils = {
  showLoading,
  hideLoading,
  showError,
  showEmpty,
  formatTimestamp,
  timeAgo,
  fetchAPI,
  API_BASE
};
