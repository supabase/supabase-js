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
  it(`should throw an error for ${filter} when data type and filter are incompatible`, done => {
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
})
