# Automatic PPM price collection

The `Collect PPM fund prices` GitHub Actions workflow runs on the default branch
at 00:23, 06:23, 12:23 and 18:23 UTC daily (02:23/08:23/14:23/20:23 in Swedish
summer time; one hour earlier in winter). It also runs when its code changes,
and supports Actions → Run workflow. GitHub may delay or drop scheduled runs;
public-repository schedules can be disabled after 60 days without activity.
Check the Actions page if no new collection is saved for more than 18 hours.

Source: https://static.pensionsmyndigheten.se/fond/kurser.csv
These are official PPM sell prices in SEK, not live prices or total returns.
Each fund retains its own price date, distinct from the collection timestamp.
No credentials or personal data are included in the public archive.

The script uses Node 24 and no installed dependencies. Every successful fetch
stores original Windows-1252 CSV bytes and validated JSON under
`data/ppm/snapshots/YYYY-MM-DD/`. Files are never overwritten. `recent.json`
contains the last ten days, at most 48 collections; older full snapshots remain
in the archive. Errors fail the workflow without committing partial output or
replacing the last good bundle. Concurrent collectors are serialized. A push
conflict fails safely; no force push is used. Source requests retry up to three
times, with a 30-second timeout each. Feed format, IDs, dates, duplicates,
positive prices and bounded record count are checked. These checks cannot
guarantee that every upstream figure is correct.

Collection also rejects loss of more than 20% of previously observed fund IDs
and backwards price dates for matching IDs. A legitimate large fund-universe
change may therefore require manual review; limits are not relaxed automatically.
The daily ranking excludes name mismatches and moves above +/-25% per comparison
day, with explicit flags. These observations are still archived, not deleted.
The threshold is a review heuristic, not proof of an incorrect price. Corrected
source data is evaluated again; no unsupported ISIN/share-class mapping is inferred.

Run tests: `node --test tests/ppm-ranking.test.mjs tests/ppm-collector.test.mjs`.
Run collection: `node scripts/collect-ppm.mjs` (writes only `data/ppm`).
For local smoke tests, pass a separate output directory as the first argument.

The website reads the public recent bundle and retains a last-good copy in R2.
It checks GitHub at most hourly on page use, alongside its existing direct
source fetch. The archive grows without website visits or a running personal
computer. Background collection does not update PPM fees or FI holdings.
Two comparable weekdays for at least five funds are still required for the
daily ranking; same-day re-fetches never manufacture a daily return.
