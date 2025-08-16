import type { Cell, Graph, Node, Edge } from '@antv/x6'
import { Z_INDEX, OPACITY } from './constants'

/**
 * 创建边线
 * @param graph
 * @param source
 * @param target
 * @returns
 */
export function createEdge(graph: Graph, source: Cell, target: Cell) {
  return graph.createEdge({
    shape: 'org-edge',
    source: { cell: source.id },
    target: { cell: target.id },
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
 * 创建预览连线
 */
export function createPreviewEdge(graph: Graph, source: Node, target: Node, vertices?: { x: number; y: number }[]): Edge {
  return graph.addEdge({
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
