# Smokey [![starline](https://raw.githubusercontent.com/ScottKirvan/Smokey/refs/heads/starlines/ScottKirvan/Smokey/starline.svg)](https://github.com/qoomon/starlines)
<div align="center">

  <img src="assets/media/logo.jpg" alt="logo" width="200" height="auto" />
    <h1><a href="https://github.com/ScottKirvan/Smokey">ScottKirvan/Smokey</a></h1>
  <h3>GitHub repo health at a glance — no login required for public repos</h3>
  
  
<!-- Badges -->
<p>
  <a href="https://github.com/ScottKirvan/Smokey/graphs/contributors">
    <img src="https://img.shields.io/github/contributors/ScottKirvan/Smokey" alt="contributors" />
  </a>
  <a href="">
    <img src="https://img.shields.io/github/last-commit/ScottKirvan/Smokey" alt="last update" />
  </a>
  <a href="https://github.com/ScottKirvan/Smokey/network/members">
    <img src="https://img.shields.io/github/forks/ScottKirvan/Smokey" alt="forks" />
  </a>
  <a href="https://github.com/ScottKirvan/Smokey/stargazers">
    <img src="https://img.shields.io/github/stars/ScottKirvan/Smokey" alt="stars" />
  </a>
  <a href="https://github.com/ScottKirvan/Smokey/issues/">
    <img src="https://img.shields.io/github/issues/ScottKirvan/Smokey" alt="open issues" />
  </a>
  <a href="https://github.com/ScottKirvan/Smokey/blob/main/LICENSE.md">
    <img src="https://img.shields.io/github/license/ScottKirvan/Smokey.svg" alt="license" />
  </a>
  <a href="https://discord.gg/TN6XJSNK5Y">
    <!--<img src="https://img.shields.io/discord/704680098577514527?style=flat-square&label=%F0%9F%92%AC%20discord&color=00ACD7">-->
    <img src="https://img.shields.io/discord/1052011377415438346?style=flat-square&label=discord&color=00ACD7">
  </a>
</p>
   
<h4>
    <a href="https://tinyurl.com/3vf7whyd">View Demo</a>
  <span> · </span>
    <a href="https://github.com/ScottKirvan/Smokey/blob/main/README.md">Documentation</a>
  <span> · </span>
    <a href="https://github.com/ScottKirvan/Smokey/issues/new?template=bug_report.md">Report Bug</a>
  <span> · </span>
    <a href="https://github.com/ScottKirvan/Smokey/issues/new?template=feature_request.md">Request Feature</a>
  </h4>
</div>

**Smokey** is a single-page developer dashboard for monitoring GitHub repositories. Open `index.html` in any browser, see every repo's last commit, latest release, open PRs, and open issues in one sortable table. External contributor activity is called out with attention badges so you know what needs a response without clicking around GitHub.

## Features

