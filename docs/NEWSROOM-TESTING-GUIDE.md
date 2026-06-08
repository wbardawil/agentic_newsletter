# Newsroom Module — E2E Testing & Validation Guide

**Document Purpose:** Step-by-step instructions for validating that the `/newsroom` module works correctly. Includes visual verification, functionality checks, bilingual testing, performance validation, and regression testing.

**Testing Timeline:** ~45–60 minutes  
**Prerequisite:** Dev server running (`pnpm dev`)

---

## Pre-Testing Setup

### Step 1: Verify Environment

```bash
cd portal

# Check Node version (should be 18+)
node --version

# Verify pnpm
pnpm --version

# Install dependencies (if needed)
pnpm install

# Run TypeScript check (should pass with no errors)
pnpm tsc --noEmit
```

**Expected Output:** No errors. If you see type errors, report them before proceeding.

### Step 2: Start Dev Server

```bash
pnpm dev
```

**Expected Output:**
```
▲ Next.js 15.x
...
○ Local:        http://localhost:3000
...
```

Visit http://localhost:3000 in your browser. It should load normally.

### Step 3: Verify Supabase Migrations

Before testing `/newsroom`, confirm that migrations `0004` and `0005` were applied:

**Option A — If on local Supabase:**
```bash
# Check applied migrations
supabase migration list
```

Expected: `0004_public_editions.sql` and `0005_public_editions_hero.sql` should be listed.

**Option B — If on Vercel/remote Supabase:**
- Open Vercel dashboard → Storage → Supabase
- Navigate to "Migrations" (or check SQL Editor)
- Verify `editions_public` view exists

**If migrations aren't applied:**
- Contact infrastructure team or manually apply:
  ```sql
  -- Apply 0004 first, then 0005
  psql -f portal/supabase/migrations/0004_public_editions.sql
  psql -f portal/supabase/migrations/0005_public_editions_hero.sql
  ```

---

## Testing Matrix

### Phase 1: Visual Verification (5 minutes)

#### Test 1.1: Colors & Typography
**Goal:** Verify terracotta palette and serif fonts are applied.

**Steps:**
1. Navigate to http://localhost:3000/newsroom
2. Open DevTools (F12 → Inspect)
3. Check the following elements:

| Element | Expected Style | Action |
|---|---|---|
| Page background | Cream (`#FBF7F0`) | Right-click → Inspect, check `background-color` |
| Heading (h1/h2) | Terracotta (`#B35C42`), serif | Inspect heading, verify `color` and `font-family` |
| Text | Dark brown (`#2A2420`), serif | Inspect paragraph, verify `color: #2A2420` and `font-family: Georgia` |
| Pill (topic tag) | Terracotta bg, white text | Inspect pill, verify `background-color` |
| Card border | Light beige (`#E8DFD5`) | Inspect card, verify `border-color` |

**Verification Checklist:**
- [ ] Background is cream (warm off-white), not dark
- [ ] Headings are serif (Georgia-like), terracotta color
- [ ] Body text is serif, dark brown (not pure black)
- [ ] Pills are terracotta with white text
- [ ] No orange accents on headings (orange only on CTAs)

**Pass/Fail:** ✅ Pass if all above are correct

---

#### Test 1.2: Layout & Spacing
**Goal:** Verify generous white space and responsive layout.

**Steps:**
1. Still on `/newsroom`
2. Observe the layout:
   - Hero image (or typographic hero if no image)
   - Text below hero should have breathing room (padding, line-height)
   - Cards should be spaced apart (not cramped)

**Verification Checklist:**
- [ ] Hero has visible padding/margin around it
- [ ] Text is not cramped (line-height visible)
- [ ] Cards have space between them (grid gap visible)
- [ ] No content extends to edges (padding on sides)

**Pass/Fail:** ✅ Pass if layout feels open and readable

---

#### Test 1.3: Images & Fallbacks
**Goal:** Verify images render correctly and fallback typography works.

**Steps:**
1. Inspect the hero section
2. Look for an image OR a typographic fallback

**Case A — If seed data has `hero_image_url`:**
- You'll see an image
- Verify it loads without errors (no broken image icon)
- Verify aspect ratio is 16:9

