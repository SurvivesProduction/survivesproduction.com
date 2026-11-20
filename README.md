# survivesproduction.com

The Survives Production website. Static site, no build step, served by GitHub Pages.

- `index.html` is the home page. `offer/index.html` is the offer, `jobs/index.html` is the Job Board, `privacy/index.html` is the privacy notice, `towns/index.html` is the /towns page.
- `leads.html` is only a redirect to `/jobs/` (old links were texted to crews). Don't delete it.
- `data/offer.json` holds every number on the offer page. Edit it, not the HTML.
- `data/site_aggregates.json` holds every number on /towns (and the town map on /offer). It is written by `scripts/refresh_site_teaser.py` in the data repo, behind a leak guard: do not hand-edit it. `data/ct_towns.json` is the simplified town outlines and label points for the map. Don't hand-edit it: regenerate it with `scripts/build_town_map_asset.py` in the data repo (pass `--taken` with the taken towns so their two-line labels are checked to fit).
- `assets/site.css` and `assets/site.js` are the shared header, footer and theme toggle. The header and footer markup is copied into each page; change it in all five.
- `CNAME` tells GitHub Pages the custom domain. Don't delete it.

To change the site, edit the files and push to `main`. Pages redeploys in about a minute.

## How the domain is wired

Domain registered at Porkbun. DNS records on Porkbun:

| Type | Host | Answer |
|---|---|---|
| A | (blank) | 185.199.108.153 |
| A | (blank) | 185.199.109.153 |
| A | (blank) | 185.199.110.153 |
| A | (blank) | 185.199.111.153 |
| CNAME | www | survivesproduction.github.io |
| MX | (blank) | added by Porkbun Email Forwarding |
| TXT | _github-pages-challenge-survivesproduction | from GitHub's verified-domains page |

No wildcard (`*`) records. GitHub warns they open the domain to takeover.

Email: `hello@survivesproduction.com` forwards through Porkbun's free email forwarding. Replies go out from the personal address.
