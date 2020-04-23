import assert from 'assert'
import { PostgrestClient } from '../../lib'

const rootUrl = 'http://localhost:3000'

var arrayFilterList = ['in', 'cs', 'cd', 'ova', 'ovr', 'sl', 'sr', 'nxr', 'nxl', 'adj']
var dataTypeList = ['cs', 'cd', 'ova', 'ovr', 'sl', 'sr', 'nxr', 'nxl', 'adj']
var rangeFilterList = ['ovr', 'sl', 'sr', 'nxr', 'nxl', 'adj']

var arrayFilterCheck = (filter) => {
  it(`should not accept non-array data type for ${filter}`, async () => {
    let client = new PostgrestClient(rootUrl)
    let res = await client.from('users').select('*').filter('username', filter, 'non-array')

    assert.equal(
      `.${filter}() cannot be invoked with criteria that is not an Array.`,
      res.statusText
    )
  })
}

var dataTypeCheck = (filter) => {
  it(`should throw an error for ${filter} when data type and filter are incompatible`, (done) => {
    const client = new PostgrestClient(rootUrl)
    const res = client.from('users').select('*').filter('username', filter, [1, 2])

    Promise.resolve(res).catch(() => done())
  })
}

var rangeFilterCheck = (filter) => {
  it(`should not accept an array that is not of length 2 for ${filter}`, async () => {
    let client = new PostgrestClient(rootUrl)
    let res = await client.from('users').select('*').filter('username', filter, [1, 2, 3])

    assert.equal(
      `.${filter}() can only be invoked with a criteria that is an Array of length 2.`,
      res.statusText
    )
  })
}

describe('Filters', () => {
  arrayFilterList.forEach((filter) => arrayFilterCheck(filter))
  rangeFilterList.forEach((filter) => rangeFilterCheck(filter))
  dataTypeList.forEach((filter) => dataTypeCheck(filter))
  const expectedQueryArray = [
    'name=eq.New Zealand',
    'id=gt.20',
    'id=lt.20',
    'id=gte.20',
    'id=lte.20',
    'name=like.*United*',
    'name=ilike.*United*',
    'name=is.null',
    'name=in.(China,France)',
    'name=neq.China',
    'countries=cs.{China,France}',
    'countries=cd.{China,France}',
    'allies=ov.{China,France}',
    'population_range=ov.(100,500)',
    'population_range=sl.(100,500)',
    'population_range=sr.(100,500)',
    'population_range=nxl.(100,500)',
    'population_range=nxr.(100,500)',
    'population_range=adj.(100,500)',
  ]

  it('should be able to take in filters before an actual request is made', async () => {
    const client = new PostgrestClient(rootUrl)
    const response = client
      .from('countries')
      .eq('name', 'New Zealand')
      .gt('id', 20)
      .lt('id', 20)
      .gte('id', 20)
      .lte('id', 20)
      .like('name', '%United%')
      .ilike('name', '%United%')
      .is('name', null)
      .in('name', ['China', 'France'])
      .neq('name', 'China')
      .cs('countries', ['China', 'France'])
      .cd('countries', ['China', 'France'])
      .ova('allies', ['China', 'France'])
      .ovr('population_range', [100, 500])
      .sl('population_range', [100, 500])
      .sr('population_range', [100, 500])
      .nxl('population_range', [100, 500])
      .nxr('population_range', [100, 500])
      .adj('population_range', [100, 500])
      .select('*')

    assert.deepEqual(response._query, expectedQueryArray)
  })

  it('should be able to take in filters after an actual request is made', async () => {
    const client = new PostgrestClient(rootUrl)
    const response = client
      .from('countries')
      .select('*')
      .eq('name', 'New Zealand')
      .gt('id', 20)
      .lt('id', 20)
      .gte('id', 20)
      .lte('id', 20)
      .like('name', '%United%')
      .ilike('name', '%United%')
      .is('name', null)
      .in('name', ['China', 'France'])
      .neq('name', 'China')
      .cs('countries', ['China', 'France'])
      .cd('countries', ['China', 'France'])
      .ova('allies', ['China', 'France'])
      .ovr('population_range', [100, 500])
      .sl('population_range', [100, 500])
      .sr('population_range', [100, 500])
      .nxl('population_range', [100, 500])
      .nxr('population_range', [100, 500])
      .adj('population_range', [100, 500])

    assert.deepEqual(response._query, expectedQueryArray)
  })
})
