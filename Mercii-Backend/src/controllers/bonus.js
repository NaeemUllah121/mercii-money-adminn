const catchAsync = require('../utils/catchAsync');
const { Op } = require('sequelize');
const db = require('../models');
const { getCurrentAnchorWindowUK } = require('../utils/limits');
const { ENUMS } = require('../utils/constants');

// GET /api/bonus
const getUserBonuses = catchAsync(async (req, res, next) => {
  const user = req.user;
  const { startUK, endUK } = getCurrentAnchorWindowUK(user);
  const anchorWindowId = `${startUK.toISOString()}_${endUK.toISOString()}`;

  // Only unused, unexpired bonuses in current window
  const bonuses = await db.UserBonus.findAll({
    where: {
      userId: user.id,
      usedAt: null,
      expiresAt: { [Op.gt]: new Date() },
      anchorWindowId,
    },
    order: [['awardedAt', 'ASC']]
  });

  const bonusAmount = bonuses.reduce((sum, b) => sum + (Number(b.amount) || 0), 0);
  const expiry = endUK;

  return res.json({
    bonusAmount,
    expiry
  });
});

module.exports = { getUserBonuses };

// GET /api/v1/bonus/preview
const getBonusPreview = catchAsync(async (req, res, next) => {
  const user = req.user;
  const { startUK, endUK } = getCurrentAnchorWindowUK(user);

  // Pull eligible transfers in current window
  const transfers = await db.transaction.findAll({
    where: {
      userId: user.id,
      volumeStatus: ENUMS.COMPLETED,
      amount: { [Op.gte]: 155 },
      createdAt: { [Op.gte]: startUK, [Op.lt]: endUK },
    },
    include: [{ model: db.benificary, as: 'benificary', required: true }],
    order: [['createdAt', 'ASC']],
  });

  // Apply non-RDA and 24h gap per same beneficiary
  let lastTimes = {};
  let eligibleCount = 0;
  let firstEligibleTx = null;
  for (const t of transfers) {
    if (t.benificary?.type && String(t.benificary.type).toLowerCase() === 'rda') continue;
    const bId = t.benificaryId;
    const prev = lastTimes[bId];
    if (!prev || (new Date(t.createdAt) - prev) >= 24 * 3600 * 1000) {
      eligibleCount += 1;
      if (!firstEligibleTx) firstEligibleTx = t;
      lastTimes[bId] = new Date(t.createdAt);
    }

  // If exactly two eligible completed transfers (third transfer context), surface virtual 350 when not already present
  if (eligibleCount === 2) {
    const hasM3 = await db.UserBonus.findOne({
      where: {
        userId: user.id,
        anchorWindowId,
        bonusType: 'milestone3',
      },
    });
    const alreadyListedM3 = availableBonuses.some(b => b.bonusType === 'milestone3');
    if (!hasM3 && !alreadyListedM3) {
      availableBonuses.unshift({
        id: null,
        amount: 350,
        usedAt: null,
        bonusType: 'milestone3',
        anchorWindowId,
        expiresAt: endUK,
      });
    }
  }

  // If exactly three eligible completed transfers (fourth transfer context), surface virtual 500 when not already present
  if (eligibleCount === 3) {
    const hasM4 = await db.UserBonus.findOne({
      where: {
        userId: user.id,
        anchorWindowId,
        bonusType: 'milestone4',
      },
    });
    const alreadyListedM4 = availableBonuses.some(b => b.bonusType === 'milestone4');
    if (!hasM4 && !alreadyListedM4) {
      availableBonuses.unshift({
        id: null,
        amount: 500,
        usedAt: null,
        bonusType: 'milestone4',
        anchorWindowId,
        expiresAt: endUK,
      });
    }
  }
  }

  // If at least one eligible COMPLETED transfer exists, ensure milestone1 is present and marked used
  if (eligibleCount >= 1) {
    const m1 = await db.UserBonus.findOne({
      where: { userId: user.id, anchorWindowId, bonusType: 'milestone1' },
    });
    if (!m1) {
      // Create and mark used immediately
      await db.UserBonus.create({
        userId: user.id,
        amount: 250,
        awardedAt: firstEligibleTx ? firstEligibleTx.createdAt : new Date(),
        usedAt: new Date(),
        expiresAt: endUK,
        anchorWindowId,
        bonusType: 'milestone1',
        transactionId: firstEligibleTx ? firstEligibleTx.id : null,
      });
    } else if (!m1.usedAt) {
      // If exists but unused, mark used now
      m1.usedAt = new Date();
      await m1.save();
    }
  }

  // Recompute redeemed after enforcing milestone1 usage
  const redeemed = await db.UserBonus.findAll({
    where: {
      userId: user.id,
      anchorWindowId,
      usedAt: { [Op.ne]: null },
    },
  });
  const redeemedSoFar = redeemed.reduce((s, b) => s + (Number(b.amount) || 0), 0);

  let nextPotentialBonus = 0;
  if (eligibleCount < 1) nextPotentialBonus = 250;
  else if (eligibleCount < 2) nextPotentialBonus = 300;
  else if (eligibleCount < 3) nextPotentialBonus = 350;
  else if (eligibleCount < 4) nextPotentialBonus = 500;
  else nextPotentialBonus = 0;

  // Also include current redeemable bonuses with details
  const anchorWindowId = `${startUK.toISOString()}_${endUK.toISOString()}`;
  const now = new Date();
  const redeemable = await db.UserBonus.findAll({
    where: {
      userId: user.id,
      usedAt: null,
      expiresAt: { [Op.gt]: now },
      anchorWindowId,
    },
    order: [['awardedAt', 'ASC']],
  });

  const availableBonuses = redeemable.map(b => ({
    id: b.id,
    amount: b.amount,
    usedAt: b.usedAt,
    bonusType: b.bonusType,
    anchorWindowId: b.anchorWindowId,
    expiresAt: b.expiresAt,
  }));

  // If at least one eligible COMPLETED transfer exists, ensure milestone1 is present and marked used
  if (eligibleCount >= 1) {
    const m1 = await db.UserBonus.findOne({
      where: { userId: user.id, anchorWindowId, bonusType: 'milestone1' },
    });
    if (!m1) {
      await db.UserBonus.create({
        userId: user.id,
        amount: 250,
        awardedAt: firstEligibleTx ? firstEligibleTx.createdAt : new Date(),
        usedAt: new Date(),
        expiresAt: endUK,
        anchorWindowId,
        bonusType: 'milestone1',
        transactionId: firstEligibleTx ? firstEligibleTx.id : null,
      });
    } else if (!m1.usedAt) {
      m1.usedAt = new Date();
      await m1.save();
    }
  }

  // Compute days remaining until expiry (rounded up)
  const msDiff = new Date(endUK).getTime() - now.getTime();
  const daysRemaining = Math.max(0, Math.ceil(msDiff / (24 * 60 * 60 * 1000)));

  return res.json({
    nextPotentialBonus,
    expiry: endUK,
    availableBonuses,
  });
});

