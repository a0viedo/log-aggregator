
import { resolve } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { spawn } from 'child_process';
import { Transform } from 'stream';

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
  // console.log('firstNLinesFromStream', linesLimit);
  const filter = new Transform({
    transform(chunk, enc, callback) {
      let lines = chunk.toString()
        .split('\n');
      if(currentLines + lines.length > linesLimit) {
        // console.log('finished slicing', currentLines, lines.length, lines);
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
