import assert from 'assert'
import { PostgrestClient } from '../../lib'

const rootUrl = 'http://localhost:3000'

var arrayFilterList = ['in', 'cs', 'cd', 'ova', 'ovr', 'sl', 'sr', 'nxr', 'nxl', 'adj']
var dataTypeList = ['cs', 'cd', 'ova', 'ovr', 'sl', 'sr', 'nxr', 'nxl', 'adj']
var rangeFilterList = ['ovr', 'sl', 'sr', 'nxr', 'nxl', 'adj']
var fullTextSearchList = ['fts', 'plfts', 'phfts', 'wfts']

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

var fullTextSearchCheck = (filter) => {
  it(`should not accept anything else that is not an Object and does not have they key queryText for ${filter}`, async () => {
    let client = new PostgrestClient(rootUrl)
    let res = await client.from('users').select('*').filter('username', filter, [1, 2, 3])

    assert.equal(
      `.${filter}() can only be invoked with a criteria that is an Object with key queryText.`,
      res.statusText
    )
  })
}

describe('Filters', () => {
  arrayFilterList.forEach((filter) => arrayFilterCheck(filter))
  rangeFilterList.forEach((filter) => rangeFilterCheck(filter))
  dataTypeList.forEach((filter) => dataTypeCheck(filter))
  fullTextSearchList.forEach((filter) => fullTextSearchCheck(filter))

  it('should throw an error for limit() when criteria is not of type number', async () => {
    let client = new PostgrestClient(rootUrl)
    let res = await client.from('users').select('*').limit('test')

    assert.equal(`.limit() cannot be invoked with criteria that is not a number.`, res.statusText)
  })

  it('should throw an error for offset() when criteria is not of type number', async () => {
    let client = new PostgrestClient(rootUrl)
    let res = await client.from('users').select('*').offset('test')

    assert.equal(`.offset() cannot be invoked with criteria that is not a number.`, res.statusText)
  })

  it('should throw an error for range() when first parameter is not of type number', async () => {
    let client = new PostgrestClient(rootUrl)
    let res = await client.from('users').select('*').range('test')

    assert.equal(`.range() cannot be invoked with parameters that are not numbers.`, res.statusText)
  })

  it('should throw an error for range() when second parameter is not of type number and not null', async () => {
    let client = new PostgrestClient(rootUrl)
    let res = await client.from('users').select('*').range(0, 'test')

    assert.equal(`.range() cannot be invoked with parameters that are not numbers.`, res.statusText)
  })

  it('should be able to support order() if invoked beforehand', async () => {
    let client = new PostgrestClient(rootUrl)
    let { body } = await client.from('users').order('username').select('*')

    assert.equal(body[0].username, 'supabot')
    assert.equal(body[3].username, 'awailas')
  })

  it('should be able to support order() if invoked afterwards', async () => {
    let client = new PostgrestClient(rootUrl)
    let { body } = await client.from('users').select('*').order('username')

    assert.equal(body[0].username, 'supabot')
    assert.equal(body[3].username, 'awailas')
  })

  it('should be able to support order() with all parameters stated if invoked beforehand', async () => {
    let client = new PostgrestClient(rootUrl)
    let { body } = await client.from('users').order('username', true, false).select('*')

    assert.equal(body[0].username, 'awailas')
    assert.equal(body[3].username, 'supabot')
  })

  it('should be able to support order() with all parameters stated if invoked afterwards', async () => {
    let client = new PostgrestClient(rootUrl)
    let { body } = await client.from('users').select('*').order('username', true, false)

    assert.equal(body[0].username, 'awailas')
    assert.equal(body[3].username, 'supabot')
  })

  it('should be able to support limit() if invoked beforehand', async () => {
    let client = new PostgrestClient(rootUrl)
    let { body } = await client.from('users').limit(1).select('*')

    assert.equal(body.length, 1)
    assert.equal(body[0].username, 'supabot')
  })

  it('should be able to support limit() if invoked afterwards', async () => {
    let client = new PostgrestClient(rootUrl)
    let { body } = await client.from('users').select('*').limit(1)

    assert.equal(body.length, 1)
    assert.equal(body[0].username, 'supabot')
  })

  it('should be able to support offset() if invoked beforehand', async () => {
    let client = new PostgrestClient(rootUrl)
    let { body } = await client.from('users').offset(1).select('*')

    assert.equal(body.length, 3)
    assert.equal(body[0].username, 'kiwicopple')
  })

  it('should be able to support offset() if invoked afterwards', async () => {
    let client = new PostgrestClient(rootUrl)
    let { body } = await client.from('users').select('*').offset(1)

    assert.equal(body.length, 3)
    assert.equal(body[0].username, 'kiwicopple')
  })

  it('should be able to support range() if invoked beforehand', async () => {
    let client = new PostgrestClient(rootUrl)
    let { body } = await client.from('users').range(0, 2).select('*')

    assert.equal(body.length, 3)
    assert.equal(body[0].username, 'supabot')
    assert.equal(body[2].username, 'awailas')
  })

  it('should be able to support range() if invoked afterwards', async () => {
    let client = new PostgrestClient(rootUrl)
    let { body } = await client.from('users').select('*').range(0, 2)

    assert.equal(body.length, 3)
    assert.equal(body[0].username, 'supabot')
    assert.equal(body[2].username, 'awailas')
  })

  it('should be able to support order() with only first parameter stated if invoked beforehand', async () => {
    let client = new PostgrestClient(rootUrl)
    let { body } = await client.from('users').range(1).select('*')

    assert.equal(body.length, 3)
    assert.equal(body[0].username, 'kiwicopple')
    assert.equal(body[2].username, 'dragarcia')
  })

  it('should be able to support order() with only first parameter stated if invoked afterwards', async () => {
    let client = new PostgrestClient(rootUrl)
    let { body } = await client.from('users').select('*').range(1)

    assert.equal(body.length, 3)
    assert.equal(body[0].username, 'kiwicopple')
    assert.equal(body[2].username, 'dragarcia')
  })

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
    'phrase=fts(english).The Fat Cats',
    'phrase=plfts.The Fat Cats',
    'phrase=phfts(english).The Fat Cats',
    'phrase=wfts.The Fat Cats',
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
      .fts('phrase', { queryText: 'The Fat Cats', config: 'english' })
      .plfts('phrase', { queryText: 'The Fat Cats' })
      .phfts('phrase', { queryText: 'The Fat Cats', config: 'english' })
      .wfts('phrase', { queryText: 'The Fat Cats' })
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
      .fts('phrase', { queryText: 'The Fat Cats', config: 'english' })
      .plfts('phrase', { queryText: 'The Fat Cats' })
      .phfts('phrase', { queryText: 'The Fat Cats', config: 'english' })
      .wfts('phrase', { queryText: 'The Fat Cats' })
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
