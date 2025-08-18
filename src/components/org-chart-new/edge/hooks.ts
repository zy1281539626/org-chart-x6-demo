import type { Cell, Edge } from '@antv/x6'
import { edges, graph } from '../state'

/**
 * 创建边线
 * @param graph
 * @param source
 * @param target
 * @returns
 */
export function createEdge(source: Cell, target: Cell) {
  return graph.value?.createEdge({
    shape: 'org-edge',
    source: { cell: source.id },
    target: { cell: target.id },
  }) as Edge
}

/**
 * 移除节点与其父节点的边连接，保留子节点连接
 * @param nodeId
 */
export function removeNodeEdgesByIds(nodeId: string) {
  // 只移除该节点作为目标节点的边（即与父节点的连接）
  edges.value = edges.value.filter((edge) => {
    const sourceId = edge.getSourceCellId()
    const targetId = edge.getTargetCellId()

    // 如果当前节点是目标节点，则移除这条边（断开与父节点的连接）
    if (targetId === nodeId) {
      console.log(`Removing edge from ${sourceId} to ${targetId}`)
      return false
    }

    return true
  })
}
