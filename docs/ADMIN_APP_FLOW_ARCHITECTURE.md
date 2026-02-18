# OnlinePrintout Admin App: Flow + Architecture

## 1. Product Scope
This app is a mobile-first admin system for an offline print shop where admin can:
- Create quotes for predefined catalog books.
- Create quotes for custom print jobs (customer-provided notes/books).
- Calculate delivery based on pincode + shipping provider selection.
- Save partial progress as draft and resume later.
- Parse customer address using Gemini AI.
- Mark payment status.
- Create shipment and save tracking details.
- Share quote/order/shipping details over WhatsApp and Telegram.
- Manage reusable message templates.
- Manage pricing settings from Firebase.

## 2. High-Level Architecture
- Frontend: React + TypeScript + Vite.
- Backend: Express + TypeScript deployed as Firebase Function (`api`).
- Database: Firestore.
- AI: Gemini API for address parsing.
- Offline: Firestore IndexedDB + localStorage fallbacks.

## 3. Repositories and Core Modules

### Frontend
- App shell and navigation: `/Users/gauravupadhyay/Desktop/Delivery/frontend/src/App.tsx`
- Book/cart state: `/Users/gauravupadhyay/Desktop/Delivery/frontend/src/context/BookContext.tsx`
- Catalog: `/Users/gauravupadhyay/Desktop/Delivery/frontend/src/components/BookList.tsx`
- Cart and custom job builder: `/Users/gauravupadhyay/Desktop/Delivery/frontend/src/components/CartPage.tsx`
- Draft flow (address parse, review, payment, save): `/Users/gauravupadhyay/Desktop/Delivery/frontend/src/components/OrderFlow.tsx`
- Orders list and shipment actions: `/Users/gauravupadhyay/Desktop/Delivery/frontend/src/components/OrdersPage.tsx`
- Order detail + message templates: `/Users/gauravupadhyay/Desktop/Delivery/frontend/src/components/OrderDetailModal.tsx`
- Message template manager: `/Users/gauravupadhyay/Desktop/Delivery/frontend/src/components/MessageManager.tsx`
- Pricing settings admin: `/Users/gauravupadhyay/Desktop/Delivery/frontend/src/components/SettingsPage.tsx`
- Shipping API client: `/Users/gauravupadhyay/Desktop/Delivery/frontend/src/api/shippingApi.ts`
- Orders API client/model: `/Users/gauravupadhyay/Desktop/Delivery/frontend/src/api/orderApi.ts`
- Message templates API client: `/Users/gauravupadhyay/Desktop/Delivery/frontend/src/api/messageApi.ts`
- Settings API client: `/Users/gauravupadhyay/Desktop/Delivery/frontend/src/api/settingsApi.ts`
- Weight engine: `/Users/gauravupadhyay/Desktop/Delivery/frontend/src/engine/weightCalculator.ts`
- Custom price/weight engine: `/Users/gauravupadhyay/Desktop/Delivery/frontend/src/engine/customPricing.ts`

### Backend
- Express app wiring: `/Users/gauravupadhyay/Desktop/Delivery/backend/src/app.ts`
- Firebase function entry: `/Users/gauravupadhyay/Desktop/Delivery/backend/src/index.ts`
- Quote route: `/Users/gauravupadhyay/Desktop/Delivery/backend/src/routes/quote.ts`
- Shipment route: `/Users/gauravupadhyay/Desktop/Delivery/backend/src/routes/shipment.ts`
- Address parsing route: `/Users/gauravupadhyay/Desktop/Delivery/backend/src/routes/address.ts`
- Courier aggregation: `/Users/gauravupadhyay/Desktop/Delivery/backend/src/services/aggregationService.ts`
- Gemini integration: `/Users/gauravupadhyay/Desktop/Delivery/backend/src/services/geminiService.ts`
- Courier adapters: `/Users/gauravupadhyay/Desktop/Delivery/backend/src/courier/adapters/*`

## 4. End-to-End Functional Flow

## 4.1 Catalog + Custom Cart
1. Admin adds predefined books from catalog.
2. Admin can also add custom print job with:
- title
- page count
- print mode (`color`/`bw`)
- size
- paper type
- binding
- quantity
3. Custom item price and weight are calculated using Firebase settings.
4. Cart totals combine predefined + custom items.

## 4.2 Quote + Shipping Selection
1. Admin enters destination pincode.
2. Frontend sends `weightGrams` + pincode to quote API.
3. Backend aggregates rates across enabled stores and couriers.
4. Admin selects courier option (cheapest by default).
5. Admin can apply discount/markup.
6. Admin can share quote immediately via WhatsApp/Telegram.

