FROM node:20-alpine

RUN npm install -g pnpm

WORKDIR /app

COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/ ./packages/
COPY apps/ ./apps/

RUN pnpm install --frozen-lockfile
RUN pnpm build

RUN pnpm add -g @taskpipe/cli

WORKDIR /workspace

ENTRYPOINT ["taskpipe"]
CMD ["--help"]
