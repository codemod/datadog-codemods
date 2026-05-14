---
'@codemod/dd-trace-js-v6-move-exp-iast-options': patch
'@codemod/dd-trace-js-v6-move-exp-appsec-options': patch
'@codemod/dd-trace-js-v6-migration-recipe': patch
---

Shorten IAST and AppSec scoped names to satisfy the Codemod registry **50-character** limit (`experimental` → `exp`). Rename directories to **`move-exp-iast-options/`** and **`move-exp-appsec-options/`**. Update the bundled migration recipe workflow sources and docs accordingly.
