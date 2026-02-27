const APIError = require('../utils/APIError');
const { create, findByPk, findOne, update, findAll } = require('../utils/database');
const catchAsync = require('../utils/catchAsync');
const { MODELS, MESSAGES, ENUMS } = require('../utils/constants');
const { APIresponse } = require('../utils/APIresponse');
const status = require("http-status")
const { transactionSchema } = require('../utils/schema/transaction');
const db = require('../models');
const { validateRefId } = require('../utils/schema/general');
const { makeUSIRequest } = require('../services/usi');
const { sendNotificationToDevice } = require('../utils/notification');
const { Op } = require('sequelize');
const limits = require('../utils/limits');
const { transformTransactions } = require('../utils/transformTransaction');

const createTransaction = catchAsync(async (req, res, next) => {
  // Enforce anchor-monthly limit and KYC override
  await limits.enforceMonthlyLimitOrThrow(req, req.body.amount);
  const { benificaryId, amount, amountInPkr, sourceOfFund, sendingReason, collection_point_id, collection_point,collection_point_address,collection_point_city, fundingAccountName } = req.body;


  const { error } = transactionSchema.validate(req.body);

  if (error) {
    return next(new APIError(error.details[0].message, status.BAD_REQUEST));
  }

  // Ensure benificaryId is provided
  if (!benificaryId) {
    return next(new APIError(MESSAGES.BENIFICARY_NOT_FOUND, status.BAD_REQUEST));
  }

  // Verify beneficiary exists and belongs to the current user
  const existingBenificary = await findOne(MODELS.BENIFICARY, {
    where: { id: benificaryId, userId: req.user.id },
  });
  if (!existingBenificary) {
    return next(new APIError(MESSAGES.BENIFICARY_NOT_FOUND, status.NOT_FOUND));
  }

  // Verify funding account name matches KYC verified name
  if (fundingAccountName) {
    const userWithKyc = await findOne(MODELS.USER, {
      where: { id: req.user.id },
      include: [{
        model: db[MODELS.KYC_REQUEST],
        as: 'kyc'
      }]
    });

    if (userWithKyc.kycStatus === 'verified' && userWithKyc.kyc) {
      const verifiedName = userWithKyc.kyc.callbackPayload?.verification_data?.document?.name?.full_name 
        || userWithKyc.fullName;
      
      if (verifiedName) {
        const normalizedVerifiedName = verifiedName.toLowerCase().replace(/\s+/g, '');
        const normalizedFundingName = fundingAccountName.toLowerCase().replace(/\s+/g, '');
        
        if (normalizedVerifiedName !== normalizedFundingName) {
          return next(new APIError('Funding account name must match your verified ID name', status.FORBIDDEN));
        }
      }
    }
  }

  // Update beneficiary's latest sourceOfFund and sendingReason
  await update(
    MODELS.BENIFICARY,
    { sourceOfFund, sendingReason },
    { where: { id: benificaryId, userId: req.user.id } }
  );

  // Create transaction in the database
  const transactionData = {
    benificaryId, amount, amountInPkr, sourceOfFund, sendingReason, userId: req.user.id
  };
  
  // Add optional collection point fields if provided
  if (collection_point_id) transactionData.collection_point_id = collection_point_id;
  if (collection_point) transactionData.collection_point = collection_point;
  if (collection_point_address) transactionData.collection_point_address = collection_point_address;
  if (collection_point_city) transactionData.collection_point_city = collection_point_city;
  
  const transaction = await create(MODELS.TRANSACTION, transactionData);

  // Removed: do not award milestone1 on creation. First bonus is created via redeem flow/reservation.


  // Recalculate usedLimit for this anchor window and update user
  const usedNow = await limits.getUserMonthlyUsedGBP(req.user.id, req.user);
  await update(MODELS.USER, { usedLimit: usedNow }, { where: { id: req.user.id } });

  // Respond with the created transaction
  // Fetch latest KYC request to include overall status
  const latestKyc = await findOne(MODELS.KYC_REQUEST, {
    where: { userId: req.user.id },
    order: [["createdAt", "DESC"]],
  });
  const overAllStatus = latestKyc?.overAllStatus || 'not_initiated';

  return APIresponse(res, MESSAGES.TRANSACTION_CREATED, {
    transaction,
    status: req.user.plan,
    kycStatus: req.user.kycStatus,
    kycOverAllStatus: overAllStatus,
  });
});

