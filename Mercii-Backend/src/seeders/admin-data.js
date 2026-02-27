const { User, KycRequest, transaction } = require('../models');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

const seedAdminData = async () => {
  try {
    console.log('Seeding admin data...');

    // Create sample users
    const users = [
      {
        id: uuidv4(),
        fullName: 'John Smith',
        email: 'john.smith@example.com',
        phoneNumber: '+447700900001',
        plan: 'base',
        isPhoneVerified: true,
        kycStatus: 'verified',
        registrationStep: 'completed',
        isActive: true,
        country: 'GB',
        transferLimit: 5000,
        usedLimit: 1500,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: uuidv4(),
        fullName: 'Jane Doe',
        email: 'jane.doe@example.com',
        phoneNumber: '+447700900002',
        plan: 'plus',
        isPhoneVerified: true,
        kycStatus: 'pending',
        registrationStep: 'completed',
        isActive: true,
        country: 'GB',
        transferLimit: 5000,
        usedLimit: 800,
        createdAt: new Date(Date.now() - 86400000), // 1 day ago
        updatedAt: new Date(),
      },
      {
        id: uuidv4(),
        fullName: 'Bob Wilson',
        email: 'bob.wilson@example.com',
        phoneNumber: '+447700900003',
        plan: 'base',
        isPhoneVerified: true,
        kycStatus: 'rejected',
        registrationStep: 'completed',
        isActive: false,
        country: 'GB',
        transferLimit: 5000,
        usedLimit: 0,
        createdAt: new Date(Date.now() - 172800000), // 2 days ago
        updatedAt: new Date(),
      },
    ];

    // Insert users
    const createdUsers = await User.bulkCreate(users, { ignoreDuplicates: true });
    console.log(`Created ${createdUsers.length} users`);

    // Create sample KYC requests
    const kycRequests = [
      {
        id: uuidv4(),
        userId: createdUsers[0].id,
        referenceId: `KYC_${Date.now()}_1`,
        status: 'verified',
        overAllStatus: 'verified',
        documentType: 'passport',
        faceMatched: true,
        createdAt: new Date(Date.now() - 3600000), // 1 hour ago
        updatedAt: new Date(),
      },
      {
        id: uuidv4(),
        userId: createdUsers[1].id,
        referenceId: `KYC_${Date.now()}_2`,
        status: 'pending',
        overAllStatus: 'pending',
        documentType: 'driving_license',
        createdAt: new Date(Date.now() - 1800000), // 30 minutes ago
        updatedAt: new Date(),
      },
      {
        id: uuidv4(),
        userId: createdUsers[2].id,
        referenceId: `KYC_${Date.now()}_3`,
        status: 'declined',
        overAllStatus: 'pending',
        documentType: 'passport',
        reason: 'Document quality too low',
        createdAt: new Date(Date.now() - 7200000), // 2 hours ago
        updatedAt: new Date(),
      },
    ];

    const createdKycRequests = await KycRequest.bulkCreate(kycRequests, { ignoreDuplicates: true });
    console.log(`Created ${createdKycRequests.length} KYC requests`);

    // Create sample transactions
    const transactions = [
      {
        id: uuidv4(),
        userId: createdUsers[0].id,
        amount: 100.00,
        amountInPkr: 35000.00,
        sourceOfFund: 'Salary',
        refId: Math.random().toString(36).substring(2, 16).toUpperCase(),
        sendingReason: 'Family support',
        status: 'completed',
        usiPaymentId: `USI_${Date.now()}_1`,
        createdAt: new Date(Date.now() - 3600000), // 1 hour ago
        updatedAt: new Date(),
        completedAt: new Date(Date.now() - 3000000), // 50 minutes ago
      },
      {
        id: uuidv4(),
        userId: createdUsers[0].id,
        amount: 250.00,
        amountInPkr: 87500.00,
        sourceOfFund: 'Business',
        refId: Math.random().toString(36).substring(2, 16).toUpperCase(),
        sendingReason: 'Business expense',
        status: 'pending',
        createdAt: new Date(Date.now() - 1800000), // 30 minutes ago
        updatedAt: new Date(),
      },
      {
        id: uuidv4(),
        userId: createdUsers[1].id,
        amount: 75.00,
        amountInPkr: 26250.00,
        sourceOfFund: 'Personal',
        refId: Math.random().toString(36).substring(2, 16).toUpperCase(),
        sendingReason: 'Gift',
        status: 'failed',
        failureReason: 'Insufficient funds',
        createdAt: new Date(Date.now() - 900000), // 15 minutes ago
        updatedAt: new Date(),
        failedAt: new Date(Date.now() - 600000), // 10 minutes ago
      },
    ];

    const createdTransactions = await transaction.bulkCreate(transactions, { ignoreDuplicates: true });
    console.log(`Created ${createdTransactions.length} transactions`);

    console.log('Admin data seeded successfully!');
    console.log('\nSummary:');
    console.log(`- Users: ${createdUsers.length}`);
    console.log(`- KYC Requests: ${createdKycRequests.length}`);
    console.log(`- Transactions: ${createdTransactions.length}`);

  } catch (error) {
    console.error('Error seeding admin data:', error);
  }
};

module.exports = seedAdminData;
