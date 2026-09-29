---
name: unit-tests
description: Write, review, or complete unit tests for existing code — covering happy paths, failure paths, and edge cases (empty, null, min/max, boundaries, negative values, invalid characters, dependency/DB errors) with one precise assertion goal per test and Should_X_When_Y naming. Use this skill whenever the user asks for tests, unit tests, test coverage, "test this class/function/service", "add tests for", missing edge cases, or wants existing tests reviewed or extended — even if they don't say the words "unit test".
---

# Unit tests

Write tests that would actually catch a regression, in the style the project already uses, without touching the production code.

## Step 1 — Inspect the existing tests before writing anything

Never guess the stack. Look at the repository first and mirror what is already there:

- **Test framework** (xUnit, NUnit, MSTest, Jest, Vitest, pytest, unittest, JUnit, Go testing, RSpec…). Check the project/dependency file (`*.csproj`, `package.json`, `pyproject.toml`, `pom.xml`, `build.gradle`, `go.mod`, `Gemfile`) *and* an actual existing test file — the dependency list can contain leftovers that nobody uses.
- **Naming convention** already in use for test methods and test files.
- **Assertion style** (`Assert.Equal`, `expect().toBe`, `should`, FluentAssertions, `assert x == y`…). Do not introduce a second assertion library.
- **Mocking framework** (Moq, NSubstitute, jest.mock, unittest.mock, Mockito, gomock…).
- **Test organization**: where test files live, folder mirroring, one test class per production class or per behaviour.
- **Fixtures / builders / test data helpers** that already exist — reuse them instead of rebuilding object graphs by hand.
- **Setup/teardown patterns** (constructor, `beforeEach`, `SetUp`, fixtures, `IClassFixture`, `conftest.py`).

If the project has **no tests at all**, say so explicitly, propose the framework that matches the ecosystem and the existing dependencies, and get agreement before adding a new dependency.

If the existing convention conflicts with the guidance below (for example the project already uses `MethodName_Scenario_ExpectedResult`), **follow the project**. Consistency beats this document; mention the difference once instead of silently switching styles.

## Step 2 — Read the code under test and list the cases

Before writing a single test, enumerate what the unit actually does: its parameters, its branches, its guard clauses, its thrown exceptions, its external calls.

Then pick cases from this checklist — **only the ones that are reachable and meaningful for this specific unit**:

| Category | Ask |
| --- | --- |
| Nominal case(s) | What is the normal, expected use that must work? |
| Failure case(s) | What input makes it legitimately return false / throw / return an error? |
| Empty value | Empty string, empty list, empty collection — is it distinct from null here? |
| Null value | Is null even possible? (non-nullable types, guaranteed non-null callers → skip) |
| Minimum | Lowest accepted value, and the value just below it |
| Maximum | Highest accepted value, and the value just above it |
| Boundary ±1 | The exact threshold: `18` vs `17` vs `19` — the off-by-one is where bugs live |
| Positive / negative | Only where sign changes behaviour (amounts, offsets, quantities) |
| Invalid characters | Only where the input is parsed or validated (emails, IDs, phone numbers, formats) |
| Dependency / DB error | The repository throws, the HTTP call fails, the transaction rolls back — what does the unit do? |

A category that does not apply is not a gap. A method taking a non-nullable enum has no null case, and a pure arithmetic helper has no DB-error case. Skip it silently rather than writing a test that asserts nothing real.

**Do not write tests just to raise coverage.** No tests for auto-properties, plain getters/setters, DTO constructors, pass-through wrappers with no logic, or the framework's own behaviour. If a test cannot fail for a reason that matters, it is noise: it slows the suite and gives false confidence.

## Step 3 — Write the tests

### One test, one precise case

Each test verifies exactly one behaviour under one condition. If a test needs "and" in its name, or asserts two unrelated outcomes, split it. Multiple assertions are fine when they describe the *same* outcome (e.g. checking three fields of one returned object).