const VolumeWebHook = catchAsync(async (req, res, next) => {
  const { merchantPaymentId, paymentStatus, errorDescription, paymentRequest, paymentId, paymentRefundData } = req.body

  console.log(`volume hook --------->`, merchantPaymentId)
  console.log(`Volume webhook full payload:`, JSON.stringify(req.body, null, 2))
  console.log(`paymentRefundData:`, JSON.stringify(paymentRefundData, null, 2))

  const { error } = validateRefId.validate({ merchantPaymentId })
  if (error) {
    console.log("Merchant Payment ID must be uppercase alphanumeric with minimum 18 characters")
    return APIresponse(res, MESSAGES.SUCCESS, {
    })
  }

  const findTransaction = await findOne(MODELS.TRANSACTION, {
    where: {
      refId: merchantPaymentId
    }
  })

  if (!findTransaction) {
    return next(
      new APIError(MESSAGES.TRANSACTION_NOT_FOUND, status.NOT_FOUND)
    )
  }

  const findRemitter = await findOne(MODELS.USER, {
    where: {
      id: findTransaction.userId,
    },
    include: [{
      model: db[MODELS.KYC_REQUEST],
      as: 'kyc'
    }]
  })

  // Verify payer name matches KYC-verified user name
  if (paymentRefundData?.accountHolderName && findRemitter.kycStatus === 'verified') {
    const payerName = paymentRefundData.accountHolderName;
    const verifiedName = findRemitter.kyc?.callbackPayload?.verification_data?.document?.name?.full_name 
      || findRemitter.fullName;
    
    if (verifiedName) {
      const normalizedPayerName = payerName.toLowerCase().replace(/[^a-z]/g, '');
      const normalizedVerifiedName = verifiedName.toLowerCase().replace(/[^a-z]/g, '');
      
      if (!normalizedPayerName.includes(normalizedVerifiedName) && !normalizedVerifiedName.includes(normalizedPayerName)) {
        console.error(`KYC NAME MISMATCH: Payer "${payerName}" does not match verified name "${verifiedName}" for transaction ${merchantPaymentId}`);
        
        // Update transaction status to flag the mismatch
        await update(MODELS.TRANSACTION, 
          { volumeStatus: 'KYC_MISMATCH', volumeError: `Payer name "${payerName}" does not match KYC verified name "${verifiedName}"` },
          { where: { refId: merchantPaymentId } }
        );
        
        return next(new APIError(`Payment rejected: Payer name does not match KYC verified identity`, status.FORBIDDEN));
      }
    }
    console.log(`KYC name verification passed: Payer "${payerName}" matches verified name "${verifiedName}"`);
  }

  const findBeneficiary = await findOne(MODELS.BENIFICARY, {
    where: {
      id: findTransaction.benificaryId,
    },
  })

  // Assume USIbeneficiaryId is already set during beneficiary creation.
  // Fallback to old logic if not set (for legacy beneficiaries).
  if (!findBeneficiary.USIbeneficiaryId) {
    // Legacy fallback: Search first, then create if not found.
    const remitterId = findRemitter.remitoneCustomerId;
    const searchData = {
      remitter_id: remitterId,
      country: 'Pakistan',
      name: findBeneficiary.fName,
      mobile: findBeneficiary.contactNo,
    };
    if (findBeneficiary.deliveryMethod === 'Account') {
      searchData.account_number = findBeneficiary.iban;
      searchData.bank = findBeneficiary.bankName;
    }
    const searchResp = await makeUSIRequest("beneficiary", "searchBeneficiary", searchData);
    let existingBenId;
    if (searchResp.success) {
      const r = searchResp.result;
      const candidates = [r?.beneficiaries?.beneficiary].filter(Boolean);
      const pickId = (item) => item?.id || item?.beneficiary_id;
      if (candidates.length) {
        const item = Array.isArray(candidates[0]) ? candidates[0][0] : candidates[0];
        existingBenId = pickId(item);
      }
    }

    if (existingBenId) {
      // If found, optional update (if details changed)
      const updateData = {
        beneficiary_id: existingBenId,
        // Add any changed fields...
        name: findBeneficiary.fName,
        address1: findBeneficiary.address1,
        city: findBeneficiary.city,
        country: "Pakistan",
        mobile: findBeneficiary.contactNo,
      };
      if (findBeneficiary.deliveryMethod === 'Account') {
        updateData.account_number = findBeneficiary.iban;
        updateData.benef_bank_iban = findBeneficiary.iban;
        updateData.bank = findBeneficiary.bankName;
        updateData.bank_branch = findBeneficiary.bankName;
        updateData.bank_branch_city = "Any Branch";
        updateData.bank_branch_state = "Any Branch";
      }
      await makeUSIRequest("beneficiary", "updateBeneficiary", updateData); // Ignore failure
      findBeneficiary.USIbeneficiaryId = existingBenId;
      await findBeneficiary.save();
    } else {
      // Create
      const data = {
        organisation_type: "INDIVIDUAL",
        name: findBeneficiary.fName,
        address1: findBeneficiary.address1,
        city: findBeneficiary.city,
        country: "Pakistan",
        mobile: findBeneficiary.contactNo,
        linked_member_id: remitterId
      };
      if (findBeneficiary.deliveryMethod === 'Account') {
        data.account_number = findBeneficiary.iban;
        data.benef_bank_iban = findBeneficiary.iban;
        data.bank = findBeneficiary.bankName;
        data.bank_branch = findBeneficiary.bankName;
        data.bank_branch_city = "Any Branch";
        data.bank_branch_state = "Any Branch";
      }
      // For Cash Collection, no bank fields
      const { success, result } = await makeUSIRequest("beneficiary", "createBeneficiary", data);
      if (!success) {
        if (result?.response_code === 'ERR0002' && result?.error_data?.existing_beneficiary_id) {
          findBeneficiary.USIbeneficiaryId = result.error_data.existing_beneficiary_id;
          await findBeneficiary.save();
        } else {
          const message = result?.errorMessage || result?.result?.message || 'USI beneficiary creation failed';
          return next(new APIError(message, status.BAD_REQUEST));
        }
      } else {
        findBeneficiary.USIbeneficiaryId = result.new_beneficiary_id;
        await findBeneficiary.save();
      }
    }
  }

  // check for the Payment Status of Volume 
  if (paymentStatus === "COMPLETED") {
    const { getCurrentAnchorWindowUK } = require('../utils/limits');
    const UserBonus = db.UserBonus;
    const anchorWindow = getCurrentAnchorWindowUK(findRemitter);
    const { startUK, endUK } = anchorWindow;
    // Fetch all eligible transfers for this user i
    // n this window
    const eligibleTransfers = await db.transaction.findAll({
      where: {
        userId: findRemitter.id,
        volumeStatus: ENUMS.COMPLETED,
        amount: { [Op.gte]: 155 },
        createdAt: { [Op.gte]: startUK, [Op.lt]: endUK },
      },
      include: [{ model: db.benificary, as: 'benificary', required: true }],
      order: [['createdAt', 'ASC']]
    });
    // Filter for non-RDA and >=24h gap
    let lastTimes = {};
    let eligibleCount = 0;
    let eligibleIndexes = [];
    for (let i = 0; i < eligibleTransfers.length; ++i) {
      const t = eligibleTransfers[i];
      if (t.benificary?.type && t.benificary.type.toLowerCase() === 'rda') continue;
      const bId = t.benificaryId;
      const prev = lastTimes[bId];
      if (!prev || (new Date(t.createdAt) - prev) >= 24*3600*1000) {
        eligibleCount++;
        eligibleIndexes.push(i);
        lastTimes[bId] = new Date(t.createdAt);
      }
    }
    
    let effectiveCount = eligibleCount;
    const nowTxTime = new Date(findTransaction.createdAt);
    const withinWindow = nowTxTime >= startUK && nowTxTime < endUK;
    const notRDA = !(findBeneficiary?.type && String(findBeneficiary.type).toLowerCase() === 'rda');
    const meetsAmount = Number(findTransaction.amount) >= 155;
    const lastForThisBen = lastTimes[findTransaction.benificaryId];
    const gapOK = !lastForThisBen || (nowTxTime - lastForThisBen) >= 24*3600*1000;
    if (withinWindow && notRDA && meetsAmount && gapOK) {
      effectiveCount = eligibleCount + 1;
    }
    const milestones = { 1: 250, 2: 300, 3: 350, 4: 500 };

    // If user reached later milestones, expire previous unredeemed bonuses in this window
    if (effectiveCount === 2) {
      await UserBonus.update(
        { expiresAt: new Date() },
        {
          where: {
            userId: findRemitter.id,
            anchorWindowId: `${startUK.toISOString()}_${endUK.toISOString()}`,
            bonusType: 'milestone1',
            usedAt: null,
            expiresAt: { [Op.gt]: new Date() },
          },
        }
      );
    }
    if (effectiveCount === 3) {
      await UserBonus.update(
        { expiresAt: new Date() },
        {
          where: {
            userId: findRemitter.id,
            anchorWindowId: `${startUK.toISOString()}_${endUK.toISOString()}`,
            bonusType: ['milestone1', 'milestone2'],
            usedAt: null,
            expiresAt: { [Op.gt]: new Date() },
          },
        }
      );
    }
    if (effectiveCount === 4) {
      await UserBonus.update(
        { expiresAt: new Date() },
        {
          where: {
            userId: findRemitter.id,
            anchorWindowId: `${startUK.toISOString()}_${endUK.toISOString()}`,
            bonusType: ['milestone1', 'milestone2', 'milestone3'],
            usedAt: null,
            expiresAt: { [Op.gt]: new Date() },
          },
        }
      );
    }

    if (milestones[effectiveCount]) {
      // Check if already awarded for this milestone in this window
      const already = await UserBonus.findOne({
        where: {
          userId: findRemitter.id,
          anchorWindowId: `${startUK.toISOString()}_${endUK.toISOString()}`,
          bonusType: `milestone${effectiveCount}`,
        }
      });
      if (!already) {
        await UserBonus.create({
          userId: findRemitter.id,
          amount: milestones[effectiveCount],
          awardedAt: new Date(),
          usedAt: effectiveCount === 1 ? new Date() : null,
          expiresAt: endUK,
          anchorWindowId: `${startUK.toISOString()}_${endUK.toISOString()}`,
          bonusType: `milestone${effectiveCount}`,
          transactionId: findTransaction.id
        });
      }
    }
    // After marking as completed, recalculate usedLimit for anchor window
    const limits = require('../utils/limits'); 
    const usedNow = await limits.getUserMonthlyUsedGBP(findRemitter.id, findRemitter);
    await update(MODELS.USER, { usedLimit: usedNow }, { where: { id: findRemitter.id } });

    // Map trans_type based on deliveryMethod
    let transType = findBeneficiary.deliveryMethod;
    const bankLower = (findBeneficiary.bankName || '').toLowerCase();
    if (transType === 'Account') {
      transType = 'Account';
      if (bankLower.includes('easypaisa') || bankLower.includes('jazzcash')) {
        transType = 'Mobile Transfer'; // Assuming USI supports this
      }
    } else if (transType === 'Cash Collection') {
      transType = 'Cash Collection';
    }

    const data = {
      remitter_id: findRemitter.remitoneCustomerId,
      beneficiary_id: findBeneficiary.USIbeneficiaryId,
      destination_country: findBeneficiary.country,
      trans_type: transType,
      source_of_income: findTransaction.sourceOfFund,
      purpose: findTransaction.sendingReason,
      payment_method: 74,
      source_currency: 'GBP',
      dest_currency: 'PKR',
      amount_type: "DESTINATION",
      amount_to_send: findTransaction.amountInPkr,
      service_level: "1",
      // Agent's unique transaction reference (as required by USI docs)
      agent_trans_ref: merchantPaymentId,
    };

    // For Cash Collection, add collection point details here
    if (findBeneficiary.deliveryMethod === 'Cash Collection') {
      data.collection_point = findBeneficiary.collection_point; // Assuming param name; confirm from full doc
      data.collection_point_bank = findBeneficiary.collection_point; // Assuming param name; confirm from full doc
      
      // Add optional collection_point_id and collection_point if they exist in transaction
      if (findTransaction.collection_point_id) {
        data.collection_point_id = findTransaction.collection_point_id;
      }
      if (findTransaction.collection_point) {
        data.collection_point = findTransaction.collection_point;
      }
      if (findTransaction.collection_point_address) {
        data.collection_point_address = findTransaction.collection_point_address;
      }
      if (findTransaction.collection_point_city) {
        data.collection_point_city = findTransaction.collection_point_city;
      }
    }
    console.log({ data })
    const { success, result, errorMessage } = await makeUSIRequest("transaction", "createTransaction", data);
    if (!success) {
      return next(new APIError(errorMessage || result?.result?.message || 'USI createTransaction failed', status.BAD_REQUEST));
    }
    console.log({ result })
    console.log({ trans_session_id: result.result.trans_session_id })
    const { success: succe, result: resu, errorMessage: errMsg } = await makeUSIRequest("transaction", "confirmTransaction", { trans_session_id: result.result.trans_session_id });
    // Add these console logs
    console.log('USI Transaction Response:', resu);
    console.log('USI Reference Number:', resu?.result?.reference_number);
    console.log('Full USI Response Object:', JSON.stringify(resu, null, 2));

    //
    if (!succe) {
      return next(new APIError(errMsg || resu?.result?.message || 'USI confirmTransaction failed', status.BAD_REQUEST));
    }
    console.log({ resu })
    console.log({ usiPaymentId: resu.result.reference_number })
    findTransaction.volumePaymentId = paymentId
    findTransaction.volumeStatus = ENUMS.COMPLETED
    findTransaction.volumeCompletedAt = new Date()
    // usi Fields
    findTransaction.usiPaymentId = resu.result.reference_number
    findTransaction.usiStatus = resu.result.status
    findTransaction.usiResponse = resu
    findTransaction.usiCompletedAt = new Date()

    await findTransaction.save()

    // If a bonus was reserved (e.g., first bonus) against this transaction, mark it used now
    try {
      await db.UserBonus.update(
        { usedAt: new Date() },
        {
          where: {
            userId: findRemitter.id,
            transactionId: findTransaction.id,
            usedAt: null,
          },
        }
      );
    } catch (e) {
      console.error('Failed to mark reserved bonus as used on completion:', e?.message || e);
    }
  }
  if (paymentStatus === "FAILED") {
    findTransaction.volumeStatus = ENUMS.FAILED
    findTransaction.failedAt = new Date()
    // Decode base64 errorDescription if provided
    let decodedError = "Unknown Error";
    if (errorDescription) {
      try {
        decodedError = Buffer.from(errorDescription, 'base64').toString('utf-8');
      } catch (e) {
        // If decoding fails, use the original string
        decodedError = errorDescription;
      }
    }
    findTransaction.failureReason = decodedError
    await findTransaction.save()
  }

  return APIresponse(res, MESSAGES.SUCCESS, {
  })
})

