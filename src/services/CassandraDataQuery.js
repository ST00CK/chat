const client = require('../config/scyllaDBConfig');
const { Uuid } = require('cassandra-driver').types;

async function getUsersInRoom(roomId) {
    console.log("-0-0-0-0-0-0-0-", typeof roomId);
    const query = `SELECT user_id FROM chat_messages WHERE room_id = ?`;
    try{
        const normalizedRoomId = typeof roomId === 'string' ? roomId : roomId ;
        const result = await client.execute(query, [normalizedRoomId]);
        return result.rows.map(row => row.user_id); // 유저 ID 목록 반환
    } catch (err) {
        console.error('Error in CassandraDataQuery_getUsersInRoom: ', err);
        return [];
    }
}

module.exports = { getUsersInRoom };