const { Kafka } = require('kafkajs');
require ('dotenv').config(); // .env 파일 로드

const kafkaBrokers = [process.env.KAFKA_BROKERS];

const kafka = new Kafka({
    clientId: '',
    brokers: kafkaBrokers,
});

module.exports = kafka;