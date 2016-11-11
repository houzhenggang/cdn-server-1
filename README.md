# cdn-server
This is a basic cdn server engine

## How does it work

 First install it: 
 
 `npm install --save cdn-server`

 It uses the [redis-url-cache](https://ng-consult.github.io/redis-url-cache) node library to store URLs in a redis data store, and [bunyan](https://github.com/trentm/node-bunyan) for JSON logging.
 
 It runs on a [node.js http server](https://nodejs.org/api/http.html) 
 
 The config file is straight forward.
 
 
## Config JSON

The JSON format is: 

```typescript
interface ICDNconfig{
    defaultDomain: string, // When provided with a relative URL, this hostname will be used
    port: number, // listening port
    instanceName: string, // rediurl-cache instance NAme
    redisConfig: RedisUrlCache.RedisStorageConfig, 
    cacheRules: RedisUrlCache.CacheRules
}

```

**instanceName**  See [Instances](https://ng-consult.github.io/redis-url-cache/api.html#instance.usage)

**RedisUrlCache.RedisStorageConfig** See [Redis Config](https://ng-consult.github.io/redis-url-cache/api.html#config.redis-config)

**RedisUrlCache.CacheRules** See [Cache Rules](https://ng-consult.github.io/redis-url-cache/api.html#config.cache-rules)

> Note Regexes inside cacheRules must be valid.


## Usage

```javascript
var CacheServer = require('cdn-server');
var bunyan = require('bunyan');

var config = {
    defaultDomain: 'http://127.0.0.1:3000/',
    port: 3030,
    instanceName: 'CACHE',
    redisConfig: {
        host: '127.0.0.1',
        port: 6379,
    },
    cacheRules: {
        default: 'always',
        always: [],
        never: [],
        maxAge: []
    }
}

var logger = bunyan.createLogger({name: 'I am a console logger'});

var server = new CacheServer(config, logger);

server.start( function(err) {
    if(err) throw err;
    console.log('cache server started');
});


```


Then you can CURL: 
 
`curl --header "referer: http://whatever.com" http://127.0.0.1:3030/get?url=http://www.google.com`

> The `referer` header is mandatory
 

## Whats wrong with it?
 
 It doesn't supports CORS (yet), although the fix is trivial
 
 This is just a server, if you query `http://127.0.0.1:3030/get?url=http://www.google.com&referer=http://whatever.com`, inside your browser, you will of course get the correct HTML, but the browser will call the wrong relative URLs. 
