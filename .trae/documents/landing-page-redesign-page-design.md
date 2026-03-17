# Landing Page Redesign — Page Design Specification (Desktop-first)

**Status:** READY for implementation
**Scope:** Visual + layout refresh only; preserve existing module selection behavior and footer.

## Global Styles

* Design tokens (academic palette + white-forward, premium)

  * Background: #FFFFFF (primary), #F6F8FB (alt section), #0B1F3A (navy surface, sparingly)

  * Text: #0F172A (primary), #334155 (secondary), #64748B (muted)

  * Primary (Navy): #0B1F3A

  * Secondary (Burgundy): #7A1E3A

  * Accent (Antique Gold): #C8A24A

  * Border / divider: #E2E8F0

  * Shadow: subtle, layered (e.g., 0 1px 2px rgba(15,23,42,.06), 0 8px 24px rgba(15,23,42,.10))

  * Radius: 12px cards, 10px buttons, 16px modal/dialog (if any)

  * Focus ring: 2px solid #C8A24A with 2px offset (on white); switch to #FFFFFF ring on navy surfaces

* Typography (premium academic tone)

  * Headings: serif recommended (e.g., "Source Serif 4" / "Merriweather"), font-weight 600–700

  * Body/UI: modern sans recommended (e.g., "Inter" / "Source Sans 3"), font-weight 400–600

  * Scale (desktop-first)

    * H1: 40–52px desktop, 30–34px mobile; line-height 1.1–1.2

    * H2: 28–32px desktop, 22–26px mobile

    * Body: 16–18px; line-height 1.6–1.8

    * Small: 12–14px for footer/meta

* Buttons / links

  * Primary button: Navy fill + white text; optional thin gold bottom border for “premium” feel

  * Secondary button: white fill + navy border + navy text

  * Hover (desktop): slightly stronger shadow + minor darken (no large motion)

  * Active: reduced shadow

  * Links: navy text; underline on hover; visited slightly muted

* Spacing & layout rhythm

  * 8pt spacing system; generous vertical padding (48–96px) between sections on desktop

* Accessibility & interaction

  * Minimum tap targets: 44x44px

  * Keyboard navigation: strong focus states on module cards/buttons and footer links

  * Reduced motion: respect prefers-reduced-motion for transitions (keep transitions 150–200ms)

## Landing Page

### Meta Information

* Title: “SIS — \[Product Name]” (replace any “ERP” occurrence with “SIS”)

* Description: Short summary of SIS value proposition (same meaning as current landing copy, wording updated)

* Open Graph

  * og:title: “SIS — \[Product Name]”

  * og:description: Same as description

  * og:type: website

### Layout

* Primary layout system: Hybrid (CSS Grid for overall sections + Flexbox for alignment within components)

* Page container

  * Desktop: centered container with max-width \~1200px; side padding 24–32px

  * Tablet: side padding 20–24px

  * Mobile: side padding 16px

* Responsive behavior (desktop-first)

  * Breakpoints (guideline):

    * Desktop: ≥1024px

    * Tablet: 768–1023px

    * Mobile: ≤767px

  * Ensure no horizontal scrolling; long titles wrap naturally; module cards stack on small screens.

### Page Structure (stacked sections)

1. Header / Top area
2. Hero section (SIS wording)
3. Module Selection section (primary interaction)
4. Footer (copyright)

### Sections & Components

#### 1) Header / Top area

* Purpose: Provide stable top spacing and (if currently present) keep existing branding/navigation without expanding scope.

* Structure

  * Left: Logo / product name

  * Right: Optional existing nav items (only if already present); collapse to icon/menu on mobile if needed

* Behavior

  * Sticky behavior: only if the current landing page already uses it; otherwise keep static.

#### 2) Hero section (SIS copy)

* Purpose: Communicate top-level message using “SIS” wording.

* Elements

  * H1 headline: Replace “ERP” with “SIS”

  * Supporting paragraph: Replace any “ERP” occurrences; maintain original meaning

  * Optional CTA: If current page has a CTA, keep it and ensure it remains visible above the fold on mobile

* Layout

  * Desktop: two-column (text + optional illustration) or single-column if no media exists

  * Mobile: single-column stack; media below text; center or left-align based on current brand style

#### 3) Module Selection (must keep)

* Purpose: Let you choose a module and continue to the existing destination.

* Elements

  * Section title (H2): e.g., “Select a Module” (use existing wording if present)

  * Module list UI: cards or buttons (match existing component style)

    * Each module item includes: module name, optional short descriptor, and clear affordance (button/clickable card)

* Layout

  * Desktop: grid of 2–4 columns depending on number of modules

  * Tablet: 2 columns

  * Mobile: 1 column stacked cards

* Interaction states

  * Default: card with border and subtle shadow

  * Hover (desktop): elevate + border/accent highlight

  * Focus (keyboard): strong focus ring

  * Pressed/active: slight scale down or reduced elevation

* Error/empty states (only if applicable to current behavior)

  * If modules are always present, no extra states required.

#### 4) Footer (must keep)

* Purpose: Keep copyright visible and consistent.

* Elements

  * Copyright line

  * Optional existing footer links (only if already present)

* Layout

  * Full-width footer section with top border

  * Desktop: content aligned left/right as currently designed

  * Mobile: stack items vertically; increase line height; ensure comfortable tap spacing

### Content rule: “ERP” → “SIS”

* Replace “ERP” with “SIS” in all user-facing landing page strings (including headings, CTAs, helper text, and footer text if present).

* Keep capitalization consistent (e.g., “SIS” uppercase) unless current style dictates otherwise.

---

## Implementation Readiness Checklist (READY)

### Layout + responsiveness
- Container: `max-width: 1200px`; side padding 32px (desktop), 24px (tablet), 16px (mobile).
- Section vertical spacing: 48–96px desktop; 32–64px tablet; 24–48px mobile.
- Module grid: 4 cols (large desktop, if enough modules), 3 cols (desktop), 2 cols (tablet), 1 col (mobile).
- Confirm no horizontal scrolling at 320px width.

### Interaction + accessibility
- All module items are reachable via keyboard (Tab), with the specified focus ring.
- Hover/active states follow the “subtle elevation” guidance; transitions respect `prefers-reduced-motion`.
- Tap/click targets ≥44×44px.

### Visual QA
- Contrast remains readable for primary/secondary text against white and `#F6F8FB`.
- Shadows and borders stay subtle (premium, not “floating cards everywhere”).
