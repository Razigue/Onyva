# Onyva Design System

- **Status:** initial art direction, to be validated
- **Product:** iOS / Android mobile app
- **Market:** Île-de-France
- **Interface language:** French only
- **Guiding principle:** many journeys, one fair meeting point.

---

## 1. Brand intent

Onyva helps a group of 2 to 10 friends plan an outing without always making the same person take the longest journey. The app suggests venues based on real transit times, accounts for disruptions and checks that everyone can get home.

The brand should evoke **meeting up, fairness and collective movement**, not a generic mapping app or a transit dashboard.

### Positioning

- **Promise:** find a venue that is fair for everyone, and check the way home.
- **Personality:** direct, urban, smart, warm, never childish.
- **Tone:** everyday French, informal "tu", short sentences, no transport jargon.
- **Emotional benefit:** "Personne ne se sacrifie pour le trajet. On se retrouve." (Nobody sacrifices themselves for the journey. We meet up.)

### Tagline options

- "Des amis. Des trajets. Un même point."
- "On se retrouve à mi-chemin."
- "Une sortie juste pour tout le monde."

The tagline does not need to appear on every screen. The name **onyva** must remain the main brand mark.

## 2. Art direction

### Visual idea: convergence

Onyva's signature motif is several journey lines converging on a common point. It represents people leaving from different places and meeting in the same spot.

The motif can live across the brand system: icon, illustrations, marketing material and small interface details. It must not become decoration repeated everywhere, nor replace a real map when the user needs geographic data.

### What the brand must avoid

- Generic visual codes of mobility apps.
- Dark mode as the default appearance.
- Glowing gradients, neon effects and decorative shadows.
- Cards overloaded with mini indicators.
- Pin, train or character illustrations used without a distinctive idea.
- Interfaces that look like a dashboard rather than a social app.

### Principles

1. **Editorial, not cold.** Clean typography and confident composition, with a few expressive accents.
2. **Light, not empty.** Space to rank decisions, without screens looking unfinished.
3. **Data makes fairness visible.** Every recommendation explains why it is relevant.
4. **One primary action at a time.** The flow must stay obvious on a small screen and one-handed.
5. **The brand speaks with restraint.** Functional screens stay plain; big graphic gestures are kept for moments where they help.

## 3. Colors

Starting palette from the creative direction. Values are design tokens to be tested for contrast and in real use before shipping.

| Token | Value | Usage |
| --- | --- | --- |
| `color.brand.blue` | `#2E5BFF` | Primary action, links, brand element |
| `color.brand.lime` | `#D8FF3B` | Rare accent, selection or occasional highlight |
| `color.ink` | `#111827` | Main text, strong icons |
| `color.paper` | `#F7F6F1` | Brand background and light screen background |
| `color.surface` | `#FFFFFF` | Cards and raised surfaces |
| `color.text.secondary` | `#5F6673` | Secondary text |
| `color.border` | `#E3E5E8` | Dividers and subtle outlines |
| `color.success` | `#16794B` | Positive confirmation |
| `color.warning` | `#9A5B00` | Warning that needs attention |
| `color.danger` | `#B42318` | Error or critical information |

### Usage rules

- The light background is the default mode. White lifts cards off the off-white background.
- Blue is the main functional color: primary button, links and selected state.
- Lime is a graphic accent, not a text color on light backgrounds. Avoid large lime areas behind thin text.
- Ink is for reading and structure; do not turn the whole interface into dark blocks.
- Semantic colors must never be the only way to convey a state: add a label or an icon.
- Check WCAG 2.2 AA contrast, especially for small text and buttons.

## 4. Typography

### Direction

Use a contemporary, highly legible sans-serif for the interface, paired sparingly with an editorial serif for brand headlines.

- **Interface:** `Suisse Intl` if the license is available; otherwise `Inter` as a fallback.
- **Editorial headlines:** `Canela` if the license is available; otherwise a moderate-contrast serif such as `Georgia`.
- Do not bundle a commercial font without checking usage rights.

### Type scale

| Token | Size / line height | Usage |
| --- | --- | --- |
| `type.display` | 36 / 40 px | Brand headline, rarely in the app |
| `type.title.large` | 28 / 34 px | Important screen title |
| `type.title` | 22 / 28 px | Section title |
| `type.subtitle` | 18 / 24 px | Card title or subsection |
| `type.body` | 16 / 24 px | Main text |
| `type.body.small` | 14 / 20 px | Metadata and secondary explanations |
| `type.caption` | 12 / 16 px | Non-critical captions only |
| `type.button` | 16 / 20 px | Action labels, medium or semibold weight |

Sizes are in design pixels and must be mapped to native iOS/Android units. Respect system text size preferences.

### Rules

