# Working on ImbizoConnect

- **No emoji, ever**, in the interface, data or copy (and no glyph stand-ins such as ✓ ✗ ↗ → in the UI). Use the SVG icon set in `assets/js/art.js` (`ART.ui(name)`, `ART.icon(field)`) or the CSS mask icons (`<span class="i i-arrow">`) in `assets/css/styles.css`. Add a new SVG icon in the same style when one is missing.
- Design must look like a professional UI/UX team made it: Newsreader (display) + Public Sans (interface), the navy / ochre palette and tokens at the top of `styles.css`, 44px touch targets, visible focus, reduced-motion support.
- ImbizoConnect is a concept and is not affiliated with any institution. Keep that wording plain, and never imply applications reach a university.
- Commits are authored and committed as Mduduzi Gwija <94806079+MduduziGwija@users.noreply.github.com>, with no co-author or session trailers.
- Run `npm test`, and `npm run test:db` when `supabase/schema.sql` changes.
