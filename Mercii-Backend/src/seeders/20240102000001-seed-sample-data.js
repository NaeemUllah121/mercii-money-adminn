'use strict';
const { v4: uuidv4 } = require('uuid');

module.exports = {
  async up(queryInterface, Sequelize) {
    // ==================== USERS ====================
    const user1Id = uuidv4();
    const user2Id = uuidv4();
    const user3Id = uuidv4();
    const user4Id = uuidv4();
    const user5Id = uuidv4();
    const user6Id = uuidv4();
    const user7Id = uuidv4();
    const user8Id = uuidv4();

    const now = new Date();
    const daysAgo = (d) => new Date(now.getTime() - d * 24 * 60 * 60 * 1000);

    await queryInterface.bulkInsert('Users', [
      {
        id: user1Id, phoneNumber: '+447700100001', plan: 'plus', isPhoneVerified: true,
        fullName: 'Ahmed Khan', email: 'ahmed.khan@email.com', dateOfBirth: '1990-03-15',
        postalCode: 'E1 6AN', streetAddress: '42 Brick Lane', city: 'London',
        passcode: '$2b$12$LJ3m5y5z5z5z5z5z5z5z5OcXZtV5KZXZXZXZXZXZXZXZXZXZXZX',
        registrationStep: 'completed', isActive: true, lastLoginAt: daysAgo(0),
        kycStatus: 'verified', nationality: 'PK', country: 'GB',
        transferLimit: 5000, usedLimit: 1200, createdAt: daysAgo(45), updatedAt: now
      },
      {
        id: user2Id, phoneNumber: '+447700100002', plan: 'plus', isPhoneVerified: true,
        fullName: 'Fatima Ali', email: 'fatima.ali@email.com', dateOfBirth: '1988-07-22',
        postalCode: 'M1 4HQ', streetAddress: '15 Deansgate', city: 'Manchester',
        passcode: '$2b$12$LJ3m5y5z5z5z5z5z5z5z5OcXZtV5KZXZXZXZXZXZXZXZXZXZXZX',
        registrationStep: 'completed', isActive: true, lastLoginAt: daysAgo(1),
        kycStatus: 'verified', nationality: 'PK', country: 'GB',
        transferLimit: 5000, usedLimit: 3500, createdAt: daysAgo(90), updatedAt: now
      },
      {
        id: user3Id, phoneNumber: '+447700100003', plan: 'base', isPhoneVerified: true,
        fullName: 'Usman Malik', email: 'usman.malik@email.com', dateOfBirth: '1995-11-03',
        postalCode: 'B1 1BB', streetAddress: '8 Bull Ring', city: 'Birmingham',
        passcode: '$2b$12$LJ3m5y5z5z5z5z5z5z5z5OcXZtV5KZXZXZXZXZXZXZXZXZXZXZX',
        registrationStep: 'completed', isActive: true, lastLoginAt: daysAgo(3),
        kycStatus: 'pending', nationality: 'PK', country: 'GB',
        transferLimit: 5000, usedLimit: 0, createdAt: daysAgo(10), updatedAt: now
      },
      {
        id: user4Id, phoneNumber: '+447700100004', plan: 'plus', isPhoneVerified: true,
        fullName: 'Ayesha Begum', email: 'ayesha.begum@email.com', dateOfBirth: '1992-01-18',
        postalCode: 'LS1 5DQ', streetAddress: '22 Briggate', city: 'Leeds',
        passcode: '$2b$12$LJ3m5y5z5z5z5z5z5z5z5OcXZtV5KZXZXZXZXZXZXZXZXZXZXZX',
        registrationStep: 'completed', isActive: false, lastLoginAt: daysAgo(15),
        kycStatus: 'verified', nationality: 'PK', country: 'GB',
        transferLimit: 5000, usedLimit: 4800, createdAt: daysAgo(120), updatedAt: now
      },
      {
        id: user5Id, phoneNumber: '+447700100005', plan: 'not_initiated', isPhoneVerified: true,
        fullName: 'Bilal Hussain', email: 'bilal.hussain@email.com', dateOfBirth: '2000-06-30',
        postalCode: 'G1 1AA', streetAddress: '5 Argyle Street', city: 'Glasgow',
        passcode: null,
        registrationStep: 'personal_details', isActive: true, lastLoginAt: daysAgo(2),
        kycStatus: 'not_initiated', nationality: 'PK', country: 'GB',
        transferLimit: 5000, usedLimit: 0, createdAt: daysAgo(3), updatedAt: now
      },
      {
        id: user6Id, phoneNumber: '+447700100006', plan: 'plus', isPhoneVerified: true,
        fullName: 'Sara Nawaz', email: 'sara.nawaz@email.com', dateOfBirth: '1985-09-12',
        postalCode: 'CF10 1EP', streetAddress: '10 Queen Street', city: 'Cardiff',
        passcode: '$2b$12$LJ3m5y5z5z5z5z5z5z5z5OcXZtV5KZXZXZXZXZXZXZXZXZXZXZX',
        registrationStep: 'completed', isActive: true, lastLoginAt: daysAgo(0),
        kycStatus: 'verified', nationality: 'PK', country: 'GB',
        transferLimit: 5000, usedLimit: 2100, createdAt: daysAgo(60), updatedAt: now
      },
      {
        id: user7Id, phoneNumber: '+447700100007', plan: 'base', isPhoneVerified: true,
        fullName: 'Imran Qureshi', email: 'imran.qureshi@email.com', dateOfBirth: '1998-04-25',
        postalCode: 'EH1 3AA', streetAddress: '3 Princes Street', city: 'Edinburgh',
        passcode: '$2b$12$LJ3m5y5z5z5z5z5z5z5z5OcXZtV5KZXZXZXZXZXZXZXZXZXZXZX',
        registrationStep: 'completed', isActive: true, lastLoginAt: daysAgo(5),
        kycStatus: 'rejected', nationality: 'PK', country: 'GB',
        transferLimit: 5000, usedLimit: 0, createdAt: daysAgo(20), updatedAt: now
      },
      {
        id: user8Id, phoneNumber: '+447700100008', plan: 'plus', isPhoneVerified: true,
        fullName: 'Zainab Sheikh', email: 'zainab.sheikh@email.com', dateOfBirth: '1993-12-05',
        postalCode: 'BS1 4DJ', streetAddress: '7 Corn Street', city: 'Bristol',
        passcode: '$2b$12$LJ3m5y5z5z5z5z5z5z5z5OcXZtV5KZXZXZXZXZXZXZXZXZXZXZX',
        registrationStep: 'completed', isActive: true, lastLoginAt: daysAgo(1),
        kycStatus: 'verified', nationality: 'PK', country: 'GB',
        transferLimit: 5000, usedLimit: 800, createdAt: daysAgo(75), updatedAt: now
      }
    ]);

    // ==================== BENEFICIARIES ====================
    const ben1Id = uuidv4();
    const ben2Id = uuidv4();
    const ben3Id = uuidv4();
    const ben4Id = uuidv4();
    const ben5Id = uuidv4();
    const ben6Id = uuidv4();
    const ben7Id = uuidv4();
    const ben8Id = uuidv4();
    const ben9Id = uuidv4();
    const ben10Id = uuidv4();

    await queryInterface.bulkInsert('benificaries', [
      {
        id: ben1Id, userId: user1Id, type: 'someone_else', fName: 'Mohammad Khan',
        iban: 'PK36SCBL0000001123456702', bankName: 'Standard Chartered', country: 'Pakistan',
        address1: 'House 12, Street 5, G-9', city: 'Islamabad', deliveryMethod: 'bank_transfer',
        sourceOfFund: 'salary', sendingReason: 'family_support', createdAt: daysAgo(40), updatedAt: now
      },
      {
        id: ben2Id, userId: user1Id, type: 'someone_else', fName: 'Nadia Khan',
        iban: 'PK36HABB0000001123456703', bankName: 'HBL', country: 'Pakistan',
        address1: 'Flat 4, Block C, Gulberg', city: 'Lahore', deliveryMethod: 'bank_transfer',
        sourceOfFund: 'salary', sendingReason: 'education', createdAt: daysAgo(38), updatedAt: now
      },
      {
        id: ben3Id, userId: user2Id, type: 'someone_else', fName: 'Tariq Ali',
        iban: 'PK36MUCB0000001123456704', bankName: 'MCB', country: 'Pakistan',
        address1: '45 Main Road, Saddar', city: 'Karachi', deliveryMethod: 'bank_transfer',
        sourceOfFund: 'business', sendingReason: 'family_support', createdAt: daysAgo(85), updatedAt: now
      },
      {
        id: ben4Id, userId: user2Id, type: 'someone_else', fName: 'Amina Bibi',
        iban: 'PK36NBPA0000001123456705', bankName: 'NBP', country: 'Pakistan',
        address1: '78 Bazaar Road', city: 'Peshawar', deliveryMethod: 'cash_pickup',
        sourceOfFund: 'salary', sendingReason: 'medical', createdAt: daysAgo(80), updatedAt: now
      },
      {
        id: ben5Id, userId: user4Id, type: 'someone_else', fName: 'Kamran Begum',
        iban: 'PK36UNIL0000001123456706', bankName: 'UBL', country: 'Pakistan',
        address1: '23 Civil Lines', city: 'Rawalpindi', deliveryMethod: 'bank_transfer',
        sourceOfFund: 'salary', sendingReason: 'property', createdAt: daysAgo(100), updatedAt: now
      },
      {
        id: ben6Id, userId: user6Id, type: 'someone_else', fName: 'Hassan Nawaz',
        iban: 'PK36ALFH0000001123456707', bankName: 'Bank Alfalah', country: 'Pakistan',
        address1: '11 DHA Phase 2', city: 'Lahore', deliveryMethod: 'bank_transfer',
        sourceOfFund: 'savings', sendingReason: 'family_support', createdAt: daysAgo(55), updatedAt: now
      },
      {
        id: ben7Id, userId: user6Id, type: 'someone_else', fName: 'Rukhsana Bibi',
        iban: 'PK36BKIP0000001123456708', bankName: 'Bank of Punjab', country: 'Pakistan',
        address1: '56 Mall Road', city: 'Multan', deliveryMethod: 'cash_pickup',
        sourceOfFund: 'salary', sendingReason: 'gift', createdAt: daysAgo(50), updatedAt: now
      },
      {
        id: ben8Id, userId: user8Id, type: 'business', fName: 'Asad Sheikh',
        iban: 'PK36MEZN0000001123456709', bankName: 'Meezan Bank', country: 'Pakistan',
        address1: '9 Clifton Block 5', city: 'Karachi', deliveryMethod: 'bank_transfer',
        sourceOfFund: 'business', sendingReason: 'business', createdAt: daysAgo(70), updatedAt: now
      },
      {
        id: ben9Id, userId: user8Id, type: 'someone_else', fName: 'Saba Iqbal',
        iban: 'PK36JSBL0000001123456710', bankName: 'JS Bank', country: 'Pakistan',
        address1: '32 F-8 Markaz', city: 'Islamabad', deliveryMethod: 'bank_transfer',
        sourceOfFund: 'salary', sendingReason: 'education', createdAt: daysAgo(65), updatedAt: now
      },
      {
        id: ben10Id, userId: user1Id, type: 'my_self', fName: 'RDA Account - Ali Khan',
        iban: 'PK36SCBL0000001123456711', bankName: 'Standard Chartered RDA', country: 'Pakistan',
        address1: 'RDA Branch, I-8', city: 'Islamabad', deliveryMethod: 'bank_transfer',
        sourceOfFund: 'salary', sendingReason: 'investment', createdAt: daysAgo(30), updatedAt: now
      }
    ]);

    // ==================== KYC REQUESTS ====================
    await queryInterface.bulkInsert('KycRequests', [
      {
        id: uuidv4(), userId: user1Id, referenceId: 'KYC_SHUFTI_001',
        country: 'GB', status: 'verified', overAllStatus: 'verified',
        documentType: 'passport', faceMatched: true,
        createdAt: daysAgo(44), updatedAt: daysAgo(43)
      },
      {
        id: uuidv4(), userId: user2Id, referenceId: 'KYC_SHUFTI_002',
        country: 'GB', status: 'verified', overAllStatus: 'verified',
        documentType: 'driving_licence', faceMatched: true,
        createdAt: daysAgo(89), updatedAt: daysAgo(88)
      },
      {
        id: uuidv4(), userId: user3Id, referenceId: 'KYC_SHUFTI_003',
        country: 'GB', status: 'pending', overAllStatus: 'pending',
        documentType: 'passport', faceMatched: null,
        createdAt: daysAgo(9), updatedAt: daysAgo(9)
      },
      {
        id: uuidv4(), userId: user4Id, referenceId: 'KYC_SHUFTI_004',
        country: 'GB', status: 'verified', overAllStatus: 'verified',
        documentType: 'national_id', faceMatched: true,
        createdAt: daysAgo(118), updatedAt: daysAgo(117)
      },
      {
        id: uuidv4(), userId: user6Id, referenceId: 'KYC_SHUFTI_006',
        country: 'GB', status: 'verified', overAllStatus: 'verified',
        documentType: 'passport', faceMatched: true,
        createdAt: daysAgo(58), updatedAt: daysAgo(57)
      },
      {
        id: uuidv4(), userId: user7Id, referenceId: 'KYC_SHUFTI_007',
        country: 'GB', status: 'declined', overAllStatus: 'not_initiated',
        reason: 'Document expired - passport validity check failed',
        documentType: 'passport', faceMatched: false,
        createdAt: daysAgo(18), updatedAt: daysAgo(17)
      },
      {
        id: uuidv4(), userId: user8Id, referenceId: 'KYC_SHUFTI_008',
        country: 'GB', status: 'verified', overAllStatus: 'verified',
        documentType: 'driving_licence', faceMatched: true,
        createdAt: daysAgo(73), updatedAt: daysAgo(72)
      }
    ]);

    // ==================== TRANSACTIONS ====================
    const txData = [
      // Ahmed Khan transactions (12 total - full bonus cycle)
      { userId: user1Id, benificaryId: ben1Id, amount: 100, amountInPkr: 28000, status: 'completed', sourceOfFund: 'salary', sendingReason: 'family_support', usiPaymentId: 'USI_PAY_001', daysAgo: 42 },
      { userId: user1Id, benificaryId: ben2Id, amount: 150, amountInPkr: 42000, status: 'completed', sourceOfFund: 'salary', sendingReason: 'education', usiPaymentId: 'USI_PAY_002', daysAgo: 38 },
      { userId: user1Id, benificaryId: ben1Id, amount: 200, amountInPkr: 56000, status: 'completed', sourceOfFund: 'salary', sendingReason: 'family_support', usiPaymentId: 'USI_PAY_003', daysAgo: 35 },
      { userId: user1Id, benificaryId: ben2Id, amount: 90, amountInPkr: 25200, status: 'completed', sourceOfFund: 'salary', sendingReason: 'education', usiPaymentId: 'USI_PAY_004', daysAgo: 30 }, // Bonus #4: +500 PKR
      { userId: user1Id, benificaryId: ben1Id, amount: 120, amountInPkr: 33600, status: 'completed', sourceOfFund: 'salary', sendingReason: 'family_support', usiPaymentId: 'USI_PAY_005', daysAgo: 25 },
      { userId: user1Id, benificaryId: ben10Id, amount: 500, amountInPkr: 140000, status: 'completed', sourceOfFund: 'salary', sendingReason: 'investment', usiPaymentId: 'USI_PAY_006', daysAgo: 20 }, // RDA - excluded from bonus
      { userId: user1Id, benificaryId: ben2Id, amount: 85, amountInPkr: 23800, status: 'failed', sourceOfFund: 'salary', sendingReason: 'education', failureReason: 'USI API timeout', daysAgo: 15 },
      { userId: user1Id, benificaryId: ben1Id, amount: 100, amountInPkr: 28000, status: 'completed', sourceOfFund: 'salary', sendingReason: 'family_support', usiPaymentId: 'USI_PAY_007', daysAgo: 10 },

      // Fatima Ali transactions
      { userId: user2Id, benificaryId: ben3Id, amount: 300, amountInPkr: 84000, status: 'completed', sourceOfFund: 'business', sendingReason: 'family_support', usiPaymentId: 'USI_PAY_008', daysAgo: 80 },
      { userId: user2Id, benificaryId: ben4Id, amount: 250, amountInPkr: 70000, status: 'completed', sourceOfFund: 'salary', sendingReason: 'medical', usiPaymentId: 'USI_PAY_009', daysAgo: 60 },
      { userId: user2Id, benificaryId: ben3Id, amount: 500, amountInPkr: 140000, status: 'completed', sourceOfFund: 'business', sendingReason: 'family_support', usiPaymentId: 'USI_PAY_010', daysAgo: 40 },
      { userId: user2Id, benificaryId: ben4Id, amount: 200, amountInPkr: 56000, status: 'completed', sourceOfFund: 'salary', sendingReason: 'medical', usiPaymentId: 'USI_PAY_011', daysAgo: 20 },
      { userId: user2Id, benificaryId: ben3Id, amount: 1200, amountInPkr: 336000, status: 'completed', sourceOfFund: 'business', sendingReason: 'family_support', usiPaymentId: 'USI_PAY_012', daysAgo: 5 }, // High value
      { userId: user2Id, benificaryId: ben4Id, amount: 150, amountInPkr: 42000, status: 'pending', sourceOfFund: 'salary', sendingReason: 'medical', daysAgo: 0 },

      // Ayesha Begum transactions (suspended user)
      { userId: user4Id, benificaryId: ben5Id, amount: 400, amountInPkr: 112000, status: 'completed', sourceOfFund: 'salary', sendingReason: 'property', usiPaymentId: 'USI_PAY_013', daysAgo: 100 },
      { userId: user4Id, benificaryId: ben5Id, amount: 2000, amountInPkr: 560000, status: 'completed', sourceOfFund: 'salary', sendingReason: 'property', usiPaymentId: 'USI_PAY_014', daysAgo: 50 }, // High value
      { userId: user4Id, benificaryId: ben5Id, amount: 2400, amountInPkr: 672000, status: 'cancelled', sourceOfFund: 'salary', sendingReason: 'property', failureReason: 'Account suspended', daysAgo: 14 },

      // Sara Nawaz transactions
      { userId: user6Id, benificaryId: ben6Id, amount: 200, amountInPkr: 56000, status: 'completed', sourceOfFund: 'savings', sendingReason: 'family_support', usiPaymentId: 'USI_PAY_015', daysAgo: 50 },
      { userId: user6Id, benificaryId: ben7Id, amount: 150, amountInPkr: 42000, status: 'completed', sourceOfFund: 'salary', sendingReason: 'gift', usiPaymentId: 'USI_PAY_016', daysAgo: 35 },
      { userId: user6Id, benificaryId: ben6Id, amount: 300, amountInPkr: 84000, status: 'completed', sourceOfFund: 'savings', sendingReason: 'family_support', usiPaymentId: 'USI_PAY_017', daysAgo: 15 },
      { userId: user6Id, benificaryId: ben7Id, amount: 100, amountInPkr: 28000, status: 'failed', sourceOfFund: 'salary', sendingReason: 'gift', failureReason: 'Beneficiary bank rejected', daysAgo: 5 },

      // Zainab Sheikh transactions
      { userId: user8Id, benificaryId: ben8Id, amount: 180, amountInPkr: 50400, status: 'completed', sourceOfFund: 'business', sendingReason: 'business', usiPaymentId: 'USI_PAY_018', daysAgo: 65 },
      { userId: user8Id, benificaryId: ben9Id, amount: 120, amountInPkr: 33600, status: 'completed', sourceOfFund: 'salary', sendingReason: 'education', usiPaymentId: 'USI_PAY_019', daysAgo: 45 },
      { userId: user8Id, benificaryId: ben8Id, amount: 250, amountInPkr: 70000, status: 'completed', sourceOfFund: 'business', sendingReason: 'business', usiPaymentId: 'USI_PAY_020', daysAgo: 25 },
      { userId: user8Id, benificaryId: ben9Id, amount: 80, amountInPkr: 22400, status: 'pending', sourceOfFund: 'salary', sendingReason: 'education', daysAgo: 3 }, // Stale pending (>48h old pending)
    ];

    const generateRefId = () => {
      let out = '';
      for (let i = 0; i < 14; i++) out += Math.floor(Math.random() * 10);
      return out;
    };

    const txRows = txData.map(tx => ({
      id: uuidv4(),
      userId: tx.userId,
      benificaryId: tx.benificaryId,
      amount: tx.amount,
      amountInPkr: tx.amountInPkr,
      status: tx.status,
      sourceOfFund: tx.sourceOfFund,
      sendingReason: tx.sendingReason,
      refId: generateRefId(),
      usiPaymentId: tx.usiPaymentId || null,
      usiStatus: tx.usiPaymentId ? 'completed' : 'not_initiated',
      volumeStatus: tx.status === 'completed' ? 'completed' : 'not_initiated',
      failureReason: tx.failureReason || null,
      failedAt: tx.failureReason ? daysAgo(tx.daysAgo) : null,
      createdAt: daysAgo(tx.daysAgo),
      updatedAt: daysAgo(tx.daysAgo)
    }));

    await queryInterface.bulkInsert('transactions', txRows);

    // ==================== MLRO FLAGS ====================
    await queryInterface.bulkInsert('MLROFlags', [
      {
        id: uuidv4(), userId: user2Id, type: 'suspicious_activity', severity: 'critical',
        title: 'High-value transaction pattern detected',
        description: 'Customer sent £1,200 in single transaction exceeding typical pattern. Previous average was £300. Requires immediate MLRO review.',
        status: 'pending', createdAt: daysAgo(5), updatedAt: daysAgo(5)
      },
      {
        id: uuidv4(), userId: user4Id, type: 'aml_flag', severity: 'high',
        title: 'Sanctions screening partial match',
        description: 'AML screening returned partial name match against sanctions list. Customer: Ayesha Begum. Match score: 72%. Manual verification required.',
        status: 'pending', createdAt: daysAgo(14), updatedAt: daysAgo(14)
      },
      {
        id: uuidv4(), userId: user1Id, type: 'suspicious_activity', severity: 'medium',
        title: 'Multiple transfers to same beneficiary in short period',
        description: 'Ahmed Khan made 3 transfers to Mohammad Khan within 7 days totaling £420. Pattern flagged by automated rules.',
        status: 'approved', notes: 'Reviewed - regular family support pattern consistent with profile.',
        createdAt: daysAgo(30), updatedAt: daysAgo(28)
      },
      {
        id: uuidv4(), userId: user6Id, type: 'kyc_issue', severity: 'medium',
        title: 'Address mismatch detected',
        description: 'KYC document shows address different from registered address. Document: 15 Park Lane, Cardiff. Registered: 10 Queen Street, Cardiff.',
        status: 'hold', notes: 'Requested additional proof of address from customer.',
        createdAt: daysAgo(8), updatedAt: daysAgo(6)
      },
      {
        id: uuidv4(), userId: user8Id, type: 'aml_flag', severity: 'low',
        title: 'PEP (Politically Exposed Person) association',
        description: 'Beneficiary Asad Sheikh shares name with a known PEP associate. Low confidence match. Routine review recommended.',
        status: 'rejected', notes: 'False positive - different individual confirmed via DOB and document verification.',
        createdAt: daysAgo(50), updatedAt: daysAgo(48)
      },
      {
        id: uuidv4(), userId: user2Id, type: 'kyc_issue', severity: 'high',
        title: 'Document expiry approaching',
        description: 'Customer passport expires in 30 days. KYC re-verification will be required. Proactive notification sent.',
        status: 'pending', createdAt: daysAgo(2), updatedAt: daysAgo(2)
      },
      {
        id: uuidv4(), userId: user7Id, type: 'kyc_issue', severity: 'high',
        title: 'KYC verification failed - expired document',
        description: 'Imran Qureshi submitted expired passport for KYC verification. Shufti Pro rejected verification. Customer notified to resubmit.',
        status: 'pending', createdAt: daysAgo(17), updatedAt: daysAgo(17)
      }
    ]);

    // ==================== SCREENING RESULTS ====================
    await queryInterface.bulkInsert('ScreeningResults', [
      {
        id: uuidv4(), userId: user1Id, isRemmiter: true,
        names: 'Ahmed Khan', dob: '1990-03-15', gender: 'male', fuzzy_search: 'true',
        totalHits: 0, message: 'No sanctions matches found', matched: false,
        createdAt: daysAgo(44), updatedAt: daysAgo(44)
      },
      {
        id: uuidv4(), userId: user2Id, isRemmiter: true,
        names: 'Fatima Ali', dob: '1988-07-22', gender: 'female', fuzzy_search: 'true',
        totalHits: 0, message: 'No sanctions matches found', matched: false,
        createdAt: daysAgo(89), updatedAt: daysAgo(89)
      },
      {
        id: uuidv4(), userId: user4Id, isRemmiter: true,
        names: 'Ayesha Begum', dob: '1992-01-18', gender: 'female', fuzzy_search: 'true',
        totalHits: 1, message: 'Partial match found - manual review required', matched: true,
        matchedRecord: JSON.stringify({ name: 'Ayesha B.', list: 'UN Consolidated', score: 72 }),
        createdAt: daysAgo(14), updatedAt: daysAgo(14)
      },
      {
        id: uuidv4(), userId: user8Id, isRemmiter: true,
        names: 'Zainab Sheikh', dob: '1993-12-05', gender: 'female', fuzzy_search: 'true',
        totalHits: 0, message: 'No sanctions matches found', matched: false,
        createdAt: daysAgo(73), updatedAt: daysAgo(73)
      }
    ]);

    console.log('✅ Sample data seeded successfully');
    console.log('   - 8 users (1 suspended, 1 incomplete registration, 1 KYC rejected)');
    console.log('   - 10 beneficiaries (1 RDA)');
    console.log('   - 25 transactions (various statuses)');
    console.log('   - 7 KYC requests');
    console.log('   - 7 MLRO flags (various severities and statuses)');
    console.log('   - 4 screening results');
  },

  async down(queryInterface, Sequelize) {
    // Remove in reverse order due to foreign keys
    await queryInterface.bulkDelete('ScreeningResults', null, {});
    await queryInterface.bulkDelete('MLROFlags', null, {});
    await queryInterface.bulkDelete('transactions', null, {});
    await queryInterface.bulkDelete('KycRequests', null, {});
    await queryInterface.bulkDelete('benificaries', null, {});
    await queryInterface.bulkDelete('Users', {
      phoneNumber: { [Sequelize.Op.like]: '+4477001000%' }
    }, {});
  }
};
