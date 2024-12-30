const express = require('express');
const cassandra = require('cassandra-driver');
const router = express.Router();
const client = require('../utils/scyllaDBConfig');

router.get('/chatroom/list', async (req, res) => {
    const query = 'SELECT * FROM chat_rooms';
    try{
        const result = await client.execute(query);
        res.json(result.rows);
    } catch (err) {
        res.status(500).send('Error fetching chat rooms');
    }
})

router.post('/chatroom/create', async (req, res) => {
    let { roomName, userId } = req.body;
    const roomId = cassandra.types.Uuid.random();
    const timeStamp = new Date();

    if (!roomName || roomName.trim().length === 0) {
        roomName = `${userId}'s room`;
    }

    try{
        const createRoomQuery = `INSERT INTO chat_rooms (room_id, room_name, created_at) VALUES (?, ?, ?)`;
        await client.execute(createRoomQuery, [roomId, roomName, timeStamp], {prepare: true});

        const userInsertPromises = userId.map(user =>{
            const addMemberQuery = `INSERT INTO room_members (room_id, user_id, joined_at) VALUES (?, ?, ?)`;
            return client.execute(addMemberQuery, [roomId, user, timeStamp], {prepare: true});
        });

        await Promise.all(userInsertPromises);

        res.status(201).send({message: 'Chat room created successfully', roomId, roomName, userId});
    } catch (err) {
        console.error(err);
        res.status(500).send('Error creating chat room');
    }
})

module.exports = router;