- Prefer short, concrete titles: "Où on se retrouve ?", "Tout le monde peut rentrer".
- Avoid long paragraphs, all caps in the interface and overly pale gray text.
- Journey times must be easy to compare visually and use tabular figures when available.

## 5. Logo and brand elements

The final logo is not validated yet. This document defines principles, not a final drawing.

### Wordmark

- Name written in lowercase: **onyva**.
- Simple, compact shape, recognizable at small sizes.
- A proprietary typographic detail is better than a generic transport symbol.
- Provide a monochrome version, a color version and a version for dark backgrounds.
- Do not distort the logo, change letter spacing or add effects.

### Symbol

Explore a standalone mark based on several lines converging on a common point. It must stay identifiable at 24 px and work in monochrome. Avoid details that look like an official metro network.

### Clear space and minimum size

To be defined once the final drawing is validated. As a temporary rule, keep clear space around the logo at least equal to the height of the "o" in the wordmark. Check legibility at small sizes before fixing minimum sizes.

## 6. Iconography, illustration and photography

### Icons

- Simple, consistent icons with a uniform stroke width.
- Icons support labels; they do not replace an ambiguous action.
- Use native iOS/Android conventions where they are familiar.
- No emoji as navigation or action icons.

### Convergence motif

- Clean lines, simple curves, a legible meeting point.
- Blue, lime and ink can tell journeys apart; do not identify people by color alone.
- The motif stays secondary on operational screens.

### Photography

For suggested venues, prefer real, warm, contextual photos: cafés, bars, terraces, restaurants. Images should help choose a place without implying a venue is available or confirmed when it is not. Provide a clean placeholder state when an image is missing.

## 7. Layout and components

### Grid and spacing

4 px spacing base:

| Token | Value |
| --- | --- |
| `space.1` | 4 px |
| `space.2` | 8 px |
| `space.3` | 12 px |
| `space.4` | 16 px |
| `space.5` | 20 px |
| `space.6` | 24 px |
| `space.8` | 32 px |
| `space.10` | 40 px |
| `space.12` | 48 px |

- Mobile horizontal margins: 20 px as a starting point.
- Spacing between sections: 24 to 32 px.
- Use native safe areas and insets.
- Prioritize one-handed use and touch targets of at least 44 × 44 pt on iOS and 48 × 48 dp on Android.

### Radii, borders and elevation

| Token | Indicative value | Usage |
| --- | --- | --- |
| `radius.small` | 8 px | Small elements, tags |
| `radius.medium` | 14 px | Fields, secondary buttons |
| `radius.large` | 20 px | Main cards |
| `radius.pill` | 999 px | Chips and rounded tags |

Prefer dividers and surface hierarchy over heavy shadows. Components should feel tactile without looking like toys.

### Buttons

- **Primary:** blue background, white text, explicit label with an action verb.
- **Secondary:** transparent or white surface background, subtle outline.
- **Destructive:** semantic style reserved for irreversible actions.
- Required states: rest, pressed, disabled, loading, error where relevant.
- Only one dominant primary action per screen.

### Fields and selection

- Persistent labels: do not use the placeholder as the field's only name.
- Station search results: station name highly visible, served lines secondary.
- Distinguish "Ma position" from the estimated nearby station.
- Explain location permissions before requesting them.

### Venue cards

Each card must support a real comparison, not a decorative one. Show, depending on available data:

1. Venue name and type.
2. Each participant's journey time, or an accessible comparative visualization.
3. Maximum time and spread between participants.
4. Whether everyone can get home, with the latest time or the identified constraint.
5. Relevant disruption, with source or data freshness when possible.
6. Group preference state, if the feature exists.

Never show "tout le monde peut rentrer" if return data is unavailable or not reliable enough. Design "checking" and "unable to confirm" states.

### Loading, empty and error states

Every data component must handle:

- loading, with a subtle indicator;
- no results, with a recovery action;
- unavailable or stale data;
- network error with a retry option;
- cached content when useful, with the last update time visible.

## 8. Product UX and key flows

The brand must never slow down the product. Interaction goals remain:

- **Create an outing:** 3 taps when the defaults fit.
- **Join an outing:** 2 taps once signed in.
- **Sign-in:** Apple or Google, with no password or extra form whenever possible.
- **Smart defaults:** "Ce soir", a round time slot at least one hour away, "Un verre" and the last departure used.
- **Departure:** station input; "Ma position" is converted to a nearby station. Never expose a participant's exact address to others.
- **Results:** start suggesting venues from two participants, then refresh recommendations as the group fills up.
- **Return:** account for the last metro, RER and night alternatives based on available data.
- **Disruptions:** show them only when they actually change the recommendation or the journey.
- **Notifications:** useful and rare: venue change, relevant disruption, time to leave. No marketing notifications.
- **Weak connection:** cache essential outing information and clearly show when data is old.

