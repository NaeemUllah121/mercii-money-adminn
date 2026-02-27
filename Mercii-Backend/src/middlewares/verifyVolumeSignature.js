const crypto = require('crypto');
const https = require('https');

let cachedPublicKey = null;
let cacheExpiry = 0;
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

const fetchVolumePublicKey = () => {
    return new Promise((resolve, reject) => {
        // Use live URL for production
        const url = process.env.VOLUME_PUBLIC_KEY_URL || 'https://api.volumepay.io/.well-known/signature/pem';
        
        // Check cache first
        if (cachedPublicKey && Date.now() < cacheExpiry) {
            return resolve(cachedPublicKey);
        }

        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                // Volume returns key without BEGIN/END markers, so we add them
                const publicKey = `-----BEGIN PUBLIC KEY-----\n${data.trim()}\n-----END PUBLIC KEY-----`;
                cachedPublicKey = publicKey;
                cacheExpiry = Date.now() + CACHE_DURATION;
                resolve(publicKey);
            });
        }).on('error', reject);
    });
};

exports.verifyVolumeSignature = async (req, res, next) => {
    try {
        // Volume sends signature in Authorization header: "SHA256withRSA {signature}"
        const authHeader = req.headers['authorization'];

        if (!authHeader) {
            console.error('Missing Authorization header for webhook signature');
            return res.status(401).json({ error: 'Unauthorized - Missing signature' });
        }

        // Parse Authorization header: "SHA256withRSA {base64_signature}"
        const parts = authHeader.split(' ');
        if (parts.length !== 2 || parts[0] !== 'SHA256withRSA') {
            console.error('Invalid Authorization header format');
            return res.status(401).json({ error: 'Unauthorized - Invalid signature format' });
        }

        const signature = parts[1];

        // Get raw body for signature verification - must be exact bytes sent by Volume
        const payload = req.rawBody || JSON.stringify(req.body);

        // Fetch Volume's public key
        const publicKey = await fetchVolumePublicKey();

        // Verify signature using RSA SHA256
        const verifier = crypto.createVerify('RSA-SHA256');
        verifier.update(payload, 'utf8');
        
        const isValid = verifier.verify(publicKey, signature, 'base64');

        if (!isValid) {
            console.error('Invalid webhook signature - verification failed');
            return res.status(401).json({ error: 'Unauthorized - Invalid signature' });
        }

        console.log('Webhook signature verified successfully');
        next();
    } catch (error) {
        console.error('Webhook signature verification error:', error);
        return res.status(401).json({ error: 'Signature verification failed' });
    }
};

// Middleware to parse JSON and capture raw body for signature verification
exports.captureRawBody = (req, res, next) => {
    let data = '';
    req.on('data', chunk => {
        data += chunk;
    });
    req.on('end', () => {
        req.rawBody = data;
        req.body = JSON.parse(data);
        next();
    });
};
