# libs/common

**Not used.** In Phase 2 each service got its own copy of the small helpers it needs (token check, internal key,
about 30 lines in `src/auth.js`). A shared package outside the service folders complicates Docker builds, and the
duplicated code is tiny. Delete this folder if you prefer.
