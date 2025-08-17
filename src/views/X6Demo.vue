<template>
  <div class="x6-demo">
    <h1>X6 Dagre Layout Demo</h1>
    <div class="button-group">
      <button @click="moveDToB" class="action-button">D 移动到 B 的子节点</button>
      <button @click="moveEToABetweenBC" class="action-button">E 移动到 A 的子节点(BC中间)</button>
      <button @click="resetNodes" class="action-button reset">重置布局</button>
    </div>
    <div id="container" class="canvas-container"></div>
  </div>
</template>

<script setup lang="ts">
import { Graph, Cell, Node, Dom } from '@antv/x6'
import dagre from 'dagre'
import { onMounted, ref } from 'vue'

// 自定义节点
Graph.registerNode(
  'org-node',
  {
    width: 260,
    height: 88,
    markup: [
      {
        tagName: 'rect',
        attrs: {
          class: 'card',
        },
      },
      {
        tagName: 'text',
        attrs: {
          class: 'name',
        },
      },
    ],
    attrs: {
      '.card': {
        rx: 10,
        ry: 10,
        refWidth: '100%',
        refHeight: '100%',
        fill: '#5F95FF',
        stroke: '#5F95FF',
        strokeWidth: 1,
        pointerEvents: 'visiblePainted',
      },
    },
  },
  true,
)

// 自定义边
Graph.registerEdge(
  'org-edge',
  {
    zIndex: -1,
    attrs: {
      line: {
        strokeWidth: 2,
        stroke: '#A2B1C3',
        sourceMarker: null,
        targetMarker: null,
      },
    },
  },
  true,
)

// 布局方向
const dir = 'TB' // LR RL TB BT

let graph: Graph
const nodes = ref<Node[]>([])
const edges = ref<Cell[]>([])

// 获取节点的所有子树（包括自身）- 使用ID
function getSubTreeByIds(nodeId: string, edgeList: Cell[]): string[] {
  const result = [nodeId]
  const children: string[] = []
  
  edgeList.forEach((edge) => {
    const source = edge.getSource()
    const target = edge.getTarget()
    
    if (source.cell === nodeId) {
      children.push(target.cell)
    }
  })
  
  // 递归获取所有子节点
  children.forEach((childId) => {
    result.push(...getSubTreeByIds(childId, edgeList))
  })
  
  return [...new Set(result)] // 去重
}

// 辅助方法：获取节点的父节点ID
function getParentId(nodeId: string): string | null {
  for (const edge of edges.value) {
    const source = edge.getSource()
    const target = edge.getTarget()
    
    if (target.cell === nodeId) {
      return source.cell
    }
  }
  return null
}

// 辅助方法：获取节点的直接子节点ID，按节点数组顺序排序
function getChildrenIds(nodeId: string): string[] {
  const children: string[] = []
  
  edges.value.forEach((edge) => {
    const source = edge.getSource()
    const target = edge.getTarget()
    
    if (source.cell === nodeId) {
      children.push(target.cell)
    }
  })
  
  // 按照节点在 nodes.value 数组中的顺序排序子节点
  children.sort((a, b) => {
    const indexA = nodes.value.findIndex(n => n.id === a)
    const indexB = nodes.value.findIndex(n => n.id === b)
    return indexA - indexB
  })
  
  return children
}

// 辅助方法：获取节点的兄弟节点ID
function getSiblingIds(nodeId: string): string[] {
  const parentId = getParentId(nodeId)
  if (parentId === null) {
    // 根节点，返回所有根节点
    return nodes.value
      .map((node) => node.id)
      .filter((id) => getParentId(id) === null && id !== nodeId)
  }
  
  return getChildrenIds(parentId).filter((id) => id !== nodeId)
}

// 辅助方法：移除节点与其父节点的边连接，保留子节点连接
function removeNodeEdgesByIds(nodeId: string) {
  // 只移除该节点作为目标节点的边（即与父节点的连接）
  edges.value = edges.value.filter((edge) => {
    const source = edge.getSource()
    const target = edge.getTarget()
    
    // 如果当前节点是目标节点，则移除这条边（断开与父节点的连接）
    if (target.cell === nodeId) {
      console.log(`Removing edge from ${source.cell} to ${target.cell}`)
      return false
    }
    
    return true
  })
}

