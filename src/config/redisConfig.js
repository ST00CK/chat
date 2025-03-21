require('dotenv').config({path: '../.env'}); // .env 파일 로드
const Redis = require('ioredis');

// Redis 설정 로직
const createRedisInstance = () => {
    return new Redis({
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT,
        password: process.env.REDIS_PASSWORD,
        retryStrategy(times) {
            return Math.min(times * 50, 2000); // 재연결 백오프 설정
        },
    });
};

module.exports = createRedisInstance;