const listTransactions = catchAsync(async (req, res, next) => {
  // await new Promise(resolve => setTimeout(resolve, 3000));

  const { id } = req.params
  const findTransaction = await findOne(MODELS.TRANSACTION, {
    where: {
      refId: id,
      userId: req.user.id
    }
  })
  if(!findTransaction?.usiPaymentId) {
    return next(
      new APIError(MESSAGES.TRANSACTION_NOT_FOUND, status.NOT_FOUND)
    )
  }
  const data = {
    trans_ref: findTransaction.usiPaymentId
  }
  const { success, result } = await makeUSIRequest("transaction", "getTransactionStatus", data);
  if (!success) {
    return next(new APIError(result, status.BAD_REQUEST));
  }
  console.log({ result })
  if(findTransaction.usiStatus !== result.result.status) {
    findTransaction.usiCompletedAt = new Date()
  }
  findTransaction.usiStatus = result.result.status
  await findTransaction.save();
  const Transaction = await findOne(MODELS.TRANSACTION, {
    where: {
      refId: id,
      userId: req.user.id
    },
    include: [
      {
        model: db[MODELS.BENIFICARY],
        as: 'benificary',
        attributes: ["id", "fName", "bankName", "deliveryMethod", "iban"]
      }
    ],
    attributes: { exclude: ["usiResponse"] }
  })
  const optimizedTransaction = transformTransactions(Transaction);
  return APIresponse(res, MESSAGES.SUCCESS, optimizedTransaction)
})

