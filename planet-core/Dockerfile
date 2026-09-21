FROM node:22-alpine
WORKDIR /app
COPY package.json ./
COPY src ./src
RUN mkdir -p /data
ENV PORT=8787
ENV PLANET_DATA_DIR=/data
EXPOSE 8787
VOLUME ["/data"]
CMD ["node","src/app.js"]
