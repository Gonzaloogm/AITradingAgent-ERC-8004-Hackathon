import { ethers } from 'ethers';

/**
 * WalletManager — MetaMask integration using ethers.js v6 with Session Management
 */
export class WalletManager {
  constructor(chainConfig = null) {
    this.provider = null;
    this.signer = null;
    this.address = null;
    this.chainConfig = chainConfig;
    this.chainId = chainConfig?.chain_id ?? null;
    this.connected = false;
    
    // Auto-setup listeners if window.ethereum is available
    if (typeof window !== 'undefined' && window.ethereum) {
      window.ethereum.on('accountsChanged', (accounts) => {
        console.log('[WalletManager] Accounts changed, reloading...');
        if (accounts.length === 0) {
          localStorage.removeItem('isWalletConnected');
        }
        window.location.reload();
      });
      
      window.ethereum.on('chainChanged', () => {
        console.log('[WalletManager] Chain changed, reloading...');
        window.location.reload();
      });
    }
  }

  isMetaMaskInstalled() {
    return typeof window.ethereum !== 'undefined';
  }

  /** Check if we have a persisted session */
  shouldAutoConnect() {
    return localStorage.getItem('isWalletConnected') === 'true';
  }

  async connect() {
    if (!this.isMetaMaskInstalled()) {
      throw new Error('MetaMask is not installed. Please install MetaMask to continue.');
    }

    try {
      // Initialize ethers provider from window.ethereum
      this.provider = new ethers.BrowserProvider(window.ethereum);
      
      // Request accounts
      const accounts = await this.provider.send("eth_requestAccounts", []);
      if (accounts.length === 0) throw new Error("No accounts found");

      this.signer = await this.provider.getSigner();
      this.address = await this.signer.getAddress();
      this.connected = true;

      // Persistence
      localStorage.setItem('isWalletConnected', 'true');

      // Check network
      const network = await this.provider.getNetwork();
      if (this.chainId && Number(network.chainId) !== this.chainId) {
        await this.switchNetwork();
        // Re-initialize after network switch to be safe
        this.provider = new ethers.BrowserProvider(window.ethereum);
      }

      return this.address;
    } catch (err) {
      console.error("[WalletManager] Connection failed:", err);
      localStorage.removeItem('isWalletConnected');
      throw err;
    }
  }

  async switchNetwork() {
    if (!this.chainConfig) return;
    
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
    if (!this.provider) {
       this.provider = new ethers.BrowserProvider(window.ethereum);
    }

    try {
      // Always get FRESH signer
      const currentSigner = await this.provider.getSigner();
      const fromAddress = await currentSigner.getAddress();
      
      if (fromAddress.toLowerCase() === toAddress.toLowerCase()) {
        throw new Error("Self-Funding Error: You have the agent's account selected in MetaMask. Please switch to your personal account.");
      }

      const tx = await currentSigner.sendTransaction({
        to: toAddress,
        value: ethers.parseEther(amountInEth.toString())
      });
      
      return tx.hash;
    } catch (error) {
      console.error("[WalletManager] Transaction error:", error);
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
    localStorage.removeItem('isWalletConnected');
  }
}
