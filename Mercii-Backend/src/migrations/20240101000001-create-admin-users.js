'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('AdminUsers', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      username: {
        type: Sequelize.STRING(50),
        allowNull: false,
        unique: true,
      },
      email: {
        type: Sequelize.STRING(150),
        allowNull: false,
        unique: true,
      },
      password: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      role: {
        type: Sequelize.ENUM('admin', 'mlro', 'support', 'viewer'),
        allowNull: false,
        defaultValue: 'viewer',
      },
      firstName: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      lastName: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      isActive: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
      },
      lastLoginAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      mfaSecret: {
        type: Sequelize.STRING(32),
        allowNull: true,
      },
      mfaEnabled: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      failedLoginAttempts: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
      },
      lockedUntil: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      passwordChangedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      allowedIPs: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      ssoProvider: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },
      ssoId: {
        type: Sequelize.STRING(150),
        allowNull: true,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      }
    });

    // Add indexes
    await queryInterface.addIndex('AdminUsers', ['username']);
    await queryInterface.addIndex('AdminUsers', ['email']);
    await queryInterface.addIndex('AdminUsers', ['role']);
    await queryInterface.addIndex('AdminUsers', ['isActive']);
    await queryInterface.addIndex('AdminUsers', ['ssoProvider', 'ssoId']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('AdminUsers');
  }
};
