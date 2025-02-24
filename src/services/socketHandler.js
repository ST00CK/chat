const { sendNotification } = require('../grpc/client/chatClient')
const { getUsersInRoom } = require('./CassandraDataQuery');
const { sendMessageToKafka } = require('./kafkaProducer');
const { consumeMessageFromKafka } = require('./KafkaConsumer');

const userSocketMap = new Map(); // User ID와 Socket ID 매핑 관리
const roomUserMap = new Map(); // Room ID 와 User ID 매핑 관리
let isKafkaInitialized = false;

const socketHandler = (io) => {
    io.on('connection', (socket) => {
        console.log('New user connected:', socket.id);

        if (!isKafkaInitialized) {
            console.log("Kafka Consumer initializing...");
            isKafkaInitialized = true;
        }

        // 클라이언트가 연결할 때 자동으로 userId 등록
        const userId = socket.handshake.query.userId;
        if (!userId) {
            console.error("커넥션을 위한 유저아이디가 존재하지 않습니다.");
            return;
        }

        if (!userSocketMap.has(userId)) {
            userSocketMap.set(userId, new Set());
        }
        userSocketMap.get(userId).add(socket.id);
        socket.data.userId = userId;

        console.log(`💡User ${userId} registered with socket ${socket.id}`);

        //방 입장
        socket.on('joinRoom', (data) => {
            if (typeof data === 'string') {
                data = JSON.parse(data); // 문자열을 JSON 객체로 변환
            }
            const { roomId } = data;
            const userId = socket.data.userId;

            socket.join(roomId);

            if (!roomUserMap.has(roomId)) {
                roomUserMap.set(roomId, new Map());
            }

            const roomUsers = roomUserMap.get(roomId);

            if (!roomUsers.has(userId)) {
                roomUsers.set(userId, new Set());
            }
            roomUsers.get(userId).add(socket.id);

            console.log(`💡User ${userId} joined room ${roomId}`);
            console.log("💡", io.sockets.adapter.rooms.get(roomId));
        })

        //방 나가기
        socket.on('leaveRoom', (data) => {
            if (typeof data === 'string') {
                data = JSON.parse(data);
            }
            const { roomId } = data;
            const userId = socket.data.userId;

            socket.leave(roomId);
            console.log(`💡User ${userId} left room ${roomId}`);

            if (roomUserMap.has(roomId)) {
                const roomUsers = roomUserMap.get(roomId);

                if (!(roomUsers instanceof Map)) {
                    console.error(`roomUsers for ${roomId} is not a Map!`);
                    return;
                }

                // userId 가 아닌 socket.id 를 제거해야 함.
                if (roomUsers.has(userId)) {
                    const userSockets = roomUsers.get(userId);

                    // 특정 socket.id만 제거
                    userSockets.delete(socket.id);
                    console.log(`💡Removed socket ${socket.id} from user ${userId} in room ${roomId}`);

                    // 모든 socket.id 가 삭제되면 userId 삭제
                    if (userSockets.size === 0) {
                        roomUsers.delete(userId);
                        console.log(`💡User ${userId} completely removed from room ${roomId}`);
                    }

                    // 방에 아무도 없으면 room 자체 삭제
                    if (roomUsers.size === 0) {
                        roomUserMap.delete(roomId);
                        console.log(`💡Room ${roomId} deleted as no users are left.`);
                    }
                }
            }
        });

        // 클라이언트에서 메시지 전송
        socket.on('sendMessage', async (data) => {
            if (typeof data === 'string') {
                data = JSON.parse(data);
            }
            const { roomId, context } = data;
            const topic = 'chat_messages'
            const userId = socket.data.userId;
            console.log(userId);

            // kafka 로 메시지 전송
            await sendMessageToKafka(topic, roomId, context, userId);

            const usersInRoom = await getUsersInRoom(roomId); // 방에 속한 유저 목록
            console.log("💡usersInRoom --------> ", usersInRoom);

            const offlineUsers = usersInRoom.filter(userId => {
                const isOnline = userSocketMap.has(userId);
                const isInRoom = roomUserMap.has(roomId) && roomUserMap.get(roomId).has(userId);

                console.log(`💡Checking user ${userId}: isOnline=${isOnline}, isInRoom=${isInRoom}`);

                return !isOnline || !isInRoom; // 방에 없거나 완전히 오프라인이면 offlineUsers 로 간주
            });

            console.log("💡offlineUser --------> ", offlineUsers);

            if (offlineUsers.length === 0) {
                console.log("💡No offline users to notify.");
                return;
            }
            await Promise.all(
                offlineUsers.map(async (userId) => {
                    try{
                        await sendNotification(roomId, userId, context);
                        console.log(`💡Notification sent to user ${userId} in room ${roomId}`);
                    } catch (error) {
                        console.error("Error in socketHandler_sendMessage: ", error);
                    }
                })
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
            const userId = socket.data.userId;
            console.log(`Socket ${socket.id} for user ${userId} disconnected`);

            // 모든 소켓이 사라지면 userId 자체도 삭제
            for (const [roomId, roomUsers] of roomUserMap.entries()) {
                if (roomUsers.has(userId)) {
                    const userSockets = roomUsers.get(userId);
                    userSockets.delete(socket.id);

                    if (userSockets.size === 0) {
                        roomUsers.delete(userId);
                        console.log(`User ${userId} fully removed from room ${roomId}`);
                    }

                    if (roomUsers.size === 0) {
                        roomUserMap.delete(roomId);
                        console.log(`Room ${roomId} deleted as no users are left.`);
                    }
                }
            }

            if (userSocketMap.has(userId)) {
                const userSockets = userSocketMap.get(userId);
                userSockets.delete(socket.id);
                console.log(`💡Removed socket ${socket.id} from userSocketMap for user ${userId}`);

                if (userSockets.size === 0) {
                    userSocketMap.delete(userId);
                    console.log(`💡User ${userId} completely removed from userSocketMap`);
                }
            }
        });
    })
}

module.exports = socketHandler;