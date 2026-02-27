const APIError = require('../utils/APIError');

module.exports = (err, req, res, next) => {
    if (err instanceof APIError) {
        return res.status(err.statusCode || 500).json({
            success: false,
            message: err.message,
        });
    }

    // For other errors
    res.status(500).json({
        success: false,
        message: 'Internal Server Error',
    });
};
const { create, findByPk, findOne } = require('../utils/database');

const catchAsync = require('../utils/catchAsync');
const { MODELS, MESSAGES } = require('../utils/constants');
const { apiService } = require('../utils/axios');
const { APIresponse } = require('../utils/APIresponse');
const { makeUSIRequest } = require('../services/usi');
const status = require('http-status');
const { extractPostalCode } = require('../utils/utilityFunctions');
const db = require('../models');
const { sendNotificationToDevice } = require('../utils/notification');
const { sendEmailSendGrid } = require('../services/email');
// Generate a short random uppercase alphanumeric suffix to ensure unique references
function generateRefSuffix(len = 8) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let out = '';
    for (let i = 0; i < len; i++) {
        out += chars[Math.floor(Math.random() * chars.length)];
    }
    return out;
}
const kyc = catchAsync(async (req, res, next) => {
    const { documentType } = req.body;
    // Always fetch the latest KYC row for this user
    const finduser = await db[MODELS.KYC_REQUEST].findOne({
        where: { userId: req.user.id },
        order: [['createdAt', 'DESC']],
    });
    // If KYC is already verified, block a new attempt
    if (finduser && finduser?.status === "verified") {
        return next(new APIError('Your ID verification is approved.', status.BAD_REQUEST));
    }
    // If KYC is currently pending, inform client and do not create/update
    if (finduser && finduser?.status === 'pending') {
        return APIresponse(res, MESSAGES.KYC_VERIFICATION_PENDING);
    }
    // Validate required images
   if (!req.user.fullName) {
    return next(new APIError('Full name is required.', status.BAD_REQUEST));
   }
    if (!req.files || !req.files.front) {
        return next(new APIError('Front image is required.', status.BAD_REQUEST));
    }
    if (documentType === "id_card" && !req.files.back) {
        return next(new APIError('Back image is required for ID card.', status.BAD_REQUEST));
    }
    const user = await findByPk(MODELS.USER, req.user.id)
    const ref = `${user.id}-${Date.now()}-${generateRefSuffix(8)}`;

    // let payload = {
    //     reference: ref,
    //     callback_url: `${process.env.WEB_HOOK_URL}/kyc/callback`,
    //     language: 'EN',
    //     fetch_enhanced_data: '1',
    //     show_privacy_policy: '1',
    //     show_results: '1',
    //     ...(req.files.selfie && {
    //         face: {
    //             proof: req.files.selfie.data.toString('base64'),
    //         },
    //     }),
    //     document: {
    //         proof: req.files.front.data.toString('base64'),
    //         ...(documentType === "id_card" && { additional_proof: req.files.back.data.toString('base64') }),
    //         // name: {
    //         //     full_name: req.user.fullName,
    //         // },
    //         supported_types: [documentType],
    //         fetch_enhanced_data: '1'
    //     }
    // };
let payload = {
    reference: ref,
    callback_url: `${process.env.WEB_HOOK_URL}/kyc/callback`,
    language: 'EN',
    fetch_enhanced_data: '1',  // Keep this for supplementary data extraction
    show_privacy_policy: '1',
    show_results: '1',
    ...(req.files.selfie && {
        face: {
            proof: req.files.selfie.data.toString('base64'),
        },
    }),
    document: {
        proof: req.files.front.data.toString('base64'),
        ...(documentType === "id_card" && { additional_proof: req.files.back.data.toString('base64') }),
        supported_types: [documentType],
        fetch_enhanced_data: '1',  // Keep this here too if you want service-specific enhanced data

        // Additions for enabling validation checks:
        // Set to empty objects/strings to trigger OCR extraction + validation
        name: {
            first_name: "",  // Enables name extraction/validation (split into first/last)
            last_name: "",
            // Optional: Add fuzzy_match: "1" if you want approximate matching in future verifications
        },
        country: "",
        address: "",
        dob: "",  // Enables DOB extraction/validation (format will be yyyy-mm-dd in response)
        document_number: "",  // Enables document number extraction/validation
        issue_date: "",  // Optional but recommended: Enables issue date extraction/validation
        expiry_date: "",  // Optional but recommended: Enables expiry date extraction/validation
        gender: "",  // Optional: Enables gender extraction/validation (M/F/O)
        // You can add more if needed, e.g., age: "" for age calculation/validation from DOB
    }
};
    try {
        await apiService({
            method: 'POST',
            url: process.env.SHUFTI_URL,
            data: payload,
            auth: {
                username: process.env.SHUFTI_API_KEY,
                password: process.env.SHUFTI_API_SECRET,
            },
        });
    } catch (e) {
        // Surface meaningful provider error and avoid process crash
        const providerBody = e?.response?.data || e;
        const providerMsg = providerBody?.error?.message || providerBody?.message || e.message || 'KYC provider error';
        const errorCode = e?.code || '';
        console.error('KYC provider error:', providerBody || e);

        // If provider reports duplicate reference, treat as idempotent submission
        const isDuplicateRef = /reference has already been taken/i.test(providerMsg) || providerBody?.error?.key === 'reference';
        // If network timeout/reset after POST, provider may still process. Mark as pending optimistically.
        const isTransientPost = /timeout/i.test(providerMsg) || ['ECONNRESET', 'ECONNABORTED', 'ETIMEDOUT'].includes(errorCode);

        if (isDuplicateRef || isTransientPost) {
            // Upsert a pending KYC request with this reference and user
            let kycRow = await db[MODELS.KYC_REQUEST].findOne({ where: { referenceId: ref } });
            if (!kycRow) {
                kycRow = await db[MODELS.KYC_REQUEST].findOne({
                    where: { userId: user.id },
                    order: [["createdAt", "DESC"]],
                });
            }
            if (kycRow) {
                kycRow.referenceId = ref;
                kycRow.documentType = documentType;
                if (!kycRow.status || kycRow.status === 'not_initiated' || kycRow.status === 'pending') {
                    kycRow.status = 'pending';
                }
                await kycRow.save();
            } else {
                await create(MODELS.KYC_REQUEST, {
                    userId: user.id,
                    referenceId: ref,
                    documentType,
                    status: 'pending'
                });
            }

            // Ensure user is marked pending
            user.kycStatus = 'pending';
            await user.save();

            return APIresponse(res, MESSAGES.KYC_INITIATED);
        }
        if (/recharge/i.test(providerMsg)) {
            return next(new APIError('KYC service is temporarily unavailable: provider balance depleted. Please try again later.', status.SERVICE_UNAVAILABLE));
        }
        return next(new APIError(providerMsg, status.BAD_GATEWAY));
    }

    // Re-check existence by reference (callback may have created the row already)
    const existingByRef = await db[MODELS.KYC_REQUEST].findOne({ where: { referenceId: ref } });

    if (existingByRef) {
        // Ensure linkage and fields are correct
        existingByRef.userId = user.id;
        existingByRef.documentType = documentType;
        // Only set pending if not already terminal (verified/declined)
        if (!existingByRef.status || existingByRef.status === 'not_initiated' || existingByRef.status === 'pending') {
            existingByRef.status = 'pending';
        }
        await existingByRef.save();
    } else if (!finduser) {
        // No prior row: create a fresh one
        await create(MODELS.KYC_REQUEST, {
            userId: user.id,
            referenceId: ref,
            documentType,
            status: 'pending'
        });
    } else {
        // Reuse existing KYC row; update reference and status so user isn't blocked on a failed callback
        finduser.referenceId = ref;
        finduser.documentType = documentType;
        if (!finduser.status || finduser.status === 'not_initiated' || finduser.status === 'pending') {
            finduser.status = 'pending';
        }
        await finduser.save();
    }

    // Keep User's kycStatus in sync
    user.kycStatus = 'pending';
    await user.save();

    APIresponse(res, MESSAGES.KYC_INITIATED);
})

