# AIRA — Future Vision & Product Roadmap

> **Purpose:** This document is the long-term product context for AIRA. It is NOT the current implementation plan — current work is tracked in `.hermes/plans/` and `PROGRESS.md`. Use this file as the north-star reference when designing features so today's decisions don't paint tomorrow into a corner.
>
> **North star:** *AIRA — an AI that investigates reality before you make a decision.*

---

## 1. The Core Reframe: Calling Is a Tool, Not the Product

The current mental model:

```
Requirement → contacts → calls → transcript → ranking
```

The future mental model:

```
Goal → investigate → verify → negotiate → compare → recommend → act
```

The phone call becomes just one tool AIRA uses. Sometimes it calls. Sometimes it WhatsApps. Sometimes it searches the web. Sometimes it checks a document. Sometimes it asks the user a clarification. Sometimes it calls a supplier back because the first answer wasn't good enough.

Build an **"Investigation Agent," not a "Voice Agent."**

Example user input:

> "I need a wedding photographer in Pondicherry for December 12. Budget around ₹60k. Need candid + traditional. Don't want to deal with more than 5 vendors."

A voice agent thinks: *"Here are five phone numbers. What questions should I ask?"*

AIRA thinks:

**Investigation plan** — need to establish:
- availability on Dec 12
- package price / number of hours
- candid photography / traditional photography / video
- edited photos / delivery time
- travel charges / advance payment / cancellation policy

**Then:** find evidence → search businesses → check websites/Instagram → find phone numbers → identify duplicates → call vendors → ask missing questions → verify suspicious claims.

**Then cross-check:** Vendor says ₹50,000 package; website says ₹35,000 starting price → AIRA flags ⚠️ price discrepancy → and calls again.

---

## 2. Feature Pillars (the big bets)

### 2.1 Truth / Verification Engine ⭐ signature feature
Don't just record what a vendor said — measure **how confident we are that it's true**. Every important fact gets structured treatment:

| Field | Example |
|---|---|
| Claim | ₹45,000 total |
| Evidence | Call transcript, 00:42–00:49 |
| Confidence | 91% |
| Verification | Not independently verified |

AIRA surfaces contradictions across sources:

| Claim | Source | Confidence |
|---|---|---|
| ₹45k total | Phone call | 92% |
| ₹5k delivery | Phone call | 84% |
| Available Dec 12 | Phone call | 96% |
| 3-year warranty | Website | 87% |
| "Free installation" | Website | 64% |

→ ⚠️ "Ask before buying: the vendor confirmed free installation verbally, but the website does not mention it."

**We are selling decision confidence, not AI conversations.**

### 2.2 Unknowns ⭐ signature concept
Most AI gives answers. AIRA explicitly reports **what is still unknown**:

> AIRA confidence: 82/100. Confirmed price and availability for 4/5 vendors.
> Still unknown: Vendor A cancellation fee · Vendor C delivery charge · Vendor D warranty duration.

Unknowns drive automatic follow-up loops:

```
QUESTION → CALL → ANSWER → IS ANSWER COMPLETE?
    NO ──────────────→ FOLLOW-UP
    YES → CONFLICT WITH OTHER EVIDENCE?
              YES ────────→ VERIFY
              NO  ────────→ CONFIDENT FACT
```

### 2.3 Evidence Graph
Store relationships, not flat fields:

```
Vendor A
 ├── price      → ₹15,000 (source: phone call, confidence: 94%)
 ├── availability → September (source: phone call)
 ├── food       → included (source: phone call)
 └── deposit    → ₹30,000 (source: phone call)
```

AIRA reasons over evidence rather than summarizing conversations.

### 2.4 Price Intelligence
Not just "Vendor A = ₹15,000" but:

- "₹15,000 appears **12% above** the typical price we observed for similar options."
- "Vendor B's ₹12,000 quote is **unusually low. Verify what's excluded.**"

Long-term: anonymous market intelligence layer — "Typical 1BHK moving service in Chennai: ₹8k–₹13k", "Wedding catering for 100 people: ₹45k–₹65k". Potential data moat.

### 2.5 Negotiation Engine (+ Policy Guardrails)
User grants permission and boundaries:

- Maximum budget ₹50k · Target ₹45k
- Don't remove photography · Don't increase delivery time
- Max 3 rounds

AIRA negotiates on the phone:

> AIRA: "They've offered ₹52,000. Is there any flexibility if booking is confirmed today?"
> Vendor: "₹49,000."
> AIRA: "Would ₹47,500 work if payment is made immediately?"
> Vendor: "₹48,000 final."

Report: Negotiated ₹48,000 vs original ₹52,000 — savings ₹4,000, all original inclusions confirmed intact.

