import { FastifyInstance, FastifyPluginOptions, FastifyReply, FastifyRequest, RequestGenericInterface } from 'fastify';
import { constants as fsConstants, createReadStream, createWriteStream, promises as fs } from 'fs';
import { resolve } from 'path';
import { externalSort, createFilterStream, firstNLinesFromStream } from './utils';
import { fileRequestResponses } from './websockets';
import {EventEmitter} from 'events';
import io from 'socket.io';
import { v4 as uuidv4 } from 'uuid';

const schema = {
  params: {
    type: 'object',
    required: ['filename'],
    properties: {
      filename: {
        type: 'string',
        minLength: 1
      }
    }
  },
  querystring: {
    type: 'object',
    properties: {
      last: { type: 'number' },
      keyword: { type: 'string' },
      servers: { type: 'array' }
    }
  }
};

export default function (fastify: FastifyInstance, opts: FastifyPluginOptions, done: () => void): void {
  fastify.get('/regex/:filename', { schema }, (req, reply) => getLogFile(req as FastifyRequest<Request>,reply, opts.wsServer));
  fastify.get('/grep/:filename', { schema }, getLogFileUsingGrep);
  done();
}

async function getLogFile(req: FastifyRequest<Request>, reply: FastifyReply, wsServer: io.Server) {
  const filename = req.params.filename;
  const keyword = req.query.keyword;

  try {
    const resolvedPath = resolve(process.env.READ_DIR as string, filename);

    req.log.info({
      path: resolvedPath
    }, 'Resolved path');

    const uniqueId = uuidv4();
    const ee = new EventEmitter();
    fileRequestResponses.set(uniqueId, {
      ee,
      responseCount: 0,
      files:[]
    });

    let sortedFilePath: string;

    wsServer.sockets.emit('file-request', { reqId: uniqueId, filename, keyword, last: req.query.last });
    await new Promise((resolve, reject) => {
      ee.on('finished', async (additionalInfo) => {
        if(additionalInfo.totalReceived === 0) {
          req.log.info('All secondaries returned an error'); // it's probably the file is non-existent
          reply.status(404);
          reply.send('');
          return;
        }
        req.log.info({
          glob: `${uniqueId}.*.${filename}`
        },'Merging return files');
        sortedFilePath = await externalSort(`${uniqueId}.*.${filename}`);

        const readStream = createReadStream(sortedFilePath);
        if(req.query.last) {
          reply.send(readStream.pipe(firstNLinesFromStream(readStream.close.bind(readStream), req.query.last)));
          // if in case I need to close the stream before is drained then I need to tell the HTTP response it's done transmitting data
          readStream.on('close', () => reply.raw.end());
        } else {
          reply.send(readStream);
        }

        return resolve();
      });
    });

    reply.raw.on('finish', () => {
      // schedule the file to be cleaned up or fire-and-forget the clean up process
      try {
        if(sortedFilePath) {
          fs.unlink(sortedFilePath);
        }

      } catch(error) {
        req.log.error({
          error
        }, 'There was an error while trying to clean up temporal files');
      }
    });
  } catch (error) {
    if(error.code && error.code === 'ENOENT') {
      reply.status(404);
      return {
        message: 'File not found'
      };
    }
    req.log.error({
      error: error.message
    }, 'Internal error');
    reply.status(404);
    return {
      message: 'Internal server error'
    };
  }
}

async function getLogFileUsingGrep(req: FastifyRequest<Request>, reply: FastifyReply) {
  const filename = req.params.filename;
  const keyword = req.query.keyword;
  const lastLines = req.query.last;

  try {
    const resolvedPath = resolve('test', filename);

    req.log.info({
      path: resolvedPath
    }, 'Resolved path');
    // check if the file exists
    const statRes = await fs.stat(resolvedPath);
    req.log.info({
      stat: statRes
    }, 'Stat results');

    const sortedFilePath = await externalSort(resolvedPath, keyword, lastLines);

    req.log.info({
      path: resolvedPath
    }, 'Streaming file to response');

    reply.send(createReadStream(sortedFilePath));
    reply.raw.on('finish', () => {
      // schedule the file to be cleaned up or fire-and-forget the clean up process
      try {
        fs.unlink(sortedFilePath);
      } catch(error) {
        req.log.error({
          error
        }, 'There was an error while trying to clean up temporal files');
      }
    });
  } catch (error) {
    if(error.code && error.code === 'ENOENT') {
      reply.status(404);
      return {
        message: 'File not found'
      };
    }
    req.log.error({
      error: error.message
    }, 'Internal error');
    reply.status(500);
    return {
      message: 'Internal server error'
    };
  }
}

interface Request {
  Querystring: {
    last: number | undefined
    keyword: string | undefined,
  }
  Params: {
    filename: string
  }
}

function mbToBytes(mb: number): number {
  return mb * 1000000;
}