const callback = catchAsync(async (req, res, next) => {
    const { reference, event, verification_data, verification_result, info, additional_data, declined_reason } = req.body;
    console.log(req.body)
    let first_name; let last_name
    if (verification_data?.document?.name?.full_name) {
        [first_name, last_name] = verification_data.document.name.full_name.trim().split(" ");
    }
    let kycRequest = await findOne(MODELS.KYC_REQUEST, {
        where: { referenceId: reference },
    });
    // Fallback: if not found by reference, try to map by userId inferred from reference ("<uuid>-<timestamp>")
    let inferredUserId;
    if (!kycRequest && typeof reference === 'string') {
        const potentialUUID = reference.slice(0, 36);
        const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
        if (uuidRegex.test(potentialUUID)) {
            inferredUserId = potentialUUID;
            kycRequest = await db[MODELS.KYC_REQUEST].findOne({
                where: { userId: inferredUserId },
                order: [["createdAt", "DESC"]],
            });
        }
    }
    // If still not found, eagerly create a row so we can attach this callback (handles race where callback beats insert)
    if (!kycRequest && inferredUserId) {
        try {
            const userExists = await db[MODELS.USER].findByPk(inferredUserId);
            if (userExists) {
                kycRequest = await create(MODELS.KYC_REQUEST, {
                    userId: inferredUserId,
                    referenceId: reference,
                    status: 'pending',
                    overAllStatus: 'pending',
                });
            }
        } catch (e) {
            console.warn('Failed to auto-create KYC request on callback:', e?.message || e);
        }
    }
    if (!kycRequest) {
        console.warn('KYC callback received but request not found for reference:', reference);
        return res.status(200).send('OK');
    }
    try {
        const findUser = await findOne(MODELS.USER, {
            where: { id: kycRequest.userId },
            include: [{ model: db[MODELS.FCM], as: 'fcmToken' }]
        });

        // Determine outcome robustly
        const providerStatus = (verification_result?.status || verification_result?.document?.status || info?.status || '').toString().toLowerCase();
        const isAccepted = event === 'verification.accepted' || providerStatus === 'verified' || providerStatus === 'approved' || providerStatus === 'accepted';
        const isDeclined = event === 'verification.declined' || providerStatus === 'declined' || providerStatus === 'rejected' || providerStatus === 'failed';
        console.log('KYC callback outcome:', { event, providerStatus, isAccepted, isDeclined });

        // Process the verification result
        if (isAccepted) {
            // Update user status to verified
            console.log('KYC verification accepted');
            kycRequest.status = 'verified';
            findUser.kycStatus = 'verified';
            findUser.plan = 'plus';
            kycRequest.faceMatched = verification_data?.face_match_confidence || null;
            kycRequest.callbackPayload = req.body;
            // Ensure the referenceId is stored in case we reached here via fallback
            if (!kycRequest.referenceId) {
                kycRequest.referenceId = reference;
            }
            // Determine overall status depending on whether address has been captured
            const hasAddress = Boolean(kycRequest.postcode && kycRequest.address && kycRequest.city && kycRequest.phoneNumber);
            kycRequest.overAllStatus = hasAddress ? 'verified' : 'pending';
            await findUser.save();
            await kycRequest.save();
            try {
                await sendNotificationToDevice(findUser?.fcmToken?.fcm, 'KYC Request', `Your ID verification is approved.`);
            } catch (_) {}

            // Send success email (non-blocking for status updates)
            if (findUser?.email) {
                try {
                    await sendEmailSendGrid(
                        findUser.email,
                        'KYC Approved',
                        'Congratulations! Your KYC has been approved. You can now access all features.'
                    );
                } catch (_) {}
            }
        } else if (isDeclined) {
            console.log('KYC verification declined');
            kycRequest.status = 'declined';
            // Reflect decline in overall status too
            kycRequest.overAllStatus = 'not_initiated';
            kycRequest.reason = declined_reason || 'Verification declined';
            await kycRequest.save();
            // Notify user of declined KYC and suggest retry
            try {
                await sendNotificationToDevice(
                    findUser?.fcmToken?.fcm,
                    'KYC Request',
                    'KYC verification declined. Please try again.'
                );
            } catch (_) {}
            if (findUser?.email) {
                try {
                    await sendEmailSendGrid(
                        findUser.email,
                        'KYC Declined',
                        'Your KYC verification was declined. Please try again.'
                    );
                } catch (_) {}
            }
        } else {
            // Unknown intermediate event, keep pending but record payload for debugging
            console.log('KYC callback with intermediate status, keeping pending');
            kycRequest.callbackPayload = req.body;
            await kycRequest.save();
        }

        return res.status(200).send('OK');
    } catch (err) {
        console.error('KYC callback processing failed:', err);
        // Do not rollback previously saved KYC/User statuses on notification/email errors.
        return res.status(200).send('OK');
    }
})

