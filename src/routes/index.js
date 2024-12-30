const express = require('express');
const path = require('path');
const router = express.Router();

router.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, '../../public/index.html'));
})

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
router.get('/api/ping', (req, res) => {
    res.status(200).json({ message: 'pong' });
});

module.exports = router;