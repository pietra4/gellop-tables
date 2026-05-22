---
name: feedback-task-query
description: Quando Pietro chiede le task, filtrare solo le sue (follower=PIETRO)
metadata:
  type: feedback
---

Quando Pietro chiede "le task", "cosa ho da fare", "le mie task" ecc., filtrare sempre con `follower: { containsAny: ["PIETRO"] }` e status `neq: DONE`.

**Why:** Pietro vuole vedere solo le sue task, non quelle di tutto il team.
**How to apply:** Ogni query su find_tasks per Pietro deve includere `follower: { containsAny: ["PIETRO"] }` per default.