**Case B — If seed data has NO `hero_image_url` (null):**
- You'll see a white card with text instead
- Verify it shows the pull-quote or title nicely formatted
- Verify NO broken image icon appears

**Verification Checklist:**
- [ ] Either image loads cleanly OR typographic fallback shows
- [ ] No broken image icon (red X) anywhere
- [ ] Fallback hero is readable (text color, contrast OK)

**Pass/Fail:** ✅ Pass if both cases work

---

### Phase 2: Navigation & Interactivity (10 minutes)

#### Test 2.1: Channel Bar Navigation
**Goal:** Verify topic filter pills work and highlight correctly.

**Steps:**
1. Look at the sticky navigation bar at the top
2. Click on different topic pills:
   - "All" (should show all issues)
   - "Business Transformation" (should filter to BT only)
   - "Family Office" (may show 0 issues if no data)
   - "Conscious Capital" (may show 0 issues if no data)

**For each topic click:**
- URL should change to `/newsroom/topic/<topic-id>` or `/newsroom` (for All)
- Active pill should highlight in terracotta
- Inactive pills should show outline style
- Feed should update with filtered results

**Verification Checklist:**
- [ ] URL changes to `/newsroom?topic=<id>` OR `/newsroom/topic/<id>`
- [ ] Active pill is terracotta (solid background)
- [ ] Inactive pills are outlined (white bg, terracotta border)
- [ ] Feed refreshes with correct filtered data
- [ ] Browser back button works (navigation history preserved)

**Pass/Fail:** ✅ Pass if all navigation works

---

#### Test 2.2: Hero Article Link
**Goal:** Verify hero article links to detail page.

**Steps:**
1. On `/newsroom` homepage
2. Click on the hero article image or title
3. Should navigate to `/newsroom/<edition-id>`

**Expected Behavior:**
- URL changes to `/newsroom/2026-21` (or whatever the edition ID is)
- Detail page loads with the same article
- Channel bar stays sticky at top
- Back button returns to homepage

**Verification Checklist:**
- [ ] Link navigates to detail page
- [ ] URL shows `/newsroom/[edition-id]`
- [ ] Back button works

**Pass/Fail:** ✅ Pass if navigation works

---

#### Test 2.3: Article Card Grid
**Goal:** Verify cards are clickable and responsive.

**Steps:**
1. On `/newsroom` homepage, scroll to "Latest issues" section
2. Verify cards are displayed in a grid (1 column mobile, 2 tablet, 3 desktop)
3. Click on a card
4. Should navigate to `/newsroom/<edition-id>`

**On mobile (devtools width < 640px):**
- Cards should stack in 1 column

**On tablet (640px ≤ width < 1024px):**
- Cards should show 2 columns

**On desktop (width ≥ 1024px):**
- Cards should show 3 columns

**Verification Checklist:**
- [ ] Cards are responsive (resize window, check columns)
- [ ] Each card links to detail page
- [ ] Card images (if present) render without errors
- [ ] Card text is readable (not truncated unexpectedly)

**Pass/Fail:** ✅ Pass if responsive layout works

---

#### Test 2.4: Empty State Handling
**Goal:** Verify empty channel shows proper message and reset link.

**Steps:**
1. If a topic has no issues, navigate to `/newsroom/topic/<empty-topic>`
2. Should see message: "No issues in this channel yet"
3. Should see a "Browse all" or "Reset" link
4. Click the link → should return to `/newsroom` (All topics)

**Verification Checklist:**
- [ ] Empty state message appears (not blank page)
- [ ] Message is readable (good contrast, size)
- [ ] Reset link is present and clickable
- [ ] Reset link navigates to `/newsroom`

**Pass/Fail:** ✅ Pass if empty state works

---

### Phase 3: Bilingual Testing (10 minutes)

#### Test 3.1: Language Switching
**Goal:** Verify EN/ES labels switch correctly.

**Steps:**
1. Open DevTools → Application tab → Cookies
2. Find cookie `tl_lang`
3. Change value to `es` (if currently `en`) or vice versa
4. Refresh the page

**Expected Behavior:**
- All labels should switch language
- Featured → Destacado
- Latest issues → Ediciones recientes
- All → Todos
- Read more → Leer más
- Apply → Aplicar

