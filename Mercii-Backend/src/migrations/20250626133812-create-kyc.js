'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('KycRequests', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      userId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onDelete: 'CASCADE',
      },
      referenceId: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      country: Sequelize.STRING(10),
      status: {
        type: Sequelize.ENUM('not_initiated', 'pending', 'verified', 'declined', 'error'),
        defaultValue: 'not_initiated',
      },
      reason: Sequelize.TEXT,
      documentType: Sequelize.STRING,
      faceMatched: Sequelize.BOOLEAN,
      callbackPayload: Sequelize.JSONB,
      AdverseMedia: Sequelize.STRING,
      AMLScreening: Sequelize.STRING,
      checkIndividual: {
        type: Sequelize.STRING,  // Indicates if this request is for individual check
        defaultValue: "not_initiated",
      },
      checkIndividualResponse: {
        type: Sequelize.INTEGER,  // Response from the individual check API 
        allowNull: true,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      }
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('KycRequests');
  }
};
