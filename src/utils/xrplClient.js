import * as xrpl from 'xrpl';

const XRPL_SERVERS = [
  'wss://xrplcluster.com',
  'wss://s1.ripple.com',
  'wss://s2.ripple.com',
  'wss://xrpl.ws'
];

let currentServerIndex = 0;
let sharedClient = null;
let connectionAttempts = 0;
const MAX_CONNECTION_ATTEMPTS = 3;

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
      const server = XRPL_SERVERS[this.serverIndex];
      this.client = new xrpl.Client(server);

      await Promise.race([
        this.client.connect(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Connection timeout')), 10000)
        )
      ]);

      this.connecting = false;
      return this.client;
    } catch (error) {
      this.connecting = false;
      console.error(`Failed to connect to ${XRPL_SERVERS[this.serverIndex]}:`, error.message);

      const nextServer = this.getNextServer();
      console.log(`Switching to ${nextServer}`);

      return this.connect();
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

export { XRPL_SERVERS };