## 4.3 Draft / Resume Order
1. Admin enters draft flow.
2. Address can be pasted raw and parsed by Gemini.
3. If parse fails/incomplete, admin edits fields manually.
4. If pincode changes, shipping recalculation is available.
5. Admin can mark payment (`paid`/`pending`) and payment mode.
6. Save as draft to Firestore.
7. Draft can be resumed later from Orders list.

## 4.4 Shipment + Confirmation
1. Draft marked paid can be shipped.
2. Shipping quote fetched again for final confirmation.
3. Selected courier creates shipment.
4. Tracking ID/courier/link saved in order.
5. Order status moves to confirmed/shipped stage.
6. Tracking details can be shared via WhatsApp/Telegram.

## 5. State Model

### Order Status Fields
- `status`: `draft | confirmed`
- `stage`:
  - `quote_shared`
  - `awaiting_address`
  - `address_captured`
  - `awaiting_payment`
  - `paid`
  - `printing`
  - `ready_to_ship`
  - `shipped`
- `paymentStatus`: `pending | paid`
- `paymentMode`: `upi | cash | bank | other` (optional)

### Resume Behavior
- Draft persistence: Firestore (`orders` collection).
- In-progress UI persistence: localStorage:
  - `cart`
  - `customCart`
  - `orderFlowData`
  - `orderRawText`
  - `orderAddress`
  - `orderNotes`

## 6. Data Model (Firestore)

### `books`
- catalog of predefined books:
  - `title`
  - `pageCount`
  - `priceColor`
  - `priceBW`
  - optional `weightGrams`

### `orders`
- mixed item order:
  - `items[]` (catalog/custom)
  - `address`
  - `booksTotal`
  - `shippingCharge`
  - `courierName`
  - `selectedCourierId`
  - `adjustment`, `adjustmentType`
  - `grandTotal`
  - `weightGrams`
  - `status`, `stage`, `paymentStatus`, `paymentMode`
  - tracking fields
  - timestamps

### `message_templates`
- reusable message blocks with placeholders:
  - `title`
  - `text`

### `app_settings`
- print pricing and weight config document:
  - per-page rates
  - size multipliers
  - paper multipliers
  - binding charges
  - min charge
  - packaging charge
  - weight config
  - defaults

## 7. API Surface

### Quote
- `POST /api/shipping-quote`
- `GET /api/shipping-quote/options`

### Shipment
- `POST /api/shipment/create`

### Address Parsing
- `POST /api/address/parse`

## 8. Message Templating
Supported placeholders include:
- `{name}`
- `{orderId}`
- `{trackingId}`
- `{trackingLink}`
- plus stage-specific tokens used in quote flow where available.

Template operations:
- list/edit/add/delete in `MessageManager`
- apply in cart quote flow and order detail flow.

## 9. Settings Save: Root Cause + Fix

## What usually causes "Unable to save settings"
1. Firestore rules deployed in cloud do not yet include `app_settings`.
2. Network/connectivity issue blocks Firestore write.
3. Firebase project mismatch in local environment.

## What is now implemented
- Settings are always saved to localStorage first.
- If Firebase write fails, UI shows warning:
  - "Saved locally. Firebase sync failed (...)".
- App still works offline for pricing calculations.

## Required deploy step (important)
Run from project root:

```bash
firebase deploy --only firestore:rules
```

This publishes `/Users/gauravupadhyay/Desktop/Delivery/firestore.rules` to your Firebase project.

## 10. Security Rules
Current rules allow read/write for:
- `books`
- `orders`
- `message_templates`
- `app_settings`

File: `/Users/gauravupadhyay/Desktop/Delivery/firestore.rules`

Note: this is open-access for now; add auth-based constraints before multi-user/public rollout.

## 11. Deployment Topology
- Hosting and functions configured in: `/Users/gauravupadhyay/Desktop/Delivery/firebase.json`
- Firebase project alias in: `/Users/gauravupadhyay/Desktop/Delivery/.firebaserc`
- Frontend calls backend under `/api/**` rewrite.

## 12. Operational Checklist
When onboarding or troubleshooting:
1. Deploy Firestore rules.
2. Ensure backend env contains Gemini key (`GOOGLE_API_KEY`) and courier creds.
3. Verify at least one courier + one store enabled.
4. Open Settings and save once to initialize `app_settings/pricing`.
5. Test full flow:
- catalog/custom cart
- shipping quote
- draft save
- payment toggle
- shipment create
- message share.

## 13. Known Gaps / Recommended Next Iteration
1. Draft edit/reopen wizard from Orders for full item-level modifications.
2. Explicit print production transitions (`printing`, `ready_to_ship`) UI buttons.
3. Strong auth + role-based Firestore rules.
4. Structured audit logs for who changed settings/order stages.