const callbackSimple = catchAsync(async (req, res, next) => {
    const { reference, event, verification_data, verification_result, info, additional_data, declined_reason } = req.body;
    console.log("simple call back ----->", req.body)
    let first_name; let last_name
    if (verification_data?.document?.name?.full_name) {
        [first_name, last_name] = verification_data.document.name.full_name.trim().split(" ");
    }
    let kycRequest = await findOne(MODELS.KYC_REQUEST, {
        where: { referenceId: reference },
    });
    // Fallback: if not found by reference, try to map by userId inferred from reference ("<uuid>-<timestamp>")
    let inferredUserId;
    if (!kycRequest && typeof reference === 'string') {
        const potentialUUID = reference.slice(0, 36);
        const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
        if (uuidRegex.test(potentialUUID)) {
            inferredUserId = potentialUUID;
            kycRequest = await db[MODELS.KYC_REQUEST].findOne({
                where: { userId: inferredUserId },
                order: [["createdAt", "DESC"]],
            });
        }
    }
    // If still not found, eagerly create a row so we can attach this callback (handles race where callback beats insert)
    if (!kycRequest && inferredUserId) {
        try {
            const userExists = await db[MODELS.USER].findByPk(inferredUserId);
            if (userExists) {
                kycRequest = await create(MODELS.KYC_REQUEST, {
                    userId: inferredUserId,
                    referenceId: reference,
                    status: 'pending',
                    overAllStatus: 'pending',
                });
            }
        } catch (e) {
            console.warn('Failed to auto-create simple KYC request on callback:', e?.message || e);
        }
    }
    if (!kycRequest) {
        console.warn('Simple KYC callback received but request not found for reference:', reference);
        return res.status(200).send('OK');
    }
    try {
        const findUser = await findOne(MODELS.USER, {
            where: { id: kycRequest.userId },
            include: [{ model: db[MODELS.FCM], as: 'fcmToken' }]
        });

        await sendNotificationToDevice(findUser?.fcmToken?.fcm, 'KYC Request', `Your ID verification is ${event === 'verification.accepted' ? 'approved' : 'declined'}.`);

        // Process the verification result
        if (event === 'verification.accepted') {
            // Update user status to verified
            
            kycRequest.status = 'verified';
            findUser.kycStatus = 'verified';
            findUser.plan = 'base';
            kycRequest.faceMatched = verification_data?.face_match_confidence || null;
            kycRequest.callbackPayload = req.body;
            // Ensure the referenceId is stored in case we reached here via fallback
            if (!kycRequest.referenceId) {
                kycRequest.referenceId = reference;
            }
            await findUser.save();
            let payload = {
            "firstname": additional_data?.document?.additional_proof?.first_name || additional_data?.document?.proof?.first_name || first_name,
            "lastname": additional_data?.document?.additional_proof?.last_name || additional_data?.document?.proof?.last_name || last_name,
            "type": "registered",
            "status": "valid",
            "address1": additional_data?.document?.proof?.address,
            "nationality": additional_data?.document?.proof?.document_country_code,
            "dob": additional_data?.document?.proof?.dob,
            "mobile": findUser?.phoneNumber,
            "postcode": extractPostalCode(additional_data?.document?.proof?.address),
            // ID Document fields
            "id_type": additional_data?.document?.additional_proof?.document_type || additional_data?.document?.proof?.document_type || verification_data?.document?.supported_types?.[0],
            "id_details": additional_data?.document?.proof?.document_number,
            "id_issued_by": additional_data?.document?.proof?.place_of_issue || additional_data?.document?.proof?.document_country,
            "id_issue_country": additional_data?.document?.proof?.document_country,
            "id_start": additional_data?.document?.proof?.issue_date,
            "id_expiry": additional_data?.document?.proof?.expiry_date
        }
        // 452660,452664,452660,452664

        // const createRemittor = await createRemitter(payload)//
        const { success, result } = await makeUSIRequest("remitter", "createRemitter", payload);
        if (!success) {
            return next(new APIError(result, status.BAD_REQUEST));
        }
        console.log(result)
        findUser.remitoneCustomerId = result.result.remitter.remitter_id
        await findUser.save();
        await kycRequest.save();

        if (findUser?.email) {
            await sendEmailSendGrid(
                findUser.email,
                'KYC Approved',
                'Congratulations! Your KYC has been approved. You can now access all features.'
            );
        }

        // Send success notification
    } else if (event === 'verification.declined') {
        kycRequest.status = 'declined';
        kycRequest.reason = declined_reason || 'Verification declined';
        await kycRequest.save();
        // Notify user they were declined and suggest retry
        try {
            await sendNotificationToDevice(
                findUser?.fcmToken?.fcm,
                'KYC Request',
                'KYC verification declined. Please try again.'
            );
        } catch (_) {}
        if (findUser?.email) {
            try {
                await sendEmailSendGrid(
                    findUser.email,
                    'KYC Declined',
                    'Your KYC verification was declined. Please try again.'
                );
            } catch (_) {}
        }
    }

        return res.status(200).send('OK');
    } catch (err) {
        console.error('Simple KYC callback processing failed:', err);
        try {
            kycRequest.status = 'not_initiated';
            kycRequest.overAllStatus = 'not_initiated';
            await kycRequest.save();
            const userToReset = await findByPk(MODELS.USER, kycRequest.userId);
            if (userToReset) {
                userToReset.kycStatus = 'not_initiated';
                await userToReset.save();
            }
        } catch (e) {
            console.error('Failed to mark simple KYC as not_initiated after error:', e);
        }
        return res.status(200).send('OK');
    }
})

