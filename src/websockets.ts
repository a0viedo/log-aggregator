import io from 'socket.io';
import ioClient from 'socket.io-client';
const ss = require('socket.io-stream');
import { resolve } from 'path';
import { createReadStream, createWriteStream, fstat, ReadStream, promises as fs } from 'fs';
import { EventEmitter } from 'events';
import { createFilterStream, createFilterStreamByLine, ReadStreamBackwards } from './utils';
import pino from 'pino';
import { Readable } from 'stream';
import { createServer } from 'http';

type SocketIncomingData = {
  filename: string
  keyword: string
  last: number
}
interface NodeError extends Error {
  code: string
}
type SocketResponseData = {
  error: NodeError
  name: string
  reqId: string,
  filename: string
}

export const fileRequestResponses = new Map();

function close(stream: ReadStream) {
  stream.emit('end');
  stream.destroy();
}

export function initializeWebSocketClient(logger: pino.Logger): void {
  const socket = ioClient.connect(process.env.PRIMARY as string);
  socket.on('connect', async() => {
    logger.info({
      primary: process.env.PRIMARY
    }, 'Connected to primary');
  });
  socket.on('file-request', async (data: SocketIncomingData) => {
    const stream = ss.createStream();
    logger.info({
      data
    }, 'Received file-request event');
    try {
      const filePath = resolve(process.env.READ_DIR as string, data.filename);
      const { size } = await fs.stat(filePath);
      ss(socket).emit('file-request-response', stream, data);
      const readStream = new ReadStreamBackwards(filePath, { size }) as Readable;
      if(data.last && data.keyword){
        readStream.pipe(createFilterStreamByLine(data.keyword, close.bind(null, readStream as ReadStream), data.last)).pipe(stream);
      } else if (data.keyword) {
        readStream.pipe(createFilterStream(data.keyword)).pipe(stream);
      } else {
        readStream.pipe(stream);
      }
    } catch(err) {
      logger.error({
        error: err
      }, 'Internal error');
      ss(socket).emit('file-request-response', new Readable(), {
        error: err,
        ...data
      });
    }

  });
}

export function initializeWebSocketServer(logger: pino.Logger): io.Server {
  const wsServer = io(createServer().listen(Number(process.env.WS_PORT), '0.0.0.0'));
  wsServer.on('connection', (socket) => {
    logger.info('Received websocket connection');
    ss(socket).on('file-request-response', (stream: ReadStream, data: SocketResponseData) => {
      logger.info({
        data
      }, 'Received file-request-response event');
      const fileRequestResponse = fileRequestResponses.get(data.reqId);

      if (data.error) {
        logger.warn({
          code: data.error.code,
          message: data.error.message
        }, 'Secondary returned an error');
        fileRequestResponse.responseCount++;
        fileRequestResponses.set(data.reqId, fileRequestResponse);
        if (Object.keys(wsServer.sockets.connected).length === fileRequestResponse.responseCount) {
          logger.info('All responses from secondary servers received');
          fileRequestResponse.ee.emit('finished', { totalReceived : fileRequestResponse.files.length });
        }
        return;
      }

      const filepath = resolve(process.env.TEMP_DIR as string, `${data.reqId}.${socket.id}.${data.filename}`);
      stream.on('end', () => {
        fileRequestResponse.responseCount++;
        fileRequestResponse.files.push(filepath);
        logger.info({
          filepath
        }, 'Finished transfering file from secondary');
        fileRequestResponses.set(data.reqId, fileRequestResponse);
        if (Object.keys(wsServer.sockets.connected).length === fileRequestResponse.responseCount) {
          logger.info('All responses from secondary servers received');
          fileRequestResponse.ee.emit('finished', { totalReceived : fileRequestResponse.files.length });
        }
      });

      stream.pipe(createWriteStream(filepath));
    });
  });
  return wsServer;
}
