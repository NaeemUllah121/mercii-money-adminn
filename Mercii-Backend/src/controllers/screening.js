const APIError = require('../utils/APIError');
const { create, findByPk, findOne } = require('../utils/database');

const catchAsync = require('../utils/catchAsync');
const { MODELS, MESSAGES } = require('../utils/constants');
const { apiService } = require('../utils/axios');
const { APIresponse } = require('../utils/APIresponse');
const axios = require('axios');
const { assessRisk } = require('../utils/riskAssesment');
const db = require('../models');
const checkIndividual = catchAsync(async (req, res, next) => {
    console.log(req.body);
    const { isRemmiter } = req.body; 
    const {
        search_all,
        dob,
        gender,
        fuzzy_search,
        // isRemmiter,
    } = req.body;

    let { names, address } = req.query; // non-remitter flow only

    // If isRemmiter is true, we must have an authenticated user
    if (isRemmiter) {
        if (!req.user || !req.user.id) {
            return next(new APIError("User must be authenticated to fetch KYC details", 401));
        }

        const findUser = await findOne(MODELS.USER, {
            where: { id: req.user.id },
            include: [
                {
                    model: db[MODELS.KYC_REQUEST],
                    as: "kyc"
                }
            ]
        });
        // If 'kyc' might be an array (hasMany), normalize it:
        // const kyc = Array.isArray(findUser?.kyc) ? findUser.kyc[0] : findUser?.kyc;

        // const names =
        // kyc?.callbackPayload?.verification_data?.document?.name?.full_name ??
        // kyc?.callbackPayload?.additional_data?.document?.proof?.full_name ??
        // findUser?.user?.fullName ??
        // '';
        names =
            findUser?.kyc?.callbackPayload?.verification_data?.document?.name?.full_name ||
            findUser?.kyc?.callbackPayload?.additional_data?.document?.proof?.full_name ||
            findUser?.user?.fullName || "test test";
        console.log("names",names);
        address =
            findUser?.kyc?.callbackPayload?.additional_data?.document?.proof?.address ||
            findUser?.kyc?.callbackPayload?.verification_data?.document?.proof?.address ||
            findUser.kyc?.address ||
            "Address Line 1 must be provided";

        if (!names) {
            return next(new APIError("Remitter name not found in KYC.", 400));
        }
        if (!address) {
            return next(new APIError("Remitter address not found in KYC.", 400));
        }
    } else {
        console.log("isRemmiter false");

        // Non-remitter validations
        if (!names && !search_all) {
            return next(new APIError('Either "names" or "search_all" parameter is required', 400));
        }

        if (names && search_all) {
            return next(new APIError('Cannot use both "names" and "search_all" parameters together', 400));
        }

        if (!address) {
            return next(new APIError('"address" parameter is required', 400));
        }
    }

    // Build query params
    const queryParams = new URLSearchParams();
    if (names) queryParams.append("names", names);
    if (search_all && !isRemmiter) queryParams.append("search_all", search_all);
    if (dob) queryParams.append("dob", dob);
    if (gender) queryParams.append("gender", gender);
    if (fuzzy_search) queryParams.append("fuzzy_search", fuzzy_search);
    queryParams.append("includes", "dilisense_pep");

    const resp = await axios.get(
        `${process.env.DILISENSE_URL}/checkIndividual?${queryParams.toString()}`,
        {
            headers: {
                "x-api-key": process.env.DILISENSE_API_KEY,
            },
        }
    );

    // Match logic
    let message = "No record found against user";
    let matchedRecord = null;
    const apiData = resp?.data;
    const resultData = apiData?.data;
    const totalHits = Number(resultData?.total_hits || 0);

    if (apiData?.success && totalHits > 0 && Array.isArray(resultData?.found_records)) {
        const qName = (names || search_all || "").toLowerCase().trim();
        const qAddress = String(address || "").toLowerCase().trim();

        for (const rec of resultData.found_records) {
            const recName = String(rec?.name || "").toLowerCase().trim();
            const recAddresses = Array.isArray(rec?.address)
                ? rec.address
                : rec?.address
                ? [rec.address]
                : [];
            const hasAddressMatch = recAddresses.some((a) => {
                const ra = String(a).toLowerCase().trim();
                return ra === qAddress || ra.includes(qAddress) || qAddress.includes(ra);
            });

            if (recName === qName && hasAddressMatch) {
                matchedRecord = rec;
                break;
            }
        }

        if (matchedRecord) {
            message = "Record found against user";
        }
    }

    // Persist screening result
    try {
        const userId = isRemmiter && req.user?.id ? req.user.id : null;
        await create(MODELS.SCREENING_RESULT, {
            userId,
            isRemmiter: Boolean(isRemmiter),
            names: names || search_all || null,
            address: address || null,
            dob: dob || null,
            gender: gender || null,
            fuzzy_search: fuzzy_search || null,
            totalHits: totalHits || 0,
            message,
            matched: Boolean(matchedRecord),
            matchedRecord: matchedRecord || null,
            rawResponse: resp?.data || null,
        });
    } catch (e) {
        console.error('Failed to persist screening result:', e?.message || e);
        // Non-blocking: continue to return response
    }

    APIresponse(res, message, { matched_record: matchedRecord });
});

