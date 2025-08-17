import type { Graph, Node } from '@antv/x6'
import { createEdge } from './edge-hooks'
import { reLayout } from './graph-hooks'

/**
 * 拖拽上下文信息
 */
export interface DragContext {
  dragNode: Node
  targetNode: Node
  quadrant: 'first' | 'second' | 'third' | 'fourth' // 象限
  isRight: boolean // 是否在右侧
  isChild: boolean // 是否作为子节点
  previewPosition?: { x: number; y: number } // 预览节点的位置
}

/**
 * 组织结构更新器
 * 处理节点拖拽后的关系重组
 */
export class OrgStructureUpdater {
  private graph: Graph

  constructor(graph: Graph) {
    this.graph = graph
  }

  /**
   * 根据拖拽上下文更新组织结构
   */
  updateStructure(context: DragContext): void {
    const { dragNode, targetNode, isRight, isChild, previewPosition } = context

    if (isChild) {
      // 移动为目标节点的子节点
      this.moveAsChild(dragNode, targetNode, isRight, previewPosition)
    } else {
      // 移动为目标节点的兄弟节点
      this.moveAsSibling(dragNode, targetNode, isRight, previewPosition)
    }

    // 重新布局
    reLayout(this.graph)
  }

  /**
   * 移动节点作为目标节点的子节点
   */
  private moveAsChild(
    dragNode: Node,
    targetNode: Node,
    isRight: boolean,
    previewPosition?: { x: number; y: number },
  ): void {
    console.log(`移动 ${dragNode.id} 作为 ${targetNode.id} 的${isRight ? '右' : '左'}子节点`)

    // 1. 删除拖拽节点原有的父子关系
    this.removeParentConnections(dragNode)

    // 2. 根据预览位置智能插入
    if (previewPosition) {
      this.insertChildByPosition(targetNode, dragNode, previewPosition)
    } else {
      // 回退到原来的方法
      this.adjustChildrenOrder(targetNode, dragNode, isRight)
    }
  }

  /**
   * 移动节点作为目标节点的兄弟节点
   */
  private moveAsSibling(
    dragNode: Node,
    targetNode: Node,
    isRight: boolean,
    previewPosition?: { x: number; y: number },
  ): void {
    console.log(`移动 ${dragNode.id} 作为 ${targetNode.id} 的${isRight ? '右' : '左'}兄弟节点`)

    // 1. 获取目标节点的父节点
    const targetParentEdges = this.graph.getIncomingEdges(targetNode)
    if (!targetParentEdges || targetParentEdges.length === 0) {
      console.warn('目标节点没有父节点，无法作为兄弟节点')
      return
    }

    const parentNode = targetParentEdges[0].getSourceNode()
    if (!parentNode) {
      console.warn('无法获取父节点')
      return
    }

    // 2. 删除拖拽节点原有的父子关系
    this.removeParentConnections(dragNode)

    // 3. 根据预览位置智能插入
    if (previewPosition) {
      this.insertSiblingByPosition(parentNode, dragNode, previewPosition)
    } else {
      // 回退到原来的方法
      this.adjustSiblingsOrder(parentNode, dragNode, targetNode, isRight)
    }
  }

  /**
   * 删除节点的现有父子连接关系（只删除作为子节点的连接）
   */
  private removeParentConnections(node: Node): void {
    // 只删除作为子节点的连接（incoming edges）
    const incomingEdges = this.graph.getIncomingEdges(node)
    if (incomingEdges) {
      incomingEdges.forEach((edge) => {
        this.graph.removeCell(edge)
      })
    }
  }

  /**
   * 根据预览位置智能插入子节点（更高效的方法）
   */
  private insertChildByPosition(
    parentNode: Node,
    newChild: Node,
    previewPosition: { x: number; y: number },
  ): void {
    const existingChildren = this.getChildrenNodes(parentNode)

    if (existingChildren.length === 0) {
      // 没有现有子节点，直接创建连接
      const newEdge = createEdge(this.graph, parentNode, newChild)
      this.graph.addCell(newEdge)
      console.log(`创建新的父子连接: ${parentNode.id} -> ${newChild.id}`)
      return
    }

    // 根据预览位置确定插入位置
    let insertIndex = 0
    for (let i = 0; i < existingChildren.length; i++) {
      const childPos = existingChildren[i].getPosition()
      if (previewPosition.x < childPos.x) {
        insertIndex = i
        break
      }
      insertIndex = i + 1
    }

    console.log(
      `根据预览位置 (${previewPosition.x}, ${previewPosition.y}) 在位置 ${insertIndex} 插入子节点 ${newChild.id}`,
    )

    // 构建新的子节点数组，包含新节点
    const newChildren = [...existingChildren]
    newChildren.splice(insertIndex, 0, newChild)

    console.log('新的子节点顺序:', newChildren.map((c) => c.id))

    // 重建连接以确保dagre布局按正确顺序排列
    this.rebuildChildConnections(parentNode, newChildren)
  }

