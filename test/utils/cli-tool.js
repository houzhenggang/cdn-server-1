'use strict';

const debug = require('debug')('mocha-test-server');
const utils = require('./servers');
const config = require('./config');
const bunyan = require('bunyan');
const net = require('net');
const CacheServer = require('./../../dist/cache-server').CacheServer;

let cacheServer;

const logger = bunyan.createLogger({name: 'cache-server-test'});
cacheServer = new CacheServer(config.CDNConfig, logger);
cacheServer.start((err) => {
    if (err) return console.error(err);
    console.log('cache Server started');
});

utils.startWebServers((err, servers) => {
    if(err) return console.error(err);
    console.log('Web server started');
    console.log(servers);
});
