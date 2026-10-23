
const baseUrl = "http://localhost:5000/api/withdrawals";
const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2YWNmN2I2YjYwYTc4NTAxZjk3MTYwZWMiLCJpYXQiOjE3OTI0MDQxMjQsImV4cCI6MTc5MjQwNzcyNH0.fHm7xYC3gL9cHI4et-9kvXnKvQCvfbUy_5RYSR7H_60";

const body = {
  payoutOptionId: "6acf2189a40f5f93795064ce",
  payoutDetails: { upiId: "testuser@upi" }
};

async function sendRequest(key) {
  const response = await fetch(baseUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Idempotency-Key": key
    },
    body: JSON.stringify(body)
  });

  return {
    status: response.status,
    body: await response.json()
  };
}

Promise.all([
  sendRequest("concurrent-test-A-20261019-0955"),
sendRequest("concurrent-test-B-20261019-0955")
])
  .then(results => console.log(JSON.stringify(results, null, 2)))
  .catch(error => console.error(error));
