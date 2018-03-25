FROM node:8.10-alpine

WORKDIR /usr/app

COPY package.json package-lock.json* ./
RUN npm install --quiet

COPY . .
