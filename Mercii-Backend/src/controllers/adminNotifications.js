const { successResponse, errorResponse } = require('../utils/APIresponse');
const { User, KycRequest, MLROFlag, transaction, benificary, ScreeningResult, AuditLog } = require('../models');

// Get Real Notifications - Based on actual database activity
const getRealNotifications = async (req, res) => {
  try {
    const notifications = [];

    // 1. High Value Transactions (Real)
    const highValueTransactions = await transaction.findAll({
      where: {
        amount: {
          [require('sequelize').Op.gte]: 1000 // £1000+
        },
        createdAt: {
          [require('sequelize').Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        }
      },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['firstName', 'lastName']
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: 5
    });

    highValueTransactions.forEach(tx => {
      notifications.push({
        id: `high_value_${tx.id}`,
        type: 'alert',
        title: 'High Value Transaction',
        message: `Transaction £${tx.amount} detected for ${tx.user?.firstName} ${tx.user?.lastName}`,
        time: getRelativeTime(tx.createdAt),
        read: false,
        actionUrl: `/transactions`
      });
    });

    // 2. Pending MLRO Flags (Real)
    const pendingMLRO = await MLROFlag.findAll({
      where: {
        status: 'pending'
      },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['firstName', 'lastName']
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: 3
    });

    pendingMLRO.forEach(flag => {
      notifications.push({
        id: `mlro_${flag.id}`,
        type: 'compliance',
        title: 'MLRO Flag',
        message: `New ${flag.severity} compliance flag for ${flag.user?.firstName} ${flag.user?.lastName}`,
        time: getRelativeTime(flag.createdAt),
        read: false,
        actionUrl: `/compliance`
      });
    });

    // 3. Failed KYC Requests (Real)
    const failedKYC = await KycRequest.findAll({
      where: {
        status: 'failed',
        createdAt: {
          [require('sequelize').Op.gte]: new Date(Date.now() - 12 * 60 * 60 * 1000) // Last 12 hours
        }
      },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['firstName', 'lastName']
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: 3
    });

    failedKYC.forEach(kyc => {
      notifications.push({
        id: `kyc_${kyc.id}`,
        type: 'customer',
        title: 'KYC Failed',
        message: `KYC verification failed for ${kyc.user?.firstName} ${kyc.user?.lastName}`,
        time: getRelativeTime(kyc.createdAt),
        read: false,
        actionUrl: `/customers/${kyc.userId}`
      });
    });

    // 4. Failed Transactions (Real)
    const failedTransactions = await transaction.findAll({
      where: {
        status: 'failed',
        createdAt: {
          [require('sequelize').Op.gte]: new Date(Date.now() - 6 * 60 * 60 * 1000) // Last 6 hours
        }
      },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['firstName', 'lastName']
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: 3
    });

    failedTransactions.forEach(tx => {
      notifications.push({
        id: `failed_tx_${tx.id}`,
        type: 'alert',
        title: 'Transaction Failed',
        message: `Payment £${tx.amount} failed for ${tx.user?.firstName} ${tx.user?.lastName}`,
        time: getRelativeTime(tx.createdAt),
        read: false,
        actionUrl: `/transactions`
      });
    });

    // 5. New Customers (Real)
    const newCustomers = await User.findAll({
      where: {
        createdAt: {
          [require('sequelize').Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        }
      },
      order: [['createdAt', 'DESC']],
      limit: 1
    });

    if (newCustomers.length > 0) {
      notifications.push({
        id: `new_customers_${Date.now()}`,
        type: 'customer',
        title: 'New Customers',
        message: `${newCustomers.length} new customer(s) registered in the last 24 hours`,
        time: 'Today',
        read: false,
        actionUrl: `/customers`
      });
    }

    // 6. System Alerts (Based on real audit logs)
    const recentAlerts = await AuditLog.findAll({
      where: {
        action: 'SECURITY_ALERT',
        createdAt: {
          [require('sequelize').Op.gte]: new Date(Date.now() - 48 * 60 * 60 * 1000) // Last 48 hours
        }
      },
      order: [['createdAt', 'DESC']],
      limit: 2
    });

    recentAlerts.forEach(alert => {
      notifications.push({
        id: `security_${alert.id}`,
        type: 'system',
        title: 'Security Alert',
        message: alert.newValues?.message || 'Security event detected',
        time: getRelativeTime(alert.createdAt),
        read: false,
        actionUrl: `/settings`
      });
    });

    // Sort notifications by time (most recent first) and limit to 20
    const sortedNotifications = notifications
      .sort((a, b) => getTimeInMinutes(b.time) - getTimeInMinutes(a.time))
      .slice(0, 20);

    return successResponse(res, 200, 'Real notifications retrieved', {
      notifications: sortedNotifications,
      unreadCount: sortedNotifications.filter(n => !n.read).length
    });
  } catch (error) {
    return errorResponse(res, 500, 'Failed to get notifications', error.message);
  }
};

// Helper function to get relative time
function getRelativeTime(date) {
  const now = new Date();
  const past = new Date(date);
  const diffInMinutes = Math.floor((now - past) / (1000 * 60));
  
  if (diffInMinutes < 1) return 'Just now';
  if (diffInMinutes < 60) return `${diffInMinutes} min ago`;
  
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
  
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
  
  return past.toLocaleDateString();
}

// Helper function to convert relative time to minutes for sorting
function getTimeInMinutes(relativeTime) {
  if (relativeTime === 'Just now') return 0;
  if (relativeTime.includes('min ago')) {
    return parseInt(relativeTime) || 0;
  }
  if (relativeTime.includes('hour')) {
    return (parseInt(relativeTime) || 0) * 60;
  }
  if (relativeTime.includes('day')) {
    return (parseInt(relativeTime) || 0) * 60 * 24;
  }
  return 9999; // For older dates
}

module.exports = {
  getRealNotifications
};
