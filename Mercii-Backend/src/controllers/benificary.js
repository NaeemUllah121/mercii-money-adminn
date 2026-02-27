const APIError = require('../utils/APIError');
const { create, findOne, findAll } = require('../utils/database');
const status = require('http-status')
const catchAsync = require('../utils/catchAsync');
const { MODELS, MESSAGES } = require('../utils/constants');
const { APIresponse } = require('../utils/APIresponse');
const { makeUSIRequest } = require('../services/usi');

const createB = catchAsync(async (req, res, next) => {
    const { deliveryMethod, iban, bankName, contactNo, city, address1, pickupLocation, collection_point_id, collection_point, collection_point_address, collection_point_city } = req.body;
    let fName = req.body.fName;
    // Validate fName: at least two characters in each word and remove double spaces
    if (typeof fName !== 'string') {
        return next(new APIError('First name must be a string', status.BAD_REQUEST));
    }
    // Remove double (or multiple) spaces and trim
    const cleanedFName = fName.replace(/\s+/g, ' ').trim();
    const nameParts = cleanedFName.split(' ');

    if (nameParts.some(part => part.length < 2)) {
        return next(new APIError('Each part of the first name must have at least 2 characters', status.BAD_REQUEST));
    }

    // set fName to cleaned value for later usage
    req.body.fName = cleanedFName;
    fName = cleanedFName;

    // Normalize wallet provider names for consistent storage/checks
    const normalizeWalletProvider = (name) => {
        if (!name) return null;
        const n = String(name).toLowerCase();
        if (n.includes('easypaisa') || n.includes('telenor microfinance')) return 'Easypaisa';
        if (n.includes('jazzcash') || n.includes('mobilink microfinance')) return 'JazzCash';
        return null;
    };

    const dm = String(deliveryMethod || '').trim();
    const walletProvider = normalizeWalletProvider(bankName);
    const effectiveBankName = walletProvider || bankName;

    // Duplicate check
    const dmLower = dm.toLowerCase();
    let where = { userId: req.user.id };
    
    if (dmLower === 'cash collection') {
        // For Cash Collection, check if same contactNo OR address1 exists
        const { Op } = require('sequelize');
        where = {
            userId: req.user.id,
            deliveryMethod: 'Cash Collection',
            [Op.or]: [
                { contactNo },
                { address1 }
            ]
        };
        const check = await findOne(MODELS.BENIFICARY, { where });
        if (check) {
            return next(new APIError('Beneficiary already exists with same phone number or address', status.BAD_REQUEST));
        }
    } else if (dmLower === 'account' && walletProvider) {
        where = { ...where, deliveryMethod: 'Account', iban, bankName: walletProvider };
        const check = await findOne(MODELS.BENIFICARY, { where });
        if (check) {
            return next(new APIError(MESSAGES.BENIFICARY_EXISTS, status.BAD_REQUEST));
        }
    } else {
        where = { ...where, deliveryMethod, iban };
        const check = await findOne(MODELS.BENIFICARY, { where });
        if (check) {
            return next(new APIError(MESSAGES.BENIFICARY_EXISTS, status.BAD_REQUEST));
        }
    }

    // Validations by delivery method
    // const dmLower = dm.toLowerCase();
    const bank = String(effectiveBankName || '').trim();
    const isNonEmpty = (v) => v !== undefined && v !== null && String(v).trim() !== '';
    const onlyDigits = (v) => String(v || '').replace(/\D/g, '');

    // Common requireds
    if (!isNonEmpty(fName)) {
        return next(new APIError('Beneficiary name (fName) is required', status.BAD_REQUEST));
    }
    if (!isNonEmpty(contactNo)) {
        return next(new APIError('Beneficiary contactNo is required', status.BAD_REQUEST));
    }

    if (dmLower === 'account') {
        if (!isNonEmpty(bank)) {
            return next(new APIError('bankName is required for Account delivery method', status.BAD_REQUEST));
        }
        const isWallet = bank.toLowerCase() === 'easypaisa' || bank.toLowerCase() === 'jazzcash';
        if (isWallet) {
            if (!isNonEmpty(iban)) {
                return next(new APIError('Wallet number is required in iban for Easypaisa/JazzCash', status.BAD_REQUEST));
            }
            const digits = onlyDigits(iban);
            if (digits.length < 10) {
                return next(new APIError('Wallet number (iban) appears invalid', status.BAD_REQUEST));
            }
        } else {
            if (!isNonEmpty(iban)) {
                return next(new APIError('IBAN/Account number (iban) is required for bank transfer', status.BAD_REQUEST));
            }
        }
    }

    if (dmLower === 'cash collection') {
        // For Cash Collection, iban and bankName are NOT required
        if (!isNonEmpty(city)) {
            return next(new APIError('city is required for Cash Collection', status.BAD_REQUEST));
        }
        if (!isNonEmpty(address1)) {
            return next(new APIError('address1 is required for Cash Collection', status.BAD_REQUEST));
        }
        if (!isNonEmpty(pickupLocation)) {
            return next(new APIError('pickupLocation is required for Cash Collection', status.BAD_REQUEST));
        }
    }

    // Create local beneficiary first
    const ben = await create(MODELS.BENIFICARY, { 
        ...req.body, 
        bankName: effectiveBankName, 
        country: 'Pakistan', 
        userId: req.user.id 
    });

    // Sync with USI only if remitter exists
    if (req.user.remitoneCustomerId) {
        const remitterId = req.user.remitoneCustomerId;

        // 1. Search for existing beneficiary linked to this remitter
        // Send only required fields for USI API
        const searchData = {
            linked_remitter_id: remitterId,
            country: 'Pakistan',
            name: fName,
            mobile: contactNo,
        };
        if (dmLower === 'account') {
            searchData.account_number = iban;
            searchData.benef_bank_iban = iban;
            searchData.bank = effectiveBankName;
            searchData.city = city;
            searchData.address1 = address1;
          
        }
        if (dmLower === 'cash collection') {
            searchData.address1 = address1;
            searchData.city = city;

        }

        let existingBenId;
        try {
            console.log("USI searchBeneficiary payload:", searchData);
            const searchResp = await makeUSIRequest("beneficiary", "searchBeneficiary", searchData);
            if (searchResp.success) {
                const r = searchResp.result;
                const candidates = [r?.beneficiaries?.beneficiary].filter(Boolean);
                const pickId = (item) => item?.id || item?.beneficiary_id;
                if (candidates.length) {
                    const item = Array.isArray(candidates[0]) ? candidates[0][0] : candidates[0];
                    existingBenId = pickId(item);
                }
            }
        } catch (error) {
            console.warn("USI search beneficiary failed:", error?.message || error);
            // Non-fatal, continue without USI sync
        }

        if (existingBenId) {
            ben.USIbeneficiaryId = existingBenId;
            // Optional: Update with latest details - send only required fields
            const updateData = {
                beneficiary_id: existingBenId,
                name: fName,
                address1: address1,
                city: city,
                country: "Pakistan",
                mobile: contactNo,
            };
            if (dmLower === 'account') {
                updateData.account_number = iban;
                updateData.benef_bank_iban = iban;
                updateData.bank = effectiveBankName;
                updateData.bank_branch = effectiveBankName;
                updateData.bank_branch_city = "Any Branch";
                updateData.bank_branch_state = "Any Branch";
            }
            try {
                console.log("USI updateBeneficiary payload:", updateData);
                const updateResp = await makeUSIRequest("beneficiary", "updateBeneficiary", updateData);
                if (!updateResp.success) {
                    console.warn("USI updateBeneficiary failed:", updateResp.result);
                }
            } catch (error) {
                console.warn("USI update beneficiary failed:", error?.message || error);
            }
        } else {
            // 2. Create new beneficiary in USI - send only required fields
            const createData = {
                organisation_type: "INDIVIDUAL",
                name: fName,
                address1: address1,
                city: city,
                country: "Pakistan",
                mobile: contactNo,
                linked_member_id: remitterId
            };
            if (dmLower === 'account') {
                createData.account_number = iban;
                createData.benef_bank_iban = iban;
                createData.bank = effectiveBankName;
                createData.bank_branch = effectiveBankName;
                createData.bank_branch_city = "Any Branch";
                createData.bank_branch_state = "Any Branch";
            }
            
            try {
                console.log("USI createBeneficiary payload:", createData);
                const createResp = await makeUSIRequest("beneficiary", "createBeneficiary", createData);
                if (!createResp.success) {
                    const resp = createResp?.result || createResp;
                    if (resp?.response_code === 'ERR0002' && resp?.error_data?.existing_beneficiary_id) {
                        // Beneficiary already exists in USI: set ID and update details
                        ben.USIbeneficiaryId = resp.error_data.existing_beneficiary_id;
                        try {
                            const updateData = {
                                beneficiary_id: ben.USIbeneficiaryId,
                                name: fName,
                                address1: address1,
                                city: city,
                                country: "Pakistan",
                                mobile: contactNo,
                            };
                            if (dmLower === 'account') {
                                updateData.account_number = iban;
                                updateData.benef_bank_iban = iban;
                                updateData.bank = effectiveBankName;
                                updateData.bank_branch = effectiveBankName;
                                updateData.bank_branch_city = "Any Branch";
                                updateData.bank_branch_state = "Any Branch";
                            }
                            console.log("USI updateBeneficiary payload (after ERR0002):", updateData);
                            const updateResp = await makeUSIRequest("beneficiary", "updateBeneficiary", updateData);
                            if (!updateResp.success) {
                                console.warn("USI updateBeneficiary (after ERR0002) failed:", updateResp.result);
                            }
                        } catch (e) {
                            console.warn("USI update beneficiary (after ERR0002) failed:", e?.message || e);
                        }
                    } else {
                        console.warn("USI beneficiary creation failed:", createResp?.errorMessage || resp?.result?.message || resp?.message);
                        // Non-fatal, continue without USI ID
                    }
                } else {
                    ben.USIbeneficiaryId = createResp.result.new_beneficiary_id;
                }
            } catch (error) {
                console.warn("USI create beneficiary failed:", error?.message || error);
                // Non-fatal, continue without USI ID
            }
        }

        await ben.save();
    }
    // If no remitter ID, just save the local beneficiary without USI sync
    // USI sync will happen later during transaction when remitter is created

    return APIresponse(res, MESSAGES.SUCCESS, ben);
});
const getBenificaries = catchAsync(async (req, res, next) => {
    const get = await findAll(MODELS.BENIFICARY, {
        where: {
            userId: req.user.id,
        },
    });
    return APIresponse(res, MESSAGES.SUCCESS, get);
})

