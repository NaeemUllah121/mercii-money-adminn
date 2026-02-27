// Modified USI service integration file
// Changes:
// - In createRemitter: After searching, if existing, call updateRemitter with latest payload to ensure details are up-to-date.
// - No verifyRemitter as it's not in the provided API spec (version 3.1). Assuming it's not required or a typo in the message.
// - Moved USI beneficiary sync to beneficiary creation (createB) to follow sequence: searchBeneficiary -> createBeneficiary (if not found) -> optional updateBeneficiary.
// - In createB: Search first using remitter_id, name, mobile, and account details (if applicable).
// - If found, set USIbeneficiaryId.
// - If not, createBeneficiary with appropriate data based on deliveryMethod.
// - For 'Account': Include bank/account fields.
// - For 'Cash Collection': Exclude bank/account fields, as per doc (details go in transaction).
// - Optional: Call updateBeneficiary after create if needed (skipped if details are same).
// - In VolumeWebHook: Assume USIbeneficiaryId already set from createB. If not (legacy), fallback to old logic.
// - Adjusted trans_type mapping: 'Account' -> 'Account Transfer', 'Cash Collection' -> 'Cash Collection'.
// - For wallets (Easypaisa/JazzCash): Set trans_type to 'Mobile Transfer' (assuming based on doc mentions Mobile Transfer).
// - In createTransaction data: For 'Cash Collection', add collection_point = pickupLocation (assuming param name; adjust if different).
// - Ensured remitter exists before beneficiary creation.

const status = require('http-status');
const { MESSAGES, MODELS } = require('../utils/constants');
const catchAsync = require('../utils/catchAsync');
const { APIresponse } = require('../utils/APIresponse');
const APIError = require('../utils/APIError');
const { create, findOne, update, findByPk } = require('../utils/database');
const db = require('../models');
const { makeUSIRequest } = require('../services/usi');
const { extractPostalCode } = require('../utils/utilityFunctions');

