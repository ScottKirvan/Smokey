# Changelog

## [0.2.0](https://github.com/ScottKirvan/Smokey/compare/v0.1.0...v0.2.0) (2026-09-07)


### Features

* show GitHub API rate limit usage at the bottom of the page ([7efe071](https://github.com/ScottKirvan/Smokey/commit/7efe07115f1efe7a3da7f697181dcad8cfda93f8))


### Bug Fixes

* match feed events against canonical repo name, not stale Settings text ([7b9eb3d](https://github.com/ScottKirvan/Smokey/commit/7b9eb3d574e05519ba22c36807aa0046817dafde))

## [0.1.0](https://github.com/ScottKirvan/Smokey/compare/v0.0.0...v0.1.0) (2026-09-06)


### Features

* add CI workflow status column with green/yellow/red classification ([d2aec5a](https://github.com/ScottKirvan/Smokey/commit/d2aec5a4cdb8b6358bc03585ffd31f579916e3db))
* add ice-blue CI state for blocked/waiting-for-approval workflows ([518ba2f](https://github.com/ScottKirvan/Smokey/commit/518ba2f7a3503342282106fdaec6a1746efb053e))
* add PWA support (manifest, service worker, icons) ([75535cc](https://github.com/ScottKirvan/Smokey/commit/75535ccb27d1c63832def9c1c3c6f91701afb096))
* add sliding event feed strip under traffic chart ([ddc448e](https://github.com/ScottKirvan/Smokey/commit/ddc448e58bcda224699448845a99c208401920f6))


### Bug Fixes

* add [hidden]{display:none!important} so PAT message hides correctly ([8794527](https://github.com/ScottKirvan/Smokey/commit/87945279e66f156c170e9dd4f2cc2d0c26dcef9f))
* add troubleshooting section covering PAT and cache issues ([edc5a5e](https://github.com/ScottKirvan/Smokey/commit/edc5a5ec558384d96fc8850cdd577de8c25042bb))
* add viewport meta tag for mobile rendering, reduce table min-width ([1ba82c8](https://github.com/ScottKirvan/Smokey/commit/1ba82c89a23bfbb8c10e04862e67599c006daeac))
* document PAT requirements and rate limit threshold in README ([100124a](https://github.com/ScottKirvan/Smokey/commit/100124a8d968481f2221bcdc2914f9dccc991aa1))
* guard against malformed traffic API responses crashing the chart ([c57a9b8](https://github.com/ScottKirvan/Smokey/commit/c57a9b886fd6624ca2549274070fb190950f4970))
* increase release date contrast from text-dim to text-muted ([c97f771](https://github.com/ScottKirvan/Smokey/commit/c97f7718ed278ff9083c52c1e79d8600d4912572))
* lift release date color to --text for readability ([5e5659d](https://github.com/ScottKirvan/Smokey/commit/5e5659dae0fb1a3fbe99c3948633f075eb06ccd1))
* move setInterval to init so it registers only once ([0ecd20a](https://github.com/ScottKirvan/Smokey/commit/0ecd20a5b39cfe1ccbfcd525b8686d70204da6c3))
* persist table sort order across reloads ([c5ec3f1](https://github.com/ScottKirvan/Smokey/commit/c5ec3f1135bb45449072053c488bb8d2ae82d60d)), closes [#11](https://github.com/ScottKirvan/Smokey/issues/11)
* pre-declare SVG elements to avoid innerHTML gradient reference failure ([6d4ba59](https://github.com/ScottKirvan/Smokey/commit/6d4ba597b5da1460694a3af5d87546ff08db5a4c))
* prevent feed marquee sticking paused after tab switch ([27baece](https://github.com/ScottKirvan/Smokey/commit/27baece2961af3da645afba6e7b111d45ae39e84))
* remove feed marquee hover-pause entirely ([deaf8d4](https://github.com/ScottKirvan/Smokey/commit/deaf8d44de97dc785c598efe3caeca4bf3fbf271))
* replace static feed chips with continuous CSS marquee scroll ([990727f](https://github.com/ScottKirvan/Smokey/commit/990727f1a247c1e69d766823ed9cc5f50a5fa69e))
* replace SVG gradient with solid fill-opacity to avoid url() reference failure ([1a69f27](https://github.com/ScottKirvan/Smokey/commit/1a69f27430210ac9753ba55480a0f31bb49e5446))
* shift traffic window to day 1-14 (exclude today's empty bucket) ([8109dc0](https://github.com/ScottKirvan/Smokey/commit/8109dc00d5bae1c3c02a9b689bc9a790ee93d93a))
* stop stopFeedPoll's uncaught ReferenceError from aborting saveConfig ([7cd16d6](https://github.com/ScottKirvan/Smokey/commit/7cd16d6a6248095a027c9186cc7f8f6240159ed4)), closes [#9](https://github.com/ScottKirvan/Smokey/issues/9) [#10](https://github.com/ScottKirvan/Smokey/issues/10)
* use style.display instead of hidden attribute for chart visibility ([e53786a](https://github.com/ScottKirvan/Smokey/commit/e53786a3a8dbf038db0036eea122974355686ab9))
* use window focus event to resume feed marquee after tab switch ([505b385](https://github.com/ScottKirvan/Smokey/commit/505b38532b4541a22cf4352e620169372235c1dc))

Includes PRs: [#14](https://github.com/ScottKirvan/Smokey/pull/14), [#15](https://github.com/ScottKirvan/Smokey/pull/15), [#17](https://github.com/ScottKirvan/Smokey/pull/17), [#3](https://github.com/ScottKirvan/Smokey/pull/3), [#7](https://github.com/ScottKirvan/Smokey/pull/7), [#8](https://github.com/ScottKirvan/Smokey/pull/8)

## 0.0.0 (2026-09-05)


### Features

* add initial Smokey dashboard ([1ee34c3](https://github.com/ScottKirvan/Smokey/commit/1ee34c370c8d68da2356efa51a5d669c52bab79a))
* add initial Smokey dashboard ([1f839b1](https://github.com/ScottKirvan/Smokey/commit/1f839b12f970d74672c48a866e3adec2b31b0875))


### Bug Fixes

* exclude bot accounts from attention badges and badge links ([0eae361](https://github.com/ScottKirvan/Smokey/commit/0eae3619f4c4fbc322cd77d92ff4e4d87d1beef4))

## Changelog
>[!NOTE]
> This file and it's version format is automatically 
> generated by [Please-Release](https://github.com/googleapis/release-please-action), 
> and adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
