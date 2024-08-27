### Stage: Base to set variables and stuff

FROM alpine:edge AS base

ARG PKGNAME="besn"
ARG PKGDIR="/opt/$PKGNAME"

ENV TZ="Asia/Jakarta"
ENV LANG="C"
ENV LC_ALL="C"

WORKDIR "$PKGDIR"

### Stage: Test + Build

FROM base AS build

RUN ["apk", "add", "--no-cache", "--update", "nodejs-current", "npm"]

COPY . .

RUN ["npm", "ci"]
# We need variable expansion but we don't need the shell, so exec it away
RUN ["sh", "-c", "exec", "npx", "eslint", "$PKGDIR/src"]
RUN ["npx", "tsc"]
RUN [ \
	"npx", \
	"esbuild", \
	"src/index.ts", \
	"--bundle", \
	"--platform=node", \
	"--target=esnext", \
	"--format=esm", \
	"--sourcemap", \
	"--sources-content=false", \
	"--minify", \
	"--outfile=build/index.mjs", \
	# https://github.com/evanw/esbuild/issues/1921#issuecomment-1152991694
	"--banner:js=import { createRequire } from 'module';const require = createRequire(import.meta.url);" \
]

### Stage: Run final image

FROM base AS run

ENV NODE_ENV="production"

RUN ["apk", "add", "--no-cache", "--update", "nodejs-current"]
COPY --from=build "$PKGDIR/build" "$PKGDIR/dist"

# Again, we want variable expansion but we don't want the shell, exec it away again
# Also prevent users from overriding CMD
# Theres probably a nicer way to do this than relying on shelling out to pwd but for now it works
ENTRYPOINT exec node --enable-source-maps "$(pwd)/dist/index.mjs"