const deepRoutes = catchAsync(async (req, res, next) => {
  const { status, paymentId, error, merchantPaymentId, errorDescription } = req.query;
  let finalError = error || '';
  
  console.log('=== DEEP ROUTES CALLED ===');
  console.log('Full URL:', req.originalUrl);
  console.log('Query params:', { status, paymentId, errorDescription, merchantPaymentId });
  
  // If errorDescription is provided (from Volume), decode it
  if (errorDescription && !finalError) {
    try {
      finalError = Buffer.from(errorDescription, 'base64').toString('utf-8');
      console.log('Decoded errorDescription:', finalError);
    } catch (e) {
      console.error('Error decoding errorDescription:', e?.message || e);
      finalError = errorDescription;
    }
  }
  
  // If status is FAILED and still no error message, try to fetch from transaction
  if (status === 'FAILED' && !finalError && merchantPaymentId) {
    try {
      const transaction = await findOne(MODELS.TRANSACTION, {
        where: { refId: merchantPaymentId }
      });
      if (transaction && transaction.failureReason) {
        finalError = transaction.failureReason;
        console.log('Fetched error from transaction:', finalError);
      }
    } catch (e) {
      console.error('Error fetching transaction for error message:', e?.message || e);
    }
  }
  
  // Deep link back to Flutter app
  // Build URL with proper encoding for query parameters
  const params = new URLSearchParams();
  params.append('status', status);
  params.append('paymentId', paymentId || '');
  params.append('error', finalError);
  
  const deepLink = `myapp://payment-complete?${params.toString()}`;
  console.log('Final deep link:', deepLink);

  // Redirect the browser/user to the app
  res.redirect(302, deepLink);
})

