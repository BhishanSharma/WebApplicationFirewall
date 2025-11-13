browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'showWarning') {
    const banner = document.createElement('div');
    banner.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      background: linear-gradient(135deg, #ef4444, #dc2626);
      color: white;
      padding: 12px 20px;
      z-index: 999999;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 14px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      display: flex;
      align-items: center;
      gap: 10px;
    `;
    
    banner.innerHTML = `
      <span style="font-size: 20px;">🛡️</span>
      <div style="flex: 1;">
        <strong>Blocked by WAF:</strong> ${request.threats.join(', ')}
        <div style="font-size: 12px; opacity: 0.9; margin-top: 4px;">🚫 Request blocked: ${request.url.substring(0, 80)}...</div>
      </div>
      <button id="waf-close-btn" style="background: rgba(255,255,255,0.2); border: none; color: white; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px;">Close</button>
    `;
    
    document.body.appendChild(banner);
    
    setTimeout(() => banner.remove(), 5000);
    
    document.getElementById('waf-close-btn')?.addEventListener('click', () => {
      banner.remove();
    });
  }
});