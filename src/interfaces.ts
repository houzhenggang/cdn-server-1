import {RedisStorageConfig, CacheRules} from 'redis-url-cache';

export interface ICDNConfig {
    defaultDomain: string,
    port: number,
    instanceName: string,
    redisConfig: RedisStorageConfig,
    cacheRules: CacheRules
}

export interface IHeaders {
    [name: string]: string
}

//INternal
export interface IRequestResult {
    content: string,
    status: number,
    headers: IHeaders
}