const simpleKyc = catchAsync(async (req, res, next) => {
    const ref = `${req.user.id}-${Date.now()}-${generateRefSuffix(8)}`;
    const { documentType } = req.body;

    let payload = {
        reference: ref,
        callback_url: `${process.env.WEB_HOOK_URL}/kyc/sp-notify-callback`,
        country: "GB",
        language: "EN",
    };
    payload['ekyc'] = {
        "allow_fallback": "0"
    };

    const test = await apiService({
        method: 'POST',
        url: process.env.SHUFTI_URL,
        data: payload,
        auth: {
            username: process.env.SHUFTI_API_KEY,
            password: process.env.SHUFTI_API_SECRET,
        },
    });

    await create(MODELS.KYC_REQUEST, {
        userId: req.user.id,
        referenceId: ref,
        documentType,
        status: 'pending'
    });

    // Keep User's kycStatus in sync for simpleKyc flow
    const simpleUser = await findByPk(MODELS.USER, req.user.id);
    if (simpleUser) {
        simpleUser.kycStatus = 'pending';
        await simpleUser.save();
    }

    APIresponse(res, MESSAGES.KYC_INITIATED, test);
})

/**
 * Creates a remitter via USI API
 * @param {Object} payload - The input data (usually req.body)
 * @returns {Promise<Object>} - The result object from USI
 * @throws {APIError} - If required fields are missing or USI call fails
 */