const delBenificary = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const ben = await findOne(MODELS.BENIFICARY, {
        where: {
            id,
            userId: req.user.id,
        }
    });
    if (!ben) {
        return next(new APIError(MESSAGES.BENIFICARY_NOT_FOUND, 404))
    }
    await ben.destroy();
    return APIresponse(res, MESSAGES.SUCCESS)
})

// Update beneficiary's additional details (relation and contact)
const updateBenificaryContact = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const { relation, contact } = req.body;

    const ben = await findOne(MODELS.BENIFICARY, {
        where: { id, userId: req.user.id }
    });

    if (!ben) {
        return next(new APIError(MESSAGES.BENIFICARY_NOT_FOUND, 404));
    }

    const existing = ben.additionalDetails || {};
    ben.additionalDetails = {
        ...existing,
        contactNumber: contact ?? existing.contactNumber ?? null,
        relation: relation ?? existing.relation ?? null,
    };

    await ben.save();
    return APIresponse(res, MESSAGES.SUCCESS, ben);
});

// Update core beneficiary details
const updateBenificaryDetails = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const {
        deliveryMethod,
        iban,
        fName,
        bankName,
        contactNo,
        city,
        address1,
        pickupLocation,
        collection_point_id,
        collection_point,
        collection_point_address,
        collection_point_city,
    } = req.body;

    // Ensure the beneficiary belongs to the authenticated user
    const ben = await findOne(MODELS.BENIFICARY, {
        where: { id, userId: req.user.id }
    });

    if (!ben) {
        return next(new APIError(MESSAGES.BENIFICARY_NOT_FOUND, 404));
    }

    // If iban or deliveryMethod are changing, prevent duplicates for the same user
    const nextIban = iban !== undefined ? iban : ben.iban;
    const nextDeliveryMethod = deliveryMethod !== undefined ? deliveryMethod : ben.deliveryMethod;

    if (nextIban && nextDeliveryMethod) {
        const duplicate = await findOne(MODELS.BENIFICARY, {
            where: {
                iban: nextIban,
                deliveryMethod: nextDeliveryMethod,
                userId: req.user.id,
            }
        });

        if (duplicate && String(duplicate.id) !== String(ben.id)) {
            return next(new APIError(MESSAGES.BENIFICARY_EXISTS, status.BAD_REQUEST));
        }
    }

    // Apply partial updates only for provided fields
    const fields = {
        deliveryMethod,
        iban,
        fName,
        bankName,
        contactNo,
        city,
        address1,
        pickupLocation,
        collection_point_id,
        collection_point,
        collection_point_address,
        collection_point_city,
    };

    let changed = false;
    for (const [key, value] of Object.entries(fields)) {
        if (value !== undefined && ben[key] !== value) {
            ben[key] = value;
            changed = true;
        }
    }

    if (changed) {
      await ben.save();
      // Resync with USI if USI ID exists (updateBeneficiary)
      if (ben.USIbeneficiaryId) {
        const updateData = {
          beneficiary_id: ben.USIbeneficiaryId,
          name: ben.fName,
          address1: ben.address1,
          city: ben.city,
          country: "Pakistan",
          mobile: ben.contactNo,
        };
        if (ben.deliveryMethod.toLowerCase() === 'account') {
          updateData.account_number = ben.iban;
          updateData.benef_bank_iban = ben.iban;
          updateData.bank = ben.bankName;
          updateData.bank_branch = ben.bankName;
          updateData.bank_branch_city = "Any Branch";
          updateData.bank_branch_state = "Any Branch";
        }
        const updateResp = await makeUSIRequest("beneficiary", "updateBeneficiary", updateData);
        if (!updateResp.success) {
          console.warn("USI updateBeneficiary failed during details update:", updateResp.result);
          // Non-fatal
        }
      }
    }

    return APIresponse(res, MESSAGES.SUCCESS, ben);
});

