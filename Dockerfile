FROM node:22-bookworm-slim

WORKDIR /app

COPY Backend/package*.json ./Backend/
RUN cd Backend && npm ci --omit=dev

COPY Backend ./Backend
COPY Frontend ./Frontend

WORKDIR /app/Backend
ENV NODE_ENV=production
EXPOSE 5000

CMD ["npm", "start"]
