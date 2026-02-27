'use strict';
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const adminUsers = [
      {
        id: uuidv4(),
        username: 'admin',
        email: 'admin@mercii.com',
        password: await bcrypt.hash('Admin123!@#', 12),
        role: 'admin',
        firstName: 'System',
        lastName: 'Administrator',
        isActive: true,
        passwordChangedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: uuidv4(),
        username: 'mlro',
        email: 'mlro@mercii.com',
        password: await bcrypt.hash('MLRO123!@#', 12),
        role: 'mlro',
        firstName: 'MLRO',
        lastName: 'Officer',
        isActive: true,
        passwordChangedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: uuidv4(),
        username: 'support',
        email: 'support@mercii.com',
        password: await bcrypt.hash('Support123!@#', 12),
        role: 'support',
        firstName: 'Support',
        lastName: 'Agent',
        isActive: true,
        passwordChangedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: uuidv4(),
        username: 'viewer',
        email: 'viewer@mercii.com',
        password: await bcrypt.hash('Viewer123!@#', 12),
        role: 'viewer',
        firstName: 'Read',
        lastName: 'Only',
        isActive: true,
        passwordChangedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    await queryInterface.bulkInsert('AdminUsers', adminUsers);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('AdminUsers', {
      username: ['admin', 'mlro', 'support', 'viewer']
    });
  }
};
