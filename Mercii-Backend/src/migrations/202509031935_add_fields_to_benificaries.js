"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("benificaries", "sourceOfFund", {
      type: Sequelize.TEXT,
      allowNull: true,
    });

    await queryInterface.addColumn("benificaries", "sendingReason", {
      type: Sequelize.TEXT,
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("benificaries", "sendingReason");
    await queryInterface.removeColumn("benificaries", "sourceOfFund");
  },
};
