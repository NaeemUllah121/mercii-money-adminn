const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { sequelize } = require('../config/database');

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
    const { username, password } = req.body;
    const ipAddress = req.ip;
    const userAgent = req.get('User-Agent');

    console.log('Login attempt for username:', username);

    // Check if AdminUsers table exists, create if not
    try {
      await sequelize.query(`
        CREATE TABLE IF NOT EXISTS "AdminUsers" (
          "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          "username" VARCHAR(255) UNIQUE NOT NULL,
          "password" VARCHAR(255) NOT NULL,
          "email" VARCHAR(255),
          "firstName" VARCHAR(255),
          "lastName" VARCHAR(255),
          "role" VARCHAR(50) DEFAULT 'admin',
          "mfaEnabled" BOOLEAN DEFAULT false,
          "mfaSecret" VARCHAR(255),
          "isActive" BOOLEAN DEFAULT true,
          "lockedUntil" TIMESTAMP,
          "failedLoginAttempts" INTEGER DEFAULT 0,
          "lastLoginAt" TIMESTAMP,
          "passwordChangedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log('AdminUsers table ensured');
    } catch (error) {
      console.log('Table creation error (might already exist):', error.message);
    }

    // Find admin user using raw query
    const [adminUser] = await sequelize.query(
      'SELECT * FROM "AdminUsers" WHERE username = ? AND isActive = true',
      { 
        replacements: [username],
        type: sequelize.QueryTypes.SELECT 
      }
    );

    if (!adminUser) {
      console.log('Admin user not found, creating one...');
      
      // Create admin user if not exists
      const hashedPassword = await bcrypt.hash('Admin123!@#', 10);
      
      await sequelize.query(`
        INSERT INTO "AdminUsers" (username, password, email, firstName, lastName, role)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT (username) DO NOTHING
      `, {
        replacements: [
          'admin',
          hashedPassword,
          'admin@mercii.com',
          'System',
          'Administrator',
          'admin'
        ]
      });

      // Try to find again
      const [newAdminUser] = await sequelize.query(
        'SELECT * FROM "AdminUsers" WHERE username = ? AND isActive = true',
        { 
          replacements: ['admin'],
          type: sequelize.QueryTypes.SELECT 
        }
      );

      if (!newAdminUser) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Validate password for newly created admin
      const isValidPassword = await bcrypt.compare(password, newAdminUser.password);
      if (!isValidPassword) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Update last login
      await sequelize.query(
        'UPDATE "AdminUsers" SET "lastLoginAt" = CURRENT_TIMESTAMP WHERE id = ?',
        { replacements: [newAdminUser.id] }
      );

      // Generate JWT
      const token = generateJWT(newAdminUser);
      const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000); // 8 hours

      console.log('Login successful for admin user');

      return res.json({
        token,
        user: {
          id: newAdminUser.id,
          username: newAdminUser.username,
          role: newAdminUser.role,
          firstName: newAdminUser.firstName,
          lastName: newAdminUser.lastName,
          email: newAdminUser.email,
          mfaEnabled: newAdminUser.mfaEnabled || false
        },
        expiresAt
      });
    }

    // Validate password for existing user
    const isValidPassword = await bcrypt.compare(password, adminUser.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update last login
    await sequelize.query(
      'UPDATE "AdminUsers" SET "lastLoginAt" = CURRENT_TIMESTAMP WHERE id = ?',
      { replacements: [adminUser.id] }
    );

    // Generate JWT
    const token = generateJWT(adminUser);
    const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000); // 8 hours

    console.log('Login successful for existing user');

    res.json({
      token,
      user: {
        id: adminUser.id,
        username: adminUser.username,
        role: adminUser.role,
        firstName: adminUser.firstName,
        lastName: adminUser.lastName,
        email: adminUser.email,
        mfaEnabled: adminUser.mfaEnabled || false
      },
      expiresAt
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed: ' + error.message });
  }
};

const logout = async (req, res) => {
  try {
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
};

module.exports = {
  login,
  logout
};
