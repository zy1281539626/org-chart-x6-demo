import type { Cell, Edge, Node } from '@antv/x6'
import { edges, graph } from '../state'
import { OPACITY, Z_INDEX } from '../constants'

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
 * 创建预览连线
 */
export function createPreviewEdge(
  source: Node,
  target: Node,
  vertices?: { x: number; y: number }[],
): Edge {
  return graph.value!.addEdge({
    shape: 'org-edge',
    source: source.id,
    target: target.id,
    router: 'orth',
    vertices: vertices || [],
    zIndex: Z_INDEX.PREVIEW_EDGE,
    attrs: {
      line: {
        stroke: '#ff9500',
        strokeWidth: 2,
        opacity: OPACITY.PREVIEW,
      },
    },
  })
}

/**
 * 计算正交路由的单转折点
 */
export function calculateOrthVertices(source: Node, target: Node): { x: number; y: number }[] {
  const sourceBBox = source.getBBox()
  const targetBBox = target.getBBox()

  // 连线起点：源节点底部中心
  const sourcePoint = {
    x: sourceBBox.x + sourceBBox.width / 2,
    y: sourceBBox.y + sourceBBox.height,
  }

  // 连线终点：目标节点顶部中心
  const targetPoint = {
    x: targetBBox.x + targetBBox.width / 2,
    y: targetBBox.y,
  }

  // 如果两个节点在垂直方向上需要转折，计算中间转折点
  if (sourcePoint.x !== targetPoint.x) {
    // 需要一个转折点：先垂直下降，再水平到目标
    const midY = sourcePoint.y + (targetPoint.y - sourcePoint.y) / 2
    return [
      {
        x: sourcePoint.x,
        y: midY,
      },
      {
        x: targetPoint.x,
        y: midY,
      },
    ]
  }

  // 如果水平对齐，不需要转折点
  return []
}

/**
 * 移除节点与其父节点的边连接，保留子节点连接
 * @param nodeId
 */
export function removeNodeEdgesByIds(nodeId: string) {
  // 只移除该节点作为目标节点的边（即与父节点的连接）
  edges.value = edges.value.filter((edge) => {
    // const sourceId = edge.getSourceCellId()
    const targetId = edge.getTargetCellId()

    // 如果当前节点是目标节点，则移除这条边（断开与父节点的连接）
    if (targetId === nodeId) {
      return false
    }

    return true
  })
}