Prefer parameterized tests (`[Theory]`/`[InlineData]`, `test.each`, `@pytest.mark.parametrize`) when the same behaviour is checked across several values — but keep the distinct behaviours as separate tests, not as extra rows.

### Naming

Use `Should_<ExpectedResult>_When_<Condition>` unless the project uses something else:

```
Should_ReturnFalse_When_AgeIsBelow18
Should_ReturnTrue_When_AgeIsExactly18
Should_ThrowArgumentNullException_When_UserIsNull
Should_ReturnEmptyList_When_NoOrdersMatchTheFilter
Should_PropagateException_When_RepositoryFails
Should_RejectEmail_When_ItContainsMultipleAtSigns
```

The name must say what is expected and under what condition. `Should_Work_When_Valid` and `Test_GetUser_2` say nothing — a failing test should be diagnosable from its name alone in the CI log.

Adapt casing to the language's conventions (`should_return_false_when_age_is_below_18` in Python/Go, `should return false when age is below 18` in Jest/RSpec descriptions).

### Structure

Arrange / Act / Assert, in that order, visually separated. Keep the arrange section minimal — only the setup that matters for *this* case. If a reader cannot tell in three seconds which input drives the outcome, the test is doing too much.

### Mocks and fakes

Never hit real infrastructure: no real database, no real HTTP call, no real filesystem, no real clock, no real randomness. But use a test double only when it earns its place:

**Use a double for** external dependencies the unit calls out to — repositories, HTTP clients, message buses, time/GUID providers — especially to simulate the failure cases (dependency throws, returns nothing, times out).

**Do not use a double for** the class under test, value objects, DTOs, enums, pure functions, or simple in-memory collections. A real object is clearer and less brittle than a mock of it.

Prefer a fake or a plain stub over a strict mock when you only need the dependency to return something. Assert on the *outcome* the caller cares about, not on every internal interaction — verifying call counts on everything couples the test to the implementation and makes every refactor a red suite. Verify an interaction only when the interaction *is* the behaviour (e.g. "the email must actually be sent", "the transaction must be rolled back").

### Do not modify the production code to make a test pass

The tests describe the code as it is. If a test fails, first assume the test is wrong.

If the code turns out to be genuinely buggy, or is untestable as written (hard-coded `new`, static singletons, `DateTime.Now` inline), **stop and report it**: name the file, the line, what the test proves, and what change would be needed. Let the user decide. Never quietly loosen an assertion, add a `try/catch` around a failing call, or edit the implementation to fit the test — a test rewritten to match the bug is worse than no test.

## Step 4 — Run and verify

Writing the file is not the deliverable. Do all of this:

1. **Run the tests** with the project's own command (`dotnet test`, `npm test`, `pytest`, `mvn test`, `go test ./...`), scoped to the relevant tests first.
2. **Verify they actually executed** — check the count. Zero tests run, "no tests found", or a silently skipped file means a discovery/config problem, not a success. A green run of nothing is a failure.
3. **Verify failures are detected.** For at least one new test, temporarily change the *expected value in the test* so it should fail, confirm it goes red, then restore it. This proves the assertion is actually wired up. Never break the production code to do this check.
4. **Fix what is genuinely wrong** — the test if the test is wrong, the discovery/config if the harness is wrong. If the implementation is at fault, report it per Step 3 instead of editing it.
5. **Run the full relevant suite** when it is fast enough, to confirm nothing else regressed.
6. **Report the exact results**: the command used, the real numbers (`42 passed, 0 failed, 1 skipped`), and the verbatim message of any failure. Never write "all tests pass" without having seen the output, and never round, paraphrase, or hide a failure.

## Final report

Close with:

- The framework, mocking library and conventions detected, and the file(s) you followed.
- The list of cases covered, and — just as important — the cases you deliberately **did not** write, with the one-line reason (unreachable, not applicable, already covered).
- The exact test run output.
- Any bug or testability problem found in the production code, unfixed, with its location.
