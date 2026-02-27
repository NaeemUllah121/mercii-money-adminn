const { User, transaction, KycRequest, MLROFlag, benificary, UserBonus } = require('../models');
const { pagination } = require('../utils/pagination');
const { Op } = require('sequelize');
const sequelize = require('../models').sequelize;
const { AuditLog } = require('../models');

// Overview Endpoints
const getOverviewKPIs = async (req, res) => {
  try {
    const [
      totalCustomers,
      activeCustomers,
      totalTransactions,
      pendingKYC,
      pendingMLRO,
      monthlyTransactions,
      failedTransactions,
      highValueTransactions
    ] = await Promise.all([
      User.count(),
      User.count({ where: { isActive: true } }),
      transaction.count(),
      KycRequest.count({ where: { status: 'pending' } }),
      MLROFlag.count({ where: { status: 'pending' } }),
      transaction.count({
        where: {
          createdAt: {
            [Op.gte]: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
          }
        }
      }),
      transaction.count({ where: { status: 'failed' } }),
      transaction.count({ where: { amount: { [Op.gte]: 1000 } } })
    ]);

    // Calculate total volume and monthly volume
    const [volumeResult, monthlyVolumeResult] = await Promise.all([
      transaction.findOne({
        attributes: [
          [sequelize.fn('SUM', sequelize.col('amount')), 'totalVolume']
        ],
        where: { status: 'completed' }
      }),
      transaction.findOne({
        attributes: [
          [sequelize.fn('SUM', sequelize.col('amount')), 'monthlyVolume']
        ],
        where: {
          status: 'completed',
          createdAt: {
            [Op.gte]: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
          }
        }
      })
    ]);

    const totalVolume = volumeResult?.dataValues?.totalVolume || 0;
    const monthlyVolume = monthlyVolumeResult?.dataValues?.monthlyVolume || 0;

    // Calculate trends (compare with previous month)
    const previousMonthStart = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);
    const previousMonthEnd = new Date(new Date().getFullYear(), new Date().getMonth(), 0);
    
    const previousMonthVolume = await transaction.findOne({
      attributes: [
        [sequelize.fn('SUM', sequelize.col('amount')), 'volume']
      ],
      where: {
        status: 'completed',
        createdAt: {
          [Op.between]: [previousMonthStart, previousMonthEnd]
        }
      }
    });

    const prevVolume = previousMonthVolume?.dataValues?.volume || 0;
    const volumeTrend = prevVolume > 0 ? ((monthlyVolume - prevVolume) / prevVolume * 100).toFixed(2) : 0;

    res.json({
      totalCustomers,
      activeCustomers,
      totalTransactions,
      totalVolume,
      monthlyVolume,
      volumeTrend: parseFloat(volumeTrend),
      pendingKYC,
      pendingMLRO,
      monthlyTransactions,
      failedTransactions,
      highValueTransactions
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getServiceHealth = async (req, res) => {
  try {
    const services = [];

    // 1. Database health check (real)
    let dbStatus = 'healthy';
    let dbResponseTime = 0;
    let dbDetails = '';
    try {
      const start = Date.now();
      await sequelize.authenticate();
      dbResponseTime = Date.now() - start;
      dbDetails = `Connection successful (${dbResponseTime}ms)`;
      if (dbResponseTime > 500) { dbStatus = 'warning'; dbDetails = `Slow response (${dbResponseTime}ms)`; }
    } catch (error) {
      dbStatus = 'unhealthy';
      dbDetails = error.message;
    }
    services.push({ service: 'Database', status: dbStatus, responseTime: dbResponseTime, lastCheck: new Date().toISOString(), details: dbDetails });

    // 2. USI API health check (real - ping the base URL)
    let usiStatus = 'healthy';
    let usiResponseTime = 0;
    let usiDetails = '';
    try {
      const axios = require('axios');
      const start = Date.now();
      await axios.get(process.env.USI_BASE_URL || 'https://test4.remit.by', { timeout: 5000 });
      usiResponseTime = Date.now() - start;
      usiDetails = `Responding (${usiResponseTime}ms)`;
      if (usiResponseTime > 2000) { usiStatus = 'warning'; usiDetails = `Slow response (${usiResponseTime}ms)`; }
    } catch (error) {
      usiResponseTime = 0;
      if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
        usiStatus = 'unhealthy'; usiDetails = 'Connection timeout';
      } else if (error.response) {
        usiStatus = 'warning'; usiDetails = `HTTP ${error.response.status}`;
        usiResponseTime = Date.now();
      } else {
        usiStatus = 'unhealthy'; usiDetails = error.message;
      }
    }
    services.push({ service: 'USI API', status: usiStatus, responseTime: usiResponseTime, lastCheck: new Date().toISOString(), details: usiDetails });

    // 3. Email Service (SendGrid) health check
    let emailStatus = 'healthy';
    let emailResponseTime = 0;
    let emailDetails = '';
    try {
      const axios = require('axios');
      const start = Date.now();
      await axios.get('https://status.sendgrid.com/api/v2/status.json', { timeout: 5000 });
      emailResponseTime = Date.now() - start;
      emailDetails = `Responding (${emailResponseTime}ms)`;
      if (emailResponseTime > 2000) { emailStatus = 'warning'; emailDetails = `Slow response (${emailResponseTime}ms)`; }
    } catch (error) {
      emailStatus = process.env.SEND_GRID_API_KEY ? 'warning' : 'unhealthy';
      emailDetails = process.env.SEND_GRID_API_KEY ? 'Status page unreachable but API key configured' : 'Not configured';
      emailResponseTime = 0;
    }
    services.push({ service: 'Email Service (SendGrid)', status: emailStatus, responseTime: emailResponseTime, lastCheck: new Date().toISOString(), details: emailDetails });

    // 4. SMS Service (Twilio) health check
    let smsStatus = 'healthy';
    let smsResponseTime = 0;
    let smsDetails = '';
    try {
      const axios = require('axios');
      const start = Date.now();
      await axios.get('https://status.twilio.com/api/v2/status.json', { timeout: 5000 });
      smsResponseTime = Date.now() - start;
      smsDetails = `Responding (${smsResponseTime}ms)`;
      if (smsResponseTime > 2000) { smsStatus = 'warning'; smsDetails = `Slow response (${smsResponseTime}ms)`; }
    } catch (error) {
      smsStatus = process.env.TWILIO_ACCOUNT_SID ? 'warning' : 'unhealthy';
      smsDetails = process.env.TWILIO_ACCOUNT_SID ? 'Status page unreachable but credentials configured' : 'Not configured';
      smsResponseTime = 0;
    }
    services.push({ service: 'SMS Service (Twilio)', status: smsStatus, responseTime: smsResponseTime, lastCheck: new Date().toISOString(), details: smsDetails });

    // 5. KYC Provider (Shufti Pro) health check
    let kycStatus = 'healthy';
    let kycResponseTime = 0;
    let kycDetails = '';
    try {
      const axios = require('axios');
      const start = Date.now();
      await axios.get(process.env.SHUFTI_URL || 'https://api.shuftipro.com', { timeout: 5000 });
      kycResponseTime = Date.now() - start;
      kycDetails = `Responding (${kycResponseTime}ms)`;
      if (kycResponseTime > 2000) { kycStatus = 'warning'; kycDetails = `Slow response (${kycResponseTime}ms)`; }
    } catch (error) {
      if (error.response) {
        kycResponseTime = 0;
        kycStatus = 'healthy'; kycDetails = `API reachable (HTTP ${error.response.status})`;
      } else {
        kycStatus = process.env.SHUFTI_API_KEY ? 'warning' : 'unhealthy';
        kycDetails = process.env.SHUFTI_API_KEY ? 'Unreachable but API key configured' : 'Not configured';
      }
    }
    services.push({ service: 'KYC Provider (Shufti)', status: kycStatus, responseTime: kycResponseTime, lastCheck: new Date().toISOString(), details: kycDetails });

    // 6. AML Screening (Dilisense) health check
    let amlStatus = 'healthy';
    let amlResponseTime = 0;
    let amlDetails = '';
    try {
      const axios = require('axios');
      const start = Date.now();
      await axios.get(process.env.DILISENSE_URL || 'https://api.dilisense.com', { timeout: 5000 });
      amlResponseTime = Date.now() - start;
      amlDetails = `Responding (${amlResponseTime}ms)`;
      if (amlResponseTime > 2000) { amlStatus = 'warning'; amlDetails = `Slow response (${amlResponseTime}ms)`; }
    } catch (error) {
      if (error.response) {
        amlResponseTime = 0;
        amlStatus = 'healthy'; amlDetails = `API reachable (HTTP ${error.response.status})`;
      } else {
        amlStatus = process.env.DILISENSE_API_KEY ? 'warning' : 'unhealthy';
        amlDetails = process.env.DILISENSE_API_KEY ? 'Unreachable but API key configured' : 'Not configured';
      }
    }
    services.push({ service: 'AML Screening (Dilisense)', status: amlStatus, responseTime: amlResponseTime, lastCheck: new Date().toISOString(), details: amlDetails });

    // Calculate overall health
    const unhealthyCount = services.filter(s => s.status === 'unhealthy').length;
    const warningCount = services.filter(s => s.status === 'warning').length;
    
    let overallStatus = 'healthy';
    if (unhealthyCount > 0) overallStatus = 'unhealthy';
    else if (warningCount > 0) overallStatus = 'warning';

    res.json({
      overall: overallStatus,
      services,
      summary: {
        total: services.length,
        healthy: services.filter(s => s.status === 'healthy').length,
        warning: warningCount,
        unhealthy: unhealthyCount
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getAlerts = async (req, res) => {
  try {
    const { severity = '', limit = 50 } = req.query;
    
    // Get recent compliance alerts from MLRO flags
    const mlroAlerts = await MLROFlag.findAll({
      where: {
        createdAt: {
          [Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        }
      },
      include: [{
        model: User,
        as: 'user',
        attributes: ['fullName']
      }],
      order: [['createdAt', 'DESC']],
      limit: 20
    });

    // Get system alerts from audit logs
    const auditAlerts = await AuditLog.findAll({
      where: {
        severity: severity || { [Op.in]: ['medium', 'high', 'critical'] },
        createdAt: {
          [Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000)
        }
      },
      include: [{
        model: require('../models').AdminUser,
        as: 'adminUser',
        attributes: ['username']
      }],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit)
    });

    // Combine and format alerts
    const alerts = [
      ...mlroAlerts.map(flag => ({
        id: `mlro-${flag.id}`,
        type: 'compliance',
        severity: flag.severity || 'high',
        title: `MLRO Flag: ${flag.title}`,
        message: flag.description,
        customerId: flag.userId,
        customerName: flag.user?.fullName || 'Unknown',
        createdAt: flag.createdAt,
        metadata: {
          flagId: flag.id,
          type: flag.type,
          status: flag.status
        }
      })),
      ...auditAlerts.map(log => ({
        id: `audit-${log.id}`,
        type: 'system',
        severity: log.severity,
        title: `${log.action} on ${log.resource}`,
        message: log.parsedMetadata?.details || `${log.action} operation performed`,
        adminName: log.adminUser?.username || 'System',
        createdAt: log.createdAt,
        metadata: {
          action: log.action,
          resource: log.resource,
          resourceId: log.resourceId
        }
      }))
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({
      alerts,
      summary: {
        total: alerts.length,
        critical: alerts.filter(a => a.severity === 'critical').length,
        high: alerts.filter(a => a.severity === 'high').length,
        medium: alerts.filter(a => a.severity === 'medium').length,
        low: alerts.filter(a => a.severity === 'low').length
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Customer Endpoints
const getCustomers = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', status = '', kycStatus = '' } = req.query;
    
    const whereClause = {};
    
    if (search) {
      whereClause[Op.or] = [
        { fullName: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } },
        { phoneNumber: { [Op.iLike]: `%${search}%` } }
      ];
    }
    
    if (status) {
      whereClause.isActive = status === 'active';
    }
    
    if (kycStatus) {
      whereClause.kycStatus = kycStatus;
    }

    const { offset, limit: limitValue } = pagination({ page, size: limit });

    const { count, rows } = await User.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: benificary,
          as: 'benificaries',
          attributes: ['id', 'fName', 'type'],
          required: false
        },
        {
          model: KycRequest,
          as: 'kyc',
          attributes: ['status', 'referenceId', 'createdAt'],
          required: false
        }
      ],
      offset,
      limit: limitValue,
      order: [['createdAt', 'DESC']]
    });

    // Apply PII masking based on admin role
    const canViewPII = req.adminUser?.hasPermission('view_pii') || false;
    
    const customers = rows.map(customer => {
      const customerData = {
        id: customer.id,
        fullName: customer.fullName,
        email: canViewPII ? customer.email : maskEmail(customer.email),
        phoneNumber: canViewPII ? customer.phoneNumber : maskPhoneNumber(customer.phoneNumber),
        status: customer.isActive ? 'active' : 'suspended',
        kycStatus: customer.kycStatus,
        transferLimit: customer.transferLimit || 5000,
        usedLimit: customer.usedLimit || 0,
        monthlyCap: customer.transferLimit || 5000,
        anchorDay: customer.createdAt ? new Date(customer.createdAt).getDate() : 1,
        registrationStep: customer.registrationStep,
        nationality: customer.nationality,
        country: customer.country,
        createdAt: customer.createdAt,
        lastLoginAt: customer.lastLoginAt,
        beneficiaryCount: customer.benificaries?.length || 0,
        rdaBeneficiaryCount: customer.benificaries?.filter(b => b.type === 'my_self').length || 0,
        kycSubmittedAt: customer.kyc?.createdAt,
        kycReference: customer.kyc?.referenceId
      };

      // Add full address for PII-privileged users
      if (canViewPII) {
        customerData.postalCode = customer.postalCode;
        customerData.streetAddress = customer.streetAddress;
        customerData.city = customer.city;
        customerData.dateOfBirth = customer.dateOfBirth;
      }

      return customerData;
    });

    res.json({
      customers,
      pagination: {
        totalPages: Math.ceil(count / limitValue),
        currentPage: parseInt(page),
        total: count
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Helper functions for PII masking
const maskEmail = (email) => {
  if (!email) return null;
  const [username, domain] = email.split('@');
  const maskedUsername = username.slice(0, 2) + '*'.repeat(username.length - 2);
  return `${maskedUsername}@${domain}`;
};

const maskPhoneNumber = (phone) => {
  if (!phone) return null;
  return phone.slice(0, 3) + '*'.repeat(phone.length - 6) + phone.slice(-3);
};

// Transaction Endpoints
const getTransactions = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', status = '' } = req.query;
    
    const whereClause = {};
    
    if (status) {
      whereClause.status = status;
    }

    const { offset, limit: limitValue } = pagination({ page, size: limit });

    const { count, rows } = await transaction.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['fullName']
        },
        {
          model: benificary,
          as: 'benificary',
          attributes: ['fName']
        }
      ],
      offset,
      limit: limitValue,
      order: [['createdAt', 'DESC']]
    });

    const customers = rows.map(transaction => ({
      id: transaction.id,
      customerId: transaction.userId,
      customerName: transaction.user?.fullName || 'Unknown',
      beneficiaryName: transaction.benificary?.fName || 'Unknown',
      amount: transaction.amount,
      amountInPKR: transaction.amountInPkr,
      status: transaction.status,
      usiPaymentId: transaction.usiPaymentId,
      createdAt: transaction.createdAt
    }));

    res.json({
      customers,
      pagination: {
        totalPages: Math.ceil(count / limitValue),
        currentPage: parseInt(page)
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Compliance Endpoints
const getMLROFlags = async (req, res) => {
  try {
    const { page = 1, limit = 10, type = '', severity = '', status = '' } = req.query;
    
    const whereClause = {};
    
    if (type) {
      whereClause.type = type;
    }
    
    if (severity) {
      whereClause.severity = severity;
    }
    
    if (status) {
      whereClause.status = status;
    }

    const { offset, limit: limitValue } = pagination({ page, size: limit });

    const { count, rows } = await MLROFlag.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['fullName']
        }
      ],
      offset,
      limit: limitValue,
      order: [['createdAt', 'DESC']]
    });

    // SLA deadlines: critical=4h, high=24h, medium=72h, low=168h (7 days)
    const SLA_HOURS = { critical: 4, high: 24, medium: 72, low: 168 };

    const flags = rows.map(flag => {
      const slaHours = SLA_HOURS[flag.severity] || 72;
      const slaDeadline = new Date(new Date(flag.createdAt).getTime() + slaHours * 60 * 60 * 1000);
      const now = new Date();
      const slaRemaining = Math.max(0, slaDeadline - now);
      const slaBreached = flag.status === 'pending' && now > slaDeadline;

      return {
        id: flag.id,
        customerId: flag.userId,
        customerName: flag.user?.fullName || 'Unknown',
        type: flag.type,
        severity: flag.severity,
        title: flag.title,
        description: flag.description,
        status: flag.status,
        notes: flag.notes,
        createdAt: flag.createdAt,
        slaDeadline: slaDeadline.toISOString(),
        slaRemainingMs: slaRemaining,
        slaRemainingHours: Math.round(slaRemaining / (60 * 60 * 1000) * 10) / 10,
        slaBreached
      };
    });

    res.json({
      flags,
      pagination: {
        totalPages: Math.ceil(count / limitValue),
        currentPage: parseInt(page)
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Action Endpoints
const suspendCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const customer = await User.findByPk(id);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // Store old values for audit
    const oldValues = { isActive: customer.isActive };
    
    await customer.update({ isActive: false });

    // Log the action
    await AuditLog.logAction({
      adminUserId: req.adminUser?.id,
      action: 'SUSPEND_CUSTOMER',
      resource: 'USER',
      resourceId: id,
      targetUserId: id,
      oldValues,
      newValues: { isActive: false, reason },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      metadata: { reason },
      severity: 'medium'
    });

    res.json({ message: 'Customer suspended successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const unsuspendCustomer = async (req, res) => {
  try {
    const { id } = req.params;

    const customer = await User.findByPk(id);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // Store old values for audit
    const oldValues = { isActive: customer.isActive };

    await customer.update({ isActive: true });

    // Log the action
    await AuditLog.logAction({
      adminUserId: req.adminUser?.id,
      action: 'UNSUSPEND_CUSTOMER',
      resource: 'USER',
      resourceId: id,
      targetUserId: id,
      oldValues,
      newValues: { isActive: true },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      severity: 'medium'
    });

    res.json({ message: 'Customer unsuspended successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const resendKYC = async (req, res) => {
  try {
    const { id } = req.params;

    const customer = await User.findByPk(id);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // Update KYC status to pending
    await customer.update({ kycStatus: 'pending' });

    // Create or update KYC request
    await KycRequest.findOrCreate({
      where: { userId: id },
      defaults: {
        userId: id,
        referenceId: `KYC_${Date.now()}`,
        status: 'pending'
      }
    });

    res.json({ message: 'KYC request resent successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const refundTransaction = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const transactionRecord = await transaction.findByPk(id);
    if (!transactionRecord) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    await transactionRecord.update({ 
      status: 'refunded',
      failureReason: reason
    });

    res.json({ message: 'Transaction refunded successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const cancelBeforePayout = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const transactionRecord = await transaction.findByPk(id);
    if (!transactionRecord) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    await transactionRecord.update({ 
      status: 'cancelled',
      failureReason: reason
    });

    res.json({ message: 'Transaction cancelled successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const approveMLROFlag = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    const flag = await MLROFlag.findByPk(id);
    if (!flag) {
      return res.status(404).json({ error: 'MLRO flag not found' });
    }

    await flag.update({ 
      status: 'approved',
      notes: notes
    });

    res.json({ message: 'MLRO flag approved successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const rejectMLROFlag = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    const flag = await MLROFlag.findByPk(id);
    if (!flag) {
      return res.status(404).json({ error: 'MLRO flag not found' });
    }

    await flag.update({ 
      status: 'rejected',
      notes: notes
    });

    res.json({ message: 'MLRO flag rejected successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const holdMLROFlag = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    const flag = await MLROFlag.findByPk(id);
    if (!flag) {
      return res.status(404).json({ error: 'MLRO flag not found' });
    }

    await flag.update({ 
      status: 'hold',
      notes: notes || 'Placed on hold for further investigation'
    });

    await AuditLog.logAction({
      adminUserId: req.adminUser?.id,
      action: 'HOLD_MLRO',
      resource: 'MLRO_FLAG',
      resourceId: id,
      targetUserId: flag.userId,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      metadata: { notes },
      severity: 'medium',
      complianceRelevant: true
    });

    res.json({ message: 'MLRO flag placed on hold' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const exportReconciliationCSV = async (req, res) => {
  try {
    const { date = new Date().toISOString().split('T')[0] } = req.query;
    
    const startDate = new Date(date);
    const endDate = new Date(date);
    endDate.setDate(endDate.getDate() + 1);

    const transactions = await transaction.findAll({
      where: {
        createdAt: { [Op.between]: [startDate, endDate] }
      },
      include: [
        { model: User, as: 'user', attributes: ['fullName', 'email'] },
        { model: benificary, as: 'benificary', attributes: ['fName'] }
      ],
      order: [['createdAt', 'ASC']]
    });

    // Build CSV
    const csvHeader = 'Transaction ID,Date,Customer,Beneficiary,Amount (GBP),Amount (PKR),Status,USI Payment ID,Failure Reason\n';
    const csvRows = transactions.map(t => {
      return [
        t.id,
        t.createdAt.toISOString(),
        (t.user?.fullName || 'Unknown').replace(/,/g, ' '),
        (t.benificary?.fName || 'Unknown').replace(/,/g, ' '),
        t.amount,
        t.amountInPkr || 0,
        t.status,
        t.usiPaymentId || '',
        (t.failureReason || '').replace(/,/g, ' ').replace(/\n/g, ' ')
      ].join(',');
    }).join('\n');

    const csv = csvHeader + csvRows;

    await AuditLog.logAction({
      adminUserId: req.adminUser?.id,
      action: 'EXPORT_DATA',
      resource: 'TRANSACTION',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      metadata: { date, totalRecords: transactions.length, format: 'CSV' },
      severity: 'medium',
      complianceRelevant: true
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=reconciliation_${date}.csv`);
    res.send(csv);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getOverviewKPIs,
  getServiceHealth,
  getAlerts,
  getCustomers,
  getTransactions,
  getMLROFlags,
  suspendCustomer,
  unsuspendCustomer,
  resendKYC,
  refundTransaction,
  cancelBeforePayout,
  approveMLROFlag,
  rejectMLROFlag,
  holdMLROFlag,
  exportReconciliationCSV
};
