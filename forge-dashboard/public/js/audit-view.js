/**
 * Audit View Controller
 * Displays audit log with filtering and pagination
 */

const { fetchAPI, showError, showEmpty, formatTimestamp } = window.DashboardUtils;

let currentPage = 1;
let currentModule = '';

// Load audit view
async function loadAuditView(page = 1, module = '') {
  const tableContainer = document.getElementById('audit-table-container');
  const paginationContainer = document.getElementById('audit-pagination');

  currentPage = page;
  currentModule = module;

  try {
    // Fetch audit data
    const url = `/api/audit?page=${page}&perPage=20${module ? `&module=${module}` : ''}`;
    const data = await fetchAPI(url);

    // Render table
    renderAuditTable(tableContainer, data.entries);

    // Render pagination
    renderPagination(paginationContainer, data);

    // Load modules for filter
    await loadModuleFilter();

  } catch (err) {
    console.error('[AUDIT] Error loading audit view:', err);
    showError(tableContainer, err.message);
  }
}

// Render audit table
function renderAuditTable(container, entries) {
  if (!entries || entries.length === 0) {
    showEmpty(container, 'No audit entries found');
    return;
  }

  const rows = entries.map(entry => {
    const statusClass = entry.status === 'success' ? 'healthy' : 'error';
    return `
      <tr>
        <td class="timestamp">${formatTimestamp(entry.timestamp)}</td>
        <td><strong>${entry.module || 'unknown'}</strong></td>
        <td>${entry.action || 'N/A'}</td>
        <td><span class="status-badge ${statusClass}">${entry.status || 'unknown'}</span></td>
        <td style="max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
          ${entry.message || entry.error || ''}
        </td>
      </tr>
    `;
  }).join('');

  container.innerHTML = `
    <table class="audit-table">
      <thead>
        <tr>
          <th>Timestamp</th>
          <th>Module</th>
          <th>Action</th>
          <th>Status</th>
          <th>Details</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
}

// Render pagination
function renderPagination(container, data) {
  const { page, totalPages, total } = data;

  if (totalPages <= 1) {
    container.innerHTML = '';
    return;
  }

  const pages = [];
  for (let i = 1; i <= Math.min(totalPages, 10); i++) {
    pages.push(`
      <button class="page-btn ${i === page ? 'active' : ''}" 
              onclick="loadAuditView(${i}, '${currentModule}')">
        ${i}
      </button>
    `);
  }

  container.innerHTML = `
    <button class="page-btn" 
            ${page === 1 ? 'disabled' : ''} 
            onclick="loadAuditView(${page - 1}, '${currentModule}')">
      ← Previous
    </button>
    ${pages.join('')}
    <span class="page-info">Page ${page} of ${totalPages} (${total} total)</span>
    <button class="page-btn" 
            ${page === totalPages ? 'disabled' : ''} 
            onclick="loadAuditView(${page + 1}, '${currentModule}')">
      Next →
    </button>
  `;
}

// Load module filter options
async function loadModuleFilter() {
  try {
    const data = await fetchAPI('/api/audit/modules');
    const select = document.getElementById('audit-module-filter');

    if (data.modules && data.modules.length > 0) {
      const options = data.modules.map(m => 
        `<option value="${m}" ${m === currentModule ? 'selected' : ''}>${m}</option>`
      ).join('');
      
      select.innerHTML = '<option value="">All Modules</option>' + options;
    }
  } catch (err) {
    console.error('[AUDIT] Error loading module filter:', err);
  }
}

// Setup event listeners
document.addEventListener('DOMContentLoaded', () => {
  // Refresh button
  const refreshBtn = document.getElementById('refresh-audit');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      console.log('[AUDIT] Refreshing...');
      loadAuditView(currentPage, currentModule);
    });
  }

  // Module filter
  const moduleFilter = document.getElementById('audit-module-filter');
  if (moduleFilter) {
    moduleFilter.addEventListener('change', (e) => {
      loadAuditView(1, e.target.value);
    });
  }
});

// Export for global access
window.loadAuditView = loadAuditView;
