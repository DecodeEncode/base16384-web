# base16384 web — run `make help` for targets. Needs only a JavaScript runtime;
# `check` and `images` need BROWSER (a headless-capable browser), `serve` uses python3,
# `licenses` uses gh, `vendor` copies the encoder from a base16384-js checkout.

NODE          ?= node
PORT          ?= 8000
BASE16384_JS  ?= ../base16384-js
SITE          := _site
PUBLISH       := index.html api assets vendor images LICENSE

.PHONY: help test check images vendor site serve licenses clean

help:
	@grep -E '^[a-z]+:.*## ' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  %-9s %s\n", $$1, $$2}'

test: ## run the API tests
	$(NODE) --test test/*.test.mjs

check: ## load every page in a headless browser and check the main functions (BROWSER=path)
	$(NODE) tools/screenshots.mjs --checks-only

images: ## retake the screenshots and the social card (BROWSER=path)
	$(NODE) tools/screenshots.mjs

vendor: ## refresh vendor/ from a base16384-js checkout (BASE16384_JS=path)
	{ printf '// Bundled from base16384-js (https://github.com/DecodeEncode/base16384-js), Apache-2.0;\n// see vendor/LICENSE-base16384-js. Update with `make vendor`.\n'; \
	  cat $(BASE16384_JS)/src/base16384.mjs; } > vendor/base16384.mjs
	cp $(BASE16384_JS)/LICENSE vendor/LICENSE-base16384-js

site: ## assemble the published site in _site/
	rm -rf $(SITE) && mkdir -p $(SITE)
	cp -R $(PUBLISH) $(SITE)/

serve: ## serve the app on 127.0.0.1 (PORT=8000)
	python3 -m http.server $(PORT) --bind 127.0.0.1

licenses: ## fetch the licence text verbatim
	gh api licenses/agpl-3.0 --jq .body > LICENSE

clean: ## remove build output
	rm -rf $(SITE)
