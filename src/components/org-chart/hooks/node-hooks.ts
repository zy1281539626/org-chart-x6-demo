import { Dom, Edge, type Graph, type Node, type Rectangle } from '@antv/x6'
import addIcon from '../icon/icons.png'
import { calculateOrthVertices, createPreviewEdge } from './edge-hooks'
import { NODE_DIMENSIONS, Z_INDEX, OPACITY } from '../constants'

export function createNode(graph: Graph, name: string, type: number = 2) {
  return graph.createNode({
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
  })
}

// 预览节点的单例实例
let previewNodeInstance: Node | null = null

/**
 * 获取或创建预览节点实例
 */
export function getOrCreatePreviewNode(graph: Graph): Node {
  if (!previewNodeInstance || !graph.hasCell(previewNodeInstance)) {
    previewNodeInstance = graph.addNode({
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
 * 更新预览节点位置
 */
export function updatePreviewNodePosition(graph: Graph, x: number, y: number): Node {
  const node = getOrCreatePreviewNode(graph)
  node.setPosition(x, y)
  return node
}

/**
 * 移除预览节点
 */
export function removePreviewNode(graph: Graph): void {
  if (previewNodeInstance && graph.hasCell(previewNodeInstance)) {
    graph.removeNode(previewNodeInstance)
    previewNodeInstance = null
  }
}

/**
 * 创建预览节点 (保持向后兼容)
 * @deprecated 使用 updatePreviewNodePosition 替代
 */
export function createPreviewNode(graph: Graph, x: number, y: number): Node {
  return updatePreviewNodePosition(graph, x, y)
}

/**
 * 创建带阴影的幽灵节点
 */
export function createGhostNode(graph: Graph, originalNode: Node): Node {
  const currentText = (originalNode.getAttrByPath('.name/text') as string) || originalNode.id
  const originalPos = originalNode.getPosition()

  return graph.addNode({
    shape: 'ghost-node',
    x: originalPos.x,
    y: originalPos.y,
    zIndex: Z_INDEX.GHOST_NODE, // 确保在最上层
    attrs: {
      '.name': {
        text: currentText,
      },
    },
  })
}

/**
 * 检查两个节点是否为兄弟关系
 */
export function areSiblingNodes(graph: Graph, node1: Node, node2: Node): boolean {
  const node1ParentEdges = graph.getIncomingEdges(node1)
  const node2ParentEdges = graph.getIncomingEdges(node2)

  const node1Parent = node1ParentEdges?.[0]?.getSourceNode()
  const node2Parent = node2ParentEdges?.[0]?.getSourceNode()

  return !!(node1Parent && node2Parent && node1Parent.id === node2Parent.id)
}

/**
 * 检查节点是否为目标节点的子节点
 */
export function isChildOfTarget(graph: Graph, dragNode: Node, targetNode: Node): boolean {
  const dragNodeParentEdges = graph.getIncomingEdges(dragNode)
  return dragNodeParentEdges?.some((edge) => edge.getSourceNode()?.id === targetNode.id) || false
}

/**
 * 检查节点是否为目标节点的最左边子节点
 */
export function isLeftmostChild(graph: Graph, dragNode: Node, targetNode: Node): boolean {
  const outgoingEdges = graph.getOutgoingEdges(targetNode)
  if (!outgoingEdges || outgoingEdges.length === 0) return false

  const sortedChildren = outgoingEdges
    .map((edge) => edge.getTargetNode())
    .filter((node) => node !== null)
    .sort((a, b) => a!.getPosition().x - b!.getPosition().x)

  const leftmostChild = sortedChildren[0]
  return leftmostChild?.id === dragNode.id
}

/**
 * 检查节点是否为目标节点的最右边子节点
 */
export function isRightmostChild(graph: Graph, dragNode: Node, targetNode: Node): boolean {
  const outgoingEdges = graph.getOutgoingEdges(targetNode)
  if (!outgoingEdges || outgoingEdges.length === 0) return false

  const sortedChildren = outgoingEdges
    .map((edge) => edge.getTargetNode())
    .filter((node) => node !== null)
    .sort((a, b) => b!.getPosition().x - a!.getPosition().x)

  const rightmostChild = sortedChildren[0]
  return rightmostChild?.id === dragNode.id
}

/**
 * 检查兄弟关系并验证位置
 */
export function checkSiblingPosition(
  graph: Graph,
  dragNode: Node,
  targetNode: Node,
  isRight: boolean,
): boolean {
  const dragNodeParentEdges = graph.getIncomingEdges(dragNode)
  const targetNodeParentEdges = graph.getIncomingEdges(targetNode)

  const dragNodeParent = dragNodeParentEdges?.[0]?.getSourceNode()
  const targetNodeParent = targetNodeParentEdges?.[0]?.getSourceNode()

  if (dragNodeParent && targetNodeParent && dragNodeParent.id === targetNodeParent.id) {
    const dragNodeX = dragNode.getPosition().x
    const targetNodeX = targetNode.getPosition().x
    const alreadyInPosition = isRight ? dragNodeX > targetNodeX : dragNodeX < targetNodeX

    if (alreadyInPosition) {
      console.log(
        `   ⚠️ 拖拽节点已经在目标节点${isRight ? '右边' : '左边'}（兄弟关系），不需要显示预览`,
      )
      return true
    }
  }
  return false
}

/**
 * 检查父子关系并验证位置
 */
export function checkChildPosition(
  graph: Graph,
  dragNode: Node,
  targetNode: Node,
  isRight: boolean,
): boolean {
  const dragNodeParentEdges = graph.getIncomingEdges(dragNode)
  const isDragNodeChildOfTarget = dragNodeParentEdges?.some(
    (edge) => edge.getSourceNode()?.id === targetNode.id,
  )

  if (isDragNodeChildOfTarget) {
    const outgoingEdges = graph.getOutgoingEdges(targetNode)
    if (outgoingEdges && outgoingEdges.length > 0) {
      const sortedChildren = outgoingEdges
        .map((edge) => edge.getTargetNode())
        .filter((node) => node !== null)
        .sort((a, b) =>
          isRight
            ? b!.getPosition().x - a!.getPosition().x
            : a!.getPosition().x - b!.getPosition().x,
        )

      const extremeChild = sortedChildren[0]
      if (extremeChild && extremeChild.id === dragNode.id) {
        // console.log(`   ⚠️ 拖拽节点已经是最${isRight ? '右边' : '左边'}的子节点，不需要显示预览`)
        return true
      }
    }
  }
  return false
}

/**
 * 创建兄弟节点预览
 */
export function createSiblingPreview(
  graph: Graph,
  targetNode: Node,
  targetNodeBBox: Rectangle,
  spacing: number,
  isRight: boolean,
): { previewNode: Node | null; previewEdge: Edge | null } {
  let previewNode: Node | null = null
  let previewEdge: Edge | null = null

  const parentEdges = graph.getIncomingEdges(targetNode)
  if (parentEdges && parentEdges.length > 0) {
    const parentNode = parentEdges[0].getSourceNode()
    if (parentNode) {
      const previewX = isRight
        ? targetNodeBBox.x + targetNodeBBox.width + spacing
        : targetNodeBBox.x - NODE_DIMENSIONS.PREVIEW_WIDTH - spacing
      const previewY = targetNodeBBox.y

      previewNode = updatePreviewNodePosition(graph, previewX, previewY)
      const vertices = calculateOrthVertices(parentNode, previewNode)
      previewEdge = createPreviewEdge(graph, parentNode, previewNode, vertices)
    }
  }

  return { previewNode, previewEdge }
}

/**
 * 创建子节点预览
 */
export function createChildPreview(
  graph: Graph,
  targetNode: Node,
  targetNodeBBox: Rectangle,
  spacing: number,
  isRight: boolean,
): { previewNode: Node | null; previewEdge: Edge | null } {
  let previewNode: Node | null = null
  let previewEdge: Edge | null = null

  const outgoingEdges = graph.getOutgoingEdges(targetNode)
  const hasChildren = outgoingEdges ? outgoingEdges.length > 0 : false

  let previewX: number, previewY: number

  if (hasChildren) {
    const firstChild = outgoingEdges?.[0].getTargetNode()
    const childY = firstChild
      ? firstChild.getPosition().y
      : targetNodeBBox.y + targetNodeBBox.height + spacing

    previewX = isRight
      ? targetNodeBBox.x + targetNodeBBox.width + spacing
      : targetNodeBBox.x - NODE_DIMENSIONS.PREVIEW_WIDTH - spacing
    previewY = childY
  } else {
    previewX = targetNodeBBox.x + targetNodeBBox.width / 2 - NODE_DIMENSIONS.PREVIEW_HALF_WIDTH
    previewY = targetNodeBBox.y + targetNodeBBox.height + spacing
  }

  previewNode = updatePreviewNodePosition(graph, previewX, previewY)
  if (previewNode) {
    const vertices = calculateOrthVertices(targetNode, previewNode)
    previewEdge = createPreviewEdge(graph, targetNode, previewNode, vertices)
  }

  return { previewNode, previewEdge }
}
