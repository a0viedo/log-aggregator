import { FastifyInstance, FastifyReply, FastifyRequest, RequestGenericInterface } from "fastify";
import { constants as fsConstants, createReadStream, createWriteStream, promises as fs } from 'fs';
import { resolve } from 'path';

export default async function handler(fastify: FastifyInstance) {
  fastify.get('/:filename', {
    schema: {
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
    }
  }, getLogFile)
};

async function getLogFile(req: FastifyRequest<Request>, reply: FastifyReply) {
  const filename = req.params.filename;

  try {
    const resolvedPath = resolve('test', filename);

    req.log.info({
      path: resolvedPath
    }, 'Resolved path');
    // check if the file exists
    await fs.access(resolvedPath, fsConstants.F_OK);

    // if it exists then stream it to the response
    req.log.info({
      path: resolvedPath
    }, 'Streaming file to response');
    reply.send(createReadStream(resolvedPath));
  } catch (error) {
    req.log.error({
      error
    },'Invalid request');
    // TODO: identify the type of err specific for `access`
    reply.status(400);
    return {
      message: 'Invalid request'
    };
  }
}

interface Request {
  Querystring: {
    first: number
    last: number
    keyword: string,
  }
  Params: {
    filename: string
  }
}
