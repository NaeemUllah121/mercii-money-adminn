require('dotenv').config();
const { sequelize } = require('./src/models');
const { AdminUser } = require('./src/models');
const bcrypt = require('bcryptjs');

async function createAdminUser() {
  try {
    console.log('Connecting to database...');
    await sequelize.authenticate();
    console.log('Database connected successfully.');

    // Check if admin user exists
    const existingAdmin = await AdminUser.findOne({
      where: { username: 'admin' }
    });

    if (existingAdmin) {
      console.log('Admin user already exists:', {
        username: existingAdmin.username,
        role: existingAdmin.role,
        isActive: existingAdmin.isActive,
        createdAt: existingAdmin.createdAt
      });
      
      // Test password validation
      const isValid = await existingAdmin.validatePassword('Admin123!@#');
      console.log('Password validation for "Admin123!@#":', isValid ? '✅ Valid' : '❌ Invalid');
      
      return;
    }

    // Create admin user
    console.log('Creating admin user...');
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash('Admin123!@#', saltRounds);

    const adminUser = await AdminUser.create({
      username: 'admin',
      password: hashedPassword,
      role: 'admin',
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin@mercii.com',
      isActive: true,
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: null,
      mfaSecret: null,
      mfaEnabled: false
    });

    console.log('✅ Admin user created successfully:', {
      id: adminUser.id,
      username: adminUser.username,
      role: adminUser.role,
      email: adminUser.email,
      isActive: adminUser.isActive
    });

    // Test login
    const testLogin = await AdminUser.findOne({
      where: { username: 'admin', isActive: true }
    });

    const isValidPassword = await testLogin.validatePassword('Admin123!@#');
    console.log('Password validation test:', isValidPassword ? '✅ Passed' : '❌ Failed');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await sequelize.close();
  }
}

createAdminUser();
