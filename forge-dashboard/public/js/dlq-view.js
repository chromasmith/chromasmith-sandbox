/**
 * DLQ View Controller
 * Displays dead letter queue entries and statistics
 */

const { fetchAPI, showError, showEmpty, formatTimestamp, timeAgo } = window.DashboardUtils;

// Load DLQ view
async function loadDLQView() {
  const statsContainer = document.getElementById('dlq-stats');
  const entriesContainer = document.getElementById('dlq-entries');

  try {
    const data = await fetchAPI('/api/dlq?limit=50');

    // Render statistics
    renderDLQStats(statsContainer, data.stats);

    // Render entries
    renderDLQEntries(entriesContainer, data.entries);

  } catch (err) {
    console.error('[DLQ] Error loading DLQ view:', err);
    showError(entriesContainer, err.message);
  }
}

// Render DLQ statistics
function renderDLQStats(container, stats) {
  if (!stats) {
    container.innerHTML = '';
    return;
  }

  const html = `
    <div class="summary-card error">
      <h3>Total Failed</h3>
      <div class="value">${stats.total}</div>
    </div>
    <div class="summary-card error">
      <h3>Failed</h3>
      <div class="value">${stats.byStatus?.failed || 0}</div>
    </div>
    <div class="summary-card warning">
      <h3>Replaying</h3>
      <div class="value">${stats.byStatus?.replaying || 0}</div>
    </div>
    <div class="summary-card healthy">
      <h3>Resolved</h3>
      <div class="value">${stats.byStatus?.resolved || 0}</div>
    </div>
  `;
  container.innerHTML = html;
}

// Render DLQ entries
function renderDLQEntries(container, entries) {
  if (!entries || entries.length === 0) {
    showEmpty(container, 'No failed operations in DLQ');
    return;
  }

  const html = entries.map(entry => {
    const status = entry.status || 'failed';
    const statusBadgeClass = {
      'failed': 'error',
      'replaying': 'warning',
      'resolved': 'healthy'
    }[status] || 'unknown';

    return `
      <div class="dlq-entry">
        <div class="dlq-entry-header">
          <div class="dlq-entry-title">
            <strong>${entry.operation || 'Unknown Operation'}</strong>
            <span class="status-badge ${statusBadgeClass}">${status}</span>
          </div>
          <div class="timestamp">${formatTimestamp(entry.timestamp)}</div>
        </div>
        <div class="dlq-entry-details">
          <div><strong>Module:</strong> ${entry.module || 'unknown'}</div>
          <div><strong>ID:</strong> ${entry.id || 'N/A'}</div>
          ${entry.attempts ? `<div><strong>Attempts:</strong> ${entry.attempts}</div>` : ''}
          ${entry.error ? `
            <div style="margin-top: 10px;">
              <strong>Error:</strong>
              <pre>${JSON.stringify(entry.error, null, 2)}</pre>
            </div>
          ` : ''}
          ${entry.payload ? `
            <details style="margin-top: 10px;">
              <summary><strong>Payload</strong></summary>
              <pre>${JSON.stringify(entry.payload, null, 2)}</pre>
            </details>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = html;
}

// Setup event listeners
document.addEventListener('DOMContentLoaded', () => {
  const refreshBtn = document.getElementById('refresh-dlq');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      console.log('[DLQ] Refreshing...');
      loadDLQView();
    });
  }
});

// Export for global access
window.loadDLQView = loadDLQView;
