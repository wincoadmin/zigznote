import { createServer } from 'http';
import { createApp } from './app';
import { config } from './config';
import { logger } from './utils/logger';
import { validateEnvironment, getCurrentPhase } from '@zigznote/shared';
import { initWebSocketServer, closeWebSocketServer } from './websocket';

// Validate environment variables before starting
validateEnvironment(getCurrentPhase());

const app = createApp();

// Create HTTP server to share with Socket.IO
const httpServer = createServer(app);

// Initialize WebSocket server
initWebSocketServer(httpServer);

const server = httpServer.listen(config.port, () => {
  logger.info(`Server running on port ${config.port}`);
  logger.info(`Environment: ${config.nodeEnv}`);
  logger.info('WebSocket server initialized');
});

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await closeWebSocketServer();
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await closeWebSocketServer();
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('uncaughtException', (error) => {
  logger.error({ error }, 'Uncaught exception');
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled rejection');
  process.exit(1);
});

export { app };
