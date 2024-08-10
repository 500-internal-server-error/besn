### Stage: Base to set variables and stuff

FROM alpine:latest AS base

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
RUN ["env"]
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
	"--outfile=build/index.js", \
	# https://github.com/evanw/esbuild/issues/1921#issuecomment-1152991694
	"--banner:js=import { createRequire } from 'module';const require = createRequire(import.meta.url);" \
]

# https://github.com/terser/terser/pull/1530
RUN ["mkdir", "-p", "dist"]
RUN [ \
	"npx", \
	"terser", \
	"build/index.js", \
	"--compress", \
	"--source-map", \
	"content=build/index.js.map, url=index.min.js.map", \
	"--module", \
	"--ecma", \
	"2024", \
	"--mangle", \
	"--keep-classnames", \
	"--keep-fnames", \
	"--output", \
	"dist/index.min.js" \
]

### Stage: Run final image

FROM base AS run

ENV NODE_ENV="production"

RUN ["apk", "add", "--no-cache", "--update", "nodejs-current"]
COPY --from=build "$PKGDIR/dist" "$PKGDIR/dist"

# Again, we want variable expansion but we don't want the shell, exec it away again
# Also prevent users from overriding CMD
# Theres probably a nicer way to do this than relying on shelling out to pwd but for now it works
ENTRYPOINT exec node --experimental-default-type=module --enable-source-maps "$(pwd)/dist/index.min.js"