**Verification Checklist:**
- [ ] `tl_lang` cookie changes value
- [ ] After refresh, all UI text switches language
- [ ] Edition titles/excerpts switch (if seed data is bilingual)
- [ ] No missing translations (no i18n key errors in console)

**Pass/Fail:** ✅ Pass if bilingual switching works

#### Test 3.2: Check Console for i18n Errors
**Goal:** Ensure no missing i18n keys.

**Steps:**
1. Open DevTools → Console tab
2. Refresh `/newsroom` page
3. Look for any error messages starting with "Cannot find i18n key" or similar

**Expected Output:**
- No errors in console related to missing translations

**Verification Checklist:**
- [ ] No red error messages in console
- [ ] Console is clean (maybe some warnings, but no i18n errors)

**Pass/Fail:** ✅ Pass if no console errors

---

### Phase 4: Data Integrity & RLS (5 minutes)

#### Test 4.1: Verify Anon Users See Excerpt Only
**Goal:** Ensure non-members see excerpt, not full body.

**Steps:**
1. Sign out (if signed in)
2. Navigate to `/newsroom/<edition-id>`
3. Scroll down

**Expected Behavior:**
- You should see: title + excerpt + "Members-only analysis" message + Apply CTA
- You should NOT see: full article body
- The body is hidden behind apply/paywall

**Verification Checklist:**
- [ ] Anon user sees excerpt only
- [ ] "Members-only analysis" message is visible
- [ ] Apply CTA button is present
- [ ] Full body is not visible

**Pass/Fail:** ✅ Pass if access control works

#### Test 4.2: Verify No Data Leaks
**Goal:** Ensure `editions_public` view doesn't expose sensitive columns.

**Steps:**
1. Open DevTools → Network tab
2. Refresh `/newsroom/[edition-id]`
3. Find the Supabase query request (look for `/rest/v1/editions_public`)
4. Click it → Preview tab
5. Check the JSON response

**Expected Response:**
- Should contain: `edition_id, edition_number, subject_en/es, shareable_sentence_en/es, topic, pillar, byline, byline_role, published_at, hero_image_url`
- Should NOT contain: `body_en, body_es, content, full_article, secrets`

**Verification Checklist:**
- [ ] Response only includes public columns
- [ ] No body/sensitive data in response
- [ ] Only columns listed in NEWSROOM_SELECT are present

**Pass/Fail:** ✅ Pass if no data leak

---

### Phase 5: Performance & Build (5 minutes)

#### Test 5.1: Lighthouse Performance Score
**Goal:** Verify page performance is good.

**Steps:**
1. In DevTools, go to Lighthouse tab
2. Run audit on `/newsroom` page
3. Check Performance score

**Expected Score:**
- Performance: ≥ 90
- Accessibility: ≥ 90
- Best Practices: ≥ 85
- SEO: ≥ 90

**If score is lower:**
- Check for console errors
- Check for slow network requests
- Check for large unoptimized images

**Verification Checklist:**
- [ ] Performance ≥ 90
- [ ] Accessibility ≥ 90
- [ ] No "Largest Contentful Paint" > 2.5s warning
- [ ] No "Cumulative Layout Shift" > 0.1 warning

**Pass/Fail:** ✅ Pass if scores are good (≥ 85 overall)

#### Test 5.2: Build Verification
**Goal:** Ensure production build succeeds.

**Steps:**
```bash
cd portal
pnpm build
```

**Expected Output:**
```
✓ Build successfully
```

**If build fails:**
- Check error message
- Common issues: TypeScript errors, missing i18n keys, dynamic route issues

**Verification Checklist:**
- [ ] Build succeeds (no errors)
- [ ] No TypeScript errors
- [ ] Build output mentions `/newsroom` routes

**Pass/Fail:** ✅ Pass if build completes

---

### Phase 6: Regression Testing (10 minutes)

#### Test 6.1: Portal Homepage Still Works
**Goal:** Verify `/` hasn't broken.

**Steps:**
1. Navigate to http://localhost:3000/ (portal homepage)
2. Verify it loads with dark theme
3. Verify orange CTAs appear
4. Verify hero article displays
5. Verify feed shows

