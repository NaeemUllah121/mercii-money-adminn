'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('AuditLogs', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      adminUserId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'AdminUsers',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      action: {
        type: Sequelize.ENUM(
          'CREATE', 'READ', 'UPDATE', 'DELETE',
          'LOGIN', 'LOGOUT', 'LOGIN_FAILED',
          'SUSPEND_CUSTOMER', 'UNSUSPEND_CUSTOMER',
          'APPROVE_MLRO', 'REJECT_MLRO', 'HOLD_MLRO',
          'REFUND_TRANSACTION', 'CANCEL_TRANSACTION',
          'RESEND_KYC', 'ADJUST_LIMITS',
          'EXPORT_DATA', 'VIEW_PII', 'MANAGE_ADMIN',
          'SYSTEM_CHANGE', 'SECURITY_ALERT'
        ),
        allowNull: false,
      },
      resource: {
        type: Sequelize.ENUM(
          'USER', 'TRANSACTION', 'BENEFICIARY', 'KYC',
          'MLRO_FLAG', 'ADMIN_USER', 'SYSTEM', 'AUDIT_LOG'
        ),
        allowNull: false,
      },
      resourceId: {
        type: Sequelize.UUID,
        allowNull: true,
      },
      targetUserId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'Users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      oldValues: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      newValues: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      ipAddress: {
        type: Sequelize.INET,
        allowNull: true,
      },
      userAgent: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      metadata: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      severity: {
        type: Sequelize.ENUM('low', 'medium', 'high', 'critical'),
        allowNull: false,
        defaultValue: 'low',
      },
      complianceRelevant: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
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
    await queryInterface.addIndex('AuditLogs', ['adminUserId'], { name: 'audit_logs_admin_user_id_index' });
    await queryInterface.addIndex('AuditLogs', ['action'], { name: 'audit_logs_action_index' });
    await queryInterface.addIndex('AuditLogs', ['resource'], { name: 'audit_logs_resource_index' });
    await queryInterface.addIndex('AuditLogs', ['createdAt'], { name: 'audit_logs_created_at_index' });
    await queryInterface.addIndex('AuditLogs', ['severity'], { name: 'audit_logs_severity_index' });
    await queryInterface.addIndex('AuditLogs', ['complianceRelevant'], { name: 'audit_logs_compliance_relevant_index' });
    await queryInterface.addIndex('AuditLogs', ['targetUserId'], { name: 'audit_logs_target_user_id_index' });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('AuditLogs');
  }
};
