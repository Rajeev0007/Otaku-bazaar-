// Test environment defaults. Integration tests need DATABASE_URL pointing at a disposable, migrated database.
process.env.AUTH_SECRET ??= "test-secret-test-secret-test-secret-1234";
process.env.APP_URL ??= "http://localhost:3000";
