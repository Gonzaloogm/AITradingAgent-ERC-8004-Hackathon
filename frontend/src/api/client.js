/**
 * API Client — ported from wallet-utils.js
 */
const PHALA_URL = 'https://d571a329e5081e0d1b8fd65773ba0cd84e9e3457-8000.dstack-pha-prod9.phala.network';

export class APIClient {
  constructor() {
    this.baseURL = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' ? 'http://localhost:8000' : '');
  }

  async request(endpoint, options = {}) {
    try {
      const response = await fetch(this.baseURL + endpoint, {
        ...options,
        headers: { 'Content-Type': 'application/json', ...options.headers },
      });

      // Handle empty responses to prevent "Unexpected end of JSON input"
      const text = await response.text();
      let data = {};
      if (text) {
        try {
          data = JSON.parse(text);
        } catch (e) {
          console.warn(`[API] Malformed JSON or Non-JSON response: ${text.slice(0, 100)}`);
          // Fallback to empty object to prevent crash, but log for debugging
          data = { _raw: text };
        }
      } else if (response.ok && response.status !== 204) {
        // Expected data but got empty body - return success with empty object or custom signaling
        return { success: true, data: {}, note: 'Empty response' };
      }

      if (!response.ok) {
        const msg = data.detail || data.error || `HTTP ${response.status}`;
        throw new Error(msg);
      }
      return { success: true, data };
    } catch (error) {
      console.error(`[API] ${endpoint} failed:`, error);
      return { success: false, error: error.message || 'Unknown error' };
    }
  }

  get(endpoint) { return this.request(endpoint, { method: 'GET' }); }
  post(endpoint, body = {}) { return this.request(endpoint, { method: 'POST', body: JSON.stringify(body) }); }

  getChainConfig() { return this.get('/api/chain-config'); }
  getWallet() { return this.get('/api/wallet'); }
  getStatus() { return this.get('/api/status'); }
  registerAgent() { return this.post('/api/register'); }
  signMessage(message) { return this.post('/api/sign', { message }); }
  getAttestation() { return this.get('/api/attestation'); }
  getTransactionStatus(txHash) { return this.get(`/api/transaction/${txHash}/status`); }
  submitInitialReputation() { return this.post('/api/reputation/submit-initial'); }
  getReputation(agentId = null) { return this.get(agentId ? `/api/reputation/${agentId}` : '/api/reputation'); }
  getAgentCard() { return this.get('/agent.json'); }
  getAgentState() { return this.get('/api/agent-state'); }

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

  startStrategy() { return this.post('/api/strategy/start'); }
  stopStrategy() { return this.post('/api/strategy/stop'); }
}

export const apiClient = new APIClient();
