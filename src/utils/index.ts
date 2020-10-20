
import { resolve } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { spawn } from 'child_process';
import { Transform } from 'stream';

export function externalSortAndFilter(filePath: string, keyword: string): Promise<string> {
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

export function externalSort(filePath: string): Promise<string> {
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

export function createFilterStream(keyword: string): Transform {
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
