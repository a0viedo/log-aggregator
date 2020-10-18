import { constants as fsConstants, createReadStream, createWriteStream, promises as fs } from 'fs';
import { resolve } from 'path';
import { loremIpsum } from 'lorem-ipsum';
const filename = process.argv[2];
const sizeInMegabytes = process.argv[3];

const averageSizePerParagraph = 340; // on average, I don't care about precision
const estimatedNumber = (Number(sizeInMegabytes) * 1048576) / averageSizePerParagraph;
const file = createWriteStream(resolve(filename));

const date = new Date('2015-01-01');

let i = 0;

async function write() {
  let result = true;
  while (i < estimatedNumber && result) {
    let dateToWrite;
    if (i % 2 === 0) {
      dateToWrite = new Date(date);
      dateToWrite.setSeconds(date.getSeconds() + Math.round(Math.random() * 30));
    } else {
      dateToWrite = new Date(date);
      dateToWrite.setSeconds(date.getSeconds() - Math.round(Math.random() * 20));
    }
    file.write(`${dateToWrite.toISOString()};`);
    result = file.write(loremIpsum({
      count: 1,
      units: 'paragraph',
      paragraphLowerBound: 5,
      paragraphUpperBound: 5,
    }));
    file.write('\n');
    date.setSeconds(date.getSeconds() + 15);
    i++;

    if (!result) {
      file.once('drain', write);
    }
  }
}
write();

