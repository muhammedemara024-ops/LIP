# Owner instruction — direct-to-main delivery (PD-050), 2026-11-16

Verbatim, as pasted by the project owner into the Claude Code session:

> Change the Wanees development workflow to direct-to-main delivery.
>
> Owner authorization: I authorize normal commits and direct fast-forward pushes to main for completed, reviewed, authorized development tasks. Do not create new PRs for routine Phase delivery.
>
> 1. Inspect the current GitHub main ruleset and repository governance.
> 2. Update the delivery policy and GitHub settings to remove the mandatory PR and Claude PR Review requirements for direct pushes. Keep force pushes and branch deletion prohibited. Do not create a bypass actor or disable unrelated security controls.
> 3. Preserve independent code review, relevant tests, security checks, and task authorization gates before each push.
> 4. Handle the existing Phase 1 commit cc1a699 safely against the latest origin/main, using a separate worktree. Do not include unrelated changes or the staged .gitattributes.
> 5. Verify the final diff and test results, then commit and push to main using fast-forward only. Never force-push.
> 6. Continue the /wanees-phase workflow across all authorized, eligible tasks without stopping unnecessarily.
> 7. Record completion evidence only after the required local delivery conditions succeed.
> 8. Keep LIP_AUTOMERGE_ENABLED=false. Do not deploy or change application secrets.
>
> Use Claude Opus 5.5 High for orchestration and high-risk decisions, with the approved delegate routing for implementation.
>
> Report the new main commit SHA, tests, and any genuine blocker.

Evidence for the Claude PR Review failure cited in PD-050: GitHub Actions run 43854802214, job 133256180630 (`Claude PR Review`, failed after 35s on PR #6, 2026-11-16).
