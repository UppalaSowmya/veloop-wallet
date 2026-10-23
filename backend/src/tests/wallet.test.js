
const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../app");
const Wallet = require("../models/Wallet");

jest.mock("../models/Wallet", () => ({
  findOne: jest.fn()
}));

describe("Wallet API", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /api/wallet", () => {
    const token = jwtToken();

    test("should return wallet balances successfully", async () => {
      Wallet.findOne.mockResolvedValue({
        _id: new mongoose.Types.ObjectId(),
        ves: 3600,
        sves: 10,
        gems: 20,
        tokens: 30,
        spins: 5
      });

      const response = await request(app)
        .get("/api/wallet")
        .set("Authorization", `Bearer ${token}`);

      expect(response.statusCode).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe("Wallet fetched successfully");
      expect(response.body.wallet).toMatchObject({
        ves: 3600,
        sves: 10,
        gems: 20,
        tokens: 30,
        spins: 5
      });
    });

    test("should reject requests without an authentication token", async () => {
      const response = await request(app).get("/api/wallet");

      expect(response.statusCode).toBe(401);
      expect(response.body.success).toBe(false);
    });

    test("should reject requests with an invalid authentication token", async () => {
      const response = await request(app)
        .get("/api/wallet")
        .set("Authorization", "Bearer invalid-token");

      expect(response.statusCode).toBe(401);
      expect(response.body.success).toBe(false);
    });

    test("should return 404 when the wallet does not exist", async () => {
      Wallet.findOne.mockResolvedValue(null);

      const response = await request(app)
        .get("/api/wallet")
        .set("Authorization", `Bearer ${token}`);

      expect(response.statusCode).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe("Wallet not found");
    });
  });
});

function jwtToken() {
  const jwt = require("jsonwebtoken");

  return jwt.sign(
    { userId: new mongoose.Types.ObjectId().toString() },
    process.env.JWT_SECRET
  );
}
