const express = require('express');
const cassandra = require('cassandra-driver');
const router = express.Router();
const client = require('../config/scyllaDBConfig');

/**
 * @swagger
 * /api/chatroom/list:
 *   get:
 *     summary: "채팅방 리스트 조회"
 *     description: "유저가 속해있는 채팅방 리스트를 가져옵니다."
 *     parameters:
 *       - in: query
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: 채팅방 목록을 가져올 사용자의 ID
 *     responses:
 *       200:
 *         description: "채팅방 리스트 조회 성공"
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   room_id:
 *                     type: string
 *                     example: "00f6b02e-818c-4284-8c3b-55c81ca058b3"
 *                   room_name:
 *                     type: string
 *                     example: "정, 김 님의 채팅방"
 *       400:
 *         description: "잘못된 요청 - userId가 누락됨"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "userID is missing"
 *       500:
 *         description: "서버 내부 오류"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Error fetching chat rooms"
 */
router.get('/chatroom/list', async (req, res) => {
    const { userId } = req.query;

    if ((!userId)) {
        return res.status(400).json({ error : 'userID is missing'});
    }

    try{
        const query1 = 'SELECT room_id FROM room_members WHERE user_id = ?';
        const result1 = await client.execute(query1, [userId], {prepare: true});

        if (result1.rows.length === 0){
            return res.status(200).json([]);
        }

        const roomIds = result1.rows.map(row => row.room_id);

        const query2 = `SELECT room_id, room_name FROM chat_rooms WHERE room_id IN (${roomIds.map(() => '?').join(',')})`;
        const result2 = await client.execute(query2, roomIds, {prepare: true});

        res.status(200).json(result2.rows);
    } catch (err) {
        res.status(500).send('Error fetching chat rooms');
    }
})

/**
 * @swagger
 * /api/chatroom/create:
 *   post:
 *     summary: "채팅방 생성"
 *     description: "새로운 채팅방을 생성하고 사용자를 방에 추가"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               roomName:
 *                 type: string
 *                 description: "생성할 채팅방 이름 (빈 경우 자동으로 생성)"
 *                 example: "Study Group"
 *               userId:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: "채팅방에 추가할 유저 ID 목록"
 *                 example: ["user123", "user456"]
 *     responses:
 *       201:
 *         description: "채팅방 생성 성공"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Chat room created successfully"
 *                 roomId:
 *                   type: string
 *                   description: "생성된 채팅방 ID"
 *                   example: "e5a37b13-634e-47ec-9a70-2bdf1d1b28f5"
 *                 roomName:
 *                   type: string
 *                   description: "채팅방 이름"
 *                   example: "Study Group"
 *                 userId:
 *                   type: array
 *                   items:
 *                     type: string
 *                   description: "추가된 유저 ID 목록"
 *                   example: ["user123", "user456"]
 *       400:
 *         description: "잘못된 요청 데이터"
 *       500:
 *         description: "서버 오류"
 */
router.post('/chatroom/create', async (req, res) => {
    let { roomName, userId } = req.body;
    const roomId = cassandra.types.Uuid.random();
    const timeStamp = new Date();
    const failedUsers = [];

    if (!roomName || roomName.trim().length === 0) {
        roomName = `${userId[0]}'s room`;
    }

    try{
        const createRoomQuery = `INSERT INTO chat_rooms (room_id, room_name, created_at) VALUES (?, ?, ?)`;
        await client.execute(createRoomQuery, [roomId, roomName, timeStamp], {prepare: true});

        await Promise.all(userId.map(async (user) => {
            try {
                const addMemberQuery = `INSERT INTO room_members (room_id, user_id, joined_at) VALUES (?, ?, ?)`;
                await client.execute(addMemberQuery, [roomId, user, timeStamp], {prepare: true});
            } catch (err) {
                console.error(`Failed to add user ${user}:`, err);
                failedUsers.push(user);
            }
        }));

        if (failedUsers.length > 0){
            console.warn(`Some users failed to be added:`, failedUsers);
        }

        res.status(201).send({message: 'Chat room created successfully', roomId, roomName, userId});
    } catch (err) {
        console.error(err);
        res.status(500).send('Error creating chat room');
    }
})