module.exports = {
    createB,
    getBenificaries,
    delBenificary,
    updateBenificaryContact,
    updateBenificaryDetails
}


// const APIError = require('../utils/APIError');
// const { create, findOne, findAll } = require('../utils/database');
// const status = require('http-status')
// const catchAsync = require('../utils/catchAsync');
// const { MODELS, MESSAGES } = require('../utils/constants');
// const { APIresponse } = require('../utils/APIresponse');
// const { makeUSIRequest } = require('../services/usi');

// const createB = catchAsync(async (req, res, next) => {
//     const { deliveryMethod, iban, fName, bankName, contactNo, city, address1, pickupLocation } = req.body;

//     // Normalize wallet provider names for consistent storage/checks
//     const normalizeWalletProvider = (name) => {
//         if (!name) return null;
//         const n = String(name).toLowerCase();
//         if (n.includes('easypaisa') || n.includes('telenor microfinance')) return 'Easypaisa';
//         if (n.includes('jazzcash') || n.includes('mobilink microfinance')) return 'JazzCash';
//         return null;
//     };

//     const dm = String(deliveryMethod || '').trim();
//     const walletProvider = normalizeWalletProvider(bankName);
//     const effectiveBankName = walletProvider || bankName; // what we'll store and check against

//     // Duplicate check
//     let where = { userId: req.user.id };
//     if (dm.toLowerCase() === 'account' && walletProvider) {
//         // For wallets, uniqueness is (iban + provider + user)
//         where = { ...where, deliveryMethod: 'Account', iban, bankName: walletProvider };
//     } else {
//         // For bank account (and other types), keep previous uniqueness
//         where = { ...where, deliveryMethod, iban };
//     }
//     const check = await findOne(MODELS.BENIFICARY, { where });
//     if (check) {
//         return next(new APIError(MESSAGES.BENIFICARY_EXISTS, status.BAD_REQUEST));
//     }

