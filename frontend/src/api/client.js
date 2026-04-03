/**
 * API Client — ported from wallet-utils.js
 */
export class APIClient {
  constructor(baseURL = '') {
    this.baseURL = baseURL;
  }

  async request(endpoint, options = {}) {
    try {
      const response = await fetch(this.baseURL + endpoint, {
        ...options,
        headers: { 'Content-Type': 'application/json', ...options.headers },
      });
      const data = await response.json();
      if (!response.ok) {
        const msg = data.detail || data.error || `HTTP ${response.status}`;
        throw new Error(msg);
      }
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message || 'Unknown error' };
    }
  }

  get(endpoint)           { return this.request(endpoint, { method: 'GET' }); }
  post(endpoint, body={}) { return this.request(endpoint, { method: 'POST', body: JSON.stringify(body) }); }

  getChainConfig()               { return this.get('/api/chain-config'); }
  getWallet()                    { return this.get('/api/wallet'); }
  getStatus()                    { return this.get('/api/status'); }
  registerAgent()                { return this.post('/api/register'); }
  signMessage(message)           { return this.post('/api/sign', { message }); }
  getAttestation()               { return this.get('/api/attestation'); }
  getTransactionStatus(txHash)   { return this.get(`/api/transaction/${txHash}/status`); }
  submitInitialReputation()      { return this.post('/api/reputation/submit-initial'); }
  getReputation(agentId = null)  { return this.get(agentId ? `/api/reputation/${agentId}` : '/api/reputation'); }
  getAgentCard()                 { return this.get('/agent.json'); }

  async sendChatMessage(sessionId, message) {
    return this.post('/api/chat', { session_id: sessionId, message });
  }

  async newChatSession() {
    return this.post('/api/session/new');
  }

  async getChatHistory(sessionId) {
    return this.get(`/api/session/${sessionId}/history`);
  }

  async quickAction(sessionId, tool, args = {}) {
    return this.post('/api/quick-action', { session_id: sessionId, tool, arguments: args });
  }
}

export const apiClient = new APIClient();
