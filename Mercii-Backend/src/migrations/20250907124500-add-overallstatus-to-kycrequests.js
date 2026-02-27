'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('KycRequests', 'overAllStatus', {
      type: Sequelize.ENUM('not_initiated', 'pending', 'verified'),
      defaultValue: 'not_initiated',
      allowNull: false,
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('KycRequests', 'overAllStatus');
    // Optionally drop enum type in Postgres
    if (queryInterface.sequelize.getDialect() === 'postgres') {
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_KycRequests_overAllStatus";');
    }
  }
};
