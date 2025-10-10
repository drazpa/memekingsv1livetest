let executionInterval = null;
let isExecuting = false;

export function startBotExecutor() {
  if (executionInterval) {
    return;
  }

  console.log('🤖 Starting bot executor service...');

  const executeNow = async () => {
    if (isExecuting) {
      console.log('⏳ Bot execution already in progress, skipping...');
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
          console.log(`✅ Bot executor: ${data.executed} trades executed`);
        }
      } else {
        console.error('❌ Bot executor error:', await response.text());
      }
    } catch (error) {
      console.error('❌ Bot executor error:', error);
    } finally {
      isExecuting = false;
    }
  };

  executeNow();

  executionInterval = setInterval(executeNow, 30000);

  console.log('✅ Bot executor service started (runs every 30 seconds)');
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
