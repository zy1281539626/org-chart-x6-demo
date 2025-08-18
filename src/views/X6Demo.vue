<template>
  <div class="x6-demo">
    <h1>X6 Dagre Layout Demo</h1>
    <div class="button-group">
      <button @click="moveDToB" class="action-button">D 移动到 B 的子节点</button>
      <button @click="moveEToABetweenBC" class="action-button">E 移动到 A 的子节点(BC中间)</button>
      <button @click="swapBCOrder" class="action-button">交换 B C 顺序</button>
      <button @click="resetNodes" class="action-button reset">重置布局</button>
    </div>
    <div>
      父节点：<input type="text" v-model="parent" /> 目标节点：<input
        type="text"
        v-model="target"
      />
      位置：<input type="text" v-model="index" />
      <button @click="onTest" class="action-button">转移Test</button>
    </div>
    <div id="container" class="canvas-container"></div>
  </div>
</template>

<script setup lang="ts">
import { Graph, Node, Edge, Dom } from '@antv/x6'
import dagre from 'dagre'
import { onMounted, ref } from 'vue'

const parent = ref()
const target = ref()
const index = ref()

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
const edges = ref<Edge[]>([])

// 存储子节点的排序信息
const childrenOrder = ref<Record<string, string[]>>({})

// Helper function to safely get edge source and target cell IDs
function getEdgeSourceId(edge: Edge): string {
  const source = edge.getSource()
  if (source && typeof source === 'object' && 'cell' in source) {
    return source.cell as string
  }
  return ''
}

function getEdgeTargetId(edge: Edge): string {
  const target = edge.getTarget()
  if (target && typeof target === 'object' && 'cell' in target) {
    return target.cell as string
  }
  return ''
}

