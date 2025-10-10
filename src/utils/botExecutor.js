let executionInterval = null;
let isExecuting = false;

export function startBotExecutor() {
  if (executionInterval) {
    return;
  }

  console.log('🤖 Starting bot executor service...');

  const executeNow = async () => {
    if (isExecuting) {
      return;
    }

    try {
      isExecuting = true;
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bot-executor`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.executed > 0) {
          console.log(`✅ Bot executor: ${data.executed} trade(s) executed`);
          window.dispatchEvent(new CustomEvent('tokenUpdate'));
        } else {
          console.log('🤖 Bot executor: No trades ready');
        }
      } else {
        const errorText = await response.text();
        console.error('❌ Bot executor error:', errorText);
      }
    } catch (error) {
      console.error('❌ Bot executor error:', error);
    } finally {
      isExecuting = false;
    }
  };

  executeNow();

  executionInterval = setInterval(executeNow, 10000);

  console.log('✅ Bot executor service started (runs every 10 seconds)');
}

export function stopBotExecutor() {
  if (executionInterval) {
    clearInterval(executionInterval);
    executionInterval = null;
    console.log('⏹️ Bot executor service stopped');
  }
}

export function isBotExecutorRunning() {
  return executionInterval !== null;
}
