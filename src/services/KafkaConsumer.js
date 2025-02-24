const createKafkaInstance = require('../config/kafkaConfig');
const kafka = createKafkaInstance('chat-service-consumer'); // Consumer 용 clientId 설정
const consumer = kafka.consumer({groupId: 'chat_service'});

let isConsumerRunning = false;

const consumeMessageFromKafka = async (topic, handleMessage) => {
    try {
        if(isConsumerRunning) {
            console.log("Kafka Consumer is already running.");
            return;
        }
        console.log("📡 Connecting Kafka Consumer...");
        await consumer.connect();
        await consumer.subscribe({topic, fromBeginning: process.env.CONSUME_FROM_BEGINNING === 'true'});

        isConsumerRunning = true;

        await consumer.run({
            eachMessage: async ({topic, partition, message}) => {
                try {
                    const parsedMessage = JSON.parse(message.value.toString());
                    const roomId = parsedMessage.room_id;

                    await handleMessage(roomId, parsedMessage);
                    console.log('📩 Message consumed from Kafka:', {roomId, parsedMessage});
                } catch (err) {
                    console.error('❌ Error in KafkaConsumer_eachMessage: ', err);
                }
            }
        });
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