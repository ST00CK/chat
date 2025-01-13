const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');

// .proto 파일 경로
const PROTO_PATH = path.join(__dirname, '../proto/chat.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
});
const chatProto = grpc.loadPackageDefinition(packageDefinition).chat;

// 사용자 상태 관리
const connectedUsers = {};

// gRPC 서버 생성
const server = new grpc.Server();

server.addService(chatProto.ChatService.service, {
    StreamNotifications: (call) => {
        call.on('data', (request) => {
            const { user_id, status } = request;
            connectedUsers[user_id] = status;
            console.log(`[Stream] User ${user_id} is now ${status}`);
        });

        call.on('end', () => {
            call.end();
        });
    },

    SendNotification: (call, callback) => {
        const { user_id, message } = call.request;
        console.log(`[Notification] Sending to ${user_id}: ${message}`);
        callback(null, { status: 'success' });
    }
});

// 서버 실행
const PORT = '50051';
server.bindAsync(`0.0.0.0:${PORT}`, grpc.ServerCredentials.createInsecure(), () => {
    console.log(`gRPC Server is running on port ${PORT}`);
});
