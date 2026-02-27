const crypto = require('crypto');

exports.generateOtp = async (digits = 4) => {
    if (typeof digits !== 'number' || digits < 1) digits = 4;
    const min = Math.pow(10, digits - 1);
    const max = Math.pow(10, digits) - 1;
    return Math.floor(min + Math.random() * (max - min + 1)).toString();
}

exports.generateExpiry = async (minutes) => {
    return new Date(Date.now() + minutes * 60 * 1000);
}

exports.hashPassword = async (password) => {
    return new Promise((resolve, reject) => {
        crypto.pbkdf2(
            password,
            process.env.SALT,
            10000,
            64,
            'sha512',
            (err, derivedKey) => {
                if (err) reject(err);
                resolve(derivedKey.toString('hex'));
            },
        );
    });
};

exports.hashCompare = async (password, hash) => {
    const passwordHash = await exports.hashPassword(password, process.env.SALT);
    return passwordHash === hash;
}

exports.isOtpExpired = (expiry) => {
    return new Date() > new Date(expiry);
}

exports.extractPostalCode = (address) => {
    try {
        const regex = /\b([A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2})\b/i;

        const match = address.match(regex);
        return match ? match[0].toUpperCase() : null;
    } catch (error) {
        return "410141AA"
    } // UK postcode regex

}