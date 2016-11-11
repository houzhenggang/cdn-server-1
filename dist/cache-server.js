module.exports =
/******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId])
/******/ 			return installedModules[moduleId].exports;
/******/
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			exports: {},
/******/ 			id: moduleId,
/******/ 			loaded: false
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.loaded = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(0);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";
	var cacheServerRequest_1 = __webpack_require__(1);
	var nodeurl = __webpack_require__(3);
	var http = __webpack_require__(7);
	var request = __webpack_require__(4);
	var iconv = __webpack_require__(5);
	var debug = __webpack_require__(6)('cdn-server');
	var CacheServer = (function () {
	    function CacheServer(cdnConfig, logger) {
	        var _this = this;
	        this.cdnConfig = cdnConfig;
	        this.logger = logger;
	        this.urlServer = function (request, response) {
	            response.setHeader('Access-Control-Allow-Origin', '*');
	            response.setHeader('Access-Control-Request-Method', '*');
	            response.setHeader('Access-Control-Allow-Methods', 'OPTIONS, GET');
	            if (typeof request.headers['access-control-request-headers'] !== 'undefined') {
	                response.setHeader('Access-Control-Allow-Headers', request.headers['access-control-request-headers']);
	            }
	            if (request.method === 'OPTION' || request.method === 'OPTIONS') {
	                debug('option call for ', request.url);
	                debug(request.headers);
	                response.writeHead(200);
	                response.end();
	                return;
	            }
	            else {
	                debug('requesting ', request.method, request.url);
	                _this.logger.info({ url: nodeurl.parse(request.url), method: request.method }, 'New request');
	            }
	            try {
	                var cacheServerRequest = new cacheServerRequest_1.CacheServerRequest(_this.cdnConfig.defaultDomain, _this.logger, request);
	                cacheServerRequest.getIt(function (status, headers, content) {
	                    var headerKeys = Object.keys(headers);
	                    response.setHeader('Access-Control-Expose-Headers', headerKeys.join(','));
	                    response.writeHead(status, headers);
	                    debug('ACTUALLY GOING TO SEND BACK headers = ', headers);
	                    response.end(content);
	                });
	            }
	            catch (e) {
	                debug("Excpetion caught", e);
	                response.writeHead(501, {});
	                response.end(e.message);
	            }
	        };
	    }
	    CacheServer.prototype.connectRedisUrlCache = function (cb) {
	        cacheServerRequest_1.RedisCache.connectRedisUrlCache(this.cdnConfig.instanceName, this.cdnConfig.redisConfig, this.cdnConfig.defaultDomain, function (err) {
	            cb(err);
	        });
	    };
	    CacheServer.prototype.start = function (cb) {
	        var _this = this;
	        this.httpServer = http.createServer(this.urlServer);
	        this.connectRedisUrlCache(function (err) {
	            if (err) {
	                _this.logger.error({ err: err }, 'Error connecting with redis-url-cache');
	                throw new Error(err);
	            }
	            _this.httpServer.listen(_this.cdnConfig.port, function (err) {
	                cb(err);
	            });
	            _this.httpServer.on('clientError', function (err, socket) {
	                debug('On Client Error: ', err);
	                _this.logger.error({ err: err, socket: socket }, 'Socket error');
	                socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
	            });
	            _this.logger.warn('Cache Server launched');
	            debug('CacheServer ', _this.cdnConfig.instanceName, 'Launched');
	        });
	    };
	    CacheServer.prototype.stop = function (cb) {
	        this.httpServer.close(function (err) {
	            cb(err);
	        });
	    };
	    return CacheServer;
	}());
	module.exports = CacheServer;


