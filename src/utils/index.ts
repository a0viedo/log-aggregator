
import { resolve } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { spawn } from 'child_process';
import { Transform } from 'stream';

export function externalSort(filePath: string, keyword?: string, lastLines?: number): Promise<string> {
  const filename = uuidv4();
  const resultingFilePath = `./tmp/${filename}.txt`;

  const cmd = [`sort --temporary-directory ${process.env.TEMP_DIR} -nr -t '${process.env.DELIMITER}' -k1 ${filePath}`];
  if(keyword) {
    cmd.push(` | grep ${keyword}`);
  }

  if(lastLines) {
    cmd.push(` | head -n ${lastLines}`);
  }
  cmd.push(` > ${resultingFilePath}`);
  // console.log('-----', cmd.join(''));
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

export function createFilterStream(keyword: string, closeFn?: () => void,  lines?: number): Transform {
  let currentLines = 0;
  let finished = false;
  const filter = new Transform({
    transform(chunk, enc, callback) {
      let filtered = chunk.toString()
        .split('\n')
        .filter((line: string) => line.match(new RegExp(keyword)));
      if(lines && currentLines + filtered.length > lines) {
        // need to take out the extra from filtered and then close
        filtered = filtered.slice(0, filtered.length - (filtered.length - (lines - currentLines)));
        finished = true;
      }
      currentLines += filtered.length;
      this.push(filtered.join('\n'));
      if(finished && closeFn) {
        closeFn();
      }
      callback();
    }
  });
  return filter;
}
