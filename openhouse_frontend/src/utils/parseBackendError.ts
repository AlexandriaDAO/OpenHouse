/**
 * Parse backend error messages into user-friendly format.
 * Shared across all game pages for consistent error handling.
 */
export function parseBackendError(errorMsg: string): string {
  if (errorMsg.startsWith('INSUFFICIENT_BALANCE|')) {
    const parts = errorMsg.split('|');
    const userBalance = parts[1] || 'Unknown balance';
    const betAmountStr = parts[2] || 'Unknown bet';
    return `INSUFFICIENT CHIPS - BET NOT PLACED\n\n` +
      `${userBalance}\n` +
      `${betAmountStr}\n\n` +
      `${parts[3] || 'This bet was not placed and no funds were deducted.'}\n\n` +
      `Click "Buy Chips" below to add more USDT.`;
  }
  if (errorMsg.includes('exceeds house limit') || errorMsg.includes('house balance')) {
    return `BET REJECTED - NO MONEY LOST\n\n` +
      `The house doesn't have enough funds to cover this bet's potential payout. ` +
      `Try lowering your bet or changing odds.`;
  }
  if (errorMsg.includes('Randomness seed initializing')) {
    return `WARMING UP - PLEASE WAIT\n\n` +
      `The randomness generator is initializing (happens once after updates). ` +
      `Please try again in a few seconds. No funds were deducted.`;
  }
  if (errorMsg.includes('timed out') || errorMsg.includes('504') || errorMsg.includes('Gateway')) {
    return `NETWORK TIMEOUT - YOUR FUNDS ARE SAFE\n\n` +
      `The network was slow to respond. This does NOT affect your money.\n\n` +
      `• If the bet wasn't processed: your balance is unchanged\n` +
      `• If the bet was processed: the result is already applied\n\n` +
      `Refresh the page to see your current balance.`;
  }
  return errorMsg;
}
