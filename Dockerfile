FROM node:lts-alpine

RUN npm install -g http-server

WORKDIR /src

COPY package*.json ./

RUN npm install

COPY . .

RUN npm run build

EXPOSE 8080
CMD [ "sh", "-c", "npm run build ; http-server dist -p 8080"]