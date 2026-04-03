/**
 * WalletManager — MetaMask integration (ported from wallet-utils.js)
 */
export class WalletManager {
  constructor(chainConfig = null) {
    this.address = null;
    this.chainConfig = chainConfig;
    this.chainId = chainConfig?.chain_id ?? null;
    this.connected = false;
  }

  isMetaMaskInstalled() {
    return typeof window.ethereum !== 'undefined';
  }

  async connect() {
    if (!this.isMetaMaskInstalled()) {
      throw new Error('MetaMask is not installed. Please install MetaMask to continue.');
    }
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    this.address = accounts[0];
    this.connected = true;

    const chainId = await window.ethereum.request({ method: 'eth_chainId' });
    if (parseInt(chainId, 16) !== this.chainId) {
      await this.switchNetwork();
    }

    window.ethereum.on('accountsChanged', () => window.location.reload());
    window.ethereum.on('chainChanged', () => window.location.reload());

    return this.address;
  }

  async switchNetwork() {
    if (!this.chainConfig) throw new Error('Chain configuration not loaded');
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: this.chainConfig.chain_id_hex }],
      });
    } catch (err) {
      if (err.code === 4902) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: this.chainConfig.chain_id_hex,
            chainName: this.chainConfig.chain_name,
            nativeCurrency: this.chainConfig.native_currency,
            rpcUrls: this.chainConfig.rpc_urls,
            blockExplorerUrls: this.chainConfig.block_explorer_urls,
          }],
        });
      } else {
        throw new Error('Failed to switch network: ' + err.message);
      }
    }
  }

  async sendTransaction(toAddress, amountInEth) {
    if (!this.connected) throw new Error('Wallet not connected');
    const amountInWei = '0x' + BigInt(Math.floor(amountInEth * 1e18)).toString(16);
    const txHash = await window.ethereum.request({
      method: 'eth_sendTransaction',
      params: [{ from: this.address, to: toAddress, value: amountInWei }],
    });
    return txHash;
  }

  async getBalance(address) {
    const balance = await window.ethereum.request({
      method: 'eth_getBalance',
      params: [address, 'latest'],
    });
    return parseInt(balance, 16) / 1e18;
  }

  disconnect() {
    this.address = null;
    this.connected = false;
  }
}