/***/ },
/* 1 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";
	var redis_url_cache_1 = __webpack_require__(2);
	var nodeurl = __webpack_require__(3);
	var request = __webpack_require__(4);
	var iconv = __webpack_require__(5);
	var debug = __webpack_require__(6)('cdn-server');
	var RedisCache = (function () {
	    function RedisCache() {
	    }
	    RedisCache.connectRedisUrlCache = function (instanceName, redisConfig, defaultDomain, cb) {
	        var instance = new redis_url_cache_1.Instance(instanceName, redisConfig, {}, function (err) {
	            if (err)
	                return cb(err);
	            RedisCache.cacheEngine = new redis_url_cache_1.CacheEngineCB(defaultDomain, instance);
	            cb(null);
	        });
	    };
	    return RedisCache;
	}());
	exports.RedisCache = RedisCache;
	var CacheServerRequest = (function () {
	    function CacheServerRequest(defaultDomain, logger, request) {
	        this.defaultDomain = defaultDomain;
	        this.url = nodeurl.parse(request.url, true);
	        this.logger = logger.child({
	            script: 'CacheServer',
	            url: this.url
	        });
	        this.validateURL(request);
	        try {
	            this.urlCB = RedisCache.cacheEngine.url(this.url.query.url);
	        }
	        catch (e) {
	            this.logger.error({ e: e }, 'Error executin cacheEngine.url()');
	            debug('Error with url: request.url', request.url, e);
	            throw e;
	        }
	    }
	    CacheServerRequest.prototype.validateURL = function (request) {
	        if (this.url.pathname !== '/get' || typeof this.url.query.url === 'undefined') {
	            var error = new Error("Error - the URL is not valid - only '{hostname}/get?url=' is allowed");
	            this.logger.error({ err: error });
	            debug(error.message, this.url.pathname, this.url.query);
	            throw error;
	        }
	        this.headers = request.headers;
	        if (typeof this.headers['referer'] === 'undefined') {
	            if (typeof this.url.query.referer !== 'undefined') {
	                this.headers['referer'] = this.url.query.referer;
	            }
	            else {
	                var error = new Error('Error - the referer header is not set');
	                debug('no referer: headers = ', request.headers);
	                this.logger.error({ headers: request.headers, err: error });
	                throw error;
	            }
	        }
	        var parsedOriginalURL = nodeurl.parse(request.headers['referer']);
	        parsedOriginalURL.query = null;
	        parsedOriginalURL.path = null;
	        parsedOriginalURL.pathname = null;
	        parsedOriginalURL.hash = null;
	        parsedOriginalURL.search = null;
	        this.originalURL = nodeurl.format(parsedOriginalURL);
	        debug('original headers = ', this.headers);
	        delete this.headers['ngreferer'];
	    };
	    CacheServerRequest.prototype.getIt = function (cb) {
	        var _this = this;
	        debug('getIt called');
	        this.detectCachingStatus(function (cachingStatus) {
	            switch (cachingStatus) {
	                case 'ERROR':
	                case 'NEVER':
	                case 'NOT_CACHED':
	                    debug('IT IS NOT CACHED');
	                    _this.requestURL(false, _this.headers, function (err, result) {
	                        debug('INSIDE GETIT CB');
	                        if (err) {
	                            debug('ERROR while requesting ', _this.url.query.url, err);
	                            _this.logger.error({ err: err, cachingStatus: cachingStatus, headers: _this.headers }, err);
	                            return cb(501, { 'Content-Type': 'text/html' }, 'Error ' + err);
	                        }
	                        if (result.content.length === 0) {
	                            debug('ERROR while requesting ', _this.url.query.url);
	                            _this.logger.error({ cachingStatus: cachingStatus, headers: _this.headers }, 'Empty response');
	                            return cb(501, { 'Content-Type': 'text/html' }, 'Error response is empty' + JSON.stringify(result));
	                        }
	                        result.headers['caching-status'] = cachingStatus;
	                        if (cachingStatus !== 'NEVER') {
	                            _this.urlCB.set(result.content, {
	                                status: result.status,
	                                url: _this.urlCB.getUrl(),
	                                domain: _this.urlCB.getDomain(),
	                                headers: result.headers
	                            }, false, function (err, setResult) {
	                                if (err) {
	                                    debug(err);
	                                    _this.logger.error({ err: err, cachingStatus: cachingStatus, headers: _this.headers }, 'Error storing in redis-url-cache');
	                                    return cb(501, { 'Content-Type': 'text/html' }, 'Error ' + err);
	                                }
	                                result.headers['ngServerCached'] = 'yes';
	                                return cb(result.status, result.headers, result.content);
	                            });
	                        }
	                        else {
	                            result.headers['ngServerCached'] = 'no';
	                            return cb(result.status, result.headers, result.content);
	                        }
	                    });
	                    break;
	                case 'CACHED':
	                    debug('IT IS CACHED');
	                    _this.urlCB.get(function (err, content) {
	                        if (err) {
	                            debug(err);
	                            _this.logger.error({ err: err, cachingStatus: cachingStatus, headers: _this.headers }, "error retrieve content from redis-url-cache");
	                            return cb(501, { 'Content-Type': 'text/html' }, 'Error ' + err);
	                        }
	                        content.extra.headers['caching-status'] = cachingStatus;
	                        content.extra.headers['ngServerCached'] = 'yes';
	                        return cb(content.extra.status, content.extra.headers, content.content);
	                    });
	            }
	        });
	    };
	    CacheServerRequest.prototype.decode = function (headers, body) {
	        debug('DECODE CALLED', headers, body.substr(0, 30));
	        var re = /charset=([^()<>@,;:\"/[\]?.=\s]*)/i;
	        if (headers['content-type']) {
	            var charset = re.test(headers['content-type']) ? re.exec(headers['content-type'])[1] : 'utf-8';
	            debug('charset detected: ', charset);
	            if (charset === 'utf-8') {
	                return body;
	            }
	            var ic = new iconv.Iconv(charset, 'UTF-8');
	            var buffer = ic.convert(body);
	            return buffer.toString('utf-8');
	        }
	        throw new Error('content-type is missing');
	    };
	    CacheServerRequest.prototype.requestURL = function (binary, headers, cb) {
	        var _this = this;
	        debug('CALLING REQUEST URL with headers!', headers);
	        var newHeaders = {};
	        newHeaders['origin'] = this.originalURL;
	        newHeaders['user-agent'] = headers['user-agent'] ? headers['user-agent'] : 'Super User Agent';
	        if (typeof newHeaders['accept-encoding'] !== 'undefined') {
	            delete newHeaders['accept-encoding'];
	        }
	        if (headers['cookie'])
	            newHeaders['cookie'] = headers['cookie'];
	        var parsedURL = nodeurl.parse(this.url.query.url);
	        var url = parsedURL.host === null ? this.defaultDomain + this.url.query.url : this.url.query.url;
	        debug('GOING TO REQUEST', url, newHeaders);
	        request({
	            url: url,
	            headers: newHeaders
	        }, function (err, response, body) {
	            debug('INSIDE CALLBACK');
	            if (err) {
	                debug('Error caught in request callback', err);
	                return cb(err, null);
	            }
	            debug('body received, body.length  = ', body.length);
	            var dataResponse = {
	                status: response.statusCode,
	                content: body,
	                headers: _this.extractHeaders(response.headers)
	            };
	            debug('RESPONSE HEADERS', dataResponse.headers);
	            debug('body length = ', body.length);
	            cb(null, dataResponse);
	        });
	    };
	    CacheServerRequest.prototype.extractHeaders = function (receivedHeaders) {
	        var headers = {};
	        var headersToExtract = [
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
	        var keys = Object.keys(receivedHeaders);
	        var newReceivedHeaders = {};
	        keys.forEach(function (key) {
	            newReceivedHeaders[key.toLowerCase()] = receivedHeaders[key];
	        });
	        headersToExtract.forEach(function (name) {
	            if (newReceivedHeaders[name]) {
	                headers[name] = newReceivedHeaders[name];
	            }
	        });
	        headers['access-control-allow-origin'] = '*';
	        return headers;
	    };
	    CacheServerRequest.prototype.detectCachingStatus = function (cb) {
	        var _this = this;
	        this.urlCB.has(function (err, isCached) {
	            if (err) {
	                _this.logger.error({ err: err }, 'Error has()');
	                return cb('ERROR');
	            }
	            if (_this.urlCB.getCategory() === 'never') {
	                return cb('NEVER');
	            }
	            if (isCached) {
	                return cb('CACHED');
	            }
	            else {
	                return cb('NOT_CACHED');
	            }
	        });
	    };
	    return CacheServerRequest;
	}());
	exports.CacheServerRequest = CacheServerRequest;


/***/ },
/* 2 */
/***/ function(module, exports) {

	module.exports = require("redis-url-cache");

/***/ },
/* 3 */
/***/ function(module, exports) {

	module.exports = require("url");

/***/ },
/* 4 */
/***/ function(module, exports) {

	module.exports = require("request");

/***/ },
/* 5 */
/***/ function(module, exports) {

	module.exports = require("iconv");

/***/ },
/* 6 */
/***/ function(module, exports) {

	module.exports = require("debug");

/***/ },
/* 7 */
/***/ function(module, exports) {

	module.exports = require("http");

/***/ }
/******/ ]);
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIndlYnBhY2s6Ly8vd2VicGFjay9ib290c3RyYXAgNzlkYjQ5MDdiMGZkNmM3ODkxOTEiLCJ3ZWJwYWNrOi8vLy4vc3JjL2NhY2hlU2VydmVyLnRzIiwid2VicGFjazovLy8uL3NyYy9jYWNoZVNlcnZlclJlcXVlc3QudHMiLCJ3ZWJwYWNrOi8vL2V4dGVybmFsIFwicmVkaXMtdXJsLWNhY2hlXCIiLCJ3ZWJwYWNrOi8vL2V4dGVybmFsIFwidXJsXCIiLCJ3ZWJwYWNrOi8vL2V4dGVybmFsIFwicmVxdWVzdFwiIiwid2VicGFjazovLy9leHRlcm5hbCBcImljb252XCIiLCJ3ZWJwYWNrOi8vL2V4dGVybmFsIFwiZGVidWdcIiIsIndlYnBhY2s6Ly8vZXh0ZXJuYWwgXCJodHRwXCIiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQSx1QkFBZTtBQUNmO0FBQ0E7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOzs7QUFHQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBOzs7Ozs7O0FDdENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0Esb0NBQW1DLDBEQUEwRDtBQUM3RjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxrQkFBaUI7QUFDakI7QUFDQTtBQUNBO0FBQ0EsMkNBQTBDO0FBQzFDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsVUFBUztBQUNUO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLHFDQUFvQyxXQUFXO0FBQy9DO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsY0FBYTtBQUNiO0FBQ0E7QUFDQSxxQ0FBb0MsMkJBQTJCO0FBQy9EO0FBQ0EsY0FBYTtBQUNiO0FBQ0E7QUFDQSxVQUFTO0FBQ1Q7QUFDQTtBQUNBO0FBQ0E7QUFDQSxVQUFTO0FBQ1Q7QUFDQTtBQUNBLEVBQUM7QUFDRDs7Ozs7OztBQy9FQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLG9GQUFtRjtBQUNuRjtBQUNBO0FBQ0E7QUFDQTtBQUNBLFVBQVM7QUFDVDtBQUNBO0FBQ0EsRUFBQztBQUNEO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxVQUFTO0FBQ1Q7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLGdDQUErQixPQUFPO0FBQ3RDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLDBFQUF5RSxTQUFTO0FBQ2xGLGdDQUErQixhQUFhO0FBQzVDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxvQ0FBbUMsdUNBQXVDO0FBQzFFO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxpREFBZ0QsaUVBQWlFO0FBQ2pILDZDQUE0Qyw4QkFBOEI7QUFDMUU7QUFDQTtBQUNBO0FBQ0EsaURBQWdELHVEQUF1RDtBQUN2Ryw2Q0FBNEMsOEJBQThCO0FBQzFFO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSw4QkFBNkI7QUFDN0I7QUFDQTtBQUNBLHlEQUF3RCxpRUFBaUU7QUFDekgscURBQW9ELDhCQUE4QjtBQUNsRjtBQUNBO0FBQ0E7QUFDQSw4QkFBNkI7QUFDN0I7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLHNCQUFxQjtBQUNyQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxpREFBZ0QsaUVBQWlFO0FBQ2pILDZDQUE0Qyw4QkFBOEI7QUFDMUU7QUFDQTtBQUNBO0FBQ0E7QUFDQSxzQkFBcUI7QUFDckI7QUFDQSxVQUFTO0FBQ1Q7QUFDQTtBQUNBO0FBQ0EscUNBQW9DO0FBQ3BDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxVQUFTO0FBQ1Q7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFVBQVM7QUFDVDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsVUFBUztBQUNUO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsVUFBUztBQUNUO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EscUNBQW9DLFdBQVc7QUFDL0M7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFVBQVM7QUFDVDtBQUNBO0FBQ0EsRUFBQztBQUNEOzs7Ozs7O0FDL05BLDZDOzs7Ozs7QUNBQSxpQzs7Ozs7O0FDQUEscUM7Ozs7OztBQ0FBLG1DOzs7Ozs7QUNBQSxtQzs7Ozs7O0FDQUEsa0MiLCJmaWxlIjoiY2FjaGUtc2VydmVyLmpzIiwic291cmNlc0NvbnRlbnQiOlsiIFx0Ly8gVGhlIG1vZHVsZSBjYWNoZVxuIFx0dmFyIGluc3RhbGxlZE1vZHVsZXMgPSB7fTtcblxuIFx0Ly8gVGhlIHJlcXVpcmUgZnVuY3Rpb25cbiBcdGZ1bmN0aW9uIF9fd2VicGFja19yZXF1aXJlX18obW9kdWxlSWQpIHtcblxuIFx0XHQvLyBDaGVjayBpZiBtb2R1bGUgaXMgaW4gY2FjaGVcbiBcdFx0aWYoaW5zdGFsbGVkTW9kdWxlc1ttb2R1bGVJZF0pXG4gXHRcdFx0cmV0dXJuIGluc3RhbGxlZE1vZHVsZXNbbW9kdWxlSWRdLmV4cG9ydHM7XG5cbiBcdFx0Ly8gQ3JlYXRlIGEgbmV3IG1vZHVsZSAoYW5kIHB1dCBpdCBpbnRvIHRoZSBjYWNoZSlcbiBcdFx0dmFyIG1vZHVsZSA9IGluc3RhbGxlZE1vZHVsZXNbbW9kdWxlSWRdID0ge1xuIFx0XHRcdGV4cG9ydHM6IHt9LFxuIFx0XHRcdGlkOiBtb2R1bGVJZCxcbiBcdFx0XHRsb2FkZWQ6IGZhbHNlXG4gXHRcdH07XG5cbiBcdFx0Ly8gRXhlY3V0ZSB0aGUgbW9kdWxlIGZ1bmN0aW9uXG4gXHRcdG1vZHVsZXNbbW9kdWxlSWRdLmNhbGwobW9kdWxlLmV4cG9ydHMsIG1vZHVsZSwgbW9kdWxlLmV4cG9ydHMsIF9fd2VicGFja19yZXF1aXJlX18pO1xuXG4gXHRcdC8vIEZsYWcgdGhlIG1vZHVsZSBhcyBsb2FkZWRcbiBcdFx0bW9kdWxlLmxvYWRlZCA9IHRydWU7XG5cbiBcdFx0Ly8gUmV0dXJuIHRoZSBleHBvcnRzIG9mIHRoZSBtb2R1bGVcbiBcdFx0cmV0dXJuIG1vZHVsZS5leHBvcnRzO1xuIFx0fVxuXG5cbiBcdC8vIGV4cG9zZSB0aGUgbW9kdWxlcyBvYmplY3QgKF9fd2VicGFja19tb2R1bGVzX18pXG4gXHRfX3dlYnBhY2tfcmVxdWlyZV9fLm0gPSBtb2R1bGVzO1xuXG4gXHQvLyBleHBvc2UgdGhlIG1vZHVsZSBjYWNoZVxuIFx0X193ZWJwYWNrX3JlcXVpcmVfXy5jID0gaW5zdGFsbGVkTW9kdWxlcztcblxuIFx0Ly8gX193ZWJwYWNrX3B1YmxpY19wYXRoX19cbiBcdF9fd2VicGFja19yZXF1aXJlX18ucCA9IFwiXCI7XG5cbiBcdC8vIExvYWQgZW50cnkgbW9kdWxlIGFuZCByZXR1cm4gZXhwb3J0c1xuIFx0cmV0dXJuIF9fd2VicGFja19yZXF1aXJlX18oMCk7XG5cblxuXG4vLyBXRUJQQUNLIEZPT1RFUiAvL1xuLy8gd2VicGFjay9ib290c3RyYXAgNzlkYjQ5MDdiMGZkNmM3ODkxOTEiLCJcInVzZSBzdHJpY3RcIjtcbnZhciBjYWNoZVNlcnZlclJlcXVlc3RfMSA9IHJlcXVpcmUoJy4vY2FjaGVTZXJ2ZXJSZXF1ZXN0Jyk7XG52YXIgbm9kZXVybCA9IHJlcXVpcmUoJ3VybCcpO1xudmFyIGh0dHAgPSByZXF1aXJlKCdodHRwJyk7XG52YXIgcmVxdWVzdCA9IHJlcXVpcmUoJ3JlcXVlc3QnKTtcbnZhciBpY29udiA9IHJlcXVpcmUoJ2ljb252Jyk7XG52YXIgZGVidWcgPSByZXF1aXJlKCdkZWJ1ZycpKCdjZG4tc2VydmVyJyk7XG52YXIgQ2FjaGVTZXJ2ZXIgPSAoZnVuY3Rpb24gKCkge1xuICAgIGZ1bmN0aW9uIENhY2hlU2VydmVyKGNkbkNvbmZpZywgbG9nZ2VyKSB7XG4gICAgICAgIHZhciBfdGhpcyA9IHRoaXM7XG4gICAgICAgIHRoaXMuY2RuQ29uZmlnID0gY2RuQ29uZmlnO1xuICAgICAgICB0aGlzLmxvZ2dlciA9IGxvZ2dlcjtcbiAgICAgICAgdGhpcy51cmxTZXJ2ZXIgPSBmdW5jdGlvbiAocmVxdWVzdCwgcmVzcG9uc2UpIHtcbiAgICAgICAgICAgIHJlc3BvbnNlLnNldEhlYWRlcignQWNjZXNzLUNvbnRyb2wtQWxsb3ctT3JpZ2luJywgJyonKTtcbiAgICAgICAgICAgIHJlc3BvbnNlLnNldEhlYWRlcignQWNjZXNzLUNvbnRyb2wtUmVxdWVzdC1NZXRob2QnLCAnKicpO1xuICAgICAgICAgICAgcmVzcG9uc2Uuc2V0SGVhZGVyKCdBY2Nlc3MtQ29udHJvbC1BbGxvdy1NZXRob2RzJywgJ09QVElPTlMsIEdFVCcpO1xuICAgICAgICAgICAgaWYgKHR5cGVvZiByZXF1ZXN0LmhlYWRlcnNbJ2FjY2Vzcy1jb250cm9sLXJlcXVlc3QtaGVhZGVycyddICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgICAgIHJlc3BvbnNlLnNldEhlYWRlcignQWNjZXNzLUNvbnRyb2wtQWxsb3ctSGVhZGVycycsIHJlcXVlc3QuaGVhZGVyc1snYWNjZXNzLWNvbnRyb2wtcmVxdWVzdC1oZWFkZXJzJ10pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHJlcXVlc3QubWV0aG9kID09PSAnT1BUSU9OJyB8fCByZXF1ZXN0Lm1ldGhvZCA9PT0gJ09QVElPTlMnKSB7XG4gICAgICAgICAgICAgICAgZGVidWcoJ29wdGlvbiBjYWxsIGZvciAnLCByZXF1ZXN0LnVybCk7XG4gICAgICAgICAgICAgICAgZGVidWcocmVxdWVzdC5oZWFkZXJzKTtcbiAgICAgICAgICAgICAgICByZXNwb25zZS53cml0ZUhlYWQoMjAwKTtcbiAgICAgICAgICAgICAgICByZXNwb25zZS5lbmQoKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBkZWJ1ZygncmVxdWVzdGluZyAnLCByZXF1ZXN0Lm1ldGhvZCwgcmVxdWVzdC51cmwpO1xuICAgICAgICAgICAgICAgIF90aGlzLmxvZ2dlci5pbmZvKHsgdXJsOiBub2RldXJsLnBhcnNlKHJlcXVlc3QudXJsKSwgbWV0aG9kOiByZXF1ZXN0Lm1ldGhvZCB9LCAnTmV3IHJlcXVlc3QnKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgdmFyIGNhY2hlU2VydmVyUmVxdWVzdCA9IG5ldyBjYWNoZVNlcnZlclJlcXVlc3RfMS5DYWNoZVNlcnZlclJlcXVlc3QoX3RoaXMuY2RuQ29uZmlnLmRlZmF1bHREb21haW4sIF90aGlzLmxvZ2dlciwgcmVxdWVzdCk7XG4gICAgICAgICAgICAgICAgY2FjaGVTZXJ2ZXJSZXF1ZXN0LmdldEl0KGZ1bmN0aW9uIChzdGF0dXMsIGhlYWRlcnMsIGNvbnRlbnQpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGhlYWRlcktleXMgPSBPYmplY3Qua2V5cyhoZWFkZXJzKTtcbiAgICAgICAgICAgICAgICAgICAgcmVzcG9uc2Uuc2V0SGVhZGVyKCdBY2Nlc3MtQ29udHJvbC1FeHBvc2UtSGVhZGVycycsIGhlYWRlcktleXMuam9pbignLCcpKTtcbiAgICAgICAgICAgICAgICAgICAgcmVzcG9uc2Uud3JpdGVIZWFkKHN0YXR1cywgaGVhZGVycyk7XG4gICAgICAgICAgICAgICAgICAgIGRlYnVnKCdBQ1RVQUxMWSBHT0lORyBUTyBTRU5EIEJBQ0sgaGVhZGVycyA9ICcsIGhlYWRlcnMpO1xuICAgICAgICAgICAgICAgICAgICByZXNwb25zZS5lbmQoY29udGVudCk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICAgIGRlYnVnKFwiRXhjcGV0aW9uIGNhdWdodFwiLCBlKTtcbiAgICAgICAgICAgICAgICByZXNwb25zZS53cml0ZUhlYWQoNTAxLCB7fSk7XG4gICAgICAgICAgICAgICAgcmVzcG9uc2UuZW5kKGUubWVzc2FnZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgfVxuICAgIENhY2hlU2VydmVyLnByb3RvdHlwZS5jb25uZWN0UmVkaXNVcmxDYWNoZSA9IGZ1bmN0aW9uIChjYikge1xuICAgICAgICBjYWNoZVNlcnZlclJlcXVlc3RfMS5SZWRpc0NhY2hlLmNvbm5lY3RSZWRpc1VybENhY2hlKHRoaXMuY2RuQ29uZmlnLmluc3RhbmNlTmFtZSwgdGhpcy5jZG5Db25maWcucmVkaXNDb25maWcsIHRoaXMuY2RuQ29uZmlnLmRlZmF1bHREb21haW4sIGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgICAgIGNiKGVycik7XG4gICAgICAgIH0pO1xuICAgIH07XG4gICAgQ2FjaGVTZXJ2ZXIucHJvdG90eXBlLnN0YXJ0ID0gZnVuY3Rpb24gKGNiKSB7XG4gICAgICAgIHZhciBfdGhpcyA9IHRoaXM7XG4gICAgICAgIHRoaXMuaHR0cFNlcnZlciA9IGh0dHAuY3JlYXRlU2VydmVyKHRoaXMudXJsU2VydmVyKTtcbiAgICAgICAgdGhpcy5jb25uZWN0UmVkaXNVcmxDYWNoZShmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgX3RoaXMubG9nZ2VyLmVycm9yKHsgZXJyOiBlcnIgfSwgJ0Vycm9yIGNvbm5lY3Rpbmcgd2l0aCByZWRpcy11cmwtY2FjaGUnKTtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoZXJyKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIF90aGlzLmh0dHBTZXJ2ZXIubGlzdGVuKF90aGlzLmNkbkNvbmZpZy5wb3J0LCBmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgY2IoZXJyKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgX3RoaXMuaHR0cFNlcnZlci5vbignY2xpZW50RXJyb3InLCBmdW5jdGlvbiAoZXJyLCBzb2NrZXQpIHtcbiAgICAgICAgICAgICAgICBkZWJ1ZygnT24gQ2xpZW50IEVycm9yOiAnLCBlcnIpO1xuICAgICAgICAgICAgICAgIF90aGlzLmxvZ2dlci5lcnJvcih7IGVycjogZXJyLCBzb2NrZXQ6IHNvY2tldCB9LCAnU29ja2V0IGVycm9yJyk7XG4gICAgICAgICAgICAgICAgc29ja2V0LmVuZCgnSFRUUC8xLjEgNDAwIEJhZCBSZXF1ZXN0XFxyXFxuXFxyXFxuJyk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIF90aGlzLmxvZ2dlci53YXJuKCdDYWNoZSBTZXJ2ZXIgbGF1bmNoZWQnKTtcbiAgICAgICAgICAgIGRlYnVnKCdDYWNoZVNlcnZlciAnLCBfdGhpcy5jZG5Db25maWcuaW5zdGFuY2VOYW1lLCAnTGF1bmNoZWQnKTtcbiAgICAgICAgfSk7XG4gICAgfTtcbiAgICBDYWNoZVNlcnZlci5wcm90b3R5cGUuc3RvcCA9IGZ1bmN0aW9uIChjYikge1xuICAgICAgICB0aGlzLmh0dHBTZXJ2ZXIuY2xvc2UoZnVuY3Rpb24gKGVycikge1xuICAgICAgICAgICAgY2IoZXJyKTtcbiAgICAgICAgfSk7XG4gICAgfTtcbiAgICByZXR1cm4gQ2FjaGVTZXJ2ZXI7XG59KCkpO1xubW9kdWxlLmV4cG9ydHMgPSBDYWNoZVNlcnZlcjtcblxuXG5cbi8vLy8vLy8vLy8vLy8vLy8vL1xuLy8gV0VCUEFDSyBGT09URVJcbi8vIC4vc3JjL2NhY2hlU2VydmVyLnRzXG4vLyBtb2R1bGUgaWQgPSAwXG4vLyBtb2R1bGUgY2h1bmtzID0gMCIsIlwidXNlIHN0cmljdFwiO1xudmFyIHJlZGlzX3VybF9jYWNoZV8xID0gcmVxdWlyZSgncmVkaXMtdXJsLWNhY2hlJyk7XG52YXIgbm9kZXVybCA9IHJlcXVpcmUoJ3VybCcpO1xudmFyIHJlcXVlc3QgPSByZXF1aXJlKCdyZXF1ZXN0Jyk7XG52YXIgaWNvbnYgPSByZXF1aXJlKCdpY29udicpO1xudmFyIGRlYnVnID0gcmVxdWlyZSgnZGVidWcnKSgnY2RuLXNlcnZlcicpO1xudmFyIFJlZGlzQ2FjaGUgPSAoZnVuY3Rpb24gKCkge1xuICAgIGZ1bmN0aW9uIFJlZGlzQ2FjaGUoKSB7XG4gICAgfVxuICAgIFJlZGlzQ2FjaGUuY29ubmVjdFJlZGlzVXJsQ2FjaGUgPSBmdW5jdGlvbiAoaW5zdGFuY2VOYW1lLCByZWRpc0NvbmZpZywgZGVmYXVsdERvbWFpbiwgY2IpIHtcbiAgICAgICAgdmFyIGluc3RhbmNlID0gbmV3IHJlZGlzX3VybF9jYWNoZV8xLkluc3RhbmNlKGluc3RhbmNlTmFtZSwgcmVkaXNDb25maWcsIHt9LCBmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgICAgICBpZiAoZXJyKVxuICAgICAgICAgICAgICAgIHJldHVybiBjYihlcnIpO1xuICAgICAgICAgICAgUmVkaXNDYWNoZS5jYWNoZUVuZ2luZSA9IG5ldyByZWRpc191cmxfY2FjaGVfMS5DYWNoZUVuZ2luZUNCKGRlZmF1bHREb21haW4sIGluc3RhbmNlKTtcbiAgICAgICAgICAgIGNiKG51bGwpO1xuICAgICAgICB9KTtcbiAgICB9O1xuICAgIHJldHVybiBSZWRpc0NhY2hlO1xufSgpKTtcbmV4cG9ydHMuUmVkaXNDYWNoZSA9IFJlZGlzQ2FjaGU7XG52YXIgQ2FjaGVTZXJ2ZXJSZXF1ZXN0ID0gKGZ1bmN0aW9uICgpIHtcbiAgICBmdW5jdGlvbiBDYWNoZVNlcnZlclJlcXVlc3QoZGVmYXVsdERvbWFpbiwgbG9nZ2VyLCByZXF1ZXN0KSB7XG4gICAgICAgIHRoaXMuZGVmYXVsdERvbWFpbiA9IGRlZmF1bHREb21haW47XG4gICAgICAgIHRoaXMudXJsID0gbm9kZXVybC5wYXJzZShyZXF1ZXN0LnVybCwgdHJ1ZSk7XG4gICAgICAgIHRoaXMubG9nZ2VyID0gbG9nZ2VyLmNoaWxkKHtcbiAgICAgICAgICAgIHNjcmlwdDogJ0NhY2hlU2VydmVyJyxcbiAgICAgICAgICAgIHVybDogdGhpcy51cmxcbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMudmFsaWRhdGVVUkwocmVxdWVzdCk7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICB0aGlzLnVybENCID0gUmVkaXNDYWNoZS5jYWNoZUVuZ2luZS51cmwodGhpcy51cmwucXVlcnkudXJsKTtcbiAgICAgICAgfVxuICAgICAgICBjYXRjaCAoZSkge1xuICAgICAgICAgICAgdGhpcy5sb2dnZXIuZXJyb3IoeyBlOiBlIH0sICdFcnJvciBleGVjdXRpbiBjYWNoZUVuZ2luZS51cmwoKScpO1xuICAgICAgICAgICAgZGVidWcoJ0Vycm9yIHdpdGggdXJsOiByZXF1ZXN0LnVybCcsIHJlcXVlc3QudXJsLCBlKTtcbiAgICAgICAgICAgIHRocm93IGU7XG4gICAgICAgIH1cbiAgICB9XG4gICAgQ2FjaGVTZXJ2ZXJSZXF1ZXN0LnByb3RvdHlwZS52YWxpZGF0ZVVSTCA9IGZ1bmN0aW9uIChyZXF1ZXN0KSB7XG4gICAgICAgIGlmICh0aGlzLnVybC5wYXRobmFtZSAhPT0gJy9nZXQnIHx8IHR5cGVvZiB0aGlzLnVybC5xdWVyeS51cmwgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICB2YXIgZXJyb3IgPSBuZXcgRXJyb3IoXCJFcnJvciAtIHRoZSBVUkwgaXMgbm90IHZhbGlkIC0gb25seSAne2hvc3RuYW1lfS9nZXQ/dXJsPScgaXMgYWxsb3dlZFwiKTtcbiAgICAgICAgICAgIHRoaXMubG9nZ2VyLmVycm9yKHsgZXJyOiBlcnJvciB9KTtcbiAgICAgICAgICAgIGRlYnVnKGVycm9yLm1lc3NhZ2UsIHRoaXMudXJsLnBhdGhuYW1lLCB0aGlzLnVybC5xdWVyeSk7XG4gICAgICAgICAgICB0aHJvdyBlcnJvcjtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmhlYWRlcnMgPSByZXF1ZXN0LmhlYWRlcnM7XG4gICAgICAgIGlmICh0eXBlb2YgdGhpcy5oZWFkZXJzWydyZWZlcmVyJ10gPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICBpZiAodHlwZW9mIHRoaXMudXJsLnF1ZXJ5LnJlZmVyZXIgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5oZWFkZXJzWydyZWZlcmVyJ10gPSB0aGlzLnVybC5xdWVyeS5yZWZlcmVyO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgdmFyIGVycm9yID0gbmV3IEVycm9yKCdFcnJvciAtIHRoZSByZWZlcmVyIGhlYWRlciBpcyBub3Qgc2V0Jyk7XG4gICAgICAgICAgICAgICAgZGVidWcoJ25vIHJlZmVyZXI6IGhlYWRlcnMgPSAnLCByZXF1ZXN0LmhlYWRlcnMpO1xuICAgICAgICAgICAgICAgIHRoaXMubG9nZ2VyLmVycm9yKHsgaGVhZGVyczogcmVxdWVzdC5oZWFkZXJzLCBlcnI6IGVycm9yIH0pO1xuICAgICAgICAgICAgICAgIHRocm93IGVycm9yO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHZhciBwYXJzZWRPcmlnaW5hbFVSTCA9IG5vZGV1cmwucGFyc2UocmVxdWVzdC5oZWFkZXJzWydyZWZlcmVyJ10pO1xuICAgICAgICBwYXJzZWRPcmlnaW5hbFVSTC5xdWVyeSA9IG51bGw7XG4gICAgICAgIHBhcnNlZE9yaWdpbmFsVVJMLnBhdGggPSBudWxsO1xuICAgICAgICBwYXJzZWRPcmlnaW5hbFVSTC5wYXRobmFtZSA9IG51bGw7XG4gICAgICAgIHBhcnNlZE9yaWdpbmFsVVJMLmhhc2ggPSBudWxsO1xuICAgICAgICBwYXJzZWRPcmlnaW5hbFVSTC5zZWFyY2ggPSBudWxsO1xuICAgICAgICB0aGlzLm9yaWdpbmFsVVJMID0gbm9kZXVybC5mb3JtYXQocGFyc2VkT3JpZ2luYWxVUkwpO1xuICAgICAgICBkZWJ1Zygnb3JpZ2luYWwgaGVhZGVycyA9ICcsIHRoaXMuaGVhZGVycyk7XG4gICAgICAgIGRlbGV0ZSB0aGlzLmhlYWRlcnNbJ25ncmVmZXJlciddO1xuICAgIH07XG4gICAgQ2FjaGVTZXJ2ZXJSZXF1ZXN0LnByb3RvdHlwZS5nZXRJdCA9IGZ1bmN0aW9uIChjYikge1xuICAgICAgICB2YXIgX3RoaXMgPSB0aGlzO1xuICAgICAgICBkZWJ1ZygnZ2V0SXQgY2FsbGVkJyk7XG4gICAgICAgIHRoaXMuZGV0ZWN0Q2FjaGluZ1N0YXR1cyhmdW5jdGlvbiAoY2FjaGluZ1N0YXR1cykge1xuICAgICAgICAgICAgc3dpdGNoIChjYWNoaW5nU3RhdHVzKSB7XG4gICAgICAgICAgICAgICAgY2FzZSAnRVJST1InOlxuICAgICAgICAgICAgICAgIGNhc2UgJ05FVkVSJzpcbiAgICAgICAgICAgICAgICBjYXNlICdOT1RfQ0FDSEVEJzpcbiAgICAgICAgICAgICAgICAgICAgZGVidWcoJ0lUIElTIE5PVCBDQUNIRUQnKTtcbiAgICAgICAgICAgICAgICAgICAgX3RoaXMucmVxdWVzdFVSTChmYWxzZSwgX3RoaXMuaGVhZGVycywgZnVuY3Rpb24gKGVyciwgcmVzdWx0KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBkZWJ1ZygnSU5TSURFIEdFVElUIENCJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVidWcoJ0VSUk9SIHdoaWxlIHJlcXVlc3RpbmcgJywgX3RoaXMudXJsLnF1ZXJ5LnVybCwgZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBfdGhpcy5sb2dnZXIuZXJyb3IoeyBlcnI6IGVyciwgY2FjaGluZ1N0YXR1czogY2FjaGluZ1N0YXR1cywgaGVhZGVyczogX3RoaXMuaGVhZGVycyB9LCBlcnIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBjYig1MDEsIHsgJ0NvbnRlbnQtVHlwZSc6ICd0ZXh0L2h0bWwnIH0sICdFcnJvciAnICsgZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChyZXN1bHQuY29udGVudC5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZWJ1ZygnRVJST1Igd2hpbGUgcmVxdWVzdGluZyAnLCBfdGhpcy51cmwucXVlcnkudXJsKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBfdGhpcy5sb2dnZXIuZXJyb3IoeyBjYWNoaW5nU3RhdHVzOiBjYWNoaW5nU3RhdHVzLCBoZWFkZXJzOiBfdGhpcy5oZWFkZXJzIH0sICdFbXB0eSByZXNwb25zZScpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBjYig1MDEsIHsgJ0NvbnRlbnQtVHlwZSc6ICd0ZXh0L2h0bWwnIH0sICdFcnJvciByZXNwb25zZSBpcyBlbXB0eScgKyBKU09OLnN0cmluZ2lmeShyZXN1bHQpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIHJlc3VsdC5oZWFkZXJzWydjYWNoaW5nLXN0YXR1cyddID0gY2FjaGluZ1N0YXR1cztcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChjYWNoaW5nU3RhdHVzICE9PSAnTkVWRVInKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgX3RoaXMudXJsQ0Iuc2V0KHJlc3VsdC5jb250ZW50LCB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0YXR1czogcmVzdWx0LnN0YXR1cyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdXJsOiBfdGhpcy51cmxDQi5nZXRVcmwoKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZG9tYWluOiBfdGhpcy51cmxDQi5nZXREb21haW4oKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaGVhZGVyczogcmVzdWx0LmhlYWRlcnNcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9LCBmYWxzZSwgZnVuY3Rpb24gKGVyciwgc2V0UmVzdWx0KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlYnVnKGVycik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBfdGhpcy5sb2dnZXIuZXJyb3IoeyBlcnI6IGVyciwgY2FjaGluZ1N0YXR1czogY2FjaGluZ1N0YXR1cywgaGVhZGVyczogX3RoaXMuaGVhZGVycyB9LCAnRXJyb3Igc3RvcmluZyBpbiByZWRpcy11cmwtY2FjaGUnKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBjYig1MDEsIHsgJ0NvbnRlbnQtVHlwZSc6ICd0ZXh0L2h0bWwnIH0sICdFcnJvciAnICsgZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXN1bHQuaGVhZGVyc1snbmdTZXJ2ZXJDYWNoZWQnXSA9ICd5ZXMnO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gY2IocmVzdWx0LnN0YXR1cywgcmVzdWx0LmhlYWRlcnMsIHJlc3VsdC5jb250ZW50KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlc3VsdC5oZWFkZXJzWyduZ1NlcnZlckNhY2hlZCddID0gJ25vJztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gY2IocmVzdWx0LnN0YXR1cywgcmVzdWx0LmhlYWRlcnMsIHJlc3VsdC5jb250ZW50KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIGNhc2UgJ0NBQ0hFRCc6XG4gICAgICAgICAgICAgICAgICAgIGRlYnVnKCdJVCBJUyBDQUNIRUQnKTtcbiAgICAgICAgICAgICAgICAgICAgX3RoaXMudXJsQ0IuZ2V0KGZ1bmN0aW9uIChlcnIsIGNvbnRlbnQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZWJ1ZyhlcnIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIF90aGlzLmxvZ2dlci5lcnJvcih7IGVycjogZXJyLCBjYWNoaW5nU3RhdHVzOiBjYWNoaW5nU3RhdHVzLCBoZWFkZXJzOiBfdGhpcy5oZWFkZXJzIH0sIFwiZXJyb3IgcmV0cmlldmUgY29udGVudCBmcm9tIHJlZGlzLXVybC1jYWNoZVwiKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gY2IoNTAxLCB7ICdDb250ZW50LVR5cGUnOiAndGV4dC9odG1sJyB9LCAnRXJyb3IgJyArIGVycik7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBjb250ZW50LmV4dHJhLmhlYWRlcnNbJ2NhY2hpbmctc3RhdHVzJ10gPSBjYWNoaW5nU3RhdHVzO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29udGVudC5leHRyYS5oZWFkZXJzWyduZ1NlcnZlckNhY2hlZCddID0gJ3llcyc7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gY2IoY29udGVudC5leHRyYS5zdGF0dXMsIGNvbnRlbnQuZXh0cmEuaGVhZGVycywgY29udGVudC5jb250ZW50KTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH07XG4gICAgQ2FjaGVTZXJ2ZXJSZXF1ZXN0LnByb3RvdHlwZS5kZWNvZGUgPSBmdW5jdGlvbiAoaGVhZGVycywgYm9keSkge1xuICAgICAgICBkZWJ1ZygnREVDT0RFIENBTExFRCcsIGhlYWRlcnMsIGJvZHkuc3Vic3RyKDAsIDMwKSk7XG4gICAgICAgIHZhciByZSA9IC9jaGFyc2V0PShbXigpPD5ALDs6XFxcIi9bXFxdPy49XFxzXSopL2k7XG4gICAgICAgIGlmIChoZWFkZXJzWydjb250ZW50LXR5cGUnXSkge1xuICAgICAgICAgICAgdmFyIGNoYXJzZXQgPSByZS50ZXN0KGhlYWRlcnNbJ2NvbnRlbnQtdHlwZSddKSA/IHJlLmV4ZWMoaGVhZGVyc1snY29udGVudC10eXBlJ10pWzFdIDogJ3V0Zi04JztcbiAgICAgICAgICAgIGRlYnVnKCdjaGFyc2V0IGRldGVjdGVkOiAnLCBjaGFyc2V0KTtcbiAgICAgICAgICAgIGlmIChjaGFyc2V0ID09PSAndXRmLTgnKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGJvZHk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB2YXIgaWMgPSBuZXcgaWNvbnYuSWNvbnYoY2hhcnNldCwgJ1VURi04Jyk7XG4gICAgICAgICAgICB2YXIgYnVmZmVyID0gaWMuY29udmVydChib2R5KTtcbiAgICAgICAgICAgIHJldHVybiBidWZmZXIudG9TdHJpbmcoJ3V0Zi04Jyk7XG4gICAgICAgIH1cbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdjb250ZW50LXR5cGUgaXMgbWlzc2luZycpO1xuICAgIH07XG4gICAgQ2FjaGVTZXJ2ZXJSZXF1ZXN0LnByb3RvdHlwZS5yZXF1ZXN0VVJMID0gZnVuY3Rpb24gKGJpbmFyeSwgaGVhZGVycywgY2IpIHtcbiAgICAgICAgdmFyIF90aGlzID0gdGhpcztcbiAgICAgICAgZGVidWcoJ0NBTExJTkcgUkVRVUVTVCBVUkwgd2l0aCBoZWFkZXJzIScsIGhlYWRlcnMpO1xuICAgICAgICB2YXIgbmV3SGVhZGVycyA9IHt9O1xuICAgICAgICBuZXdIZWFkZXJzWydvcmlnaW4nXSA9IHRoaXMub3JpZ2luYWxVUkw7XG4gICAgICAgIG5ld0hlYWRlcnNbJ3VzZXItYWdlbnQnXSA9IGhlYWRlcnNbJ3VzZXItYWdlbnQnXSA/IGhlYWRlcnNbJ3VzZXItYWdlbnQnXSA6ICdTdXBlciBVc2VyIEFnZW50JztcbiAgICAgICAgaWYgKHR5cGVvZiBuZXdIZWFkZXJzWydhY2NlcHQtZW5jb2RpbmcnXSAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgIGRlbGV0ZSBuZXdIZWFkZXJzWydhY2NlcHQtZW5jb2RpbmcnXTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoaGVhZGVyc1snY29va2llJ10pXG4gICAgICAgICAgICBuZXdIZWFkZXJzWydjb29raWUnXSA9IGhlYWRlcnNbJ2Nvb2tpZSddO1xuICAgICAgICB2YXIgcGFyc2VkVVJMID0gbm9kZXVybC5wYXJzZSh0aGlzLnVybC5xdWVyeS51cmwpO1xuICAgICAgICB2YXIgdXJsID0gcGFyc2VkVVJMLmhvc3QgPT09IG51bGwgPyB0aGlzLmRlZmF1bHREb21haW4gKyB0aGlzLnVybC5xdWVyeS51cmwgOiB0aGlzLnVybC5xdWVyeS51cmw7XG4gICAgICAgIGRlYnVnKCdHT0lORyBUTyBSRVFVRVNUJywgdXJsLCBuZXdIZWFkZXJzKTtcbiAgICAgICAgcmVxdWVzdCh7XG4gICAgICAgICAgICB1cmw6IHVybCxcbiAgICAgICAgICAgIGhlYWRlcnM6IG5ld0hlYWRlcnNcbiAgICAgICAgfSwgZnVuY3Rpb24gKGVyciwgcmVzcG9uc2UsIGJvZHkpIHtcbiAgICAgICAgICAgIGRlYnVnKCdJTlNJREUgQ0FMTEJBQ0snKTtcbiAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICBkZWJ1ZygnRXJyb3IgY2F1Z2h0IGluIHJlcXVlc3QgY2FsbGJhY2snLCBlcnIpO1xuICAgICAgICAgICAgICAgIHJldHVybiBjYihlcnIsIG51bGwpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZGVidWcoJ2JvZHkgcmVjZWl2ZWQsIGJvZHkubGVuZ3RoICA9ICcsIGJvZHkubGVuZ3RoKTtcbiAgICAgICAgICAgIHZhciBkYXRhUmVzcG9uc2UgPSB7XG4gICAgICAgICAgICAgICAgc3RhdHVzOiByZXNwb25zZS5zdGF0dXNDb2RlLFxuICAgICAgICAgICAgICAgIGNvbnRlbnQ6IGJvZHksXG4gICAgICAgICAgICAgICAgaGVhZGVyczogX3RoaXMuZXh0cmFjdEhlYWRlcnMocmVzcG9uc2UuaGVhZGVycylcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBkZWJ1ZygnUkVTUE9OU0UgSEVBREVSUycsIGRhdGFSZXNwb25zZS5oZWFkZXJzKTtcbiAgICAgICAgICAgIGRlYnVnKCdib2R5IGxlbmd0aCA9ICcsIGJvZHkubGVuZ3RoKTtcbiAgICAgICAgICAgIGNiKG51bGwsIGRhdGFSZXNwb25zZSk7XG4gICAgICAgIH0pO1xuICAgIH07XG4gICAgQ2FjaGVTZXJ2ZXJSZXF1ZXN0LnByb3RvdHlwZS5leHRyYWN0SGVhZGVycyA9IGZ1bmN0aW9uIChyZWNlaXZlZEhlYWRlcnMpIHtcbiAgICAgICAgdmFyIGhlYWRlcnMgPSB7fTtcbiAgICAgICAgdmFyIGhlYWRlcnNUb0V4dHJhY3QgPSBbXG4gICAgICAgICAgICAnYWNjZXNzLWNvbnRyb2wtYWxsb3ctb3JpZ2luJyxcbiAgICAgICAgICAgICdjYWNoZS1jb250cm9sJyxcbiAgICAgICAgICAgICdjb250ZW50LWVuY29kaW5nJyxcbiAgICAgICAgICAgICdjb250ZW50LXR5cGUnLFxuICAgICAgICAgICAgJ2V0YWcnLFxuICAgICAgICAgICAgJ3NldC1jb29raWUnLFxuICAgICAgICAgICAgJ3ZhcnknLFxuICAgICAgICAgICAgJ2Nvbm5lY3Rpb24nLFxuICAgICAgICAgICAgJ2V4cGlyZXMnLFxuICAgICAgICAgICAgJ2RhdGUnLFxuICAgICAgICAgICAgJ2xhc3QtbW9kaWZpZWQnXG4gICAgICAgIF07XG4gICAgICAgIHZhciBrZXlzID0gT2JqZWN0LmtleXMocmVjZWl2ZWRIZWFkZXJzKTtcbiAgICAgICAgdmFyIG5ld1JlY2VpdmVkSGVhZGVycyA9IHt9O1xuICAgICAgICBrZXlzLmZvckVhY2goZnVuY3Rpb24gKGtleSkge1xuICAgICAgICAgICAgbmV3UmVjZWl2ZWRIZWFkZXJzW2tleS50b0xvd2VyQ2FzZSgpXSA9IHJlY2VpdmVkSGVhZGVyc1trZXldO1xuICAgICAgICB9KTtcbiAgICAgICAgaGVhZGVyc1RvRXh0cmFjdC5mb3JFYWNoKGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgICAgICAgICBpZiAobmV3UmVjZWl2ZWRIZWFkZXJzW25hbWVdKSB7XG4gICAgICAgICAgICAgICAgaGVhZGVyc1tuYW1lXSA9IG5ld1JlY2VpdmVkSGVhZGVyc1tuYW1lXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICAgIGhlYWRlcnNbJ2FjY2Vzcy1jb250cm9sLWFsbG93LW9yaWdpbiddID0gJyonO1xuICAgICAgICByZXR1cm4gaGVhZGVycztcbiAgICB9O1xuICAgIENhY2hlU2VydmVyUmVxdWVzdC5wcm90b3R5cGUuZGV0ZWN0Q2FjaGluZ1N0YXR1cyA9IGZ1bmN0aW9uIChjYikge1xuICAgICAgICB2YXIgX3RoaXMgPSB0aGlzO1xuICAgICAgICB0aGlzLnVybENCLmhhcyhmdW5jdGlvbiAoZXJyLCBpc0NhY2hlZCkge1xuICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgIF90aGlzLmxvZ2dlci5lcnJvcih7IGVycjogZXJyIH0sICdFcnJvciBoYXMoKScpO1xuICAgICAgICAgICAgICAgIHJldHVybiBjYignRVJST1InKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChfdGhpcy51cmxDQi5nZXRDYXRlZ29yeSgpID09PSAnbmV2ZXInKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGNiKCdORVZFUicpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGlzQ2FjaGVkKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGNiKCdDQUNIRUQnKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIHJldHVybiBjYignTk9UX0NBQ0hFRCcpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9O1xuICAgIHJldHVybiBDYWNoZVNlcnZlclJlcXVlc3Q7XG59KCkpO1xuZXhwb3J0cy5DYWNoZVNlcnZlclJlcXVlc3QgPSBDYWNoZVNlcnZlclJlcXVlc3Q7XG5cblxuXG4vLy8vLy8vLy8vLy8vLy8vLy9cbi8vIFdFQlBBQ0sgRk9PVEVSXG4vLyAuL3NyYy9jYWNoZVNlcnZlclJlcXVlc3QudHNcbi8vIG1vZHVsZSBpZCA9IDFcbi8vIG1vZHVsZSBjaHVua3MgPSAwIiwibW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKFwicmVkaXMtdXJsLWNhY2hlXCIpO1xuXG5cbi8vLy8vLy8vLy8vLy8vLy8vL1xuLy8gV0VCUEFDSyBGT09URVJcbi8vIGV4dGVybmFsIFwicmVkaXMtdXJsLWNhY2hlXCJcbi8vIG1vZHVsZSBpZCA9IDJcbi8vIG1vZHVsZSBjaHVua3MgPSAwIiwibW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKFwidXJsXCIpO1xuXG5cbi8vLy8vLy8vLy8vLy8vLy8vL1xuLy8gV0VCUEFDSyBGT09URVJcbi8vIGV4dGVybmFsIFwidXJsXCJcbi8vIG1vZHVsZSBpZCA9IDNcbi8vIG1vZHVsZSBjaHVua3MgPSAwIiwibW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKFwicmVxdWVzdFwiKTtcblxuXG4vLy8vLy8vLy8vLy8vLy8vLy9cbi8vIFdFQlBBQ0sgRk9PVEVSXG4vLyBleHRlcm5hbCBcInJlcXVlc3RcIlxuLy8gbW9kdWxlIGlkID0gNFxuLy8gbW9kdWxlIGNodW5rcyA9IDAiLCJtb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoXCJpY29udlwiKTtcblxuXG4vLy8vLy8vLy8vLy8vLy8vLy9cbi8vIFdFQlBBQ0sgRk9PVEVSXG4vLyBleHRlcm5hbCBcImljb252XCJcbi8vIG1vZHVsZSBpZCA9IDVcbi8vIG1vZHVsZSBjaHVua3MgPSAwIiwibW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKFwiZGVidWdcIik7XG5cblxuLy8vLy8vLy8vLy8vLy8vLy8vXG4vLyBXRUJQQUNLIEZPT1RFUlxuLy8gZXh0ZXJuYWwgXCJkZWJ1Z1wiXG4vLyBtb2R1bGUgaWQgPSA2XG4vLyBtb2R1bGUgY2h1bmtzID0gMCIsIm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZShcImh0dHBcIik7XG5cblxuLy8vLy8vLy8vLy8vLy8vLy8vXG4vLyBXRUJQQUNLIEZPT1RFUlxuLy8gZXh0ZXJuYWwgXCJodHRwXCJcbi8vIG1vZHVsZSBpZCA9IDdcbi8vIG1vZHVsZSBjaHVua3MgPSAwIl0sInNvdXJjZVJvb3QiOiIifQ==