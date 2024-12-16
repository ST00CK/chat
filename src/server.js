const express = require('express');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./utils/swaggerConfig');

const eventHandlers = require('./events');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Swagger UI 라우트 추가
app.use('/api-docs', swaggerUi.serve);
app.get('/api-docs', swaggerUi.setup(swaggerSpec));

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
    console.log(`Swagger API 문서: http://localhost:${PORT}/api-docs`);
});

/**
 * @swagger
 * /api/ping:
 *   get:
 *     summary: "테스트용 API"
 *     description: "Swagger UI 테스트를 위한 간단한 API 입니다."
 *     responses:
 *       200:
 *         description: "서버 응답 성공"
 *         content:
 *           application/json:
 *             example:
 *               message: "pong"
 */
app.get('/api/ping', (req, res) => {
    res.status(200).json({ message: 'pong' });
});