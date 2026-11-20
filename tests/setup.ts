// Test environment defaults.
// Integration tests write data, so they must run against a disposable database whose name contains "test".
process.env.AUTH_SECRET ??= "test-secret-test-secret-test-secret-1234";
process.env.APP_URL ??= "http://localhost:3000";
if (process.env.TEST_DATABASE_URL) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

const url = process.env.DATABASE_URL ?? "";
const dbName = url.split("?")[0]?.split("/").pop() ?? "";
const isIntegration = process.argv.some((a) => a.includes("integration")) || !process.argv.some((a) => a.includes("tests/unit"));
if (isIntegration && url && !/test/i.test(dbName)) {
  throw new Error(`Refusing to run tests against database "${dbName}". Set TEST_DATABASE_URL to a database whose name contains "test".`);
}
