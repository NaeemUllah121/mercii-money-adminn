'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('KycRequests', 'postcode', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('KycRequests', 'address', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
    await queryInterface.addColumn('KycRequests', 'city', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('KycRequests', 'phoneNumber', {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('KycRequests', 'phoneNumber');
    await queryInterface.removeColumn('KycRequests', 'city');
    await queryInterface.removeColumn('KycRequests', 'address');
    await queryInterface.removeColumn('KycRequests', 'postcode');
  }
};
