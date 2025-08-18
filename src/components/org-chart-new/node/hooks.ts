import { Dom, Node, type Edge } from '@antv/x6'
import { childrenOrder, edges, graph, nodes } from '../state'
import addIcon from '../icons/add.png'
import { NODE_DIMENSIONS } from '../constants'
import { createEdge, removeNodeEdgesByIds } from '../edge/hooks'
import { layout } from '../graph/hooks'

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
 * 根据name获取node
 * @param name
 * @returns
 */
export function findNodeByName(name: string): Node | null {
  return (
    (nodes.value.find((node) => {
      let text = ''
      const textAttr = node.attr('.name/text')
      console.log(textAttr)
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

export function moveNode(parentNode: Node, targetNode: Node, position: number) {
  moveNodeToParentById(targetNode, parentNode, position)

  graph.value?.centerContent()
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
    console.log('Node is already a child of the target parent')
    // 如果只是调整位置，仍然执行重排
    if (insertPosition !== undefined) {
      rearrangeNodesWithInsertPositionById(targetNode.id, newParentNode.id, insertPosition)
      rebuildGraphWithCurrentStructure()
    }
    return
  }

  // 移除当前节点的边连接（只移除与父节点的连接，保留子节点连接）
  removeNodeEdgesByIds(targetNode.id)

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
  console.log(
    `Rearranging nodes: moving ${movedNodeId} to parent ${newParentId} at position ${insertPosition}`,
  )
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
  console.log('New node order:', newNodeOrder)
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
