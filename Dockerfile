# 실행용 이미지 설정
FROM node:20.15.0-slim

# 권한문제 해결
USER root

RUN npm install

# 빌드된 파일 복사
COPY . .

# 애플리케이션 실행
CMD ["node", "src/server.js"]