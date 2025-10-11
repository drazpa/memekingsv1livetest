const DB_NAME = 'TokenImageCache';
const DB_VERSION = 1;
const STORE_NAME = 'images';
const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000;

class ImageCacheManager {
  constructor() {
    this.db = null;
    this.memoryCache = new Map();
    this.initDB();
  }

  async initDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.warn('IndexedDB not available, using memory cache only');
        resolve(null);
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'url' });
          objectStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  async get(url) {
    if (this.memoryCache.has(url)) {
      return this.memoryCache.get(url);
    }

    if (!this.db) return null;

    return new Promise((resolve) => {
      try {
        const transaction = this.db.transaction([STORE_NAME], 'readonly');
        const objectStore = transaction.objectStore(STORE_NAME);
        const request = objectStore.get(url);

        request.onsuccess = () => {
          const result = request.result;
          if (result) {
            const age = Date.now() - result.timestamp;
            if (age < CACHE_DURATION) {
              this.memoryCache.set(url, result.data);
              resolve(result.data);
            } else {
              this.delete(url);
              resolve(null);
            }
          } else {
            resolve(null);
          }
        };

        request.onerror = () => resolve(null);
      } catch (error) {
        console.warn('Error reading from cache:', error);
        resolve(null);
      }
    });
  }

  async set(url, data) {
    this.memoryCache.set(url, data);

    if (!this.db) return;

    return new Promise((resolve) => {
      try {
        const transaction = this.db.transaction([STORE_NAME], 'readwrite');
        const objectStore = transaction.objectStore(STORE_NAME);
        const request = objectStore.put({
          url,
          data,
          timestamp: Date.now()
        });

        request.onsuccess = () => resolve(true);
        request.onerror = () => resolve(false);
      } catch (error) {
        console.warn('Error writing to cache:', error);
        resolve(false);
      }
    });
  }

  async delete(url) {
    this.memoryCache.delete(url);

    if (!this.db) return;

    return new Promise((resolve) => {
      try {
        const transaction = this.db.transaction([STORE_NAME], 'readwrite');
        const objectStore = transaction.objectStore(STORE_NAME);
        const request = objectStore.delete(url);

        request.onsuccess = () => resolve(true);
        request.onerror = () => resolve(false);
      } catch (error) {
        resolve(false);
      }
    });
  }

  async clear() {
    this.memoryCache.clear();

    if (!this.db) return;

    return new Promise((resolve) => {
      try {
        const transaction = this.db.transaction([STORE_NAME], 'readwrite');
        const objectStore = transaction.objectStore(STORE_NAME);
        const request = objectStore.clear();

        request.onsuccess = () => resolve(true);
        request.onerror = () => resolve(false);
      } catch (error) {
        resolve(false);
      }
    });
  }

  async cleanOldEntries() {
    if (!this.db) return;

    return new Promise((resolve) => {
      try {
        const cutoffTime = Date.now() - CACHE_DURATION;
        const transaction = this.db.transaction([STORE_NAME], 'readwrite');
        const objectStore = transaction.objectStore(STORE_NAME);
        const index = objectStore.index('timestamp');
        const range = IDBKeyRange.upperBound(cutoffTime);
        const request = index.openCursor(range);

        request.onsuccess = (event) => {
          const cursor = event.target.result;
          if (cursor) {
            cursor.delete();
            cursor.continue();
          } else {
            resolve(true);
          }
        };

        request.onerror = () => resolve(false);
      } catch (error) {
        resolve(false);
      }
    });
  }
}

export const imageCacheManager = new ImageCacheManager();

export const preloadImage = (url) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(url);
    img.onerror = reject;
    img.src = url;
  });
};

export const extractIpfsHash = (url) => {
  if (!url) return null;

  if (url.startsWith('ipfs://')) {
    return url.replace('ipfs://', '');
  }

  const ipfsMatch = url.match(/\/ipfs\/([a-zA-Z0-9]+)/);
  if (ipfsMatch) {
    return ipfsMatch[1];
  }

  const ipfsHashMatch = url.match(/\/(Qm[a-zA-Z0-9]{44}|bafyb[a-zA-Z0-9]{50,})/);
  if (ipfsHashMatch) {
    return ipfsHashMatch[1];
  }

  if (!url.startsWith('http')) {
    return url;
  }

  return null;
};

export const normalizeImageUrl = (url) => {
  if (!url) return null;

  if (url.startsWith('http://')) {
    return url.replace('http://', 'https://');
  }

  return url;
};
