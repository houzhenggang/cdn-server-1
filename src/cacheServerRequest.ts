import {RedisStorageConfig, CacheEngineCB, Instance, CacheCB} from 'redis-url-cache';
import {IRequestResult, IHeaders} from "./interfaces";
import * as nodeurl from 'url';
import * as http from 'http';
import * as bunyan from 'bunyan';
const request = require('request');
const iconv = require('iconv');
const debug = require('debug')('cdn-server');

export class RedisCache {
    static cacheEngine:CacheEngineCB;

    static connectRedisUrlCache(instanceName: string, redisConfig: RedisStorageConfig, defaultDomain: string, cb:Function) {
        const instance = new Instance(instanceName, redisConfig, {}, (err) => {
            if (err) return cb(err);

            RedisCache.cacheEngine = new CacheEngineCB(defaultDomain, instance);
            cb(null);
        });
    }
}

export class CacheServerRequest {

    private url: nodeurl.Url;
    private urlCB: CacheCB;
    private headers;
    private originalURL: string;
    private logger: bunyan.Logger;

    //todo prepend: ")]}',\n" to all JSON responses

    constructor(private defaultDomain: string, logger: bunyan.Logger, request:http.IncomingMessage) {
        this.url = nodeurl.parse(request.url, true);

        this.logger = logger.child({
            script: 'CacheServer',
            url: this.url
        });

        this.validateURL(request);

        try {
            this.urlCB = RedisCache.cacheEngine.url(this.url.query.url);
        }
        catch(e) {
            this.logger.error({e: e}, 'Error executin cacheEngine.url()');
            debug('Error with url: request.url', request.url, e);
            throw e;
        }


        //todo
        //Replicate all the headers from the original request
    }

    private validateURL(request: http.IncomingMessage) {

        if (this.url.pathname !== '/get' || typeof this.url.query.url === 'undefined') {
            const error = new Error(`Error - the URL is not valid - only '{hostname}/get?url=' is allowed`);
            this.logger.error( {err: error });
            debug(error.message, this.url.pathname, this.url.query);
            throw error;
        }

        this.headers = request.headers;

        if(typeof this.headers['referer'] === 'undefined') {

            if(typeof this.url.query.referer !== 'undefined') {
                // This is only for debug purposes
                this.headers['referer'] = this.url.query.referer;
            } else {
                const error = new Error('Error - the referer header is not set');

                debug('no referer: headers = ', request.headers);

                this.logger.error({ headers: request.headers, err: error});
                throw error;
            }
        }

        const parsedOriginalURL = nodeurl.parse(request.headers['referer']);
        parsedOriginalURL.query = null;
        parsedOriginalURL.path = null;
        parsedOriginalURL.pathname = null;
        parsedOriginalURL.hash = null;
        parsedOriginalURL.search = null;
        this.originalURL = nodeurl.format(parsedOriginalURL);

        //debug('original headers = ', this.headers);
        //delete this.headers['ngreferer'];
    }

    getIt(cb: Function) {

        debug('getIt called');

        this.detectCachingStatus((cachingStatus) => {
            //debug('detectCachingStatus', cachingStatus);

            switch (cachingStatus) {
                case 'ERROR':
                case 'NEVER':
                case 'NOT_CACHED':
                    debug('IT IS NOT CACHED');
                    this.requestURL(false, this.headers, (err, result:IRequestResult) => {
                        debug('INSIDE GETIT CB');
                        if(err) {
                            debug('ERROR while requesting ', this.url.query.url, err);
                            this.logger.error({err: err, cachingStatus: cachingStatus, headers: this.headers}, err);
                            return cb(501, {'Content-Type': 'text/html'}, 'Error ' + err);
                        }
                        if(result.content.length === 0) {
                            debug('ERROR while requesting ', this.url.query.url);
                            this.logger.error({cachingStatus: cachingStatus, headers: this.headers}, 'Empty response');
                            return cb(501, {'Content-Type': 'text/html'}, 'Error response is empty' + JSON.stringify(result));
                        }
                        result.headers['caching-status'] = cachingStatus;
                        if (cachingStatus !== 'NEVER') {
                            this.urlCB.set(result.content, {
                                status: result.status,
                                url: this.urlCB.getUrl(),
                                domain: this.urlCB.getDomain(),
                                headers: result.headers
                            }, false, (err, setResult) => {
                                if (err) {
                                    //todo log the error
                                    debug(err);
                                    this.logger.error({err: err, cachingStatus: cachingStatus, headers: this.headers}, 'Error storing in redis-url-cache');
                                    return cb(501, {'Content-Type': 'text/html'}, 'Error ' + err);
                                }
                                result.headers['ngServerCached'] = 'yes';
                                return cb(result.status, result.headers, result.content);
                            })
                        } else {
                            result.headers['ngServerCached'] = 'no';
                            return cb(result.status, result.headers, result.content);
                        }
                    });
                    break;
                case 'CACHED':
                    debug('IT IS CACHED');
                    this.urlCB.get((err, content) => {
                        if (err) {
                            //todo log the error
                            debug(err);
                            this.logger.error({err: err, cachingStatus: cachingStatus, headers: this.headers}, "error retrieve content from redis-url-cache");
                            return cb(501, {'Content-Type': 'text/html'}, 'Error ' + err);

                        }
                        content.extra.headers['caching-status'] = cachingStatus;
                        content.extra.headers['ngServerCached'] = 'yes';
                        return cb(content.extra.status, content.extra.headers, content.content);

                    });
            }

        });
    }


