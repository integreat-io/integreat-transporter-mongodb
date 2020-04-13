FROM node:12.16-alpine

WORKDIR /usr/app

COPY package.json package-lock.json* ./
RUN npm install --quiet

COPY . .