const listAllTransactions = catchAsync(async (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const statusFilter = req.query.status;

  if (page < 1) {
    return next(new APIError('Page must be greater than 0', status.BAD_REQUEST));
  }

  if (limit < 1 || limit > 100) {
    return next(new APIError('Limit must be between 1 and 100', status.BAD_REQUEST));
  }

  // Build where clause based on status filter
  let whereClause = {
    userId: req.user.id
  };

  if (statusFilter) {
    if (statusFilter.toLowerCase() === 'completed') {
      // For status=completed: WHERE usiStatus = 'PROCESSED' OR status = 'completed'
      whereClause[Op.or] = [
        { usiStatus: 'PROCESSED' },
        { status: 'completed' }
      ];
    } else if (statusFilter.toLowerCase() === 'failed') {
      // For status=failed: WHERE usiStatus IN ('ERROR', 'DELETED') 
      //    OR (status IN ('pending', 'cancelled', 'failed') AND volumeStatus = 'not_initiated')
      whereClause[Op.or] = [
        { usiStatus: { [Op.in]: ['ERROR', 'DELETED'] } },
        {
          [Op.and]: [
            { status: { [Op.in]: ['pending', 'cancelled', 'failed'] } },
            { volumeStatus: 'not_initiated' }
          ]
        }
      ];
    } else if (statusFilter.toLowerCase() !== 'all') {
      return next(new APIError('Invalid status filter. Use: completed, failed, or all', status.BAD_REQUEST));
    }
  }

  const offset = (page - 1) * limit;

  const { count, rows: findAllTransactions } = await db[MODELS.TRANSACTION].findAndCountAll({
    where: whereClause,
    include: [
      {
        model: db[MODELS.BENIFICARY],
        as: 'benificary',
        attributes: ["id", "fName", "bankName", "deliveryMethod", "iban"]
      }
    ],
    order: [['createdAt', 'DESC']],
    limit: limit,
    offset: offset
  })

  // Loop through each transaction and update status if needed
  for (const transaction of findAllTransactions) {
    // Skip if already processed or if usiPaymentId is missing
    if (transaction.usiStatus === 'PROCESSED' || !transaction.usiPaymentId 
      || transaction.volumeStatus === 'not_initiated') {
      continue;
    }

    try {
      const data = {
        trans_ref: transaction.usiPaymentId
      };
      const { success, result } = await makeUSIRequest("transaction", "getTransactionStatus", data);
      
      if (success && result?.result?.status) {
        if (transaction.usiStatus !== result.result.status) {
          transaction.usiCompletedAt = new Date();
        }
        transaction.usiStatus = result.result.status;
        await transaction.save();
      }
    } catch (error) {
      console.error(`Error updating status for transaction ${transaction.id}:`, error?.message || error);
    }
  }

  const totalPages = Math.ceil(count / limit);
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;

  const optimizedTransactions = transformTransactions(findAllTransactions);

  return APIresponse(res, MESSAGES.SUCCESS, {
    data: optimizedTransactions,
    pagination: {
      currentPage: page,
      totalPages: totalPages,
      totalItems: count,
      itemsPerPage: limit,
      hasNextPage: hasNextPage,
      hasPrevPage: hasPrevPage
    }
  })
})

