FROM node:lts-alpine AS build

WORKDIR /src

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run build

# nginx-unprivileged listens on 8080, matching the existing port mapping.
FROM nginxinc/nginx-unprivileged:alpine

COPY --from=build /src/dist /usr/share/nginx/html

EXPOSE 8080
