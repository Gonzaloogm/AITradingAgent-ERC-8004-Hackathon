import { ethers } from 'ethers';

/**
 * WalletManager — MetaMask integration using ethers.js v6
 */
export class WalletManager {
  constructor(chainConfig = null) {
    this.provider = null;
    this.signer = null;
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

    // Initialize ethers provider from window.ethereum
    this.provider = new ethers.BrowserProvider(window.ethereum);
    
    // Request accounts
    const accounts = await this.provider.send("eth_requestAccounts", []);
    this.signer = await this.provider.getSigner();
    this.address = await this.signer.getAddress();
    this.connected = true;

    // Check network
    const network = await this.provider.getNetwork();
    if (Number(network.chainId) !== this.chainId) {
      await this.switchNetwork();
      // Re-initialize after network switch to be safe
      this.provider = new ethers.BrowserProvider(window.ethereum);
      this.signer = await this.provider.getSigner();
    }

    // Listen for changes
    window.ethereum.on('accountsChanged', () => window.location.reload());
    window.ethereum.on('chainChanged', () => window.location.reload());

    return this.address;
  }

  async switchNetwork() {
    if (!this.chainConfig) throw new Error('Chain configuration not loaded');
    
    const chainIdHex = `0x${this.chainId.toString(16)}`;
    
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: chainIdHex }],
      });
    } catch (err) {
      if (err.code === 4902) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: chainIdHex,
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
    if (!this.connected || !this.signer) throw new Error('Wallet not connected');

    try {
      const tx = await this.signer.sendTransaction({
        to: toAddress,
        value: ethers.parseEther(amountInEth.toString())
      });
      
      return tx.hash;
    } catch (error) {
      console.error("[WalletManager] Send error:", error);
      throw error;
    }
  }

  async getBalance(address) {
    if (!this.provider) {
       this.provider = new ethers.BrowserProvider(window.ethereum);
    }
    const balance = await this.provider.getBalance(address);
    return ethers.formatEther(balance);
  }

  disconnect() {
    this.address = null;
    this.signer = null;
    this.connected = false;
  }
}
