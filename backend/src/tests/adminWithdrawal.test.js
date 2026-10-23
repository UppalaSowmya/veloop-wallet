const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("../app");
const User = require("../models/User");

jest.mock("../models/User", () => ({
  findById: jest.fn()
}));

describe("Admin Withdrawal API", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  const token = (userId = "6acf1b5925798539c129b365") =>
    jwt.sign(
      { userId },
      process.env.JWT_SECRET
    );

  const mockUser = (role = "ADMIN", status = "ACTIVE") => {
    User.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue({
        role,
        status
      })
    });
  };

  describe("GET /api/admin/withdrawals", () => {
    test("should reject requests without an authentication token", async () => {
      const response = await request(app)
        .get("/api/admin/withdrawals");

      expect(response.statusCode).toBe(401);
      expect(response.body.success).toBe(false);
    });

    test("should reject requests with an invalid authentication token", async () => {
      const response = await request(app)
        .get("/api/admin/withdrawals")
        .set("Authorization", "Bearer invalid-token");

      expect(response.statusCode).toBe(401);
      expect(response.body.success).toBe(false);
    });

    test("should reject a normal user", async () => {
      mockUser("USER", "ACTIVE");

      const response = await request(app)
        .get("/api/admin/withdrawals")
        .set("Authorization", `Bearer ${token()}`);

      expect(response.statusCode).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe("Admin access required.");
    });

    test("should reject an invalid withdrawal status filter", async () => {
      mockUser("ADMIN", "ACTIVE");

      const response = await request(app)
        .get("/api/admin/withdrawals?status=INVALID")
        .set("Authorization", `Bearer ${token()}`);

      expect(response.statusCode).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe(
        "Invalid withdrawal status filter."
      );
    });
  });

  describe("GET /api/admin/withdrawals/:id", () => {
    test("should reject an invalid withdrawal ID", async () => {
      mockUser("ADMIN", "ACTIVE");

      const response = await request(app)
        .get("/api/admin/withdrawals/invalid-id")
        .set("Authorization", `Bearer ${token()}`);

      expect(response.statusCode).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe(
        "A valid withdrawal ID is required."
      );
    });
  });
});