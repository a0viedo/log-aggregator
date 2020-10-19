import { FastifyInstance, FastifyPluginOptions, FastifyReply, FastifyRequest, RequestGenericInterface } from 'fastify';
import { constants as fsConstants, createReadStream, createWriteStream, promises as fs } from 'fs';
import { resolve } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { spawn } from 'child_process';
import { Transform } from 'stream';
import { Server, IncomingMessage, ServerResponse } from 'http';

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

    // I believe I don't need this if I'm using fs.stat
    // await fs.access(resolvedPath, fsConstants.F_OK);

    if (process.env.MEM_LIMIT && statRes.size < mbToBytes(Number(process.env.MEM_LIMIT))) {
      // load the file in-memory
      // filter if needed in-memory
      // sort in-memory
      return;
    }

    const sortedFilePath = await externalSort(resolvedPath);

    // if it exists then stream it to the response
    req.log.info({
      path: resolvedPath
    }, 'Streaming file to response');

    if(keyword) {
      reply.send(createReadStream(sortedFilePath).pipe(createFilterStream(keyword)));
    } else {
      reply.send(createReadStream(sortedFilePath));
    }

    (reply as any).raw.on('finish', () => {
      // TODO: schedule the file to be cleaned up or fire-and-forget the clean up process
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

    let sortedFilePath: string;
    if(keyword) {
      sortedFilePath = await externalSortAndFilter(resolvedPath, keyword);
    } else {
      sortedFilePath = await externalSort(resolvedPath);
    }

    req.log.info({
      path: resolvedPath
    }, 'Streaming file to response');

    reply.send(createReadStream(sortedFilePath));
    (reply as any).raw.on('finish', () => {
      // TODO: schedule the file to be cleaned up or fire-and-forget the clean up process
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

function filterInMemory(fileContent: string, keyword: string) {
  // TODO: implement
}

function externalSortAndFilter(filePath: string, keyword: string): Promise<string> {
  const filename = uuidv4();
  const resultingFilePath = `/tmp/${filename}.txt`;

  const cmd = `sort -nr -t '${process.env.DELIMITER}' -k1 ${filePath} | grep ${keyword} > ${resultingFilePath}`;
  const p = spawn('sh', ['-c', cmd]);
  return new Promise((resolve, reject) => {
    p.on('exit', code => {
      if (code === 0) {
        return resolve(resultingFilePath);
      }

      return reject(new Error('Command failed'));
    });
  });
}

function externalSort(filePath: string): Promise<string> {
  const filename = uuidv4();
  const resultingFilePath = `/tmp/${filename}.txt`;

  const cmd = `sort -nr -t '${process.env.DELIMITER}' -k1 ${filePath} > ${resultingFilePath}`;
  const p = spawn('sh', ['-c', cmd]);
  return new Promise((resolve, reject) => {
    p.on('exit', code => {
      if (code === 0) {
        return resolve(resultingFilePath);
      }

      return reject(new Error('Command failed'));
    });
  });
}

function createFilterStream(keyword: string): Transform {
  const filter = new Transform({
    transform(chunk, enc, callback) {
      const filtered = chunk.toString()
        .split('\n')
        .filter((line: string) => line.match(new RegExp(keyword)))
        .join('\n');
      this.push(filtered);
      callback();
    }
  });
  return filter;
}
