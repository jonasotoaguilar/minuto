## Migration normalization note

- Canonical remote-history migrations are preserved through `20260326001633_add_organization_management_rpcs.sql`.
- Later local files were only removed when they were redundant formatting/comment-only duplicates of an already-kept canonical migration.
- Materially different later migrations were kept so the repo still reflects local evolution beyond the synced remote history.
