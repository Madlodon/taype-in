// @vitest-environment node
import { execFileSync } from "node:child_process";
import { expect, test } from "vitest";

function runMigrate(env: NodeJS.ProcessEnv) {
  return () =>
    execFileSync("node", ["db/migrate.ts"], { env, stdio: "pipe" });
}

test("Should_SucceedTwice_When_MigrationsAreAlreadyApplied", () => {
  expect(runMigrate(process.env)).not.toThrow();
  expect(runMigrate(process.env)).not.toThrow();
});

test("Should_Fail_When_DatabaseIsUnreachable", () => {
  const env = {
    ...process.env,
    DATABASE_URL: "postgres://nobody:nothing@127.0.0.1:1/nowhere",
  };

  expect(runMigrate(env)).toThrow();
});
