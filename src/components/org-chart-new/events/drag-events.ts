import type { Graph, Node } from '@antv/x6'
import { debounce } from '../utils'
import { OPACITY, TIMING } from '../constants'
import { layout } from '../graph/hooks'
import type { EventHandler, SharedEventState, NodeIntersection } from './shared-state'
import {
  checkNodeIntersections,
  createGhostNode,
  createPreviewNode,
  getNodeCurrent,
  getNodeParent,
  isSameParentNode,
  moveNode,
  removePreviewNode,
} from '../node/hooks'

/**
 * 拖拽事件处理器
 */
export class DragEventHandler implements EventHandler {
  private graph!: Graph
  private state!: SharedEventState
  private debouncedHandleMouseMove!: (e: MouseEvent) => void
  private editHandler?: { exitEditMode: (save: boolean) => void }
  private preMoveParams?: { parentNode: Node; targetNode: Node; index: number }

  init(graph: Graph, state: SharedEventState): void {
    this.graph = graph
    this.state = state

    // 创建防抖的鼠标移动处理函数
    this.debouncedHandleMouseMove = debounce(this.handleMouseMove.bind(this), TIMING.DEBOUNCE_DELAY)

    // 绑定事件
    this.graph.on('node:mousedown', this.handleNodeMouseDown.bind(this))
    document.addEventListener('mousemove', this.debouncedHandleMouseMove)
    document.addEventListener('mouseup', this.handleMouseUp.bind(this))
  }

  /**
   * 设置编辑处理器引用（用于处理器间交互）
   */
  setEditHandler(editHandler: { exitEditMode: (save: boolean) => void }): void {
    this.editHandler = editHandler
  }

  cleanup(): void {
    document.removeEventListener('mousemove', this.debouncedHandleMouseMove)
    document.removeEventListener('mouseup', this.handleMouseUp.bind(this))
  }

  /**
   * 清理幽灵节点
   */
  private cleanupGhost(): void {
    if (this.state.ghostNode) {
      this.graph.removeNode(this.state.ghostNode)
      this.state.ghostNode = null
    }
  }

  /**
   * 清理预览节点和连线
   */
  private cleanupPreview(): void {
    removePreviewNode()
    if (this.state.previewEdge) {
      this.graph.removeEdge(this.state.previewEdge)
      this.state.previewEdge = null
    }
  }

  /**
   * 处理节点鼠标按下事件
   */
  private handleNodeMouseDown({ e, node }: { e: MouseEvent; node: Node }): void {
    if (this.state.isEditing) return

    // 立即阻止所有默认行为和事件传播
    e.stopPropagation()
    e.stopImmediatePropagation()
    e.preventDefault()

    // 立即禁用画布移动，防止画布跟随拖拽
    this.graph.disablePanning()

    // 记录客户端坐标和节点初始位置
    this.state.dragStartPos = { x: e.clientX, y: e.clientY }
    this.state.dragStartNodePos = node.getPosition()
    this.state.dragNode = node
    this.state.isDragging = false

    // 清除可能存在的点击定时器
    if (this.state.clickTimer) {
      clearTimeout(this.state.clickTimer)
      this.state.clickTimer = null
    }
  }

  /**
   * 处理鼠标移动事件 - 拖拽逻辑
   */
  private handleMouseMove(e: MouseEvent): void {
    if (
      !this.state.dragStartPos ||
      !this.state.dragStartNodePos ||
      !this.state.dragNode ||
      this.state.isEditing
    )
      return

    // 计算鼠标在客户端坐标系中的移动距离
    const clientDeltaX = e.clientX - this.state.dragStartPos.x
    const clientDeltaY = e.clientY - this.state.dragStartPos.y

    // 获取当前缩放比例
    const scale = this.graph.zoom()

    // 将客户端坐标的移动距离转换为图形坐标的移动距离
    const graphDeltaX = clientDeltaX / scale
    const graphDeltaY = clientDeltaY / scale

    // 开始拖拽
    if (!this.state.isDragging) {
      this.state.isDragging = true
      // 退出编辑模式
      if (this.editHandler) {
        this.editHandler.exitEditMode(false)
      }
      // 禁用画布移动
      this.graph.disablePanning()
      // 创建幽灵节点
      this.state.ghostNode = createGhostNode(this.state.dragNode)
      // 隐藏原节点
      this.state.dragNode.attr('.card/opacity', OPACITY.DRAGGING_NODE)
    }

    // 更新幽灵节点位置
    if (this.state.isDragging && this.state.ghostNode) {
      // 计算新的节点位置
      const newX = this.state.dragStartNodePos.x + graphDeltaX
      const newY = this.state.dragStartNodePos.y + graphDeltaY

      this.state.ghostNode.setPosition(newX, newY)

      // 检测幽灵节点与其他节点的相交情况
      const maxIntersection = checkNodeIntersections(this.state.ghostNode, this.state.dragNode)

      if (maxIntersection) {
        this.handleIntersection(maxIntersection)
      } else {
        // 没有相交节点时，清理所有预览元素
        this.cleanupPreview()
        this.preMoveParams = undefined
      }
    }
  }

