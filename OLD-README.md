# Plant Pal 🌱 - CS4241 A2

**Live site:** _[a2-UtkuYakar](https://a2-utkuyakar.onrender.com/)_  
**Repo:** `a2-UtkuYakar`

A tiny two-tier app to track plant watering. The server stores an in-memory table of plants, the client is a single page with a form and a results table. When you add or delete a plant, the server returns the updated dataset (including a derived field), and the UI refreshes immediately.

---

## CSS Layout / Styling

The layout uses CSS Grid for the main two-column page (form on the left, table on the right). Inside the form, I used Flexbox to line up labels and inputs nicely. I also pulled in the Inter font from Google Fonts so it’s not just the browser default.

---

## Technical Achievements 

### Single-Page App pattern  
One page has both the form and the results. Every time I add or delete, the server sends back the full dataset and the client re-renders right away.  
*Why challenging:* Had to learn how to prevent the default form reload and wire up fetch, render properly.

### Good server-side validation and derived dates  
Server checks for valid names, valid dates, and intervalDays ≥ 1. It also calculates `nextWaterDate` and an `urgency` label.  
*Why challenging:* Getting the ISO date math right (with time zones) and making sure bad input doesn’t crash the app took a few tries.

### Custom delete buttons with inline SVG  
Instead of just an emoji, each delete button renders a little black “X” icon inside a red button.  
*Why challenging:* I had to figure out how to embed SVG safely in the table rows and keep the styling consistent with CSS.

### Dynamic badge system  
Each plant row shows a status badge (OK / Due Soon / Overdue) with different colors.  
*Why challenging:* Needed to generate those badges on the fly from server-side derived values, and style them with CSS classes in a way that passed screen reader checks.

### Clean JSON API routes  
I added REST-like routes: `GET /api/plants`, `POST /api/plants`, and `DELETE /api/plants/:id`.  
*Why challenging:* Splitting out routes and handling bad JSON requests gracefully was harder than I expected without using Express.

### Front-end date formatting  
The raw ISO dates from the server get reformatted to U.S. style before showing in the table.  
*Why challenging:* Needed to handle string parsing and edge cases without breaking the logic on the server.


## Design / Evaluation Achievements

Task shown to both users (no verbal help): "Add a plant called Pothos last watered today with a 5-day interval, then delete it."

### Aygon

- **Problems:** Hesitated on date format, didn't notice the delete button at first
- **Surprises:** They liked that the table updated instantly without a page reload
- **Change I'd make:** Add a tiny "trash" label tooltip + make the delete column header sticky

### Clatiere

- **Problems:** None
- **Surprises:** Called out that "Due Soon" badges were helpful
- **Change I'd make:** Nothing