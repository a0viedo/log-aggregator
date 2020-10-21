import { FastifyInstance, FastifyPluginOptions, FastifyReply, FastifyRequest, RequestGenericInterface } from 'fastify';
import { constants as fsConstants, createReadStream, createWriteStream, promises as fs } from 'fs';
import { resolve } from 'path';
import { externalSort, createFilterStream } from './utils';

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
      keyword: { type: 'string' }
    }
  }
};

export default function (fastify: FastifyInstance, opts: FastifyPluginOptions, done: () => void): void {
  fastify.get('/regex/:filename', { schema }, getLogFile);
  fastify.get('/grep/:filename', { schema }, getLogFileUsingGrep);
  done();
}

async function getLogFile(req: FastifyRequest<Request>, reply: FastifyReply) {
  const filename = req.params.filename;
  const keyword = req.query.keyword;

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

    const sortedFilePath = await externalSort(resolvedPath);

    // if it exists then stream it to the response
    req.log.info({
      path: resolvedPath
    }, 'Streaming file to response');

    const readStream = createReadStream(sortedFilePath);
    if(keyword) {
      reply.send(readStream.pipe(createFilterStream(keyword, readStream.close.bind(readStream), req.query.last)));
    } else {
      reply.send(readStream);
    }

    readStream.on('close', () => reply.raw.end());
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
      reply.status(400);
      return {
        message: 'File not found'
      };
    }
    req.log.error({
      error
    }, 'Invalid request');
    // TODO: identify the type of err specific for `access`
    reply.status(400);
    return {
      message: 'Invalid request'
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
      reply.status(400);
      return {
        message: 'File not found'
      };
    }
    req.log.error({
      error
    }, 'Internal error');
    reply.status(500);
    return {
      message: 'Invalid server error'
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

