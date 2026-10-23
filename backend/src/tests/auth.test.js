const request = require("supertest");
const app = require("../app");

describe("Authentication API", () => {
  describe("POST /api/auth/register", () => {
    test("should reject registration when required fields are missing", async () => {
      const response = await request(app)
        .post("/api/auth/register")
        .send({
          name: "Test User",
          email: "test@example.com"
        });

      expect(response.statusCode).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe(
        "Name, email, and password are required"
      );
    });

    test("should reject an invalid email address", async () => {
      const response = await request(app)
        .post("/api/auth/register")
        .send({
          name: "Test User",
          email: "invalid-email",
          password: "TestPass123!"
        });

      expect(response.statusCode).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe(
        "Please enter a valid email address"
      );
    });

    test("should reject passwords shorter than 8 characters", async () => {
      const response = await request(app)
        .post("/api/auth/register")
        .send({
          name: "Test User",
          email: "test@example.com",
          password: "short"
        });

      expect(response.statusCode).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe(
        "Password must be at least 8 characters long"
      );
    });
  });

  describe("POST /api/auth/login", () => {
    test("should reject login when required fields are missing", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({
          email: "test@example.com"
        });

      expect(response.statusCode).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe(
        "Email and password are required"
      );
    });
  });
});