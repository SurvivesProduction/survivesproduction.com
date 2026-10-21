# survivesproduction.com

The Survives Production website. One static page, no build step, served by GitHub Pages.

- `index.html` is the whole site.
- `CNAME` tells GitHub Pages the custom domain. Don't delete it.

To change the site, edit `index.html` and push to `main`. Pages redeploys in about a minute.

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
