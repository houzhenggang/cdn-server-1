"use strict";
const Iconv = require('iconv');
const path = require('path');
const chai = require('chai');
const fs = require('fs-extra');
const debug = require('debug')('mocha-test-cache-server');
const request = require('request');
const expect = chai.expect;
const config = require('./utils/config');
const utils = require('./utils/utils');
const redisUtils = require('./utils/redis');

describe('forcing creation of redis config', () => {
    redisUtils.createRedisConfig();
});

describe(`Launching servers`, () => {
    utils.testStart();
    utils.startCDN();
});

const notCachedUrls = [
    'http://127.0.0.1:3030/rfc/*/h/cn',
    'http://127.0.0.1:3030/rfc/*/h/fr',
    'http://127.0.0.1:3030/rfc/*/h/en'
];

const cachedUrls = [
    'http://127.0.0.1:8080/products/200',
    'http://127.0.0.1:8080/products/300'
];



describe('No referer', () => {

    describe(`URLs that shouldn't be cached`, () => {

        notCachedUrls.forEach((url) => {

            utils.getFailedUrl(
                url,
                {},
                501
            );

        });

        cachedUrls.forEach((url) => {

            utils.getFailedUrl(
                url,
                {},
                501
            );

        });
    });
});

describe('With a referer', () => {

    describe(`URLs that shouldn't be cached`, () => {

        notCachedUrls.forEach((url) => {

            utils.getSuccessUrl(
                    url,
                    {'referer': 'http://127.0.0.1:3000'},
                    200,
                    {
                        'caching-status': 'NEVER',
                        'ngservercached': 'no'
                    },
                    true
                );

            utils.getSuccessUrl(
                    url,
                    {'referer': 'http://127.0.0.1:3000'},
                    200,
                    {
                        'caching-status': 'NEVER',
                        'ngservercached': 'no'
                    },
                    true
                );
        });
    });

    describe(`URLs that should be cached`, () => {

        redisUtils.clearURLs('SLIMER_REST', ['http://127.0.0.1:8080/products/200','http://127.0.0.1:8080/products/300']);

        describe(`Loads them for the first time`, () => {


            cachedUrls.forEach((url) => {

                utils.getSuccessUrl(
                        url,
                        {'referer': 'http://127.0.0.1:3000'},
                        200,
                        {
                            'caching-status': 'NOT_CACHED',
                            'ngservercached': 'yes'
                        },
                        true
                    );
            });
        });

        describe(`Loads them for second first time`, () => {


            cachedUrls.forEach((url) => {

                utils.getSuccessUrl(
                        url,
                        {'referer': 'http://127.0.0.1:3000'},
                        200,
                        {
                            'caching-status': 'CACHED',
                            'ngservercached': 'yes'
                        },
                        true
                    );

            });

        });

        redisUtils.clearURLs('SLIMER_REST', ['http://127.0.0.1:8080/products/200','http://127.0.0.1:8080/products/300']);

        describe(`Loads them for third time`, () => {

            cachedUrls.forEach((url) => {

                utils.getSuccessUrl(
                        url,
                        {'referer': 'http://127.0.0.1:3000'},
                        200,
                        {
                            'caching-status': 'NOT_CACHED',
                            'ngservercached': 'yes'
                        },
                        true
                    );
                });

        });

    });
});

describe('Error testing', () => {
    describe.skip(`a URL wth a a strange invalid header `, () => {

        it(`retrieve it directly via request() should fail`, () => {

        });

        it(`should not load the URL`, () => {
        });
    });

    describe(`an invalid URL`, () => {
        utils.getFailedUrl(
            'http://www',
            {
                referer: 'http://127.0.0.1:3000'
            },
            501
        );
    });

});

describe(`Querying URLs that shouldn't be cached`, () => {


    //tdo design a server that doesnt allow custm headers....


    /*

     it(`timer1 ${timer1} should be almost equal to timer2 ${timer2}`, () {

     });

     */

});

/*
    it(`headers should have headers['ngServerCached'] = 'yes'`, () => {

    });

    it(`timer1  should be much higher than timer2 `, () => {

    });
});

*/
describe.skip(`DDOS ATTACK`, () => {

});

describe('stopping servers', () => {
    utils.testStop();
    utils.stopCDN();
});

describe('removing log file', () => {
    it('removes the file', () => {
        if(fs.existsSync (  path.resolve(__dirname + '/test.log'))) {
            fs.removeSync( path.resolve(__dirname + '/test.log'));
        }

    });

    it('file shouldnt exist', () => {
        expect(fs.existsSync (  path.resolve(__dirname + '/test.log'))).eql(false);
    });
});