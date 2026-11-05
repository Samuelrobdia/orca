import { useState } from 'react'
import { useAppStore } from '../../store'
import type {
  TerminalLayoutSnapshot,
  TerminalTab
} from '../../../../shared/workspace-layout/terminal-tab-types'
import {
  getTerminalTabActivityFlags,
  resolveTerminalTabActivityStatus,
  resolveTerminalTabProgramProgress,
  type TerminalTabActivityFlags,
  type TerminalTabActivityInput,
  type TerminalTabActivityStatus
} from './terminal-tab-activity-status'

type TerminalTabActivity = {
  activityStatus: TerminalTabActivityStatus
  /** Program-reported 0–100 from the pane driving `activityStatus`, if it reports one. */
  programProgress: number | undefined
}

/**
 * Memoized per mounted tab on its own inputs: every store write re-runs each tab's selector, and the
 * status reads only this tab's entries of the maps it is given.
 */
function createTerminalTabActivityStatusResolver(): (
  input: TerminalTabActivityInput
) => TerminalTabActivityStatus {
  let last: {
    tab: TerminalTabActivityInput['tab']
    flags: TerminalTabActivityFlags | undefined
    ptyIds: string[] | undefined
    paneTitles: Record<number, string> | undefined
    terminalLayout: TerminalLayoutSnapshot | undefined
    status: TerminalTabActivityStatus
  } | null = null
  return (input) => {
    const { tab, ptyIdsByTabId, runtimePaneTitlesByTabId, terminalLayout } = input
    const flags = getTerminalTabActivityFlags(
      input.agentStatusByPaneKey,
      input.agentStatusEpoch
    ).get(tab.id)
    const ptyIds = ptyIdsByTabId?.[tab.id]
    const paneTitles = runtimePaneTitlesByTabId?.[tab.id]
    if (
      last &&
      last.tab.id === tab.id &&
      last.tab.title === tab.title &&
      last.tab.launchAgent === tab.launchAgent &&
      last.flags === flags &&
      last.ptyIds === ptyIds &&
      last.paneTitles === paneTitles &&
      last.terminalLayout === terminalLayout
    ) {
      return last.status
    }
    const status = resolveTerminalTabActivityStatus(input)
    last = { tab, flags, ptyIds, paneTitles, terminalLayout, status }
    return status
  }
}

/** A terminal tab's status glyph and progress, as primitives so unrelated agent updates can't repaint it. */
export function useTerminalTabActivity(
  tab: Pick<TerminalTab, 'id' | 'title' | 'launchAgent'>
): TerminalTabActivity {
  // Pane bucketing is memoized per snapshot, so every mounted tab shares one pass.
  const [resolveActivityStatus] = useState(createTerminalTabActivityStatusResolver)
  const activityStatus = useAppStore((s) =>
    resolveActivityStatus({
      tab,
      agentStatusByPaneKey: s.agentStatusByPaneKey,
      agentStatusEpoch: s.agentStatusEpoch,
      runtimePaneTitlesByTabId: s.runtimePaneTitlesByTabId,
      ptyIdsByTabId: s.ptyIdsByTabId,
      terminalLayout: s.terminalLayoutsByTabId?.[tab.id]
    })
  )
  const programProgress = useAppStore((s) =>
    resolveTerminalTabProgramProgress({
      tabId: tab.id,
      status: activityStatus,
      agentStatusByPaneKey: s.agentStatusByPaneKey,
      agentStatusEpoch: s.agentStatusEpoch
    })
  )
  return { activityStatus, programProgress }
}
