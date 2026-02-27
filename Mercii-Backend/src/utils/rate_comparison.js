const { makeUSIRequest } = require('../services/usi');
const { apiService } = require('./axios');
const { getCache, setCache } = require('./cache');
const axios = require('axios');
let cheerio;
let puppeteer;
try { cheerio = require('cheerio'); } catch (_) { /* optional */ }
try { puppeteer = require('puppeteer'); } catch (_) { /* optional */ }

const TTL_MS = 5 * 60 * 1000; // 5 minutes

function buildCacheKey(prefix, params) {
  return `${prefix}:${JSON.stringify(params)}`;
}
/*
HBL, rate: 380.87
WesternUnion, rate:380.00

 */
// Map full country names/codes to ISO code
const countryMap = {
  'pakistan': 'PK',
  'pk': 'PK',
  'india': 'IN',
  'in': 'IN',
  // Add more as needed
};
const currencyMap = {
  PK: 'PKR',
  IN: 'INR',
  // ...
};

function getCountryCode(dest_country) {
  if (!dest_country) return '';
  const lower = dest_country.trim().toLowerCase();
  return countryMap[lower] || dest_country.toUpperCase();
}

function inferDestCurrency(dest_country_code) {
  return currencyMap[dest_country_code] || 'USD';
}

function toNumberSafe(v) {
  if (v === null || v === undefined) return null;
  const n = Number(String(v).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

// Adjustable Offsets via ENV
// Configure per-provider flat adjustments without code changes.
// Examples:
// RATE_ADJUST_USI=20         FEE_ADJUST_USI=1.5
// RATE_ADJUST_WISE=-1.2      FEE_ADJUST_WISE=0.3
// RATE_ADJUST_REVOLUT=0      FEE_ADJUST_REVOLUT=0
// RATE_ADJUST_REMITLY=0.5    FEE_ADJUST_REMITLY=0
// RATE_ADJUST_HBL=0          FEE_ADJUST_HBL=0
// RATE_ADJUST_WESTERNUNION=0 FEE_ADJUST_WESTERNUNION=0
const PROVIDER_ENV_KEYS = {
  USI: 'USI',
  Wise: 'WISE',
  Revolut: 'REVOLUT',
  Remitly: 'REMITLY',
  HBL: 'HBL',
  WesternUnion: 'WESTERNUNION',
};

function getAdjustments(provider) {
  const key = PROVIDER_ENV_KEYS[provider] || provider.toUpperCase();
  const rateAdj = toNumberSafe(process.env[`RATE_ADJUST_${key}`]) ?? 0;
  const feeAdj = toNumberSafe(process.env[`FEE_ADJUST_${key}`]) ?? 0;
  return {
    rateAdj: rateAdj || 0,
    feeAdj: feeAdj || 0,
  };
}

function applyAdjustments(provider, payload) {
  const { rateAdj, feeAdj } = getAdjustments(provider);
  const currentRate = toNumberSafe(payload.rate);
  const currentFee = toNumberSafe(payload.fee);

  let adjustedRate = payload.rate;
  if (currentRate !== null) {
    adjustedRate = Math.max(0, currentRate + rateAdj);
    // keep reasonable precision for FX rates
    adjustedRate = +adjustedRate.toFixed(6);
  }

  let adjustedFee = payload.fee;
  if (currentFee !== null) {
    adjustedFee = Math.max(0, currentFee + feeAdj);
    adjustedFee = +adjustedFee.toFixed(2);
  }

  // Recompute payout based on adjusted rate if amount present
  let payout = payload.payout_amount;
  const amt = toNumberSafe(payload.amount);
  if (amt !== null && toNumberSafe(adjustedRate) !== null) {
    payout = +((adjustedRate) * amt).toFixed(2);
  }

  return {
    ...payload,
    rate: adjustedRate,
    fee: adjustedFee,
    payout_amount: payout,
  };
}

function pickRateFromUSI(result) {
  // Existing logic...
  const candidates = [
    result?.rate,
    result?.rates?.rate,
    result?.result?.rate,
    result?.result?.rates?.rate,
    result?.exchange_rate,
    result?.result?.exchange_rate,
  ];
  for (const c of candidates) {
    const n = toNumberSafe(c);
    if (n) return n;
  }
  const scan = JSON.stringify(result || {});
  const match = scan.match(/\b(\d+\.\d{2,})\b/);
  if (match) return parseFloat(match[1]);
  return null;
}

// Helper to extract with regex from full page text
function extractWithRegex(fullText, patterns) {
  for (const { key, regex } of patterns) {
    const match = fullText.match(regex);
    if (match) return { [key]: toNumberSafe(match[1]) };
  }
  return {};
}

async function getUSIRate({ amount, source_currency, dest_currency, dest_country, delivery_bank_name }) {
  const dest_country_code = getCountryCode(dest_country);
  
  // FIX 1: USI API expects full country name, not ISO code
  const params = { 
    dest_country: dest_country, // Use original country name, not code
    source_currency, 
    dest_currency 
  };
  if (delivery_bank_name) params['Delivery Bank Name'] = delivery_bank_name;

  const cacheKey = buildCacheKey('USI', { amount, source_currency, dest_currency, dest_country: dest_country_code, delivery_bank_name });
  const cached = getCache(cacheKey);
  if (cached) return cached;

  try {
    console.log('USI params:', params); // Debug
    const { success, result } = await makeUSIRequest('rates', 'getRates', params);
    if (!success) {
      console.error('USI API Error:', result);
      const failed = { rate: 'N/A', fee: 'N/A', deliveryTime: 'N/A', provider: 'USI' };
      setCache(cacheKey, failed, TTL_MS);
      return failed;
    }
    const rate = pickRateFromUSI(result);
    const numericRate = toNumberSafe(rate);
    if (numericRate && numericRate < 300) console.warn('USI rate suspiciously low:', numericRate);
    const payout = numericRate ? +(numericRate * amount).toFixed(2) : null;
    let payload = {
      provider: 'USI',
      rate: numericRate ?? 'N/A',
      fee: 0,
      deliveryTime: 'N/A',
      amount,
      payout_amount: payout ?? 'N/A',
      meta: { source_currency, dest_currency, dest_country: dest_country_code, delivery_bank_name }
    };
    payload = applyAdjustments('USI', payload);
    setCache(cacheKey, payload, TTL_MS);
    return payload;
  } catch (error) {
    console.error('USI rate fetch error:', error);
    const failed = { rate: 'N/A', fee: 'N/A', deliveryTime: 'N/A', provider: 'USI' };
    setCache(cacheKey, failed, TTL_MS);
    return failed;
  }
}

async function getWiseRate({ amount, source_currency, dest_currency }) {
  const cacheKey = buildCacheKey('WISE', { amount, source_currency, dest_currency });
  const cached = getCache(cacheKey);
  if (cached) return cached;

  if (!puppeteer || process.env.USE_SCRAPING !== 'true') {
    return fallbackMidMarket(source_currency, dest_currency, amount);
  }

  try {
    console.log('USE_SCRAPING:', process.env.USE_SCRAPING);
console.log('CHROME PATH:', process.env.PUPPETEER_EXECUTABLE_PATH);

    const launchOptions = {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    };
    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
      launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    }
    const browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();
    
    // Set user agent to avoid detection
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
    
    const url = `https://wise.com/gb/currency-converter/${source_currency.toLowerCase()}-to-${dest_currency.toLowerCase()}-rate?amount=${amount}`;
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    // Use page.waitForTimeout replacement
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Get full text for regex fallback
    const fullText = await page.evaluate(() => document.body.innerText);

    // Try specific selector first
    let rateText = null;
    try {
      rateText = await page.$eval('.u-baseRateConversion__rate-value', el => {
        const match = el.textContent.match(/(\d+\.\d+)/);
        return match ? match[1] : null;
      });
    } catch (_) {
      // Try alternative selectors
      const selectors = [
        '.rate-value',
        '[data-testid="rate-value"]',
        '.exchange-rate-value'
      ];
      
      for (const selector of selectors) {
        try {
          rateText = await page.$eval(selector, el => {
            const match = el.textContent.match(/(\d+\.\d+)/);
            return match ? match[1] : null;
          });
          if (rateText) break;
        } catch (_) { continue; }
      }
    }
    
    if (!rateText) {
      // Regex fallback
      const extracted = extractWithRegex(fullText, [
        { key: 'rate', regex: new RegExp(`1\\s*${source_currency}\\s*=\\s*(\\d+\\.\\d+)\\s*${dest_currency}`, 'i') }
      ]);
      rateText = extracted.rate;
    }
    const rate = toNumberSafe(rateText);

    let feeText = null;
    try {
      feeText = await page.$eval('[data-testid="total-fees"]', el => {
        const match = el.textContent.match(/(\d+\.\d+)/);
        return match ? match[1] : null;
      });
    } catch (_) {
      // Regex for fee
      const extracted = extractWithRegex(fullText, [
        { key: 'fee', regex: /Total fees?[:\s]*[£$]?(\d+\.\d+)/i }
      ]);
      feeText = extracted.fee;
    }
    const fee = toNumberSafe(feeText) || 0.65;

    const deliveryTime = 'N/A';

    await browser.close();

    const payout = rate ? +(rate * amount).toFixed(2) : 'N/A';
    let payload = { provider: 'Wise', rate: rate ?? 'N/A', fee, deliveryTime, amount, payout_amount: payout };
    payload = applyAdjustments('Wise', payload);
    setCache(cacheKey, payload, TTL_MS);
    return payload;
  } catch (e) {
    console.error('Wise scraping error:', e.message);
    return fallbackMidMarket(source_currency, dest_currency, amount);
  }
}

async function getRevolutRate({ amount, source_currency, dest_currency }) {
  const cacheKey = buildCacheKey('REVOLUT', { amount, source_currency, dest_currency });
  const cached = getCache(cacheKey);
  if (cached) return cached;

  if (!puppeteer || process.env.USE_SCRAPING !== 'true') {
    return fallbackMidMarket(source_currency, dest_currency, amount);
  }

  try {
    const launchOptions = {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    };
    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
      launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    }
    const browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
    
    const url = `https://www.revolut.com/currency-converter/convert-${source_currency.toLowerCase()}-to-${dest_currency.toLowerCase()}-exchange-rate/?amount=${amount}`;
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    
    await new Promise(resolve => setTimeout(resolve, 5000));

    const fullText = await page.evaluate(() => document.body.innerText);

    let rateText = null;
    try {
      rateText = await page.$eval('[data-testid="rate-value"]', el => {
        const match = el.textContent.match(/(\d+\.\d+)/);
        return match ? match[1] : null;
      });
    } catch (_) {
      const extracted = extractWithRegex(fullText, [
        { key: 'rate', regex: new RegExp(`1\\s*${source_currency}\\s*=\\s*(\\d+\\.\\d+)\\s*${dest_currency}`, 'i') }
      ]);
      rateText = extracted.rate;
    }
    const rate = toNumberSafe(rateText);

    const fee = 0; // Standard no fee

    const deliveryTime = 'N/A';

    await browser.close();

    const payout = rate ? +(rate * amount).toFixed(2) : 'N/A';
    let payload = { provider: 'Revolut', rate: rate ?? 'N/A', fee, deliveryTime, amount, payout_amount: payout };
    payload = applyAdjustments('Revolut', payload);
    setCache(cacheKey, payload, TTL_MS);
    return payload;
  } catch (e) {
    console.error('Revolut scraping error:', e.message);
    return fallbackMidMarket(source_currency, dest_currency, amount);
  }
}

