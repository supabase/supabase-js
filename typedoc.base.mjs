// Shared TypeDoc options for all @supabase/* packages.
//
// Registers the custom block tags consumed by the supabase.com docs generator so
// TypeDoc recognizes them (no "unknown block tag" warnings) and preserves them in
// the generated spec.json.
//
// TypeDoc's `blockTags` option *replaces* the defaults rather than extending them,
// so this list is TypeDoc's default set (OptionDefaults.blockTags, v0.27.x) plus the
// custom tags at the end. We inline the defaults instead of importing
// `OptionDefaults` from 'typedoc' because this file lives at the workspace root,
// where pnpm does not link the `typedoc` package (it is only installed per-package).
// If TypeDoc is upgraded and adds new default block tags, append them here.
const DEFAULT_BLOCK_TAGS = [
  '@defaultValue',
  '@deprecated',
  '@example',
  '@param',
  '@privateRemarks',
  '@remarks',
  '@returns',
  '@see',
  '@throws',
  '@typeParam',
  '@author',
  '@callback',
  '@category',
  '@categoryDescription',
  '@default',
  '@document',
  '@extends',
  '@augments',
  '@yields',
  '@group',
  '@groupDescription',
  '@import',
  '@inheritDoc',
  '@jsx',
  '@license',
  '@module',
  '@mergeModuleWith',
  '@prop',
  '@property',
  '@return',
  '@satisfies',
  '@since',
  '@template',
  '@type',
  '@typedef',
  '@summary',
]

const CUSTOM_BLOCK_TAGS = [
  '@subcategory',
  '@exampleResponse',
  '@exampleSql',
  '@exampleDescription',
  '@reference',
]

export default {
  blockTags: [...DEFAULT_BLOCK_TAGS, ...CUSTOM_BLOCK_TAGS],
}