  /**
   * 根据预览位置智能插入兄弟节点（更高效的方法）
   */
  private insertSiblingByPosition(
    parentNode: Node,
    newSibling: Node,
    previewPosition: { x: number; y: number },
  ): void {
    const existingSiblings = this.getChildrenNodes(parentNode)

    if (existingSiblings.length === 0) {
      // 没有现有兄弟节点，直接创建连接
      const newEdge = createEdge(this.graph, parentNode, newSibling)
      this.graph.addCell(newEdge)
      console.log(`创建新的父子连接: ${parentNode.id} -> ${newSibling.id}`)
      return
    }

    // 根据预览位置确定插入位置
    let insertIndex = 0
    for (let i = 0; i < existingSiblings.length; i++) {
      const siblingPos = existingSiblings[i].getPosition()
      if (previewPosition.x < siblingPos.x) {
        insertIndex = i
        break
      }
      insertIndex = i + 1
    }

    console.log(
      `根据预览位置 (${previewPosition.x}, ${previewPosition.y}) 在位置 ${insertIndex} 插入兄弟节点 ${newSibling.id}`,
    )

    // 构建新的兄弟节点数组，包含新节点
    const newSiblings = [...existingSiblings]
    newSiblings.splice(insertIndex, 0, newSibling)

    console.log('新的兄弟节点顺序:', newSiblings.map((s) => s.id))

    // 重建连接以确保dagre布局按正确顺序排列
    this.rebuildChildConnections(parentNode, newSiblings)
  }

  /**
   * 重建父节点的所有子节点连接（按照新的排序）
   */
  private rebuildChildConnections(parentNode: Node, children: Node[]): void {
    // 删除父节点的所有outgoing连接
    const outgoingEdges = this.graph.getOutgoingEdges(parentNode)
    if (outgoingEdges) {
      outgoingEdges.forEach((edge) => {
        this.graph.removeCell(edge)
      })
    }

    // 按照新的顺序重新创建连接
    children.forEach((child) => {
      const newEdge = createEdge(this.graph, parentNode, child)
      this.graph.addCell(newEdge)
    })
  }

  /**
   * 调整子节点的排序（回退方法）
   */
  private adjustChildrenOrder(parentNode: Node, newChild: Node, insertRight: boolean): void {
    // 获取现有子节点（除了新添加的）
    const existingChildren = this.getChildrenNodes(parentNode).filter(
      (child) => child.id !== newChild.id,
    )

    // 按X坐标排序现有子节点
    existingChildren.sort((a, b) => a.getPosition().x - b.getPosition().x)

    // 确定插入位置
    const insertIndex = insertRight ? existingChildren.length : 0

    console.log(`子节点排序: 在位置 ${insertIndex} 插入 ${newChild.id}`)

    // 只需要创建新的父子连接
    const newEdge = createEdge(this.graph, parentNode, newChild)
    this.graph.addCell(newEdge)
  }

  /**
   * 调整兄弟节点的排序（回退方法）
   */
  private adjustSiblingsOrder(
    parentNode: Node,
    newSibling: Node,
    targetSibling: Node,
    insertRight: boolean,
  ): void {
    // 获取所有现有兄弟节点（除了新节点）
    const existingSiblings = this.getChildrenNodes(parentNode).filter(
      (sibling) => sibling.id !== newSibling.id,
    )

    // 按X坐标排序
    existingSiblings.sort((a, b) => a.getPosition().x - b.getPosition().x)

    // 获取目标兄弟节点的当前位置
    const targetIndex = existingSiblings.findIndex((sibling) => sibling.id === targetSibling.id)

    if (targetIndex === -1) {
      console.warn('无法找到目标兄弟节点')
      return
    }

    // 确定插入位置
    const insertIndex = insertRight ? targetIndex + 1 : targetIndex
    console.log('insertIndex:', insertIndex)

    console.log(
      `兄弟节点排序: 在 ${targetSibling.id} 的${insertRight ? '右边' : '左边'} 插入 ${newSibling.id}`,
    )

    // 只需要创建新的父子连接
    const newEdge = createEdge(this.graph, parentNode, newSibling)
    this.graph.addCell(newEdge)
  }

  /**
   * 获取节点的所有子节点
   */
  private getChildrenNodes(parentNode: Node): Node[] {
    const outgoingEdges = this.graph.getOutgoingEdges(parentNode)
    if (!outgoingEdges) {
      return []
    }

    return outgoingEdges
      .map((edge) => edge.getTargetNode())
      .filter((node) => node !== null) as Node[]
  }

  /**
   * 判断拖拽上下文
   */
  static createDragContext(
    dragNode: Node,
    targetNode: Node,
    deltaX: number,
    deltaY: number,
  ): DragContext | null {
    // 根据象限判断操作类型
    if (deltaX > 0 && deltaY < 0) {
      // 第一象限 (右上) - 移动到父级右边
      return {
        dragNode,
        targetNode,
        quadrant: 'first',
        isRight: true,
        isChild: false,
      }
    } else if (deltaX < 0 && deltaY < 0) {
      // 第二象限 (左上) - 移动到父级左边
      return {
        dragNode,
        targetNode,
        quadrant: 'second',
        isRight: false,
        isChild: false,
      }
    } else if (deltaX < 0 && deltaY > 0) {
      // 第三象限 (左下) - 移动到子级左边
      return {
        dragNode,
        targetNode,
        quadrant: 'third',
        isRight: false,
        isChild: true,
      }
    } else if (deltaX > 0 && deltaY > 0) {
      // 第四象限 (右下) - 移动到子级右边
      return {
        dragNode,
        targetNode,
        quadrant: 'fourth',
        isRight: true,
        isChild: true,
      }
    }

    return null
  }
}
