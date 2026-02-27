const { Op } = require('sequelize');
const db = require('../models');
const { MODELS } = require('../utils/constants');

function getUKNow() {
  // Return a Date representing current instant; use with formatToParts for UK-local fields
  return new Date();
}

function londonMidnight(year, monthZeroBased, day) {
  // Create a UTC timestamp for the given date at 00:00:00 UTC
  const utcMs = Date.UTC(year, monthZeroBased, day, 0, 0, 0);
  const dtf = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = dtf.formatToParts(new Date(utcMs));
  const get = (t) => Number(parts.find(p => p.type === t)?.value || 0);
  const hour = get('hour');
  const minute = get('minute');
  const second = get('second');
  // Subtract the local time-of-day to arrive at 00:00:00 Europe/London for that calendar date
  const adjustMs = ((hour * 60 + minute) * 60 + second) * 1000;
  return new Date(utcMs - adjustMs);
}

function getAnchorDayFromUser(user) {
  // Derive user's signup day in UK local calendar using formatToParts
  const dtf = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', day: '2-digit' });
  const parts = dtf.formatToParts(new Date(user.createdAt));
  let anchor = Number(parts.find(p => p.type === 'day')?.value || 1);
  // Clamp to 28 to avoid months without 29/30/31
  if (anchor > 28) anchor = 28;
  return anchor;
}

function getCurrentAnchorWindowUK(user) {
  const now = getUKNow();
  // Get UK-local Y/M/D via formatToParts
  const dtf = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' });
  const parts = dtf.formatToParts(now);
  const year = Number(parts.find(p => p.type === 'year')?.value);
  const month = Number(parts.find(p => p.type === 'month')?.value) - 1; // zero-based
  const today = Number(parts.find(p => p.type === 'day')?.value);
  const anchorDay = getAnchorDayFromUser(user);

  let startYear = year;
  let startMonth = month;
  if (today < anchorDay) {
    // window started last month on anchor day
    if (startMonth === 0) { startMonth = 11; startYear -= 1; } else { startMonth -= 1; }
  }
  const startDay = anchorDay;

  // Compute next anchor
  let endYear = startYear;
  let endMonth = startMonth + 1;
  if (endMonth > 11) { endMonth = 0; endYear += 1; }
  const endDay = anchorDay;

  const startUK = londonMidnight(startYear, startMonth, startDay);
  const endUK = londonMidnight(endYear, endMonth, endDay);
  return { startUK, endUK };
}

async function getUserMonthlyUsedGBP(userId, user) {
  const { startUK, endUK } = getCurrentAnchorWindowUK(user);
  const total = await db[MODELS.TRANSACTION].sum('amount', {
    where: {
      userId,
      createdAt: { [Op.gte]: startUK, [Op.lt]: endUK },
    },
  });
  return Number(total || 0);
}

async function hasKycResidency(userId) {
  // Check latest KYC row; if postcode, address, and city are all non-null/non-empty
  const latest = await db[MODELS.KYC_REQUEST].findOne({
    where: { userId },
    order: [['createdAt', 'DESC']],
  });
  if (!latest) return false;
  const ok = [latest.postcode, latest.address, latest.city].every(v => v !== null && v !== undefined && String(v).trim() !== '');
  return ok;
}

async function enforceMonthlyLimitOrThrow(req, amountGBP) {
  const user = req.user;
  if (!user) return; // let auth layer handle

  // Unlimited cases
  if (user.plan === 'plus') return;
  if (await hasKycResidency(user.id)) return;

  // Apply £5,000 cap per anchor window
  const used = await getUserMonthlyUsedGBP(user.id, user);
  const cap = 5000;
  if (used + amountGBP > cap) {
    const APIError = require('../utils/APIError');
    const status = require('http-status');
    throw new APIError('User limit exeed provide residency proof', status.UNAUTHORIZED);
  }
}

module.exports = {
  getCurrentAnchorWindowUK,
  getUserMonthlyUsedGBP,
  hasKycResidency,
  enforceMonthlyLimitOrThrow,
};
