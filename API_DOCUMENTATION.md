VELoop Wallet API Documentation
Base URL (deployed): https://veloop-wallet.onrender.com/api

Local base URL (typical): http://localhost:5000/api
Route names and request fields should be checked against the current files in backend/src/routes and their controllers. This guide documents the main endpoints used by the current frontend; update it if the code differs.

Authentication
Protected endpoints use the JWT returned by login:
Authorization: Bearer YOUR_JWT_TOKEN
Never put real tokens or credentials in this document or in GitHub.
Register
POST /auth/register
Content-Type: application/json
Example shape only; use the exact fields required by the registration controller:
{
  "name": "Demo User",
  "email": "demo@example.com",
  "password": "Use-A-Strong-Test-Password"
}
Login
POST /auth/login
Content-Type: application/json
{
  "email": "demo@example.com",
  "password": "Use-A-Strong-Test-Password"
}
Use the token returned by a successful login for protected requests. Check the controller for the exact response property.
Health
GET /health
Full URL: https://veloop-wallet.onrender.com/api/health

Expected healthy response:
{
  "success": true,
  "message": "VELoop Wallet API and database are working",
  "database": "connected"
}
Wallet
Get current user's wallet
GET /wallet
Authorization: Bearer YOUR_JWT_TOKEN
Returns the authenticated user's VEs, SVEs, Gems, Tokens, and Spins. The user is identified from the token; do not pass another user's ID to access their wallet.
Get paginated transactions
GET /transactions?page=1&limit=10
Authorization: Bearer YOUR_JWT_TOKEN
Returns the authenticated user's paginated transaction history. Verify allowed pagination limits in the route/controller.
Wallet credit
The project includes protected/internal wallet-credit functionality. It must not be exposed as a normal user action. Confirm its exact path and request fields in the current wallet-credit route before calling it.
Payout options
List payout options
GET /payouts/options
Authorization: Bearer YOUR_JWT_TOKEN
The backend provides the configured payout options and required VEs. The frontend must not hardcode payout values. The current demo configuration includes payout methods such as UPI, PayPal, Amazon Gift Card, and Google Play Gift Card, with options limited to those currently configured in the backend.
Withdrawals
Create withdrawal
POST /withdrawals
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json
Idempotency-Key: unique-key-for-this-request
The exact body depends on the current withdrawal controller and payout method. Use an option ID returned by the payout-options endpoint and provide the required payout details. Do not trust a client-supplied required VE amount; the backend must look up the option and validate the user's balance.

Example body shape only—adjust field names to match the route:
{
  "payoutOptionId": "OPTION_ID_FROM_API",
  "payoutDetails": {
    "upiId": "demo@upi"
  }
}
A successful request should create a withdrawal with a status such as PENDING and the corresponding ledger entry. The implementation should prevent duplicate processing for the same idempotency key.
List withdrawal history
GET /withdrawals?page=1&limit=10
Authorization: Bearer YOUR_JWT_TOKEN
Returns the authenticated user's withdrawal history, including status, payout amount, required VEs, and request date where supplied by the API. Avoid returning sensitive payout details unnecessarily.
Admin withdrawal actions
Administrative withdrawal review/status routes must require authentication and admin authorization. Confirm the exact action paths and request bodies in the current admin route files before using them.
Common HTTP errors
Status	Meaning
400	Invalid request or validation failure
401	Missing/invalid authentication
403	Authenticated user lacks permission
404	Resource or payout option not found
409	Duplicate request or state conflict, if mapped this way
429	Rate limit exceeded
500	Unexpected server error


The exact status codes and error response shapes are determined by the backend error handlers.
Postman test sequence
1. Call GET /health and confirm the database is connected.
2. Register a test user and log in using the exact required fields.
3. Save the returned JWT as a Postman environment variable.
4. Call GET /wallet.
5. Call GET /transactions?page=1&limit=10.
6. Call GET /payouts/options.
7. Attempt a withdrawal requiring more VEs than the test account owns; verify rejection.
8. With a test account holding enough VEs, submit a withdrawal and check wallet balance, withdrawal history, and ledger entry.
9. In a controlled test, verify rejection/refund behavior.
10. Verify protected routes reject missing tokens and normal users cannot access admin operations.
Security reminders
- Never document real credentials, JWTs, MongoDB connection strings, or payout account details.
- Never expose MONGO_URI or JWT_SECRET in frontend code.
- Use test accounts and a demo database.
- The backend must validate balance, payout option, ownership, roles, and withdrawal state transitions.