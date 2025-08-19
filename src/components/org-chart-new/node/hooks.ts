import { Dom, Node, type Edge } from '@antv/x6'
import { childrenOrder, edges, graph, nodes } from '../state'
import addIcon from '../icons/add.png'
import { NODE_DIMENSIONS, OPACITY, Z_INDEX, LAYOUT_SPACING } from '../constants'
import {
  calculateOrthVertices,
  createEdge,
  createPreviewEdge,
  removeNodeEdgesByIds,
} from '../edge/hooks'
import { layout } from '../graph/hooks'

// 预览节点的单例实例
let previewNodeInstance: Node | null = null

/**
 * 创建Node
 * @param graph
 * @param name
 * @param type
 * @returns
 */
export function createNode(name: string, type: number = 2) {
  return graph.value?.createNode({
    shape: 'org-node',
    attrs: {
      '.addIcon': { xlinkHref: addIcon },
      '.card': { class: `card type-${type}` },
      '.name': {
        text: Dom.breakText(name, {
          width: NODE_DIMENSIONS.TEXT_WIDTH,
          height: NODE_DIMENSIONS.TEXT_HEIGHT,
        }),
      },
    },
  }) as Node
}

/**
 * 创建幽灵节点
 * @param originalNode
 * @returns
 */
export function createGhostNode(originalNode: Node): Node {
  const currentText = (originalNode.getAttrByPath('.name/text') as string) || originalNode.id
  const originalPos = originalNode.getPosition()

  return graph.value!.addNode({
    shape: 'ghost-node',
    x: originalPos.x,
    y: originalPos.y,
    zIndex: Z_INDEX.GHOST_NODE,
    attrs: {
      '.name': {
        text: currentText,
      },
    },
  })
}

/**
 * 创建预览节点
 * @param parentNode 父节点
 * @param index 位置
 * @returns
 */
export function createPreviewNode(parentNode: Node, index: number) {
  // 获取父节点的所有子元素
  const childrenIds = getChildrenIds(parentNode.id)
  const parentBBox = parentNode.getBBox()

  let previewX: number, previewY: number

  if (childrenIds.length === 0) {
    // 如果没有子节点，在父节点下方创建预览节点
    previewX = parentBBox.x + parentBBox.width / 2 - NODE_DIMENSIONS.PREVIEW_HALF_WIDTH
    previewY = parentBBox.y + parentBBox.height + LAYOUT_SPACING.DRAG_SPACING
  } else {
    // 查询第index位置的子节点的位置
    if (index >= childrenIds.length) {
      // 如果index超出范围，在最后一个子节点后面插入
      const lastChildId = childrenIds[childrenIds.length - 1]
      const lastChildNode = nodes.value.find((n) => n.id === lastChildId)
      if (lastChildNode) {
        const lastChildPos = lastChildNode.getPosition()
        // 新位置 y坐标与其他子节点一样，x坐标在index节点位置加上50
        previewX = lastChildPos.x + NODE_DIMENSIONS.STANDARD_WIDTH + 50
        previewY = lastChildPos.y
      } else {
        previewX = parentBBox.x + parentBBox.width / 2 - NODE_DIMENSIONS.PREVIEW_HALF_WIDTH
        previewY = parentBBox.y + parentBBox.height + LAYOUT_SPACING.DRAG_SPACING
      }
    } else {
      // 在指定index位置的子节点处插入
      const targetChildId = childrenIds[index]
      const targetChildNode = nodes.value.find((n) => n.id === targetChildId)
      if (targetChildNode) {
        const targetChildPos = targetChildNode.getPosition()
        // 新位置 y坐标与其他子节点一样，x坐标向左偏移一点防止与第index节点重合
        previewX = targetChildPos.x - 30
        previewY = targetChildPos.y
      } else {
        previewX = parentBBox.x + parentBBox.width / 2 - NODE_DIMENSIONS.PREVIEW_HALF_WIDTH
        previewY = parentBBox.y + parentBBox.height + LAYOUT_SPACING.DRAG_SPACING
      }
    }
  }

  // 添加preview节点到父节点
  const previewNode = updatePreviewNodePosition(previewX, previewY)

  // 创建预览边连接父节点和预览节点
  let previewEdge = null
  if (previewNode) {
    const vertices = calculateOrthVertices(parentNode, previewNode)
    previewEdge = createPreviewEdge(parentNode, previewNode, vertices)
  }

  return { previewNode, previewEdge }
}