// 辅助方法：根据名称查找节点
function findNodeByName(name: string): Node | null {
  return nodes.value.find((node) => {
    const text = node.attr('.name/text')
    if (Array.isArray(text)) {
      return text.some((t) => t.includes(name))
    }
    return text?.includes(name)
  }) || null
}

// 通用节点移动方法：将节点移动到新的父节点下 - 使用ID
function moveNodeToParentById(nodeId: string, newParentId: string, insertPosition?: number) {
  const node = nodes.value.find(n => n.id === nodeId)
  const newParent = nodes.value.find(n => n.id === newParentId)
  
  if (!node || !newParent || nodeId === newParentId) {
    console.warn('Invalid move operation: node or parent not found, or trying to move to self')
    return
  }
  
  // 检查是否会创建循环引用（新父节点是否为当前节点的子树）
  const subtreeIds = getSubTreeByIds(nodeId, edges.value)
  if (subtreeIds.includes(newParentId)) {
    console.warn('Cannot move node: would create circular reference')
    return
  }
  
  // 检查节点是否已经是该父节点的子节点
  const currentParentId = getParentId(nodeId)
  if (currentParentId === newParentId) {
    console.log('Node is already a child of the target parent')
    // 如果只是调整位置，仍然执行重排
    if (insertPosition !== undefined) {
      rearrangeNodesWithInsertPositionById(nodeId, newParentId, insertPosition)
      rebuildGraphWithCurrentStructure()
    }
    return
  }
  
  console.log(`Moving node ${nodeId} from parent ${currentParentId} to parent ${newParentId}`)
  
  // 移除当前节点的边连接（只移除与父节点的连接，保留子节点连接）
  removeNodeEdgesByIds(nodeId)
  
  // 创建新的父子连接
  const newEdge = createEdge(newParent, node)
  edges.value.push(newEdge)
  
  console.log(`Created new edge from ${newParent.id} to ${node.id}`)
  
  // 重新排列节点数组
  if (insertPosition !== undefined) {
    rearrangeNodesWithInsertPositionById(nodeId, newParentId, insertPosition)
  } else {
    rearrangeNodesByHierarchyById()
  }
  
  // 重建图表
  rebuildGraphWithCurrentStructure()
  
  console.log('Move operation completed')
}

// 重新排列节点，支持指定插入位置 - 使用ID
function rearrangeNodesWithInsertPositionById(movedNodeId: string, newParentId: string, insertPosition: number) {
  console.log(`Rearranging nodes: moving ${movedNodeId} to parent ${newParentId} at position ${insertPosition}`)
  
  const newNodeOrder: Node[] = []
  const visited = new Set<string>()
  
  // 递归添加节点及其子节点
  function addNodeAndChildren(nodeId: string, skipNodeId?: string) {
    if (visited.has(nodeId) || nodeId === skipNodeId) return
    
    const node = nodes.value.find(n => n.id === nodeId)
    if (!node) return
    
    visited.add(nodeId)
    newNodeOrder.push(node)
    
    console.log(`Processing node ${node.attr('.name/text')} (${nodeId})`)
    
    // 获取子节点并排序
    const childrenIds = getChildrenIds(nodeId)
    console.log(`  Children: [${childrenIds.join(', ')}]`)
    
    // 如果当前节点是新父节点，需要在指定位置插入移动的节点
    if (nodeId === newParentId) {
      // 获取除了移动节点外的其他子节点
      const regularChildren = childrenIds.filter((id) => id !== movedNodeId)
      console.log(`  Regular children (excluding moved node): [${regularChildren.join(', ')}]`)
      
      // 在指定位置插入移动的节点
      const actualInsertIndex = Math.min(insertPosition, regularChildren.length)
      const reorderedChildren = [...regularChildren]
      reorderedChildren.splice(actualInsertIndex, 0, movedNodeId)
      
      console.log(`  Reordered children: [${reorderedChildren.join(', ')}] (inserted at ${actualInsertIndex})`)
      
      // 按新顺序添加子节点
      reorderedChildren.forEach((childId) => {
        console.log(`    Adding child: ${childId}`)
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
      console.log(`Adding root node: ${node.attr('.name/text')} (${node.id})`)
      addNodeAndChildren(node.id, movedNodeId)
    }
  })
  
  // 添加任何遗漏的节点
  nodes.value.forEach((node) => {
    if (!visited.has(node.id)) {
      console.log(`Adding missed node: ${node.attr('.name/text')} (${node.id})`)
      newNodeOrder.push(node)
    }
  })
  
  console.log('New node order:', newNodeOrder.map(n => n.attr('.name/text')))
  nodes.value = newNodeOrder
}

// 按层次结构重新排列节点数组 - 使用ID
function rearrangeNodesByHierarchyById() {
  const newNodeOrder: Node[] = []
  const visited = new Set<string>()
  
  // 递归添加节点及其子节点
  function addNodeAndChildren(nodeId: string) {
    if (visited.has(nodeId)) return
    
    const node = nodes.value.find(n => n.id === nodeId)
    if (!node) return
    
    visited.add(nodeId)
    newNodeOrder.push(node)
    
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
      newNodeOrder.push(node)
    }
  })
  
  nodes.value = newNodeOrder
}