- **No auth required for public repos** — loads real data from the GitHub API immediately, no login, no setup
- **PAT optional** — add a GitHub personal access token in Settings to unlock private repos and CI status; also required once you exceed ~15 public repos (unauthenticated API limit is 60 requests/hour, 4 per repo)
- **Traffic chart** — full history (not just GitHub's 14-day API window), area chart with logarithmic time axis (recent days expanded) and square-root value scale. No PAT needed — reads a daily snapshot from the `traffic-log` branch, accumulated by a separate weekly GitHub Actions workflow, instead of GitHub's live traffic API.
- **Private repo indicator** — a lock icon next to the name of any private repo in the table
- **Notifications ticker** — an opt-in scrolling strip of your unread GitHub notifications, separate from the activity feed; see **GitHub PAT** below for the scope it needs
- **Attention badges** — one row for open PRs, one row for open Issues; only repos with external contributor activity appear; each badge links to the filtered GitHub page
- **Sortable table** — click any column header (Repo, Last Push, PRs, Issues) to sort; default is oldest push first
- **Version + release date** — shown under repo name so you can track what shipped and when
- **Mobile-friendly** — compact layout, no sidebars

## Installation

Smokey is a static HTML file — no build step, no dependencies, no server.

**Hosted (GitHub Pages):**  
Visit [scottkirvan.github.io/Smokey](https://scottkirvan.github.io/Smokey/) — no install needed.

**Self-hosted:**  
1. Download `index.html`
2. Open it in any browser

**Fork and host your own:**  
Fork the repo and enable GitHub Pages (Settings → Pages → Branch: `main`, folder: `/`).

## Usage

1. Open the dashboard
2. Enter a GitHub username or org in the **Settings** panel
3. Add repos in `owner/repo` format, one per line
4. Optionally add a [GitHub PAT](https://github.com/settings/tokens) — see **GitHub PAT** below
5. Click **Load** — data loads from the GitHub API and displays immediately
6. Click any column header to re-sort the table
7. Click a PR or Issue count to open the filtered GitHub page
8. Click the traffic chart area to (eventually) open a detail view

## GitHub PAT

A personal access token is optional for public repos but recommended if you have more than ~15 repos (unauthenticated requests are capped at 60/hour; each repo costs 4).

**When you need a PAT:**
- More than ~15 public repos in your list
- Any private repos
- CI status column
- Org repos protected by SAML SSO — the PAT must be authorized for that org
- Notifications ticker — needs a **classic** PAT with the `notifications` or `repo` scope; fine-grained PATs can't call GitHub's notifications API at all

Traffic data doesn't need a PAT at all — it reads a daily snapshot from the `traffic-log` branch (a separate weekly GitHub Actions workflow), not GitHub's live traffic API.

**Creating a PAT:**

*Classic PAT* (simpler): [github.com/settings/tokens](https://github.com/settings/tokens) → Generate new token (classic) → select `repo` scope.

*Fine-grained PAT* (more secure): [github.com/settings/tokens](https://github.com/settings/tokens) → Generate new token (fine-grained) → select repositories → grant **Contents: Read**, **Metadata: Read**, and **Actions: Read** (needed for CI status).

The PAT is stored only in your browser's `localStorage` and is sent only to `api.github.com`. It is never transmitted anywhere else.

## Troubleshooting

**"Add a GitHub PAT in Settings" message shows even after adding a PAT**  
Hard-refresh the page (Ctrl+Shift+R / Cmd+Shift+R). The browser may be serving a cached version of the dashboard. If the message persists after a hard refresh, re-open Settings and confirm the PAT field is still populated — `localStorage` is cleared in private/incognito windows.

**Traffic chart shows "No traffic history yet."**  
The chart reads a daily snapshot from the `traffic-log` branch, built by a separate weekly GitHub Actions workflow (`log-traffic.yml`). That branch/file may not exist yet, or your monitored repos may not have any rows logged yet — check whether `log-traffic.yml` has run at least once since the repos were added.

**Some repos show 403**  
Without a PAT the GitHub API allows 60 requests/hour. Each repo fetches 4 endpoints, so more than ~15 repos will hit the limit. Adding any PAT raises the limit to 5,000/hour. Org repos with SAML SSO also require the PAT to be explicitly authorized for that org in [GitHub token settings](https://github.com/settings/tokens).

**Release Please PRs appear as external attention badges**  
Release Please PRs are authored by `github-actions[bot]`, which the dashboard filters out automatically. If they appear, do a hard-refresh — the browser may be running an older cached version that predates the bot filter.

Contributions / Contact
-----------------------
- Please [file an issue](https://github.com/ScottKirvan/Smokey/issues/new), or [grab a fork](https://github.com/ScottKirvan/Smokey/fork), hack away, and submit a [pull request](https://github.com/ScottKirvan/Smokey/pulls).
- Contact me at [linkedin.com/in/scottkirvan/](https://www.linkedin.com/in/scottkirvan/)
- You can also contact me at my [discord](https://discord.gg/TN6XJSNK5Y) server, I'm cptvideo.

Credits
-------
**[Smokey](https://github.com/ScottKirvan/Smokey)** — Copyright (c) 2025 [Scott Kirvan](https://github.com/ScottKirvan). [MIT License](LICENSE.md).

Project Link:  [Smokey](https://github.com/ScottKirvan/Smokey)  
[CHANGELOG](notes/CHANGELOG.md)  
[TODO](notes/TODO.md)