**Expected Behavior:**
- Portal looks different from newsroom (dark theme, orange accents)
- All features work as before

**Verification Checklist:**
- [ ] Portal homepage loads
- [ ] Dark theme is intact (not cream background)
- [ ] Orange CTAs visible
- [ ] No styling conflicts with newsroom CSS
- [ ] Navigation works (can go to /archive, /me, etc.)

**Pass/Fail:** ✅ Pass if portal works

#### Test 6.2: Member Routes Unchanged
**Goal:** Verify `/archive`, `/me`, etc. still work.

**Steps:**
1. If you have test member account, sign in
2. Navigate to `/archive`
3. Verify archive loads (member-gated, full articles visible)
4. Navigate to `/me`
5. Verify profile page loads

**Expected Behavior:**
- Member features work as before
- No styling applied from newsroom CSS

**Verification Checklist:**
- [ ] `/archive` loads and shows full articles (member-gated)
- [ ] `/me` loads
- [ ] `/convenings` loads (if applicable)
- [ ] No newsroom styling leaks to member pages

**Pass/Fail:** ✅ Pass if member routes work

#### Test 6.3: Navbar Switcher
**Goal:** If navbar has newsroom switcher, test it.

**Steps:**
1. Check SiteHeader component for newsroom/portal switcher
2. If exists: click to switch between `/` and `/newsroom`

**Expected Behavior:**
- Switching works
- Each context applies correct styling
- Navigation is smooth

**Verification Checklist:**
- [ ] Newsroom switcher exists (if implemented)
- [ ] Switching between `/` and `/newsroom` works
- [ ] Correct styling applied to each

**Pass/Fail:** ✅ Pass if switcher works (N/A if not implemented)

---

## Detailed Verification Checklist

Use this checklist to track your testing progress:

