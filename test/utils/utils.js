'use strict';

const chai = require('chai');
const debug = require('debug')('cdn-test-server');
const expect = chai.expect;
const request = require('request');
var path = require('path');
const utils = require('./servers');
const config = require('./config');
const bunyan = require('bunyan');
const net = require('net');
const CacheServer = require('./../../dist/cache-server');


let runningServers = [];
let loadedURLs = {};
let cacheServer;


const portInUse = (port, callback) => {
    let server = net.createServer((socket) => {
        socket.write('Echo server\r\n');
        socket.pipe(socket);
    });

    server.listen(port, '127.0.0.1');
    server.on('error', function (e) {
        callback(true);
    });
    server.on('listening', function (e) {
        server.close();
        callback(false);
    });
};

const buildRequestURL = (url) => {
    return 'http://127.0.0.1:' + config.CDNConfig.port + '/get?url=' + url;
};


module.exports.startCDN = () => {

    it(`should start the CDN OK`, (done) => {
        const logger = bunyan.createLogger({name: 'cache-server-test',  streams: [
            {
                level: 'info',
                path: path.resolve(__dirname + './../test.log')
            }
        ]});
        cacheServer = new CacheServer(config.CDNConfig, logger);
        cacheServer.start((err) => {
            if (err) return done(err);
            done();
        });
    });

    it(`port ${config.CDNConfig.port} should be listening`, (done) => {
        portInUse(config.CDNConfig.port, (inUse) => {
            if (!inUse) return done('Port is not in use');
            done();
        });
    });
};

module.exports.stopCDN = () => {
    it(`should stop the cache server`, () => {
        cacheServer.stop();
        cacheServer = null;
    });

    it(`port ${config.CDNConfig.port} should not be listening`, (done) => {
        portInUse(config.CDNConfig.port, (inUse) => {
            if (inUse) return done('Port is still in use');
            done();
        });
    });

};

module.exports.getFailedUrl = (url, headers, expectedStatus) => {
    it(`${url} should fail`, (done) => {
        debug('going to reqquest', buildRequestURL(url));
        request({
            uri: buildRequestURL(url),
            headers: headers
        }, (error, response) => {

            if (error) {
                return done(error);
            }
            expect(response.statusCode).eql(expectedStatus);
            done();
        });
    });
};

module.exports.getSuccessUrl = (url, headers, expectedStatus, expectedHeaders, expectedBody) => {

    describe(`${url}`, () => {

        let responseData,
            bodyData,
            timer;

        if (typeof loadedURLs[url] === 'undefined') {

            it(`retrieving ${url} directly via request`, (done) => {
                timer = Date.now();
                request({
                    uri: url,
                    method: 'GET'
                }, (error, response, body) => {
                    if (error) {
                        return done(error);
                    }
                    timer = Date.now() - timer;
                    expect(response.statusCode).eql(200);
                    loadedURLs[url] = {
                        body: body,
                        headers: response.headers,
                        timer: timer
                    };
                    done();
                });
            });

        }

        it(`should retrieve with a a statusCode of ${expectedStatus}`, (done) => {
            timer = Date.now();
            request({
                uri: buildRequestURL(url),
                method: 'GET',
                headers: headers
            }, (error, response, body) => {
                if (error) {
                    return done(error);
                }
                bodyData = body;
                responseData = response;
                timer = Date.now() - timer;
                expect(response.statusCode).eql(expectedStatus);
                done();
            });
        });


        for (var i in expectedHeaders) {
            it(`${i} should equal ${expectedHeaders[i]}`, () => {
                expect(typeof responseData.headers[i]).not.eql('undefined');
                expect(responseData.headers[i]).eql(expectedHeaders[i]);
            });
        }

        it(`content-type should be correct`, () => {
            expect(typeof responseData.headers['content-type']).not.eql('undefined');
            expect(responseData.headers['content-type']).eql(loadedURLs[url].headers['content-type']);
        });

        if (expectedBody === true) {
            it(`body content matches direct request body content`, () => {
                expect(bodyData).eql(loadedURLs[url].body);
            });
        }

    });
};

module.exports.testStart = function () {

    it(`All servers should start`, (done) => {

        utils.startWebServers((err, servers) => {
            if (err) {
                return done(err);
            }
            runningServers = servers;
            done();
        })
    });


};

module.exports.testStop = function () {

    it('Should close all the servers', function (done) {

        utils.stopWebServers(runningServers, err => {
            if (err) return done(err);
            runningServers = [];
            done();
        });
    });

};
