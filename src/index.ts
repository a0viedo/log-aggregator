import fastify from 'fastify'
import fileHandler from './file';

const server = fastify({
  logger: true
});

server.register(fileHandler, { prefix: '/api'});

server.listen(8080, (err, address) => {
  if(err) {
    console.error(err)
    process.exit(1)
  }
});

// TODO: add graceful shutdown of the server
// TODO: add websockets to connect to pool of secondary servers

