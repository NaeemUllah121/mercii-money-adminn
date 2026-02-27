const { apiService } = require('../utils/axios'); // Adjust path as needed
const xml2js = require('xml2js');
const qs = require('querystring');

// XML parser configuration
const xmlParser = new xml2js.Parser({
    explicitArray: false,
    ignoreAttrs: true,
    trim: true,
    normalize: true,
    normalizeTags: true,
    explicitRoot: false
});

/**
 * Convert XML response to JSON
 * @param {string} xmlString - XML response string
 * @returns {Promise<Object>} Parsed JSON object
 */
const parseXmlResponse = async (xmlString) => {
    try {
        return await xmlParser.parseStringPromise(xmlString);
    } catch (error) {
        throw new Error(`XML parsing failed: ${error.message}`);
    }
};

/**
 * Make request to USI Money API
 * @param {string} baseUrl - Base URL for USI API
 * @param {string} group - API group (e.g., 'rates')
 * @param {string} method - API method (e.g., 'getRates')
 * @param {Object} params - Additional parameters
 * @returns {Promise<Object>} API response
 */
exports.makeUSIRequest = async (group, method, params = {}) => {
    try {
        const url = `${process.env.USI_BASE_URL}/${group}/${method}`;

        // Prepare request data with authentication
        const requestData = {
            username: process.env.USI_USERNAME,
            password: process.env.USI_PASSWORD,
            pin: process.env.USI_PIN,
            ...params
        };

        console.log('\n=== USI API Request ===');
        console.log('Group:', group);
        console.log('Method:', method);
        console.log('URL:', url);
        console.log('Full Payload:', JSON.stringify(requestData, null, 2));
        console.log('=====================\n');

        console.log('\n=== USI API Request ===');
        console.log('Group:', group);
        console.log('Method:', method);
        console.log('URL:', url);
        console.log('Full Payload:', JSON.stringify(requestData, null, 2));
        console.log('=====================\n');

        // Make API call using your apiService
        const xmlResponse = await apiService({
            method: 'POST',
            url: url,
            data: qs.stringify(requestData),
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        // Parse XML response
        const jsonData = await parseXmlResponse(xmlResponse);

        console.log('\n=== USI API Response ===');
        console.log('Group:', group);
        console.log('Method:', method);
        console.log('Response:', JSON.stringify(jsonData, null, 2));
        console.log('=====================\n');

        // Handle API response status
        if (jsonData.status === 'SUCCESS') {
            return {
                success: true,
                result: jsonData,
                // responseId: jsonData.responseid
            };
        } else {
            console.error('USI API Error:', jsonData);
            return {
                success: false,
                // Return the full payload so callers can access fields like error_data.existing_beneficiary_id
                result: jsonData,
                // Provide a convenient human-readable message as well
                errorMessage: jsonData.result?.errors?.error || jsonData.result?.message,
            };
        }
    } catch (error) {
        throw new Error(`USI API request failed: ${error}`);
    }
};
