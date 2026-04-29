FROM node:20-alpine

RUN npm install -g pnpm

WORKDIR /app

COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/ ./packages/
COPY apps/ ./apps/

RUN pnpm install --frozen-lockfile
RUN pnpm build

# Create a wrapper script pointing to the locally-built CLI
RUN printf '#!/bin/sh\nexec node /app/apps/cli/dist/index.js "$@"\n' > /usr/local/bin/taskpipe \
    && chmod +x /usr/local/bin/taskpipe

WORKDIR /workspace

ENTRYPOINT ["taskpipe"]
CMD ["--help"]
