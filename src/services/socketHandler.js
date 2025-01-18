const { sendNotification } = require('../grpc/client/chatClient')
const { getUsersInRoom } = require('./CassandraDataQuery');
const { sendMessageToKafka } = require('./kafkaProducer');
const { consumeMessageFromKafka } = require('./KafkaConsumer');

const userSocketMap = new Map(); // User ID와 Socket ID 매핑 관리

const socketHandler = (io) => {
    io.on('connection', (socket) => {
        console.log('New user connected:', socket.id);

        // User ID 등록
        socket.on('registerUser', (userId) => {
            userSocketMap.set(userId, socket.id); // User ID와 Socket ID 매핑
            console.log(`User ${userId} mapped to socket ${socket.id}`);
        });

        //방 입장
        socket.on('joinRoom', (data) => {
            if (typeof data === 'string') {
                data = JSON.parse(data); // 문자열을 JSON 객체로 변환
            }
            const { roomId } = data;
            console.log(data);
            socket.join(roomId);
            console.log(`User ${socket.id} joined room ${data.roomId}`);
        })

        //방 나가기
        socket.on('leaveRoom', (data) => {
            if (typeof data === 'string') {
                data = JSON.parse(data);
            }
            const { roomId } = data;
            socket.leave(roomId);
            console.log(`User ${socket.id} left room ${roomId}`);
        });

        // 클라이언트에서 메시지 전송
        socket.on('sendMessage', async (data) => {
            if (typeof data === 'string') {
                data = JSON.parse(data);
            }
            const { roomId, context } = data;
            const topic = 'chat_messages'
            // kafka 로 메시지 전송
            await sendMessageToKafka(topic, roomId, context, socket.id);

            const usersInRoom = await getUsersInRoom(roomId); // 방에 속한 유저 목록
            const offlineUsers = usersInRoom.filter(userId => !io.sockets.sockets.get(userId)); // 연결되지 않은 유저 필터링

            await Promise.all(
                offlineUsers.map(userId => sendNotification(userId,context, roomId))
            );
        })

        // Kafka 에서 메시지 소비 및 브로드캐스트
        consumeMessageFromKafka('chat_messages', (roomId, message) => {
            io.to(roomId).emit('newMessage', message);
        }).catch((err) => {
            console.error('Error in SocketHandler_consumeMessageFromKafka_single: ', err);
        })

        // 연결 해제 처리
        socket.on('disconnect', () => {
            for (const [userId, socketId] of userSocketMap.entries()) {
                if (socketId === socket.id) {
                    userSocketMap.delete(userId); // 연결 해제 시 매핑 제거
                    console.log(`User ${userId} disconnected and removed from map`);
                    break;
                }
            }
        });
    })
}

module.exports = socketHandler;