async function getRemitlyRate({ amount, source_currency, dest_currency }) {
  const cacheKey = buildCacheKey('REMITLY', { amount, source_currency, dest_currency });
  const cached = getCache(cacheKey);
  if (cached) return cached;

  if (!puppeteer || process.env.USE_SCRAPING !== 'true') {
    return fallbackMidMarket(source_currency, dest_currency, amount);
  }

  try {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
    
    const url = `https://www.remitly.com/gb/en/currency-converter/${source_currency.toLowerCase()}-to-${dest_currency.toLowerCase()}-rate?amount=${amount}`;
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Type amount if needed
    try {
      await page.waitForSelector('input[placeholder*="amount"]', { timeout: 10000 });
      await page.type('input[placeholder*="amount"]', amount.toString());
      await new Promise(resolve => setTimeout(resolve, 3000));
    } catch (_) {
      // Amount input not found or not needed
    }

    const fullText = await page.evaluate(() => document.body.innerText);

    let rateText = null;
    try {
      const recipientAmount = await page.$eval('[data-testid="recipient-amount"]', el => el.textContent);
      const recipientNum = toNumberSafe(recipientAmount);
      if (recipientNum) {
        rateText = (recipientNum / amount).toString();
      }
    } catch (_) {
      const extracted = extractWithRegex(fullText, [
        { key: 'rate', regex: new RegExp(`1\\s*${source_currency}\\s*=\\s*(\\d+\\.\\d+)\\s*${dest_currency}`, 'i') }
      ]);
      rateText = extracted.rate;
    }
    const rate = toNumberSafe(rateText);

    let feeText = null;
    try {
      feeText = await page.$eval('[data-testid="fee-amount"]', el => {
        const match = el.textContent.match(/(\d+\.\d+)/);
        return match ? match[1] : null;
      });
    } catch (_) {
      const extracted = extractWithRegex(fullText, [
        { key: 'fee', regex: /fee[:\s]*[£$]?(\d+\.\d+)/i }
      ]);
      feeText = extracted.fee;
    }
    const fee = toNumberSafe(feeText) || 0;

    const deliveryTime = 'N/A';

    await browser.close();

    const payout = rate ? +(rate * amount).toFixed(2) : 'N/A';
    let payload = { provider: 'Remitly', rate: rate ?? 'N/A', fee, deliveryTime, amount, payout_amount: payout };
    payload = applyAdjustments('Remitly', payload);
    setCache(cacheKey, payload, TTL_MS);
    return payload;
  } catch (e) {
    console.error('Remitly scraping error:', e.message);
    return fallbackMidMarket(source_currency, dest_currency, amount);
  }
}