/**
 * @swagger
 * /api/chatroom/exit:
 *   delete:
 *     summary: "채팅방 나가기"
 *     description: "사용자가 특정 채팅방에서 나가며, 방에 남은 사용자가 없으면 방 삭제"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               roomId:
 *                 type: string
 *                 description: "나갈 채팅방의 ID"
 *                 example: "e5a37b13-634e-47ec-9a70-2bdf1d1b28f5"
 *               userId:
 *                 type: string
 *                 description: "방을 나가는 사용자의 ID"
 *                 example: "user123"
 *     responses:
 *       200:
 *         description: "사용자가 채팅방에서 성공적으로 나감"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "User user123 left the room e5a37b13-634e-47ec-9a70-2bdf1d1b28f5"
 *       400:
 *         description: "roomId 또는 userId가 요청에서 누락됨"
 *       500:
 *         description: "서버 내부 오류로 인해 방을 나가지 못함"
 */
router.delete('/chatroom/exit', async (req, res) =>{
    const { roomId, userId } = req.body;

    if (!roomId || !userId) {
        return res.status(400).json({ error: 'roomId or userId are missing'});
    }

    try{
        const deleteMemberQuery = `DELETE FROM room_members WHERE room_id = ? AND user_id = ?`;
        await client.execute(deleteMemberQuery, [roomId, userId], {prepare: true});

        const checkMemberQuery = `SELECT COUNT(*) FROM room_members WHERE room_id = ?`;
        const members = await client.execute(checkMemberQuery, [roomId], {prepare: true});

        if (parseInt(members.rows[0].count) === 0){
            const deleteRoomQuery = `DELETE FROM chat_rooms WHERE room_id = ?`;
            await client.execute(deleteRoomQuery, [roomId], {prepare: true});
        }

        res.status(200).send({message: `User ${userId} left the room ${roomId}`});
    } catch (err){
        console.error(err);
        res.status(500).send('Failed to exit the room');
    }
})

/**
 * @swagger
 * /api/chatroom/invite:
 *   post:
 *     summary: "채팅방 초대"
 *     description: "특정 채팅방에 사용자 초대"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               roomId:
 *                 type: string
 *                 description: "참여할 채팅방의 ID"
 *                 example: "e5a37b13-634e-47ec-9a70-2bdf1d1b28f5"
 *               userId:
 *                 type: string
 *                 description: "참여할 사용자의 ID"
 *                 example: "user123"
 *     responses:
 *       200:
 *         description: "사용자가 채팅방에 성공적으로 참여함"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "User user123 joined the room e5a37b13-634e-47ec-9a70-2bdf1d1b28f5"
 *       400:
 *         description: "roomId 또는 userId가 요청에서 누락"
 *       500:
 *         description: "서버 내부 오류로 인해 채팅방 참여 실패"
 */
router.post('/chatroom/invite', async (req, res) => {
    const { roomId, userId } = req.body;

    if (!roomId || !userId) {
        return res.status(400).json({ error: 'roomId or userId are missing' });
    }

    try{
        const joinRoomQuery = `INSERT INTO room_members (room_id, user_id, joined_at) VALUES (?, ?, ?)`;
        await client.execute(joinRoomQuery, [roomId, userId, new Date()], {prepare: true});

        res.status(200).send({message: `User ${userId} joined the room ${roomId}`});
    } catch (err){
        console.error(err);
        res.status(500).send('Failed to join the room');
    }
})

/**
 * @swagger
 * /api/chatroom/update:
 *   patch:
 *     summary: "채팅방 이름 업데이트"
 *     description: "특정 채팅방의 이름 업데이트"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               roomId:
 *                 type: string
 *                 description: "업데이트할 채팅방의 ID"
 *                 example: "e5a37b13-634e-47ec-9a70-2bdf1d1b28f5"
 *               roomName:
 *                 type: string
 *                 description: "새로운 채팅방 이름"
 *                 example: "Study Group"
 *     responses:
 *       200:
 *         description: "채팅방 이름이 성공적으로 업데이트됨"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Room e5a37b13-634e-47ec-9a70-2bdf1d1b28f5 updated successfully"
 *       400:
 *         description: "roomId 또는 roomName 이 누락되었거나 유효하지 않음"
 *       500:
 *         description: "서버 내부 오류로 인해 채팅방 업데이트 실패"
 */
router.patch('/chatroom/update', async (req, res) => {
    const { roomId, roomName } = req.body;

    if (!roomId || roomName.trim().length === 0) {
        return res.status(400).json({error: 'roomId is missing'});
    }

    try{
        const updateRoomQuery = `UPDATE chat_rooms SET room_name = ? WHERE room_id = ?`;
        await  client.execute(updateRoomQuery, [roomName, roomId], {prepare: true});

        res.status(200).send({message: `Room ${roomId} updated successfully`});
    } catch (err){
        console.error(err);
        res.status(500).send('Failed to update the room');
    }
})

