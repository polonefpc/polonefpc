# Architecture rules

- The weekly market indicator is an isolated browser-safe component with a tested calendar-day series that carries saved admin values; visual motion never changes stored market data.
- Reward configuration and rounds live in dedicated public tables protected by RLS; round prize snapshots preserve outcomes when configuration changes.
- Wheel round audiences are snapshotted on creation and enforced by an authenticated database eligibility function; selected recipients use owner/admin RLS so targeting cannot be bypassed by client requests.
- Wheel spins and task approvals credit balances through authenticated atomic PostgreSQL functions with row locks and unique claims to prevent repeat rewards.
- Reward pages use isolated client/admin components and authenticated server-function wrappers; manual wheel assignments are admin-only and never returned to customers.
- Task proofs are resized JPEG screenshots capped at 750 KB per submission and stored with the private submission record, following the app's existing compressed-image pattern.
- Support uses owner/admin RLS-protected conversations with cascading messages, realtime subscriptions and polling fallback; only admins can delete conversations so closing permanently removes the complete thread.
- Support customer details are fetched through an authenticated admin-verified server function; complete daily history is paginated without a fixed row cap.
- Network withdrawals are created through an authenticated atomic database function that locks the balance and stores network and fee snapshots with the request to prevent inconsistent debits.
