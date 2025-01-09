const express = require('express');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swaggerConfig');
const eventHandlers = require('./utils/events');

// 라우트 파일 가지고 오기
const indexRoutes = require('./routes/index');
const chatRoutes = require('./routes/chatRoom');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// 정적 파일 제공
app.use(express.static(path.join(__dirname, '../public')));

// 기본 페이지 라우트
app.use('/', indexRoutes);

// JSON 데이터 처리를 위한 미들웨어
app.use(express.json());

// URL-Encoding 데이터 처리를 위한 미들웨어
app.use(express.urlencoded({ extended: true }));

// Swagger UI 라우트 추가
app.use('/api-docs', swaggerUi.serve);
app.get('/api-docs', swaggerUi.setup(swaggerSpec));

// API 라우트 등록
app.use('/api', chatRoutes);

// Socket.io 이벤트 등록
io.on('connection', (socket) => {
    console.log('사용자 연결됨:', socket.id);
    eventHandlers(socket, io);
});

// 서버 시작
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`서버 실행 중: http://localhost:${PORT}`);
    console.log(`Swagger API 문서: http://localhost:${PORT}/chat/api-docs`);
});