import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { resolveToolTransport } from '../src/host/tool-mode.ts'

const names = (list: readonly string[]): ReadonlySet<string> => new Set(list)
const tools = (list: readonly string[]) => list.map((name) => ({ name }))

describe('resolveToolTransport', () => {
  it('wraps into run_code when the host advertises run_code (Code Mode)', () => {
    const d = resolveToolTransport('auto', tools(['run_code']), names(['run_code']))
    assert.equal(d.mode, 'code')
    assert.equal(d.isCodeMode, true)
    assert.equal(d.hasToolSupport, true)
  })

  it('uses native agy_tool when the mirror is registered', () => {
    const d = resolveToolTransport('auto', tools(['agy_tool', 'run_code']), names(['agy_tool', 'run_code']))
    assert.equal(d.mode, 'native')
    assert.equal(d.isCodeMode, false)
    assert.equal(d.hasToolSupport, true)
  })

  it('REGRESSION: a spawn sub-session with no declared tool list wraps into run_code', () => {
    // Previously this returned native mode, agy exposed its own tools, and every
    // call was rejected with "only run_code is callable directly".
    const d = resolveToolTransport('auto', undefined, names([]))
    assert.equal(d.mode, 'code')
    assert.equal(d.isCodeMode, true)
    assert.equal(d.hasToolSupport, true)
    assert.match(d.reason, /no tool list/)
  })

  it('wraps when the declared list is empty', () => {
    const d = resolveToolTransport('auto', [], names([]))
    assert.equal(d.mode, 'code')
  })

  it('runs tool-free when the host declared tools but neither transport', () => {
    const d = resolveToolTransport('auto', tools(['read', 'write']), names(['read', 'write']))
    assert.equal(d.mode, 'none')
    assert.equal(d.hasToolSupport, false)
    assert.equal(d.isCodeMode, false)
  })

  it('honours an explicit code override', () => {
    const d = resolveToolTransport('code', tools(['agy_tool']), names(['agy_tool']))
    assert.equal(d.mode, 'code')
  })

  it('honours an explicit native override', () => {
    const d = resolveToolTransport('native', undefined, names([]))
    assert.equal(d.mode, 'native')
    assert.equal(d.hasToolSupport, true)
  })
})
