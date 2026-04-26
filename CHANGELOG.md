# Changelog — Khaled Portfolio v4

Updated: 2026-04-26

---

## v4 — Content + Typography + USD Pricing (current)

### Content additions
- **+7 ريلز تعليمي** جديدة (إجمالي ١٠ ريلز في القسم).
- **+3 ريلز عام** جديدة (إجمالي ١١ ريل في القسم).

### Pricing — تحويل للدولار
| Tier | EGP قبل | EGP بعد | USD قبل | USD بعد |
|------|---------|---------|---------|---------|
| Editing Spark | 3,000 | 2,400 | $60 | $48 |
| Editing Rise | 5,000 | 4,000 | $100 | $80 |
| Editing Signature | 7,250 | 5,800 | $145 | $116 |
| Marketing Spark | 11,250 | 9,000 | $225 | $180 |
| Marketing Rise | 20,000 | 16,000 | $400 | $320 |
| Marketing Signature | 36,250 | 29,000 | $725 | $580 |

سعر التحويل المستخدم: ~50 ج.م = $1.

### Typography & Fonts
- **خط جديد رسمي:** Tajawal للعربي + Inter للإنجليزي (بدل Cairo + Poppins).
- **تحسين تباعد النصوص:**
  - line-height زاد من 1.7 إلى 1.85 للعربي و 1.7 للإنجليزي.
  - word-spacing 0.5px للعربي علشان النصوص تبان أوضح.
  - letter-spacing -0.2px للعناوين الإنجليزية.
  - text-rendering: optimizeLegibility + font-smoothing antialiased.
- **تنضيف النصوص:** شيلت النقطات اللي كانت في آخر الجمل الوصفية (٢٠٠+ سطر).

### Motion additions
- **شريط Scroll Progress** فوق الموقع بتدرّج نيون-أزرق بيتحرك مع الـ scroll.

### Bug fixes
- ضفت ترجمة إنجليزية لقسم "Skills" اللي كان بيظهر بالعربي في وضع EN.
- ضفت `autocomplete` attributes لحقول الفورم (تنبيهات DevTools).

---

## v3 — Pricing Overhaul

### Pricing structure
- **قسمين بـ tabs:** "🎬 باقات المونتاج" و"📊 باقات التسويق". تنتقل بينهم بزرّ واحد.
- **٤ مراحل في كل قسم:** Spark ⚡ → Rise 📈 → Signature ✦ → Studio 🎬.
- **اسماء جديدة بالعربي والإنجليزي:**
  - شرارة / Spark
  - انطلاق / Rise (الأكثر طلبًا)
  - بصمة / Signature
  - استوديو / Studio (سعر حسب الاتفاق)

### Limited-time discount
- **بانر خصم 20%** فوق الباقات بـ glow وanimation خفيف.
- **عدّاد ٧ أيام تنازلي** (أيام/ساعات/دقايق/ثواني) مخزّن في `localStorage`:
  - أول ما حد يفتح الموقع، بيبدأ التايمر من اللحظة دي.
  - بعد ٧ أيام بيتجدّد تلقائيًا (cycle جديد).
  - كل تاب/زيارة بتلاقي نفس التايمر مستمر.
- **عرض السعر:** السعر القديم بشرطة فوقه (أحمر باهت) + السعر الجديد بلون النيون
  + بادج "⚡ خصم 20%".

### Pricing — Editing tier
| Tier | قبل | بعد |
|------|-----|-----|
| Spark ⚡ | 3,000 ج.م | 2,400 ج.م |
| Rise 📈 | 5,000 ج.م | 4,000 ج.م |
| Signature ✦ | 7,250 ج.م | 5,800 ج.م |
| Studio 🎬 | حسب الاتفاق | — |

### Pricing — Marketing tier
| Tier | قبل | بعد |
|------|-----|-----|
| Spark ⚡ | 11,250 ج.م | 9,000 ج.م |
| Rise 📈 | 20,000 ج.م | 16,000 ج.م |
| Signature ✦ | 36,250 ج.م | 29,000 ج.م |
| Studio 🎬 | حسب الاتفاق | — |

### Files changed (v3)
```
index.html  — replaced pricing section: discount banner + countdown + tabs +
              2 panes × 4 plans, kept flip card mechanics
styles.css  — added .discount-banner, .countdown, .pricing-tabs, .pricing-pane,
              .price-old, .price-discount, .price-custom, .pricing-note,
              hide .plan-name-sub in LTR
script.js   — pricing-tabs handler, 7-day auto-renewing countdown,
              full i18n for editing/marketing tiers (AR + EN)
```

### Booking links
كل باقة فيها زرار CTA يفتح واتساب برسالة جاهزة، مثلاً:
- "عايز احجز باقة Spark مونتاج"
- "عايز احجز باقة Rise تسويق"
- Studio: "عايز أتكلم عن مشروع Studio مونتاج/تسويق"

### Footer note
أضفت ملاحظة عامة تحت الباقات:
> 💡 جميع الباقات تشمل محتوى بصري احترافي (تصميم + مونتاج) لبناء هوية قوية وزيادة الوصول والمبيعات.

---

## v2 — Earlier changes (Phases 1–3)

### Phase 1 — Content
- توحيد البراند كـ "خالد + فريق صغير" (hero + about + meta).
- شيلت قسم التصاميم الـ placeholder + استبدلت بـ CTA إنستجرام.
- شيلت فلاتر Promos + Weddings.
- صلّحت العملة (`ج` → `ج.م`).
- مجلد `reels/` الفاضي اتشال.
- قسم Testimonials جديد (٣ كروت placeholder).

### Phase 2 — SEO + Performance
- Meta tags: theme-color, OG, Twitter Card, canonical, JSON-LD.
- Favicon (inline SVG).
- خطوط جوجل من 24+ weight لـ 8 weights فقط.
- WebP versions + `<picture>` + preload للـ LCP.

### Phase 3 — UX + Code
- prefers-reduced-motion guards.
- زرار Back-to-Top.
- aria-expanded على المنيو.
- زرار واتساب أصغر على الموبايل.
- Focus states محسّنة.
- دمج 3 scroll listeners في handler واحد.

---

## TODOs (للـ user)

1. **عدّل canonical/JSON-LD URLs** للـ domain النهائي.
2. **استبدل آراء العملاء الـ placeholder** في `script.js` بآراء حقيقية.
3. لو عاوز تغيّر مدة الخصم (٧ أيام افتراضيًا)، عدّل `SEVEN_DAYS_MS` في `script.js`.
4. لو حد عاوز يصفّر العداد، يحذف key اسمه `discountStart` من localStorage.
