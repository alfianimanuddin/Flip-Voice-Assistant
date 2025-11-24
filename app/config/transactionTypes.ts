// Configuration for enabling/disabling transaction types
// Set to true to enable, false to disable

export const transactionTypeConfig = {
  transfer: true,  // Bank transfer
  ewallet: true,   // E-wallet top up (GoPay, OVO, DANA, etc.)
  pulsa: true,     // Mobile phone credit
  token: true,     // PLN electricity token
  gold: false,      // Digital gold purchase
  sedekah: false,   // Donation/charity
}

export type TransactionType = keyof typeof transactionTypeConfig

export const getEnabledTypes = (): TransactionType[] => {
  return (Object.keys(transactionTypeConfig) as TransactionType[])
    .filter(type => transactionTypeConfig[type])
}

export const isTypeEnabled = (type: string): boolean => {
  return transactionTypeConfig[type as TransactionType] ?? false
}
