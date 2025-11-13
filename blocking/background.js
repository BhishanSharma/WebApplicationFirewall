let stats = {
  totalRequests: 0,
  blockedRequests: 0,
  allowedRequests: 0,
  recentThreats: []
};

const securityRules = {
  sqlInjection: {
    enabled: true,
    pattern: /(\b(SELECT|UNION|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC)\b.*\b(FROM|WHERE|TABLE|DATABASE)\b)|(-{2})|(%27)|(')|(;)|(\bOR\b.*=.*)/i,
    name: 'SQL Injection',
    blocked: 0
  },
  xss: {
    enabled: true,
    pattern: /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>|javascript:|onerror=|onload=|<iframe|eval\(|expression\(/gi,
    name: 'Cross-Site Scripting (XSS)',
    blocked: 0
  },
  pathTraversal: {
    enabled: true,
    pattern: /(\.\.[\/\\])|(%2e%2e[\/\\])|(\.\.)(%2f|%5c)/i,
    name: 'Path Traversal',
    blocked: 0
  },
  commandInjection: {
    enabled: true,
    pattern: /[;&|`$]|\$\(|\bcat\b|\bls\b|\brm\b|\bwget\b|\bcurl\b/i,
    name: 'Command Injection',
    blocked: 0
  },
  xxe: {
    enabled: true,
    pattern: /<!DOCTYPE.*\[.*<!ENTITY/i,
    name: 'XML External Entity (XXE)',
    blocked: 0
  }
};

const rateLimitMap = new Map();
const RATE_LIMIT = 100; // requests per minute
const RATE_WINDOW = 60000; // 1 minute

function checkRateLimit(url) {
  try {
    const domain = new URL(url).hostname;
    const now = Date.now();
    
    if (!rateLimitMap.has(domain)) {
      rateLimitMap.set(domain, []);
    }
    
    let requests = rateLimitMap.get(domain);
    requests = requests.filter(time => now - time < RATE_WINDOW);
    requests.push(now);
    rateLimitMap.set(domain, requests);
    
    return requests.length > RATE_LIMIT;
  } catch (e) {
    return false;
  }
}

function analyzeRequest(details) {
  const threats = [];
  let shouldBlock = false;
  
  // Skip extension and browser URLs
  if (details.url.startsWith('moz-extension://') || 
      details.url.startsWith('about:') ||
      details.url.startsWith('chrome://')) {
    return { shouldBlock: false, threats: [] };
  }
  
  // Check rate limiting
  if (checkRateLimit(details.url)) {
    threats.push('Rate Limit Exceeded');
    shouldBlock = true;
  }
  
  // Analyze URL
  const urlToCheck = decodeURIComponent(details.url);
  
  // Check POST data if available
  let dataToCheck = '';
  if (details.requestBody) {
    if (details.requestBody.formData) {
      dataToCheck = JSON.stringify(details.requestBody.formData);
    } else if (details.requestBody.raw) {
      try {
        const decoder = new TextDecoder();
        dataToCheck = decoder.decode(details.requestBody.raw[0].bytes);
      } catch (e) {
        console.warn('Failed to decode request body:', e);
      }
    }
  }
  
  const fullData = `${urlToCheck} ${dataToCheck}`;
  
  // Check against security rules
  for (const [key, rule] of Object.entries(securityRules)) {
    if (rule.enabled && rule.pattern.test(fullData)) {
      threats.push(rule.name);
      shouldBlock = true;
      rule.blocked++;
    }
  }
  
  // Update stats
  stats.totalRequests++;
  if (shouldBlock) {
    stats.blockedRequests++;
    stats.recentThreats.push({
      timestamp: new Date().toISOString(),
      url: details.url,
      threats: threats,
      method: details.method
    });
    
    // Keep only last 50 threats
    if (stats.recentThreats.length > 50) {
      stats.recentThreats = stats.recentThreats.slice(-50);
    }
    
    // Show notification
    browser.tabs.query({active: true, currentWindow: true}).then(tabs => {
      if (tabs[0]) {
        browser.tabs.sendMessage(tabs[0].id, {
          action: 'showWarning',
          url: details.url,
          threats: threats
        }).catch(() => {}); // Ignore if content script not ready
      }
    });
  } else {
    stats.allowedRequests++;
  }
  
  // Save stats periodically
  browser.storage.local.set({ stats, rules: securityRules });
  
  return { shouldBlock, threats };
}

// *** THIS IS THE KEY - ACTUAL BLOCKING IN FIREFOX ***
browser.webRequest.onBeforeRequest.addListener(
  function(details) {
    const result = analyzeRequest(details);
    
    if (result.shouldBlock) {
      console.warn('🛡️ WAF BLOCKED:', details.url, result.threats);
      return { cancel: true }; // ACTUALLY BLOCKS THE REQUEST
    }
    
    return { cancel: false };
  },
  { urls: ["<all_urls>"] },
  ["blocking", "requestBody"] // "blocking" works in Firefox!
);

// Listen for messages from popup
browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getStats') {
    sendResponse(stats);
  } else if (request.action === 'toggleRule') {
    if (securityRules[request.rule]) {
      securityRules[request.rule].enabled = !securityRules[request.rule].enabled;
      browser.storage.local.set({ rules: securityRules });
      sendResponse({ success: true, rules: securityRules });
    }
  } else if (request.action === 'getRules') {
    sendResponse(securityRules);
  } else if (request.action === 'clearStats') {
    stats = {
      totalRequests: 0,
      blockedRequests: 0,
      allowedRequests: 0,
      recentThreats: []
    };
    // Reset rule counts
    for (const rule of Object.values(securityRules)) {
      rule.blocked = 0;
    }
    browser.storage.local.set({ stats, rules: securityRules });
    sendResponse({ success: true });
  }
  return true;
});

// Load saved rules and stats on startup
browser.storage.local.get(['rules', 'stats']).then(result => {
  if (result.rules) {
    Object.assign(securityRules, result.rules);
  }
  if (result.stats) {
    Object.assign(stats, result.stats);
  }
});
