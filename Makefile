test:
	@echo "Launching tests"
	@ ./node_modules/.bin/mocha --timeout 2000 --reporter spec
	@echo "Tests finished"

.PHONY: test