    //convert to utf-8
    private decode(headers, body) {
        //debug('DECODE CALLED', headers, body.substr(0, 30));

        const re = /charset=([^()<>@,;:\"/[\]?.=\s]*)/i;

        if(headers['content-type']) {
            const charset = re.test(headers['content-type']) ? re.exec(headers['content-type'])[1] : 'utf-8';
            //debug('charset detected: ', charset);
            if(charset === 'utf-8') {
                return body;
            }
            var ic = new iconv.Iconv(charset, 'UTF-8');
            var buffer = ic.convert(body);
            return buffer.toString('utf-8');
        }
        throw new Error('content-type is missing');
    }

    private requestURL(binary: boolean ,headers: Object, cb: Function) {

        //debug('CALLING REQUEST URL with headers!', headers);

        const newHeaders = {};
        newHeaders['origin'] = this.originalURL;
        newHeaders['user-agent'] = headers['user-agent'] ? headers['user-agent'] : 'Super User Agent';
        if ( typeof newHeaders['accept-encoding'] !== 'undefined') {
            delete newHeaders['accept-encoding'];
            //todo enable GZIP compression - but then find a way to detect if the server supports gzip/deflate before sending the request - and set encoding = null
            //newHeaders['accept-encoding'] = headers['accept-encoding'] ? headers['accept-encoding'] : 'gzip, deflate';
            // to enable Gzip compression, use the following code:

            /**
             *
             *
             req.on('response', (res: http.IncomingMessage) => {
            let output;
             if( res.headers['content-encoding'] === 'gzip' ) {
                const gzip = zlib.createGunzip();
                res.pipe(gzip);
                output = gzip;
            } else if(res.headers['content-encoding'] === 'deflate' ) {
                const deflate = zlib.createDeflate();
                res.pipe(deflate);
                output = deflate;
            }
             else {
                output = res;
            }

             output.on('end', function() {
                debug('on END');
                callback(null, output.toString('UTF-8'));
            });

            const callback = (err: Error, body: string) => {
            debug('callback called');
            if(err) {

                return cb(err, dataResponse);
            }
            dataResponse.content = body;
            dataResponse.headers['content-length'] = body.length + '';
            dataResponse.headers['content-encoding'] = 'identity';
            debug('RESPONSE: ', dataResponse.headers, dataResponse.status, dataResponse.content.substr(0, 30));
            cb(null, dataResponse);
        }
             */
        }
        if(headers['cookie']) newHeaders['cookie'] = headers['cookie'];

        //debug('requestURL, sending Headers to ', this.url.query.url, JSON.stringify(newHeaders));

        const parsedURL = nodeurl.parse(this.url.query.url);
        const url = parsedURL.host === null ? this.defaultDomain + this.url.query.url : this.url.query.url;

        debug('GOING TO REQUEST', url, newHeaders)

        request( {
            url: url,
            headers: newHeaders
        }, (err: Error, response: http.IncomingMessage, body: string) => {

            //debug('INSIDE CALLBACK');

            if(err) {
                debug('Error caught in request callback', err);
                return cb(err, null);
            }

            //debug('body received, body.length  = ', body.length);

            /*try {
             body = this.decode(response.headers, body);
             } catch(e) {
             return cb(e, null);
             }

             debug('after decoding, body.length = ', body.length);
             */
            const dataResponse:IRequestResult = {
                status: response.statusCode,
                content: body,
                headers:  this.extractHeaders(response.headers)
            };

            //debug('RESPONSE HEADERS', dataResponse.headers);
            //debug('body length = ', body.length);

            cb(null, dataResponse);
        });


    }

    private extractHeaders(receivedHeaders: Object):IHeaders {
        const headers = {};
        const headersToExtract = [
            'access-control-allow-origin',
            'cache-control',
            'content-encoding',
            'content-type',
            'etag',
            'set-cookie',
            'vary',
            'connection',
            'expires',
            'date',
            'last-modified'
        ];

        let keys = Object.keys(receivedHeaders);
        let newReceivedHeaders = {};
        keys.forEach( (key) => {
            newReceivedHeaders[key.toLowerCase()] = receivedHeaders[key];
        });
        headersToExtract.forEach(name => {
            if (newReceivedHeaders[name]) {
                headers[name] = newReceivedHeaders[name];
            }
        });
        headers['access-control-allow-origin'] = '*';
        return headers;
    }

    private detectCachingStatus(cb:Function) {
        this.urlCB.has((err, isCached) => {
            if (err) {
                this.logger.error({err: err}, 'Error has()');
                return cb('ERROR');
            }
            if (this.urlCB.getCategory() === 'never') {
                return cb('NEVER');
            }
            if (isCached) {
                return cb('CACHED');
            } else {
                return cb('NOT_CACHED');
            }
        });
    }

}
