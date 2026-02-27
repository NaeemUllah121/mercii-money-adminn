const { User, transaction, benificary, UserBonus } = require('../models');
const { Op } = require('sequelize');
const sequelize = require('../models').sequelize;

/**
 * Business Rules Service
 * Implements monthly caps, bonus calculations, and RDA transfer rules
 */

class BusinessRulesService {
  /**
   * Check if user can make a transfer based on monthly cap
   * @param {string} userId - User ID
   * @param {number} amount - Transfer amount
   * @returns {Promise<{canTransfer: boolean, remainingLimit: number, message?: string}>}
   */
  static async checkMonthlyCap(userId, amount) {
    try {
      const user = await User.findByPk(userId);
      if (!user) {
        return { canTransfer: false, remainingLimit: 0, message: 'User not found' };
      }

      // Get user's anchor day (default to 1st if not set)
      const anchorDay = 1; // This should be stored in user profile
      const now = new Date();
      
      // Calculate the current period start and end based on anchor day
      let periodStart, periodEnd;
      
      if (now.getDate() >= anchorDay) {
        // Current month period
        periodStart = new Date(now.getFullYear(), now.getMonth(), anchorDay);
        periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, anchorDay - 1, 23, 59, 59);
      } else {
        // Previous month period
        periodStart = new Date(now.getFullYear(), now.getMonth() - 1, anchorDay);
        periodEnd = new Date(now.getFullYear(), now.getMonth(), anchorDay - 1, 23, 59, 59);
      }

      // Calculate total amount transferred in current period
      const periodTransactions = await transaction.findAll({
        where: {
          userId,
          status: 'completed',
          createdAt: {
            [Op.between]: [periodStart, periodEnd]
          }
        },
        attributes: [[sequelize.fn('SUM', sequelize.col('amount')), 'totalAmount']]
      });

      const totalTransferred = parseFloat(periodTransactions[0]?.dataValues?.totalAmount || 0);
      const monthlyCap = user.transferLimit || 5000;
      const remainingLimit = monthlyCap - totalTransferred;

      const canTransfer = totalTransferred + amount <= monthlyCap;

      return {
        canTransfer,
        remainingLimit: Math.max(0, remainingLimit),
        totalTransferred,
        monthlyCap,
        periodStart,
        periodEnd,
        message: canTransfer ? null : `Monthly cap exceeded. Remaining: £${remainingLimit.toFixed(2)}`
      };
    } catch (error) {
      console.error('Error checking monthly cap:', error);
      return { canTransfer: false, remainingLimit: 0, message: 'Error checking limits' };
    }
  }

  /**
   * Check if user is eligible for bonus on this transfer
   * @param {string} userId - User ID
   * @param {string} beneficiaryId - Beneficiary ID
   * @param {number} amount - Transfer amount
   * @returns {Promise<{eligible: boolean, bonusAmount?: number, reason?: string}>}
   */
  static async checkBonusEligibility(userId, beneficiaryId, amount) {
    try {
      // Check minimum amount requirement
      if (amount < 85) {
        return { eligible: false, reason: 'Amount below £85 minimum for bonus' };
      }

      // Get beneficiary details
      const beneficiary = await benificary.findByPk(beneficiaryId);
      if (!beneficiary) {
        return { eligible: false, reason: 'Beneficiary not found' };
      }

      // RDA transfers are excluded from bonus calculation
      if (beneficiary.type === 'my_self') {
        return { eligible: false, reason: 'RDA transfers not eligible for bonus' };
      }

      // Check 24-hour gap to same beneficiary
      const lastTransferToBeneficiary = await transaction.findOne({
        where: {
          userId,
          benificaryId: beneficiaryId,
          status: 'completed',
          createdAt: {
            [Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000)
          }
        },
        order: [['createdAt', 'DESC']]
      });

      if (lastTransferToBeneficiary) {
        return { eligible: false, reason: 'Less than 24 hours since last transfer to this beneficiary' };
      }

      // Count completed transfers (excluding RDA)
      const transferCount = await transaction.count({
        where: {
          userId,
          status: 'completed',
          amount: { [Op.gte]: 85 }
        },
        include: [{
          model: benificary,
          as: 'benificary',
          where: { type: { [Op.ne]: 'my_self' } }
        }]
      });

      // Determine bonus based on transfer count
      let bonusAmount = 0;
      let nextMilestone = null;

      if (transferCount === 3) { // Next transfer will be #4
        bonusAmount = 500; // PKR
      } else if (transferCount === 7) { // Next transfer will be #8
        bonusAmount = 700; // PKR
      } else if (transferCount === 11) { // Next transfer will be #12
        bonusAmount = 1000; // PKR
      }

      if (bonusAmount > 0) {
        return { 
          eligible: true, 
          bonusAmount,
          transferNumber: transferCount + 1,
          reason: `Bonus eligible for transfer #${transferCount + 1}`
        };
      }

      // Calculate next milestone
      if (transferCount < 4) {
        nextMilestone = { transfers: 4, bonus: 500 };
      } else if (transferCount < 8) {
        nextMilestone = { transfers: 8, bonus: 700 };
      } else if (transferCount < 12) {
        nextMilestone = { transfers: 12, bonus: 1000 };
      }

      return { 
        eligible: false, 
        transferCount,
        nextMilestone,
        reason: `Transfer #${transferCount + 1} not eligible for bonus`
      };
    } catch (error) {
      console.error('Error checking bonus eligibility:', error);
      return { eligible: false, reason: 'Error checking bonus eligibility' };
    }
  }

  /**
   * Award bonus to user
   * @param {string} userId - User ID
   * @param {number} bonusAmount - Bonus amount in PKR
   * @param {string} transactionId - Related transaction ID
   * @returns {Promise<boolean>}
   */
  static async awardBonus(userId, bonusAmount, transactionId) {
    try {
      await UserBonus.create({
        userId,
        transactionId,
        bonusAmount,
        bonusType: 'transfer_milestone',
        status: 'awarded',
        awardedAt: new Date()
      });

      return true;
    } catch (error) {
      console.error('Error awarding bonus:', error);
      return false;
    }
  }

  /**
   * Check if transfer complies with RDA rules
   * @param {string} userId - User ID
   * @param {string} beneficiaryId - Beneficiary ID
   * @param {number} amount - Transfer amount
   * @returns {Promise<{compliant: boolean, isRDA: boolean, message?: string}>}
   */
  static async checkRDARules(userId, beneficiaryId, amount) {
    try {
      const beneficiary = await benificary.findByPk(beneficiaryId);
      if (!beneficiary) {
        return { compliant: false, isRDA: false, message: 'Beneficiary not found' };
      }

      const isRDA = beneficiary.type === 'my_self';

      // RDA transfers are allowed but have special rules
      if (isRDA) {
        // Add any RDA-specific rules here
        return { 
          compliant: true, 
          isRDA: true,
          message: 'RDA transfer allowed - excluded from bonus calculation'
        };
      }

      // Regular transfer rules
      const user = await User.findByPk(userId);
      if (!user) {
        return { compliant: false, isRDA: false, message: 'User not found' };
      }

      // Check age requirement (remitter must be 18+)
      if (user.dateOfBirth) {
        const age = this.calculateAge(user.dateOfBirth);
        if (age < 18) {
          return { compliant: false, isRDA: false, message: 'Remitter must be 18 years or older' };
        }
      }

      return { compliant: true, isRDA: false, message: 'Transfer compliant' };
    } catch (error) {
      console.error('Error checking RDA rules:', error);
      return { compliant: false, isRDA: false, message: 'Error checking transfer rules' };
    }
  }

  /**
   * Reset bonus cycle after reaching transfer #12 or on anchor day
   * @param {string} userId - User ID
   * @returns {Promise<boolean>}
   */
  static async resetBonusCycle(userId) {
    try {
      const user = await User.findByPk(userId);
      if (!user) {
        return false;
      }

      // Count completed transfers in current cycle
      const transferCount = await transaction.count({
        where: {
          userId,
          status: 'completed',
          amount: { [Op.gte]: 85 }
        },
        include: [{
          model: benificary,
          as: 'benificary',
          where: { type: { [Op.ne]: 'my_self' } }
        }]
      });

      // Reset if user has completed 12 bonus-eligible transfers
      if (transferCount >= 12) {
        // Mark cycle as complete - this could be a flag in user table
        // For now, we'll just log it
        console.log(`Bonus cycle reset for user ${userId} after ${transferCount} transfers`);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error resetting bonus cycle:', error);
      return false;
    }
  }

  /**
   * Get user's current bonus status
   * @param {string} userId - User ID
   * @returns {Promise<Object>}
   */
  static async getBonusStatus(userId) {
    try {
      const [
        transferCount,
        awardedBonuses,
        totalBonusAmount
      ] = await Promise.all([
        // Count eligible transfers
        transaction.count({
          where: {
            userId,
            status: 'completed',
            amount: { [Op.gte]: 85 }
          },
          include: [{
            model: benificary,
            as: 'benificary',
            where: { type: { [Op.ne]: 'my_self' } }
          }]
        }),
        // Count awarded bonuses
        UserBonus.count({
          where: {
            userId,
            status: 'awarded'
          }
        }),
        // Sum awarded bonuses
        UserBonus.findOne({
          where: {
            userId,
            status: 'awarded'
          },
          attributes: [[sequelize.fn('SUM', sequelize.col('bonusAmount')), 'total']],
          raw: true
        })
      ]);

      const nextMilestone = this.getNextBonusMilestone(transferCount);

      return {
        transferCount,
        awardedBonuses,
        totalBonusAmount: parseFloat(totalBonusAmount?.total || 0),
        nextMilestone,
        cycleComplete: transferCount >= 12
      };
    } catch (error) {
      console.error('Error getting bonus status:', error);
      return {
        transferCount: 0,
        awardedBonuses: 0,
        totalBonusAmount: 0,
        nextMilestone: null,
        cycleComplete: false
      };
    }
  }

  /**
   * Helper method to calculate next bonus milestone
   * @param {number} currentTransfers
   * @returns {Object|null}
   */
  static getNextBonusMilestone(currentTransfers) {
    if (currentTransfers < 4) {
      return { transfers: 4, bonus: 500, remaining: 4 - currentTransfers };
    } else if (currentTransfers < 8) {
      return { transfers: 8, bonus: 700, remaining: 8 - currentTransfers };
    } else if (currentTransfers < 12) {
      return { transfers: 12, bonus: 1000, remaining: 12 - currentTransfers };
    }
    return null; // Cycle complete
  }

  /**
   * Helper method to calculate age from date of birth
   * @param {Date} dateOfBirth
   * @returns {number}
   */
  static calculateAge(dateOfBirth) {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age;
  }
}

module.exports = BusinessRulesService;