/**
 * @swagger
 * /api/chatroom/log:
 *   get:
 *     summary: "채팅방 로그 조회 (커서 기반 페이지네이션)"
 *     description: |
 *       지정된 room_id에 대한 채팅 로그를 조회합니다.
 *       커서 기반 페이지네이션을 지원하며, 최초 요청 시에는 cursor 없이 최신 메시지를 가져오고,
 *       이후 요청 시에는 마지막 메시지의 send_at 값을 cursor 로 넘겨 이전 메시지를 조회합니다.
 *     parameters:
 *       - in: query
 *         name: roomId
 *         required: true
 *         schema:
 *           type: string
 *         description: "조회할 채팅방의 ID (UUID 형식)"
 *       - in: query
 *         name: cursor
 *         required: false
 *         schema:
 *           type: string
 *           format: date-time
 *         description: "이전 페이지의 마지막 메시지 시간 (ISO 8601 형식)"
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           default: 30
 *         description: "가져올 메시지 개수 (기본값 30)"
 *     responses:
 *       200:
 *         description: "채팅 로그 조회 성공"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 messages:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       message_id:
 *                         type: string
 *                         example: "c3f5a8a4-5d76-45d7-931b-4e0f41bf8e92"
 *                       room_id:
 *                         type: string
 *                         example: "00f6b02e-818c-4284-8c3b-55c81ca058b3"
 *                       user_id:
 *                         type: string
 *                         example: "user123"
 *                       context:
 *                         type: string
 *                         example: "안녕하세요!"
 *                       send_at:
 *                         type: string
 *                         format: date-time
 *                         example: "2024-02-19T12:34:56.789Z"
 *                 nextCursor:
 *                   type: string
 *                   format: date-time
 *                   nullable: true
 *                   example: "2024-02-19T12:34:56.789Z"
 *       400:
 *         description: "잘못된 요청 - roomId가 누락되었거나 유효하지 않음"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "roomId is missing"
 *       500:
 *         description: "서버 내부 오류"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Failed to get the room log"
 */

router.get('/chatroom/log', async (req, res) => {
    const { roomId, cursor, limit } = req.query;

    if(!roomId || typeof roomId !== 'string') {
        return res.status(400).json({error: 'roomId is missing'});
    }

    try{
        const cursorTimestamp = cursor ? new Date(cursor) : new Date();

        const chatLogQuery = `SELECT * FROM my_keyspace.chat_messages WHERE room_id = ? AND send_at < ? ORDER BY send_at DESC LIMIT ?`;
        const chatLog = await client.execute(chatLogQuery, [roomId, cursorTimestamp, limit], {prepare: true});

        const messages = chatLog.rows;
        const nextCursor = messages.length > 0 ? messages[messages.length -1].send_at : null;

        res.status(200).json({messages, nextCursor});
    }catch (err){
        console.error(err);
        res.status(500).send('Failed to get the room log');
    }
})

/**
 * @swagger
 * /api/chatroom/members:
 *   get:
 *     summary: "채팅방 멤버 조회"
 *     description: "지정된 room_id에 속한 멤버 목록을 조회합니다."
 *     parameters:
 *       - in: query
 *         name: roomId
 *         required: true
 *         schema:
 *           type: string
 *         description: "조회할 채팅방의 ID"
 *     responses:
 *       200:
 *         description: "채팅방 멤버 목록 조회 성공"
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   user_id:
 *                     type: string
 *                     example: "user123"
 *       400:
 *         description: "잘못된 요청 - roomId가 누락되었거나 유효하지 않음"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "roomId is missing"
 *       500:
 *         description: "서버 내부 오류"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Failed to get the room members"
 */
router.get('/chatroom/members', async (req, res) => {
    const { roomId } = req.query;

    if(!roomId || typeof roomId !== 'string') {
        return res.status(400).json({error: 'roomId is missing'});
    }

    try{
        const membersQuery = `SELECT user_id FROM my_keyspace.room_members WHERE room_id = ?`;
        const members = await client.execute(membersQuery, [roomId], {prepare: true});

        res.status(200).json(members.rows);
    }catch (err){
        console.error(err);
        res.status(500).send('Failed to get the room members');
    }
})

module.exports = router;