const listFailedTransactions = catchAsync(async (req, res, next) => {
  const failedTransactions = await findAll(MODELS.TRANSACTION, {
    where: {
      userId: req.user.id,
      [Op.or]: [
        { volumeStatus: { [Op.ne]: ENUMS.COMPLETED } },
        { volumeStatus: null }
      ]
    },
    include: [
      {
        model: db[MODELS.BENIFICARY],
        as: 'benificary',
        attributes: ["id", "fName", "bankName", "deliveryMethod", "iban"]
      }
    ]
  })
  const optimizedTransactions = transformTransactions(failedTransactions);
  return APIresponse(res, MESSAGES.SUCCESS, optimizedTransactions)
})

module.exports = {
  createTransaction,
  VolumeWebHook,
  deepRoutes,
  listTransactions,
  listAllTransactions,
  listFailedTransactions
}


// const APIError = require('../utils/APIError');
// const { create, findByPk, findOne, update, findAll } = require('../utils/database');
// const catchAsync = require('../utils/catchAsync');
// const { MODELS, MESSAGES, ENUMS } = require('../utils/constants');
// const { APIresponse } = require('../utils/APIresponse');
// const status = require("http-status")
// const { transactionSchema } = require('../utils/schema/transaction');
// const db = require('../models');
// const { validateRefId } = require('../utils/schema/general');
// const { makeUSIRequest } = require('../services/usi');
// const { sendNotificationToDevice } = require('../utils/notification');
// const { Op } = require('sequelize');
// const limits = require('../utils/limits');

// const createTransaction = catchAsync(async (req, res, next) => {
//   // Enforce anchor-monthly limit and KYC override
//   await limits.enforceMonthlyLimitOrThrow(req, req.body.amount);
//   const { benificaryId, amount, amountInPkr, sourceOfFund, sendingReason } = req.body;

//   const { error } = transactionSchema.validate(req.body);

//   if (error) {
//     return next(new APIError(error.details[0].message, status.BAD_REQUEST));
//   }

//   // Ensure benificaryId is provided
//   if (!benificaryId) {
//     return next(new APIError(MESSAGES.BENIFICARY_NOT_FOUND, status.BAD_REQUEST));
//   }

//   // Verify beneficiary exists and belongs to the current user
//   const existingBenificary = await findOne(MODELS.BENIFICARY, {
//     where: { id: benificaryId, userId: req.user.id },
//   });
//   if (!existingBenificary) {
//     return next(new APIError(MESSAGES.BENIFICARY_NOT_FOUND, status.NOT_FOUND));
//   }

//   // Update beneficiary's latest sourceOfFund and sendingReason
//   await update(
//     MODELS.BENIFICARY,
//     { sourceOfFund, sendingReason },
//     { where: { id: benificaryId, userId: req.user.id } }
//   );

//   // Create transaction in the database
//   const transaction = await create(MODELS.TRANSACTION, {
//     benificaryId, amount, amountInPkr, sourceOfFund, sendingReason, userId: req.user.id
//   });

//   // Recalculate usedLimit for this anchor window and update user
//   const usedNow = await limits.getUserMonthlyUsedGBP(req.user.id, req.user);
//   await update(MODELS.USER, { usedLimit: usedNow }, { where: { id: req.user.id } });

//   // Respond with the created transaction
//   // Fetch latest KYC request to include overall status
//   const latestKyc = await findOne(MODELS.KYC_REQUEST, {
//     where: { userId: req.user.id },
//     order: [["createdAt", "DESC"]],
//   });
//   const overAllStatus = latestKyc?.overAllStatus || 'not_initiated';

//   return APIresponse(res, MESSAGES.TRANSACTION_CREATED, {
//     transaction,
//     status: req.user.plan,
//     kycStatus: req.user.kycStatus,
//     kycOverAllStatus: overAllStatus,
//   });
// });

// const VolumeWebHook = catchAsync(async (req, res, next) => {
//   const { merchantPaymentId, paymentStatus, errorDescription, paymentRequest, paymentId } = req.body

//   console.log(`volume hook --------->`, merchantPaymentId)

//   const { error } = validateRefId.validate({ merchantPaymentId })
//   if (error) {
//     return next(
//       new APIError("Merchant Payment ID must be uppercase alphanumeric with minimum 18 characters", status.BAD_REQUEST)
//     )
//   }

//   const findTransaction = await findOne(MODELS.TRANSACTION, {
//     where: {
//       refId: merchantPaymentId
//     }
//   })

//   if (!findTransaction) {
//     return next(
//       new APIError(MESSAGES.TRANSACTION_NOT_FOUND, status.NOT_FOUND)
//     )
//   }

