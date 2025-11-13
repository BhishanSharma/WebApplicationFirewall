function updateUI() {
  browser.runtime.sendMessage({ action: 'getStats' }).then(stats => {
    document.getElementById('totalRequests').textContent = stats.totalRequests;
    document.getElementById('blockedRequests').textContent = stats.blockedRequests;
    
    const threatsContainer = document.getElementById('threatsContainer');
    if (stats.recentThreats.length === 0) {
      threatsContainer.innerHTML = '<div class="empty-state">✅ No threats blocked</div>';
    } else {
      threatsContainer.innerHTML = stats.recentThreats.slice(-5).reverse().map(threat => `
        <div class="threat-item">
          <div class="threat-time">🚫 ${new Date(threat.timestamp).toLocaleTimeString()}</div>
          <div><strong>${threat.threats.join(', ')}</strong></div>
          <div style="opacity: 0.7; margin-top: 4px; font-size: 11px;">${threat.method}: ${threat.url.substring(0, 45)}...</div>
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

document.getElementById('clearBtn').addEventListener('click', () => {
  browser.runtime.sendMessage({ action: 'clearStats' }).then(() => {
    updateUI();
  });
});

updateUI();
setInterval(updateUI, 2000);