#!/usr/bin/bash

set -eu

_die() {
	if [[ $# -gt 1 ]]; then
		echo "$1" >&2
		exit "$2"
	elif [[ $# -gt 0 ]]; then
		exit "$1"
	else
		exit 0
	fi
}

PROJECT_DIR="$(dirname "$0")"
cd "${PROJECT_DIR}" || _die "Directory gone" 1

help() {
	# `declare -f` doesn't preserve the order of definition

	echo 'Commands: '
	echo '  - help'
	echo '  - rundev'
	echo '  - clean'
	echo '  - pack'
}

rundev() {
	npx tsx src/index.ts
}

clean() {
	rm -rf build
	rm -f besn.tar*
	rm -f config.json
	rm -rf run
}

pack() {
	docker version > /dev/null 2>&1 || _die "Docker Engine is not running" 5
	docker rmi besn > /dev/nulll 2>&1 || echo > /dev/null
	docker build -t besn .
	docker save besn | zstd -9fT0 > besn.tar.zstd
}

if [[ $# -gt 0 ]]; then
	case "$1" in
		help) help ;;
		rundev) rundev ;;
		clean) clean ;;
		pack) pack ;;
		*) help ;;
	esac
else
	help
fi
