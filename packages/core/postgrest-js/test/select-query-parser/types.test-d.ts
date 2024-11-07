import { expectType } from 'tsd'
import { TypeEqual } from 'ts-expect'
import { DeduplicateRelationships } from '../../src/select-query-parser/utils'
// Deduplicate exact sames relationships
{
  type rels = [
    {
      foreignKeyName: 'test_fkey'
      columns: ['project_id']
      referencedRelation: 'project_subscriptions'
      referencedColumns: ['project_id']
    },
    {
      foreignKeyName: 'test_fkey'
      columns: ['project_id']
      referencedRelation: 'projects'
      referencedColumns: ['id']
    },
    {
      foreignKeyName: 'test_fkey'
      columns: ['project_id']
      referencedRelation: 'projects'
      referencedColumns: ['id']
    },
    {
      foreignKeyName: 'test_fkey'
      columns: ['project_id']
      referencedRelation: 'sls_physical_backups_monitoring'
      referencedColumns: ['project_id']
    }
  ]
  type expected = [
    {
      foreignKeyName: 'test_fkey'
      columns: ['project_id']
      referencedRelation: 'project_subscriptions'
      referencedColumns: ['project_id']
    },
    {
      foreignKeyName: 'test_fkey'
      columns: ['project_id']
      referencedRelation: 'projects'
      referencedColumns: ['id']
    },
    {
      foreignKeyName: 'test_fkey'
      columns: ['project_id']
      referencedRelation: 'sls_physical_backups_monitoring'
      referencedColumns: ['project_id']
    }
  ]

  type result = DeduplicateRelationships<rels>
  expectType<TypeEqual<result, expected>>(true)
}
