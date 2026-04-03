/** Format ETH amount to 4 decimal places */
export const formatEth = (amount) => parseFloat(amount || 0).toFixed(4);

/** Shorten an Ethereum address: 0x1234...abcd */
export const formatAddress = (address) => {
  if (!address) return '';
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
};

/** Shorten a tx hash */
export const formatTxHash = (txHash) => {
  if (!txHash) return '';
  const h = txHash.startsWith('0x') ? txHash : '0x' + txHash;
  return `${h.substring(0, 10)}...${h.substring(h.length - 8)}`;
};

/** Build block explorer URL for a transaction */
export const getExplorerUrl = (txHash, explorerBaseUrl) => {
  if (!txHash || !explorerBaseUrl) return '#';
  const h = txHash.startsWith('0x') ? txHash : '0x' + txHash;
  return `${explorerBaseUrl}/tx/${h}`;
};

/** Copy text to clipboard */
export const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
};
