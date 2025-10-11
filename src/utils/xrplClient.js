import * as xrpl from 'xrpl';

const XRPL_SERVERS = [
  { url: 'wss://xrplcluster.com', name: 'XRPL Cluster' },
  { url: 'wss://ancient-stylish-snowflake.xrp-mainnet.quiknode.pro/4e504cf032eb3a85a185ec069480a11363600a96', name: 'MEMEKINGS NODE' },
  { url: 'wss://s1.ripple.com', name: 'Ripple S1' },
  { url: 'wss://s2.ripple.com', name: 'Ripple S2' },
  { url: 'wss://xrpl.ws', name: 'XRPL.ws' }
];

let currentServerIndex = 0;
let sharedClient = null;
let connectionAttempts = 0;
const MAX_CONNECTION_ATTEMPTS = 3;
let manualServerIndex = null;

class XRPLClientManager {
  constructor() {
    this.client = null;
    this.connecting = false;
    this.serverIndex = 0;
  }

  getNextServer() {
    this.serverIndex = (this.serverIndex + 1) % XRPL_SERVERS.length;
    return XRPL_SERVERS[this.serverIndex];
  }

  async connect() {
    if (this.client && this.client.isConnected()) {
      return this.client;
    }

    if (this.connecting) {
      await new Promise(resolve => setTimeout(resolve, 100));
      return this.connect();
    }

    this.connecting = true;

    try {
      const useIndex = manualServerIndex !== null ? manualServerIndex : this.serverIndex;
      const server = XRPL_SERVERS[useIndex];
      this.client = new xrpl.Client(server.url);

      await Promise.race([
        this.client.connect(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Connection timeout')), 10000)
        )
      ]);

      console.log(`✅ Connected to ${server.name}`);
      this.connecting = false;
      return this.client;
    } catch (error) {
      this.connecting = false;
      const useIndex = manualServerIndex !== null ? manualServerIndex : this.serverIndex;
      console.error(`Failed to connect to ${XRPL_SERVERS[useIndex].name}:`, error.message);

      if (manualServerIndex === null) {
        const nextServer = this.getNextServer();
        console.log(`Switching to ${nextServer.name}`);
        return this.connect();
      } else {
        throw new Error(`Failed to connect to selected node: ${XRPL_SERVERS[useIndex].name}`);
      }
    }
  }

  async disconnect() {
    if (this.client && this.client.isConnected()) {
      try {
        await this.client.disconnect();
      } catch (error) {
        console.error('Error disconnecting:', error);
      }
      this.client = null;
    }
  }

  isConnected() {
    return this.client && this.client.isConnected();
  }
}

const clientManager = new XRPLClientManager();

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function withRetry(operation, maxRetries = 5, initialDelay = 1000) {
  let lastError;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const client = await clientManager.connect();
      const result = await operation(client);
      return result;
    } catch (error) {
      lastError = error;

      const isRateLimit =
        error.message?.includes('rate') ||
        error.message?.includes('limit') ||
        error.message?.includes('Too many') ||
        error.data?.error === 'slowDown' ||
        error.data?.error === 'tooBusy';

      const isNetworkError =
        error.message?.includes('timeout') ||
        error.message?.includes('disconnect') ||
        error.message?.includes('WebSocket') ||
        !clientManager.isConnected();

      if (isRateLimit || isNetworkError) {
        const delay = initialDelay * Math.pow(2, attempt);
        const jitter = Math.random() * 1000;
        const totalDelay = delay + jitter;

        console.log(`Rate limit or network error detected. Retry ${attempt + 1}/${maxRetries} after ${Math.round(totalDelay)}ms`);

        if (isNetworkError) {
          await clientManager.disconnect();
        }

        await sleep(totalDelay);
        continue;
      }

      throw error;
    }
  }

  throw new Error(`Max retries (${maxRetries}) exceeded. Last error: ${lastError.message}`);
}

export async function getClient() {
  return clientManager.connect();
}

export async function disconnectClient() {
  return clientManager.disconnect();
}

export async function requestWithRetry(command, maxRetries = 5) {
  return withRetry(async (client) => {
    return await client.request(command);
  }, maxRetries);
}

export async function submitWithRetry(transaction, wallet, maxRetries = 5) {
  return withRetry(async (client) => {
    return await client.submitAndWait(transaction, { wallet });
  }, maxRetries);
}

export async function autofillWithRetry(transaction, maxRetries = 5) {
  return withRetry(async (client) => {
    return await client.autofill(transaction);
  }, maxRetries);
}

export function getAvailableServers() {
  return XRPL_SERVERS;
}

export function getCurrentServer() {
  const useIndex = manualServerIndex !== null ? manualServerIndex : clientManager.serverIndex;
  return XRPL_SERVERS[useIndex];
}

export async function setManualServer(index) {
  if (index < 0 || index >= XRPL_SERVERS.length) {
    throw new Error('Invalid server index');
  }

  manualServerIndex = index;
  localStorage.setItem('selectedNodeIndex', index.toString());

  await clientManager.disconnect();

  window.dispatchEvent(new CustomEvent('networkChanged', {
    detail: XRPL_SERVERS[index]
  }));
}

export function clearManualServer() {
  manualServerIndex = null;
  localStorage.removeItem('selectedNodeIndex');
}

export function loadSavedServer() {
  const saved = localStorage.getItem('selectedNodeIndex');
  if (saved !== null) {
    const index = parseInt(saved, 10);
    if (index >= 0 && index < XRPL_SERVERS.length) {
      manualServerIndex = index;
      return XRPL_SERVERS[index];
    }
  }
  return null;
}

export { XRPL_SERVERS };