async function createRemitter(payload) {

    const { success, result } = await makeUSIRequest("remitter", "createRemitter", payload);

    if (!success) {
        throw new APIError(result, status.BAD_REQUEST);
    }

    return result;
}

const getKycresults = catchAsync(async (req, res, next) => {
    const kycResults = await findOne(MODELS.KYC_REQUEST, { userId: req.user.id });
    APIresponse(res, MESSAGES.SUCCESS, kycResults);
})

// Live KYC status: returns latest status and overAllStatus for current user
const getKycStatus = catchAsync(async (req, res, next) => {
    try {
        // Prefer any verified KYC record; otherwise return the most recently updated
        let latest = await db[MODELS.KYC_REQUEST].findOne({
            where: { userId: req.user.id, status: 'verified' },
            attributes: ['status', 'overAllStatus', 'address'],
            order: [["updatedAt", "DESC"]],
        });
        if (!latest) {
            latest = await db[MODELS.KYC_REQUEST].findOne({
                where: { userId: req.user.id },
                attributes: ['status', 'overAllStatus', 'address'],
                order: [["updatedAt", "DESC"]],
            });
        }

        if (!latest) {
            // If no KYC record yet, default to not_initiated
            return APIresponse(res, MESSAGES.SUCCESS, {
                status: 'not_initiated',
                overAllStatus: 'not_initiated',
            });
        }

        return APIresponse(res, MESSAGES.SUCCESS, latest);
    } catch (err) {
        return next(new APIError('Failed to fetch KYC status', status.INTERNAL_SERVER_ERROR));
    }
});

