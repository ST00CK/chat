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
const grpcServerAddress = `${GRPC_SERVER_HOST}:${GRPC_SERVER_PORT}`;

// gRPC 클라이언트 생성
const client = new chatProto.ChatService(grpcServerAddress, grpc.credentials.createInsecure());

function sendNotification(userId, message, roomId) {
    return new Promise((resolve, reject) => {
        const notificationRequest = { user_id: userId, message, room_id: roomId };
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

// // 알림 전송 테스트
// function sendNotification() {
//     client.SendNotification({ user_id: 'A', message: 'Hello, A!' }, (err, response) => {
//         if (err) {
//             console.error('Error sending notification:', err);
//         } else {
//             console.log('Notification response:', response.status);
//         }
//     });
// }
//
// // 스트리밍 테스트
// function streamNotifications() {
//     const call = client.StreamNotifications();
//
//     call.write({ user_id: 'A', status: 'connected' });
//
//     setTimeout(() => {
//         call.write({ user_id: 'A', status: 'disconnected' });
//         call.end();
//     }, 5000);
//
//     call.on('data', (response) => {
//         console.log('Stream response:', response);
//     });
//
//     call.on('end', () => {
//         console.log('Stream ended');
//     });
// }
//
// // 테스트 실행
// sendNotification();
// streamNotifications();