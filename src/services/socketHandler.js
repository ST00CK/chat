const { sendNotification } = require('../grpc/client/chatClient')
const { getUsersInRoom, getRoomName } = require('./CassandraDataQuery');
const { sendMessageToKafka } = require('./kafkaProducer');
const { consumeMessageFromKafka } = require('./KafkaConsumer');

let isKafkaInitialized = false;

const socketHandler = (io, redis) => {
    io.on('connection', (socket) => {
        const socketId = socket.id;

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

        // Redis 에 유저-ID와 Socket-ID 매핑
        redis.sadd(`user:${userId}:sockets`, socketId);

        socket.data.userId = userId;

        console.log(`💡 User ${userId} registered with socket ${socketId}`);

        //방 입장
        socket.on('joinRoom', async (data) => {
            if (typeof data === 'string') {
                data = JSON.parse(data); // 문자열을 JSON 객체로 변환
            }
            const { roomId } = data;
            const userId = socket.data.userId;
            const socketId = socket.id;

            socket.join(roomId);

            await redis.sadd(`room:${roomId}:users`, userId); // 방에 속한 유저 관리
            await redis.sadd(`user:${userId}:rooms`, roomId); // 유저가 속한 방 관리
            await redis.sadd(`socket:${socketId}:rooms`, roomId); // 소켓에 속한 방 관리

            console.log(`💡 User ${userId} joined room ${roomId}`);
            console.log("💡 ", io.sockets.adapter.rooms.get(roomId));
        })

        //방 나가기
        socket.on('leaveRoom', async (data) => {
            if (typeof data === 'string') {
                data = JSON.parse(data);
            }
            const { roomId } = data;
            const userId = socket.data.userId;
            const socketId = socket.id;

            socket.leave(roomId);
            console.log(`💡 User ${userId} left room ${roomId}`);

            await redis.srem(`socket:${socketId}:rooms`, roomId);
            const remainingSockets = await redis.smembers(`user:${userId}:sockets`);
            let isUserStillInRoom = false;

            for (const otherSocketId of remainingSockets) {
                if (otherSocketId !== socketId) {
                    const roomsForOtherSocket = await redis.smembers(`socket:${otherSocketId}:rooms`);
                    if (roomsForOtherSocket.includes(roomId)) {
                        isUserStillInRoom = true;
                        break;
                    }
                }
            }

            if (!isUserStillInRoom) {
                await redis.srem(`user:${userId}:rooms`, roomId);
                await redis.srem(`room:${roomId}:users`, userId);
            }

            const remainingUsers = await redis.smembers(`room:${roomId}:users`);
            if (remainingUsers.length === 0) {
                await redis.del(`room:${roomId}:users`);
                console.log(`💡 Room ${roomId} completely removed`);
            }

            const remainingRoomsForSocket = await redis.smembers(`socket:${socketId}:rooms`);
            if (remainingRoomsForSocket.length === 0) {
                await redis.del(`socket:${socketId}:rooms`);
                console.log(`💡 socket:${socketId}:rooms deleted`);
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
            console.log("💡 usersInRoom --------> ", usersInRoom);
            const usersInRoomName = await getRoomName(roomId);

            const offlineUsers = await Promise.all(usersInRoom.map(async (userId) => {
                const isOnline = await redis.exists(`user:${userId}:sockets`);
                const isInRoom = await redis.sismember(`room:${roomId}:users`, userId);
                console.log(`💡 Checking user ${userId}: isOnline=${isOnline}, isInRoom=${isInRoom}`);
                return (!isOnline || !isInRoom) ? userId : null;
            })).then(results => results.filter(user => user !== null));

            console.log("💡 offlineUser --------> ", offlineUsers);

            if (offlineUsers.length === 0) {
                console.log("💡 No offline users to notify.");
                return;
            }
            await Promise.all(
                offlineUsers.map(async (userId) => {
                    try{
                        await sendNotification(roomId, userId, context, usersInRoomName);
                        console.log(`💡 Notification sent to user ${userId} in room ${roomId}`);
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
        socket.on('disconnect', async () => {
            const userId = socket.data.userId;
            const socketId = socket.id;
            console.log(`Socket ${socketId} for user ${userId} disconnected`);

            await redis.srem(`user:${userId}:sockets`, socketId);

            const rooms = await redis.smembers(`socket:${socketId}:rooms`);
            for (const roomId of rooms) {
                await redis.srem(`room:${roomId}:users`, userId);

                const roomSize = await redis.scard(`room:${roomId}:users`);
                if (roomSize === 0) {
                    await redis.del(`room:${roomId}:users`);
                }
            }

            await redis.del(`socket:${socketId}:rooms`);

            const remainingSocketsCount = await redis.scard(`user:${userId}:sockets`);
            if (remainingSocketsCount === 0) {
                await redis.del(`user:${userId}:sockets`);
                await redis.del(`user:${userId}:rooms`);
                console.log(`💡 User ${userId} completely removed`);
            }
        });
    })
}

module.exports = socketHandler;