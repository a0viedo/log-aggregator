import fastify, { FastifyInstance, FastifyPluginOptions, FastifyReply, FastifyRequest, RequestGenericInterface } from 'fastify';
import fileHandler from './file';
import { Server, IncomingMessage, ServerResponse } from 'http';

const server: FastifyInstance<
  Server,
  IncomingMessage,
  ServerResponse
> = fastify({
  logger: true,
  connectionTimeout: 400000,
  keepAliveTimeout: 400000
});

process.env.DELIMITER = process.env.DELIMITER || ';';
server.register(fileHandler, { prefix: '/api'});

server.listen(8080, (err, address) => {
  if(err) {
    server.log.error({
      error: err
    }, `Couldn't start the server`);
    process.exit(1);
  }
});

// TODO: add graceful shutdown of the server
// TODO: add websockets to connect to pool of secondary servers

