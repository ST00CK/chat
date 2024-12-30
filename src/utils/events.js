module.exports = (socket, io) => {
    // 사용자 메시지 처리
    socket.on('chatMessage', (msg) => {
        console.log('메시지 수신:', msg);
        io.emit('chatMessage', { id: socket.id, message: msg });
    });

    // 사용자 연결 해제 처리
    socket.on('disconnect', () => {
        console.log('사용자 연결 종료:', socket.id);
        io.emit('userDisconnect', { id: socket.id });
    });
};
