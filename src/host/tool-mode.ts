/**
 * Tool-transport resolution between DSH and agy.
 *
 * DSH has two tool-dispatch personalities:
 *   - Code Mode: ONLY `run_code` may be called directly. Any other tool call
 *     block is rejected by the host ("only run_code is callable directly").
 *   - Mirror Mode: the host registered the `agy_tool` bridge, so agy tool steps
 *     are replayed as native `agy_tool` cards.
 *
 * agy itself always has its own native tools (run_command/read_file/...). If we
 * let agy use them under a Code Mode host, every single call dies at dispatch
 * and the sub-session looks "tool-less" even though the model can see them.
 *
 * The regression this module fixes: a spawn sub-session arrives with
 * `options.tools === undefined`. The old inline check treated "no tool list" as
 * "native tools are fine" (`hasToolSupport = options.tools === undefined`),
 * which is exactly wrong for Code Mode hosts. "No declared list" means the host
 * did not enumerate capabilities, NOT that arbitrary tool names are accepted —
 * so the safe default is the run_code wrapper.
 */

export type ToolTransportMode = 'code' | 'native' | 'none'

export interface ToolTransportDecision {
  mode: ToolTransportMode
  /** agy tool steps must be wrapped into `run_code` scripts. */
  isCodeMode: boolean
  /** The host can receive agy tool activity at all. */
  hasToolSupport: boolean
  /** Short explanation, for the one-time diagnostic log. */
  reason: string
}

const CODE_TOOL = 'run_code'
const MIRROR_TOOL = 'agy_tool'

/**
 * Decide how agy tool activity travels back to DSH.
 *
 * @param configured explicit `toolMode` from plugin config ('auto' by default)
 * @param tools the tool list DSH passed to the provider, or undefined
 * @param names the same list as a name set (precomputed by the caller)
 */
export function resolveToolTransport(
  configured: 'auto' | 'code' | 'native',
  tools: readonly { name: string }[] | undefined,
  names: ReadonlySet<string>,
): ToolTransportDecision {
  const decided = (mode: ToolTransportMode, reason: string): ToolTransportDecision => ({
    mode,
    isCodeMode: mode === 'code',
    hasToolSupport: mode !== 'none',
    reason,
  })

  if (configured === 'code') return decided('code', 'config toolMode=code')
  if (configured === 'native') return decided('native', 'config toolMode=native')

  // auto
  if (names.has(MIRROR_TOOL)) return decided('native', 'host registered the agy_tool mirror')
  if (names.has(CODE_TOOL)) return decided('code', 'host advertises run_code (Code Mode)')
  if (tools === undefined) {
    // No declared capability list: Code Mode hosts are the common case and the
    // wrapper is the only transport they accept, so wrap instead of exposing
    // agy's native tools and having every call rejected.
    return decided('code', 'host declared no tool list — wrapping into run_code')
  }
  if (tools.length === 0) return decided('code', 'host declared an empty tool list — wrapping into run_code')
  // The host declared tools but neither the mirror nor run_code: it cannot
  // receive agy tool activity at all. Keep agy tool-free instead of emitting
  // calls that are guaranteed to be rejected.
  return decided('none', 'host declared tools but no agy_tool/run_code — agy runs tool-free')
}