  /**
   * 处理节点相交逻辑
   */
  private handleIntersection(maxIntersection: NodeIntersection): void {
    // 清理之前的预览元素
    this.cleanupPreview()

    // 拖拽节点父级信息
    const dragNodeInfo = getNodeParent(this.state.dragNode!)
    if (!dragNodeInfo?.parentNode) {
      return
    }

    // 是否是相同父级
    let isSameParent = false

    // 计算节点的中心点坐标
    const nodeBBox = maxIntersection.node.getBBox()
    const nodeCenterX = nodeBBox.x + nodeBBox.width / 2
    const nodeCenterY = nodeBBox.y + nodeBBox.height / 2

    // 计算相交区域中心点相对于节点中心点的象限
    const deltaX = maxIntersection.overlapCenter.x - nodeCenterX
    const deltaY = maxIntersection.overlapCenter.y - nodeCenterY

    // 获取目标节点的子节点数量，用于计算最后一个位置的index
    const outgoingEdges = this.graph.getOutgoingEdges(maxIntersection.node)
    const childrenCount = outgoingEdges ? outgoingEdges.length : 0

    let index = 0
    if (deltaX > 0 && deltaY < 0) {
      // 第一象限 (右上)
      const parentNodeInfo = getNodeParent(maxIntersection.node)
      if (!parentNodeInfo?.parentNode) {
        return
      }
      isSameParent = isSameParentNode(this.state.dragNode!, maxIntersection.node)

      if (parentNodeInfo?.parentChildrenCount === 0) {
        index = 0
      } else {
        if (isSameParent && parentNodeInfo?.index === dragNodeInfo?.index - 1) {
          return
        }
        index = (parentNodeInfo?.index || 0) + 1
      }

      console.log('第一象限 最终index:', index)
      this.preMoveParams = {
        parentNode: parentNodeInfo?.parentNode,
        targetNode: this.state.dragNode!,
        index,
      }
      const previewResult = createPreviewNode(parentNodeInfo?.parentNode, index)
      this.state.previewEdge = previewResult.previewEdge
    } else if (deltaX < 0 && deltaY < 0) {
      // 第二象限 (左上) - 移动到父级左边，index为当前节点在父级的位置
      // 一、二象限相交节点父级信息
      const parentNodeInfo = getNodeParent(maxIntersection.node)
      if (!parentNodeInfo?.parentNode) {
        return
      }
      isSameParent = isSameParentNode(this.state.dragNode!, maxIntersection.node)

      if (parentNodeInfo?.parentChildrenCount === 0) {
        index = 0
      } else {
        if (isSameParent && parentNodeInfo?.index === dragNodeInfo?.index + 1) {
          return
        }
        if (isSameParent) {
          index =
            dragNodeInfo.index < parentNodeInfo.index
              ? parentNodeInfo.index - 1
              : parentNodeInfo.index
        } else {
          index = parentNodeInfo.index
        }
      }

      console.log('第二象限 最终index:', index)
      this.preMoveParams = {
        parentNode: parentNodeInfo.parentNode,
        targetNode: this.state.dragNode!,
        index,
      }
      const previewResult = createPreviewNode(parentNodeInfo.parentNode, index)
      this.state.previewEdge = previewResult.previewEdge
    } else if (deltaX < 0 && deltaY > 0) {
      // 第三象限 (左下) - 移动到子级左边，index为0
      // 三、四象限相交节点父级信息
      const parentNodeInfo = getNodeCurrent(maxIntersection.node, this.state.dragNode!)
      if (!parentNodeInfo?.parentNode) {
        return
      }
      isSameParent = dragNodeInfo.parentNode.id === maxIntersection.node.id
      index = 0
      if (isSameParent && dragNodeInfo.index === 0) {
        return
      }

      this.preMoveParams = {
        parentNode: maxIntersection.node,
        targetNode: this.state.dragNode!,
        index,
      }
      console.log('第三象限 index:', index)
      const previewResult = createPreviewNode(maxIntersection.node, index)
      this.state.previewEdge = previewResult.previewEdge
    } else if (deltaX > 0 && deltaY > 0) {
      // 第四象限 (右下) - 移动到子级右边，index为当前节点的子节点个数-1
      // 三、四象限相交节点父级信息
      const parentNodeInfo = getNodeCurrent(maxIntersection.node, this.state.dragNode!)
      if (!parentNodeInfo?.parentNode) {
        return
      }
      isSameParent = dragNodeInfo.parentNode.id === maxIntersection.node.id
      index = childrenCount > 0 ? childrenCount : 0
      if (isSameParent && parentNodeInfo.parentChildrenCount === dragNodeInfo.index + 1) {
        return
      }

      console.log('第四象限 index:', index)
      this.preMoveParams = {
        parentNode: maxIntersection.node,
        targetNode: this.state.dragNode!,
        index,
      }
      const previewResult = createPreviewNode(maxIntersection.node, index)
      this.state.previewEdge = previewResult.previewEdge
    }
  }

  /**
   * 结束拖拽
   */
  private handleMouseUp(): void {
    this.graph.enablePanning()

    if (this.state.isDragging && this.state.dragNode && this.state.ghostNode) {
      // 恢复原节点显示
      this.state.dragNode.attr('.card/opacity', 1)

      if (this.preMoveParams?.parentNode && this.preMoveParams?.targetNode) {
        moveNode(
          this.preMoveParams.parentNode,
          this.preMoveParams.targetNode,
          this.preMoveParams.index,
        )
      }
      // 清理幽灵节点和预览元素
      this.cleanupGhost()
      this.cleanupPreview()
    }

    // 重置拖拽状态
    this.state.isDragging = false
    this.state.dragStartPos = null
    this.state.dragStartNodePos = null
    this.state.dragNode = null

    layout()
  }
}
