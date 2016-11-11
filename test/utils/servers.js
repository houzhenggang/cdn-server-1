"use strict";
const favicon = require('express-favicon');
const express = require('express');
const dbg = require('debug');
const debug = dbg('test-server');
const products = require('./config').products;
const rfcServer = express();
const testServer = express();

testServer.options('*', function(req, res, next) {
    debug('OPTION CALLED', req.url);
    next();
});

testServer.use(function(req, res, next) {

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Request-Method', '*');
    res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, GET');
    //res.setHeader('Access-Control-Allow-Headers', '*');
    if ( req.method === 'OPTIONS' ) {
        res.writeHead(200);
        debug('Inside CORS');
        res.end();
        return;
    }
    res.set("Connection", "close");
    //res.header('Access-Control-Allow-Headers', 'ngServerRest');
    next();
});


testServer.use(favicon(__dirname + '/favicon.ico'));

testServer.get('/products/:time', function(req, res) {
    setTimeout( function() {
        res.setHeader('content-type', 'application/json; charset=UTF-8');
        res.end(JSON.stringify(products));
    },req.params.time);
});

rfcServer.get('/rfc/:origin/:headers/:lang', function(req,res)  {

    if(req.params['origin']) {
        res.setHeader('Access-Control-Allow-Origin', req.params.origin);
    }

    if(req.params['headers']) {
        res.setHeader('Access-Control-Allow-Headers', req.params.headers);
    }

    switch(req.params.lang) {
        case 'en':
            res.setHeader('content-type', 'text/html; charset=UTF-8');
            res.status(200).send('Hello World');
            break;
        case 'fr':
            res.setHeader('content-type', 'text/html; charset=ISO-8859-1');
            res.status(200).send('hétérogénéité');
            break;
        case 'cn':
            res.setHeader('content-type', 'text/html; charset=Big5');
            res.status(200).send('常用字');
            break;
        default:
            res.setHeader('content-type', 'text/html; charset=UTF-8');
            res.status(501).send('lang not allowed');
    }

});



const serve = (expressApp, description, port) => {
    return new Promise((resolve, reject) => {

        const server = expressApp.listen(port, function () {
            debug(description + ' started on 127.0.0.1:' + port);
            resolve( {
                server: server,
                description: description,
                port: port
            });
        });

        process.once('uncaughtException',  (err) => {
            reject(err);
        });
    });
};



module.exports.stopWebServers = (runningServers, cb) => {

    const nbRunningServers = runningServers.length;
    let nbServerStopped = 0;

    debug('NB SERVERS TO STOP: ', nbRunningServers);

    runningServers.forEach( server => {
        debug(`stopping ${server.description} on port ${server.port}`);
        server.server.close( err => {
            if(err) { debug(err); return cb(err);}
            nbServerStopped++;
            debug(`server ${server.description} stopped` );
            if(nbServerStopped === nbRunningServers) {
                debug('All servers stopped successfully');
                cb(null);
            }
        })
    });
};

module.exports.startWebServers = function (cb) {

    const promiseArray = [
        serve(rfcServer, 'rfcServer', 3030),
        serve(testServer, 'testServer', 8080),
    ];

    Promise.all(promiseArray).then((servers) => {
        debug('Servers started');
        cb(null, servers);
    }, err => {
        debug('Some error happened while starting the servers', err);
        cb(err, null);
    });

};



module.exports.rfcServer = rfcServer;
module.exports.testServer = testServer;

