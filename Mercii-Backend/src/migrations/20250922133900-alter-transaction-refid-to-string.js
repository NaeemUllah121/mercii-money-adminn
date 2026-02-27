'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Drop old non-unique index on refId if it exists
    try {
      await queryInterface.removeIndex('transactions', 'idx_transactions_ref_id');
    } catch (e) {
      // ignore if it doesn't exist
    }

    // Change column type from UUID to STRING(64) preserving data (Postgres specific cast)
    // Using raw SQL to ensure proper casting from uuid -> text
    const dialect = queryInterface.sequelize.getDialect();
    if (dialect === 'postgres') {
      await queryInterface.sequelize.query(
        `ALTER TABLE "transactions" ALTER COLUMN "refId" TYPE VARCHAR(64) USING "refId"::text;`
      );
      await queryInterface.changeColumn('transactions', 'refId', {
        type: Sequelize.STRING(64),
        allowNull: false,
      });
    } else {
      // Fallback for other dialects
      await queryInterface.changeColumn('transactions', 'refId', {
        type: Sequelize.STRING(64),
        allowNull: false,
      });
    }

    // Add new unique index for refId
    await queryInterface.addIndex('transactions', ['refId'], {
      name: 'uniq_transactions_ref_id',
      unique: true,
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove unique index
    try {
      await queryInterface.removeIndex('transactions', 'uniq_transactions_ref_id');
    } catch (e) {
      // ignore if it doesn't exist
    }

    // Change column back to UUID (this will fail if non-uuid values exist)
    const dialect = queryInterface.sequelize.getDialect();
    if (dialect === 'postgres') {
      await queryInterface.sequelize.query(
        `ALTER TABLE "transactions" ALTER COLUMN "refId" TYPE UUID USING "refId"::uuid;`
      );
      await queryInterface.changeColumn('transactions', 'refId', {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false,
      });
    } else {
      await queryInterface.changeColumn('transactions', 'refId', {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false,
      });
    }

    // Restore non-unique index
    await queryInterface.addIndex('transactions', ['refId'], {
      name: 'idx_transactions_ref_id',
    });
  },
};
