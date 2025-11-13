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
  
  // Check rate limiting
  if (checkRateLimit(details.url)) {
    threats.push('Rate Limit Exceeded');
    shouldBlock = true;
  }
  
  // Analyze URL
  const urlToCheck = decodeURIComponent(details.url);
  
  // Check against security rules
  for (const [key, rule] of Object.entries(securityRules)) {
    if (rule.enabled && rule.pattern.test(urlToCheck)) {
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
  } else {
    stats.allowedRequests++;
  }
  
  // Save stats periodically
  chrome.storage.local.set({ stats, rules: securityRules });
  
  return { shouldBlock, threats };
}

// Monitor requests (non-blocking observation)
chrome.webRequest.onBeforeRequest.addListener(
  function(details) {
    // Skip chrome:// and extension URLs
    if (details.url.startsWith('chrome://') || 
        details.url.startsWith('chrome-extension://')) {
      return;
    }

    const result = analyzeRequest(details);
    
    if (result.shouldBlock) {
      console.warn('WAF: Threat detected', details.url, result.threats);
      
      // Show notification
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, {
            action: 'showWarning',
            url: details.url,
            threats: result.threats
          }).catch(() => {}); // Ignore errors if content script not loaded
        }
      });
    }
  },
  { urls: ["<all_urls>"] }
);

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getStats') {
    sendResponse(stats);
  } else if (request.action === 'toggleRule') {
    if (securityRules[request.rule]) {
      securityRules[request.rule].enabled = !securityRules[request.rule].enabled;
      chrome.storage.local.set({ rules: securityRules });
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
    chrome.storage.local.set({ stats, rules: securityRules });
    sendResponse({ success: true });
  }
  return true;
});

// Load saved rules and stats on startup
chrome.storage.local.get(['rules', 'stats'], (result) => {
  if (result.rules) {
    Object.assign(securityRules, result.rules);
  }
  if (result.stats) {
    Object.assign(stats, result.stats);
  }
});