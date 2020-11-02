import fastify, { FastifyInstance, FastifyPluginOptions, FastifyReply, FastifyRequest, RequestGenericInterface } from 'fastify';
import routes from './http';
import { Server, IncomingMessage, ServerResponse } from 'http';
import io from 'socket.io';
import { initializeWebSocketServer, initializeWebSocketClient } from './websockets';
import pino from 'pino';

const logger = pino();
let httpServer: FastifyInstance<
  Server,
  IncomingMessage,
  ServerResponse
>;
let wsServer : io.Server;

process.env.DELIMITER = process.env.DELIMITER || ';';

if (process.env.PRIMARY) {
  initializeWebSocketClient(logger);
} else {
  httpServer = fastify({
      logger: true,
      connectionTimeout: 400000,
      keepAliveTimeout: 400000
    });

  wsServer = initializeWebSocketServer(logger);
  httpServer.register(routes, { prefix: '/api', wsServer });
  httpServer.listen(process.env.PORT || 8080, '0.0.0.0', (err, address) => {
    if (err) {
      httpServer.log.error({
        error: err
      }, `Couldn't start the server`);
      process.exit(1);
    }
  });
}

process.on('uncaughtException', async (err) => {
  logger.error({
    error: err.message
  }, `Uncaught exception`);

  if(httpServer) {
    await httpServer.close();
  }

  if(wsServer) {
    wsServer.close();
  }
  process.exit(1);
});
