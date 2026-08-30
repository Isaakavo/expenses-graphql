'use strict';

const { Op } = require('sequelize');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Cards', 'provider', {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.addColumn('Cards', 'providerAccountId', {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.addColumn('Cards', 'providerConnectionId', {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.addColumn('Cards', 'providerAccessTokenCiphertext', {
      type: Sequelize.TEXT,
      allowNull: true,
    });

    await queryInterface.addColumn('Cards', 'providerAccessTokenIv', {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.addColumn('Cards', 'providerAccessTokenAuthTag', {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.addColumn('Cards', 'providerStatus', {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.addColumn('Cards', 'providerLinkedAt', {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.addColumn('Cards', 'providerLastSyncedAt', {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.addIndex('Cards', ['provider', 'providerAccountId'], {
      unique: true,
      where: { providerAccountId: { [Op.ne]: null } },
      name: 'unique_provider_account_per_provider',
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeIndex('Cards', 'unique_provider_account_per_provider');
    await queryInterface.removeColumn('Cards', 'providerLastSyncedAt');
    await queryInterface.removeColumn('Cards', 'providerLinkedAt');
    await queryInterface.removeColumn('Cards', 'providerStatus');
    await queryInterface.removeColumn('Cards', 'providerAccessTokenAuthTag');
    await queryInterface.removeColumn('Cards', 'providerAccessTokenIv');
    await queryInterface.removeColumn('Cards', 'providerAccessTokenCiphertext');
    await queryInterface.removeColumn('Cards', 'providerConnectionId');
    await queryInterface.removeColumn('Cards', 'providerAccountId');
    await queryInterface.removeColumn('Cards', 'provider');
  },
};
