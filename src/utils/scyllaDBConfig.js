const cassandra = require('cassandra-driver');
require ('dotenv').config(); // .env 파일 로드

const contactPoints = [process.env.SCYLLA_CONTACT_POINTS]; // Cassandra 드라이버의 contactPoints 는 IP 주소와 포트를 배열형식으로 입력 받아야 한다.
const localDataCenter = process.env.SCYLLA_LOCAL_DATACENTER;
const keyspace = process.env.SCYLLA_KEYSPACE;
const username = process.env.SCYLLA_SCYLLA_USERNAME;
const password = process.env.SCYLLA_SCYLLA_PASSWORD;

const client = new cassandra.Client({
    contactPoints: contactPoints,
    localDataCenter: localDataCenter,
    keyspace: keyspace,
    authProvider: new cassandra.auth.PlainTextAuthProvider(username,password)
});

client.connect()
    .then(()=> console.log('Connected to ScyllaDB successfully'))
    .catch(err => console.error('Error connecting to ScyllaDB:', err));

module.exports = client;