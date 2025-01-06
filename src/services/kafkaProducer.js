const kafka = require('../config/kafkaConfig'); //Kafka 설정 가지고 오기

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

// Kafka 메시지를 전송하는 함수
const sendMessageToKafka = async (topic, roomId, message) => {
    try{
        //메시지 전송
        await producer.send({
            topic : topic,
            messages: [
                {
                    key: roomId, // 파티션 키 : 메시지가 특정 파티션으로 전달되도록 설정
                    value: JSON.stringify({ roomId, ...message})},
            ],
        })
        console.log('Success to send message kafkaProducer');
    } catch (err){
        console.error('Error in kafkaProducer: ', err);

        //재시도 로직
        setTimeout(async () => {
            try{
                await producer.send({
                    topic : topic,
                    messages: [
                        {
                            key: roomId, // 파티션 키 : 메시지가 특정 파티션으로 전달되도록 설정
                            value: JSON.stringify({ roomId, ...message})},
                    ],
                })
            } catch (retryErr) {
                console.error('Error in kafkaProducer_retried: ', retryErr);
            }
        }, 1000); // 1초후 재시도
    }
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