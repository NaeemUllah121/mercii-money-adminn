const transformTransaction = (transaction) => {
  if (!transaction) return null;

  const txData = transaction.toJSON ? transaction.toJSON() : transaction;
  const beneficiary = txData.benificary;

  const transformed = {
    id: txData.id,
    benificaryId: txData.benificaryId,
    amount: txData.amount,
    amountInPkr: txData.amountInPkr,
    sourceOfFund: txData.sourceOfFund,
    refId: txData.refId,
    sendingReason: txData.sendingReason,
    status: txData.status,
    volumeStatus: txData.volumeStatus,
    usiStatus: txData.usiStatus,
    createdAt: txData.createdAt,
    volumeCompletedAt: txData.volumeCompletedAt,
    usiCompletedAt: txData.usiCompletedAt,
  };

  if (beneficiary) {
    transformed.beneficiaryName = beneficiary.fName;
    transformed.beneficiaryBank = beneficiary.bankName;
    transformed.beneficiaryIban = beneficiary.iban;
    transformed.deliveryMethod = beneficiary.deliveryMethod;
    
    if (!beneficiary.fName && txData.usiResponse?.result?.beneficiary_name) {
      transformed.usiBeneficiaryName = txData.usiResponse.result.beneficiary_name;
    }
  }

  if (txData.status === 'failed' || txData.volumeStatus === 'failed' || txData.usiStatus === 'ERROR' || txData.usiStatus === 'DELETED') {
    if (txData.failureReason) {
      transformed.failureReason = txData.failureReason;
    }
  }

  if (txData.deliveryMethod === 'Cash Collection' || beneficiary?.deliveryMethod === 'Cash Collection') {
    if (txData.collection_point_id) {
      transformed.collection_point_id = txData.collection_point_id;
    }
    if (txData.collection_point) {
      transformed.collection_point = txData.collection_point;
    }
    if (txData.collection_point_address) {
      transformed.collection_point_address = txData.collection_point_address;
    }
    if (txData.collection_point_city) {
      transformed.collection_point_city = txData.collection_point_city;
    }
  }

  return transformed;
};

const transformTransactions = (transactions) => {
  if (!transactions) return [];
  if (Array.isArray(transactions)) {
    return transactions.map(transformTransaction);
  }
  return transformTransaction(transactions);
};

module.exports = {
  transformTransaction,
  transformTransactions
};
