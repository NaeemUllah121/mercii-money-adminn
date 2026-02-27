require('dotenv').config();
const { Sequelize } = require('sequelize');

// Use DATABASE_URL if available (Render), otherwise use individual variables
const sequelize = process.env.DATABASE_URL 
  ? new Sequelize(process.env.DATABASE_URL, {
      dialect: 'postgres',
      logging: console.log, // Enable logging to debug
      ssl: process.env.NODE_ENV === 'production' ? { require: true, rejectUnauthorized: false } : false
    })
  : new Sequelize(
      process.env.DB_NAME,
      process.env.DB_USER,
      process.env.DB_PASSWORD,
      {
        host: process.env.DB_HOST,
        dialect: process.env.DB_DIALECT,
      },
    );

const connectDb = async () => {
  try {
    await sequelize.authenticate();
    console.log(`Connection to Database: ${process.env.DB_NAME || 'Render PostgreSQL'} has been established successfully.`);
    
    // Sync database models in production
    if (process.env.NODE_ENV === 'production') {
      console.log('Syncing database models...');
      await sequelize.sync({ alter: true });
      console.log('Database models synced successfully.');
    }
  } catch (error) {
    console.error('Unable to connect to the database:', error);
    console.error('Database URL:', process.env.DATABASE_URL ? 'Set' : 'Not set');
    console.error('DB Name:', process.env.DB_NAME || 'Not set');
  }
};

module.exports = { sequelize, connectDb };
