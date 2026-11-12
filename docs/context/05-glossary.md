# Glossary

| Arabic (as used in chat) | Our term | LIP term / code |
| --- | --- | --- |
| الكافيه / البراند / صاحب العمل | Business | `tenant_id` (+ `brand_id`, `merchant_id` on orders) |
| الفرع | Branch | `location_id` (`packages/server/src/locations.ts`) |
| صاحب الكافيه | Owner | `TenantRole: owner` |
| الكاشير / الموظف | Staff / Cashier | no dedicated LIP role (gap G-05); permissions enforced by the BFF (PD-014) |
| مدير الفرع | Branch Manager | planned role for one branch; P1, not in P0 (PD-014) |
| العميل | Customer | platform customer → `member_id` per program |
| كارت الولاء | Loyalty card | member account in one program |
| العضوية | Membership | `{tenant, customer, program} → member_id` |
| برنامج الولاء | Loyalty program | `ProgramDefinition` (`packages/reference/src/config.ts`) |
| طابع / ختم | Stamp | account unit `stamps`, `visit_stamp_policy` |
| نقاط | Points | account unit `points`, `earn_rate` |
| مستوى (فضي/ذهبي/بلاتيني) | Tier | `tiers`, `tier_policy` |
| مكافأة | Reward | catalog `rewards[]`; issued reward (wallet) |
| استبدال المكافأة | Redemption | reserve → capture (→ reverse) |
| تسجيل عملية شراء | Purchase / accrual | `orders.evaluate` + `accruals.post` |
| مرتجع / استرداد | Refund / adjustment | `orders.adjust` (negative `eligible_spend_delta`) |
| صلاحية النقاط | Point expiry | `point_expiration` lots |
| مدة صلاحية النقاط | Point expiry duration | café setting: 180, 365 (default), 545 or 730 days, or never; applies to points earned after a change (PD-020) |
| حملة | Campaign | `RewardCampaign` (`campaigns.ts`) |
| شريحة عملاء | Segment | `StaticSegment` (static/dynamic rules) |
| موافقة تسويقية | Marketing consent | `CustomerConsent` (per tenant) |
| عميل مختفي | Lapsed customer | no visit for N days (rule not yet expressible, G-09) |
| الاشتراك / الباقة | Subscription / plan | Cloud `plan_id`, subscription |
| مدة الاشتراك | Subscription period | from start to end date; a café's access follows the end date |
| مرحلة الاشتراك | Subscription stage | grace, read-only or suspended, computed by our layer from the period end date in Cairo days; full permission table in PD-005 A2 |
| فترة السماح | Grace period | first stage after the end date (days 1–7, PD-020): everything still works |
| وضع القراءة فقط | Read-only stage | second stage (days 8–37, PD-020): owner cannot add staff, change program or campaigns, or give bonus/gift/migration adjustments; cashiers still award and redeem; voids, corrections, revocations and Branch QR rotation still work (PD-005 A2) |
| إيقاف الخدمة | Suspended stage | third stage (day 38 onward): no new awards or joins; customers can still redeem; voids, corrections, revocations and Branch QR rotation still work; balances kept. Not the same as Cloud environment `suspended`, which is never used for this (PD-005 A2) |
| التحصيل اليدوي | Manual billing | subscription paid offline and recorded by the super admin (PD-005 A1); Cloud `billing_provider: "manual"` |
| إيصال دفع | Payment record | one offline payment: café, amount, method, reference, date, recorded by |
| مفتاح منع التكرار | Idempotency key | `context.idempotency_key` |
| النسخة الأصلية | Upstream | the original open-source LIP project we forked |
| النسخة المثبّتة | Pinned commit | the exact upstream commit our fork is based on (PD-002) |
| تعديل على الـ fork | Fork patch | any change we make to upstream code; never to `/lip/v1` semantics or `spec/` |
| قلب الولاء | Loyalty core | the LIP parts we ship: protocol, engine, storage, identity, SDK, Cloud |
| مسح الكاشير لـ QR العميل | Staff scan (Method B) | ours (G-02); the trusted path that grants purchase value directly |
| مسح العميل لـ QR الفرع | Customer scan (Method A) | ours (G-03); creates a pending claim only |
| QR العضوية المتغير | Member QR code | ours: short-lived, single-use code identifying one customer at one business, computed on a registered customer device (PD-003 A1) |
| كود التحقق | One-time code (OTP) | 6-digit sign-in code sent by WhatsApp or SMS, issued and checked by our BFF (PD-004) |
| دليل العملاء | Customer directory | platform-level store of customers and their memberships; the only place personal data lives (G-01, PD-006) |
| لغة المحتوى الأساسية | Main content language | the language a café must fill in for its program, rewards and branches (Arabic by default; PD-007) |
| نص العرض | Display text | the localized name/description customers see; distinct from LIP's internal `name` label |
| مبلغ الفاتورة | Bill amount | the single amount a cashier types for a purchase; becomes one synthetic order line (PD-008) |
| حد الفاتورة الكبيرة | Large-bill threshold | café setting above which the cashier must re-type the amount (PD-008) |
| إلغاء العملية | Void | full clawback of a purchase: by the same cashier within 10 minutes, or by the owner at any time; stamp programs also cancel rewards and restore stamps (PD-008, A1) |
| مسار الإلغاء | Void operation | ours: the saved, replayable plan that runs a void — cancel rewards, `orders/adjust` void, stamp restore (PD-008 A1) |
| تصحيح استرجاع الطوابع | Stamp-restore correction | system `correction` adjustment of k × threshold stamps inside a permitted void; nobody can request it or type its amount (PD-003 A2) |
| طلب استبدال بدون شراء | Redemption-only order | synthetic zero-value order used when a customer redeems without buying; never accrued (PD-008 A1) |
| قفل العميل | Member lock | per-member lock plus durable "void in progress" flag that serializes stamp-balance and reward changes; the flag clears only after authoritative LIP reconciliation, with unresolved cases blocked and escalated (PD-008 A1) |
| دعوة صاحب الكافيه | Owner invite | single-use, phone-bound invite valid 72 hours, stored hashed in our layer; not a Cloud invitation (PD-011) |
| واجهة | Surface | one audience's part of the web app: customer (`app.`), staff (`staff.`), owner (`dashboard.`) |
| جلسة العميل | Customer session | the signed-in state the BFF keeps for a customer (90 days, sliding); never seen by LIP |
| رسالة معاملات | Transactional message | a message about the customer's own card (reward earned, reward expiring); needs no marketing consent |
| قاطع الإرسال | OTP circuit breaker | platform-wide daily cap on OTP sends and spend; pauses sending when reached |
| جهاز العميل | Customer device | a phone/browser or Google Wallet pass registered to a customer account (max 3); the customer can revoke it |
| كارت المحفظة | Wallet pass | a Google Wallet loyalty pass for one membership; shows balance and a rotating code for earning only (PD-009) |
| معرّف الكارت | Pass id | random id on a wallet pass; cannot be linked to the customer or `member_id` from outside |
| عملية معلّقة | Pending claim | ours: a customer's request for purchase credit, worth nothing until staff confirm it |
| كود التأكيد | Claim code | short code on the customer's phone that the cashier types to confirm a pending claim |
| جلسة الموظف | Staff session | a signed-in staff member on a registered branch device; the only actor that grants purchase value |
| تعويض الخدمة | Service recovery adjustment | owner-only manual adjustment classified `service_recovery` (e.g. purchases lost to an outage) |
| مرجع | Reference package | an upstream part we read but do not ship (e.g. upstream Admin, wallet) |
