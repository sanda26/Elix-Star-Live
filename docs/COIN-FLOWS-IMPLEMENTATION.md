# Coin Flows Implementation

## Scope

- Keep real coin and IAP behavior unchanged.
- Implement test coins as a separate system.
- Enforce score-only test coin usage.

## Real Coin Flow (unchanged)

- Balance source: real wallet store (`real` coins only).
- Purchase sources: Apple IAP / Google Play Billing (existing flow).
- Real coin usage remains in-app only.

## Test Coin Flow (new)

- New balance store: `test_coin_balance` in a dedicated store.
- New routes:
  - `GET /coins/test/balance`
  - `POST /coins/test/mint` (admin/dev only)
  - `POST /coins/test/score` (score-only spending)
- Test coin spending behavior:
  - Allowed: conversion to battle score/points (`/coins/test/score`)
  - Forbidden: conversion to real coins, cash-out, withdrawal, money conversion

## Server Guard Rules

- Any `coin_type=test` request against real coin routes is rejected.
- Any `coin_type=real` request against test coin routes is rejected.
- Blocked cross-coin attempts are logged for QA evidence.

## Client/UI Rules

- Legacy password/local test top-up UI is disabled.
- Test coin features are not exposed to normal users by default.
- If shown in admin/debug surfaces, label must be: `Test coins (no real value)`.

## QA Negative Tests

| Test | Expected |
|------|----------|
| Normal user calls `POST /coins/test/mint` | `403 Forbidden` |
| Call real gift route with `coin_type=test` | Rejected with `coin_type_mismatch` |
| Call test score route with `coin_type=real` | Rejected with `coin_type_mismatch` |
| Attempt real-to-test conversion path | No API path / rejected |

## Evidence Checklist

- Capture API request/response screenshots for all negative tests.
- Capture server logs showing blocked attempts.
- Record timestamp, test account, and environment (dev/staging/prod).
