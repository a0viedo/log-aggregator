import { externalSort, createFilterStream } from '../src/utils';
import childProcess from 'child_process';
import { Readable } from 'stream';
import {EventEmitter} from 'events';
import { expect, use, spy } from 'chai';
import spies from 'chai-spies';
use(spies);

describe('utils', () => {
  const tmpDir = 'some_dir';
  process.env.TEMP_DIR = tmpDir;
  const delimiter = ';';
  process.env.DELIMITER = delimiter;
  it('should sort correctly', async () => {
    const filePath = 'test.txt';
    const ee = new EventEmitter();
    let command : string;

    // @ts-ignore
    childProcess.spawn = (...params) => {
      command=params[1][1];
      process.nextTick(() => ee.emit('exit', 0));
      return ee;
    };

    const spawnSpy = spy.on(childProcess, 'spawn');

    await externalSort(filePath);
    expect(spawnSpy).to.have.been.called();
    // eslint-disable-next-line
    expect(command!.split('>')[0]).to.equal(`sort --temporary-directory ${tmpDir} -nr -t '${delimiter}' -k1 ${filePath} `);
  });

  it('should sort and filter correctly', async () => {
    const filePath = 'test.txt';
    const keyword = 'some-random-filter';
    const ee = new EventEmitter();
    let command : string;

    // @ts-ignore
    childProcess.spawn = (...params) => {
      command=params[1][1];
      process.nextTick(() => ee.emit('exit', 0));
      return ee;
    };

    const spawnSpy = spy.on(childProcess, 'spawn');
    await externalSort(filePath, keyword);
    expect(spawnSpy).to.have.been.called();
    // eslint-disable-next-line
    expect(command!.split('>')[0]).to.equal(`sort --temporary-directory ${tmpDir} -nr -t '${delimiter}' -k1 ${filePath} | grep ${keyword} `);
  });

  it('should sort, filter and select the last lines correctly using grep', async () => {
    const filePath = 'test.txt';
    const keyword = 'some-random-filter';
    const ee = new EventEmitter();
    let command : string;

    // @ts-ignore
    childProcess.spawn = (...params) => {
      command=params[1][1];
      process.nextTick(() => ee.emit('exit', 0));
      return ee;
    };

    const spawnSpy = spy.on(childProcess, 'spawn');

    const lines = 250;
    await externalSort(filePath, keyword, lines);
    expect(spawnSpy).to.have.been.called();
    // eslint-disable-next-line
    expect(command!.split('>')[0]).to.equal(`sort --temporary-directory ${tmpDir} -nr -t '${delimiter}' -k1 ${filePath} | grep ${keyword} | head -n ${lines} `);
  });

  it('should create a stream filter correctly', done => {
    const stream = new Readable();
    stream.setEncoding('utf-8');
    stream.push('hi there\nthis is a line\nthis is another line');
    stream.push(null);
    let result = '';
    stream.pipe(createFilterStream('this')).on('data', d => {
      result += d.toString();
    }).on('end', () => {
      expect(result).to.equal('this is a line\nthis is another line');
      done();
    });
  });
});
