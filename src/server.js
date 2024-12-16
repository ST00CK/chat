const express = require('express');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

const eventHandlers = require('./events');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// 정적 파일 제공
app.use(express.static(path.join(__dirname, '../public')));

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
})

// Socket.io 이벤트 등록
io.on('connection', (socket) => {
    console.log('사용자 연결됨:', socket.id);
    eventHandlers(socket, io);
});

// 서버 시작
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`서버 실행 중: http://localhost:${PORT}`);
});
