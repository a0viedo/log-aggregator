import fastify from 'fastify';
import fileHandler from './file';

const server = fastify({
  logger: true
});

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

