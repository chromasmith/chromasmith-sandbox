/**
 * Health View Controller
 * Displays module health status and circuit breaker states
 */

const { fetchAPI, showError, showEmpty, formatTimestamp, timeAgo } = window.DashboardUtils;

// Load health view
async function loadHealthView() {
  const summaryContainer = document.getElementById('health-summary');
  const gridContainer = document.getElementById('health-grid');

  try {
    const data = await fetchAPI('/api/health');

    // Render summary cards
    renderHealthSummary(summaryContainer, data.summary);

    // Render module cards
    renderModuleGrid(gridContainer, data.modules);

  } catch (err) {
    console.error('[HEALTH] Error loading health view:', err);
    showError(gridContainer, err.message);
  }
}

// Render health summary
function renderHealthSummary(container, summary) {
  const html = `
    <div class="summary-card healthy">
      <h3>Healthy</h3>
      <div class="value">${summary.healthy}</div>
    </div>
    <div class="summary-card warning">
      <h3>Degraded</h3>
      <div class="value">${summary.degraded}</div>
    </div>
    <div class="summary-card error">
      <h3>Down</h3>
      <div class="value">${summary.down}</div>
    </div>
    <div class="summary-card">
      <h3>Total Modules</h3>
      <div class="value">${summary.total}</div>
    </div>
  `;
  container.innerHTML = html;
}

// Render module grid
function renderModuleGrid(container, modules) {
  if (!modules || modules.length === 0) {
    showEmpty(container, 'No module data available');
    return;
  }

  const html = modules.map(module => {
    const statusClass = module.status || 'unknown';
    const circuitClass = module.circuitBreaker || 'CLOSED';

    return `
      <div class="module-card ${statusClass}">
        <div class="module-header">
          <span class="module-name">${module.name}</span>
          <span class="status-badge ${statusClass}">${statusClass}</span>
        </div>
        <div class="module-details">
          <div>
            <strong>Circuit Breaker:</strong>
            <span class="circuit-badge ${circuitClass}">${circuitClass}</span>
          </div>
          <div>
            <strong>Safe Mode:</strong> ${module.safeMode ? '🟡 Enabled' : '🟢 Disabled'}
          </div>
          <div>
            <strong>Error Count:</strong> ${module.errorCount || 0}
          </div>
          <div>
            <strong>Last Check:</strong> ${timeAgo(module.lastCheck)}
          </div>
          <div>
            <strong>Last Success:</strong> ${timeAgo(module.lastSuccess)}
          </div>
          ${module.message !== 'OK' ? `
            <div style="margin-top: 10px; padding: 8px; background: rgba(0,0,0,0.05); border-radius: 4px;">
              <strong>Message:</strong> ${module.message}
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = html;
}

// Setup refresh button
document.addEventListener('DOMContentLoaded', () => {
  const refreshBtn = document.getElementById('refresh-health');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      console.log('[HEALTH] Refreshing...');
      loadHealthView();
    });
  }
});

// Export for global access
window.loadHealthView = loadHealthView;
