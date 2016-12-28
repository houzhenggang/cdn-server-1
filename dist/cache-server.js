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
	            debug('cdn-server URL, METHOD = ', request.method, request.url);
	            if (typeof request.headers['access-control-request-headers'] !== 'undefined') {
	                response.setHeader('Access-Control-Allow-Headers', request.headers['access-control-request-headers']);
	            }
	            if (request.method === 'OPTION' || request.method === 'OPTIONS') {
	                debug('OPTION call for ', request.url);
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
	                    response.end(content);
	                });
	            }
	            catch (e) {
	                debug("Exception caught", e);
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
	exports.CacheServer = CacheServer;


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
	        var re = /charset=([^()<>@,;:\"/[\]?.=\s]*)/i;
	        if (headers['content-type']) {
	            var charset = re.test(headers['content-type']) ? re.exec(headers['content-type'])[1] : 'utf-8';
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
	            if (err) {
	                debug('Error caught in request callback', err);
	                return cb(err, null);
	            }
	            var dataResponse = {
	                status: response.statusCode,
	                content: body,
	                headers: _this.extractHeaders(response.headers)
	            };
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIndlYnBhY2s6Ly8vd2VicGFjay9ib290c3RyYXAgMDdlODNhYjZlZDVkNWY2ZjQ4ZTkiLCJ3ZWJwYWNrOi8vLy4vc3JjL2NhY2hlU2VydmVyLnRzIiwid2VicGFjazovLy8uL3NyYy9jYWNoZVNlcnZlclJlcXVlc3QudHMiLCJ3ZWJwYWNrOi8vL2V4dGVybmFsIFwicmVkaXMtdXJsLWNhY2hlXCIiLCJ3ZWJwYWNrOi8vL2V4dGVybmFsIFwidXJsXCIiLCJ3ZWJwYWNrOi8vL2V4dGVybmFsIFwicmVxdWVzdFwiIiwid2VicGFjazovLy9leHRlcm5hbCBcImljb252XCIiLCJ3ZWJwYWNrOi8vL2V4dGVybmFsIFwiZGVidWdcIiIsIndlYnBhY2s6Ly8vZXh0ZXJuYWwgXCJodHRwXCIiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQSx1QkFBZTtBQUNmO0FBQ0E7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOzs7QUFHQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBOzs7Ozs7O0FDdENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0Esb0NBQW1DLDBEQUEwRDtBQUM3RjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0Esa0JBQWlCO0FBQ2pCO0FBQ0E7QUFDQTtBQUNBLDJDQUEwQztBQUMxQztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFVBQVM7QUFDVDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxxQ0FBb0MsV0FBVztBQUMvQztBQUNBO0FBQ0E7QUFDQTtBQUNBLGNBQWE7QUFDYjtBQUNBO0FBQ0EscUNBQW9DLDJCQUEyQjtBQUMvRDtBQUNBLGNBQWE7QUFDYjtBQUNBO0FBQ0EsVUFBUztBQUNUO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsVUFBUztBQUNUO0FBQ0E7QUFDQSxFQUFDO0FBQ0Q7Ozs7Ozs7QUM5RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxvRkFBbUY7QUFDbkY7QUFDQTtBQUNBO0FBQ0E7QUFDQSxVQUFTO0FBQ1Q7QUFDQTtBQUNBLEVBQUM7QUFDRDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsVUFBUztBQUNUO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxnQ0FBK0IsT0FBTztBQUN0QztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSwwRUFBeUUsU0FBUztBQUNsRixnQ0FBK0IsYUFBYTtBQUM1QztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0Esb0NBQW1DLHVDQUF1QztBQUMxRTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxpREFBZ0QsaUVBQWlFO0FBQ2pILDZDQUE0Qyw4QkFBOEI7QUFDMUU7QUFDQTtBQUNBO0FBQ0EsaURBQWdELHVEQUF1RDtBQUN2Ryw2Q0FBNEMsOEJBQThCO0FBQzFFO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSw4QkFBNkI7QUFDN0I7QUFDQTtBQUNBLHlEQUF3RCxpRUFBaUU7QUFDekgscURBQW9ELDhCQUE4QjtBQUNsRjtBQUNBO0FBQ0E7QUFDQSw4QkFBNkI7QUFDN0I7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLHNCQUFxQjtBQUNyQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxpREFBZ0QsaUVBQWlFO0FBQ2pILDZDQUE0Qyw4QkFBOEI7QUFDMUU7QUFDQTtBQUNBO0FBQ0E7QUFDQSxzQkFBcUI7QUFDckI7QUFDQSxVQUFTO0FBQ1Q7QUFDQTtBQUNBLHFDQUFvQztBQUNwQztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxVQUFTO0FBQ1Q7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxVQUFTO0FBQ1Q7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFVBQVM7QUFDVDtBQUNBO0FBQ0E7QUFDQTtBQUNBLFVBQVM7QUFDVDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLHFDQUFvQyxXQUFXO0FBQy9DO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxVQUFTO0FBQ1Q7QUFDQTtBQUNBLEVBQUM7QUFDRDs7Ozs7OztBQ3ROQSw2Qzs7Ozs7O0FDQUEsaUM7Ozs7OztBQ0FBLHFDOzs7Ozs7QUNBQSxtQzs7Ozs7O0FDQUEsbUM7Ozs7OztBQ0FBLGtDIiwiZmlsZSI6ImNhY2hlLXNlcnZlci5qcyIsInNvdXJjZXNDb250ZW50IjpbIiBcdC8vIFRoZSBtb2R1bGUgY2FjaGVcbiBcdHZhciBpbnN0YWxsZWRNb2R1bGVzID0ge307XG5cbiBcdC8vIFRoZSByZXF1aXJlIGZ1bmN0aW9uXG4gXHRmdW5jdGlvbiBfX3dlYnBhY2tfcmVxdWlyZV9fKG1vZHVsZUlkKSB7XG5cbiBcdFx0Ly8gQ2hlY2sgaWYgbW9kdWxlIGlzIGluIGNhY2hlXG4gXHRcdGlmKGluc3RhbGxlZE1vZHVsZXNbbW9kdWxlSWRdKVxuIFx0XHRcdHJldHVybiBpbnN0YWxsZWRNb2R1bGVzW21vZHVsZUlkXS5leHBvcnRzO1xuXG4gXHRcdC8vIENyZWF0ZSBhIG5ldyBtb2R1bGUgKGFuZCBwdXQgaXQgaW50byB0aGUgY2FjaGUpXG4gXHRcdHZhciBtb2R1bGUgPSBpbnN0YWxsZWRNb2R1bGVzW21vZHVsZUlkXSA9IHtcbiBcdFx0XHRleHBvcnRzOiB7fSxcbiBcdFx0XHRpZDogbW9kdWxlSWQsXG4gXHRcdFx0bG9hZGVkOiBmYWxzZVxuIFx0XHR9O1xuXG4gXHRcdC8vIEV4ZWN1dGUgdGhlIG1vZHVsZSBmdW5jdGlvblxuIFx0XHRtb2R1bGVzW21vZHVsZUlkXS5jYWxsKG1vZHVsZS5leHBvcnRzLCBtb2R1bGUsIG1vZHVsZS5leHBvcnRzLCBfX3dlYnBhY2tfcmVxdWlyZV9fKTtcblxuIFx0XHQvLyBGbGFnIHRoZSBtb2R1bGUgYXMgbG9hZGVkXG4gXHRcdG1vZHVsZS5sb2FkZWQgPSB0cnVlO1xuXG4gXHRcdC8vIFJldHVybiB0aGUgZXhwb3J0cyBvZiB0aGUgbW9kdWxlXG4gXHRcdHJldHVybiBtb2R1bGUuZXhwb3J0cztcbiBcdH1cblxuXG4gXHQvLyBleHBvc2UgdGhlIG1vZHVsZXMgb2JqZWN0IChfX3dlYnBhY2tfbW9kdWxlc19fKVxuIFx0X193ZWJwYWNrX3JlcXVpcmVfXy5tID0gbW9kdWxlcztcblxuIFx0Ly8gZXhwb3NlIHRoZSBtb2R1bGUgY2FjaGVcbiBcdF9fd2VicGFja19yZXF1aXJlX18uYyA9IGluc3RhbGxlZE1vZHVsZXM7XG5cbiBcdC8vIF9fd2VicGFja19wdWJsaWNfcGF0aF9fXG4gXHRfX3dlYnBhY2tfcmVxdWlyZV9fLnAgPSBcIlwiO1xuXG4gXHQvLyBMb2FkIGVudHJ5IG1vZHVsZSBhbmQgcmV0dXJuIGV4cG9ydHNcbiBcdHJldHVybiBfX3dlYnBhY2tfcmVxdWlyZV9fKDApO1xuXG5cblxuLy8gV0VCUEFDSyBGT09URVIgLy9cbi8vIHdlYnBhY2svYm9vdHN0cmFwIDA3ZTgzYWI2ZWQ1ZDVmNmY0OGU5IiwiXCJ1c2Ugc3RyaWN0XCI7XG52YXIgY2FjaGVTZXJ2ZXJSZXF1ZXN0XzEgPSByZXF1aXJlKCcuL2NhY2hlU2VydmVyUmVxdWVzdCcpO1xudmFyIG5vZGV1cmwgPSByZXF1aXJlKCd1cmwnKTtcbnZhciBodHRwID0gcmVxdWlyZSgnaHR0cCcpO1xudmFyIHJlcXVlc3QgPSByZXF1aXJlKCdyZXF1ZXN0Jyk7XG52YXIgZGVidWcgPSByZXF1aXJlKCdkZWJ1ZycpKCdjZG4tc2VydmVyJyk7XG52YXIgQ2FjaGVTZXJ2ZXIgPSAoZnVuY3Rpb24gKCkge1xuICAgIGZ1bmN0aW9uIENhY2hlU2VydmVyKGNkbkNvbmZpZywgbG9nZ2VyKSB7XG4gICAgICAgIHZhciBfdGhpcyA9IHRoaXM7XG4gICAgICAgIHRoaXMuY2RuQ29uZmlnID0gY2RuQ29uZmlnO1xuICAgICAgICB0aGlzLmxvZ2dlciA9IGxvZ2dlcjtcbiAgICAgICAgdGhpcy51cmxTZXJ2ZXIgPSBmdW5jdGlvbiAocmVxdWVzdCwgcmVzcG9uc2UpIHtcbiAgICAgICAgICAgIHJlc3BvbnNlLnNldEhlYWRlcignQWNjZXNzLUNvbnRyb2wtQWxsb3ctT3JpZ2luJywgJyonKTtcbiAgICAgICAgICAgIHJlc3BvbnNlLnNldEhlYWRlcignQWNjZXNzLUNvbnRyb2wtUmVxdWVzdC1NZXRob2QnLCAnKicpO1xuICAgICAgICAgICAgcmVzcG9uc2Uuc2V0SGVhZGVyKCdBY2Nlc3MtQ29udHJvbC1BbGxvdy1NZXRob2RzJywgJ09QVElPTlMsIEdFVCcpO1xuICAgICAgICAgICAgZGVidWcoJ2Nkbi1zZXJ2ZXIgVVJMLCBNRVRIT0QgPSAnLCByZXF1ZXN0Lm1ldGhvZCwgcmVxdWVzdC51cmwpO1xuICAgICAgICAgICAgaWYgKHR5cGVvZiByZXF1ZXN0LmhlYWRlcnNbJ2FjY2Vzcy1jb250cm9sLXJlcXVlc3QtaGVhZGVycyddICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgICAgIHJlc3BvbnNlLnNldEhlYWRlcignQWNjZXNzLUNvbnRyb2wtQWxsb3ctSGVhZGVycycsIHJlcXVlc3QuaGVhZGVyc1snYWNjZXNzLWNvbnRyb2wtcmVxdWVzdC1oZWFkZXJzJ10pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHJlcXVlc3QubWV0aG9kID09PSAnT1BUSU9OJyB8fCByZXF1ZXN0Lm1ldGhvZCA9PT0gJ09QVElPTlMnKSB7XG4gICAgICAgICAgICAgICAgZGVidWcoJ09QVElPTiBjYWxsIGZvciAnLCByZXF1ZXN0LnVybCk7XG4gICAgICAgICAgICAgICAgZGVidWcocmVxdWVzdC5oZWFkZXJzKTtcbiAgICAgICAgICAgICAgICByZXNwb25zZS53cml0ZUhlYWQoMjAwKTtcbiAgICAgICAgICAgICAgICByZXNwb25zZS5lbmQoKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBkZWJ1ZygncmVxdWVzdGluZyAnLCByZXF1ZXN0Lm1ldGhvZCwgcmVxdWVzdC51cmwpO1xuICAgICAgICAgICAgICAgIF90aGlzLmxvZ2dlci5pbmZvKHsgdXJsOiBub2RldXJsLnBhcnNlKHJlcXVlc3QudXJsKSwgbWV0aG9kOiByZXF1ZXN0Lm1ldGhvZCB9LCAnTmV3IHJlcXVlc3QnKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgdmFyIGNhY2hlU2VydmVyUmVxdWVzdCA9IG5ldyBjYWNoZVNlcnZlclJlcXVlc3RfMS5DYWNoZVNlcnZlclJlcXVlc3QoX3RoaXMuY2RuQ29uZmlnLmRlZmF1bHREb21haW4sIF90aGlzLmxvZ2dlciwgcmVxdWVzdCk7XG4gICAgICAgICAgICAgICAgY2FjaGVTZXJ2ZXJSZXF1ZXN0LmdldEl0KGZ1bmN0aW9uIChzdGF0dXMsIGhlYWRlcnMsIGNvbnRlbnQpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGhlYWRlcktleXMgPSBPYmplY3Qua2V5cyhoZWFkZXJzKTtcbiAgICAgICAgICAgICAgICAgICAgcmVzcG9uc2Uuc2V0SGVhZGVyKCdBY2Nlc3MtQ29udHJvbC1FeHBvc2UtSGVhZGVycycsIGhlYWRlcktleXMuam9pbignLCcpKTtcbiAgICAgICAgICAgICAgICAgICAgcmVzcG9uc2Uud3JpdGVIZWFkKHN0YXR1cywgaGVhZGVycyk7XG4gICAgICAgICAgICAgICAgICAgIHJlc3BvbnNlLmVuZChjb250ZW50KTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhdGNoIChlKSB7XG4gICAgICAgICAgICAgICAgZGVidWcoXCJFeGNlcHRpb24gY2F1Z2h0XCIsIGUpO1xuICAgICAgICAgICAgICAgIHJlc3BvbnNlLndyaXRlSGVhZCg1MDEsIHt9KTtcbiAgICAgICAgICAgICAgICByZXNwb25zZS5lbmQoZS5tZXNzYWdlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICB9XG4gICAgQ2FjaGVTZXJ2ZXIucHJvdG90eXBlLmNvbm5lY3RSZWRpc1VybENhY2hlID0gZnVuY3Rpb24gKGNiKSB7XG4gICAgICAgIGNhY2hlU2VydmVyUmVxdWVzdF8xLlJlZGlzQ2FjaGUuY29ubmVjdFJlZGlzVXJsQ2FjaGUodGhpcy5jZG5Db25maWcuaW5zdGFuY2VOYW1lLCB0aGlzLmNkbkNvbmZpZy5yZWRpc0NvbmZpZywgdGhpcy5jZG5Db25maWcuZGVmYXVsdERvbWFpbiwgZnVuY3Rpb24gKGVycikge1xuICAgICAgICAgICAgY2IoZXJyKTtcbiAgICAgICAgfSk7XG4gICAgfTtcbiAgICBDYWNoZVNlcnZlci5wcm90b3R5cGUuc3RhcnQgPSBmdW5jdGlvbiAoY2IpIHtcbiAgICAgICAgdmFyIF90aGlzID0gdGhpcztcbiAgICAgICAgdGhpcy5odHRwU2VydmVyID0gaHR0cC5jcmVhdGVTZXJ2ZXIodGhpcy51cmxTZXJ2ZXIpO1xuICAgICAgICB0aGlzLmNvbm5lY3RSZWRpc1VybENhY2hlKGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICBfdGhpcy5sb2dnZXIuZXJyb3IoeyBlcnI6IGVyciB9LCAnRXJyb3IgY29ubmVjdGluZyB3aXRoIHJlZGlzLXVybC1jYWNoZScpO1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihlcnIpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgX3RoaXMuaHR0cFNlcnZlci5saXN0ZW4oX3RoaXMuY2RuQ29uZmlnLnBvcnQsIGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgICAgICAgICBjYihlcnIpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBfdGhpcy5odHRwU2VydmVyLm9uKCdjbGllbnRFcnJvcicsIGZ1bmN0aW9uIChlcnIsIHNvY2tldCkge1xuICAgICAgICAgICAgICAgIGRlYnVnKCdPbiBDbGllbnQgRXJyb3I6ICcsIGVycik7XG4gICAgICAgICAgICAgICAgX3RoaXMubG9nZ2VyLmVycm9yKHsgZXJyOiBlcnIsIHNvY2tldDogc29ja2V0IH0sICdTb2NrZXQgZXJyb3InKTtcbiAgICAgICAgICAgICAgICBzb2NrZXQuZW5kKCdIVFRQLzEuMSA0MDAgQmFkIFJlcXVlc3RcXHJcXG5cXHJcXG4nKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgX3RoaXMubG9nZ2VyLndhcm4oJ0NhY2hlIFNlcnZlciBsYXVuY2hlZCcpO1xuICAgICAgICAgICAgZGVidWcoJ0NhY2hlU2VydmVyICcsIF90aGlzLmNkbkNvbmZpZy5pbnN0YW5jZU5hbWUsICdMYXVuY2hlZCcpO1xuICAgICAgICB9KTtcbiAgICB9O1xuICAgIENhY2hlU2VydmVyLnByb3RvdHlwZS5zdG9wID0gZnVuY3Rpb24gKGNiKSB7XG4gICAgICAgIHRoaXMuaHR0cFNlcnZlci5jbG9zZShmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgICAgICBjYihlcnIpO1xuICAgICAgICB9KTtcbiAgICB9O1xuICAgIHJldHVybiBDYWNoZVNlcnZlcjtcbn0oKSk7XG5leHBvcnRzLkNhY2hlU2VydmVyID0gQ2FjaGVTZXJ2ZXI7XG5cblxuXG4vLy8vLy8vLy8vLy8vLy8vLy9cbi8vIFdFQlBBQ0sgRk9PVEVSXG4vLyAuL3NyYy9jYWNoZVNlcnZlci50c1xuLy8gbW9kdWxlIGlkID0gMFxuLy8gbW9kdWxlIGNodW5rcyA9IDAiLCJcInVzZSBzdHJpY3RcIjtcbnZhciByZWRpc191cmxfY2FjaGVfMSA9IHJlcXVpcmUoJ3JlZGlzLXVybC1jYWNoZScpO1xudmFyIG5vZGV1cmwgPSByZXF1aXJlKCd1cmwnKTtcbnZhciByZXF1ZXN0ID0gcmVxdWlyZSgncmVxdWVzdCcpO1xudmFyIGljb252ID0gcmVxdWlyZSgnaWNvbnYnKTtcbnZhciBkZWJ1ZyA9IHJlcXVpcmUoJ2RlYnVnJykoJ2Nkbi1zZXJ2ZXInKTtcbnZhciBSZWRpc0NhY2hlID0gKGZ1bmN0aW9uICgpIHtcbiAgICBmdW5jdGlvbiBSZWRpc0NhY2hlKCkge1xuICAgIH1cbiAgICBSZWRpc0NhY2hlLmNvbm5lY3RSZWRpc1VybENhY2hlID0gZnVuY3Rpb24gKGluc3RhbmNlTmFtZSwgcmVkaXNDb25maWcsIGRlZmF1bHREb21haW4sIGNiKSB7XG4gICAgICAgIHZhciBpbnN0YW5jZSA9IG5ldyByZWRpc191cmxfY2FjaGVfMS5JbnN0YW5jZShpbnN0YW5jZU5hbWUsIHJlZGlzQ29uZmlnLCB7fSwgZnVuY3Rpb24gKGVycikge1xuICAgICAgICAgICAgaWYgKGVycilcbiAgICAgICAgICAgICAgICByZXR1cm4gY2IoZXJyKTtcbiAgICAgICAgICAgIFJlZGlzQ2FjaGUuY2FjaGVFbmdpbmUgPSBuZXcgcmVkaXNfdXJsX2NhY2hlXzEuQ2FjaGVFbmdpbmVDQihkZWZhdWx0RG9tYWluLCBpbnN0YW5jZSk7XG4gICAgICAgICAgICBjYihudWxsKTtcbiAgICAgICAgfSk7XG4gICAgfTtcbiAgICByZXR1cm4gUmVkaXNDYWNoZTtcbn0oKSk7XG5leHBvcnRzLlJlZGlzQ2FjaGUgPSBSZWRpc0NhY2hlO1xudmFyIENhY2hlU2VydmVyUmVxdWVzdCA9IChmdW5jdGlvbiAoKSB7XG4gICAgZnVuY3Rpb24gQ2FjaGVTZXJ2ZXJSZXF1ZXN0KGRlZmF1bHREb21haW4sIGxvZ2dlciwgcmVxdWVzdCkge1xuICAgICAgICB0aGlzLmRlZmF1bHREb21haW4gPSBkZWZhdWx0RG9tYWluO1xuICAgICAgICB0aGlzLnVybCA9IG5vZGV1cmwucGFyc2UocmVxdWVzdC51cmwsIHRydWUpO1xuICAgICAgICB0aGlzLmxvZ2dlciA9IGxvZ2dlci5jaGlsZCh7XG4gICAgICAgICAgICBzY3JpcHQ6ICdDYWNoZVNlcnZlcicsXG4gICAgICAgICAgICB1cmw6IHRoaXMudXJsXG4gICAgICAgIH0pO1xuICAgICAgICB0aGlzLnZhbGlkYXRlVVJMKHJlcXVlc3QpO1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgdGhpcy51cmxDQiA9IFJlZGlzQ2FjaGUuY2FjaGVFbmdpbmUudXJsKHRoaXMudXJsLnF1ZXJ5LnVybCk7XG4gICAgICAgIH1cbiAgICAgICAgY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgIHRoaXMubG9nZ2VyLmVycm9yKHsgZTogZSB9LCAnRXJyb3IgZXhlY3V0aW4gY2FjaGVFbmdpbmUudXJsKCknKTtcbiAgICAgICAgICAgIGRlYnVnKCdFcnJvciB3aXRoIHVybDogcmVxdWVzdC51cmwnLCByZXF1ZXN0LnVybCwgZSk7XG4gICAgICAgICAgICB0aHJvdyBlO1xuICAgICAgICB9XG4gICAgfVxuICAgIENhY2hlU2VydmVyUmVxdWVzdC5wcm90b3R5cGUudmFsaWRhdGVVUkwgPSBmdW5jdGlvbiAocmVxdWVzdCkge1xuICAgICAgICBpZiAodGhpcy51cmwucGF0aG5hbWUgIT09ICcvZ2V0JyB8fCB0eXBlb2YgdGhpcy51cmwucXVlcnkudXJsID09PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgdmFyIGVycm9yID0gbmV3IEVycm9yKFwiRXJyb3IgLSB0aGUgVVJMIGlzIG5vdCB2YWxpZCAtIG9ubHkgJ3tob3N0bmFtZX0vZ2V0P3VybD0nIGlzIGFsbG93ZWRcIik7XG4gICAgICAgICAgICB0aGlzLmxvZ2dlci5lcnJvcih7IGVycjogZXJyb3IgfSk7XG4gICAgICAgICAgICBkZWJ1ZyhlcnJvci5tZXNzYWdlLCB0aGlzLnVybC5wYXRobmFtZSwgdGhpcy51cmwucXVlcnkpO1xuICAgICAgICAgICAgdGhyb3cgZXJyb3I7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5oZWFkZXJzID0gcmVxdWVzdC5oZWFkZXJzO1xuICAgICAgICBpZiAodHlwZW9mIHRoaXMuaGVhZGVyc1sncmVmZXJlciddID09PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgaWYgKHR5cGVvZiB0aGlzLnVybC5xdWVyeS5yZWZlcmVyICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgICAgIHRoaXMuaGVhZGVyc1sncmVmZXJlciddID0gdGhpcy51cmwucXVlcnkucmVmZXJlcjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIHZhciBlcnJvciA9IG5ldyBFcnJvcignRXJyb3IgLSB0aGUgcmVmZXJlciBoZWFkZXIgaXMgbm90IHNldCcpO1xuICAgICAgICAgICAgICAgIGRlYnVnKCdubyByZWZlcmVyOiBoZWFkZXJzID0gJywgcmVxdWVzdC5oZWFkZXJzKTtcbiAgICAgICAgICAgICAgICB0aGlzLmxvZ2dlci5lcnJvcih7IGhlYWRlcnM6IHJlcXVlc3QuaGVhZGVycywgZXJyOiBlcnJvciB9KTtcbiAgICAgICAgICAgICAgICB0aHJvdyBlcnJvcjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICB2YXIgcGFyc2VkT3JpZ2luYWxVUkwgPSBub2RldXJsLnBhcnNlKHJlcXVlc3QuaGVhZGVyc1sncmVmZXJlciddKTtcbiAgICAgICAgcGFyc2VkT3JpZ2luYWxVUkwucXVlcnkgPSBudWxsO1xuICAgICAgICBwYXJzZWRPcmlnaW5hbFVSTC5wYXRoID0gbnVsbDtcbiAgICAgICAgcGFyc2VkT3JpZ2luYWxVUkwucGF0aG5hbWUgPSBudWxsO1xuICAgICAgICBwYXJzZWRPcmlnaW5hbFVSTC5oYXNoID0gbnVsbDtcbiAgICAgICAgcGFyc2VkT3JpZ2luYWxVUkwuc2VhcmNoID0gbnVsbDtcbiAgICAgICAgdGhpcy5vcmlnaW5hbFVSTCA9IG5vZGV1cmwuZm9ybWF0KHBhcnNlZE9yaWdpbmFsVVJMKTtcbiAgICB9O1xuICAgIENhY2hlU2VydmVyUmVxdWVzdC5wcm90b3R5cGUuZ2V0SXQgPSBmdW5jdGlvbiAoY2IpIHtcbiAgICAgICAgdmFyIF90aGlzID0gdGhpcztcbiAgICAgICAgZGVidWcoJ2dldEl0IGNhbGxlZCcpO1xuICAgICAgICB0aGlzLmRldGVjdENhY2hpbmdTdGF0dXMoZnVuY3Rpb24gKGNhY2hpbmdTdGF0dXMpIHtcbiAgICAgICAgICAgIHN3aXRjaCAoY2FjaGluZ1N0YXR1cykge1xuICAgICAgICAgICAgICAgIGNhc2UgJ0VSUk9SJzpcbiAgICAgICAgICAgICAgICBjYXNlICdORVZFUic6XG4gICAgICAgICAgICAgICAgY2FzZSAnTk9UX0NBQ0hFRCc6XG4gICAgICAgICAgICAgICAgICAgIGRlYnVnKCdJVCBJUyBOT1QgQ0FDSEVEJyk7XG4gICAgICAgICAgICAgICAgICAgIF90aGlzLnJlcXVlc3RVUkwoZmFsc2UsIF90aGlzLmhlYWRlcnMsIGZ1bmN0aW9uIChlcnIsIHJlc3VsdCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgZGVidWcoJ0lOU0lERSBHRVRJVCBDQicpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlYnVnKCdFUlJPUiB3aGlsZSByZXF1ZXN0aW5nICcsIF90aGlzLnVybC5xdWVyeS51cmwsIGVycik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgX3RoaXMubG9nZ2VyLmVycm9yKHsgZXJyOiBlcnIsIGNhY2hpbmdTdGF0dXM6IGNhY2hpbmdTdGF0dXMsIGhlYWRlcnM6IF90aGlzLmhlYWRlcnMgfSwgZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gY2IoNTAxLCB7ICdDb250ZW50LVR5cGUnOiAndGV4dC9odG1sJyB9LCAnRXJyb3IgJyArIGVycik7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAocmVzdWx0LmNvbnRlbnQubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVidWcoJ0VSUk9SIHdoaWxlIHJlcXVlc3RpbmcgJywgX3RoaXMudXJsLnF1ZXJ5LnVybCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgX3RoaXMubG9nZ2VyLmVycm9yKHsgY2FjaGluZ1N0YXR1czogY2FjaGluZ1N0YXR1cywgaGVhZGVyczogX3RoaXMuaGVhZGVycyB9LCAnRW1wdHkgcmVzcG9uc2UnKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gY2IoNTAxLCB7ICdDb250ZW50LVR5cGUnOiAndGV4dC9odG1sJyB9LCAnRXJyb3IgcmVzcG9uc2UgaXMgZW1wdHknICsgSlNPTi5zdHJpbmdpZnkocmVzdWx0KSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICByZXN1bHQuaGVhZGVyc1snY2FjaGluZy1zdGF0dXMnXSA9IGNhY2hpbmdTdGF0dXM7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoY2FjaGluZ1N0YXR1cyAhPT0gJ05FVkVSJykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIF90aGlzLnVybENCLnNldChyZXN1bHQuY29udGVudCwge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdGF0dXM6IHJlc3VsdC5zdGF0dXMsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHVybDogX3RoaXMudXJsQ0IuZ2V0VXJsKCksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRvbWFpbjogX3RoaXMudXJsQ0IuZ2V0RG9tYWluKCksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGhlYWRlcnM6IHJlc3VsdC5oZWFkZXJzXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSwgZmFsc2UsIGZ1bmN0aW9uIChlcnIsIHNldFJlc3VsdCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZWJ1ZyhlcnIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgX3RoaXMubG9nZ2VyLmVycm9yKHsgZXJyOiBlcnIsIGNhY2hpbmdTdGF0dXM6IGNhY2hpbmdTdGF0dXMsIGhlYWRlcnM6IF90aGlzLmhlYWRlcnMgfSwgJ0Vycm9yIHN0b3JpbmcgaW4gcmVkaXMtdXJsLWNhY2hlJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gY2IoNTAxLCB7ICdDb250ZW50LVR5cGUnOiAndGV4dC9odG1sJyB9LCAnRXJyb3IgJyArIGVycik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzdWx0LmhlYWRlcnNbJ25nU2VydmVyQ2FjaGVkJ10gPSAneWVzJztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGNiKHJlc3VsdC5zdGF0dXMsIHJlc3VsdC5oZWFkZXJzLCByZXN1bHQuY29udGVudCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXN1bHQuaGVhZGVyc1snbmdTZXJ2ZXJDYWNoZWQnXSA9ICdubyc7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGNiKHJlc3VsdC5zdGF0dXMsIHJlc3VsdC5oZWFkZXJzLCByZXN1bHQuY29udGVudCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBjYXNlICdDQUNIRUQnOlxuICAgICAgICAgICAgICAgICAgICBkZWJ1ZygnSVQgSVMgQ0FDSEVEJyk7XG4gICAgICAgICAgICAgICAgICAgIF90aGlzLnVybENCLmdldChmdW5jdGlvbiAoZXJyLCBjb250ZW50KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVidWcoZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBfdGhpcy5sb2dnZXIuZXJyb3IoeyBlcnI6IGVyciwgY2FjaGluZ1N0YXR1czogY2FjaGluZ1N0YXR1cywgaGVhZGVyczogX3RoaXMuaGVhZGVycyB9LCBcImVycm9yIHJldHJpZXZlIGNvbnRlbnQgZnJvbSByZWRpcy11cmwtY2FjaGVcIik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGNiKDUwMSwgeyAnQ29udGVudC1UeXBlJzogJ3RleHQvaHRtbCcgfSwgJ0Vycm9yICcgKyBlcnIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgY29udGVudC5leHRyYS5oZWFkZXJzWydjYWNoaW5nLXN0YXR1cyddID0gY2FjaGluZ1N0YXR1cztcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRlbnQuZXh0cmEuaGVhZGVyc1snbmdTZXJ2ZXJDYWNoZWQnXSA9ICd5ZXMnO1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGNiKGNvbnRlbnQuZXh0cmEuc3RhdHVzLCBjb250ZW50LmV4dHJhLmhlYWRlcnMsIGNvbnRlbnQuY29udGVudCk7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9O1xuICAgIENhY2hlU2VydmVyUmVxdWVzdC5wcm90b3R5cGUuZGVjb2RlID0gZnVuY3Rpb24gKGhlYWRlcnMsIGJvZHkpIHtcbiAgICAgICAgdmFyIHJlID0gL2NoYXJzZXQ9KFteKCk8PkAsOzpcXFwiL1tcXF0/Lj1cXHNdKikvaTtcbiAgICAgICAgaWYgKGhlYWRlcnNbJ2NvbnRlbnQtdHlwZSddKSB7XG4gICAgICAgICAgICB2YXIgY2hhcnNldCA9IHJlLnRlc3QoaGVhZGVyc1snY29udGVudC10eXBlJ10pID8gcmUuZXhlYyhoZWFkZXJzWydjb250ZW50LXR5cGUnXSlbMV0gOiAndXRmLTgnO1xuICAgICAgICAgICAgaWYgKGNoYXJzZXQgPT09ICd1dGYtOCcpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gYm9keTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHZhciBpYyA9IG5ldyBpY29udi5JY29udihjaGFyc2V0LCAnVVRGLTgnKTtcbiAgICAgICAgICAgIHZhciBidWZmZXIgPSBpYy5jb252ZXJ0KGJvZHkpO1xuICAgICAgICAgICAgcmV0dXJuIGJ1ZmZlci50b1N0cmluZygndXRmLTgnKTtcbiAgICAgICAgfVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ2NvbnRlbnQtdHlwZSBpcyBtaXNzaW5nJyk7XG4gICAgfTtcbiAgICBDYWNoZVNlcnZlclJlcXVlc3QucHJvdG90eXBlLnJlcXVlc3RVUkwgPSBmdW5jdGlvbiAoYmluYXJ5LCBoZWFkZXJzLCBjYikge1xuICAgICAgICB2YXIgX3RoaXMgPSB0aGlzO1xuICAgICAgICB2YXIgbmV3SGVhZGVycyA9IHt9O1xuICAgICAgICBuZXdIZWFkZXJzWydvcmlnaW4nXSA9IHRoaXMub3JpZ2luYWxVUkw7XG4gICAgICAgIG5ld0hlYWRlcnNbJ3VzZXItYWdlbnQnXSA9IGhlYWRlcnNbJ3VzZXItYWdlbnQnXSA/IGhlYWRlcnNbJ3VzZXItYWdlbnQnXSA6ICdTdXBlciBVc2VyIEFnZW50JztcbiAgICAgICAgaWYgKHR5cGVvZiBuZXdIZWFkZXJzWydhY2NlcHQtZW5jb2RpbmcnXSAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgIGRlbGV0ZSBuZXdIZWFkZXJzWydhY2NlcHQtZW5jb2RpbmcnXTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoaGVhZGVyc1snY29va2llJ10pXG4gICAgICAgICAgICBuZXdIZWFkZXJzWydjb29raWUnXSA9IGhlYWRlcnNbJ2Nvb2tpZSddO1xuICAgICAgICB2YXIgcGFyc2VkVVJMID0gbm9kZXVybC5wYXJzZSh0aGlzLnVybC5xdWVyeS51cmwpO1xuICAgICAgICB2YXIgdXJsID0gcGFyc2VkVVJMLmhvc3QgPT09IG51bGwgPyB0aGlzLmRlZmF1bHREb21haW4gKyB0aGlzLnVybC5xdWVyeS51cmwgOiB0aGlzLnVybC5xdWVyeS51cmw7XG4gICAgICAgIGRlYnVnKCdHT0lORyBUTyBSRVFVRVNUJywgdXJsLCBuZXdIZWFkZXJzKTtcbiAgICAgICAgcmVxdWVzdCh7XG4gICAgICAgICAgICB1cmw6IHVybCxcbiAgICAgICAgICAgIGhlYWRlcnM6IG5ld0hlYWRlcnNcbiAgICAgICAgfSwgZnVuY3Rpb24gKGVyciwgcmVzcG9uc2UsIGJvZHkpIHtcbiAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICBkZWJ1ZygnRXJyb3IgY2F1Z2h0IGluIHJlcXVlc3QgY2FsbGJhY2snLCBlcnIpO1xuICAgICAgICAgICAgICAgIHJldHVybiBjYihlcnIsIG51bGwpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdmFyIGRhdGFSZXNwb25zZSA9IHtcbiAgICAgICAgICAgICAgICBzdGF0dXM6IHJlc3BvbnNlLnN0YXR1c0NvZGUsXG4gICAgICAgICAgICAgICAgY29udGVudDogYm9keSxcbiAgICAgICAgICAgICAgICBoZWFkZXJzOiBfdGhpcy5leHRyYWN0SGVhZGVycyhyZXNwb25zZS5oZWFkZXJzKVxuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIGNiKG51bGwsIGRhdGFSZXNwb25zZSk7XG4gICAgICAgIH0pO1xuICAgIH07XG4gICAgQ2FjaGVTZXJ2ZXJSZXF1ZXN0LnByb3RvdHlwZS5leHRyYWN0SGVhZGVycyA9IGZ1bmN0aW9uIChyZWNlaXZlZEhlYWRlcnMpIHtcbiAgICAgICAgdmFyIGhlYWRlcnMgPSB7fTtcbiAgICAgICAgdmFyIGhlYWRlcnNUb0V4dHJhY3QgPSBbXG4gICAgICAgICAgICAnYWNjZXNzLWNvbnRyb2wtYWxsb3ctb3JpZ2luJyxcbiAgICAgICAgICAgICdjYWNoZS1jb250cm9sJyxcbiAgICAgICAgICAgICdjb250ZW50LWVuY29kaW5nJyxcbiAgICAgICAgICAgICdjb250ZW50LXR5cGUnLFxuICAgICAgICAgICAgJ2V0YWcnLFxuICAgICAgICAgICAgJ3NldC1jb29raWUnLFxuICAgICAgICAgICAgJ3ZhcnknLFxuICAgICAgICAgICAgJ2Nvbm5lY3Rpb24nLFxuICAgICAgICAgICAgJ2V4cGlyZXMnLFxuICAgICAgICAgICAgJ2RhdGUnLFxuICAgICAgICAgICAgJ2xhc3QtbW9kaWZpZWQnXG4gICAgICAgIF07XG4gICAgICAgIHZhciBrZXlzID0gT2JqZWN0LmtleXMocmVjZWl2ZWRIZWFkZXJzKTtcbiAgICAgICAgdmFyIG5ld1JlY2VpdmVkSGVhZGVycyA9IHt9O1xuICAgICAgICBrZXlzLmZvckVhY2goZnVuY3Rpb24gKGtleSkge1xuICAgICAgICAgICAgbmV3UmVjZWl2ZWRIZWFkZXJzW2tleS50b0xvd2VyQ2FzZSgpXSA9IHJlY2VpdmVkSGVhZGVyc1trZXldO1xuICAgICAgICB9KTtcbiAgICAgICAgaGVhZGVyc1RvRXh0cmFjdC5mb3JFYWNoKGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgICAgICAgICBpZiAobmV3UmVjZWl2ZWRIZWFkZXJzW25hbWVdKSB7XG4gICAgICAgICAgICAgICAgaGVhZGVyc1tuYW1lXSA9IG5ld1JlY2VpdmVkSGVhZGVyc1tuYW1lXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICAgIGhlYWRlcnNbJ2FjY2Vzcy1jb250cm9sLWFsbG93LW9yaWdpbiddID0gJyonO1xuICAgICAgICByZXR1cm4gaGVhZGVycztcbiAgICB9O1xuICAgIENhY2hlU2VydmVyUmVxdWVzdC5wcm90b3R5cGUuZGV0ZWN0Q2FjaGluZ1N0YXR1cyA9IGZ1bmN0aW9uIChjYikge1xuICAgICAgICB2YXIgX3RoaXMgPSB0aGlzO1xuICAgICAgICB0aGlzLnVybENCLmhhcyhmdW5jdGlvbiAoZXJyLCBpc0NhY2hlZCkge1xuICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgIF90aGlzLmxvZ2dlci5lcnJvcih7IGVycjogZXJyIH0sICdFcnJvciBoYXMoKScpO1xuICAgICAgICAgICAgICAgIHJldHVybiBjYignRVJST1InKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChfdGhpcy51cmxDQi5nZXRDYXRlZ29yeSgpID09PSAnbmV2ZXInKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGNiKCdORVZFUicpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGlzQ2FjaGVkKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGNiKCdDQUNIRUQnKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIHJldHVybiBjYignTk9UX0NBQ0hFRCcpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9O1xuICAgIHJldHVybiBDYWNoZVNlcnZlclJlcXVlc3Q7XG59KCkpO1xuZXhwb3J0cy5DYWNoZVNlcnZlclJlcXVlc3QgPSBDYWNoZVNlcnZlclJlcXVlc3Q7XG5cblxuXG4vLy8vLy8vLy8vLy8vLy8vLy9cbi8vIFdFQlBBQ0sgRk9PVEVSXG4vLyAuL3NyYy9jYWNoZVNlcnZlclJlcXVlc3QudHNcbi8vIG1vZHVsZSBpZCA9IDFcbi8vIG1vZHVsZSBjaHVua3MgPSAwIiwibW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKFwicmVkaXMtdXJsLWNhY2hlXCIpO1xuXG5cbi8vLy8vLy8vLy8vLy8vLy8vL1xuLy8gV0VCUEFDSyBGT09URVJcbi8vIGV4dGVybmFsIFwicmVkaXMtdXJsLWNhY2hlXCJcbi8vIG1vZHVsZSBpZCA9IDJcbi8vIG1vZHVsZSBjaHVua3MgPSAwIiwibW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKFwidXJsXCIpO1xuXG5cbi8vLy8vLy8vLy8vLy8vLy8vL1xuLy8gV0VCUEFDSyBGT09URVJcbi8vIGV4dGVybmFsIFwidXJsXCJcbi8vIG1vZHVsZSBpZCA9IDNcbi8vIG1vZHVsZSBjaHVua3MgPSAwIiwibW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKFwicmVxdWVzdFwiKTtcblxuXG4vLy8vLy8vLy8vLy8vLy8vLy9cbi8vIFdFQlBBQ0sgRk9PVEVSXG4vLyBleHRlcm5hbCBcInJlcXVlc3RcIlxuLy8gbW9kdWxlIGlkID0gNFxuLy8gbW9kdWxlIGNodW5rcyA9IDAiLCJtb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoXCJpY29udlwiKTtcblxuXG4vLy8vLy8vLy8vLy8vLy8vLy9cbi8vIFdFQlBBQ0sgRk9PVEVSXG4vLyBleHRlcm5hbCBcImljb252XCJcbi8vIG1vZHVsZSBpZCA9IDVcbi8vIG1vZHVsZSBjaHVua3MgPSAwIiwibW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKFwiZGVidWdcIik7XG5cblxuLy8vLy8vLy8vLy8vLy8vLy8vXG4vLyBXRUJQQUNLIEZPT1RFUlxuLy8gZXh0ZXJuYWwgXCJkZWJ1Z1wiXG4vLyBtb2R1bGUgaWQgPSA2XG4vLyBtb2R1bGUgY2h1bmtzID0gMCIsIm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZShcImh0dHBcIik7XG5cblxuLy8vLy8vLy8vLy8vLy8vLy8vXG4vLyBXRUJQQUNLIEZPT1RFUlxuLy8gZXh0ZXJuYWwgXCJodHRwXCJcbi8vIG1vZHVsZSBpZCA9IDdcbi8vIG1vZHVsZSBjaHVua3MgPSAwIl0sInNvdXJjZVJvb3QiOiIifQ==