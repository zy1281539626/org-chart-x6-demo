import type { Graph, Node } from '@antv/x6'
import dagre from 'dagre'
import { NODE_DIMENSIONS, LAYOUT_SPACING, ZOOM } from './constants'

// 自动布局
export function layout(graph: Graph, dir = 'TB') {
  const nodes = graph.getNodes()
  const edges = graph.getEdges()
  const g = new dagre.graphlib.Graph()
  // nodesep-同一行节点间距 ranksep-行间距
  g.setGraph({ rankdir: dir, nodesep: LAYOUT_SPACING.NODE_SEPARATION, ranksep: LAYOUT_SPACING.RANK_SEPARATION })
  g.setDefaultEdgeLabel(() => ({}))

  const width = NODE_DIMENSIONS.STANDARD_WIDTH
  const height = NODE_DIMENSIONS.STANDARD_HEIGHT
  nodes.forEach((node) => {
    g.setNode(node.id, { width, height })
  })

  edges.forEach((edge) => {
    const source = edge.getSource()
    const target = edge.getTarget()
    if (
      'cell' in source &&
      'cell' in target &&
      typeof source.cell === 'string' &&
      typeof target.cell === 'string'
    ) {
      g.setEdge(source.cell, target.cell)
    }
  })

  dagre.layout(g)

  g.nodes().forEach((id) => {
    const node = graph.getCellById(id) as Node
    if (node && node.isNode()) {
      const pos = g.node(id)
      node.position(pos.x, pos.y)
    }
  })

  edges.forEach((edge) => {
    const source = edge.getSourceNode()!
    const target = edge.getTargetNode()!
    const sourceBBox = source.getBBox()
    const targetBBox = target.getBBox()

    if ((dir === 'LR' || dir === 'RL') && sourceBBox.y !== targetBBox.y) {
      const gap =
        dir === 'LR'
          ? targetBBox.x - sourceBBox.x - sourceBBox.width
          : -sourceBBox.x + targetBBox.x + targetBBox.width
      const fix = dir === 'LR' ? sourceBBox.width : 0
      const x = sourceBBox.x + fix + gap / 2
      edge.setVertices([
        { x, y: sourceBBox.center.y },
        { x, y: targetBBox.center.y },
      ])
    } else if ((dir === 'TB' || dir === 'BT') && sourceBBox.x !== targetBBox.x) {
      const gap =
        dir === 'TB'
          ? targetBBox.y - sourceBBox.y - sourceBBox.height
          : -sourceBBox.y + targetBBox.y + targetBBox.height
      const fix = dir === 'TB' ? sourceBBox.height : 0
      const y = sourceBBox.y + fix + gap / 2
      edge.setVertices([
        { x: sourceBBox.center.x, y },
        { x: targetBBox.center.x, y },
      ])
    } else {
      edge.setVertices([])
    }
  })
}

// 重新布局
export function reLayout(graph: Graph, isZoom = false) {
  layout(graph)
  if (isZoom) {
    graph.zoomTo(ZOOM.DEFAULT_SCALE)
  }
  graph.centerContent()
}

/**
 * 检测节点相交的方法 - 返回相交面积最大的节点
 */
export function checkNodeIntersections(
  graph: Graph,
  targetNode: Node,
  excludeNode?: Node,
): {
  node: Node
  position: { x: number; y: number }
  overlap: number
  overlapCenter: { x: number; y: number }
} | null {
  const targetBBox = targetNode.getBBox()
  let maxIntersection: {
    node: Node
    position: { x: number; y: number }
    overlap: number
    overlapCenter: { x: number; y: number }
  } | null = null

  // 获取所有其他节点
  const allNodes = graph.getNodes().filter(
    (node) =>
      node.id !== targetNode.id &&
      (!excludeNode || node.id !== excludeNode.id) &&
      !node.id.startsWith('ghost-'), // 排除幽灵节点
  )

  allNodes.forEach((node) => {
    const nodeBBox = node.getBBox()

    // 检测两个矩形是否相交
    const isIntersecting = !(
      targetBBox.x + targetBBox.width < nodeBBox.x || // target在node左边
      nodeBBox.x + nodeBBox.width < targetBBox.x || // target在node右边
      targetBBox.y + targetBBox.height < nodeBBox.y || // target在node上边
      nodeBBox.y + nodeBBox.height < targetBBox.y // target在node下边
    )

    if (isIntersecting) {
      // 计算重叠区域的边界
      const overlapLeft = Math.max(targetBBox.x, nodeBBox.x)
      const overlapRight = Math.min(targetBBox.x + targetBBox.width, nodeBBox.x + nodeBBox.width)
      const overlapTop = Math.max(targetBBox.y, nodeBBox.y)
      const overlapBottom = Math.min(
        targetBBox.y + targetBBox.height,
        nodeBBox.y + nodeBBox.height,
      )

      // 计算重叠面积
      const overlapX = overlapRight - overlapLeft
      const overlapY = overlapBottom - overlapTop
      const overlapArea = overlapX * overlapY

      // 计算重叠区域的中心点
      const overlapCenterX = overlapLeft + overlapX / 2
      const overlapCenterY = overlapTop + overlapY / 2

      // 如果是第一个相交节点，或者重叠面积更大，则更新最大相交节点
      if (!maxIntersection || overlapArea > maxIntersection.overlap) {
        maxIntersection = {
          node,
          position: node.getPosition(),
          overlap: overlapArea,
          overlapCenter: { x: overlapCenterX, y: overlapCenterY },
        }
      }
    }
  })

  return maxIntersection
}

/**
 * 计算象限
 */
export function calculateQuadrant(overlapCenter: { x: number; y: number }, nodeCenter: { x: number; y: number }): string {
  const deltaX = overlapCenter.x - nodeCenter.x
  const deltaY = overlapCenter.y - nodeCenter.y

  if (deltaX > 0 && deltaY < 0) {
    return '第一象限 (右上)'
  } else if (deltaX < 0 && deltaY < 0) {
    return '第二象限 (左上)'
  } else if (deltaX < 0 && deltaY > 0) {
    return '第三象限 (左下)'
  } else if (deltaX > 0 && deltaY > 0) {
    return '第四象限 (右下)'
  } else if (deltaX === 0 && deltaY < 0) {
    return '正上方'
  } else if (deltaX === 0 && deltaY > 0) {
    return '正下方'
  } else if (deltaX < 0 && deltaY === 0) {
    return '正左方'
  } else if (deltaX > 0 && deltaY === 0) {
    return '正右方'
  } else {
    return '重合 (中心点)'
  }
}