// 重建图表，保持当前的层次结构
function rebuildGraphWithCurrentStructure() {
  // 清理并重新创建所有边
  const newEdges: Cell[] = []
  const seenConnections = new Set<string>()
  
  edges.value.forEach((edge) => {
    const source = edge.getSource()
    const target = edge.getTarget()
    const sourceNode = nodes.value.find((n) => n.id === source.cell)
    const targetNode = nodes.value.find((n) => n.id === target.cell)
    
    if (sourceNode && targetNode) {
      // 使用连接字符串避免重复边
      const connectionKey = `${source.cell}-${target.cell}`
      if (!seenConnections.has(connectionKey)) {
        seenConnections.add(connectionKey)
        newEdges.push(createEdge(sourceNode, targetNode))
      }
    }
  })
  
  // 清理edges数组，移除无效的边
  edges.value = newEdges
  
  // 重置图表
  graph.resetCells([...nodes.value, ...newEdges])
  layout()
}

// 自动布局
function layout() {
  const graphNodes = graph.getNodes()
  const graphEdges = graph.getEdges()
  const g = new dagre.graphlib.Graph()
  g.setGraph({ rankdir: dir, nodesep: 16, ranksep: 16 })
  g.setDefaultEdgeLabel(() => ({}))

  const width = 260
  const height = 90
  
  // 按照我们的节点数组顺序设置节点，确保布局顺序正确
  nodes.value.forEach((node, index) => {
    // 使用索引作为 rank 来保持顺序
    const parentId = getParentId(node.id)
    const rank = parentId ? index : 0 // 根节点优先级最高
    g.setNode(node.id, { width, height, rank })
  })

  graphEdges.forEach((edge) => {
    const source = edge.getSource()
    const target = edge.getTarget()
    g.setEdge(source.cell, target.cell)
  })

  dagre.layout(g)

  g.nodes().forEach((id) => {
    const node = graph.getCellById(id) as Node
    if (node) {
      const pos = g.node(id)
      node.position(pos.x, pos.y)
    }
  })

  graphEdges.forEach((edge) => {
    const source = edge.getSourceNode()!
    const target = edge.getTargetNode()!
    const sourceBBox = source.getBBox()
    const targetBBox = target.getBBox()

    if (sourceBBox.x !== targetBBox.x) {
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

function createNode(name: string) {
  return graph.createNode({
    shape: 'org-node',
    attrs: {
      '.name': {
        text: Dom.breakText(name, { width: 160, height: 45 }),
      },
    },
  })
}

function createEdge(source: Cell, target: Cell) {
  return graph.createEdge({
    shape: 'org-edge',
    source: { cell: source.id },
    target: { cell: target.id },
  })
}

// 调试函数：打印当前图表状态
function debugGraphState() {
  console.log('=== Current Graph State ===')
  console.log('Nodes:', nodes.value.map(n => ({
    id: n.id,
    name: n.attr('.name/text')
  })))
  
  console.log('Edges:', edges.value.map(e => ({
    source: e.getSource().cell,
    target: e.getTarget().cell
  })))
  
  console.log('Hierarchy:')
  nodes.value.forEach(node => {
    const parentId = getParentId(node.id)
    const childrenIds = getChildrenIds(node.id)
    console.log(`  ${node.attr('.name/text')} (${node.id}): parent=${parentId}, children=[${childrenIds.join(', ')}]`)
  })
}

// 将 D 移动到 B 的子节点
function moveDToB() {
  console.log('=== Starting moveDToB ===')
  debugGraphState()
  
  const dNode = findNodeByName('D')
  const bNode = findNodeByName('B')
  
  if (dNode && bNode) {
    moveNodeToParentById(dNode.id, bNode.id)
  }
  
  console.log('=== After moveDToB ===')
  debugGraphState()
}

// 将 E 移动到 A 的子节点，位置在 B C 中间
function moveEToABetweenBC() {
  console.log('=== Starting moveEToABetweenBC ===')
  debugGraphState()
  
  const eNode = findNodeByName('E')
  const aNode = findNodeByName('A')
  const bNode = findNodeByName('B')
  
  if (eNode && aNode && bNode) {
    // 获取 A 当前的子节点
    const aChildrenIds = getChildrenIds(aNode.id)
    const bPositionInChildren = aChildrenIds.indexOf(bNode.id)
    
    console.log(`A's children: [${aChildrenIds.join(', ')}], B position: ${bPositionInChildren}`)
    
    // E 应该插入到 B 之后的位置（即 B 和 C 之间）
    const insertPosition = bPositionInChildren + 1
    console.log(`Inserting E at position: ${insertPosition}`)
    
    moveNodeToParentById(eNode.id, aNode.id, insertPosition)
  }
  
  console.log('=== After moveEToABetweenBC ===')
  debugGraphState()
}

// 重置到初始布局
function resetNodes() {
  // 重新创建初始节点和边
  nodes.value = [
    createNode('A'),
    createNode('B'),
    createNode('C'),
    createNode('D'),
    createNode('E'),
  ]

  edges.value = [
    createEdge(nodes.value[0], nodes.value[1]),
    createEdge(nodes.value[0], nodes.value[2]),
    createEdge(nodes.value[2], nodes.value[3]),
    createEdge(nodes.value[2], nodes.value[4]),
  ]

  graph.resetCells([...nodes.value, ...edges.value])
  layout()
}

onMounted(() => {
  // 创建画布
  graph = new Graph({
    container: document.getElementById('container')!,
    interacting: false,
  })

  nodes.value = [
    createNode('A'),
    createNode('B'),
    createNode('C'),
    createNode('D'),
    createNode('E'),
  ]

  edges.value = [
    createEdge(nodes.value[0], nodes.value[1]),
    createEdge(nodes.value[0], nodes.value[2]),
    createEdge(nodes.value[2], nodes.value[3]),
    createEdge(nodes.value[2], nodes.value[4]),
  ]

  graph.resetCells([...nodes.value, ...edges.value])
  layout()
  graph.zoomTo(0.8)
  graph.centerContent()
})
</script>

<style scoped>
.button-group {
  display: flex;
  gap: 10px;
  margin: 10px 0;
  flex-wrap: wrap;
  justify-content: center;
}

.action-button {
  padding: 10px 15px;
  background-color: #5f95ff;
  color: white;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-size: 14px;
  white-space: nowrap;
  transition: background-color 0.3s ease;
}

.action-button:hover {
  background-color: #4a7acc;
}

.action-button.reset {
  background-color: #ff6b6b;
}

.action-button.reset:hover {
  background-color: #e55555;
}

#container {
  width: 100dvw;
  height: 100dvh;
  display: flex;
  flex-direction: column;
  align-items: center;
  background-color: #f5f5f5;
}
</style>
