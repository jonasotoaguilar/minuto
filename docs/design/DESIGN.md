# Mint Glaze Design System

### 1. Overview & Creative North Star
**Creative North Star: "The Digital Greenhouse"**

Mint Glaze is a design system that balances the precision of high-end software with the organic warmth of a physical editorial magazine. It rejects the "industrial grid" in favor of a **Bento-style layout** that uses varied card sizes and "Glassmorphism" to create a sense of breathability and light. The system is defined by its use of soft mint tones, deep botanical greens, and a sophisticated interplay between a classic Serif and a modern Sans-Serif.

The visual experience is designed to feel like a curated dashboard—where information is nested in translucent containers that float over a soft, ambient background.

### 2. Colors
Mint Glaze utilizes a palette rooted in "Mint Cream" and "Emerald Green" to evoke clarity and wellness.

- **Primary Role:** The vibrant Emerald (#10B77F) is used sparingly for high-impact CTAs and status indicators, ensuring it feels like a highlight rather than a dominant wash.
- **The "No-Line" Rule:** Visual separation is achieved through background shifts (e.g., Mint Cream to Pure White) or translucency levels. Never use 1px solid black or dark gray borders to section content.
- **Surface Hierarchy:** 
    - `Surface`: The base Mint Cream (#F0FDF4).
    - `Surface Container (Glass)`: A 70% white wash with a 12px backdrop blur.
    - `Surface Container Low`: A 40% white wash used for internal list items.
- **Glass & Gradient Rule:** Floating elements like the Bottom Navigation or Profile Card must utilize `backdrop-filter: blur(12px)`. Backgrounds should be enhanced with large, low-opacity "Radial Orbs" of color at the viewport corners to break the monotony.

### 3. Typography
Mint Glaze uses a dual-font strategy to create editorial contrast.

- **The Serif Influence:** Headlines (Display, H1, H2) utilize **Lora** (or Newsreader). This brings a human, high-end feel to data-heavy screens.
- **The Functional Sans:** Body text and UI labels use **Manrope**. It is chosen for its geometric clarity and high legibility at small sizes.
- **Typography Scale (Ground Truth):**
    - **Display/H1:** 30px (1.875rem) - Lora Semi-Bold
    - **H2:** 24px (1.5rem) - Lora Semi-Bold
    - **H3/Subtitles:** 18px (1.125rem) - Lora Medium
    - **Body Large:** 14px (0.875rem) - Manrope
    - **Labels/Caption:** 10px - 12px - Manrope Bold (Often Uppercase with tracking).

### 4. Elevation & Depth
Depth is created through "Tonal Layering" rather than traditional heavy shadows.

- **The Layering Principle:** Stack `surface-container` (Glass) on top of the `background` (Mint Cream). Internal elements like document rows should use an even more transparent layer (40% opacity) to feel "recessed."
- **Ambient Shadows:** 
    - **Small:** subtle `shadow-sm` for standard cards.
    - **Large:** `shadow-2xl` for floating navigation bars to suggest they are high above the content.
    - **Primary Glow:** Primary buttons use a 20% opacity primary color shadow (`shadow-primary/20`) to create a "glowing" effect rather than a dark shadow.
- **Glassmorphism:** Use a 1px `white/30` border on glass elements to simulate the "glint" of a glass edge.

### 5. Components
- **Bento Cards:** Rounded corners (1.5rem / 24px). Must include padding of at least 20px-24px.
- **Buttons:** Fully pill-shaped (rounded-full). Primary buttons use high-contrast white text on emerald green.
- **Status Chips:** Small, fully rounded chips with low-intensity background colors (e.g., Green-100 for "Signed", Amber-100 for "Pending").
- **Bottom Navigation:** A floating "Crystal" bar. The central action button should be elevated physically (negative margin) and visually (strong shadow).
- **Progress Donut:** Use high-contrast stroke widths and thin track lines for a "luxury watch" aesthetic.

### 6. Do's and Don'ts
**Do:**
- Use high-contrast font pairings (Serif for titles, Sans for data).
- Use uppercase and wide letter spacing for very small labels (10px).
- Rely on `backdrop-filter` for all floating UI elements.
- Use "Emerald" only for progress, primary actions, or success.

**Don't:**
- Use sharp 90-degree corners.
- Use solid black (#000000) for text; use Deep Slate (#111827).
- Add borders to cards unless they are the translucent "Glass Glint" style.
- Overcrowd the bento grid—maintain a 1rem (16px) gap between all sections.