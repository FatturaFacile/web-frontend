# Production image: Angular build (environment.production.ts -> https://api.fatturafacile.eu) served by nginx.
# Published on release by .github/workflows/deploy.yml as ghcr.io/fatturafacile/web-frontend and docker.io/fatturafacile/web.
FROM node:26-alpine AS build
SHELL ["/bin/ash", "-eo", "pipefail", "-c"]
WORKDIR /src
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm run build --configuration production \
 && mkdir /out \
 && cp -r "$(dirname "$(find dist -name index.html | head -n 1)")"/. /out/

FROM nginx:1.29-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /out/ /usr/share/nginx/html/
EXPOSE 80
