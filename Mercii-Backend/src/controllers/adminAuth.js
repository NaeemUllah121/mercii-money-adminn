const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const { AdminUser, AdminSession, AuditLog } = require('../models');
const { MESSAGES } = require('../utils/constants');

const generateJWT = (adminUser) => {
  return jwt.sign(
    { 
      id: adminUser.id, 
      role: adminUser.role,
      username: adminUser.username 
    },
    process.env.JWT_SECRET_KEY,
    { expiresIn: '8h' }
  );
};

const login = async (req, res) => {
  try {
    const { username, password, mfaToken } = req.body;
    const ipAddress = req.ip;
    const userAgent = req.get('User-Agent');

    // Find admin user
    const adminUser = await AdminUser.findOne({
      where: { username, isActive: true }
    });

    if (!adminUser) {
      await AuditLog.logAction({
        action: 'LOGIN_FAILED',
        resource: 'ADMIN_USER',
        ipAddress,
        userAgent,
        metadata: { username, reason: 'user_not_found' },
        severity: 'medium'
      });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check if account is locked
    if (adminUser.lockedUntil && adminUser.lockedUntil > new Date()) {
      return res.status(423).json({ error: 'Account temporarily locked' });
    }

    // Validate password
    const isValidPassword = await adminUser.validatePassword(password);
    if (!isValidPassword) {
      // Increment failed attempts
      adminUser.failedLoginAttempts += 1;
      
      // Lock account after 5 failed attempts for 30 minutes
      if (adminUser.failedLoginAttempts >= 5) {
        adminUser.lockedUntil = new Date(Date.now() + 30 * 60 * 1000);
      }
      
      await adminUser.save();

      await AuditLog.logAction({
        adminUserId: adminUser.id,
        action: 'LOGIN_FAILED',
        resource: 'ADMIN_USER',
        ipAddress,
        userAgent,
        metadata: { 
          reason: 'invalid_password',
          attempts: adminUser.failedLoginAttempts 
        },
        severity: 'medium'
      });

      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check MFA if enabled
    if (adminUser.mfaEnabled) {
      if (!mfaToken) {
        return res.status(200).json({ 
          requiresMFA: true,
          message: 'MFA token required' 
        });
      }

      const verified = speakeasy.totp.verify({
        secret: adminUser.mfaSecret,
        encoding: 'base32',
        token: mfaToken,
        window: 2
      });

      if (!verified) {
        await AuditLog.logAction({
          adminUserId: adminUser.id,
          action: 'LOGIN_FAILED',
          resource: 'ADMIN_USER',
          ipAddress,
          userAgent,
          metadata: { reason: 'invalid_mfa' },
          severity: 'medium'
        });
        return res.status(401).json({ error: 'Invalid MFA token' });
      }
    }

    // Reset failed attempts on successful login
    adminUser.failedLoginAttempts = 0;
    adminUser.lockedUntil = null;
    adminUser.lastLoginAt = new Date();
    await adminUser.save();

    // Generate JWT and create session
    const token = generateJWT(adminUser);
    const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000); // 8 hours

    const session = await AdminSession.createSession({
      adminUserId: adminUser.id,
      ipAddress,
      userAgent,
      sessionToken: token,
      expiresAt
    });

    await AuditLog.logAction({
      adminUserId: adminUser.id,
      action: 'LOGIN',
      resource: 'ADMIN_USER',
      ipAddress,
      userAgent,
      severity: 'low'
    });

    res.json({
      token,
      user: {
        id: adminUser.id,
        username: adminUser.username,
        role: adminUser.role,
        firstName: adminUser.firstName,
        lastName: adminUser.lastName,
        email: adminUser.maskedEmail,
        mfaEnabled: adminUser.mfaEnabled
      },
      expiresAt
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
};

const logout = async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (token && req.session) {
      req.session.isActive = false;
      req.session.logoutReason = 'manual';
      await req.session.save();

      await AuditLog.logAction({
        adminUserId: req.adminUser.id,
        action: 'LOGOUT',
        resource: 'ADMIN_USER',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        severity: 'low'
      });
    }

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
};

const enableMFA = async (req, res) => {
  try {
    const adminUser = req.adminUser;
    
    if (adminUser.mfaEnabled) {
      return res.status(400).json({ error: 'MFA already enabled' });
    }

    // Generate secret
    const secret = speakeasy.generateSecret({
      name: `Mercii Admin (${adminUser.username})`,
      issuer: 'Mercii Remittance',
      length: 32
    });

    // Save secret temporarily (not enabled yet)
    adminUser.mfaSecret = secret.base32;
    await adminUser.save();

    // Generate QR code
    const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url);

    res.json({
      secret: secret.base32,
      qrCode: qrCodeUrl,
      backupCodes: secret.base32 // In production, generate separate backup codes
    });
  } catch (error) {
    console.error('MFA enable error:', error);
    res.status(500).json({ error: 'Failed to enable MFA' });
  }
};

const verifyAndEnableMFA = async (req, res) => {
  try {
    const { token } = req.body;
    const adminUser = req.adminUser;

    if (!adminUser.mfaSecret) {
      return res.status(400).json({ error: 'MFA setup not initiated' });
    }

    const verified = speakeasy.totp.verify({
      secret: adminUser.mfaSecret,
      encoding: 'base32',
      token,
      window: 2
    });

    if (!verified) {
      return res.status(400).json({ error: 'Invalid verification token' });
    }

    // Enable MFA
    adminUser.mfaEnabled = true;
    await adminUser.save();

    await AuditLog.logAction({
      adminUserId: adminUser.id,
      action: 'SYSTEM_CHANGE',
      resource: 'ADMIN_USER',
      resourceId: adminUser.id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      metadata: { change: 'MFA enabled' },
      severity: 'medium'
    });

    res.json({ message: 'MFA enabled successfully' });
  } catch (error) {
    console.error('MFA verification error:', error);
    res.status(500).json({ error: 'Failed to verify MFA' });
  }
};

const disableMFA = async (req, res) => {
  try {
    const { password } = req.body;
    const adminUser = req.adminUser;

    // Verify password
    const isValidPassword = await adminUser.validatePassword(password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    // Disable MFA
    adminUser.mfaEnabled = false;
    adminUser.mfaSecret = null;
    await adminUser.save();

    await AuditLog.logAction({
      adminUserId: adminUser.id,
      action: 'SYSTEM_CHANGE',
      resource: 'ADMIN_USER',
      resourceId: adminUser.id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      metadata: { change: 'MFA disabled' },
      severity: 'medium'
    });

    res.json({ message: 'MFA disabled successfully' });
  } catch (error) {
    console.error('MFA disable error:', error);
    res.status(500).json({ error: 'Failed to disable MFA' });
  }
};

const getProfile = async (req, res) => {
  try {
    const adminUser = req.adminUser;
    
    res.json({
      id: adminUser.id,
      username: adminUser.username,
      role: adminUser.role,
      firstName: adminUser.firstName,
      lastName: adminUser.lastName,
      email: adminUser.maskedEmail,
      mfaEnabled: adminUser.mfaEnabled,
      lastLoginAt: adminUser.lastLoginAt,
      passwordChangedAt: adminUser.passwordChangedAt
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
};

const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const adminUser = req.adminUser;

    // Verify current password
    const isValidPassword = await adminUser.validatePassword(currentPassword);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Update password
    await adminUser.updatePassword(newPassword);

    await AuditLog.logAction({
      adminUserId: adminUser.id,
      action: 'SYSTEM_CHANGE',
      resource: 'ADMIN_USER',
      resourceId: adminUser.id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      metadata: { change: 'Password changed' },
      severity: 'medium'
    });

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
};

module.exports = {
  login,
  logout,
  enableMFA,
  verifyAndEnableMFA,
  disableMFA,
  getProfile,
  changePassword
};
