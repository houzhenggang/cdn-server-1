'user strict';

const redisConfig = {
    host: '127.0.0.1',
    port: 6379,
    socket_keepalive: true
};

const cacheRules = {
    default: 'never',
    maxAge: [
        {
            domain: /(localhost|127.0.0.1):(8080|300|888)/,
            rules: [
                {
                    regex: /.*/,
                    maxAge: 30,
                    ignoreQuery: true
                }
            ]
        }

    ],
    never: [
        {
            domain: /localhost:3030/,
            rules: [
                {
                    regex: /.*/,
                    ignoreQuery: true,
                    always: []
                }
            ]
        }
    ],
    always: []
};

exports.products = [
    {
        name: "'test'",
        price: 1
    },
    {
        name: '"test2"',
        price: 2
    }];

exports.redisConfig = redisConfig;

exports.CDNConfig = {
    defaultDomain: 'http://localhost',
    port: 3000,
    instanceName: 'SLIMER_REST',
    redisConfig: redisConfig,
    cacheRules: cacheRules
};