//     // Validations by delivery method
//     const dmLower = dm.toLowerCase();
//     const bank = String(effectiveBankName || '').trim();
//     const isNonEmpty = (v) => v !== undefined && v !== null && String(v).trim() !== '';
//     const onlyDigits = (v) => String(v || '').replace(/\D/g, '');

//     // Common requireds
//     if (!isNonEmpty(fName)) {
//         return next(new APIError('Beneficiary name (fName) is required', status.BAD_REQUEST));
//     }
//     if (!isNonEmpty(contactNo)) {
//         return next(new APIError('Beneficiary contactNo is required', status.BAD_REQUEST));
//     }

//     if (dmLower === 'account') {
//         if (!isNonEmpty(bank)) {
//             return next(new APIError('bankName is required for Account delivery method', status.BAD_REQUEST));
//         }
//         const isWallet = bank.toLowerCase() === 'easypaisa' || bank.toLowerCase() === 'jazzcash';
//         if (isWallet) {
//             // For wallets, expect phone number in iban
//             if (!isNonEmpty(iban)) {
//                 return next(new APIError('Wallet number is required in iban for Easypaisa/JazzCash', status.BAD_REQUEST));
//             }
//             const digits = onlyDigits(iban);
//             if (digits.length < 10) {
//                 return next(new APIError('Wallet number (iban) appears invalid', status.BAD_REQUEST));
//             }
//         } else {
//             if (!isNonEmpty(iban)) {
//                 return next(new APIError('IBAN/Account number (iban) is required for bank transfer', status.BAD_REQUEST));
//             }
//         }
//     }

