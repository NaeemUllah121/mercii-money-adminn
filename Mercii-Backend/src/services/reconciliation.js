const { sequelize } = require('../models');
const { transaction, benificary, User } = require('../models');
const { Op } = require('sequelize');
const logger = require('../utils/logger');
const { sendNotification } = require('./notification');

class ReconciliationService {
  async performDailyReconciliation(date = null) {
    const targetDate = date || this.getUKDate();
    logger.info(`Starting daily reconciliation for date: ${targetDate}`);

    try {
      // Get all transactions for the target date
      const transactions = await this.getTransactionsForDate(targetDate);
      
      // Perform reconciliation calculations
      const reconciliation = await this.calculateReconciliation(transactions, targetDate);
      
      // Identify variances
      const variances = this.identifyVariances(reconciliation);
      
      // Store reconciliation results
      await this.storeReconciliationResults(reconciliation, variances, targetDate);
      
      // Send alerts for variances
      if (variances.length > 0) {
        await this.sendVarianceAlerts(variances, targetDate);
      }
      
      // Check for low balance
      await this.checkBalanceAlerts(reconciliation);
      
      logger.info(`Daily reconciliation completed for ${targetDate}. Processed ${transactions.length} transactions, found ${variances.length} variances`);
      
      return {
        date: targetDate,
        totalTransactions: transactions.length,
        totalAmount: reconciliation.totalAmount,
        totalFees: reconciliation.totalFees,
        variances: variances.length,
        status: 'completed'
      };
    } catch (error) {
      logger.error(`Daily reconciliation failed for ${targetDate}:`, error);
      throw error;
    }
  }

  getUKDate() {
    const now = new Date();
    const ukDate = new Date(now.toLocaleString("en-US", { timeZone: "Europe/London" }));
    return ukDate.toISOString().split('T')[0];
  }

