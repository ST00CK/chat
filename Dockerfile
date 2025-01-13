# 실행용 이미지 설정
FROM node:20.15.0-slim

# 권한문제 해결
USER root

# 빌드된 파일 복사
COPY . .

RUN npm cache clean --force
RUN npm install

# 애플리케이션 실행
CMD ["node", "src/server.js"]