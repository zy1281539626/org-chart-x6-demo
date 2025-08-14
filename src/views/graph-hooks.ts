import type { Graph, Node } from '@antv/x6'
import dagre from 'dagre'

// 自动布局
export function layout(graph: Graph, dir = 'TB') {
  const nodes = graph.getNodes()
  const edges = graph.getEdges()
  const g = new dagre.graphlib.Graph()
  // ranksep-行间距   nodesep-同一行节点间距
  g.setGraph({ rankdir: dir, nodesep: 16, ranksep: 50 })
  g.setDefaultEdgeLabel(() => ({}))

  const width = 200
  const height = 54
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
export function reLayout(graph: Graph) {
  layout(graph)
  graph.zoomToFit()
  graph.centerContent()
}
