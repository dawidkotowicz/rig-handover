---
name: plan-to-issues
description: Split this repo's plan.md into GitHub issues with gh, one per unit of work, after a human has reviewed the split. Use when a plan is ready and has no issues yet.
---

# plan-to-issues

Turns `plan.md` into GitHub issues that workers can pick up cold. Easiest with `gh`, authenticated,
in a shell this agent can run.

## Steps

1. Read `plan.md`, `AGENTS.md` and `docs/adr/`.
2. Draft the split as a table: title · plan section · scope · done when · blocked by.
   One issue per unit of work.
3. **Stop and show the table to the human.** Publish nothing until they approve it.
4. Every issue carries the shape in "Issue shape" below. Ask the human only about anything
   beyond it (more fields, labels, wording) before you publish.
5. Create each issue in dependency order, so blocked-by can cite real numbers:

   ```sh
   gh label create "plan:<plan>" 2>/dev/null   # once per plan; <plan> from plan.md's frontmatter
   gh issue create --title "<title>" --label "plan:<plan>" --body-file <tmp.md>
   ```

6. Record every issue URL from gh's output (not from memory) and reply with the list.

Closing one, with the closing comment from AGENTS.md:

```sh
gh issue close <n> -c "<closing comment>"
```

## Issue shape

Decided by the human for plan morning-digest (2026-10-29); the reviewer sorts issues by it.

- **Label:** `plan:<plan>`, the `plan:` value from `plan.md`'s frontmatter (e.g. `plan:morning-digest`).
- **Title:** what the issue delivers, short (e.g. `Digest page: GET /digest/:night`).
- **Body**, in this order, word for word in the headings:

  ```md
  Source: plan.md § <n>

  ## Scope
  <what to build, from that section only: files, rules, ADRs that apply>

  ## Done when
  <the section's "Done when", checkable>

  ## Blocked by
  <#n, or —; when an issue can start earlier than it can finish, say both:
  "#1 to start; done needs #2 (reader).">
  ```

- The first line is exactly `Source: plan.md § <n>`, where `<n>` is the plan's own section number,
  sub-letters kept (`§ 1`, `§ 2a`). No text before it.
- A step that waits on someone outside the repo (a reviewer, a human upload) is its own issue.
  Its "Done when" names that outside event, and it stays open until that event has happened,
  not when your part of the step is sent.

## No `gh`

Steps 1–4 hold either way. GitHub reachable another way (a connector, the REST API, the web UI):
the same issues, made that way. GitHub issues out of reach altogether: write them as files in
`docs/issues/`, format in ADR 0004, then commit and push.

## Don'ts

- Don't paste the whole plan into one issue, and don't keep issues only in chat.
- Don't invent sections the plan doesn't have. If the plan is unclear, ask.
