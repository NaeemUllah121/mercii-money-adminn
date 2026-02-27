'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('AdminSessions', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      adminUserId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'AdminUsers',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      sessionToken: {
        type: Sequelize.STRING(255),
        allowNull: false,
        unique: true,
      },
      ipAddress: {
        type: Sequelize.INET,
        allowNull: false,
      },
      userAgent: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      isActive: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
      },
      expiresAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      lastActivityAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      mfaVerified: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      logoutReason: {
        type: Sequelize.ENUM('manual', 'timeout', 'forced', 'security'),
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
    await queryInterface.addIndex('AdminSessions', ['sessionToken'], { unique: true, name: 'admin_sessions_token_unique' });
    await queryInterface.addIndex('AdminSessions', ['adminUserId'], { name: 'admin_sessions_admin_user_id_index' });
    await queryInterface.addIndex('AdminSessions', ['isActive'], { name: 'admin_sessions_is_active_index' });
    await queryInterface.addIndex('AdminSessions', ['expiresAt'], { name: 'admin_sessions_expires_at_index' });
    await queryInterface.addIndex('AdminSessions', ['ipAddress'], { name: 'admin_sessions_ip_address_index' });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('AdminSessions');
  }
};