// const checkIndividual = catchAsync(async (req, res, next) => {
//     console.log(req.body);

//     const {
//         search_all,
//         dob,
//         gender,
//         fuzzy_search,
//         isRemmiter, // now in body
//     } = req.body;

//     let { names, address } = req.query; // for non-remitter flow only

//     // If isRemmiter is true, fetch names and address from KYC
//     if (isRemmiter) {
//         if (!req.user || !req.user.id) {
//             return next(new APIError("User must be authenticated to fetch KYC details", 401));
//         }
//         const findUser = await findOne(MODELS.USER, {
//             where: { id: req.user.id },
//             include: [
//                 {
//                     model: db[MODELS.KYC_REQUEST],
//                     as: "kyc"
//                 }
//             ]
//         });

//         names =
//             findUser?.kyc?.callbackPayload?.verification_data?.document?.name?.full_name ||
//             findUser?.kyc?.callbackPayload?.additional_data?.document?.proof?.full_name ||
//             "";

//         address =
//             findUser?.kyc?.callbackPayload?.additional_data?.document?.proof?.address ||
//             findUser?.kyc?.callbackPayload?.verification_data?.document?.proof?.address ||
//             "Address Line 1 must be provided";

//         if (!names) {
//             return next(new APIError("Remitter name not found in KYC", 400));
//         }
//         if (!address) {
//             return next(new APIError("Remitter address not found in KYC", 400));
//         }
//     } else {
//         console.log("isRemmiter false");

//         // Validate required parameters only for non-remitter flow
//         if (!names && !search_all) {
//             return next(new APIError('Either "names" or "search_all" parameter is required', 400));
//         }

//         if (names && search_all) {
//             return next(new APIError('Cannot use both "names" and "search_all" parameters together', 400));
//         }

//         if (!address) {
//             return next(new APIError('"address" parameter is required', 400));
//         }
//     }

//     // Build query parameters for the API call
//     const queryParams = new URLSearchParams();
//     if (names) queryParams.append("names", names);
//     if (search_all && !isRemmiter) queryParams.append("search_all", search_all); // allow search_all only in non-remitter case
//     if (dob) queryParams.append("dob", dob);
//     if (gender) queryParams.append("gender", gender);
//     if (fuzzy_search) queryParams.append("fuzzy_search", fuzzy_search);
//     queryParams.append("includes", "dilisense_pep");

//     const resp = await axios.get(
//         `${process.env.DILISENSE_URL}/checkIndividual?${queryParams.toString()}`,
//         {
//             headers: {
//                 "x-api-key": process.env.DILISENSE_API_KEY,
//             },
//         }
//     );

//     // Post-response matching
//     let message = "No record found against user";
//     let matchedRecord = null;
//     const apiData = resp?.data;
//     const resultData = apiData?.data;
//     const totalHits = Number(resultData?.total_hits || 0);

//     if (apiData?.success && totalHits > 0 && Array.isArray(resultData?.found_records)) {
//         const qName = (names || search_all || "").toLowerCase().trim();
//         const qAddress = String(address || "").toLowerCase().trim();

//         for (const rec of resultData.found_records) {
//             const recName = String(rec?.name || "").toLowerCase().trim();
//             const recAddresses = Array.isArray(rec?.address)
//                 ? rec.address
//                 : rec?.address
//                 ? [rec.address]
//                 : [];
//             const hasAddressMatch = recAddresses.some((a) => {
//                 const ra = String(a).toLowerCase().trim();
//                 return ra === qAddress || ra.includes(qAddress) || qAddress.includes(ra);
//             });