module.exports.getBonusPreview = getBonusPreview;

// GET /api/v1/bonus/summary
// Returns the monthly total bonus budget (2200), the amount to be earned on the next milestone
// and the remaining total after that next milestone, along with which transfer triggers it and expiry.
// Example when user has 3 eligible transfers (next is 4th):
// { totalBonus: 1700, earnedBonus: 500, bonusTransfer: '4th', expiry: Date }
const getMonthlyBonusSummary = catchAsync(async (req, res, next) => {
  const user = req.user;
  const { startUK, endUK } = getCurrentAnchorWindowUK(user);
  const anchorWindowId = `${startUK.toISOString()}_${endUK.toISOString()}`;

  const MONTHLY_TOTAL = 250 + 300 + 350 + 500; // 1400

  // Determine next milestone based on eligible transfer count within current window
  const transfers = await db.transaction.findAll({
    where: {
      userId: user.id,
      volumeStatus: ENUMS.COMPLETED,
      amount: { [Op.gte]: 155 },
      createdAt: { [Op.gte]: startUK, [Op.lt]: endUK },
    },
    include: [{ model: db.benificary, as: 'benificary', required: true }],
    order: [['createdAt', 'ASC']],
  });

  let lastTimes = {};
  let eligibleCount = 0;
  let firstEligibleTx = null;
  for (const t of transfers) {
    if (t.benificary?.type && String(t.benificary.type).toLowerCase() === 'rda') continue;
    const bId = t.benificaryId;
    const prev = lastTimes[bId];
    if (!prev || (new Date(t.createdAt) - prev) >= 24 * 3600 * 1000) {
      eligibleCount += 1;
      if (!firstEligibleTx) firstEligibleTx = t;
      lastTimes[bId] = new Date(t.createdAt);
    }
  }

  // Ensure milestones up to eligibleCount exist and are marked used (auto-consume bonuses for completed transfers)
  const milestoneDefs = {
    1: { type: 'milestone1', amount: 250 },
    2: { type: 'milestone2', amount: 300 },
    3: { type: 'milestone3', amount: 350 },
    4: { type: 'milestone4', amount: 500 },
  };
  for (let i = 1; i <= Math.min(eligibleCount, 4); i++) {
    const def = milestoneDefs[i];
    const existing = await db.UserBonus.findOne({ where: { userId: user.id, anchorWindowId, bonusType: def.type } });
    if (!existing) {
      await db.UserBonus.create({
        userId: user.id,
        amount: def.amount,
        awardedAt: new Date(),
        usedAt: new Date(),
        expiresAt: endUK,
        anchorWindowId,
        bonusType: def.type,
      });
    } else if (!existing.usedAt) {
      existing.usedAt = new Date();
      await existing.save();
    }
  }

  let nextAmount = 0;
  let bonusTransfer = null;
  if (eligibleCount < 1) {
    nextAmount = 250; bonusTransfer = '1st';
  } else if (eligibleCount < 2) {
    nextAmount = 300; bonusTransfer = '2nd';
  } else if (eligibleCount < 3) {
    nextAmount = 350; bonusTransfer = '3rd';
  } else if (eligibleCount < 4) {
    nextAmount = 500; bonusTransfer = '4th';
  } else {
    nextAmount = 0; bonusTransfer = null;
  }

  // Also include current redeemable bonuses with details (same as preview)
  const now = new Date();
  const redeemable = await db.UserBonus.findAll({
    where: {
      userId: user.id,
      usedAt: null,
      expiresAt: { [Op.gt]: now },
      anchorWindowId,
    },
    order: [['awardedAt', 'ASC']],
  });
  const availableBonuses = redeemable.map(b => ({
    id: b.id,
    amount: b.amount,
    usedAt: b.usedAt,
    bonusType: b.bonusType,
    anchorWindowId: b.anchorWindowId,
    expiresAt: b.expiresAt,
  }));

  // If this is a brand-new user for the current window (no eligible transfers yet)
  // and no milestone1 record exists yet, surface a virtual 250 bonus so it appears available.
  if (eligibleCount < 1) {
    const hasM1 = await db.UserBonus.findOne({
      where: {
        userId: user.id,
        anchorWindowId,
        bonusType: 'milestone1',
      },
    });
    if (!hasM1) {
      availableBonuses.unshift({
        id: null,
        amount: 250,
        usedAt: null,
        bonusType: 'milestone1',
        anchorWindowId,
        expiresAt: endUK,
      });
    }
  }
  // If exactly one eligible completed transfer (second transfer context), surface virtual 300 when not already present
  if (eligibleCount === 1) {
    const hasM2 = await db.UserBonus.findOne({
      where: {
        userId: user.id,
        anchorWindowId,
        bonusType: 'milestone2',
      },
    });
    const alreadyListedM2 = availableBonuses.some(b => b.bonusType === 'milestone2');
    if (!hasM2 && !alreadyListedM2) {
      availableBonuses.unshift({
        id: null,
        amount: 300,
        usedAt: null,
        bonusType: 'milestone2',
        anchorWindowId,
        expiresAt: endUK,
      });
    }
  }

  // Collect bonuses that are either used or expired in this window
  const usedOrExpired = await db.UserBonus.findAll({
    where: {
      userId: user.id,
      anchorWindowId,
      [Op.or]: [
        { usedAt: { [Op.ne]: null } },
        { expiresAt: { [Op.lte]: now } },
      ],
    },
    order: [['awardedAt', 'ASC']],
  });
  const usedOrExpiresbonus = usedOrExpired.map(b => ({
    id: b.id,
    amount: b.amount,
    usedAt: b.usedAt,
    bonusType: b.bonusType,
    anchorWindowId: b.anchorWindowId,
    expiresAt: b.expiresAt,
  }));

  // Compute days remaining until expiry for the current window
  const msDiffSummary = new Date(endUK).getTime() - now.getTime();
  const daysRemaining = Math.max(0, Math.ceil(msDiffSummary / (24 * 60 * 60 * 1000)));

  // Total budget remaining reduces only when bonuses are redeemed
  // Sum already redeemed after enforcing milestone usage by eligibleCount
  const redeemed = await db.UserBonus.findAll({
    where: {
      userId: user.id,
      anchorWindowId,
      usedAt: { [Op.ne]: null },
    },
  });
  const redeemedSoFar = redeemed.reduce((s, b) => s + (Number(b.amount) || 0), 0);
  const totalBonus = Math.max(MONTHLY_TOTAL - redeemedSoFar, 0);

  const response = {
    totalBonus,
    earnedBonus: nextAmount,
    bonusTransfer,
    expiry: endUK,
    daysRemaining,
    availableBonuses,
    usedOrExpiresbonus,
  };

  return res.json(response);
});