//   const findRemitter = await findOne(MODELS.USER, {
//     where: {
//       id: findTransaction.userId,
//     },
//   })

//   const findBeneficiary = await findOne(MODELS.BENIFICARY, {
//     where: {
//       id: findTransaction.benificaryId,
//     },
//   })

//   if (!findBeneficiary.USIbeneficiaryId) {

//     const data = {
//       organisation_type: "INDIVIDUAL",
//       name: findBeneficiary.fName,
//       address1: findBeneficiary.address1,
//       city: findBeneficiary.city,
//       country: "Pakistan",
//       mobile: findBeneficiary.contactNo,
//       account_number: findBeneficiary.iban,
//       benef_bank_iban_code: findBeneficiary.iban,
//       bank: findBeneficiary.bankName,
//       bank_branch: findBeneficiary.bankName,
//       bank_branch_city: "Any Branch",
//       bank_branch_state: "Any Branch",
//       linked_member_id: findRemitter.remitoneCustomerId
//     }
// console.log({ data })
//     const { success, result } = await makeUSIRequest("beneficiary", "createBeneficiary", data);
//     console.log({ success, result });

//     if (!success) {
//       // Handle case where USI says beneficiary already exists
//       if (result?.response_code === 'ERR0002' && result?.error_data?.existing_beneficiary_id) {
//         findBeneficiary.USIbeneficiaryId = result.error_data.existing_beneficiary_id;
//         await findBeneficiary.save();
//       } else {
//         const message = result?.errorMessage || result?.result?.message || 'USI beneficiary creation failed';
//         return next(new APIError(message, status.BAD_REQUEST));
//       }
//     } else {
//       console.log({ result })
//       findBeneficiary.USIbeneficiaryId = result.new_beneficiary_id
//       await findBeneficiary.save()
//     }
//   }

//   console.log({ findBeneficiary })
//   // check for the Payment Status of Volume 
//   if (paymentStatus === "COMPLETED") {
//     // Award bonus if milestone reached (4th, 8th, 12th eligible transfer)
//     const { getCurrentAnchorWindowUK } = require('../utils/limits');
//     const UserBonus = db.UserBonus;
//     const anchorWindow = getCurrentAnchorWindowUK(findRemitter);
//     const { startUK, endUK } = anchorWindow;
//     // Fetch all eligible transfers for this user i
//     // n this window
//     const eligibleTransfers = await db.transaction.findAll({
//       where: {
//         userId: findRemitter.id,
//         volumeStatus: ENUMS.COMPLETED,
//         amount: { [Op.gte]: 85 },
//         createdAt: { [Op.gte]: startUK, [Op.lt]: endUK },
//       },
//       include: [{ model: db.benificary, as: 'benificary', required: true }],
//       order: [['createdAt', 'ASC']]
//     });
//     // Filter for non-RDA and >=24h gap
//     let lastTimes = {};
//     let eligibleCount = 0;
//     let eligibleIndexes = [];
//     for (let i = 0; i < eligibleTransfers.length; ++i) {
//       const t = eligibleTransfers[i];
//       if (t.benificary?.type && t.benificary.type.toLowerCase() === 'rda') continue;
//       const bId = t.benificaryId;
//       const prev = lastTimes[bId];
//       if (!prev || (new Date(t.createdAt) - prev) >= 24*3600*1000) {
//         eligibleCount++;
//         eligibleIndexes.push(i);
//         lastTimes[bId] = new Date(t.createdAt);
//       }
//     }
//     // Only award if this transfer is the 4th/8th/12th
//     const milestones = { 4: 500, 8: 700, 12: 1000 };

//     // If user reached the 8th or 12th milestone, expire previous unredeemed milestone bonuses in this window
//     if (eligibleCount === 8) {
//       await UserBonus.update(
//         { expiresAt: new Date() },
//         {
//           where: {
//             userId: findRemitter.id,
//             anchorWindowId: `${startUK.toISOString()}_${endUK.toISOString()}`,
//             bonusType: 'milestone4',
//             usedAt: null,
//             expiresAt: { [Op.gt]: new Date() },
//           },
//         }
//       );
//     }
//     if (eligibleCount === 12) {
//       await UserBonus.update(
//         { expiresAt: new Date() },
//         {
//           where: {
//             userId: findRemitter.id,
//             anchorWindowId: `${startUK.toISOString()}_${endUK.toISOString()}`,
//             bonusType: ['milestone4', 'milestone8'],
//             usedAt: null,
//             expiresAt: { [Op.gt]: new Date() },
//           },
//         }
//       );
//     }

