# Glossary

| Arabic (as used in chat) | Our term | LIP term / code |
| --- | --- | --- |
| الكافيه / البراند / صاحب العمل | Business | `tenant_id` (+ `brand_id`, `merchant_id` on orders) |
| الفرع | Branch | `location_id` (`packages/server/src/locations.ts`) |
| صاحب الكافيه | Owner | `TenantRole: owner` |
| الكاشير / الموظف | Staff / Cashier | no dedicated role yet (gap G-05) |
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
| حملة | Campaign | `RewardCampaign` (`campaigns.ts`) |
| شريحة عملاء | Segment | `StaticSegment` (static/dynamic rules) |
| موافقة تسويقية | Marketing consent | `CustomerConsent` (per tenant) |
| عميل مختفي | Lapsed customer | no visit for N days (rule not yet expressible, G-09) |
| الاشتراك / الباقة | Subscription / plan | Cloud `plan_id`, subscription |
| مفتاح منع التكرار | Idempotency key | `context.idempotency_key` |