/**
 * 移除预览节点
 */
export function removePreviewNode(): void {
  if (previewNodeInstance && graph.value?.hasCell(previewNodeInstance)) {
    graph.value?.removeNode(previewNodeInstance)
    previewNodeInstance = null
  }
}

/**
 * 更新预览节点位置
 */
export function updatePreviewNodePosition(x: number, y: number): Node {
  const node = getOrCreatePreviewNode()
  node.setPosition(x, y)
  return node
}

/**
 * 获取或创建预览节点实例
 */
export function getOrCreatePreviewNode(): Node {
  if (!previewNodeInstance || !graph.value!.hasCell(previewNodeInstance)) {
    previewNodeInstance = graph.value!.addNode({
      shape: 'rect',
      x: 0,
      y: 0,
      zIndex: Z_INDEX.PREVIEW_NODE,
      width: NODE_DIMENSIONS.PREVIEW_WIDTH,
      height: NODE_DIMENSIONS.PREVIEW_HEIGHT,
      attrs: {
        body: {
          fill: '#ff9500',
          stroke: '#ff6600',
          strokeWidth: 2,
          opacity: OPACITY.PREVIEW,
        },
      },
      data: {
        type: 'preview-node',
      },
    })
  }
  return previewNodeInstance
}

/**
 * 检测节点相交的方法 - 返回相交面积最大的节点
 */
