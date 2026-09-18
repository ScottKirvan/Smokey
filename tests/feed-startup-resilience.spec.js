// @ts-check
const { test, expect } = require('@playwright/test');

// Reported symptom: PAT set, "Show activity feed" toggle on, notifications
// ticker working fine, activity feed just never appears. Root cause: unlike
// the notifications ticker (which only needs S.pat), the activity feed also
// needs S.currentUser — it's embedded in the /users/{username}/events URL.
// currentUser is resolved exactly once, in load(), via a single /user fetch
// wrapped in a try/catch that silently swallows any failure. If that one
// call fails for any reason, S.currentUser stays '' for the rest of the
// session: startFeedPoll() and pollEvents() both bail out on !S.currentUser
// with no retry anywhere except a full page reload or re-saving Settings —
// so a single transient hiccup permanently and silently disables the feed
// while every other PAT-gated feature (including notifications, which has
// no currentUser dependency) keeps working normally.
//
// Fix: pollEvents() now resolves currentUser lazily via resolveCurrentUser()
// if it's still unset, so the existing 60s poll interval retries it on its
// own — the same transient failure self-heals within a minute instead of
// requiring the user to reload the page.

test.describe('feed startup does not depend on currentUser already being resolved', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/index.html');
  });

  test('startFeedPoll starts polling even before currentUser has resolved', async ({ page }) => {
    const fetchCalled = await page.evaluate(async () => {
      S.pat = 'fake-pat';
      S.showFeed = true;
      S.currentUser = ''; // /user never resolved (e.g. that fetch failed during load())
      S.feedPollTimer = null;
      S.feedItems = [];
      S.feedEtag = '';
      S.data = [];

      let called = false;
      window.fetch = async () => { called = true; return { ok: false, status: 404 }; };
      startFeedPoll();
      await new Promise(r => setTimeout(r, 0)); // let the fire-and-forget pollEvents() tick run
      return called;
    });

    expect(fetchCalled).toBe(true);
  });

  test('pollEvents resolves currentUser lazily, then fetches events for it', async ({ page }) => {
    const result = await page.evaluate(async () => {
      S.pat = 'fake-pat';
      S.currentUser = '';
      S.feedItems = [];
      S.feedEtag = '';
      S.data = [{ full_name: 'owner/repo' }];

      window.fetch = async (url) => {
        const u = String(url);
        if (u === 'https://api.github.com/user') {
          return { ok: true, headers: { get: () => null }, json: async () => ({ login: 'owner' }) };
        }
        if (u === 'https://api.github.com/users/owner/events') {
          return {
            ok: true, status: 200, headers: { get: () => null },
            json: async () => ([{
              id: '1', type: 'WatchEvent', repo: { name: 'owner/repo' },
              payload: {}, created_at: '2026-01-01T00:00:00Z',
            }]),
          };
        }
        return { ok: false, status: 404 };
      };

      await pollEvents();
      return { currentUser: S.currentUser, feedItemCount: S.feedItems.length };
    });

    expect(result.currentUser).toBe('owner');
    expect(result.feedItemCount).toBe(1);
  });

  test('a transient /user failure does not permanently break the feed — the next poll retries', async ({ page }) => {
    const result = await page.evaluate(async () => {
      S.pat = 'fake-pat';
      S.currentUser = '';
      S.feedItems = [];
      S.feedEtag = '';
      S.data = [{ full_name: 'owner/repo' }];

      let userAttempt = 0;
      window.fetch = async (url) => {
        const u = String(url);
        if (u === 'https://api.github.com/user') {
          userAttempt++;
          if (userAttempt === 1) return { ok: false, status: 500 }; // first attempt fails
          return { ok: true, headers: { get: () => null }, json: async () => ({ login: 'owner' }) };
        }
        if (u === 'https://api.github.com/users/owner/events') {
          return {
            ok: true, status: 200, headers: { get: () => null },
            json: async () => ([{
              id: '1', type: 'WatchEvent', repo: { name: 'owner/repo' },
              payload: {}, created_at: '2026-01-01T00:00:00Z',
            }]),
          };
        }
        return { ok: false, status: 404 };
      };

      await pollEvents(); // simulates the poll at t=0: /user fails
      const afterFirst = S.currentUser;
      await pollEvents(); // simulates the poll at t=60s: retries /user, succeeds
      return { afterFirst, afterSecond: S.currentUser, feedItemCount: S.feedItems.length };
    });

    expect(result.afterFirst).toBe('');
    expect(result.afterSecond).toBe('owner');
    expect(result.feedItemCount).toBe(1);
  });
});