// 获取节点的所有子树（包括自身）- 使用ID
function getSubTreeByIds(nodeId: string, edgeList: Edge[]): string[] {
  const result = [nodeId]
  const children: string[] = []

  edgeList.forEach((edge) => {
    const sourceId = getEdgeSourceId(edge)
    const targetId = getEdgeTargetId(edge)

    if (sourceId === nodeId) {
      children.push(targetId)
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
    const sourceId = getEdgeSourceId(edge)
    const targetId = getEdgeTargetId(edge)

    if (targetId === nodeId) {
      return sourceId
    }
  }
  return null
}

// 辅助方法：获取节点的直接子节点ID，按正确的顺序排序
function getChildrenIds(nodeId: string): string[] {
  const children: string[] = []

  edges.value.forEach((edge) => {
    const sourceId = getEdgeSourceId(edge)
    const targetId = getEdgeTargetId(edge)

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

// 辅助方法：移除节点与其父节点的边连接，保留子节点连接
function removeNodeEdgesByIds(nodeId: string) {
  // 只移除该节点作为目标节点的边（即与父节点的连接）
  edges.value = edges.value.filter((edge) => {
    const sourceId = getEdgeSourceId(edge)
    const targetId = getEdgeTargetId(edge)

    // 如果当前节点是目标节点，则移除这条边（断开与父节点的连接）
    if (targetId === nodeId) {
      console.log(`Removing edge from ${sourceId} to ${targetId}`)
      return false
    }

    return true
  })
}

// 获取节点文本内容的辅助函数
function getNodeText(node: Node): string {
  const textAttr = node.attr('.name/text')
  if (Array.isArray(textAttr)) {
    return textAttr.join(' ')
  }
  return String(textAttr || '')
}

// 辅助方法：根据名称查找节点
function findNodeByName(name: string): Node | null {
  return (
    nodes.value.find((node) => {
      const text = getNodeText(node)
      return text.includes(name)
    }) || null
  )
}

// 通用节点移动方法：将节点移动到新的父节点下 - 使用ID
function moveNodeToParentById(nodeId: string, newParentId: string, insertPosition?: number) {
  const node = nodes.value.find((n) => n.id === nodeId)
  const newParent = nodes.value.find((n) => n.id === newParentId)

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
    newNodeOrder.push(node)

    const nodeText = getNodeText(node)
    console.log(`Processing node ${nodeText} (${nodeId})`)

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

      console.log(
        `  Reordered children: [${reorderedChildren.join(', ')}] (inserted at ${actualInsertIndex})`,
      )

      // 更新子节点排序信息
      childrenOrder.value[newParentId] = reorderedChildren

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
      const nodeText = getNodeText(node)
      console.log(`Adding root node: ${nodeText} (${node.id})`)
      addNodeAndChildren(node.id, movedNodeId)
    }
  })

  // 添加任何遗漏的节点
  nodes.value.forEach((node) => {
    if (!visited.has(node.id)) {
      const nodeText = getNodeText(node)
      console.log(`Adding missed node: ${nodeText} (${node.id})`)
      newNodeOrder.push(node)
    }
  })

  console.log(
    'New node order:',
    newNodeOrder.map((n) => getNodeText(n)),
  )
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
  const newEdges: Edge[] = []
  const seenConnections = new Set<string>()

  edges.value.forEach((edge) => {
    const sourceId = getEdgeSourceId(edge)
    const targetId = getEdgeTargetId(edge)
    const sourceNode = nodes.value.find((n) => n.id === sourceId)
    const targetNode = nodes.value.find((n) => n.id === targetId)

    if (sourceNode && targetNode) {
      // 使用连接字符串避免重复边
      const connectionKey = `${sourceId}-${targetId}`
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

// 高级布局函数 - 精确控制子节点顺序并居中对齐
function layoutWithCustomOrder() {
  const graphNodes = graph.getNodes()
  const graphEdges = graph.getEdges()
  const g = new dagre.graphlib.Graph()
  g.setGraph({
    rankdir: dir,
    nodesep: 16,
    ranksep: 16,
    marginx: 20,
    marginy: 20,
  })
  g.setDefaultEdgeLabel(() => ({}))

  const width = 260
  const height = 90

  // 设置节点
  nodes.value.forEach((node) => {
    g.setNode(node.id, { width, height })
  })

  // 设置边
  graphEdges.forEach((edge) => {
    const sourceId = getEdgeSourceId(edge)
    const targetId = getEdgeTargetId(edge)
    if (sourceId && targetId) {
      g.setEdge(sourceId, targetId)
    }
  })

  // 运行dagre布局获取Y坐标
  dagre.layout(g)

  // 首先设置所有节点的dagre计算位置
  g.nodes().forEach((id) => {
    const node = graph.getCellById(id) as Node | null
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
    const parentNode = parentId ? (graph.getCellById(parentId) as Node | null) : null

    if (parentNode) {
      // 有父节点的情况
      if (!parentGroups[parentId!]) {
        parentGroups[parentId!] = {
          parent: parentNode,
          children: [],
        }
      }

      // 获取节点在父节点子数组中的顺序
      let order = 0
      if (childrenOrder.value[parentId!]) {
        order = childrenOrder.value[parentId!].indexOf(node.id)
        if (order === -1) order = 999 // 如果找不到，放到最后
      }

      parentGroups[parentId!].children.push({
        node: graph.getCellById(node.id) as Node,
        order,
      })
    } else {
      // 根节点保持原位置
      const graphNode = graph.getCellById(node.id) as Node
      const pos = g.node(node.id)
      graphNode.position(pos.x, pos.y)
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
      child.node.position(newX, currentPos.y)
    })
  })

  // 设置边的顶点
  graphEdges.forEach((edge) => {
    const source = edge.getSourceNode()
    const target = edge.getTargetNode()

    if (!source || !target) return

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

// 自动布局
function layout() {
  layoutWithCustomOrder()
}

function createNode(name: string): Node {
  return graph.createNode({
    shape: 'org-node',
    attrs: {
      '.name': {
        text: Dom.breakText(name, { width: 160, height: 45 }),
      },
    },
  })
}

function createEdge(source: Node, target: Node): Edge {
  return graph.createEdge({
    shape: 'org-edge',
    source: { cell: source.id },
    target: { cell: target.id },
  })
}

// 调试函数：打印当前图表状态
function debugGraphState() {
  console.log('=== Current Graph State ===')
  console.log(
    'Nodes:',
    nodes.value.map((n) => ({
      id: n.id,
      name: getNodeText(n),
    })),
  )

  console.log(
    'Edges:',
    edges.value.map((e) => ({
      source: getEdgeSourceId(e),
      target: getEdgeTargetId(e),
    })),
  )

  console.log('Hierarchy:')
  nodes.value.forEach((node) => {
    const parentId = getParentId(node.id)
    const childrenIds = getChildrenIds(node.id)
    console.log(
      `  ${getNodeText(node)} (${node.id}): parent=${parentId}, children=[${childrenIds.join(', ')}]`,
    )
  })
}

function onTest() {
  const parentId = findNodeByName(parent.value)!.id
  const targetId = findNodeByName(target.value)!.id

  moveNode(parentId, targetId, index.value)
}

// 通用节点移动方法
function moveNode(parentNodeId: string, targetNodeId: string, position: number) {
  console.log(
    `=== Moving node ${targetNodeId} to parent ${parentNodeId} at position ${position} ===`,
  )
  debugGraphState()

  moveNodeToParentById(targetNodeId, parentNodeId, position)

  graph.centerContent()

  console.log(`=== After moving node ${targetNodeId} ===`)
  debugGraphState()
}
// 将 D 移动到 B 的子节点
function moveDToB() {
  const dNode = findNodeByName('D')
  const bNode = findNodeByName('B')

  if (dNode && bNode) {
    moveNode(bNode.id, dNode.id, 0)
  }
}

// 将 E 移动到 A 的子节点，位置在 B C 中间
function moveEToABetweenBC() {
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

    moveNode(aNode.id, eNode.id, insertPosition)
  }
}

// 交换B和C的顺序
function swapBCOrder() {
  const aNode = findNodeByName('A')
  const bNode = findNodeByName('B')
  const cNode = findNodeByName('C')

  if (aNode && bNode && cNode) {
    // 获取A的子节点顺序
    const aChildrenIds = getChildrenIds(aNode.id)
    const bIndex = aChildrenIds.indexOf(bNode.id)
    const cIndex = aChildrenIds.indexOf(cNode.id)

    console.log(`Current order: B at ${bIndex}, C at ${cIndex}`)

    // 如果B在C前面，将C移到B的位置，B会自动后移
    if (bIndex < cIndex) {
      moveNode(aNode.id, cNode.id, bIndex)
    }
    // 如果C在B前面，将B移到C的位置，C会自动后移
    else if (cIndex < bIndex) {
      moveNode(aNode.id, bNode.id, cIndex)
    }
  }
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

  // 重置子节点排序信息
  childrenOrder.value = {
    [nodes.value[0].id]: [nodes.value[1].id, nodes.value[2].id], // A: [B, C]
    [nodes.value[2].id]: [nodes.value[3].id, nodes.value[4].id], // C: [D, E]
  }

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

  // 设置初始子节点排序信息
  childrenOrder.value = {
    [nodes.value[0].id]: [nodes.value[1].id, nodes.value[2].id], // A: [B, C]
    [nodes.value[2].id]: [nodes.value[3].id, nodes.value[4].id], // C: [D, E]
  }

  graph.resetCells([...nodes.value, ...edges.value])
  layout()
  graph.zoomTo(0.8)
  graph.centerContent()
})
</script>

<style scoped>
.x6-demo {
  width: 100%;
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.button-group {
  display: flex;
  gap: 10px;
  margin: 10px 0;
  flex-wrap: wrap;
  justify-content: center;
  flex-shrink: 0;
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

.canvas-container {
  flex: 1;
  width: 100%;
  background-color: #f5f5f5;
}

#container {
  width: 100%;
  height: 100%;
}
</style>
