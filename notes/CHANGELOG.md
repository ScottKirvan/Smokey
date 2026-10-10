# Changelog

## [0.5.0](https://github.com/ScottKirvan/Smokey/compare/v0.4.0...v0.5.0) (2026-10-10)


### Features

* animated left-to-right sweep on the issue chart, replay on click ([ba09f8e](https://github.com/ScottKirvan/Smokey/commit/ba09f8e44b63b723435d88bb4430abf88f9445e6))
* color the issue chart's Feat category to match GitHub's enhancement label ([1f592c8](https://github.com/ScottKirvan/Smokey/commit/1f592c818dcede46241840bcf0b247b613da6ba3))
* grayscale issue chart in light mode and a finer half-pixel grid ([110d094](https://github.com/ScottKirvan/Smokey/commit/110d0941650858303bc9366cbbcf497dec7f6e44))
* issue chart grid covers the whole chart like log graph paper ([8923344](https://github.com/ScottKirvan/Smokey/commit/892334435a88849ce573225016ba9f3c7e356c84))
* issue chart needles point up for closes and down for opens ([67acf0a](https://github.com/ScottKirvan/Smokey/commit/67acf0a6c2b194fafc75cdafd83faa8aa8a0d206))
* make the star chart's colored-repo count a setting ([ffa8399](https://github.com/ScottKirvan/Smokey/commit/ffa8399331158e499d5d468b9a11b0cbd732e43b))
* neon magenta/cyan palette for the issue chart ([eb36eba](https://github.com/ScottKirvan/Smokey/commit/eb36ebaa74377ad9e439befe97de05785a09de09))
* redesign issue-chart marks as white-centered heat gradients ([7c76bc9](https://github.com/ScottKirvan/Smokey/commit/7c76bc97d5c3f1fb30580799cc0e66047ac59816))
* Settings toggle to turn the issue chart animation off ([bc487ee](https://github.com/ScottKirvan/Smokey/commit/bc487eec5406bc01c54412251c6d778a63dc4010))
* split the repo table's open issues into bugs/features/misc ([f4c8f49](https://github.com/ScottKirvan/Smokey/commit/f4c8f49517798539fc758f194d2906f693dc2ef1))
* star chart — new stars per quarter as stacked bands per repo ([fbe4c16](https://github.com/ScottKirvan/Smokey/commit/fbe4c169053621abd4644c70b7c41fe720675cd5))
* star chart uses a linear height scale and keeps repo-name case in its legend ([40b96d8](https://github.com/ScottKirvan/Smokey/commit/40b96d8dc9d4f0693cbccaa0417fabbb85751dcf))
* tighter, neon look for the issue chart ([7d8df44](https://github.com/ScottKirvan/Smokey/commit/7d8df447e3a12248691d1abb64eee2706513ba39))


### Bug Fixes

* cap issue-chart swell width to the day's actual plot width ([5154ab3](https://github.com/ScottKirvan/Smokey/commit/5154ab3f882876c8073c158ec77b5dc6466dc174))
* chart axis labels misaligned with their positions ([caa8ffc](https://github.com/ScottKirvan/Smokey/commit/caa8ffc0eb1d470f6d5e23b2a193f4e613e36195))
* darker Feat cyan and subdued Misc gray on the issue chart ([effb7c1](https://github.com/ScottKirvan/Smokey/commit/effb7c1eeeee40d872b93426c7f87383f465a65b))
* drop "history" from the issue chart header so it doesn't wrap ([5af437f](https://github.com/ScottKirvan/Smokey/commit/5af437fdb4f2051095f032e13cc770d7dc92542a))
* even out issue-chart x-axis, bigger clipped spikes, glow, and line back under diamonds ([bf8b862](https://github.com/ScottKirvan/Smokey/commit/bf8b8621041b08782e8f7f85d0289b95070c61bb))
* halve the issue-chart line glow spread ([28e50e1](https://github.com/ScottKirvan/Smokey/commit/28e50e1ead87924dce3cf731cbdecf86e29b697f))
* issue chart leaves right quarter empty; strengthen line and diamond color ([6ad6d5b](https://github.com/ScottKirvan/Smokey/commit/6ad6d5bf1e7b753e96cb475342d07f6ae0652800))
* issue chart legend swatches use the bright spike colors ([ec55bac](https://github.com/ScottKirvan/Smokey/commit/ec55bac4cf6f61fea1dc40f007023d15c3d5baec))
* issue chart needles back to opens up, closes down ([87b3567](https://github.com/ScottKirvan/Smokey/commit/87b3567d4b6c64202168d752a4006a8d45c8eb38))
* issue chart sweep slows down and stutters as it reveals more ([48c623c](https://github.com/ScottKirvan/Smokey/commit/48c623c71b25e9e7f6f2b89f40052116e2c71236))
* issue chart sweep stutters and leaves the tickers jittery afterwards ([f4a6a4c](https://github.com/ScottKirvan/Smokey/commit/f4a6a4cbd3e60a025c49a03e245f5b9f1abfc4ca))
* remove issue-chart connecting line, render candlesticks only ([7e67977](https://github.com/ScottKirvan/Smokey/commit/7e679775680f070d39d419ffea2f62d44ecda86a))
* scale issue-chart marks quadratically and shape them as tapered diamonds ([5a919c6](https://github.com/ScottKirvan/Smokey/commit/5a919c65782bfc8994d7861b67855d2cc51e67d8))
* slow the issue chart sweep to 6 seconds ([e8af5d1](https://github.com/ScottKirvan/Smokey/commit/e8af5d1db5fe99488b17f9d4a56a7b41d658a645))
* star chart colors only the top 4 repos, folding the rest into other ([2cff348](https://github.com/ScottKirvan/Smokey/commit/2cff348cf5c43eaa511eff0667448d266188cded))

## [0.4.0](https://github.com/ScottKirvan/Smokey/compare/v0.3.0...v0.4.0) (2026-10-03)


### Features

* add issue trend chart with log time axis and candlestick ranges ([#28](https://github.com/ScottKirvan/Smokey/pull/28))
* show 10 items in the activity feed and double the scroll speed ([a8ab1d7](https://github.com/ScottKirvan/Smokey/commit/a8ab1d793e1a0b70f9fa19d861cbab613da05dce))


### Bug Fixes

* activity feed silently dies forever on one failed /user fetch ([2c72282](https://github.com/ScottKirvan/Smokey/commit/2c722824f940b6d2a312f22318188f765b166ed4))
* add VitePress local search provider to docs ([#27](https://github.com/ScottKirvan/Smokey/pull/27))
* correct candlestick wick rendering and stroke scaling ([#29](https://github.com/ScottKirvan/Smokey/pull/29))
* show issue-chart activity as line swells sized by opens plus closes ([#31](https://github.com/ScottKirvan/Smokey/pull/31))

## [0.3.0](https://github.com/ScottKirvan/Smokey/compare/v0.2.0...v0.3.0) (2026-09-10)


### Features

* add full-range traffic history, fed by the traffic-log branch ([6e5ad8a](https://github.com/ScottKirvan/Smokey/commit/6e5ad8a2e416625e934ef3cc945a3210e6109712))
* add private-repo lock icon and unread notifications ticker ([8d282cc](https://github.com/ScottKirvan/Smokey/commit/8d282cc41edf0351a18fdfaddf2b2c89adb9c8b7))
* add weekly traffic logging workflow ([#22](https://github.com/ScottKirvan/Smokey/pull/22))
* show all unread notifications, link ALERTS label to GitHub inbox ([48314a0](https://github.com/ScottKirvan/Smokey/commit/48314a053d6ec0b33e1284954540966d6247b503))


### Bug Fixes

* brighten/enlarge lock icon, add timestamps to alert chips ([18c7d02](https://github.com/ScottKirvan/Smokey/commit/18c7d0283b83431bde8a5ad3d732017919b939b2))
* CI status and traffic chart silently dropping renamed repos ([283b12d](https://github.com/ScottKirvan/Smokey/commit/283b12df49d35309d5b4214213d2cc0a8879cbe7))
* replace 14-day traffic chart with full-history chart ([3f5fece](https://github.com/ScottKirvan/Smokey/commit/3f5fece8ac084c09b51977b503b0c31d98528b8a))
* skip Playwright tests on release-please PRs ([#24](https://github.com/ScottKirvan/Smokey/pull/24))
* suppress test workflow on release-please PRs via paths-ignore ([#25](https://github.com/ScottKirvan/Smokey/pull/25))

## [0.2.0](https://github.com/ScottKirvan/Smokey/compare/v0.1.0...v0.2.0) (2026-09-07)


### Features

* show GitHub API rate limit usage at the bottom of the page ([7efe071](https://github.com/ScottKirvan/Smokey/commit/7efe07115f1efe7a3da7f697181dcad8cfda93f8))


### Bug Fixes

* match feed events against canonical repo name, not stale Settings text ([7b9eb3d](https://github.com/ScottKirvan/Smokey/commit/7b9eb3d574e05519ba22c36807aa0046817dafde))

Includes PRs: [#20](https://github.com/ScottKirvan/Smokey/pull/20), [#21](https://github.com/ScottKirvan/Smokey/pull/21)

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