  async getTransactionsForDate(date) {
    const startDate = new Date(`${date}T00:00:00.000Z`);
    const endDate = new Date(`${date}T23:59:59.999Z`);
    
    // Adjust for UK timezone
    const ukStartDate = new Date(startDate.toLocaleString("en-US", { timeZone: "Europe/London" }));
    const ukEndDate = new Date(endDate.toLocaleString("en-US", { timeZone: "Europe/London" }));

    return await transaction.findAll({
      where: {
        createdAt: {
          [Op.between]: [ukStartDate, ukEndDate]
        },
        status: 'completed'
      },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'fullName', 'email']
        },
        {
          model: benificary,
          as: 'beneficiary',
          attributes: ['id', 'firstName', 'lastName', 'iban']
        }
      ],
      order: [['createdAt', 'ASC']]
    });
  }

  async calculateReconciliation(transactions, date) {
    const totalAmount = transactions.reduce((sum, tx) => sum + parseFloat(tx.amount || 0), 0);
    const totalFees = transactions.reduce((sum, tx) => sum + parseFloat(tx.fee || 0), 0);
    const totalPKR = transactions.reduce((sum, tx) => sum + parseFloat(tx.amountInPKR || 0), 0);
    
    // Group by payment provider
    const providerBreakdown = {};
    transactions.forEach(tx => {
      const provider = tx.provider || 'Unknown';
      if (!providerBreakdown[provider]) {
        providerBreakdown[provider] = {
          count: 0,
          amount: 0,
          fees: 0
        };
      }
      providerBreakdown[provider].count++;
      providerBreakdown[provider].amount += parseFloat(tx.amount || 0);
      providerBreakdown[provider].fees += parseFloat(tx.fee || 0);
    });

    // Group by status
    const statusBreakdown = {};
    transactions.forEach(tx => {
      const status = tx.status || 'unknown';
      if (!statusBreakdown[status]) {
        statusBreakdown[status] = {
          count: 0,
          amount: 0
        };
      }
      statusBreakdown[status].count++;
      statusBreakdown[status].amount += parseFloat(tx.amount || 0);
    });

    return {
      date,
      totalTransactions: transactions.length,
      totalAmount,
      totalFees,
      totalPKR,
      providerBreakdown,
      statusBreakdown,
      averageTransactionAmount: totalAmount / transactions.length,
      transactions
    };
  }

  identifyVariances(reconciliation) {
    const variances = [];
    
    // Check for unusual patterns
    const transactions = reconciliation.transactions;
    
    // 1. High value transactions (>£1000)
    const highValueTransactions = transactions.filter(tx => parseFloat(tx.amount) > 1000);
    if (highValueTransactions.length > 0) {
      variances.push({
        type: 'HIGH_VALUE_TRANSACTIONS',
        severity: 'medium',
        count: highValueTransactions.length,
        totalAmount: highValueTransactions.reduce((sum, tx) => sum + parseFloat(tx.amount), 0),
        description: `${highValueTransactions.length} high value transactions detected`,
        transactions: highValueTransactions.map(tx => ({
          id: tx.id,
          amount: tx.amount,
          customer: tx.user?.fullName,
          timestamp: tx.createdAt
        }))
      });
    }

    // 2. Failed transactions
    const failedTransactions = transactions.filter(tx => tx.status === 'failed');
    if (failedTransactions.length > 0) {
      variances.push({
        type: 'FAILED_TRANSACTIONS',
        severity: 'high',
        count: failedTransactions.length,
        description: `${failedTransactions.length} failed transactions detected`,
        transactions: failedTransactions.map(tx => ({
          id: tx.id,
          amount: tx.amount,
          error: tx.errorMessage,
          customer: tx.user?.fullName,
          timestamp: tx.createdAt
        }))
      });
    }

    // 3. Unusual time patterns (transactions outside business hours)
    const unusualTimeTransactions = transactions.filter(tx => {
      const hour = new Date(tx.createdAt).getHours();
      return hour < 6 || hour > 22; // Outside 6 AM - 10 PM
    });
    if (unusualTimeTransactions.length > 0) {
      variances.push({
        type: 'UNUSUAL_TIME_PATTERN',
        severity: 'low',
        count: unusualTimeTransactions.length,
        description: `${unusualTimeTransactions.length} transactions outside normal business hours`,
        transactions: unusualTimeTransactions.map(tx => ({
          id: tx.id,
          amount: tx.amount,
          customer: tx.user?.fullName,
          timestamp: tx.createdAt
        }))
      });
    }

    // 4. Multiple transactions to same beneficiary
    const beneficiaryCounts = {};
    transactions.forEach(tx => {
      const beneficiaryId = tx.beneficiaryId;
      if (!beneficiaryCounts[beneficiaryId]) {
        beneficiaryCounts[beneficiaryId] = [];
      }
      beneficiaryCounts[beneficiaryId].push(tx);
    });

    Object.values(beneficiaryCounts).forEach(benTxs => {
      if (benTxs.length > 5) { // More than 5 transactions to same beneficiary
        variances.push({
          type: 'MULTIPLE_TRANSACTIONS_SAME_BENEFICIARY',
          severity: 'medium',
          count: benTxs.length,
          beneficiaryId: benTxs[0].beneficiaryId,
          beneficiaryName: `${benTxs[0].beneficiary?.firstName} ${benTxs[0].beneficiary?.lastName}`,
          totalAmount: benTxs.reduce((sum, tx) => sum + parseFloat(tx.amount), 0),
          description: `${benTxs.length} transactions to same beneficiary`,
          transactions: benTxs.map(tx => ({
            id: tx.id,
            amount: tx.amount,
            customer: tx.user?.fullName,
            timestamp: tx.createdAt
          }))
        });
      }
    });

    return variances;
  }

  async storeReconciliationResults(reconciliation, variances, date) {
    // Store reconciliation summary
    await sequelize.query(`
      INSERT INTO "ReconciliationSummaries" (
        id, date, total_transactions, total_amount, total_fees, total_pkr,
        provider_breakdown, status_breakdown, variances_count, created_at
      ) VALUES (
        gen_random_uuid(), :date, :totalTransactions, :totalAmount, :totalFees, :totalPKR,
        :providerBreakdown, :statusBreakdown, :variancesCount, NOW()
      )
      ON CONFLICT (date) DO UPDATE SET
        total_transactions = EXCLUDED.total_transactions,
        total_amount = EXCLUDED.total_amount,
        total_fees = EXCLUDED.total_fees,
        total_pkr = EXCLUDED.total_pkr,
        provider_breakdown = EXCLUDED.provider_breakdown,
        status_breakdown = EXCLUDED.status_breakdown,
        variances_count = EXCLUDED.variances_count,
        updated_at = NOW()
    `, {
      replacements: {
        date,
        totalTransactions: reconciliation.totalTransactions,
        totalAmount: reconciliation.totalAmount,
        totalFees: reconciliation.totalFees,
        totalPKR: reconciliation.totalPKR,
        providerBreakdown: JSON.stringify(reconciliation.providerBreakdown),
        statusBreakdown: JSON.stringify(reconciliation.statusBreakdown),
        variancesCount: variances.length
      }
    });

    // Store individual variances
    for (const variance of variances) {
      await sequelize.query(`
        INSERT INTO "ReconciliationVariances" (
          id, date, type, severity, count, total_amount, description, 
          transaction_details, created_at
        ) VALUES (
          gen_random_uuid(), :date, :type, :severity, :count, :totalAmount, :description,
          :transactionDetails, NOW()
        )
      `, {
        replacements: {
          date,
          type: variance.type,
          severity: variance.severity,
          count: variance.count,
          totalAmount: variance.totalAmount || 0,
          description: variance.description,
          transactionDetails: JSON.stringify(variance.transactions)
        }
      });
    }
  }

  async sendVarianceAlerts(variances, date) {
    const highSeverityVariances = variances.filter(v => v.severity === 'high');
    
    if (highSeverityVariances.length > 0) {
      const alertMessage = `
        High severity variances detected in daily reconciliation for ${date}:
        
        ${highSeverityVariances.map(v => `
        • ${v.type}: ${v.count} occurrences
          ${v.description}
        `).join('')}
        
        Please review in admin panel.
      `;

      // Send notification to MLRO and Admin users
      await sendNotification({
        type: 'RECONCILIATION_VARIANCE',
        severity: 'high',
        message: alertMessage,
        date,
        variances: highSeverityVariances
      });
    }
  }

  async checkBalanceAlerts(reconciliation) {
    // Simulate balance check (in real implementation, this would check actual account balances)
    const currentBalance = 50000; // £50,000
    const dailyOutflow = reconciliation.totalAmount;
    const projectedBalance = currentBalance - dailyOutflow;
    
    const lowBalanceThreshold = 10000; // £10,000
    
    if (projectedBalance < lowBalanceThreshold) {
      await sendNotification({
        type: 'LOW_BALANCE_ALERT',
        severity: 'high',
        message: `Low balance alert: Current balance £${currentBalance}, daily outflow £${dailyOutflow}, projected balance £${projectedBalance}`,
        currentBalance,
        dailyOutflow,
        projectedBalance
      });
    }
  }

  async getReconciliationReport(date) {
    const [summary] = await sequelize.query(`
      SELECT * FROM "ReconciliationSummaries" WHERE date = :date
    `, {
      replacements: { date },
      type: sequelize.QueryTypes.SELECT
    });

    const variances = await sequelize.query(`
      SELECT * FROM "ReconciliationVariances" WHERE date = :date ORDER BY severity DESC
    `, {
      replacements: { date },
      type: sequelize.QueryTypes.SELECT
    });

    return {
      summary,
      variances: variances.map(v => ({
        ...v,
        transactionDetails: JSON.parse(v.transactionDetails)
      }))
    };
  }

  async exportReconciliationCSV(date) {
    const report = await this.getReconciliationReport(date);
    
    let csv = 'Date,Transaction ID,Customer,Amount,Status,Provider,Error\n';
    
    if (report.summary) {
      const transactions = JSON.parse(report.summary.status_breakdown || '{}');
      // Add transaction details here based on actual implementation
    }
    
    return csv;
  }
}

module.exports = new ReconciliationService();
