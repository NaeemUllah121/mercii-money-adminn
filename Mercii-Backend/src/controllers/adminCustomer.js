const { User, benificary, KycRequest, AuditLog } = require('../models');
const { Op } = require('sequelize');

const getCustomerProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const canViewPII = req.adminUser?.hasPermission('view_pii') || false;

    const customer = await User.findByPk(id, {
      include: [
        {
          model: benificary,
          as: 'benificaries',
          required: false
        },
        {
          model: KycRequest,
          as: 'kyc',
          required: false
        }
      ]
    });

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // Apply PII masking
    const customerData = {
      id: customer.id,
      fullName: customer.fullName,
      email: canViewPII ? customer.email : maskEmail(customer.email),
      phoneNumber: canViewPII ? customer.phoneNumber : maskPhoneNumber(customer.phoneNumber),
      status: customer.isActive ? 'active' : 'suspended',
      kycStatus: customer.kycStatus,
      transferLimit: customer.transferLimit || 5000,
      usedLimit: customer.usedLimit || 0,
      registrationStep: customer.registrationStep,
      nationality: customer.nationality,
      country: customer.country,
      plan: customer.plan,
      remitoneCustomerId: customer.remitoneCustomerId,
      createdAt: customer.createdAt,
      lastLoginAt: customer.lastLoginAt,
      beneficiaries: customer.benificaries?.map(b => ({
        id: b.id,
        name: b.fName,
        isRDA: b.type === 'my_self',
        createdAt: b.createdAt
      })) || [],
      kyc: customer.kyc ? {
        status: customer.kyc.status,
        referenceId: customer.kyc.referenceId,
        createdAt: customer.kyc.createdAt
      } : null
    };

    // Add full details for PII-privileged users
    if (canViewPII) {
      customerData.postalCode = customer.postalCode;
      customerData.streetAddress = customer.streetAddress;
      customerData.city = customer.city;
      customerData.dateOfBirth = customer.dateOfBirth;
    }

    res.json(customerData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const adjustCustomerLimits = async (req, res) => {
  try {
    const { id } = req.params;
    const { transferLimit, reason } = req.body;

    const customer = await User.findByPk(id);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const oldValues = { transferLimit: customer.transferLimit };
    const newValues = { transferLimit };

    await customer.update({ transferLimit });

    await AuditLog.logAction({
      adminUserId: req.adminUser?.id,
      action: 'ADJUST_LIMITS',
      resource: 'USER',
      resourceId: id,
      targetUserId: id,
      oldValues,
      newValues,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      metadata: { reason },
      severity: 'medium'
    });

    res.json({ message: 'Customer limits adjusted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getCustomerTransactions = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 10, status = '' } = req.query;
    
    const customer = await User.findByPk(id);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const whereClause = { userId: id };
    if (status) {
      whereClause.status = status;
    }

    const offset = (page - 1) * limit;

    const { count, rows } = await require('../models').transaction.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: benificary,
          as: 'benificary',
          attributes: ['fName', 'type']
        }
      ],
      offset,
      limit: parseInt(limit),
      order: [['createdAt', 'DESC']]
    });

    const transactions = rows.map(transaction => ({
      id: transaction.id,
      amount: transaction.amount,
      amountInPKR: transaction.amountInPkr,
      status: transaction.status,
      beneficiaryName: transaction.benificary?.fName || 'Unknown',
      isRDA: transaction.benificary?.type === 'my_self' || false,
      usiPaymentId: transaction.usiPaymentId,
      createdAt: transaction.createdAt,
      failureReason: transaction.failureReason
    }));

    res.json({
      transactions,
      pagination: {
        totalPages: Math.ceil(count / limit),
        currentPage: parseInt(page),
        total: count
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const manageBeneficiary = async (req, res) => {
  try {
    const { customerId, beneficiaryId } = req.params;
    const { action, reason } = req.body;

    const beneficiary = await benificary.findOne({
      where: { id: beneficiaryId, userId: customerId }
    });

    if (!beneficiary) {
      return res.status(404).json({ error: 'Beneficiary not found' });
    }

    const oldValues = { isSuspended: beneficiary.isSuspended };
    let newValues;

    if (action === 'suspend') {
      newValues = { isSuspended: true };
    } else if (action === 'unsuspend') {
      newValues = { isSuspended: false };
    } else if (action === 'verify') {
      newValues = { isVerified: true };
    } else {
      return res.status(400).json({ error: 'Invalid action' });
    }

    await beneficiary.update(newValues);

    await AuditLog.logAction({
      adminUserId: req.adminUser?.id,
      action: action.toUpperCase() + '_BENEFICIARY',
      resource: 'BENEFICIARY',
      resourceId: beneficiaryId,
      targetUserId: customerId,
      oldValues,
      newValues,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      metadata: { reason },
      severity: 'medium'
    });

    res.json({ message: `Beneficiary ${action}ed successfully` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const triggerAMLRescreen = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const customer = await User.findByPk(id);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // Create screening result record for the AML rescreen
    await require('../models').ScreeningResult.create({
      userId: id,
      isRemmiter: true,
      names: customer.fullName,
      dob: customer.dateOfBirth || null,
      fuzzy_search: 'true',
      totalHits: 0,
      message: `Manual AML rescreen initiated by admin (${req.adminUser.username}). Reason: ${reason || 'N/A'}`,
      matched: false,
      matchedRecord: null,
      rawResponse: null
    });

    await AuditLog.logAction({
      adminUserId: req.adminUser?.id,
      action: 'AML_RESCREEN',
      resource: 'USER',
      resourceId: id,
      targetUserId: id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      metadata: { reason },
      severity: 'high'
    });

    res.json({ message: 'AML rescreening initiated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Helper functions
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

module.exports = {
  getCustomerProfile,
  adjustCustomerLimits,
  getCustomerTransactions,
  manageBeneficiary,
  triggerAMLRescreen
};
