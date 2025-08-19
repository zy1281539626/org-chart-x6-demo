import type { Graph, Node } from '@antv/x6'
import type { EventHandler, SharedEventState } from './shared-state'
import { layout } from '../graph/hooks'
import { nodes, childrenOrder } from '../state'
import { getParentId, getChildrenIds } from '../node/hooks'
import { removeNodeEdgesByIds } from '../edge/hooks'

/**
 * 键盘事件处理器
 */
export class KeyboardEventHandler implements EventHandler {
  private graph!: Graph
  private state!: SharedEventState

  init(graph: Graph, state: SharedEventState): void {
    this.graph = graph
    this.state = state

    // 键盘事件监听
    document.addEventListener('keydown', this.handleKeyDown.bind(this))
  }

  cleanup(): void {
    document.removeEventListener('keydown', this.handleKeyDown.bind(this))
  }

  /**
   * 删除节点并清理相关数据
   */
  private deleteNode(node: Node): void {
    const nodeId = node.id

    // 1. 从图形界面删除节点
    this.graph.removeCell(node)

    // 2. 从 nodes.value 数组中移除节点
    const nodeIndex = nodes.value.findIndex((n) => n.id === nodeId)
    if (nodeIndex > -1) {
      nodes.value.splice(nodeIndex, 1)
    }

    // 3. 清理父节点的 childrenOrder
    const parentId = getParentId(nodeId)
    if (parentId && childrenOrder.value[parentId]) {
      const parentChildren = childrenOrder.value[parentId]
      const childIndex = parentChildren.indexOf(nodeId)
      if (childIndex > -1) {
        parentChildren.splice(childIndex, 1)
        childrenOrder.value[parentId] = [...parentChildren]
      }
    }

    // 4. 删除该节点的 childrenOrder 记录
    delete childrenOrder.value[nodeId]

    // 5. 清理相关的边连接
    removeNodeEdgesByIds(nodeId)

    // 6. 递归删除子节点
    const childrenIds = getChildrenIds(nodeId)
    childrenIds.forEach((childId) => {
      const childNode = nodes.value.find((n) => n.id === childId)
      if (childNode) {
        this.deleteNode(childNode as Node)
      }
    })
  }

  /**
   * 处理键盘按下事件
   */
  private handleKeyDown(e: KeyboardEvent): void {
    // 如果正在编辑文本，不处理删除键
    if (document.activeElement?.tagName === 'INPUT') return

    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault()
      const selectedNodes = this.graph
        .getNodes()
        .filter((node: Node) => node.getAttrByPath('.card/selected') === 'true')

      if (selectedNodes.length > 0) {
        selectedNodes.forEach((node: Node) => {
          this.deleteNode(node)
        })
        layout()
      }
    }
  }
}
