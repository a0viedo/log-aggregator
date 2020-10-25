
import { resolve } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { spawn } from 'child_process';
import { Readable, Stream, Transform } from 'stream';
import { promises as fs, ReadStream, read as fsRead, close as fsClose, open as fsOpen } from 'fs';

export function externalSort(filePath: string, keyword?: string, lastLines?: number): Promise<string> {
  const filename = uuidv4();
  const resultingFilePath = resolve(process.env.TEMP_DIR as string,filename);

  const cmd = [`sort --temporary-directory ${process.env.TEMP_DIR} -nr -t '${process.env.DELIMITER}' -k1 ${resolve(process.env.TEMP_DIR as string,filePath)}`];
  if(keyword) {
    cmd.push(` | grep ${keyword}`);
  }

  if(lastLines) {
    cmd.push(` | head -n ${lastLines}`);
  }
  cmd.push(` > ${resultingFilePath}`);
  const p = spawn('sh', ['-c', cmd.join('')]);
  return new Promise((resolve, reject) => {
    p.on('exit', code => {
      if (code === 0) {
        return resolve(resultingFilePath);
      }

      return reject(new Error('Command failed'));
    });
  });
}

export function createFilterStream(keyword: string | undefined, closeFn?: () => void,  lines?: number): Transform {
  let currentLines = 0;
  let finished = false;

  const filter = new Transform({
    transform(chunk, enc, callback) {
      let lines = chunk.toString()
        .split('\n');
      if(keyword) {
        lines = lines.filter((line: string) => line.match(new RegExp(keyword)));
      }
      if(lines && currentLines + lines.length > lines) {
        // need to take out the extra from filtered and then close
        lines = lines.slice(0, lines.length - (lines.length - (lines - currentLines)));
        finished = true;
      }
      currentLines += lines.length;
      this.push(lines.join('\n'));
      if(finished && closeFn) {
        closeFn();
      }
      callback();
    }
  });
  return filter;
}

export function firstNLinesFromStream(closeFn: () => void, linesLimit: number) : Transform {
  let currentLines = 0;
  let finished = false;
  const filter = new Transform({
    transform(chunk, enc, callback) {
      let lines = chunk.toString()
        .split('\n');
      if(currentLines + lines.length > linesLimit) {
        lines = lines.slice(0, lines.length - (lines.length - (linesLimit - currentLines)));
        finished = true;
      }
      currentLines += lines.length;
      this.push(lines.join('\n'));
      if(finished && closeFn) {
        closeFn();
      }
      callback();
    }
  });
  return filter;
}

export function createFilterStreamByLine(keyword?: string, closeFn?: () => void,  limit?: number) : Transform {
  let currentLines = 0;
  let finished = false;

  const filter = new Transform({
    transform(lineBuffer, enc, callback) {
      const line = lineBuffer.toString();
      if(currentLines === 0 && line === '') {
        callback();
        return;
      }
      if(limit && currentLines === limit) {
        finished = true;
      }

      if(finished && closeFn) {
        closeFn();
        callback();
        return;
      }
      if(keyword) {
        if(line.match(new RegExp(keyword))) {
          this.push(`${line}\n`);
          currentLines++;
        }
      } else {
        this.push(`${line}\n`);
        currentLines++;
      }

      callback();
    }
  });
  return filter;
}

type ReadOptions = {
  size: number
  bufferSize?: number
}

export class ReadStreamBackwards extends Readable {
  filename: string;
  size: number;
  fd: number | null;
  position: number;
  bufferSize: number;
  private trailing: string;
  constructor(filename: string, opts: ReadOptions) {
    super();
    this.filename = filename;
    this.size = opts.size;
    this.fd = null;
    this.position = opts.size;
    this.bufferSize = opts.bufferSize || 1024 * 1;
    this.trailing = '';
  }
  _construct(callback: (e?: Error) => void): void {
    fsOpen(this.filename, 'r', (err, fd) => {
      if (err) {
        callback(err);
      } else {
        this.fd = fd;
        callback();
      }
    });
  }
  _read(n: number): void {
    const length = Math.min(this.bufferSize, this.position);
    const buf = Buffer.alloc(length);
    this.position = this.position - length;
    fsRead(this.fd!, buf, 0, length, this.position, (err, bytesRead) => {
      const lines = buf.toString().split('\n');
      if(lines.length === 1 || (lines.length === 2 && lines[lines.length -1] === '')) {
        // buffer this part until next newline
        this.trailing = `${lines[0]}${this.trailing}`;
        this.push('');
        lines.length = 0;
      } else {
        if(lines[lines.length -1] !== '') {
          // if there were trailing then add at the last read line
          if(this.trailing !== '') {
            lines[lines.length -1] = `${lines[lines.length -1]}${this.trailing}`;
            this.trailing = '';
          }

        }

        if(lines[0] !== '') {
          this.trailing = lines.shift() as string;
        }
      }
      if (err) {
        this.destroy(err);
      } else {
        if(bytesRead > 0 && lines.length > 0) {
          this.push(lines.reverse().join('\n'));
        }
        if(bytesRead === 0) {
          if(this.trailing !== '') {
            this.push(`\n${this.trailing}`);
          }
          this.push(null);
        }
      }
    });
  }
  _destroy(err: Error, callback: (e?: Error) => void): void {
    if (this.fd) {
      fsClose(this.fd, (er) => callback(er || err));
    } else {
      callback(err);
    }
  }
}
