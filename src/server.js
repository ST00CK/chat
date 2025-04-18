const express = require('express');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { connectProducer } = require('./services/kafkaProducer');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swaggerConfig');
const socketHandler = require('./services/socketHandler');
const createRedisInstance = require('./config/redisConfig');

// 라우트 파일 가지고 오기
const indexRoutes = require('./routes/index');
const chatRoutes = require('./routes/chatRoom');

const app = express();
const server = http.createServer(app);

// Socket.io 서버 생성
const io = new Server(server, {
    cors: {
        origin: '*', // 모든 도메인 허용 (테스트 환경)
        methods: ['GET', 'POST'],
    },
});

// Redis 초기화
const redis = createRedisInstance();
redis.on('connect', () => {console.log('✅ Redis 연결 성공')});
redis.on('error', (err) => {console.log('❌ Redis 연결 실패:', err)})

socketHandler(io, redis);

// 정적 파일 제공
app.use(express.static(path.join(__dirname, '../public')));

// Express CORS 설정
app.use(cors({
    origin: '*', // 모든 도메인 허용 (테스트용)
    methods: ['GET', 'POST', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type'],
}));

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

// 서버 시작 시 Kafka Producer 연결
connectProducer().catch((err) => {
    console.error('Failed to connect Kafka Producer:', err);
});

// 서버 시작
const PORT = process.env.LOCALPORT;
server.listen(PORT, () => {
    console.log(`서버 실행 중: http://localhost:${PORT}`);
    console.log(`Swagger API 문서: http://localhost:${PORT}/chat/api-docs`);
});