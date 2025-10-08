const TOKEN_UPDATED_EVENT = 'token-updated';

export const emitTokenUpdate = (tokenId) => {
  const event = new CustomEvent(TOKEN_UPDATED_EVENT, {
    detail: { tokenId, timestamp: Date.now() }
  });
  window.dispatchEvent(event);
};

export const onTokenUpdate = (callback) => {
  const handler = (event) => callback(event.detail);
  window.addEventListener(TOKEN_UPDATED_EVENT, handler);
  return () => window.removeEventListener(TOKEN_UPDATED_EVENT, handler);
};
