---
description: Careful and thorough change review
---

## Diff to review

!`git diff --cached 2>/dev/null || git diff 2>/dev/null || git diff main..HEAD 2>/dev/null || git diff master..HEAD 2>/dev/null`

## Review process

ultrathink

Review the diff above carefully:

1. **Understand the intent** — First, try to understand what the change is about. What its underlying goal really is.
2. **Evaluate the approach** — Think about how the change achieves this goal, and what are the clear benefits and improvements of it.
3. **Spot potential issues** — Think about potential issues or pitfalls with this change. (Don't bother about backwards-compatibility though.)
4. **Check for gaps** — Is there something obvious that the change might be missing?
5. **Suggest improvements** — What are potential improvements we could make to this change?
6. **Simplify the design** — See whether we could make simplifications on the high-level design side of things.
7. **Simplify the implementation** — Finally, try to see if there are simplifications we can make on the implementation.