**Never negotiate blindly.** Every offer passes a policy check:

```
USER → NEGOTIATION POLICY → AI AGENT → VENDOR → COUNTEROFFER → POLICY CHECK → Accept / Reject / Escalate
```

If vendor says "₹40k, but we remove video" → ❌ Not acceptable under your requirements.

### 2.6 Human Approval Checkpoint + Progressive Autonomy
No consequential actions without permission at first:

> Found: Vendor A — ₹47,000. Accept this quote?
> [Accept] [Negotiate] [Ask another question] [Reject]

Later: "Automatically accept anything under ₹45k that meets all requirements."

**AIRA Autonomy Levels (product feature):**

| Level | Name | Capability |
|---|---|---|
| 1 | Research | Calls and reports |
| 2 | Investigate | Follows up, resolves missing info |
| 3 | Negotiate | Negotiates within rules |
| 4 | Execute | Can accept/book/order within limits |
| 5 | Autonomous | "Handle this purchase. Don't bother me unless something violates my rules." |

### 2.7 Adaptive Investigation — "Don't ask me what to ask"
User: "I need a laptop for college under ₹70k." No manual question lists. AIRA generates the relevant investigation dynamically (exact model, warranty, GST invoice, delivery, return policy, configuration, availability, final price, accessories, seller credibility) and adapts mid-investigation — e.g., discovers "this model has two RAM configurations" → asks about exact config.

### 2.8 Adversarial Vendor Detection
Actively look for:
- **Hidden costs** — ₹20,000 + ₹5,000 installation
- **Bait pricing** — "Starting from ₹10,000"
- **Ambiguous availability** — "Yes, should be available."
- **Contradictions** — phone says ₹25k, website says ₹20k
- **Missing terms** — no cancellation policy provided
- **Pressure tactics** — "Offer only valid today"

Output risk assessments: "Risk: Medium — quoted price attractive but excludes delivery."

### 2.9 Vendor Trust Score
Beyond Google ratings — AIRA Trust Score (0–100) built from:
identity consistency · historical quote accuracy · response reliability · price consistency · cancellation behavior · documentation · user feedback · repeated interactions · unresolved disputes.

Over time this becomes a private vendor reputation layer.

### 2.10 Reusable Intelligence Across Investigations
500 people investigate PGs in Bangalore → AIRA learns "Vendor X frequently quotes ₹15k but adds ₹2k maintenance." Next user checking Vendor X gets:

> ⚠️ Previous investigations found additional ₹2k maintenance charges. Confirm whether they still apply.

The system learns from real-world interactions, not just web data.

---

## 3. Intake Evolution: Give AIRA Anything

Remove every input restriction. User can provide:
text · phone numbers · URLs · screenshots · PDFs · WhatsApp exports · Excel · photos · business cards · Google Maps results · voice messages.

Example: uploads screenshot of 12 vendors → AIRA extracts everything. Uploads a PDF spec → AIRA understands it and creates the investigation.

**Eventually remove "user provides phone numbers":**
> "Find me 5 reliable AC repair companies near me."
→ AIRA searches → identifies candidates → validates → calls → compares.

Workflow becomes: **Tell me what you need**, not "give me phone numbers."

---

## 4. Positioning & Competitive Landscape

### Messaging change
Current (commodity): "AI voice assistant that calls businesses."

Future homepage:

> ## Don't call 10 businesses. Let AIRA investigate them.
> Tell AIRA what you're trying to buy, find, compare or arrange. It contacts businesses, verifies prices and availability, negotiates when allowed, and gives you a decision backed by evidence.

Hero example:

```
"I need a photographer for a wedding in Pondicherry. Under ₹60k. Find the best option."

AIRA
Found 17 candidates → Contacted 8 → Verified 5 → Negotiated 2
Best option: Studio X — ₹52,000 · Saved ₹8,000 · Confidence: 94%
Why: Best price-to-package ratio + confirmed availability + no travel surcharge.
```

### Competitor warning
Emerging AI procurement/sourcing products already do pieces of this — **Klyde** (supplier discovery, live connections, quote collection, project control), **Cleartrade** (agents getting real quotes, completing transactions). "AI procurement agent" alone is NOT differentiation.

**The wedge: real-world verification through conversations.**
Traditional procurement AI: Website → database → RFQ → email → quote.
AIRA: Real world → phone/WhatsApp → human conversation → evidence → verification → negotiation.

### India-first moat
Huge Indian commerce happens via calls and messaging, not clean APIs/catalogues. Fragmented voice environment (regional languages, code-switching, mobile-network variability, local telephony requirements) is hard for generic voice agents.

AIRA handles it:

