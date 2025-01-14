require ('dotenv').config({ path: '../.env' }); // .env 파일 로드
const { Kafka } = require('kafkajs');
const fs = require('fs');

const kafkaBrokers = [process.env.KAFKA_BROKERS];

// Kafka 객체 생성 함수 ( 로그와 모니터링을 쉽게하기 위해 clientID 를 Consumer 와 Producer 에서 나누어서 관리하기 )
const createKafkaInstance = (clientId) => {
    // TLS 옵션 설정 여부 확인
    const useTls = fs.existsSync(process.env.KAFKA_SSL_CLIENT_CERT) && fs.existsSync(process.env.KAFKA_SSL_CLIENT_KEY);

    const sslOptions = useTls
        ? {
            rejectUnauthorized: true,
            ca: fs.readFileSync(process.env.KAFKA_SSL_CA_CERT, 'utf-8'),
            cert: fs.readFileSync(process.env.KAFKA_SSL_CLIENT_CERT, 'utf-8'),
            key: fs.readFileSync(process.env.KAFKA_SSL_CLIENT_KEY, 'utf-8'),
        }
        : null;

    return new Kafka({
        clientId: clientId, // 역할별 clientId 지정
        brokers: kafkaBrokers,
        ssl: sslOptions, // TLS 옵션 추가
    });
};

module.exports = createKafkaInstance;