// FIX 2: Implement proper HBL rate fetching
async function getHBLRate({ amount, source_currency, dest_currency, dest_country }) {
  const cacheKey = buildCacheKey('HBL', { amount, source_currency, dest_currency });
  const cached = getCache(cacheKey);
  if (cached) return cached;

  // If HBL has an API, implement it here
  // Otherwise, implement web scraping similar to other providers
  if (!puppeteer || process.env.USE_SCRAPING !== 'true') {
    return fallbackMidMarket(source_currency, dest_currency, amount, 'HBL');
  }

  try {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
    
    // HBL Exchange rates page - adjust URL as needed
    const url = `https://www.hbl.com/exchange-rates/`; // Adjust this URL
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    
    await new Promise(resolve => setTimeout(resolve, 5000));

    const fullText = await page.evaluate(() => document.body.innerText);

    // Extract HBL rate - adjust selectors based on actual HBL website
    let rateText = null;
    try {
      // Try common selectors for exchange rates
      const selectors = [
        `.${source_currency}-${dest_currency}`,
        `[data-currency="${source_currency}"]`,
        `.rate-${source_currency}`,
        '.exchange-rate'
      ];
      
      for (const selector of selectors) {
        try {
          rateText = await page.$eval(selector, el => {
            const match = el.textContent.match(/(\d+\.\d+)/);
            return match ? match[1] : null;
          });
          if (rateText) break;
        } catch (_) { continue; }
      }
    } catch (_) {
      // Regex fallback for HBL rates
      const patterns = [
        { key: 'rate', regex: new RegExp(`${source_currency}.*?(\\d+\\.\\d+).*?${dest_currency}`, 'i') },
        { key: 'rate', regex: new RegExp(`1\\s*${source_currency}\\s*=\\s*(\\d+\\.\\d+)\\s*${dest_currency}`, 'i') }
      ];
      const extracted = extractWithRegex(fullText, patterns);
      rateText = extracted.rate;
    }
    
    const rate = toNumberSafe(rateText);
    const fee = 5.00; // Default HBL fee - adjust as needed

    await browser.close();

    const payout = rate ? +(rate * amount).toFixed(2) : 'N/A';
    let payload = { 
      provider: 'HBL', 
      rate: rate ?? 'N/A', 
      fee, 
      deliveryTime: '1-2 business days', 
      amount, 
      payout_amount: payout 
    };
    payload = applyAdjustments('HBL', payload);
    setCache(cacheKey, payload, TTL_MS);
    return payload;
  } catch (e) {
    console.error('HBL rate fetch error:', e.message);
    return fallbackMidMarket(source_currency, dest_currency, amount, 'HBL');
  }
}