> Vendor speaks Tamil → AIRA speaks Tamil → vendor switches to English → AIRA switches → vendor says "அது கொஞ்சம் difficult sir, ₹48,000 தான் possible" → AIRA extracts: Final negotiable price: ₹48,000.

This isn't "AI speaks Tamil" — it's **AI conducting commerce across India's messy conversational economy.**

---

## 5. Target Architecture

```
                 USER
                   │
                   ▼
          ┌─────────────────┐
          │   AIRA BRAIN     │
          │ Understand goal  │
          └────────┬────────┘
                   ▼
          ┌─────────────────┐
          │ INVESTIGATION    │
          │ PLANNER          │
          └────────┬────────┘
                   │
       ┌───────────┼────────────┐
       ▼           ▼            ▼
    SEARCH       PHONE       WHATSAPP
       │           │            │
       └───────────┼────────────┘
                   ▼
          ┌─────────────────┐
          │ EVIDENCE ENGINE │
          │ Claims + proof  │
          └────────┬────────┘
                   ▼
          ┌─────────────────┐
          │ VERIFICATION    │
          │ Conflicts?      │
          │ Missing info?   │
          └────────┬────────┘
              ┌────┴────┐
              ▼         ▼
           FOLLOW UP   DONE
              │
              ▼
          NEGOTIATION
              ▼
          COMPARISON
              ▼
        RECOMMENDATION
              ▼
        USER APPROVAL
              ▼
          EXECUTION
```

---

## 6. Killer Differentiators (the seven)

1. 🧠 **Adaptive Investigation** — AIRA decides what questions need answering.
2. 🔎 **Evidence-backed answers** — every important claim has a source.
3. ⚠️ **Contradiction detection** — AIRA catches when sources disagree.
4. 📞 **Real-world conversations** — phone/WhatsApp, not just websites and APIs.
5. 💰 **Negotiation** — within user-defined boundaries.
6. 🌏 **India conversational intelligence** — Tamil/Hindi/Kannada/etc. + code-switching.
7. 🧠 **Persistent market memory** — remembers what vendors actually said and how reliable they were.

Together these are much harder to dismiss as "another AI voice agent." Competitors can copy Gemini/voice/SIP/dashboards/transcripts; they cannot easily copy **AIRA's investigation memory**:

```
Vendor → Historical conversations → Quotes → Promises → Actual outcomes
      → Reliability → Negotiation behavior → Market price
      = AIRA INTELLIGENCE GRAPH  ← the real company
```

---

## 7. The Ultimate Version

> "I'm moving to Bangalore next month. Find me a PG under ₹18k near Koramangala, arrange movers, find a mess, and don't let total monthly costs exceed ₹25k."

AIRA creates a plan and executes:

```
PG: 12 options investigated
Food: 7 options investigated
Movers: 5 quotes negotiated
Total estimated monthly: ₹23,400

I need your approval for these 3 actions.
```

End-to-end single-goal example ("moving apartment"):

| Stage | What AIRA does |
|---|---|
| Discover | Finds 15 movers |
| Filter | Removes businesses that don't serve the location |
| Investigate | Calls 8; asks truck type, workers, price, loading/unloading, insurance, stairs, timing, GST, hidden charges |
| Verify | Checks websites/reviews |
| Negotiate | Gets ₹11,000 instead of ₹13,000 |
| Rank | #1 Vendor A — 94 |
| Explain | ₹11k final · 3 workers · 1BHK confirmed · no stair surcharge · insurance included · Saturday 9 AM confirmed |
| Ask | Book Vendor A? |

That is an **AI operator** — not a chatbot, not a voice bot, not a procurement dashboard.

---

## 8. Roadmap Horizon Mapping (how this maps to build order)

| Horizon | Contents |
|---|---|
| **Now (desktop foundation)** | Electron app, SQLite local storage, editable review, Live Ops controls, results comparison + transcripts + recordings, settings UI, rebrand/palette |
| **Near (investigation depth)** | Evidence graph schema, claim/confidence model, Unknowns tracking, follow-up loop, multi-source intake (URL/PDF/screenshot), adaptive question generation |
| **Mid (verification + negotiation)** | Truth/Verification Engine, contradiction detection, adversarial vendor flags, Negotiation Policy engine, approval checkpoints, autonomy levels 1–3 |
| **Far (autonomy + moat)** | WhatsApp channel, contact discovery, price intelligence aggregates, Vendor Trust Scores, cross-investigation memory, Intelligence Graph, autonomy levels 4–5 |

---

*Captured verbatim-in-spirit from the founder's vision notes (Aug 2026). When implementing anything, check section 2 pillars and section 8 horizons first.*
