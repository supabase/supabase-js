# v3: planner-typed builders

**Since:** v3.0.0
**Applies to:** anyone calling `.or()`, `.order()`, `.limit()` or `.range()` with a `foreignTable` option

## `foreignTable` option removed

The `foreignTable` option was deprecated in favour of `referencedTable` and is now removed from `.or()`, `.order()`, `.limit()` and `.range()`. It is no longer accepted at the type level and is ignored at runtime.

Rename it:

```diff
- .order('name', { foreignTable: 'instruments', ascending: false })
+ .order('name', { referencedTable: 'instruments', ascending: false })
- .limit(1, { foreignTable: 'instruments' })
+ .limit(1, { referencedTable: 'instruments' })
```
