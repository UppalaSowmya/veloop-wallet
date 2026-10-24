VELoop Rewards Wallet & Payout System
A demonstration wallet and payout application built with a React/Vite frontend and a Node.js/Express/MongoDB backend. The backend is the source of truth for wallet balances, transaction history, payout configuration, and withdrawal requests.
Features
- Registration and login with JWT authentication
- Backend-managed balances: VEs, SVEs, Gems, Tokens, and Spins
- Paginated wallet transaction history
- Backend-provided payout options
- Withdrawal requests, balance validation, and status history
- Protected administrative operations and audit records
- Idempotency/concurrency protections for withdrawal operations
- Automated backend tests
Technology
- Frontend: React, Vite, Axios
- Backend: Node.js, Express
- Database: MongoDB Atlas, Mongoose
- Authentication: JWT
- Tests: Jest/Supertest; manual checks with Postman
- Deployment: Vercel frontend, Render backend, MongoDB Atlas
Live links
- Frontend: https://veloop-wallet.vercel.app
- Backend health check: https://veloop-wallet.onrender.com/api/health
- GitHub: https://github.com/UppalaSowmya/veloop-wallet
Run locally
Backend
cd backend
npm install
Create backend/.env using the variable names in .env.example. Example values (replace placeholders with your own):
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_long_random_secret
ADMIN_EMAIL=your_registered_admin_email
Do not commit .env or share its values. Start the backend with the script configured in backend/package.json (for this project, npm start is available). Local API base URL is typically http://localhost:5000/api.
Frontend
In a second terminal:
cd frontend
npm install
Set VITE_API_URL in the frontend environment. For local development:
VITE_API_URL=http://localhost:5000/api
For the deployed Vercel frontend:
VITE_API_URL=https://veloop-wallet.onrender.com/api
Vite variables prefixed with VITE_ are exposed to browser code. Use them only for public configuration, never for secrets.

Start the frontend with:
npm run dev
Use the local URL printed by Vite.
Architecture and security
- The backend owns wallet balances and payout calculations; the frontend only displays backend data.
- Wallet mutations should create ledger entries recording currency, transaction type, amount, balance before/after, reference, and timestamp.
- Withdrawal creation validates the authenticated user, configured payout option, payout details, and available balance.
- Duplicate withdrawal requests must be protected with the project's idempotency mechanism.
- Rejected/cancelled withdrawals should follow the implemented reversal/refund flow.
- User routes must be scoped to the authenticated user; admin routes require admin authorization.
- Keep MONGO_URI, JWT_SECRET, passwords, and tokens private. Never put them in VITE_ variables.
- If a secret is accidentally exposed, rotate it.
Testing
Run the backend test script from the backend directory:
npm test
The test suite previously ran successfully with 11 suites and 72 tests passing in the development environment. Re-run tests after any changes and update this statement if the result differs.

Manual smoke-test checklist:
1. Register and log in.
2. Load wallet balances and transaction history.
3. Load payout options.
4. Verify insufficient VEs are rejected.
5. With a test account that has enough VEs, create a withdrawal and check history and ledger.
6. Verify rejection/refund behavior in a controlled test.
7. Confirm unauthenticated users cannot access protected APIs and normal users cannot use admin operations.
Documentation
See [API_DOCUMENTATION.md](./API_DOCUMENTATION.md). Verify route paths, payloads, and response shapes against the current route/controller files before relying on examples.
Scaling
For higher traffic, consider MongoDB transaction support and indexes, atomic balance updates, idempotency, an append-oriented ledger, scheduled reconciliation, background queues for payout processing, distributed rate limiting, monitoring, backups, fraud checks, and disaster recovery.