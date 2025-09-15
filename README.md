# Plant Pal 🌱 - CS4241 A3

**Live site:** [https://a3-utku-yakar.vercel.app/](https://a3-utku-yakar.vercel.app/)  
**Repo:** `a3-UtkuYakar`

Plant Pal is a two-tier app for tracking plant watering with Express, MongoDB, and a Pico.css UI. Users authenticate (username/password with auto-account creation, or GitHub OAuth), then add, edit, and delete plants. Each user only sees their own data.

---

## Summary

* **Goal:** Simple, reliable tracking of watering schedules that persists per user.
* **Server:** Node.js + Express, REST JSON, sessions.
* **Database:** MongoDB via Mongoose (schemas, validation).
* **Auth:** Local login and GitHub OAuth (Passport).
* **Styling:** Pico.css with small overrides in `main.css`.
* **Deployment:** Vercel free tier with env vars in Project Settings.

---

## Why these choices

* **Auth:** Local login keeps grading straightforward and predictable. GitHub OAuth adds a familiar option and covers the technical achievement.
* **CSS:** Pico.css provides accessible defaults, good focus states, and minimal setup so custom CSS stays small.

---

## Challenges

* Designing Mongoose models and validation that handle dates and numbers safely.
* Adding an edit flow alongside add and delete without complicating the UI.
* Making Passport GitHub work cleanly with sessions and callback routing in production.
* Keeping Lighthouse scores high while using a CDN-hosted CSS framework.

---

## Baseline requirements (rubric mapping)

* **Express server (15):** `server.js` with routes, sessions, errors.
* **Results for logged-in user (10):** Full dataset for the authenticated user only (no passwords).
* **Form/Entry CRUD (15):** Add, edit, delete items per user.
* **MongoDB persistence (15):** Mongoose models for `User` and `Item`.
* **CSS framework (10):** Pico.css + minimal custom CSS.
* **HTML input variety (5):** text, password, number, date, select, checkbox, textarea, hidden id.
* **Lighthouse ≥ 90 (10):** Desktop 100 / 100 / 100 / 96 (Performance / Best Practices / SEO / Accessibility).

---

## Achievements

**Technical**

* OAuth authentication with Passport GitHub.
* Alternative hosting on Vercel (instead of Render).

**Design/Evaluation**

* Accessibility improvements: labeled controls, semantic table (caption, thead, tbody), meaningful link text, visible focus, keyboard navigation checked, badges include text not color alone.
* CRAP principles: contrast on badges/buttons, repeated typography and spacing, aligned labels/inputs and table columns, proximity for related fields and row actions.
* Lighthouse: 100 / 100 / 100 / 96.

### Contrast

I used contrast to draw attention and make the interface scannable. On the login page, the most focus goes to the "Log in" and "Login with GitHub" actions: they're full-width buttons with clear labels and strong foreground/background contrast from Pico.css. In the app, the primary focus shifts to the "Add"/"Save" action in the form and the status badges in the table. Badges don't rely solely on color, there is text like "Overdue," "Due soon," and "OK" within them, but bold weight in conjunction with color makes the urgent state clear at first glance. Headings are larger and heavier than body text, and table headers are styled differently so the structure is apparent. I also use plenty of whitespace to create tonal contrast between sections (form vs. results). This combination of color, weight, size, and spacing directs the eye without visual complexity and makes the most important, next-step activities on every page most prominent.

### Repetition

Repetition makes the experience predictable. I apply the same styles for buttons for primary and secondary actions on pages, the same styling for all form controls, and the same badge pattern for row status. Spacing and typography are mostly inherited from Pico.css, hence a consistent rhythm in headings, paragraphs, inputs, and buttons. In the table, every row has the same structure: name, details, status badge, and actions. Form fields do the same label-above-input pattern but with the same space, which reduces the learning curve as the user goes through the form. Validation and feedback messages also appear in the same place and shape all the time, so users memorize them. Even minor details such as button-less icons, border rounding, and focus outlines are uniform, which makes the UI look coherent. Visual repetition also helps with accessibility: after learning one control, they learn the rest.

### Alignment

Alignment does most of the work for legibility. The desktop layout uses two-column layout (form on the left, result on the right), and both columns are snapped to a shared grid so everything isn't "floaty." Inside the form, labels align along the same way as their inputs, and matching controls align to the same vertical axis, which speeds up scanning and reduces eye movement. Horizontal alignment is facilitated by the table: the contents of each column are positioned directly underneath the label, and action buttons line up into a neat column so users can easily concentrate on the correct row. On smaller screens, the layout collapses into a single column, but alignment is preserved, elements continue to snap to the same left edge and conform to an even vertical rhythm. This clean arrangement not only organizes information but also makes things more contrasting: misaligned or out-of-pattern items naturally have a high contrast, and I take advantage of this for inline status and feedback.

### Proximity

Proximity makes it simple for users to notice relationships. Connected form fields are aligned together with tight vertical spacing and discernible subheadings, and unconnected areas (like the results table) are separated by wider distances. Each row of plants keeps edit/delete actions right beside the item that they operate on, so the users do not need to look for controls. Status badges take up the same row as plant information, where the user needs to know state. Messages and exceptions appear close to the inputs that they relate to, not at the top of the page, so that the user can fix issues without scrolling. On mobile, additional space between groups prevents accidental touches and preserves the "chunks" of meaning. In general, the spacing scale is consistent across pages: cozy within components, medium for contextual blocks, and generous between important areas. That proximity pattern decreases cognitive load and keeps the UI relaxed.

---

## Design requirements

* Use Pico.css as the primary style layer; keep custom CSS minimal.
* Responsive layout: single column on mobile, two columns (form + table) on desktop.
* Meet WCAG AA contrast; never rely on color alone.
* Unique page titles; semantic headings.
* Label every control; inputs used: text, password, number, date, select, checkbox, textarea, hidden id.
* Inline validation and clear feedback; announce important messages (role="alert").
* Tables: caption, thead, tbody; header cells with scope; row actions are named buttons.
* Visible focus and full keyboard access.
* Concise copy, meaningful links, html lang="en".
* Consistent navigation and a skip to content link.
* Show only the current user’s items.
* Defer non-critical JS and target Lighthouse ≥ 90.

---

## Data model

**User**

* username (unique, required)
* passwordHash (nullable)
* githubId (nullable)
* createdAt (date)

**Item**

* userId (ObjectId → User, required, indexed)
* name (required, ≤100)
* species (≤100)
* lastWatered (required, date)
* intervalDays (required, number ≥1)
* sunlight (low, medium, high; default medium)
* indoors (boolean; default true)
* notes (≤500)

---

## API (selected)

* `GET /api/me` current user or null
* `POST /api/auth/login` local login (creates account if username is new)
* `POST /api/auth/logout` end session
* `GET /api/items` list items for current user
* `POST /api/items` create item
* `PUT /api/items/:id` update item
* `DELETE /api/items/:id` delete item
* `GET /auth/github` start OAuth
* `GET /auth/github/callback` OAuth callback

All item routes require auth and are scoped by userId.

---

## Middleware and libraries

* express - HTTP routing and server.
* mongoose - MongoDB ODM for schemas/validation/queries.
* express-session - Creates and manages session cookies.
* connect-mongo - Persists sessions in MongoDB.
* passport - Pluggable auth tied to sessions.
* passport-github2 - GitHub OAuth strategy for Passport.
* helmet - Security headers (CSP adjusted for CDN).
* compression - Gzip compression for faster responses.
* morgan - HTTP request logging.
* dotenv - Loads .env in development.
* auth-checker (custom) - Blocks API calls if not logged in.

---

## Front end / HTML

Inputs used: text, password, number, date, select, checkbox, textarea, hidden (edit id).
Pico.css handles layout, spacing, focus states.
Semantic table and accessible buttons for row actions.

---
## Pico.css overrides

* Small tweaks in main.css:
  * Tightened table spacing and action button sizes.
  * Status badge styles with readable text (not color-only).
  * Minor layout adjustments for the two-column desktop view.

---

## How to use

* Local login: enter any username and password. New username creates an account. Wrong password returns an error.
* GitHub OAuth: click Login with GitHub.
* Use the form to add plants; use table actions to edit or delete. Only your items are shown.

---

## Quick start (local)

1. Install dependencies: `npm install`
2. Create `.env` with: MONGODB\_URI, SESSION\_SECRET, GITHUB\_CLIENT\_ID, GITHUB\_CLIENT\_SECRET, GITHUB\_CALLBACK\_URL (`http://localhost:8080/auth/github/callback`)
3. Start: `npm start`
4. App: `http://localhost:8080`

On Vercel, set the same env vars in Project Settings. Do not set PORT.

---

## Deployment notes

Vercel env vars (no quotes): MONGODB\_URI, SESSION\_SECRET, GITHUB\_CLIENT\_ID, GITHUB\_CLIENT\_SECRET, GITHUB\_CALLBACK\_URL (`https://a3-utku-yakar.vercel.app/auth/github/callback`).
Redeploy to apply. In GitHub OAuth settings: Homepage `https://a3-utku-yakar.vercel.app/`, Callback `https://a3-utku-yakar.vercel.app/auth/github/callback`.