module.exports.getMonthlyBonusSummary = getMonthlyBonusSummary;

// POST /api/v1/bonus/redeem
// Body: { bonusId?: string, transactionId: string }
// Validates the provided transaction against eligibility rules and
// if bonusId not provided, redeems the oldest unused, unexpired bonus in current window
const redeemBonus = catchAsync(async (req, res, next) => {
  const user = req.user;
  const now = new Date();
  const { startUK, endUK } = getCurrentAnchorWindowUK(user);
  const anchorWindowId = `${startUK.toISOString()}_${endUK.toISOString()}`;
  const { bonusId, transactionId } = req.body || {};

  // Validate transactionId and ensure the transaction is eligible
  const APIError = require('../utils/APIError');
  const httpStatus = require('http-status');
  if (!transactionId) {
    throw new APIError('transactionId is required', httpStatus.BAD_REQUEST);
  }

  const tx = await db.transaction.findOne({
    where: {
      id: transactionId,
      userId: user.id,
      createdAt: { [Op.gte]: startUK, [Op.lt]: endUK },
    },
    include: [{ model: db.benificary, as: 'benificary', required: true }],
  });
  if (!tx) {
    throw new APIError('Eligible transaction not found in current window', httpStatus.NOT_FOUND);
  }
  if (Number(tx.amount) < 155) {
    throw new APIError('Transaction amount must be at least 155', httpStatus.BAD_REQUEST);
  }
  const isRDA = !!(tx.benificary?.type && String(tx.benificary.type).toLowerCase() === 'rda');
  if (isRDA) {
    throw new APIError('RDA beneficiary transactions are not eligible for bonus', httpStatus.BAD_REQUEST);
  }

  // Compute prior eligible COMPLETED transfers (>=155, non-RDA, 24h gap per beneficiary)
  const completedTransfers = await db.transaction.findAll({
    where: {
      userId: user.id,
      volumeStatus: ENUMS.COMPLETED,
      amount: { [Op.gte]: 155 },
      createdAt: { [Op.gte]: startUK, [Op.lt]: endUK },
    },
    include: [{ model: db.benificary, as: 'benificary', required: true }],
    order: [['createdAt', 'ASC']],
  });
  let lastTimesCompleted = {};
  let priorEligibleCount = 0;
  for (const t of completedTransfers) {
    if (t.benificary?.type && String(t.benificary.type).toLowerCase() === 'rda') continue;
    const bId = t.benificaryId;
    const prev = lastTimesCompleted[bId];
    if (!prev || (new Date(t.createdAt) - prev) >= 24 * 3600 * 1000) {
      priorEligibleCount += 1;
      lastTimesCompleted[bId] = new Date(t.createdAt);
    }
  }

  const isFirstBonusContext = priorEligibleCount === 0;

  // Determine requested milestone index: from bonusId if provided; else next milestone by context
  let requestedMilestone = null;
  if (bonusId) {
    const meta = await db.UserBonus.findOne({ where: { id: bonusId, userId: user.id, anchorWindowId } });
    if (meta && meta.bonusType && /^milestone(\d+)$/.test(meta.bonusType)) {
      requestedMilestone = parseInt(meta.bonusType.replace('milestone',''), 10);
    }
  }
  if (!requestedMilestone) {
    requestedMilestone = Math.min(priorEligibleCount + 1, 4);
  }

  // Enforce milestone prerequisites based on prior eligible completed transfers
  if (requestedMilestone > 1 && priorEligibleCount < (requestedMilestone - 1)) {
    throw new APIError(`Requires ${requestedMilestone - 1} completed eligible transfer(s) before redeeming milestone${requestedMilestone}`, httpStatus.BAD_REQUEST);
  }

  if (!isFirstBonusContext) {
    // Enforce 24h gap for same beneficiary (prior eligible COMPLETED tx must be >= 24h before this one)
    const prevTx = await db.transaction.findOne({
      where: {
        userId: user.id,
        benificaryId: tx.benificaryId,
        amount: { [Op.gte]: 155 },
        volumeStatus: ENUMS.COMPLETED,
        createdAt: { [Op.gte]: startUK, [Op.lt]: tx.createdAt },
      },
      order: [['createdAt', 'DESC']],
    });
    if (prevTx) {
      const gapMs = new Date(tx.createdAt) - new Date(prevTx.createdAt);
      if (gapMs < 24 * 3600 * 1000) {
        throw new APIError('Must wait 24 hours between transfers to the same beneficiary', httpStatus.BAD_REQUEST);
      }
    }
  }

  const result = await db.sequelize.transaction(async (t) => {
    // Resolve target bonus
    let target = null;
    if (bonusId) {
      target = await db.UserBonus.findOne({
        where: {
          id: bonusId,
          userId: user.id,
          usedAt: null,
          expiresAt: { [Op.gt]: now },
          anchorWindowId,
        },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
    } else {
      target = await db.UserBonus.findOne({
        where: {
          userId: user.id,
          usedAt: null,
          expiresAt: { [Op.gt]: now },
          anchorWindowId,
        },
        order: [['awardedAt', 'ASC']],
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
    }

    if (!target) {
      // Create the appropriate milestone record on-demand based on requestedMilestone (1..4)
      const milestoneMap = {
        1: { type: 'milestone1', amount: 250 },
        2: { type: 'milestone2', amount: 300 },
        3: { type: 'milestone3', amount: 350 },
        4: { type: 'milestone4', amount: 500 },
      };
      const reqDef = milestoneMap[requestedMilestone];
      if (!reqDef) {
        throw new APIError('No redeemable bonus found', httpStatus.NOT_FOUND);
      }
      // Avoid duplicates
      const existsReq = await db.UserBonus.findOne({
        where: { userId: user.id, anchorWindowId, bonusType: reqDef.type, usedAt: null },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (existsReq) {
        target = existsReq;
      } else {
        target = await db.UserBonus.create({
          userId: user.id,
          amount: reqDef.amount,
          awardedAt: now,
          usedAt: null,
          expiresAt: endUK,
          anchorWindowId,
          bonusType: reqDef.type,
          transactionId: tx.volumeStatus !== ENUMS.COMPLETED ? tx.id : null,
        }, { transaction: t });
      }
      // If tx is not completed, return reserved target
      if (tx.volumeStatus !== ENUMS.COMPLETED) {
        return target;
      }
      // If tx is completed, mark used and ensure creation of the next milestone
      target.usedAt = now;
      await target.save({ transaction: t });

      const nextMap = {
        milestone1: { type: 'milestone2', amount: 300 },
        milestone2: { type: 'milestone3', amount: 350 },
        milestone3: { type: 'milestone4', amount: 500 },
      };
      const next = nextMap[target.bonusType];
      if (next) {
        const existsNext = await db.UserBonus.findOne({
          where: { userId: user.id, anchorWindowId, bonusType: next.type },
          transaction: t,
          lock: t.LOCK.UPDATE,
        });
        if (!existsNext) {
          await db.UserBonus.create({
            userId: user.id,
            amount: next.amount,
            awardedAt: now,
            usedAt: null,
            expiresAt: endUK,
            anchorWindowId,
            bonusType: next.type,
          }, { transaction: t });
        }
      }
      return target;
    }

    // If redeeming against a transaction that is NOT COMPLETED yet, defer usage for any milestone
    if (tx.volumeStatus !== ENUMS.COMPLETED && !target.usedAt) {
      if (!target.transactionId) {
        target.transactionId = tx.id;
      }
      await target.save({ transaction: t });
      return target; // keep available until completion webhook marks it used
    }

    // Transaction is COMPLETED: mark used now
    target.usedAt = now;
    await target.save({ transaction: t });

    // Ensure the next milestone becomes available (up to milestone4)
    const nextMap = {
      milestone1: { type: 'milestone2', amount: 300 },
      milestone2: { type: 'milestone3', amount: 350 },
      milestone3: { type: 'milestone4', amount: 500 },
    };
    const next = nextMap[target.bonusType];
    if (next) {
      const existsNext = await db.UserBonus.findOne({
        where: { userId: user.id, anchorWindowId, bonusType: next.type },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (!existsNext) {
        await db.UserBonus.create({
          userId: user.id,
          amount: next.amount,
          awardedAt: now,
          usedAt: null,
          expiresAt: endUK,
          anchorWindowId,
          bonusType: next.type,
        }, { transaction: t });
      }
    }

    return target;
  });

  return res.json({
    redeemed: true,
    bonus: {
      id: result.id,
      amount: result.amount,
      usedAt: result.usedAt,
      bonusType: result.bonusType,
      anchorWindowId: result.anchorWindowId,
      expiresAt: result.expiresAt,
    },
  });
});

module.exports.redeemBonus = redeemBonus;
