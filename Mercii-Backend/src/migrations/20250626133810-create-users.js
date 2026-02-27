'use strict';

const { ENUMS, TABLES } = require('../utils/constants');

'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(TABLES.USERS, {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      phoneNumber: {
        type: Sequelize.STRING(20),
        allowNull: true,
        uniqnue: true
      },
      isPhoneVerified: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false
      },
      fullName: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      authMethod: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      socialId: {
        type: Sequelize.STRING(150),
        allowNull: true
      },
      email: {
        type: Sequelize.STRING(150),
        allowNull: true,
        unique: true
      },
      dateOfBirth: {
        type: Sequelize.DATEONLY,
        allowNull: true
      },
      postalCode: {
        type: Sequelize.STRING(20),
        allowNull: true
      },
      streetAddress: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      city: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      passcode: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      registrationStep: {
        type: Sequelize.ENUM('phone_verification', 'personal_details', 'passcode_creation', 'completed'),
        defaultValue: 'phone_verification',
        allowNull: false
      },
      isActive: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false
      },
      lastLoginAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      remitoneCustomerId: {
        type: Sequelize.STRING(50),
        allowNull: true,
        unique: true
      },
      kycStatus: {
        type: Sequelize.ENUM('not_initiated', 'pending', 'verified', 'rejected'),
        defaultValue: 'not_initiated',
      },
      nationality: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      country: {
        type: Sequelize.STRING(255),
        allowNull: true,
        defaultValue: 'GB'
      },
      plan: {
        type: Sequelize.ENUM('not_initiated', 'plus', 'base'),
        allowNull: false,
        defaultValue: 'not_initiated',
      },
      transferLimit: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: 5000, // Default to 0, can be updated later
      },
      usedLimit: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: 0, // Default to 0, can be updated later
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Add indexes
    await queryInterface.addIndex(TABLES.USERS, ['phoneNumber'], {
      unique: true,
      name: 'users_phone_number_unique'
    });

    await queryInterface.addIndex(TABLES.USERS, ['email'], {
      unique: true,
      name: 'users_email_unique'
    });

    await queryInterface.addIndex(TABLES.USERS, ['remitoneCustomerId'], {
      unique: true,
      name: 'users_remitone_customer_id_unique'
    });

    await queryInterface.addIndex(TABLES.USERS, ['registrationStep'], {
      name: 'users_registration_step_index'
    });

    await queryInterface.addIndex(TABLES.USERS, ['isActive'], {
      name: 'users_is_active_index'
    });
    await queryInterface.addIndex(TABLES.USERS, ['socialId'], {
      name: 'users_socialId_index'
    });
    await queryInterface.addIndex(TABLES.USERS, ['authMethod'], {
      name: 'users_authMethod_index'
    });
  },

  async down(queryInterface, Sequelize) {
    // Drop indexes first
    await queryInterface.removeIndex(TABLES.USERS, 'users_phone_number_unique');
    await queryInterface.removeIndex(TABLES.USERS, 'users_email_unique');
    await queryInterface.removeIndex(TABLES.USERS, 'users_remitone_customer_id_unique');
    await queryInterface.removeIndex(TABLES.USERS, 'users_registration_step_index');
    await queryInterface.removeIndex(TABLES.USERS, 'users_is_active_index');
    await queryInterface.removeIndex(TABLES.USERS, 'users_socialId_index');
    await queryInterface.removeIndex(TABLES.USERS, 'users_authMethod_index');

    // Drop the table
    await queryInterface.dropTable(TABLES.USERS);
  }
};
