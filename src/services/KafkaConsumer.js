const createKafkaInstance = require('../config/kafkaConfig');
const kafka = createKafkaInstance('chat-service-consumer'); // Consumer 용 clientId 설정
const consumer = kafka.consumer({groupId: 'chat_service'});

let isConsumerRunning = false;

const consumeMessageFromKafka = async (topic, handleMessage) => {
    try {
        if (!isConsumerRunning) {
            await consumer.connect();

            // 특정 토픽에 메시지를 구독, 새로운 메시지만 소비하겠다는 설정. true 일 경우에 모든 메시지를 처음부터 소비한다.
            //await consumer.subscribe({ topic, fromBeginning: false });
            await consumer.subscribe({topic, fromBeginning: process.env.CONSUME_FROM_BEGINNING === 'true'});

            // eachMessage : 메시지가 들어올 때마다 호출되는 콜백함수.
            await consumer.run({
                eachMessage: async ({topic, partition, message}) => {
                    try {
                        // Kafka 메시지는 문자열 형식으로 저장되므로, JSON 으로 파싱.
                        const parsedMessage = JSON.parse(message.value.toString());
                        const roomId = parsedMessage.room_id;

                        await handleMessage(roomId, parsedMessage);
                        console.log('Message consumed from Kafka:', {roomId, parsedMessage});
                    } catch (err) {
                        console.error('Error in KafkaConsumer_eachMessage: ', err);
                    }
                },
            });
            isConsumerRunning = true; // Consumer 실행 상태 업데이트
        } else {
            console.log('Kafka Consumer is already running.');
        }
    } catch (err) {
        console.error('Error in KafkaConsumer: ', err);
    }
};

const disconnectConsumer = async () => {
    try {
        await consumer.disconnect();
        console.log('Kafka consumer disconnected');
    } catch (err) {
        console.error('Error disconnecting Kafka consumer:', err);
    }
};

// 종료 처리
process.on('SIGINT', async () => {
    console.log('SIGINT received. Closing Kafka consumer...');
    await disconnectConsumer();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('SIGTERM received. Closing Kafka consumer...');
    await disconnectConsumer();
    process.exit(0);
});

module.exports = {consumeMessageFromKafka};