// FIX 3: Improve Western Union scraping with better selectors and error handling
async function getWURate({ amount, source_currency, dest_currency, dest_country }) {
  const cacheKey = buildCacheKey('WU', { amount, source_currency, dest_currency });
  const cached = getCache(cacheKey);
  if (cached) return cached;

  if (!puppeteer || process.env.USE_SCRAPING !== 'true') {
    return fallbackMidMarket(source_currency, dest_currency, amount, 'WesternUnion');
  }

  try {
    const browser = await puppeteer.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'] // Add these for better stability
    });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    
    // Better WU URL construction
    const countryCode = getCountryCode(dest_country) || 'PK';
    const url = `https://www.westernunion.com/gb/en/web/send-money/start?sendAmount=${amount}&sendCurrency=${source_currency}&receiveCountry=${countryCode}&receiveCurrency=${dest_currency}&payoutMethod=BANK_ACCOUNT`;
    
    console.log('WU URL:', url); // Debug log
    
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });
    
    // Wait longer for WU page to load completely
    await new Promise(resolve => setTimeout(resolve, 8000));

    const fullText = await page.evaluate(() => document.body.innerText);
    console.log('WU page loaded, searching for rates...'); // Debug log

    let rateText = null;
    let receivedAmount = null;
    
    try {
      // Try multiple selectors for WU exchange rate
      const rateSelectors = [
        '[data-testid="exchange-rate"]',
        '.exchange-rate',
        '.rate-display',
        '[class*="rate"]',
        '[class*="exchange"]'
      ];
      
      for (const selector of rateSelectors) {
        try {
          rateText = await page.$eval(selector, el => {
            const match = el.textContent.match(/(\d+\.\d+)/);
            return match ? match[1] : null;
          });
          if (rateText) {
            console.log('Found WU rate via selector:', selector, rateText);
            break;
          }
        } catch (_) { continue; }
      }
      
      // Try to get received amount directly
      if (!rateText) {
        const receivedSelectors = [
          '[data-testid="receive-amount"]',
          '.receive-amount',
          '[class*="receive"]'
        ];
        
        for (const selector of receivedSelectors) {
          try {
            const receivedText = await page.$eval(selector, el => el.textContent);
            receivedAmount = toNumberSafe(receivedText);
            if (receivedAmount) {
              rateText = (receivedAmount / amount).toString();
              console.log('Calculated WU rate from received amount:', rateText);
              break;
            }
          } catch (_) { continue; }
        }
      }
    } catch (_) {
      console.log('WU selector search failed, trying regex...');
    }
    
    if (!rateText) {
      // Enhanced regex patterns for Western Union
      const patterns = [
        { key: 'rate', regex: new RegExp(`Exchange rate[:\\s]*1\\s*${source_currency}\\s*=\\s*(\\d+\\.\\d+)\\s*${dest_currency}`, 'i') },
        { key: 'rate', regex: new RegExp(`1\\s*${source_currency}\\s*=\\s*(\\d+\\.\\d+)\\s*${dest_currency}`, 'i') },
        { key: 'rate', regex: new RegExp(`Rate[:\\s]*(\\d+\\.\\d+)`, 'i') },
        { key: 'received', regex: new RegExp(`Recipient gets[:\\s]*${dest_currency}[\\s]*(\\d+[,\\d]*\\.\\d+)`, 'i') }
      ];
      
      for (const { key, regex } of patterns) {
        const match = fullText.match(regex);
        if (match) {
          if (key === 'received') {
            const received = toNumberSafe(match[1]);
            if (received) {
              rateText = (received / amount).toString();
              console.log('WU rate calculated from received amount via regex:', rateText);
              break;
            }
          } else {
            rateText = match[1];
            console.log('WU rate found via regex:', rateText);
            break;
          }
        }
      }
    }
    
    const rate = toNumberSafe(rateText);

    // Extract fee
    let feeText = null;
    try {
      const feeSelectors = [
        '[data-testid="fee"]',
        '[data-testid="transfer-fee"]',
        '.fee-amount',
        '[class*="fee"]'
      ];
      
      for (const selector of feeSelectors) {
        try {
          feeText = await page.$eval(selector, el => {
            const match = el.textContent.match(/(\d+\.\d+)/);
            return match ? match[1] : null;
          });
          if (feeText) break;
        } catch (_) { continue; }
      }
    } catch (_) {
      // Regex for fee
      const feeMatch = fullText.match(/(?:fee|charge)[:\s]*[£$€]?(\d+\.\d+)/i);
      if (feeMatch) feeText = feeMatch[1];
    }
    
    const fee = toNumberSafe(feeText) || 4.50; // Default WU fee

    const deliveryTime = '1-2 business days'; // Typical WU delivery time

    await browser.close();

    const payout = rate ? +(rate * amount).toFixed(2) : 'N/A';
    let payload = { 
      provider: 'WesternUnion', 
      rate: rate ?? 'N/A', 
      fee, 
      deliveryTime, 
      amount, 
      payout_amount: payout 
    };
    
    console.log('WU final payload:', payload); // Debug log
    payload = applyAdjustments('WesternUnion', payload);
    setCache(cacheKey, payload, TTL_MS);
    return payload;
  } catch (e) {
    console.error('WesternUnion scraping error:', e.message);
    return fallbackMidMarket(source_currency, dest_currency, amount, 'WesternUnion');
  }
}

