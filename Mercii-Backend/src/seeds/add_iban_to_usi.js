require('dotenv').config();
const db = require('../models');
const { MODELS } = require('../utils/constants');
const { makeUSIRequest } = require('../services/usi');
const { Op } = require('sequelize');

/**
 * Script to add IBAN to USI beneficiaries that are missing benef_bank_iban
 * 
 * This script:
 * 1. Gets all beneficiaries where USIbeneficiaryId is not null and iban is not empty
 * 2. For each beneficiary, calls searchBeneficiary to get current USI data
 * 3. Checks if benef_bank_iban exists in the response
 * 4. If not present, calls updateBeneficiary with beneficiary_id and benef_bank_iban
 */
async function addIbanToUSI() {
  try {
    console.log('Starting script to add IBAN to USI beneficiaries...\n');


    // Get all beneficiaries where USIbeneficiaryId is not null, iban is not empty, and deliveryMethod is 'account'
    
    const beneficiaries = await db[MODELS.BENIFICARY].findAll({
      where: {
        USIbeneficiaryId: { [Op.ne]: null },
        iban: { [Op.ne]: null, [Op.ne]: '', [Op.startsWith]: 'PK' },
        [Op.and]: [
          db.sequelize.where(
            db.sequelize.fn('LOWER', db.sequelize.col('deliveryMethod')),
            'account'
          )
        ]
      }
    });

    console.log(`Found ${beneficiaries.length} beneficiaries to process\n`);

    let processed = 0;
    let updated = 0;
    let errors = 0;

    for (const beneficiary of beneficiaries) {
      try {
        processed++;
        console.log(`\n[${processed}/${beneficiaries.length}] Processing beneficiary ID: ${beneficiary.id}`);
        console.log(`  - USIbeneficiaryId: ${beneficiary.USIbeneficiaryId}`);
        console.log(`  - IBAN: ${beneficiary.iban}`);
        console.log(`  - Name: ${beneficiary.fName}`);

        // Get the user to access remitoneCustomerId for search
        const user = await db[MODELS.USER].findByPk(beneficiary.userId);
        if (!user || !user.remitoneCustomerId) {
          console.log(`  ⚠️  Skipping: User or remitoneCustomerId not found`);
          continue;
        }

        // Prepare search data
        const searchData = {
          linked_remitter_id: user.remitoneCustomerId,
          country: 'Pakistan',
          name: beneficiary.fName,
          mobile: beneficiary.contactNo,
          account_number: beneficiary.iban,
          benef_bank_iban: beneficiary.iban,
          bank: beneficiary.bankName,
        };

        // Call searchBeneficiary
        console.log(`  🔍 Searching beneficiary in USI...`);
        const searchResp = await makeUSIRequest("beneficiary", "searchBeneficiary", searchData);

        if (!searchResp.success) {
          console.log(`  ❌ Search failed: ${searchResp.errorMessage || 'Unknown error'}`);
          errors++;
          continue;
        }

        // Extract beneficiary from response
        const result = searchResp.result.result;
        
        // Handle different response structures
        let beneficiaryItem = null;
        const usiBeneficiaries = result?.beneficiaries;
        if (usiBeneficiaries) {
          // usiBeneficiaries could be an object with beneficiary property, or an array
          if (Array.isArray(usiBeneficiaries)) {
            // If usiBeneficiaries is an array, get the first one
            beneficiaryItem = usiBeneficiaries[0]?.beneficiary || usiBeneficiaries[0];
          } else if (usiBeneficiaries.beneficiary) {
            // If usiBeneficiaries.beneficiary exists
            if (Array.isArray(usiBeneficiaries.beneficiary)) {
              // If beneficiary is an array, get the first one
              beneficiaryItem = usiBeneficiaries.beneficiary[0];
            } else {
              // If beneficiary is a single object
              beneficiaryItem = usiBeneficiaries.beneficiary;
            }
          }
        }
        
        if (!beneficiaryItem) {
          console.log(`  ⚠️  No beneficiary found in USI response`);
          console.log(`  Debug - result structure:`, JSON.stringify(result, null, 2));
          errors++;
          continue;
        }
        
        // Check if benef_bank_iban exists
        const hasBenefBankIban = beneficiaryItem?.benef_bank_iban || beneficiaryItem?.benef_bank_iban_code;
        
        if (hasBenefBankIban) {
          console.log(`  ✅ benef_bank_iban already exists: ${hasBenefBankIban}`);
          continue;
        }

        // If benef_bank_iban is not present, update it
        console.log(`  📝 benef_bank_iban not found, updating...`);
        
        const updateData = {
          beneficiary_id: beneficiary.USIbeneficiaryId,
          benef_bank_iban: beneficiary.iban
        };

        const updateResp = await makeUSIRequest("beneficiary", "updateBeneficiary", updateData);

        if (!updateResp.success) {
          console.log(`  ❌ Update failed: ${updateResp.errorMessage || 'Unknown error'}`);
          errors++;
          continue;
        }

        console.log(`  ✅ Successfully updated with benef_bank_iban: ${beneficiary.iban}`);
        updated++;

      } catch (error) {
        errors++;
        console.error(`  ❌ Error processing beneficiary ${beneficiary.id}:`, error.message);
      }
    }

    console.log(`\n\n=== Summary ===`);
    console.log(`Total beneficiaries processed: ${processed}`);
    console.log(`Successfully updated: ${updated}`);
    console.log(`Errors: ${errors}`);
    console.log(`\nScript completed!`);

  } catch (error) {
    console.error('Fatal error:', error);
    throw error;
  } finally {
    // Close database connection
    await db.sequelize.close();
  }
}

// Run the script
if (require.main === module) {
  addIbanToUSI()
    .then(() => {
      console.log('\nScript finished successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\nScript failed:', error);
      process.exit(1);
    });
}

module.exports = { addIbanToUSI };

