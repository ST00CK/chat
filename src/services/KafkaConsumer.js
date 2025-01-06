const kafka = require('../config/kafkaConfig');

const consumer = kafka.consumer({ groupId: ''}); //Consumer 생성

const consumeMessageFromKafka = async (topic, handleMessage) => {
    try{
        await consumer.connect();

        // 특정 토픽에 메시지를 구독, 새로운 메시지만 소비하겠다는 설정. true 일 경우에 모든 메시지를 처음부터 소비한다.
        await consumer.subscribe({ topic, fromBeginning: false });

        // eachMessage : 메시지가 들어올 때마다 호출되는 콜백함수.
        await consumer.run({
            eachMessage: async ({ topic, partition, message }) => {
                // Kafka 메시지는 문자열 형식으로 저장되므로, JSON 으로 파싱.
                const parsedMessage = JSON.parse(message.value.toString());
                const roomId = parsedMessage.roomId;

                await handleMessage(roomId, parsedMessage);
            }
        })
    } catch (err) {
        console.error('Error in KafkaConsumer: ', err);
    }
};

module.exports = { consumeMessageFromKafka };