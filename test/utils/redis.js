"use strict";

const redisCache = require('redis-url-cache');
const expect = require('chai').expect;
const debug = require('debug')('test');
const cdnConfig = require('./config').CDNConfig;

module.exports.createRedisConfig = () => {

    it('creates the config', done => {
        redisCache.CacheCreator.createCache(cdnConfig.instanceName, true, cdnConfig.redisConfig, cdnConfig.cacheRules, (err) => {
            if (err) return done(err);
            done();
        })
    });
    it('should connect to the instance ok', (done) => {
        let instance = new redisCache.Instance(cdnConfig.instanceName, cdnConfig.redisConfig, {}, function (err) {
            if (err) return done(err);
            done();
        });
    });
};

module.exports.clearURLs = (instanceName, urls) => {

    describe(`Clear URL cache`, () => {

        let instance, cacheEngine;

        it(`connect to redis-url-cache for ${cdnConfig.instanceName}`, (done) => {
            instance = new redisCache.Instance(cdnConfig.instanceName, cdnConfig.redisConfig, {}, function (err) {
                if (err) {
                    debug(err);
                    return done(err);
                }
                cacheEngine = new redisCache.CacheEngineCB(cdnConfig.defaultDomain, instance);
                done();
            })
        });

        urls.forEach((url) => {
            it(`clears the cache for url ${url}`, (done) => {
                cacheEngine.url(url).delete((err) => {
                    if (err && err !== 'url is not cached') {
                        return done(err);
                    }
                    done();
                })
            });
        });
    });
};


