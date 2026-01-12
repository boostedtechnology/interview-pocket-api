import { buildApp } from './app.js';
import { config } from './config.js';

/**
 * Start the server
 * NOTE: Missing graceful shutdown handling (Issue #12)
 */
async function start(): Promise<void> {
  const app = await buildApp();

  try {
    await app.listen({
      port: config.port,
      host: config.host,
    });

    console.log(`Server running on http://${config.host}:${config.port}`);
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

start();
