
import { useState, useEffect, useCallback } from 'react'
import Login from './Login'
import api from './api/axios'
import './App.css'

const CURRENCIES = ['VEs', 'SVEs', 'Gems', 'Tokens', 'Spins']

function App() {
  const [user, setUser] = useState(null)
  const [activeTab, setActiveTab] = useState('Wallet')

  const [balances, setBalances] = useState({
    VEs: 0,
    SVEs: 0,
    Gems: 0,
    Tokens: 0,
    Spins: 0,
  })

  const [transactions, setTransactions] = useState([])
  const [withdrawals, setWithdrawals] = useState([])
  const [transactionPage, setTransactionPage] = useState(1)
  const [hasMoreTransactions, setHasMoreTransactions] = useState(false)
  const [payouts, setPayouts] = useState([])
  const [selectedPayoutId, setSelectedPayoutId] = useState('')
  const [upiId, setUpiId] = useState('')
  const [paypalEmail, setPaypalEmail] = useState('')

  const [loading, setLoading] = useState(false)
  const [submittingPayout, setSubmittingPayout] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [withdrawalResult, setWithdrawalResult] = useState(null)
  const [showWithdrawalConfirmation, setShowWithdrawalConfirmation] =
    useState(false)

  const selectedPayout = payouts.find(
    (payout) => (payout._id || payout.id) === selectedPayoutId
  )

  const logout = useCallback(() => {
    localStorage.removeItem('token')
    setUser(null)
    setBalances({ VEs: 0, SVEs: 0, Gems: 0, Tokens: 0, Spins: 0 })
    setTransactions([])
    setPayouts([])
    setWithdrawals([])
    setSelectedPayoutId('')
    setActiveTab('Wallet')
    setTransactionPage(1)
    setError('')
    setSuccess('')
    setWithdrawalResult(null)
    setShowWithdrawalConfirmation(false)
  }, [])

  const loadDashboard = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const [
  walletResponse,
  transactionResponse,
  payoutResponse,
  withdrawalResponse,
] = await Promise.all([
  api.get('/wallet'),
  api.get(`/transactions?page=${transactionPage}&limit=10`),
  api.get('/payouts/options'),
  api.get('/withdrawals?page=1&limit=10'),
])

      const wallet =
        walletResponse.data.wallet ||
        walletResponse.data.data ||
        walletResponse.data

      setBalances({
        VEs: wallet.ves ?? 0,
        SVEs: wallet.sves ?? 0,
        Gems: wallet.gems ?? 0,
        Tokens: wallet.tokens ?? 0,
        Spins: wallet.spins ?? 0,
      })

      const transactionData = transactionResponse.data
      const transactionList = [
        transactionData.transactions,
        transactionData.data,
        transactionData.results,
        transactionData.data?.transactions,
      ].find(Array.isArray) || []

      setTransactions(transactionList)
      setHasMoreTransactions(transactionList.length === 10)

      const payoutData = payoutResponse.data
      const availablePayouts = payoutData.options || []

      setPayouts(availablePayouts)

      setSelectedPayoutId((currentId) => {
        if (
          availablePayouts.some(
            (payout) => (payout._id || payout.id) === currentId
          )
        ) {
          return currentId
        }

        return availablePayouts.length > 0
          ? (availablePayouts[0]._id || availablePayouts[0].id || '')
          : ''
      })

      const withdrawalData = withdrawalResponse.data

setWithdrawals(
  withdrawalData.data?.withdrawals ||
    withdrawalData.withdrawals ||
    []
)
    } catch (err) {
      setError(
        err.response?.data?.message ||
          'Unable to load wallet information. Please try again.'
      )
    } finally {
      setLoading(false)
    }
  }, [transactionPage])

  useEffect(() => {
    if (localStorage.getItem('token')) {
      setUser({ authenticated: true })
    }
  }, [])

  useEffect(() => {
    if (user) {
      loadDashboard()
    }
  }, [user, loadDashboard])

  const logoutAndReset = () => {
    logout()
  }

  const handleLogin = () => {
    setUser({ authenticated: true })
  }

  const changeTransactionPage = (nextPage) => {
    if (nextPage >= 1) {
      setTransactionPage(nextPage)
    }
  }

  const requestWithdrawal = (event) => {
    event.preventDefault()
    setError('')
    setSuccess('')

    if (!selectedPayout) {
      setError('Please select a payout option.')
      return
    }

    const method = String(
      selectedPayout.payoutMethod || selectedPayout.method || ''
    ).toUpperCase()

    if (method === 'UPI' && !upiId.trim()) {
      setError('Please enter your UPI ID.')
      return
    }

    if (method === 'PAYPAL' && !paypalEmail.trim()) {
      setError('Please enter your PayPal email.')
      return
    }

    setShowWithdrawalConfirmation(true)
  }

  const confirmWithdrawal = async () => {
    if (!selectedPayout || submittingPayout) return

    setSubmittingPayout(true)
    setError('')
    setSuccess('')

    try {
      const method = String(
        selectedPayout.payoutMethod || selectedPayout.method || ''
      ).toUpperCase()

      let payoutDetails = {}

      if (method === 'UPI') {
        payoutDetails = { upiId: upiId.trim() }
      } else if (method === 'PAYPAL') {
        payoutDetails = { email: paypalEmail.trim() }
      }

      const idempotencyKey =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `withdraw-${Date.now()}-${Math.random().toString(36).slice(2)}`

      const response = await api.post(
        '/withdrawals',
        {
          payoutOptionId: selectedPayout._id || selectedPayout.id,
          payoutDetails,
        },
        {
          headers: { 'Idempotency-Key': idempotencyKey },
        }
      )

      setWithdrawalResult(response.data.withdrawal || response.data)
      setSuccess('Withdrawal request submitted successfully.')
      setShowWithdrawalConfirmation(false)
      setUpiId('')
      setPaypalEmail('')
      setTransactionPage(1)

      await loadDashboard()
    } catch (err) {
      setError(
        err.response?.data?.message ||
          'Unable to submit withdrawal. Please try again.'
      )
      setShowWithdrawalConfirmation(false)
    } finally {
      setSubmittingPayout(false)
    }
  }

  if (!user) {
    return <Login onLogin={handleLogin} />
  }

  const getTransactionId = (transaction) =>
    transaction._id ||
    transaction.id ||
    `${transaction.createdAt}-${transaction.amount}`

  return (
    <main className="wallet-app">
      <header className="app-header">
        <h1>VELoop Rewards</h1>
        <button className="logout-button" onClick={logoutAndReset}>
          Logout
        </button>
      </header>

      <nav className="app-tabs" aria-label="Main navigation">
        <button
          className={activeTab === 'Wallet' ? 'active' : ''}
          onClick={() => setActiveTab('Wallet')}
        >
          Wallet
        </button>

        <button
          className={activeTab === 'Payout' ? 'active' : ''}
          onClick={() => setActiveTab('Payout')}
        >
          Payout
        </button>
      </nav>

      <section className="app-content">
        {error && (
          <div className="error-message" role="alert">
            {error}
            <button onClick={() => setError('')} aria-label="Dismiss error">
              ×
            </button>
          </div>
        )}

        {success && (
          <div className="success-message" role="status">
            {success}
            <button
              onClick={() => setSuccess('')}
              aria-label="Dismiss success message"
            >
              ×
            </button>
          </div>
        )}

        {loading && <p>Loading wallet information...</p>}

        {!loading && activeTab === 'Wallet' && (
          <section>
            <h2>My Wallet</h2>

            <div className="balance-grid">
              {CURRENCIES.map((currency) => (
                <article className="balance-card" key={currency}>
                  <h3>{currency}</h3>
                  <p>
                    {Number(balances[currency] || 0).toLocaleString()}
                  </p>
                </article>
              ))}
            </div>

            <section className="transactions-section">
              <h2>Transaction History</h2>

              {transactions.length === 0 ? (
                <p>No transactions found.</p>
              ) : (
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>Type</th>
                        <th>Currency</th>
                        <th>Amount</th>
                        <th>Balance After</th>
                        <th>Date</th>
                      </tr>
                    </thead>

                    <tbody>
                      {transactions.map((transaction) => (
                        <tr key={getTransactionId(transaction)}>
                          <td>
                            {transaction.transactionType ||
                              transaction.type ||
                              '—'}
                          </td>
                          <td>{transaction.currencyType || '—'}</td>
                          <td>{transaction.amount ?? '—'}</td>
                          <td>{transaction.balanceAfter ?? '—'}</td>
                          <td>
                            {transaction.createdAt
                              ? new Date(
                                  transaction.createdAt
                                ).toLocaleString()
                              : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="pagination-controls">
                <button
                  disabled={transactionPage <= 1}
                  onClick={() =>
                    changeTransactionPage(transactionPage - 1)
                  }
                >
                  Previous
                </button>

                <span>Page {transactionPage}</span>

                <button
                  disabled={!hasMoreTransactions}
                  onClick={() =>
                    changeTransactionPage(transactionPage + 1)
                  }
                >
                  Next
                </button>
              </div>
            </section>

            <button onClick={loadDashboard} disabled={loading}>
              Refresh Wallet
            </button>
          </section>
        )}

        {!loading && activeTab === 'Payout' && (
          <section>
            <h2>Withdraw Rewards</h2>
            <p>
              Available VEs:{' '}
              {Number(balances.VEs || 0).toLocaleString()}
            </p>

            <form onSubmit={requestWithdrawal}>
              <label htmlFor="payoutOption">Payout option</label>

              <select
                id="payoutOption"
                value={selectedPayoutId}
                onChange={(event) =>
                  setSelectedPayoutId(event.target.value)
                }
                required
              >
                {payouts.length === 0 && (
                  <option value="">No payout options available</option>
                )}

                {payouts.map((payout) => {
                  const id = payout._id || payout.id

                  return (
                    <option key={id} value={id}>
                      {payout.name ||
                      ({
                        AMAZON_GIFT_CARD: 'Amazon Gift Card',
                        GOOGLE_PLAY_GIFT_CARD: 'Google Play Gift Card',
                        PAYPAL: 'PayPal',
                        UPI: 'UPI',
                      }[payout.method] || payout.method || 'Payout')}{' '}
                    — {payout.requiredVEs ?? payout.vesRequired ?? '—'} VEs
                                      </option>
                                    )
                                  })}
              </select>

              {String(
                selectedPayout?.payoutMethod ||
                  selectedPayout?.method ||
                  ''
              ).toUpperCase() === 'UPI' && (
                <>
                  <label htmlFor="upiId">UPI ID</label>
                  <input
                    id="upiId"
                    type="text"
                    value={upiId}
                    onChange={(event) => setUpiId(event.target.value)}
                    placeholder="example@upi"
                    required
                  />
                </>
              )}

              {String(
                selectedPayout?.payoutMethod ||
                  selectedPayout?.method ||
                  ''
              ).toUpperCase() === 'PAYPAL' && (
                <>
                  <label htmlFor="paypalEmail">PayPal email</label>
                  <input
                    id="paypalEmail"
                    type="email"
                    value={paypalEmail}
                    onChange={(event) =>
                      setPaypalEmail(event.target.value)
                    }
                    placeholder="you@example.com"
                    required
                  />
                </>
              )}

              {selectedPayout && (
                <p>
                  Required VEs:{' '}
                  {selectedPayout.vesRequired ??
                    selectedPayout.requiredVEs ??
                    'See payout option details'}
                </p>
              )}

              <button
                type="submit"
                disabled={!selectedPayout || submittingPayout}
              >
                Review Withdrawal
              </button>
            </form>

            {showWithdrawalConfirmation && (
              <div
                className="confirmation-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="confirmation-title"
              >
                <h3 id="confirmation-title">Confirm withdrawal</h3>
                <p>Review your payout details before continuing.</p>

                <p>
                  Method:{' '}
                  {selectedPayout?.payoutMethod ||
                    selectedPayout?.method ||
                    '—'}
                </p>

                <p>
                  Amount:{' '}
                  {selectedPayout?.payoutAmount ??
                    selectedPayout?.amount ??
                    '—'}{' '}
                  {selectedPayout?.currency || 'INR'}
                </p>

                <button
                  onClick={confirmWithdrawal}
                  disabled={submittingPayout}
                >
                  {submittingPayout ? 'Submitting...' : 'Confirm'}
                </button>

                <button
                  onClick={() =>
                    setShowWithdrawalConfirmation(false)
                  }
                  disabled={submittingPayout}
                >
                  Cancel
                </button>
              </div>
            )}

            {withdrawalResult && (
              <section className="withdrawal-result">
                <h3>Latest withdrawal request</h3>
                <p>
                  Status: {withdrawalResult.status || 'Submitted'}
                </p>

                {withdrawalResult._id && (
                  <p>Request ID: {withdrawalResult._id}</p>
                )}

              </section>
            )}
<section className="transactions-section">
  <h2>Withdrawal History</h2>

  {withdrawals.length === 0 ? (
    <p>No withdrawal requests found.</p>
  ) : (
    <div className="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Method</th>
            <th>Amount</th>
            <th>VEs Required</th>
            <th>Status</th>
            <th>Requested On</th>
          </tr>
        </thead>

        <tbody>
          {withdrawals.map((withdrawal) => (
            <tr key={withdrawal.id}>
              <td>{withdrawal.payoutMethod}</td>
              <td>
                {withdrawal.currency || 'INR'}{' '}
                {withdrawal.payoutAmount}
              </td>
              <td>{withdrawal.vesRequired}</td>
              <td>{withdrawal.status}</td>
              <td>
                {withdrawal.createdAt
                  ? new Date(
                      withdrawal.createdAt
                    ).toLocaleString()
                  : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )}
</section>

          </section>
        )}
      </section>
    </main>
  )
}

export default App
