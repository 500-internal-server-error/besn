.PHONY: help
help:
	@echo 'Commands:'
	@echo '  - help'
	@echo '  - rundev'
	@echo '  - clean'
	@echo '  - pack'

.PHONY: rundev
rundev:
	@npx tsx src/index.ts

.PHONY: clean
clean:
	@rm -rf build
	@rm -f besn.tar
	@rm -f config*.json
	@rm -rf run

.PHONY: pack
pack:
	@docker version > /dev/null 2>&1 || { echo 'Docker Engine is not running'; exit 1; }
	@docker rmi besn > /dev/null 2>&1 || echo > /dev/null
	@docker build -t besn .
	@docker save -o besn.tar besn