//             if (recName === qName && hasAddressMatch) {
//                 matchedRecord = rec;
//                 break;
//             }
//         }

//         if (matchedRecord) {
//             message = "Record found against user";
//         }
//     }

//     APIresponse(res, message, { matched_record: matchedRecord });
// });


// const checkIndividual = catchAsync(async (req, res, next) => {
//     console.log(req.body)
//     const {
//         names,
//         search_all,
//         dob,
//         gender,
//         fuzzy_search,
//         address,
//     } = req.query;
// if (!req.body.isRemmiter) {
//     console.log("isRemmiter false")
// }
//     // Validate required parameters
//     if (!names && !search_all) {
//         return next(new APIError('Either "names" or "search_all" parameter is required', 400));
//     }

//     if (names && search_all) {
//         return next(new APIError('Cannot use both "names" and "search_all" parameters together', 400));
//     }

//     // Address is required for additional matching
//     if (!address) {
//         return next(new APIError('"address" parameter is required', 400));
//     }

//     // const user = await findByPk(MODELS.USER, req.user.id);

//     // Build query parameters for the API call
//     const queryParams = new URLSearchParams();
//     if (names) queryParams.append('names', names);
//     if (search_all) queryParams.append('search_all', search_all);
//     if (dob) queryParams.append('dob', dob);
//     if (gender) queryParams.append('gender', gender);
//     if (fuzzy_search) queryParams.append('fuzzy_search', fuzzy_search);
//     queryParams.append('includes', "dilisense_pep");

//     const resp = await axios.get(
//         `${process.env.DILISENSE_URL}/checkIndividual?${queryParams.toString()}`,
//         {
//             headers: {
//                 'x-api-key': process.env.DILISENSE_API_KEY,
//             },
//         }
//     );
    
//     // Post-response matching: if hits exist, ensure name and address both match
//     let message = 'No record found against user';
//     let matchedRecord = null;
//     const apiData = resp?.data;
//     const resultData = apiData?.data;
//     const totalHits = Number(resultData?.total_hits || 0);
//     if (apiData?.success && totalHits > 0 && Array.isArray(resultData?.found_records)) {
//         const qName = (names || search_all || '').toLowerCase().trim();
//         const qAddress = String(address || '').toLowerCase().trim();
//         for (const rec of resultData.found_records) {
//             const recName = String(rec?.name || '').toLowerCase().trim();
//             const recAddresses = Array.isArray(rec?.address)
//                 ? rec.address
//                 : (rec?.address ? [rec.address] : []);
//             const hasAddressMatch = recAddresses.some((a) => {
//                 const ra = String(a).toLowerCase().trim();
//                 return ra === qAddress || ra.includes(qAddress) || qAddress.includes(ra);
//             });
//             if (recName === qName && hasAddressMatch) {
//                 matchedRecord = rec;
//                 break;
//             }
//         }
//         if (matchedRecord) {
//             message = 'Record found against user';
//         }
//     }
//     // // Store the check request in database
//     // await create(MODELS.INDIVIDUAL_CHECK_REQUEST, {
//     //     userId: user.id,
//     //     referenceId: ref,
//     //     names,
//     //     search_all,
//     //     dob,
//     //     gender,
//     //     fuzzy_search,
//     //     includes,
//     //     status: 'pending'
//     // });

//     APIresponse(res, message, { matched_record: matchedRecord });
// });

// 8. ADVERSE MEDIA SCREENING
const checkIndividualAdverseMedia = catchAsync(async (req, res, next) => {
    const options = {
        method: 'GET',
        url: 'https://api.dilisense.com/v1/media/checkIndividual',
        params: { search_all: 'Boris Johnson' },
        headers: {
            'x-api-key': process.env.DILISENSE_API_KEY,
        },
    };
    const response = await axios.request(options)
    // const response = await apiService(options);
    const risk = assessRisk(response.data)
    return APIresponse(res, 'Individual check initiated successfully', { response: response.data, riskAssessment: risk });
})

module.exports = {
    checkIndividual,
    checkIndividualAdverseMedia
}