

import {RedisStorageConfig, CacheRules} from 'redis-url-cache';
import * as bunyan from 'bunyan';

export interface ICDNConfig {
    defaultDomain: string,
    port: number,
    instanceName: string,
    redisConfig: RedisStorageConfig,
    cacheRules: CacheRules
}

export class CacheServer {
    constructor( cdnConfig: ICDNConfig, logger: bunyan.Logger)
    start(cb: Function): void
    stop(cb: Function): void
}