// Saves address details into KycRequests
const saveKycAddress = catchAsync(async (req, res, next) => {
    const { postcode, address, city, phoneNumber, isSocialSignin } = req.body;

    if (!postcode || !address || !city) {
        return next(new APIError('postcode, address and city are required', status.BAD_REQUEST));
    }

    // If social sign-in flow, phoneNumber is required; otherwise it's optional
    if (isSocialSignin && !phoneNumber) {
        return next(new APIError('phoneNumber is required for social sign-in', status.BAD_REQUEST));
    }

    // Try to find the latest KYC request for this user
    let kycRequest = await db[MODELS.KYC_REQUEST].findOne({
        where: { userId: req.user.id },
        order: [["createdAt", "DESC"]],
    });

    if (kycRequest) {
        // Update existing request's address fields
        kycRequest.postcode = postcode;
        kycRequest.address = address;
        kycRequest.city = city;
        if (phoneNumber) {
            kycRequest.phoneNumber = phoneNumber;
        }
        // If KYC is already verified via callback, overAllStatus becomes verified; else pending
        kycRequest.overAllStatus = kycRequest.status === 'verified' ? 'verified' : 'pending';
        await kycRequest.save();
    } else {
        // Do NOT create a new row; require that KYC is initiated first to avoid duplicates
        return next(new APIError('Hold on, we’re still verifying. You can retry shortly.', status.BAD_REQUEST));
    }

    // Phone number verification/update logic on User
    // Only process when phoneNumber is provided (for social sign-ins it may be omitted)
    if (phoneNumber) {
        const user = await findByPk(MODELS.USER, req.user.id);
        if (user) {
            const existingPhone = user.phoneNumber;
            const isVerified = user.isPhoneVerified === true;

            if (existingPhone && isVerified) {
                // If verified phone exists, it must match the provided phoneNumber
                if (existingPhone !== phoneNumber) {
                    return next(new APIError('Phone does not match the verified phone number.', status.BAD_REQUEST));
                }
                // If it matches, no change needed
            } else {
                // If no phone or not verified, update to provided phoneNumber
                user.phoneNumber = phoneNumber;
                await user.save();
            }
        }
    }

    APIresponse(res, MESSAGES.SUCCESS, kycRequest);
})

module.exports = {
    callback,
    kyc,
    getKycresults,
    simpleKyc,
    callbackSimple,
    saveKycAddress,
    getKycStatus
}