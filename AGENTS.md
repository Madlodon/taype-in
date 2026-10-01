<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# AGENTS.md

Rules to follow in this repository.

## Git / Commits

- Branch names and commit messages are written **in English**.
- Make **several small commits**: one commit per logical change.
- Commit messages are **short** and describe **what the change does**.
  - Examples: `Add email validation`, `Fix total calculation`, `Rename UserService to AccountService`
  - Avoid: vague messages (`fix`, `update`, `wip`) or explanatory paragraphs.
- **Never `push`.** Commits stay local, I push them myself.
- **Forbidden**: `git rebase`, `git restore`, `git checkout`.
  - To change branches: `git switch`.
  - To create a branch: `git switch -c`.
- Do not rewrite history (`amend`, `reset --hard`, `push --force`).
- Only commit the files related to the current change (no blind `git add .`).
- When a branch is ready to be pushed, write a PR description in the conversation **in English**, **short and simple**, ready to copy: a title, a few bullet points on what it changes, and `Closes #<issue number>` to close the issue automatically.

## Kanban (GitHub Projects)

Board: https://github.com/users/Madlodon/projects/5. Move the issue on the board:

- When starting work on an issue: **In progress**.
- When the branch is ready to be pushed: **In review**.
- **Done** happens automatically when the PR is merged and closes the issue.

```bash
ITEM=$(gh project item-list 5 --owner Madlodon --limit 500 --format json --jq '.items[] | select(.content.number==<number>) | .id')
gh project item-edit --project-id PVT_kwHOC8NMCM4BlBXl --id "$ITEM" --field-id PVTSSF_lAHOC8NMCM4BlBXlzhjvya0 --single-select-option-id <option>
```

Options: In progress = `4d524fb1`, In review = `ede8d74f`.

## How to code

- **Simple**: the most direct solution that works. No anticipatory abstraction.
- **Only build the requested feature.** No extras, no unrequested refactors, no files created "just in case".
- **When in doubt, ask before coding.** A question now costs less than bad code.
- Follow the conventions already in the project (style, naming, structure).
- Do not add a dependency without asking.

## Tests

- Every feature comes with tests suited to what it does.
- Test the expected behavior and important edge cases, not implementation details.
- Tests must pass before committing.
- Do not delete or disable a failing test to make the suite pass: report it.
