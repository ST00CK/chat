const { sendMessageToKafka } = require('./kafkaProducer');
const { consumeMessageFromKafka } = require('./KafkaConsumer');

const socketHandler = (io) => {
    io.on('connection', (socket) => {
        console.log('New user connected:', socket.id);

        //방 입장
        socket.on('joinRoom', ({ roomId }) => {
            socket.join(roomId);
            console.log(`User ${socket.id} joined room ${roomId}`);
        })

        // 클라이언트에서 메시지 전송
        socket.on('sendMessage', async ({ roomId, message, type }) => {
            const topic = type === 'single' ? 'single' : 'group';

            // kafka 로 메시지 전송
            await sendMessageToKafka(topic, roomId, { userId: socket.id, message});
            console.log(`Message from ${socket.id} sent to room ${roomId}`);
        })

        // Kafka 에서 메시지 소비 및 브로드캐스트
        consumeMessageFromKafka('chat_messages', (roomId, message) => {
            io.to(roomId).emit('newMessage', message);
        }).catch((err) => {
            console.error('Error in SocketHandler_consumeMessageFromKafka_single: ', err);
        })

        // 연결 해제
        socket.on('disconnect', () => {
            console.log('User disconnected:', socket.id);
        });
    })
}

module.exports = socketHandler;