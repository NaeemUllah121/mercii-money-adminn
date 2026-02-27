const jwt = require('jsonwebtoken');
const { AdminUser, AdminSession, AuditLog } = require('../models');
const { MESSAGES } = require('../utils/constants');

const adminAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    
    // Find the session
    const session = await AdminSession.findOne({
      where: {
        sessionToken: token,
        isActive: true,
        expiresAt: {
          [require('sequelize').Op.gt]: new Date()
        }
      },
      include: [{
        model: AdminUser,
        as: 'adminUser',
        where: { isActive: true }
      }]
    });

    if (!session) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }

    // Check if session is expired
    if (session.isExpired()) {
      session.isActive = false;
      session.logoutReason = 'timeout';
      await session.save();
      return res.status(401).json({ error: 'Session expired' });
    }

    // Check IP allowlisting if configured
    if (session.adminUser.allowedIPs && session.adminUser.allowedIPs.length > 0) {
      const clientIP = req.ip || req.connection.remoteAddress;
      if (!session.adminUser.allowedIPs.includes(clientIP)) {
        await AuditLog.logAction({
          adminUserId: session.adminUserId,
          action: 'LOGIN_FAILED',
          resource: 'ADMIN_USER',
          ipAddress: clientIP,
          userAgent: req.get('User-Agent'),
          metadata: { reason: 'IP not allowed' }
        });
        return res.status(403).json({ error: 'Access denied from this IP' });
      }
    }

    // Update last activity
    session.lastActivityAt = new Date();
    await session.save();

    // Attach admin user to request
    req.adminUser = session.adminUser;
    req.session = session;

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Authentication error' });
  }
};

const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.adminUser) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!req.adminUser.hasPermission(permission)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
};

const requireRole = (role) => {
  return (req, res, next) => {
    if (!req.adminUser) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (req.adminUser.role !== role) {
      return res.status(403).json({ error: 'Insufficient role permissions' });
    }

    next();
  };
};

const auditAction = (action, resource, severity = 'low') => {
  return async (req, res, next) => {
    // Store original json method
    const originalJson = res.json;
    
    // Override json method to capture response
    res.json = function(data) {
      // Log the action if response is successful
      if (res.statusCode < 400) {
        AuditLog.logAction({
          adminUserId: req.adminUser?.id,
          action,
          resource,
          resourceId: req.params.id || req.body.id || null,
          targetUserId: req.params.userId || req.body.userId || null,
          oldValues: req.oldValues || null,
          newValues: req.body || null,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          metadata: {
            method: req.method,
            url: req.originalUrl,
            statusCode: res.statusCode
          },
          severity
        }).catch(err => console.error('Audit log error:', err));
      }
      
      // Call original json method
      return originalJson.call(this, data);
    };
    
    next();
  };
};

module.exports = {
  adminAuth,
  requirePermission,
  requireRole,
  auditAction
};
