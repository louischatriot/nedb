test:
	@echo "Launching tests"
	@ ./node_modules/.bin/mocha --timeout 2000 --reporter spec
	@echo "Tests finished"

test40times:
	@echo "Launching the test suite 40 times"
	./testMultipleTimes.sh 40

.PHONY: test