// FIX 4: Enhanced fallback with provider name
async function fallbackMidMarket(source_currency, dest_currency, amount, provider = 'MidMarket') {
  try {
    // Use exchangerate.host free API for reliable mid-market rate
    const { data } = await axios.get(
      `https://api.exchangerate.host/convert?amount=1&from=${source_currency}&to=${dest_currency}`,
      { timeout: 10000 }
    );
    const rate = toNumberSafe(data?.result);
    let payload = {
      provider: provider,
      rate: rate ?? 'N/A',
      fee: provider === 'HBL' ? 5.00 : (provider === 'WesternUnion' ? 4.50 : 0),
      deliveryTime: provider === 'HBL' || provider === 'WesternUnion' ? '1-2 business days' : 'N/A',
      amount,
      payout_amount: rate ? +(rate * amount).toFixed(2) : 'N/A'
    };
    if (provider !== 'MidMarket') {
      // Apply adjustments only when this fallback is representing a real provider
      payload = applyAdjustments(provider, payload);
    }
    return payload;
  } catch (error) {
    console.error(`${provider} fallback error:`, error.message);
    return {
      provider: provider,
      rate: 'N/A',
      fee: 'N/A',
      deliveryTime: 'N/A',
      amount,
      payout_amount: 'N/A'
    };
  }
}