### Recommendation screen hierarchy

1. Question or decision to make.
2. Main recommendation and why it ranks first.
3. Fair comparison of journeys.
4. Return feasibility.
5. Relevant disruptions.
6. Explicit next action.

The map is complementary: it must not replace the comparative proof of journey times.

## 9. Tone and microcopy

UI copy is in French. Examples below are kept in French as they would appear in the app.

### Preferred

- "Où on se retrouve ?"
- "Le plus équilibré"
- "18 min pour le trajet le plus long"
- "Tout le monde peut rentrer jusqu'à 00 h 42"
- "Travaux sur la ligne 4 : ce lieu devient moins pratique"
- "On attend les autres départs"
- "Les trajets se mettent à jour à chaque arrivée"

### Avoid

- "Optimisation multimodale"
- "Calcul d'isochrones"
- "Point géospatial optimal"
- "Mobilité intelligente"
- "Succès !" followed by a celebration emoji
- Any wording that promises certainty when transit data is uncertain.

### Writing rules

- Use "tu" everywhere, consistently.
- Put the important information before the explanation.
- Use explicit times and comparable durations.
- Say what is known, what has changed and what the person can do.
- Do not make participants with longer journeys feel guilty.

## 10. Accessibility and trust

- Target WCAG 2.2 AA for contrast and related web flows.
- Never rely on color alone to convey fairness, disruption or return status.
- Support system text sizes, screen readers, accessible labels and focus order.
- Journey time charts must have a text alternative: duration per person, maximum and spread.
- Request location when it becomes useful, with a clear explanation.
- Remind users that background location is optional, explain when it is used and provide an obvious control.
- Never show an exact address to other participants.
- Distinguish real-time data, cached data and estimates.
- Do not promise a guaranteed way home: show the computed latest time, the assumptions and any uncertainty.

## 11. Motion and feedback

- Short, functional transitions, usually between 150 and 250 ms.
- A convergence animation is possible when a participant joins or venues are computed, only if it does not delay the information.
- No permanent decorative motion.
- Respect the system reduced motion preference.
- Confirm important actions with a visible state, not just an animation.

## 12. Responsive and platforms

- Mobile first, iOS and Android.
- Use native conventions for system bars, keyboards, share sheets, permissions and Apple/Google sign-in.
- Keep a shared identity without forcing both platforms to use exactly the same native components.
- Support small screens, enlarged text, high contrast and offline states.
- Invite web views must be understandable before the app is installed and let people join the group in as few steps as possible.

## 13. Starter tokens

Sample CSS tokens to align web prototypes and interface decisions. Values remain to be validated in real components.

```css
:root {
  --color-brand-blue: #2E5BFF;
  --color-brand-lime: #D8FF3B;
  --color-ink: #111827;
  --color-paper: #F7F6F1;
  --color-surface: #FFFFFF;
  --color-text-secondary: #5F6673;
  --color-border: #E3E5E8;
  --color-success: #16794B;
  --color-warning: #9A5B00;
  --color-danger: #B42318;

  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;

  --radius-small: 8px;
  --radius-medium: 14px;
  --radius-large: 20px;
  --radius-pill: 999px;

  --font-ui: "Suisse Intl", Inter, system-ui, sans-serif;
  --font-editorial: Canela, Georgia, serif;
}
```

## 14. Design acceptance criteria

Before considering a screen ready:

- [ ] The primary action is obvious without reading long text.
- [ ] The content works on a small screen and one-handed.
- [ ] Journey times are comparable and understandable.
- [ ] The maximum and the spread are explained without jargon.
- [ ] The return is confirmed, uncertain or unable to be confirmed, never implied.
- [ ] Disruptions are dated or shown with their freshness when available.
- [ ] Loading, error, empty and offline states are designed.
- [ ] Contrast, text sizes and screen readers are taken into account.
- [ ] Location is explained and controllable.
- [ ] Colors and the brand motif support the information instead of competing with it.
- [ ] The flow meets the targets of 3 taps to create and 2 taps to join an outing once signed in.

## 15. To validate before freezing the system

1. Final logo and convergence symbol drawing.
2. Real contrast and uses of lime.
3. Fonts and licenses available in the product.
4. Accuracy, latency and wording of transit and return data.
5. Background location policy and explicit user choices.
6. Native or custom components for maps, action sheets and navigation.
7. User testing with groups of 2 to 10 people, especially while traveling and on weak connections.

---

**Final rule:** Onyva must make planning an outing fairer and simpler. If a visual effect or component clarifies neither the venue choice, nor the journey, nor the way home, it does not belong in the interface.
