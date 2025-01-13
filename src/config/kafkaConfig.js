require ('dotenv').config({ path: '../.env' }); // .env 파일 로드
const { Kafka } = require('kafkajs');

const kafkaBrokers = [process.env.KAFKA_BROKERS];

// Kafka 객체 생성 함수 ( 로그와 모니터링을 쉽게하기 위해 clientID 를 Consumer 와 Producer 에서 나누어서 관리하기 )
const createKafkaInstance = (clientId) => {
    return new Kafka({
        clientId: clientId, // 역할별 clientId 지정
        brokers: kafkaBrokers,
    });
};

module.exports = createKafkaInstance;