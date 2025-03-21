require ('dotenv').config({ path: '../.env' }); // .env 파일 로드
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

// gRPC 서버 정보
const GRPC_SERVER_HOST = process.env.GRPC_SERVER_HOST;
const GRPC_SERVER_PORT = process.env.GRPC_SERVER_PORT;
const USE_TLS = process.env.GRPC_USE_TLS === 'true'; // .env 에서 false 로 값을 주어도 문자열로 저장되기 때문에 boolean 값으로 설정 할 수 있도로 변경해야 한다.

// const GRPC_SERVER_HOST = `localhost`;
// const GRPC_SERVER_PORT = `9091`;
// const USE_TLS = process.env.GRPC_USE_TLS === 'false';

const grpcServerAddress = `${GRPC_SERVER_HOST}:${GRPC_SERVER_PORT}`;

console.log(`📡 Connecting to gRPC server at ${grpcServerAddress}`);
console.log(`🔒 TLS Enabled: ${USE_TLS}`);

// TLS 사용 여부에 따라 gRPC 클라이언트 설정 변경
const credentials = USE_TLS ? grpc.credentials.createSsl() : grpc.credentials.createInsecure();

// gRPC 클라이언트 생성
const client = new chatProto.ChatService(grpcServerAddress, credentials);

client.waitForReady(Date.now() + 5000, (err) => {
    if (err) {
        console.error("❌ gRPC 서버에 연결할 수 없습니다:", err);
    } else {
        console.log("✅ gRPC 서버 연결 성공:", grpcServerAddress);
    }
});


function sendNotification(roomId, userId, context, usersInRoomName) {
    console.log(`------------------- ${userId}, ${roomId}, ${context}`);
    return new Promise((resolve, reject) => {
        const notificationRequest = { roomId: roomId, userId: userId, message: context , roomName: usersInRoomName};
        client.SendNotification(notificationRequest, (err, response) => {
            if (err) {
                console.error(`Error sending notification to ${userId}:`, err);
                reject(err);
            } else {
                console.log(`Notification sent to ${userId}:`, response);
                resolve(response);
            }
        });
    });
}

module.exports = {
    sendNotification,
};