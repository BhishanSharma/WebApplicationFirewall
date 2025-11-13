let recentRequests = [];
const MAX_RECENT = 20;

function updateUI() {
  browser.runtime.sendMessage({ action: 'getStats' }).then(stats => {
    document.getElementById('totalRequests').textContent = stats.totalRequests;
    document.getElementById('blockedRequests').textContent = stats.blockedRequests;
    document.getElementById('allowedRequests').textContent = stats.allowedRequests;
    
    // Update recent activity
    const activityContainer = document.getElementById('recentActivity');
    if (stats.recentThreats.length === 0 && stats.totalRequests === 0) {
      activityContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📊</div>
          <div>No requests yet</div>
        </div>
      `;
    } else {
      // Combine threats and allowed requests for activity feed
      const allActivity = [
        ...stats.recentThreats.map(t => ({...t, blocked: true})),
      ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 10);

      if (allActivity.length === 0) {
        activityContainer.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">✅</div>
            <div>All requests are clean</div>
          </div>
        `;
      } else {
        activityContainer.innerHTML = allActivity.map(item => {
          if (item.blocked) {
            return `
              <div class="threat-item">
                <div class="threat-header">
                  <div class="threat-time">${new Date(item.timestamp).toLocaleTimeString()}</div>
                  <div class="threat-badge">BLOCKED</div>
                </div>
                <div class="threat-type">${item.threats.join(', ')}</div>
                <div class="threat-url">${item.method}: ${item.url}</div>
              </div>
            `;
          }
        }).join('');
      }
    }
    
    // Update threats tab
    const threatsContainer = document.getElementById('threatsContainer');
    if (stats.recentThreats.length === 0) {
      threatsContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🛡️</div>
          <div>No threats detected yet</div>
        </div>
      `;
    } else {
      threatsContainer.innerHTML = stats.recentThreats.slice().reverse().map(threat => `
        <div class="threat-item">
          <div class="threat-header">
            <div class="threat-time">${new Date(threat.timestamp).toLocaleTimeString()}</div>
            <div class="threat-badge">BLOCKED</div>
          </div>
          <div class="threat-type">${threat.threats.join(', ')}</div>
          <div class="threat-url">${threat.method}: ${threat.url}</div>
        </div>
      `).join('');
    }
  });
  
  browser.runtime.sendMessage({ action: 'getRules' }).then(rules => {
    const rulesContainer = document.getElementById('rulesContainer');
    
    rulesContainer.innerHTML = Object.entries(rules).map(([key, rule]) => `
      <div class="rule">
        <div class="rule-info">
          <div class="rule-name">${rule.name}</div>
          <div class="rule-count">🚫 Blocked: ${rule.blocked || 0}</div>
        </div>
        <div class="toggle ${rule.enabled ? 'active' : ''}" data-rule="${key}">
          <div class="toggle-slider"></div>
        </div>
      </div>
    `).join('');
    
    document.querySelectorAll('.toggle').forEach(toggle => {
      toggle.addEventListener('click', () => {
        const rule = toggle.dataset.rule;
        browser.runtime.sendMessage({ action: 'toggleRule', rule }).then(() => {
          updateUI();
        });
      });
    });
  });
}

// Tab switching
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const tabName = tab.dataset.tab;
    
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    
    tab.classList.add('active');
    document.getElementById(tabName).classList.add('active');
  });
});

document.getElementById('clearBtn').addEventListener('click', () => {
  if (confirm('Clear all statistics and threat logs?')) {
    browser.runtime.sendMessage({ action: 'clearStats' }).then(() => {
      updateUI();
    });
  }
});

document.getElementById('refreshBtn').addEventListener('click', () => {
  updateUI();
});

updateUI();
setInterval(updateUI, 2000);