### Visual & Design
- [ ] **1.1.1** Background is cream (#FBF7F0)
- [ ] **1.1.2** Headings are serif, terracotta
- [ ] **1.1.3** Body text is serif, dark brown
- [ ] **1.1.4** Pills are terracotta with white text
- [ ] **1.1.5** Cards have proper spacing
- [ ] **1.2.1** Layout has generous white space
- [ ] **1.2.2** No content extends to edges
- [ ] **1.3.1** Hero images load (or fallback shows)
- [ ] **1.3.2** No broken image icons

### Navigation & Interaction
- [ ] **2.1.1** Channel bar sticks to top
- [ ] **2.1.2** Topic pills highlight correctly (active = terracotta)
- [ ] **2.1.3** URL changes on filter
- [ ] **2.1.4** Feed updates on filter
- [ ] **2.2.1** Hero article links work
- [ ] **2.2.2** Detail page loads
- [ ] **2.3.1** Cards respond to resize (1/2/3 column)
- [ ] **2.3.2** Card clicks navigate
- [ ] **2.4.1** Empty state shows message
- [ ] **2.4.2** Empty state reset link works

### Bilingual
- [ ] **3.1.1** Language cookie changes
- [ ] **3.1.2** EN/ES labels switch
- [ ] **3.2.1** No console i18n errors

### Data & Security
- [ ] **4.1.1** Anon sees excerpt only
- [ ] **4.1.2** Apply CTA present
- [ ] **4.2.1** Supabase query only returns public columns
- [ ] **4.2.2** No sensitive data leak

### Performance
- [ ] **5.1.1** Lighthouse Performance ≥ 90
- [ ] **5.1.2** No LCP warnings
- [ ] **5.1.3** No CLS warnings
- [ ] **5.2.1** Build succeeds
- [ ] **5.2.2** No TypeScript errors

### Regression
- [ ] **6.1.1** Portal `/` loads with dark theme
- [ ] **6.1.2** Portal orange CTAs visible
- [ ] **6.2.1** `/archive` works (member-gated)
- [ ] **6.2.2** `/me` works
- [ ] **6.3.1** Navbar switcher works (if implemented)

---

## Troubleshooting Guide

### Problem: Cream background doesn't appear (still dark)

**Cause:** CSS not imported or Tailwind cache issue

**Solution:**
1. Hard refresh: Ctrl+Shift+R (or Cmd+Shift+R on Mac)
2. Check DevTools → Elements → find `.newsroom-layout` div
3. Verify `background: var(--color-newsroom-cream)` is applied
4. If not: check that `@/styles/newsroom.css` is imported in layout.tsx

---

### Problem: Serif fonts don't appear (still sans-serif)

**Cause:** Georgia font not loading from system, or CSS cascade issue

**Solution:**
1. Check DevTools → Elements → inspect `<body>` inside `.newsroom-layout`
2. Verify `font-family: Georgia, "Times New Roman", serif` in computed styles
3. If not: check DevTools → Styles tab for rule conflicts
4. Windows/Mac: Georgia should be available system-wide. If missing, browser falls back to Times New Roman (still serif, acceptable)

---

### Problem: Pills show orange instead of terracotta

**Cause:** Wrong color value or CSS not applied

**Solution:**
1. Inspect a pill element
2. Check `background-color` in computed styles
3. Should be `rgb(179, 92, 66)` (which is #B35C42)
4. If showing orange (`rgb(253, 112, 20)`): CSS layer issue
5. Check `@layer utilities` in newsroom.css is correct

---

### Problem: Responsive grid shows 3 columns on mobile (should be 1)

**Cause:** Tailwind breakpoint order wrong, or container-wide overriding grid

**Solution:**
1. Inspect grid container in DevTools
2. Check classes: should be `grid gap-6 sm:grid-cols-2 lg:grid-cols-3`
3. On mobile (< 640px): should show 1 column (default)
4. On tablet (≥ 640px): 2 columns
5. On desktop (≥ 1024px): 3 columns
6. If wrong: check media queries in browser DevTools

---

### Problem: Empty state shows blank page instead of message

**Cause:** Component not rendering, or items array not empty

**Solution:**
1. Check console for JavaScript errors
2. Check Supabase query in Network tab (should return 0 items for empty topic)
3. Check `channelFiltered` prop is true
4. Manually test: navigate to a topic with no data (e.g., /newsroom/topic/family_office)

---

### Problem: Build fails with TypeScript errors

**Cause:** Missing i18n keys, wrong component imports, or type mismatches

**Solution:**
1. Read error message carefully (shows file + line number)
2. Common issues:
   - Missing newsroom key in dictionary: add to both `type Dict` and `en`/`es` objects
   - Wrong component import: check spelling (`NewsroomArticleCard` vs `ArticleCard`)
   - Route type error: cast with `as Route`
3. Run `pnpm tsc --noEmit` to see all errors before building

---

### Problem: Lighthouse Performance < 85

**Cause:** Slow image loading, JavaScript bloat, or unoptimized layout

**Solution:**
1. Check hero image: verify `priority` flag and `sizes` are set
2. Check for console errors (wasted time on error handling)
3. Check Network tab: any slow API calls?
4. Run audit again (sometimes variance in scores, try 2-3 times)

---

## Passing Criteria

You've successfully validated the `/newsroom` module when:

✅ **All** of the following are true:

1. ✅ **Visual Design:** Terracotta palette, serif fonts, cream background, generous spacing
2. ✅ **Navigation:** Channel filters work, URLs update, feed refreshes
3. ✅ **Interactivity:** Links navigate, cards clickable, empty states handled
4. ✅ **Bilingual:** EN/ES switching works, no console errors
5. ✅ **Data Security:** Anon users see excerpt only, no sensitive data leak
6. ✅ **Performance:** Lighthouse ≥ 85 overall, build succeeds
7. ✅ **Regression:** Portal `/` and member routes unchanged

**If any item fails:** Document the issue, follow troubleshooting steps, and re-test.

---

## Sign-Off

**Tester Name:** ___________________  
**Date:** ___________________  
**Overall Result:** ☐ PASS ☐ FAIL

**Issues Found (if any):**
```
1. [Issue 1]
2. [Issue 2]
...
```

**Notes:**
```
[Any observations, improvements, or comments]
```

---

**End of Testing Guide**

*Next: If all tests pass, proceed to deployment.*  
*If issues found: Document in GitHub issues, fix, and re-test.*
