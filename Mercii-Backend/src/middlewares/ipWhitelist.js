const getClientIp = (req) => {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
        return forwarded.split(',')[0].trim();
    }
    return req.headers['x-real-ip'] || req.connection.remoteAddress || req.socket.remoteAddress;
};

const isIpInRange = (ip, range) => {
    if (range.includes('/')) {
        const [rangeIp, cidr] = range.split('/');
        const mask = ~(2 ** (32 - parseInt(cidr)) - 1);
        const ipNum = ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet), 0);
        const rangeNum = rangeIp.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet), 0);
        return (ipNum & mask) === (rangeNum & mask);
    }
    return ip === range;
};

exports.ipWhitelist = (req, res, next) => {
    try {
        const allowedIps = process.env.VOLUME_WEBHOOK_ALLOWED_IPS;
        const clientIp = getClientIp(req);
        
        // TEMPORARY: Log IP for capture mode
        const captureMode = process.env.VOLUME_IP_CAPTURE_MODE === 'true';
        
        if (captureMode) {
            console.log('\n' + '='.repeat(70));
            console.log('🔍 VOLUME IP CAPTURE MODE - WEBHOOK RECEIVED');
            console.log('='.repeat(70));
            console.log(`📍 Volume Server IP: ${clientIp}`);
            console.log(`📅 Timestamp: ${new Date().toISOString()}`);
            console.log('='.repeat(70));
            console.log('✅ Add this IP to production .env:');
            console.log(`   VOLUME_WEBHOOK_ALLOWED_IPS=${clientIp}`);
            console.log('='.repeat(70) + '\n');
            // Allow request through in capture mode
            return next();
        }
        
        if (!allowedIps) {
            console.error('VOLUME_WEBHOOK_ALLOWED_IPS not configured');
            return res.status(500).json({ error: 'IP whitelist not configured' });
        }

        const whitelist = allowedIps.split(',').map(ip => ip.trim());
        const isAllowed = whitelist.some(allowedIp => isIpInRange(clientIp, allowedIp));

        if (!isAllowed) {
            console.error(`Blocked webhook request from unauthorized IP: ${clientIp}`);
            return res.status(403).json({ error: 'Forbidden - IP not whitelisted' });
        }

        console.log(`Webhook request from whitelisted IP: ${clientIp}`);
        next();
    } catch (error) {
        console.error('IP whitelist verification error:', error);
        return res.status(500).json({ error: 'IP verification failed' });
    }
};