//     if (milestones[eligibleCount]) {
//       // Check if already awarded for this milestone in this window
//       const already = await UserBonus.findOne({
//         where: {
//           userId: findRemitter.id,
//           anchorWindowId: `${startUK.toISOString()}_${endUK.toISOString()}`,
//           bonusType: `milestone${eligibleCount}`,
//         }
//       });
//       if (!already) {
//         await UserBonus.create({
//           userId: findRemitter.id,
//           amount: milestones[eligibleCount],
//           awardedAt: new Date(),
//           usedAt: null,
//           expiresAt: endUK,
//           anchorWindowId: `${startUK.toISOString()}_${endUK.toISOString()}`,
//           bonusType: `milestone${eligibleCount}`,
//           transactionId: findTransaction.id
//         });
//       }
//     }
//     // After marking as completed, recalculate usedLimit for anchor window
//     const limits = require('../utils/limits');
//     const usedNow = await limits.getUserMonthlyUsedGBP(findRemitter.id, findRemitter);
//     await update(MODELS.USER, { usedLimit: usedNow }, { where: { id: findRemitter.id } });
//     const data = {
//       remitter_id: findRemitter.remitoneCustomerId,
//       beneficiary_id: findBeneficiary.USIbeneficiaryId,
//       destination_country: findBeneficiary.country,
//       trans_type: findBeneficiary.deliveryMethod,
//       source_of_income: findTransaction.sourceOfFund,
//       purpose: findTransaction.sendingReason,
//       payment_method: 74,
//       source_currency: 'GBP',
//       dest_currency: 'PKR',
//       amount_type: "DESTINATION",
//       amount_to_send: findTransaction.amountInPkr,
//       service_level: "1",
//       // Agent's unique transaction reference (as required by USI docs)
//       agent_trans_ref: merchantPaymentId,
//     }
//     console.log({ data })
//     const { success, result, errorMessage } = await makeUSIRequest("transaction", "createTransaction", data);
//     if (!success) {
//       return next(new APIError(errorMessage || result?.result?.message || 'USI createTransaction failed', status.BAD_REQUEST));
//     }
//     console.log({ result })
//     console.log({ trans_session_id: result.result.trans_session_id })
//     const { success: succe, result: resu, errorMessage: errMsg } = await makeUSIRequest("transaction", "confirmTransaction", { trans_session_id: result.result.trans_session_id });
//     if (!succe) {
//       return next(new APIError(errMsg || resu?.result?.message || 'USI confirmTransaction failed', status.BAD_REQUEST));
//     }
//     console.log({ resu })
//     console.log({ usiPaymentId: resu.result.reference_number })
//     findTransaction.volumePaymentId = paymentId
//     findTransaction.volumeStatus = ENUMS.COMPLETED
//     findTransaction.volumeCompletedAt = new Date()
//     // usi Fields
//     findTransaction.usiPaymentId = resu.result.reference_number
//     findTransaction.usiStatus = resu.result.status
//     findTransaction.usiResponse = resu
//     findTransaction.usiCompletedAt = new Date()

//     await findTransaction.save()
//   }
//   if (paymentStatus === "FAILED") {
//     findTransaction.volumeStatus = ENUMS.FAILED
//     findTransaction.failedAt = new Date()
//     findTransaction.failureReason = errorDescription || "Unknown Error"
//     await findTransaction.save()
//   }

//   return APIresponse(res, MESSAGES.SUCCESS, {
//   })
// })

// const listTransactions = catchAsync(async (req, res, next) => {
//   // await new Promise(resolve => setTimeout(resolve, 3000));

//   const { id } = req.params
//   const findTransaction = await findOne(MODELS.TRANSACTION, {
//     where: {
//       refId: id
//     }
//   })
//   const data = {
//     trans_ref: findTransaction.usiPaymentId
//   }
//   const { success, result } = await makeUSIRequest("transaction", "getTransactionStatus", data);
//   if (!success) {
//     return next(new APIError(result, status.BAD_REQUEST));
//   }
//   console.log({ result })
//   findTransaction.usiStatus = result.result.status
//   findTransaction.usiCompletedAt = new Date()
//   await findTransaction.save();
//   const Transaction = await findOne(MODELS.TRANSACTION, {
//     where: {
//       refId: id
//     },
//     attributes: { exclude: ["usiResponse"] }
//   })
//   // Delay response for 4 seconds
//   return APIresponse(res, MESSAGES.SUCCESS, Transaction)
// })

// const deepRoutes = catchAsync(async (req, res, next) => {
//   const { status, paymentId, error } = req.query;
//   // Deep link back to Flutter app
//   const deepLink = `myapp://payment-complete?status=${status}&paymentId=${paymentId || ''}&error=${error || ''}`;

//   // Redirect the browser/user to the app
//   res.redirect(302, deepLink);
// })

// const listAllTransactions = catchAsync(async (req, res, next) => {
//   const findAllTransactions = await findAll(MODELS.TRANSACTION, {
//     where: {
//       userId: req.user.id,
//       [Op.not]: {
//         [Op.and]: [
//           { volumeStatus: ENUMS.NOT_INITIATED },
//           { volumePaymentId: null }
//         ]
//       }
//     },
//     include: [
//       {
//         model: db[MODELS.BENIFICARY],
//         as: 'benificary',
//         attributes: ["id", "fName", "bankName", "deliveryMethod"]
//       }
//     ]
//   })
//   return APIresponse(res, MESSAGES.SUCCESS, findAllTransactions)
// })

// module.exports = {
//   createTransaction,
//   VolumeWebHook,
//   deepRoutes,
//   listTransactions,
//   listAllTransactions
// }