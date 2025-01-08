const socket = io({path: '/chat/socket.io',});

// 메시지 송신
document.querySelector('#chatForm').addEventListener('submit', (e) => {
    e.preventDefault(); // 폼이 기본적으로 페이지를 새로고침하는 동작을 막는다.
    const message = document.querySelector('#messageInput').value; // messageInput 에서 입력한 메시지를 가지고 옴
    socket.emit('chatMessage', message); // 서버로 chatMessage 이벤트와 함께 입력한 message 를 전송
    document.querySelector('#messageInput').value = ''; // 메시지 전송 후 입력 필드를 지움
});

// 메시지 수신
socket.on('chatMessage', (data) => {
    const chatBox = document.querySelector('#chatBox');
    const messageElement = document.createElement('p');
    messageElement.textContent = `${data.id}: ${data.message}`;
    chatBox.appendChild(messageElement);
});

// 사용자 연결 종료
socket.on('userDisconnect', (data) => {
    const chatBox = document.querySelector('#chatBox');
    const messageElement = document.createElement('p');
    messageElement.textContent = `사용자 ${data.id} 연결 종료`;
    chatBox.appendChild(messageElement);
});
