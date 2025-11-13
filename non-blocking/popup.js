function updateUI() {
  // Request current statistics from the background service worker
  chrome.runtime.sendMessage({ action: 'getStats' }, (stats) => {
    // Update the request counter displays
    document.getElementById('totalRequests').textContent = stats.totalRequests;
    document.getElementById('blockedRequests').textContent = stats.blockedRequests;
    
    // Display recent threats
    const threatsContainer = document.getElementById('threatsContainer');
    if (stats.recentThreats.length === 0) {
      threatsContainer.innerHTML = '<div class="empty-state">✅ No threats detected</div>';
    } else {
      // Show the 5 most recent threats
      threatsContainer.innerHTML = stats.recentThreats.slice(-5).reverse().map(threat => `
        <div class="threat-item">
          <div class="threat-time">${new Date(threat.timestamp).toLocaleTimeString()}</div>
          <div><strong>${threat.threats.join(', ')}</strong></div>
          <div style="opacity: 0.7; margin-top: 4px; font-size: 11px;">${threat.method}: ${threat.url.substring(0, 45)}...</div>
        </div>
      `).join('');
    }
  });
  
  // Request current security rules configuration
  chrome.runtime.sendMessage({ action: 'getRules' }, (rules) => {
    const rulesContainer = document.getElementById('rulesContainer');
    
    // Display each security rule with toggle switch
    rulesContainer.innerHTML = Object.entries(rules).map(([key, rule]) => `
      <div class="rule">
        <div class="rule-info">
          <div class="rule-name">${rule.name}</div>
          <div class="rule-count">Blocked: ${rule.blocked || 0}</div>
        </div>
        <div class="toggle ${rule.enabled ? 'active' : ''}" data-rule="${key}">
          <div class="toggle-slider"></div>
        </div>
      </div>
    `).join('');
    
    // Add click handlers to toggle switches
    document.querySelectorAll('.toggle').forEach(toggle => {
      toggle.addEventListener('click', () => {
        const rule = toggle.dataset.rule;
        chrome.runtime.sendMessage({ action: 'toggleRule', rule }, () => {
          updateUI(); // Refresh UI after toggling
        });
      });
    });
  });
}

// Clear statistics button
document.getElementById('clearBtn').addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'clearStats' }, () => {
    updateUI(); // Refresh UI after clearing
  });
});

// Initial UI update
updateUI();

// Auto-refresh every 2 seconds to show new threats
setInterval(updateUI, 2000);