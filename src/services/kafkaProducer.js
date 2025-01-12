const { v4: uuidv4 } = require('uuid'); // UUID 생성 라이브러리
const createKafkaInstance = require('../config/kafkaConfig');
const kafka = createKafkaInstance('chat-service-producer'); // Kafka 객체 생성

const producer = kafka.producer();

// Producer 연결을 유지하는 함수
const connectProducer = async () => {
    try {
        await producer.connect();
        console.log('Kafka producer connected');
    } catch (err) {
        console.error('Error in kafkaProducer_connectProducer: ', err);
    }
};

let retryCount = 0;
const maxRetries = 5; // 최대 재시도 횟수

// Kafka 메시지를 전송하는 함수
const sendMessageToKafka = async (topic, roomId, context, userId) => {
    const payload = {
        message_id: uuidv4(),
        room_id: roomId,
        user_id: userId,
        context: context,
        timestamp: new Date().toISOString(), // 현재 시간
    };

    const trySendMessage = async () => {
        try {
            await producer.send({
                topic: topic,
                messages: [{ key: roomId, value: JSON.stringify(payload) }],
            });
            console.log('Message sent to Kafka:', payload);
        } catch (err) {
            console.error('Error in kafkaProducer:', err);

            if (retryCount < maxRetries) {
                retryCount++;
                console.log(`Retrying (${retryCount}/${maxRetries})...`);
                setTimeout(trySendMessage, 1000); // 1초 대기 후 재시도
            } else {
                console.error('Max retry limit reached. Message failed:', payload);
            }
        }
    };

    await trySendMessage();
}

// 애플리케이션 종료 시 Kafka Producer 연결 해제
const disconnectProducer = async () => {
    try {
        await producer.disconnect();
        console.log('Kafka Producer disconnected');
    } catch (err) {
        console.error('Error disconnecting Kafka Producer:', err);
    }
};

module.exports = { connectProducer,sendMessageToKafka, disconnectProducer };