async function compareRates({ amount = 100, source_currency = 'GBP', dest_currency, dest_country, delivery_bank_name }) {
  if (!dest_country) throw new Error('dest_country is required');
  
  const dest_country_code = getCountryCode(dest_country);
  const finalDestCurrency = dest_currency || inferDestCurrency(dest_country_code);
  
  // FIX 5: Pass original dest_country to USI, but use code for others
  const baseForUSI = { amount, source_currency, dest_currency: finalDestCurrency, dest_country, delivery_bank_name };
  const baseForOthers = { amount, source_currency, dest_currency: finalDestCurrency, dest_country: dest_country_code, delivery_bank_name };

  try {
    const [usi, wise, revolut, remitly, hbl, wu] = await Promise.all([
      getUSIRate(baseForUSI).catch(e => {
        console.error('USI error in Promise.all:', e);
        return { provider: 'USI', rate: 'N/A', fee: 'N/A', deliveryTime: 'N/A' };
      }),
      getWiseRate(baseForOthers).catch(e => {
        console.error('Wise error in Promise.all:', e);
        return { provider: 'Wise', rate: 'N/A', fee: 'N/A', deliveryTime: 'N/A' };
      }),
      getRevolutRate(baseForOthers).catch(e => {
        console.error('Revolut error in Promise.all:', e);
        return { provider: 'Revolut', rate: 'N/A', fee: 'N/A', deliveryTime: 'N/A' };
      }),
      getRemitlyRate(baseForOthers).catch(e => {
        console.error('Remitly error in Promise.all:', e);
        return { provider: 'Remitly', rate: 'N/A', fee: 'N/A', deliveryTime: 'N/A' };
      }),
      getHBLRate(baseForOthers).catch(e => {
        console.error('HBL error in Promise.all:', e);
        return { provider: 'HBL', rate: 'N/A', fee: 'N/A', deliveryTime: 'N/A' };
      }),
      getWURate(baseForOthers).catch(e => {
        console.error('WU error in Promise.all:', e);
        return { provider: 'WesternUnion', rate: 'N/A', fee: 'N/A', deliveryTime: 'N/A' };
      }),
    ]);

    return {
      USI: { 
        rate: usi?.rate ?? 'N/A', 
        fee: usi?.fee ?? 'N/A', 
        deliveryTime: usi?.deliveryTime ?? 'N/A' 
      },
      Wise: { 
        rate: wise?.rate ?? 'N/A', 
        fee: wise?.fee ?? 'N/A', 
        deliveryTime: wise?.deliveryTime ?? 'N/A' 
      },
      Revolut: { 
        rate: revolut?.rate ?? 'N/A', 
        fee: revolut?.fee ?? 'N/A', 
        deliveryTime: revolut?.deliveryTime ?? 'N/A' 
      },
      Remitly: { 
        rate: remitly?.rate ?? 'N/A', 
        fee: remitly?.fee ?? 'N/A', 
        deliveryTime: remitly?.deliveryTime ?? 'N/A' 
      },
      HBL: { 
        rate: hbl?.rate ?? 'N/A', 
        fee: hbl?.fee ?? 'N/A', 
        deliveryTime: hbl?.deliveryTime ?? 'N/A' 
      },
      WesternUnion: { 
        rate: wu?.rate ?? 'N/A', 
        fee: wu?.fee ?? 'N/A', 
        deliveryTime: wu?.deliveryTime ?? 'N/A' 
      },
    };
  } catch (error) {
    console.error('Compare rates error:', error);
    // Return fallback structure
    return {
      USI: { rate: 'N/A', fee: 'N/A', deliveryTime: 'N/A' },
      Wise: { rate: 'N/A', fee: 'N/A', deliveryTime: 'N/A' },
      Revolut: { rate: 'N/A', fee: 'N/A', deliveryTime: 'N/A' },
      Remitly: { rate: 'N/A', fee: 'N/A', deliveryTime: 'N/A' },
      HBL: { rate: 'N/A', fee: 'N/A', deliveryTime: 'N/A' },
      WesternUnion: { rate: 'N/A', fee: 'N/A', deliveryTime: 'N/A' },
    };
  }
}

module.exports = {
  compareRates,
};