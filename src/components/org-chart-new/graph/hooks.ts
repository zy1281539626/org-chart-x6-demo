import dagre from 'dagre'
import { childrenOrder, graph, nodes } from '../state'
import { getParentId } from '../node/hooks'
import type { Node } from '@antv/x6'
import { LAYOUT_SPACING, NODE_DIMENSIONS } from '../constants'

/**
 * 初始化childrenOrder - 根据当前图中的边连接关系初始化子节点顺序
 */
export function initializeChildrenOrder() {
  // 清空现有的childrenOrder
  childrenOrder.value = {}

  // 获取所有边
  const graphEdges = graph.value?.getEdges() || []

  // 按父节点分组子节点
  const parentChildrenMap: Record<string, string[]> = {}

  graphEdges.forEach((edge) => {
    const sourceId = edge.getSourceCellId()
    const targetId = edge.getTargetCellId()

    if (sourceId && targetId) {
      if (!parentChildrenMap[sourceId]) {
        parentChildrenMap[sourceId] = []
      }
      parentChildrenMap[sourceId].push(targetId)
    }
  })

  // 对每个父节点的子节点按照nodes.value中的原始顺序排序
  Object.entries(parentChildrenMap).forEach(([parentId, children]) => {
    const sortedChildren = children.sort((a, b) => {
      const indexA = nodes.value.findIndex((node) => node.id === a)
      const indexB = nodes.value.findIndex((node) => node.id === b)
      return indexA - indexB
    })

    childrenOrder.value[parentId] = sortedChildren
  })
}

// 高级布局函数 - 精确控制子节点顺序并居中对齐
export function layout() {
  const graphEdges = graph.value?.getEdges()
  const g = new dagre.graphlib.Graph()
  g.setGraph({
    rankdir: 'TB',
    nodesep: LAYOUT_SPACING.NODE_SEPARATION,
    ranksep: LAYOUT_SPACING.RANK_SEPARATION,
  })
  g.setDefaultEdgeLabel(() => ({}))

  const width = NODE_DIMENSIONS.STANDARD_WIDTH
  const height = NODE_DIMENSIONS.STANDARD_HEIGHT

  // 设置节点
  nodes.value.forEach((node) => {
    g.setNode(node.id, { width, height })
  })

  // 设置边
  graphEdges?.forEach((edge) => {
    const sourceId = edge.getSourceCellId()
    const targetId = edge.getTargetCellId()
    if (sourceId && targetId) {
      g.setEdge(sourceId, targetId)
    }
  })

  // 运行dagre布局获取Y坐标
  dagre.layout(g)

  // 首先设置所有节点的dagre计算位置
  g.nodes().forEach((id) => {
    const node = graph.value?.getCellById(id) as Node
    if (node) {
      const pos = g.node(id)
      node.position(pos.x, pos.y)
    }
  })

  // 按父节点分组子节点并重新计算X坐标实现居中
  const parentGroups: Record<
    string,
    {
      parent: Node | null
      children: { node: Node; order: number }[]
    }
  > = {}

  // 分组节点
  nodes.value.forEach((node) => {
    const parentId = getParentId(node.id)
    const parentNode = parentId ? graph.value?.getCellById(parentId) : null

    if (parentNode) {
      // 有父节点的情况
      if (!parentGroups[parentId!]) {
        parentGroups[parentId!] = {
          parent: parentNode as Node,
          children: [],
        }
      }

      // 获取节点在父节点子数组中的顺序
      let order = 0
      if (childrenOrder.value[parentId!]) {
        order = childrenOrder.value[parentId!].indexOf(node.id)
        if (order === -1) order = 999 // 如果找不到，放到最后
      }

      const graphNode = graph.value?.getCellById(node.id) as Node
      if (graphNode) {
        parentGroups[parentId!].children.push({
          node: graphNode,
          order,
        })
      }
    } else {
      // 根节点保持原位置
      const graphNode = graph.value?.getCellById(node.id) as Node
      const pos = g.node(node.id)
      if (graphNode && pos) {
        graphNode.position(pos.x, pos.y)
      }
    }
  })

  // 为每个父节点的子节点重新计算居中位置
  Object.values(parentGroups).forEach((group) => {
    if (group.children.length === 0) return

    // 按order排序子节点
    group.children.sort((a, b) => a.order - b.order)

    const parentBBox = group.parent!.getBBox()
    const parentCenterX = parentBBox.center.x

    // 计算子节点总宽度
    const totalChildWidth = group.children.length * width + (group.children.length - 1) * 16

    // 计算起始X坐标，让子节点组整体居中于父节点
    const startX = parentCenterX - totalChildWidth / 2

    // 重新设置每个子节点的X坐标
    group.children.forEach((child, index) => {
      const newX = startX + index * (width + 16)
      const currentPos = child.node.position()
      if (currentPos) {
        child.node.position(newX, currentPos.y)
      }
    })
  })

  // 设置边的顶点
  graphEdges?.forEach((edge) => {
    const source = edge.getSourceNode()
    const target = edge.getTargetNode()

    if (!source || !target) return

    const sourceBBox = source.getBBox()
    const targetBBox = target.getBBox()

    if (sourceBBox.x !== targetBBox.x) {
      const gap = targetBBox.y - sourceBBox.y - sourceBBox.height
      const fix = sourceBBox.height
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
