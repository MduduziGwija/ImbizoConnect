# ImbizoConnect

A concept platform that helps South African students plan university applications. It covers all 26 public universities for the 2027 intake.

- **Universities**: application fee, closing date (with a live countdown), faculties, admission-score method and the official prospectus for each institution. Filter by province, field, fee, type or open/closed status.
- **APS & careers**: the standard 7-point APS calculator with NSC pass-type detection, matched to careers and to the number of universities within reach.
- **My application**: a five-step planner (details with SA ID validation, choices, documents, eligibility estimate, review). It works out the total fee, charging the CAO fee once for UKZN, DUT, MUT and UNIZULU, and produces a printable application pack that links to each official portal.
- **Funding**: NSFAS, Funza Lushaka, ISFAP and bursaries, plus an FAQ.

Everything runs in the browser. Progress is stored in `localStorage` and no data is uploaded.

## Data

`assets/js/data.js` holds the fees, closing dates and prospectus links. They were checked in September 2026. Entries where sources disagree are flagged `verify: true` and show a "Confirm fee" badge.

## Prospectus attachments

`tools/fetch-prospectuses.mjs` downloads every official prospectus PDF into `prospectuses/` and writes `prospectuses/manifest.js`. The site then serves those copies as downloads. The **Mirror prospectuses** GitHub Action runs this script monthly, or when you start it from the Actions tab. Files over 40 MB (such as the UFS prospectus) stay as links to the official PDF. You can also run it locally:

```sh
node tools/fetch-prospectuses.mjs
```

## Run locally

```sh
python3 -m http.server 8000   # then open http://localhost:8000
```
