# Architecture rules

- Reward configuration and rounds live in dedicated public tables protected by RLS; round prize snapshots preserve outcomes when configuration changes.
- Wheel spins and task approvals credit balances through authenticated atomic PostgreSQL functions with row locks and unique claims to prevent repeat rewards.
- Reward pages use isolated client/admin components and authenticated server-function wrappers; manual wheel assignments are admin-only and never returned to customers.
- Task proofs are resized JPEG screenshots capped at 750 KB per submission and stored with the private submission record, following the app's existing compressed-image pattern.