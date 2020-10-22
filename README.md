## Log-aggregator

### Overview
The project offers an HTTP API to retrieve log files from a set of secondary servers. It offers some flexibility for the path on the current filesystem to read from and to configure which directory can be used as a temporary directory for storing internal files. Internally it uses Node.js streams to avoid loading the entire targetted files on memory for transmission or keyword filtering and GNU's `sort` for external sorting.

### Endpoints
#### GET /api/regex/:filename?keyword=key&last=number
This endpoint accepts two querystring parameters, `keyword` and `last`. By using `keyword` you can filter to get matched results from the HTTP response and with `last` you can select how many lines to select after the filter is applied.
Results are ordered by a timestamp in a way that most recent lines are first.

#### GET /api/grep/:filename?keyword=key&last=number
The endpoint offers the same functionality than the previous one but it's using GNU's `grep` to do the filtering by keyword and `head` for the line selection.
### Environment variables
| Name | Description |
|----------|:-------------:|
| TEMP_DIR | temporal directory to use internally for sorting |
| DELIMITER | delimiter used in the log files to separate the timestamp |
| READ_DIR | directory from where to search for files |
| PRIMARY | specifies the primary server to connect using WebSockets |
| PORT | specifies the port to be used for HTTP connections |
| WS_PORT | specifies the port to be used for WebSocket connections |

### Generating test data
There's a script to facilitate the creation of text files for testing purposes. For example, for creating a 1GB file you can run:
```
$ npx ts-node scripts/generate-test-file.ts 1024
```

### Benchmarks
The benchmarks were run without enabling the feature of secondary servers and in the following setup:
- **Machine**: Linux 5.8.15-101.fc31.x86_64 #1 SMP Thu Oct 15 16:57:45 UTC 2020 x86_64 x86_64 x86_64 GNU/Linux | Intel(R) Core(TM) i7-8565U CPU @ 1.80GHz | 16GB of RAM
- **Node version**: v12.19.0

File sizes used for the sample:
- small file 800bytes
- medium file 2GB
- large file 19GB
![](https://imgur.com/cBbQ3l1.png)
