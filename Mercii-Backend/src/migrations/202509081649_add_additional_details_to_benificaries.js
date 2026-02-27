"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("benificaries", "additionalDetails", {
      type: Sequelize.JSON,
      allowNull: true,
      defaultValue: {
        contactNumber: null,
        relation: null,
      },
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("benificaries", "additionalDetails");
  },
};
