const { sequelize } = require('./src/config/database');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

async function initDatabase() {
  try {
    console.log('Initializing database...');
    
    // Connect to database
    await sequelize.authenticate();
    console.log('Database connection established.');
    
    // Create admin users table if it doesn't exist
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
        "lastLogin" TIMESTAMP,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    // Check if admin user exists
    const [adminUser] = await sequelize.query(
      'SELECT * FROM "AdminUsers" WHERE username = ?',
      { 
        replacements: ['admin'],
        type: sequelize.QueryTypes.SELECT 
      }
    );
    
    if (!adminUser) {
      // Create admin user
      const hashedPassword = await bcrypt.hash('Admin123!@#', 10);
      const adminId = uuidv4();
      
      await sequelize.query(`
        INSERT INTO "AdminUsers" (id, username, password, email, firstName, lastName, role)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, {
        replacements: [
          adminId,
          'admin',
          hashedPassword,
          'admin@mercii.com',
          'System',
          'Administrator',
          'admin'
        ]
      });
      
      console.log('✅ Admin user created successfully!');
      console.log('Username: admin');
      console.log('Password: Admin123!@#');
    } else {
      console.log('✅ Admin user already exists');
    }
    
    console.log('Database initialization completed successfully!');
    
  } catch (error) {
    console.error('Database initialization failed:', error);
  } finally {
    await sequelize.close();
  }
}

// Run if called directly
if (require.main === module) {
  initDatabase();
}

module.exports = initDatabase;