//     if (dmLower === 'cash collection') {
//         if (!isNonEmpty(city)) {
//             return next(new APIError('city is required for Cash Collection', status.BAD_REQUEST));
//         }
//         if (!isNonEmpty(address1)) {
//             return next(new APIError('address1 is required for Cash Collection', status.BAD_REQUEST));
//         }
//         if (!isNonEmpty(pickupLocation)) {
//             return next(new APIError('pickupLocation is required for Cash Collection', status.BAD_REQUEST));
//         }
//     }

//     // Persist normalized bankName for wallets so duplicates work consistently later
//     const ben = await create(MODELS.BENIFICARY, { ...req.body, bankName: effectiveBankName, country: 'Pakistan', userId: req.user.id });
//     return APIresponse(res, MESSAGES.SUCCESS, ben);
// });

// const getBenificaries = catchAsync(async (req, res, next) => {
//     const get = await findAll(MODELS.BENIFICARY, {
//         where: {
//             userId: req.user.id,
//         },
//     });
//     return APIresponse(res, MESSAGES.SUCCESS, get);
// })

// const delBenificary = catchAsync(async (req, res, next) => {
//     const { id } = req.params;
//     const ben = await findOne(MODELS.BENIFICARY, {
//         where: {
//             id,
//             userId: req.user.id,
//         }
//     });
//     if (!ben) {
//         return next(new APIError(MESSAGES.BENIFICARY_NOT_FOUND, 404))
//     }
//     await ben.destroy();
//     return APIresponse(res, MESSAGES.SUCCESS)
// })

// // Update beneficiary's additional details (relation and contact)
// const updateBenificaryContact = catchAsync(async (req, res, next) => {
//     const { id } = req.params;
//     const { relation, contact } = req.body;

//     const ben = await findOne(MODELS.BENIFICARY, {
//         where: { id, userId: req.user.id }
//     });

//     if (!ben) {
//         return next(new APIError(MESSAGES.BENIFICARY_NOT_FOUND, 404));
//     }

//     const existing = ben.additionalDetails || {};
//     ben.additionalDetails = {
//         ...existing,
//         contactNumber: contact ?? existing.contactNumber ?? null,
//         relation: relation ?? existing.relation ?? null,
//     };

//     await ben.save();
//     return APIresponse(res, MESSAGES.SUCCESS, ben);
// });

// // Update core beneficiary details
// const updateBenificaryDetails = catchAsync(async (req, res, next) => {
//     const { id } = req.params;
//     const {
//         deliveryMethod,
//         iban,
//         fName,
//         bankName,
//         contactNo,
//         city,
//         address1,
//         pickupLocation,
//     } = req.body;

//     // Ensure the beneficiary belongs to the authenticated user
//     const ben = await findOne(MODELS.BENIFICARY, {
//         where: { id, userId: req.user.id }
//     });

//     if (!ben) {
//         return next(new APIError(MESSAGES.BENIFICARY_NOT_FOUND, 404));
//     }

//     // If iban or deliveryMethod are changing, prevent duplicates for the same user
//     const nextIban = iban !== undefined ? iban : ben.iban;
//     const nextDeliveryMethod = deliveryMethod !== undefined ? deliveryMethod : ben.deliveryMethod;

//     if (nextIban && nextDeliveryMethod) {
//         const duplicate = await findOne(MODELS.BENIFICARY, {
//             where: {
//                 iban: nextIban,
//                 deliveryMethod: nextDeliveryMethod,
//                 userId: req.user.id,
//             }
//         });

//         if (duplicate && String(duplicate.id) !== String(ben.id)) {
//             return next(new APIError(MESSAGES.BENIFICARY_EXISTS, status.BAD_REQUEST));
//         }
//     }

//     // Apply partial updates only for provided fields
//     const fields = {
//         deliveryMethod,
//         iban,
//         fName,
//         bankName,
//         contactNo,
//         city,
//         address1,
//         pickupLocation,
//     };

//     let changed = false;
//     for (const [key, value] of Object.entries(fields)) {
//         if (value !== undefined && ben[key] !== value) {
//             ben[key] = value;
//             changed = true;
//         }
//     }

//     if (changed) {
//         await ben.save();
//     }

//     return APIresponse(res, MESSAGES.SUCCESS, ben);
// });

// module.exports = {
//     createB,
//     getBenificaries,
//     delBenificary,
//     updateBenificaryContact,
//     updateBenificaryDetails
// }