// Local safe number parsing helper
function toNumberSafe(v) {
  if (v === null || v === undefined) return null;
  const n = Number(String(v).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

// Helper: split a full name into { first, middle, last }
// Rule: last token is surname (last), first token is firstname (first), any tokens in between are middlename (middle)
function splitName(fullName) {
  if (!fullName || typeof fullName !== 'string') return { first: '', middle: '', last: '' };
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: '', middle: '', last: '' };
  if (parts.length === 1) return { first: parts[0], middle: '', last: parts[0] };
  if (parts.length === 2) return { first: parts[0], middle: '', last: parts[1] };
  const first = parts[0];
  const last = parts[parts.length - 1];
  const middle = parts.slice(1, -1).join(' ');
  return { first, middle, last };
}

// Helper: derive city/state from a free-form address and optional postcode
// - For UK-style addresses like "26 WASHINGTON STREET, BRADFORD, BD8 9QW",
//   we pick the segment immediately before the segment containing the postcode as city.
// - State will be taken from KYC fields when available; otherwise left undefined unless
//   geolocation country matches the document country, in which case region_name is acceptable.
function extractCityFromAddress(address, postcode) {
  try {
    if (!address || typeof address !== 'string') return undefined;
    const parts = address.split(',').map(s => s.trim()).filter(Boolean);
    if (!parts.length) return undefined;
    const post = postcode || extractPostalCode(address);
    if (post) {
      const idx = parts.findIndex(p => p.toUpperCase().includes(String(post).toUpperCase()));
      if (idx > 0) return parts[idx - 1];
    }
    // Fallback: last segment without any digits
    for (let i = parts.length - 1; i >= 0; i--) {
      if (!/\d/.test(parts[i])) return parts[i];
    }
    return undefined;
  } catch (_) {
    return undefined;
  }
}

// Try to pick the main exchange rate from various likely shapes
function pickRateFromUSI(result) {
  const candidates = [
    result?.rate,
    result?.rates?.rate,
    result?.result?.rate,
    result?.result?.rates?.rate,
    result?.exchange_rate,
    result?.result?.exchange_rate,
  ];
  for (const c of candidates) {
    const n = toNumberSafe(c);
    if (n !== null) return n;
  }
  const scan = JSON.stringify(result || {});
  const match = scan.match(/\b(\d+\.\d{2,})\b/);
  if (match) return parseFloat(match[1]);
  return null;
}

const getRates = catchAsync(async (req, res, next) => {
  const { dest_country, source_currency, dest_currency, delivery_bank_name } = req.body;

  // Validate required parameter
  if (!dest_country) {
    return next(new APIError(status.BAD_REQUEST, MESSAGES.USI.DEST_COUNTRY_REQUIRED))
  }

  // Prepare request data
  const data = {
    dest_country
  };

  // Add optional parameters
  if (source_currency) data.source_currency = source_currency;
  if (dest_currency) data.dest_currency = dest_currency;
  if (delivery_bank_name) data['Delivery Bank Name'] = delivery_bank_name;

  const { success, result } = await makeUSIRequest("rates", "getRates", data);
  if (!success) {
    return next(new APIError(status.BAD_REQUEST, result));
  }

  // Apply optional ENV-based adjustments for USI
  try {
    const baseRate = pickRateFromUSI(result);
    const rateAdj = toNumberSafe(process.env.RATE_ADJUST_USI) || 0;
    const feeAdj = toNumberSafe(process.env.FEE_ADJUST_USI) || 0;
    const overwriteOriginal = String(process.env.USI_OVERWRITE_ORIGINAL_RATES || '').toLowerCase() === 'true';

    // Attach adjusted rate if base rate is detectable
    if (baseRate !== null) {
      const adjustedRate = Math.max(0, +(baseRate + rateAdj).toFixed(6));
      result.rate_adjusted = adjustedRate;
    }

    // If USI returned a rate object with channels, mirror an adjusted object without mutating originals
    const rateNode = result?.result?.rate;
    if (rateNode && typeof rateNode === 'object' && !Array.isArray(rateNode)) {
      const adjustedMap = {};
      for (const [k, v] of Object.entries(rateNode)) {
        const n = toNumberSafe(v);
        if (n !== null) {
          adjustedMap[k] = Math.max(0, +(n + rateAdj).toFixed(6));
        }
      }
      if (Object.keys(adjustedMap).length) {
        if (!result.result) result.result = {};
        result.result.rate_adjusted = adjustedMap;
        if (overwriteOriginal) {
          // Mutate original per-channel rates to adjusted values
          Object.entries(adjustedMap).forEach(([k, val]) => {
            result.result.rate[k] = val;
          });
        }
      }
    }

    // Try to detect a fee field in common locations and expose an adjusted mirror field
    const candidateFees = [
      ['fee', result?.fee],
      ['fees', result?.fees],
      ['charge', result?.charge],
      ['charges', result?.charges],
      ['total_fee', result?.total_fee],
      ['result.fee', result?.result?.fee],
      ['result.total_fee', result?.result?.total_fee],
    ];
    for (const [key, val] of candidateFees) {
      const f = toNumberSafe(val);
      if (f !== null) {
        const adjustedFee = Math.max(0, +(f + feeAdj).toFixed(2));
        // Mirror as a top-level field to avoid mutating unknown nested structures
        result.fee_adjusted = adjustedFee;
        if (overwriteOriginal) {
          // Overwrite the detected fee location
          switch (key) {
            case 'fee': result.fee = adjustedFee; break;
            case 'fees': result.fees = adjustedFee; break;
            case 'charge': result.charge = adjustedFee; break;
            case 'charges': result.charges = adjustedFee; break;
            case 'total_fee': result.total_fee = adjustedFee; break;
            case 'result.fee': if (result.result) result.result.fee = adjustedFee; break;
            case 'result.total_fee': if (result.result) result.result.total_fee = adjustedFee; break;
            default: break;
          }
        }
        break;
      }
    }
  } catch (e) {
    // Non-fatal; if parsing fails we still return original result
    console.warn('USI getRates adjustment parse warning:', e?.message || e);
  }

  return APIresponse(res, MESSAGES.USI.RATES_FETCHED_SUCCESSFULLY, result)
});

const getDestinationCountries = catchAsync(async (req, res, next) => {

  const { success, result } = await makeUSIRequest("country", "getDestinationCountries", {});
  if (!success) {
    return next(new APIError(status.BAD_REQUEST, result));
  }

  return APIresponse(res, MESSAGES.USI.DESTINATION_COUNTRIES_FETCHED_SUCCESSFULLY, result.countries.country);

});

const getAgentDetails = catchAsync(async (req, res, next) => {

  const { success, result } = await makeUSIRequest("agent", "getAgentDetails", {});
  if (!success) {
    return next(new APIError(status.BAD_REQUEST, result));
  }

  return APIresponse(res, MESSAGES.USI.AGENT_DETAILS_FETCHED_SUCCESSFULLY, result);
});

const getCurrentCredit = catchAsync(async (req, res, next) => {

  const { success, result } = await makeUSIRequest("agent", "getCurrentCredit", {});

  if (!success) {
    return next(new APIError(status.BAD_REQUEST, result));
  }

  return APIresponse(res, MESSAGES.USI.CURRENT_CREDIT_FETCHED_SUCCESSFULLY, result);
});

const createRemitter = catchAsync(async (req, res, next) => {
  const findUser = await findOne(MODELS.USER, {
    where: { id: req.user.id }, include: [
      {
        model: db[MODELS.KYC_REQUEST],
        as: "kyc"
      }
    ]
  });
  if (findUser.remitoneCustomerId) {
    return APIresponse(res, MESSAGES.USI.REMITTER_CREATED_SUCCESSFULLY);
  }

  // Safely derive basic identity fields
  let first_name, middle_name, last_name;
  
  console.log('=== KYC Data Debug ===');
  console.log('verification_data full_name:', findUser?.kyc?.callbackPayload?.verification_data?.document?.name?.full_name);
  console.log('User fullName:', findUser?.fullName);
  console.log('User firstName:', findUser?.firstName);
  console.log('User lastName:', findUser?.lastName);
  console.log('=====================');
  
  if (findUser?.kyc?.callbackPayload?.verification_data?.document?.name?.full_name) {
    const parsed = splitName(findUser.kyc.callbackPayload.verification_data.document.name.full_name);
    first_name = parsed.first;
    middle_name = parsed.middle;
    last_name = parsed.last;
  }
  
  console.log('Extracted first_name:', first_name);
  console.log('Extracted last_name:', last_name);

  // Pull out ID document fields used for search and creation
  const id_type_val = findUser?.kyc?.callbackPayload?.additional_proof?.document_type
    || findUser?.kyc?.callbackPayload?.additional_data?.document?.proof?.document_type
    || findUser?.kyc?.callbackPayload?.verification_data?.document?.supported_types?.[0];
  const id_details_val = findUser?.kyc?.callbackPayload?.additional_proof?.document_number
    || findUser?.kyc?.callbackPayload?.additional_data?.document?.proof?.document_number;
  const dob_val = findUser?.kyc?.callbackPayload?.additional_data?.document?.proof?.dob;

  // Helper to safely save remitter ID ensuring uniqueness
  const saveRemitterIdSafely = async (userInstance, newId) => {
    if (!newId) return false;
    const existingUserWithId = await findOne(MODELS.USER, { where: { remitoneCustomerId: newId } });
    if (existingUserWithId && existingUserWithId.id !== userInstance.id) {
      // ID already belongs to a different user; do not overwrite
      throw new APIError(`Remitter ID ${newId} is already associated with another account`, status.CONFLICT);
    }
    userInstance.remitoneCustomerId = newId;
    await userInstance.save();
    return true;
  };

  // Build payload for search/update/create
  // Normalize proof and geo blocks from callback payload
  const proof = findUser.kyc.callbackPayload?.additional_data?.document?.proof || {};
  const geo = findUser.kyc.callbackPayload?.info?.geolocation
    || findUser.kyc.callbackPayload?.geolocation
    || {};

  // Derive names with robust fallbacks
  // Priority 1: Use first_name/middle_name/last_name from proof if available
  let derivedFirst = "";
  let derivedMiddle = "";
  let derivedLast = "";
  
  if (proof?.first_name && proof?.last_name) {
    derivedFirst = String(proof.first_name).trim();
    derivedLast = String(proof.last_name).trim();
    if (proof?.middle_name) derivedMiddle = String(proof.middle_name).trim();
  } else if (first_name && last_name) {
    // Use extracted from full_name earlier
    derivedFirst = first_name;
    derivedMiddle = middle_name || "";
    derivedLast = last_name;
  } else {
    // Try to get full_name and split it
    const fullName = findUser.kyc.callbackPayload?.verification_data?.document?.name?.full_name
      || proof?.full_name
      || findUser?.fullName
      || "";
    if (fullName) {
      const { first, middle, last } = splitName(fullName);
      derivedFirst = first;
      derivedMiddle = middle;
      derivedLast = last;
    } else {
      // Fallback to user's firstName/lastName
      derivedFirst = findUser?.firstName || "";
      derivedLast = findUser?.lastName || "";
    }
  }

  // Gender mapping if present
  const genderMap = (g) => {
    if (!g) return undefined;
    const v = String(g).trim().toUpperCase();
    if (v === "M" || v === "MALE") return "male";
    if (v === "F" || v === "FEMALE") return "female";
    return undefined;
  };

  // Derive city/state against the SOURCE country (the customer's document country)
  const documentCountryCode = proof?.country_code || proof?.document_country_code;
  const postcodeFromDoc = extractPostalCode(proof?.address);
  const derivedCity = extractCityFromAddress(proof?.address, postcodeFromDoc);
  const kycCity = findUser?.kyc?.city;
  // const kycState = findUser.kyc.callbackPayload?.additional_data?.document?.proof.country;
 const country = findUser.kyc.callbackPayload?.additional_data?.document?.proof.country;

const kycState = country
  ? country
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ')
  : 'United Kingdom';

console.log(kycState); // Output: "United Kingdom"

  // Only consider geolocation as a fallback if it refers to the same country as the document
  const geoMatchesDocument = geo?.country_code && documentCountryCode && String(geo.country_code).toUpperCase() === String(documentCountryCode).toUpperCase();
  const geoCity = geoMatchesDocument ? geo?.city : undefined;
  const geoState = geoMatchesDocument ? (geo?.region_name || geo?.region_code) : undefined;
console.log('First Name: ',derivedFirst);
console.log('Middle Name: ',derivedMiddle);
console.log('Last Name: ',derivedLast);

  // Ensure names meet USI's minimum 2-character requirement
  const ensureMinLength = (name, minLength = 2) => {
    const trimmed = String(name || "").trim();
    if (trimmed.length >= minLength) return trimmed;
    // If too short, pad with 'X' or use a default
    if (trimmed.length === 0) return "NA"; // Default for empty
    if (trimmed.length === 1) return trimmed + "X"; // Pad single character
    return trimmed;
  };

  const finalFirstName = ensureMinLength(derivedFirst);
  const finalMiddleName = derivedMiddle ? ensureMinLength(derivedMiddle) : '';
  const finalLastName = ensureMinLength(derivedLast);

  console.log('Final First Name (validated): ', finalFirstName);
  if (finalMiddleName) console.log('Final Middle Name (validated): ', finalMiddleName);
  console.log('Final Last Name (validated): ', finalLastName);

  let payload = {
    // firstname: finalFirstName,
    // ...(finalMiddleName ? { middlename: finalMiddleName } : {}),
    firstname: finalMiddleName ? `${finalFirstName} ${finalMiddleName}` : finalFirstName,
    lastname: finalLastName,
    type: "registered",
    status: "valid",
    gender: genderMap(proof?.gender),
    address1:
      findUser?.kyc?.address
      || proof?.address
      || "Address Line 1 must be provided",
    nationality: proof?.country_code || proof?.document_country_code,
    dob: dob_val || proof?.dob,
    mobile: findUser?.phoneNumber,
    postcode:
      findUser?.kyc?.postcode
      || extractPostalCode(proof?.address)
      || geo?.postal_code
      || "44000", // final hard fallback if required
    email: findUser?.email,
    // City and State (derived against source/document country)
    city: kycCity || derivedCity || geoCity,
    state:  kycState || 'United Kingdom',

    // ID Document fields
    id_type: id_type_val,
    id_details: id_details_val,
    id_issued_by: proof?.authority || proof?.place_of_issue || proof?.document_country,
    id_issue_country: proof?.document_country_code || proof?.document_country,
    id_start: proof?.issue_date,
    id_expiry: proof?.expiry_date
  }

  // 1) Search for existing remitter (by ID document or by name + DOB or email)
  try {
    let searchData = {};
    if (id_type_val && id_details_val) {
      // USI search expects id1_type/id1_details
      searchData.id1_type = id_type_val;
      searchData.id1_details = id_details_val;
    }
    // Always include names if available (use the validated final names)
    if (finalFirstName && finalLastName) {
      searchData.firstname = finalFirstName;
      searchData.lastname = finalLastName;
      if (dob_val) searchData.dob = dob_val;
    }
    // Always include email if available to satisfy "at least one of remitter_id/full name/email"
    if (findUser?.email) {
      searchData.email = findUser.email;
    }

    if (Object.keys(searchData).length > 0) {
      const searchResp = await makeUSIRequest("remitter", "searchRemitter", searchData);
      if (searchResp.success) {
        const r = searchResp.result;
        // Try to extract an existing member/remitter id from likely shapes
        let existingId;
        // Common shapes: r.members.member (array|object), r.remitters.remitter, r.result?.members?.member
        const candidates = [
          r?.members?.member,
          r?.remitters?.remitter,
          r?.result?.members?.member,
        ].filter(Boolean);

        const pickId = (item) => item?.member_id || item?.remitter_id || item?.id || item?.membership_number;
        if (candidates.length) {
          const item = Array.isArray(candidates[0]) ? candidates[0][0] : candidates[0];
          existingId = pickId(item);
        }

        if (existingId) {
          // If existing, update with latest payload
          const updateData = { remitter_id: existingId, ...payload };
          const updateResp = await makeUSIRequest("remitter", "updateRemitter", updateData);
          if (!updateResp.success) {
            console.warn("USI updateRemitter failed:", updateResp.result);
            // Non-fatal, proceed
          }
          await saveRemitterIdSafely(findUser, existingId);
          return APIresponse(res, MESSAGES.USI.REMITTER_CREATED_SUCCESSFULLY);
        }
      }
    }
  } catch (e) {
    // Non-fatal; proceed to creation if search fails
    console.warn("USI remitter pre-search failed, proceeding to create:", e?.message || e);
  }

  // 2) Create if not found
  const { success, result, errorMessage } = await makeUSIRequest("remitter", "createRemitter", payload);
  if (!success) {
    // Attempt to parse existing membership number from provider error and save it
    const flattenErrors = () => {
      try {
        const errs = result?.result?.errors?.error;
        if (Array.isArray(errs)) return errs.join(", ");
        if (typeof errs === 'string') return errs;
        return null;
      } catch (_) { return null; }
    };
    const asString = [errorMessage, flattenErrors()].filter(Boolean).join(" | ") || (Array.isArray(result) ? result.join(" ") : String(result || ""));
    
    // Check if document is already registered
    if (asString.toLowerCase().includes('already registered') || asString.toLowerCase().includes('already exists')) {
      console.log('Document already registered, attempting to retrieve existing remitter...');
      try {
        // Try searching again with just the document details
        const retrySearchData = {
          id1_type: id_type_val,
          id1_details: id_details_val,
          firstname: finalFirstName,
          ...(finalMiddleName ? { middlename: finalMiddleName } : {}),
          lastname: finalLastName
        };
        const retrySearchResp = await makeUSIRequest("remitter", "searchRemitter", retrySearchData);
        if (retrySearchResp.success) {
          const r = retrySearchResp.result;
          const candidates = [
            r?.members?.member,
            r?.remitters?.remitter,
            r?.result?.members?.member,
          ].filter(Boolean);
          
          const pickId = (item) => item?.member_id || item?.remitter_id || item?.id || item?.membership_number;
          if (candidates.length) {
            const item = Array.isArray(candidates[0]) ? candidates[0][0] : candidates[0];
            const existingId = pickId(item);
            if (existingId) {
              console.log('Found existing remitter ID:', existingId);
              await saveRemitterIdSafely(findUser, existingId);
              return APIresponse(res, MESSAGES.USI.REMITTER_CREATED_SUCCESSFULLY);
            }
          }
        }
      } catch (retryErr) {
        console.warn('Retry search failed:', retryErr?.message || retryErr);
      }
    }
    
    const match = asString.match(/Membership number\s*(\d+)/i);
    if (match && match[1]) {
      // If parsed, update with payload
      const updateData = { remitter_id: match[1], ...payload };
      const updateResp = await makeUSIRequest("remitter", "updateRemitter", updateData);
      if (!updateResp.success) {
        console.warn("USI updateRemitter on parsed failed:", updateResp.result);
      }
      await saveRemitterIdSafely(findUser, match[1]);
      return APIresponse(res, MESSAGES.USI.REMITTER_CREATED_SUCCESSFULLY);
    }
    return next(new APIError(asString, status.BAD_REQUEST));
  }
  await saveRemitterIdSafely(findUser, result.new_remitter_id);
  return APIresponse(res, MESSAGES.USI.REMITTER_CREATED_SUCCESSFULLY);
});

const searchRemitter = catchAsync(async (req, res, next) => {
  const {
    remitter_id, firstname, middlename, lastname, dob, address_line1,
    city, postcode, telephone, mobile, email, id1_type, id1_details,
    remitter_type, show_scans, referral_code
  } = req.body;

  // Validate that either remitter_id or full name is provided
  if (!remitter_id && (!firstname || !lastname)) {
    return next(new APIError(status.BAD_REQUEST, MESSAGES.USI.REMITTER_ID_OR_NAME_REQUIRED));
  }

  let data = {};
  // Add search parameters
  const searchFields = {
    remitter_id, firstname, middlename, lastname, dob, address_line1,
    city, postcode, telephone, mobile, email, id1_type, id1_details,
    remitter_type, show_scans, referral_code
  };

  Object.keys(searchFields).forEach(key => {
    if (searchFields[key] !== undefined && searchFields[key] !== null) {
      data[key] = searchFields[key];
    }
  });

  const { success, result } = await makeUSIRequest("remitter", "searchRemitter", data);

  if (!success) {
    return next(new APIError(status.BAD_REQUEST, result));
  }

  return APIresponse(res, MESSAGES.USI.REMITTER_SEARCH_COMPLETED, result);
});

const updateRemitter = catchAsync(async (req, res, next) => {
  const { remitter_id } = req.body;

  if (!remitter_id) {
    return next(APIError(status.BAD_REQUEST, MESSAGES.USI.REMITTER_ID_REQUIRED));
  }

  const data = {
    remitter_id
  };

  // Add all update fields from request body (excluding auth fields)
  const updateFields = { ...req.body };
  delete updateFields.remitter_id; // Already added above

  Object.keys(updateFields).forEach(key => {
    if (updateFields[key] !== undefined && updateFields[key] !== null) {
      data[key] = updateFields[key];
    }
  });

  const { success, result } = await makeUSIRequest("remitter", "updateRemitter", data);

  if (!success) {
    return next(APIError(status.BAD_REQUEST, result));
  }

  return APIresponse(res, MESSAGES.USI.REMITTER_UPDATED_SUCCESSFULLY, result);
});

const getRemitterBeneficiaries = catchAsync(async (req, res, next) => {
  const { remitter_id } = req.body;
  if (!remitter_id) {
    return next(new APIError(status.BAD_REQUEST, MESSAGES.USI.REMITTER_ID_REQUIRED));
  }
  const data = {
    remitter_id
  };
  const { success, result } = await makeUSIRequest("beneficiary", "getRemitterBeneficiaries", data);
  console.log({ success, result })
  if (!success) {
    return next(new APIError(result, status.BAD_REQUEST));
  }
  return APIresponse(res, MESSAGES.USI.REMITTER_BENEFICIARIES_FETCHED_SUCCESSFULLY, result);
});

const createBeneficiary = catchAsync(async (req, res, next) => {
    const {
        name, fname, mname, lname, organisation_type, company_name, company_type,
        company_reg_no, address1, address2, address3, city, state, postcode,
        country, nationality, dob, fathers_name, mothers_name, national_id_number,
        gender, telephone, mobile, email, id_type, id_details, id_start, id_expiry,
        id_issued_by, id_issue_place, id_issue_country, id2_type, id2_details,
        id2_expiry, id2_issue_place, benef_employer_id_details, benef_taxpayer_reg,
        benef_occupation, card_type, card_number, account_number, bank, bank_branch,
        bank_branch_city, bank_branch_state, bank_branch_telephone, bank_branch_manager,
        benef_bank_swift_code, benef_bank_iban, benef_bank_account_name, benef_ac_type,
        homedelivery_notes, enabled, suspicious, suspicion_reason, linked_member_id
    } = req.body;

    const data = {
        name,
        address1,
        city,
        country,
        linked_member_id
    };

    // Add optional fields
    const optionalFields = {
        fname, mname, lname, organisation_type, company_name, company_type,
        company_reg_no, address2, address3, state, postcode, nationality, dob,
        fathers_name, mothers_name, national_id_number, gender, telephone, mobile,
        email, id_type, id_details, id_start, id_expiry, id_issued_by, id_issue_place,
        id_issue_country, id2_type, id2_details, id2_expiry, id2_issue_place,
        benef_employer_id_details, benef_taxpayer_reg, benef_occupation, card_type,
        card_number, account_number, bank, bank_branch, bank_branch_city,
        bank_branch_state, bank_branch_telephone, bank_branch_manager,
        benef_bank_swift_code, benef_bank_iban, benef_bank_account_name, benef_ac_type,
        homedelivery_notes, enabled, suspicious, suspicion_reason
    };

    Object.keys(optionalFields).forEach(key => {
        if (optionalFields[key] !== undefined && optionalFields[key] !== null) {
            data[key] = optionalFields[key];
        }
    });

    // Normalize IBAN into both 'account_number' and 'benef_bank_iban'
    const bodyIban = req.body?.iban;
    const bodyAcc = req.body?.account_number;
    const bodyIbanField = req.body?.benef_bank_iban;

    if (bodyIban) {
        if (!data.account_number) data.account_number = bodyIban;
        if (!data.benef_bank_iban) data.benef_bank_iban = bodyIban;
    }
    if (data.account_number && !data.benef_bank_iban) data.benef_bank_iban = data.account_number;
    if (!data.account_number && data.benef_bank_iban) data.account_number = data.benef_bank_iban;
    if (bodyAcc && !data.benef_bank_iban) data.benef_bank_iban = bodyAcc;
    if (bodyIbanField && !data.account_number) data.account_number = bodyIbanField;

    // Build search payload to find existing beneficiary first
    const searchData = {};
    if (linked_member_id) searchData.remitter_id = linked_member_id;
    if (country) searchData.country = country;
    if (name) searchData.name = name;
    if (mobile) searchData.mobile = mobile;
    if (data.account_number) searchData.account_number = data.account_number;
    if (bank) searchData.bank = bank;
    if (address1) searchData.address1 = address1;
    if (city) searchData.city = city;

    let existingBenId;
    try {
        if (searchData.remitter_id && searchData.country) {
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
        }
    } catch (e) {
        // Non-fatal; proceed to create if search fails
        console.warn("USI searchBeneficiary failed:", e?.message || e);
    }

    if (existingBenId) {
        // Update existing beneficiary with provided fields
        const updateData = { beneficiary_id: existingBenId };
        Object.keys(data).forEach(k => {
            if (data[k] !== undefined && data[k] !== null) updateData[k] = data[k];
        });
        // Ensure IBAN fields are present for account updates
        if (updateData.account_number && !updateData.benef_bank_iban) updateData.benef_bank_iban = updateData.account_number;
        if (updateData.benef_bank_iban && !updateData.account_number) updateData.account_number = updateData.benef_bank_iban;

        const { success, result } = await makeUSIRequest("beneficiary", "updateBeneficiary", updateData);
        if (!success) {
            return next(new APIError(result, status.BAD_REQUEST));
        }
        return APIresponse(res, MESSAGES.USI.BENEFICIARY_CREATED_SUCCESSFULLY, result);
    }

    // Create new beneficiary if not found
    const { success, result } = await makeUSIRequest("beneficiary", "createBeneficiary", data);
    if (!success) {
        return next(new APIError(result, status.BAD_REQUEST));
    }

    return APIresponse(res, MESSAGES.USI.BENEFICIARY_CREATED_SUCCESSFULLY, result);
});

const updateBeneficiary = catchAsync(async (req, res, next) => {
  const data = {
    ...req.body
  }
  const { success, result } = await makeUSIRequest("beneficiary", "updateBeneficiary", data);
  if (!success) {
    return next(new APIError(result, status.BAD_REQUEST));
  }

  return APIresponse(res, MESSAGES.USI.BENEFICIARY_CREATED_SUCCESSFULLY, result);
});

const searchBeneficiary = catchAsync(async (req, res, next) => {
  const { country } = req.body;

  if (!country) {
    return next(new APIError(status.BAD_REQUEST, MESSAGES.USI.COUNTRY_REQUIRED));
  }

  // Normalize country to full name if a two-letter code is provided (e.g., 'PK' -> 'Pakistan')
  const normalizeCountry = (c) => {
    try {
      const v = String(c || '').trim();
      const upper = v.toUpperCase();
      // Minimal map based on current usage; extend as needed
      if (upper === 'PK') return 'Pakistan';
      return v; // assume already a full name
    } catch (_) {
      return c;
    }
  };

  const data = {
    country: normalizeCountry(country)
  };

  // Add search parameters
  const searchFields = { ...req.body };
  delete searchFields.country; // Already added above

  Object.keys(searchFields).forEach(key => {
    if (searchFields[key] !== undefined && searchFields[key] !== null) {
      data[key] = searchFields[key];
    }
  });

  const { success, result } = await makeUSIRequest("beneficiary", "searchBeneficiary", data);
  if (!success) {
    return next(new APIError(result, status.BAD_REQUEST));
  }

  return APIresponse(res, MESSAGES.USI.BENEFICIARY_SEARCH_COMPLETED, result);
});

const createTransaction = catchAsync(async (req, res, next) => {
  const {
    remitter_id, beneficiary_id, destination_country, trans_type, purpose,
    source_of_income, payment_method, service_level, sms_confirmation,
    sms_notification, amount_type, amount_to_send, collection_point_id, collection_point,
    collection_point_address,collection_point_city,
  } = req.body;

  const data = {
    remitter_id,
    beneficiary_id,
    destination_country,
    trans_type,
    purpose,
    source_of_income,
    payment_method,
    service_level,
    sms_confirmation,
    sms_notification,
    amount_type,
    amount_to_send,
    
  };

  // Add collection point fields only for Cash Collection
  if (trans_type === 'Cash Collection') {
    if (collection_point_id !== undefined && collection_point_id !== null) {
      data.collection_point_id = collection_point_id;
    }
    if (collection_point !== undefined && collection_point !== null) {
      data.collection_point = collection_point;
    }
    if (collection_point_address !== undefined && collection_point_address !== null) {
      data.collection_point_address = collection_point_address;
    }
    if (collection_point_city !== undefined && collection_point_city !== null) {
      data.collection_point_city = collection_point_city;
    }
  }

  // Add optional fields
  const optionalFields = { ...req.body };
  // Remove required fields that are already added
  const requiredFields = [
    'remitter_id', 'beneficiary_id', 'destination_country', 'trans_type',
    'purpose', 'source_of_income', 'payment_method', 'service_level',
    'sms_confirmation', 'sms_notification', 'amount_type', 'amount_to_send',
    'collection_point_id', 'collection_point','collection_point_address','collection_point_city',
   
  ];

  requiredFields.forEach(field => delete optionalFields[field]);

  Object.keys(optionalFields).forEach(key => {
    if (optionalFields[key] !== undefined && optionalFields[key] !== null) {
      data[key] = optionalFields[key];
    }
  });

  const { success, result } = await makeUSIRequest("transaction", "createTransaction", data);
  if (!success) {
    return next(new APIError(result, status.BAD_REQUEST));
  }

  return APIresponse(res, MESSAGES.USI.TRANSACTION_CREATED_SUCCESSFULLY, result);
});

const confirmTransaction = catchAsync(async (req, res, next) => {
  const { trans_session_id } = req.body;

  if (!trans_session_id) {
    return next(new APIError(status.BAD_REQUEST, MESSAGES.USI.TRANSACTION_SESSION_ID_REQUIRED));
  }

  const data = {
    trans_session_id
  };

  const { success, result } = await makeUSIRequest("transaction", "confirmTransaction", data);
  if (!success) {
    return next(new APIError(result, status.BAD_REQUEST));
  }

  return APIresponse(res, MESSAGES.USI.TRANSACTION_CONFIRMED_SUCCESSFULLY, result);
});

const getTransactionStatus = catchAsync(async (req, res, next) => {
  const { trans_ref } = req.body;

  if (!trans_ref) {
    return next(new APIError(MESSAGES.USI.TRANSACTION_REF_REQUIRED, status.BAD_REQUEST));
  }

  const data = {
    trans_ref
  };

  const { success, result } = await makeUSIRequest("transaction", "getTransactionStatus", data);
  if (!success) {
    return next(new APIError(result, status.BAD_REQUEST));
  }

  return APIresponse(res, MESSAGES.USI.TRANSACTION_STATUS_FETCHED_SUCCESSFULLY, result);
});

// Query status by Agent's transaction reference
const getTransactionStatusByAgentTransRef = catchAsync(async (req, res, next) => {
  const { trans_ref } = req.body; // Agent's unique transaction reference

  if (!trans_ref) {
    return next(new APIError(MESSAGES.USI.TRANSACTION_REF_REQUIRED, status.BAD_REQUEST));
  }

  const data = { trans_ref };
  const { success, result } = await makeUSIRequest("transaction", "getTransactionStatusByAgentTransRef", data);
  if (!success) {
    return next(new APIError(result, status.BAD_REQUEST));
  }

  return APIresponse(res, MESSAGES.USI.TRANSACTION_STATUS_FETCHED_SUCCESSFULLY, result);
});

const getTransactionDetails = catchAsync(async (req, res, next) => {
  const { trans_ref } = req.body;

  if (!trans_ref) {
    return next(new APIError(status.BAD_REQUEST, MESSAGES.USI.TRANSACTION_REF_REQUIRED));
  }

  const data = {
    trans_ref
  };

  const { success, result } = await makeUSIRequest("transaction", "getTransactionDetails", data);
  if (!success) {
    return next(new APIError(result, status.BAD_REQUEST));
  }

  return APIresponse(res, MESSAGES.USI.TRANSACTION_DETAILS_FETCHED_SUCCESSFULLY, result);
});

const getRemitterTransactions = catchAsync(async (req, res, next) => {
  const { remitter_id } = req.body;

  const data = {};

  if (remitter_id) {
    data.remitter_id = remitter_id;
  }

  const { success, result } = await makeUSIRequest("transaction", "getRemitterTransactions", data);
  if (!success) {
    return next(new APIError(result, status.BAD_REQUEST));
  }

  return APIresponse(res, MESSAGES.USI.REMITTER_TRANSACTIONS_FETCHED_SUCCESSFULLY, result);
});

const getDeliveryBanks = catchAsync(async (req, res, next) => {
  const { dest_country, country_code, bank_code } = req.body;

  let data = {}

  // Add optional parameters
  if (dest_country) data.dest_country = dest_country;
  if (country_code) data.country_code = country_code;
  if (bank_code) data.bank_code = bank_code;

  const { success, result } = await makeUSIRequest("deliveryBank", "getDeliveryBanks", data);
  if (!success) {
    return next(new APIError(result, status.BAD_REQUEST));
  }

  return APIresponse(res, MESSAGES.USI.DELIVERY_BANKS_FETCHED_SUCCESSFULLY, result);
});

const getCollectionPoints = catchAsync(async (req, res, next) => {
  const { delivery_bank, destination_country, destination_country_code } = req.body;

  let data = {}

  // Add optional parameters
  if (delivery_bank) data.delivery_bank = delivery_bank;
  if (destination_country) data.destination_country = destination_country;
  if (destination_country_code) data.destination_country_code = destination_country_code;

  const { success, result } = await makeUSIRequest("collectionPoint", "getCollectionPoints", data);
  if (!success) {
    return next(new APIError(result, status.BAD_REQUEST));
  }
  return APIresponse(res, MESSAGES.USI.COLLECTION_POINTS_FETCHED_SUCCESSFULLY, result);
});

const getCharges = catchAsync(async (req, res, next) => {
  const {
    destination_country, trans_type, payment_method, service_level,
    sms_confirmation, sms_notification, amount_type, amount_to_send,
    source_currency, destination_currency
  } = req.body;

  // Validate required fields
  if (!destination_country || !trans_type || !payment_method || !service_level ||
    sms_confirmation === undefined || sms_notification === undefined ||
    !amount_type || !amount_to_send) {
    return next(new APIError(status.BAD_REQUEST, MESSAGES.USI.CHARGES_REQUIRED_FIELDS_MISSING));
  }

  const data = {
    destination_country,
    trans_type,
    payment_method,
    service_level,
    sms_confirmation,
    sms_notification,
    amount_type,
    amount_to_send
  };

  // Add optional currencies
  if (source_currency) data['Source Currency'] = source_currency;
  if (destination_currency) data['Destination currency'] = destination_currency;

  const { success, result } = await makeUSIRequest("transaction", "getCharges", data);
  if (!success) {
    return next(new APIError(result, status.BAD_REQUEST));
  }

  return APIresponse(res, MESSAGES.USI.CHARGES_FETCHED_SUCCESSFULLY, result);
});

module.exports = {
  getRates,
  getDestinationCountries,
  getAgentDetails,
  getCurrentCredit,
  createRemitter,
  getRemitterBeneficiaries,
  searchRemitter,
  updateRemitter,
  createBeneficiary,
  updateBeneficiary,
  searchBeneficiary,
  createTransaction,
  confirmTransaction,
  getTransactionStatus,
  getTransactionDetails,
  getRemitterTransactions,
  getDeliveryBanks,
  getCollectionPoints,
  getCharges,
  getTransactionStatusByAgentTransRef
};
