import {ICDNConfig, IRequestResult, IHeaders} from "./interfaces";
import {RedisCache, CacheServerRequest} from './cacheServerRequest';
import * as nodeurl from 'url';
import * as http from 'http';
import * as zlib from 'zlib';
import * as bunyan from 'bunyan';
const request = require('request');
const debug = require('debug')('cdn-server');

export class CacheServer {

    private httpServer: http.Server;

    constructor(private cdnConfig: ICDNConfig, private logger: bunyan.Logger) {}

    private connectRedisUrlCache(cb:Function) {
        RedisCache.connectRedisUrlCache( this.cdnConfig.instanceName, this.cdnConfig.redisConfig, this.cdnConfig.defaultDomain, (err) => {
            cb(err);
        });
    }

    public start(cb: Function) {
        this.httpServer = http.createServer(this.urlServer);
        this.connectRedisUrlCache(err => {
            if (err) {
                this.logger.error({err: err}, 'Error connecting with redis-url-cache');
                throw new Error(err);
            }

            this.httpServer.listen(this.cdnConfig.port, (err) => {
                cb(err);
            });

            this.httpServer.on('clientError', (err, socket) => {
                debug('On Client Error: ', err);
                this.logger.error({err: err, socket: socket}, 'Socket error');
                socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
            });

            this.logger.warn('Cache Server launched');
            debug('CacheServer ', this.cdnConfig.instanceName, 'Launched');
        });
    }

    public stop(cb: Function) {
        this.httpServer.close( (err) => {
            cb(err);
        });
    }

    private urlServer = (request:http.IncomingMessage, response:http.ServerResponse) => {
        response.setHeader('Access-Control-Allow-Origin', '*');
        response.setHeader('Access-Control-Request-Method', '*');
        response.setHeader('Access-Control-Allow-Methods', 'OPTIONS, GET');
        debug('cdn-server URL, METHOD = ', request.method, request.url);

        if(typeof request.headers['access-control-request-headers'] !== 'undefined') {
            response.setHeader('Access-Control-Allow-Headers', request.headers['access-control-request-headers']);
        }
        if ( request.method === 'OPTION' || request.method === 'OPTIONS' ) {
            debug('OPTION call for ', request.url);
            debug(request.headers);
            //debug(request);
            //todo forward the option to destination
            response.writeHead(200);
            response.end();
            return;
        } else {
            debug('requesting ', request.method, request.url);
            this.logger.info({url: nodeurl.parse(request.url), method: request.method}, 'New request');
        }

        try {
            const cacheServerRequest = new CacheServerRequest(this.cdnConfig.defaultDomain, this.logger, request);

            cacheServerRequest.getIt( (status, headers,content) => {
                var headerKeys = Object.keys(headers);
                response.setHeader('Access-Control-Expose-Headers', headerKeys.join(','));
                response.writeHead(status, headers);
                //debug('ACTUALLY GOING TO SEND BACK headers = ', headers);
                response.end(content);
            });
        } catch(e) {
            debug("Exception caught", e);
            response.writeHead(501, {});
            response.end(e.message);
        }
    }
}