export function checkNodeIntersections(
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
  const allNodes = graph.value!.getNodes().filter(
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
      const overlapBottom = Math.min(targetBBox.y + targetBBox.height, nodeBBox.y + nodeBBox.height)

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
 * 根据name获取node
 * @param name
 * @returns
 */
export function findNodeByName(name: string): Node | null {
  return (
    (nodes.value.find((node) => {
      let text = ''
      const textAttr = node.attr('.name/text')
      if (Array.isArray(textAttr)) {
        text = textAttr.join(' ')
      } else {
        text = (textAttr as string) || ''
      }

      return text.includes(name)
    }) as Node) || null
  )
}

/**
 * 获取节点所有子树（包括自身）
 * @param nodeId 节点id
 * @param edgeList
 * @returns
 */
export function getSubTreeByIds(nodeId: string, edgeList: Edge[]): string[] {
  const result = [nodeId]
  const children: string[] = []

  edgeList.forEach((edge) => {
    const sourceId = edge.getSourceCellId()
    const targetId = edge.getTargetCellId()

    if (sourceId === nodeId) {
      children.push(targetId)
    }
  })

  // 递归获取所有子节点
  children.forEach((childId) => {
    result.push(...getSubTreeByIds(childId, edgeList))
  })
  // 去重
  return [...new Set(result)]
}

/**
 * 获取父节点的ID
 * @param nodeId
 * @param edges
 * @returns
 */
export function getParentId(nodeId: string): string | null {
  for (const edge of edges.value) {
    const sourceId = edge.getSourceCellId()
    const targetId = edge.getTargetCellId()

    if (targetId === nodeId) {
      return sourceId
    }
  }
  return null
}

/**
 * 获取节点的直接子节点ID，按正确的顺序排序
 * @param nodeId
 * @param edges
 * @param nodes
 * @param childrenOrder
 * @returns
 */
export function getChildrenIds(nodeId: string): string[] {
  const children: string[] = []

  edges.value.forEach((edge) => {
    const sourceId = edge.getSourceCellId()
    const targetId = edge.getTargetCellId()

    if (sourceId === nodeId) {
      children.push(targetId)
    }
  })

  // 如果有记录的排序信息，使用该信息排序
  if (childrenOrder.value[nodeId]) {
    const orderMap = childrenOrder.value[nodeId]
    children.sort((a, b) => {
      const indexA = orderMap.indexOf(a)
      const indexB = orderMap.indexOf(b)
      // 如果找不到索引，则放到最后
      if (indexA === -1) return 1
      if (indexB === -1) return -1
      return indexA - indexB
    })
  } else {
    // 回退到按照节点在 nodes.value 数组中的顺序排序子节点
    children.sort((a, b) => {
      const indexA = nodes.value.findIndex((n) => n.id === a)
      const indexB = nodes.value.findIndex((n) => n.id === b)
      return indexA - indexB
    })
  }

  return children
}

// 移动节点
export function moveNode(parentNode: Node, targetNode: Node, position: number) {
  moveNodeToParentById(targetNode, parentNode, position)
  // graph.value?.centerContent()
}

export function moveNodeToParentById(
  targetNode: Node,
  newParentNode: Node,
  insertPosition?: number,
) {
  // const node = nodes.value.find((n) => n.id === nodeId)
  // const newParent = nodes.value.find((n) => n.id === newParentId)

  if (!targetNode || !newParentNode || targetNode.id === newParentNode.id) {
    console.warn('[moveNodeToParentById]: 节点或父节点不存在，或移动自身节点')
    return
  }

  // 检查是否会创建循环引用（新父节点是否为当前节点的子树）
  const subtreeIds = getSubTreeByIds(targetNode.id, edges.value as Edge[])
  if (subtreeIds.includes(newParentNode.id)) {
    console.warn('[moveNodeToParentById]: 不能创建循环节点')
    return
  }

  // 检查节点是否已经是该父节点的子节点
  const currentParentId = getParentId(targetNode.id)
  if (currentParentId === newParentNode.id) {
    // 如果只是调整位置，仍然执行重排
    if (insertPosition !== undefined) {
      rearrangeNodesWithInsertPositionById(targetNode.id, newParentNode.id, insertPosition)
      rebuildGraphWithCurrentStructure()
    }
    return
  }

  // 移除当前节点的边连接（只移除与父节点的连接，保留子节点连接）
  removeNodeEdgesByIds(targetNode.id)

  // 从旧父节点的childrenOrder中移除该节点
  if (currentParentId && childrenOrder.value[currentParentId]) {
    const oldParentChildren = childrenOrder.value[currentParentId]
    const nodeIndex = oldParentChildren.indexOf(targetNode.id)
    if (nodeIndex > -1) {
      oldParentChildren.splice(nodeIndex, 1)
      childrenOrder.value[currentParentId] = [...oldParentChildren]
    }
  }

  // 创建新的父子连接
  const newEdge = createEdge(newParentNode, targetNode)
  edges.value.push(newEdge)

  // 重新排列节点数组
  if (insertPosition !== undefined) {
    rearrangeNodesWithInsertPositionById(targetNode.id, newParentNode.id, insertPosition)
  } else {
    rearrangeNodesByHierarchyById()
  }

  // 重建图表
  rebuildGraphWithCurrentStructure()
}

// 重新排列节点，支持指定插入位置 - 使用ID
function rearrangeNodesWithInsertPositionById(
  movedNodeId: string,
  newParentId: string,
  insertPosition: number,
) {
  const newNodeOrder: Node[] = []
  const visited = new Set<string>()
  // 递归添加节点及其子节点
  function addNodeAndChildren(nodeId: string, skipNodeId?: string) {
    if (visited.has(nodeId) || nodeId === skipNodeId) return
    const node = nodes.value.find((n) => n.id === nodeId)
    if (!node) return
    visited.add(nodeId)
    newNodeOrder.push(node as Node)
    // 获取子节点并排序
    const childrenIds = getChildrenIds(nodeId)
    // 如果当前节点是新父节点，需要在指定位置插入移动的节点
    if (nodeId === newParentId) {
      // 获取除了移动节点外的其他子节点
      const regularChildren = childrenIds.filter((id) => id !== movedNodeId)
      // 在指定位置插入移动的节点
      const actualInsertIndex = Math.min(insertPosition, regularChildren.length)
      const reorderedChildren = [...regularChildren]
      reorderedChildren.splice(actualInsertIndex, 0, movedNodeId)
      // 更新子节点排序信息
      childrenOrder.value[newParentId] = reorderedChildren
      // 按新顺序添加子节点
      reorderedChildren.forEach((childId) => {
        addNodeAndChildren(childId)
      })
    } else {
      // 普通情况，正常添加子节点（跳过移动的节点，因为它会在新父节点下被处理）
      childrenIds.forEach((childId) => addNodeAndChildren(childId, movedNodeId))
    }
  }
  // 先添加所有根节点
  nodes.value.forEach((node) => {
    if (getParentId(node.id) === null && !visited.has(node.id)) {
      addNodeAndChildren(node.id, movedNodeId)
    }
  })
  // 添加任何遗漏的节点
  nodes.value.forEach((node) => {
    if (!visited.has(node.id)) {
      newNodeOrder.push(node as Node)
    }
  })
  nodes.value = newNodeOrder
}

// 按层次结构重新排列节点数组 - 使用ID
function rearrangeNodesByHierarchyById() {
  const newNodeOrder: Node[] = []
  const visited = new Set<string>()

  // 递归添加节点及其子节点
  function addNodeAndChildren(nodeId: string) {
    if (visited.has(nodeId)) return

    const node = nodes.value.find((n) => n.id === nodeId)
    if (!node) return

    visited.add(nodeId)
    newNodeOrder.push(node as Node)

    const childrenIds = getChildrenIds(nodeId)
    childrenIds.forEach((childId) => addNodeAndChildren(childId))
  }

  // 先添加所有根节点
  nodes.value.forEach((node) => {
    if (getParentId(node.id) === null && !visited.has(node.id)) {
      addNodeAndChildren(node.id)
    }
  })

  // 添加任何遗漏的节点
  nodes.value.forEach((node) => {
    if (!visited.has(node.id)) {
      newNodeOrder.push(node as Node)
    }
  })

  nodes.value = newNodeOrder
}

// 重建图表，保持当前的层次结构
function rebuildGraphWithCurrentStructure() {
  // 清理并重新创建所有边
  const newEdges: Edge[] = []
  const seenConnections = new Set<string>()

  edges.value.forEach((edge) => {
    const sourceId = edge.getSourceCellId()
    const targetId = edge.getTargetCellId()
    const sourceNode = nodes.value.find((n) => n.id === sourceId)
    const targetNode = nodes.value.find((n) => n.id === targetId)

    if (sourceNode && targetNode) {
      // 使用连接字符串避免重复边
      const connectionKey = `${sourceId}-${targetId}`
      if (!seenConnections.has(connectionKey)) {
        seenConnections.add(connectionKey)
        newEdges.push(createEdge(sourceNode as Node, targetNode as Node))
      }
    }
  })

  // 清理edges数组，移除无效的边
  edges.value = newEdges

  // 重置图表
  graph.value?.resetCells([...(nodes.value as Node[]), ...newEdges])
  layout()
}

// 获取节点所在父级
export function getNodeParent(node: Node) {
  const incomingEdges = graph.value?.getIncomingEdges(node)
  if (incomingEdges && incomingEdges.length > 0) {
    const parentNode = incomingEdges[0].getSourceNode()
    const parentChildren = childrenOrder.value[parentNode!.id] || []
    return {
      index: parentChildren.indexOf(node.id),
      parentNode,
      parentChildrenCount: parentChildren.length,
      parentChildrenNames: parentChildren.map((nodeId: string) => {
        return graph.value?.getCellById(nodeId)?.getAttrByPath('.name/text')
      }),
    }
  }
  return null
}

// 获取当前节点信息
export function getNodeCurrent(node: Node, dragNode: Node) {
  const outgoingEdges = graph.value?.getOutgoingEdges(node)
  if (outgoingEdges && outgoingEdges.length > 0) {
    const parentNode = node
    const parentChildren = childrenOrder.value[parentNode!.id] || []
    return {
      index: parentChildren.indexOf(dragNode.id),
      parentNode,
      parentChildrenCount: parentChildren.length,
      parentChildrenNames: parentChildren.map((nodeId: string) => {
        return graph.value?.getCellById(nodeId)?.getAttrByPath('.name/text')
      }),
    }
  } else {
    // 无子节点
    return {
      index: 0,
      parentNode: node,
      parentChildrenCount: 0,
    }
  }
}

// 检查是否是同一个父级
export function isSameParentNode(node1: Node, node2: Node) {
  const node1ParentNodeId = getNodeParent(node1)?.parentNode?.id
  const node2ParentNodeId = getNodeParent(node2)?.parentNode?.id
  return node1ParentNodeId === node2ParentNodeId
}
