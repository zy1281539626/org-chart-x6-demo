import type { Graph, Node } from '@antv/x6'
import { debounce } from '../utils'
import { LAYOUT_SPACING, OPACITY, TIMING } from '../constants'
import { layout } from '../graph/hooks'
import type { EventHandler, SharedEventState, NodeIntersection } from './shared-state'
import {
  checkNodeIntersections,
  createChildPreview,
  createGhostNode,
  moveNode,
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
  // private orgUpdater!: OrgStructureUpdater

  // 拖拽上下文信息
  // private currentDragContext: DragContext | null = null

  init(graph: Graph, state: SharedEventState): void {
    this.graph = graph
    this.state = state

    // 创建组织结构更新器
    // this.orgUpdater = new OrgStructureUpdater(graph)

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
    // removePreviewNode(this.graph)
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

    console.log('mousedown on node:', node.id)
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
        // 没有相交节点时，清理所有预览元素和上下文
        this.cleanupPreview()
        // this.currentDragContext = null
      }
    }
  }

  /**
   * 处理节点相交逻辑
   */
  private handleIntersection(maxIntersection: NodeIntersection): void {
    // console.log(this.state.dragNode, maxIntersection.node)
    // 清理之前的预览元素
    this.cleanupPreview()

    // 计算节点的中心点坐标
    const nodeBBox = maxIntersection.node.getBBox()
    const nodeCenterX = nodeBBox.x + nodeBBox.width / 2
    const nodeCenterY = nodeBBox.y + nodeBBox.height / 2

    // 计算相交区域中心点相对于节点中心点的象限
    const deltaX = maxIntersection.overlapCenter.x - nodeCenterX
    const deltaY = maxIntersection.overlapCenter.y - nodeCenterY

    // 根据象限判断插入位置并创建预览
    const targetNodeBBox = maxIntersection.node.getBBox()
    const spacing = LAYOUT_SPACING.DRAG_SPACING

    // 获取目标节点的子节点数量，用于计算最后一个位置的index
    const outgoingEdges = this.graph.getOutgoingEdges(maxIntersection.node)
    const childrenCount = outgoingEdges ? outgoingEdges.length : 0

    let index = 0
    if (deltaX > 0 && deltaY < 0) {
      // 第一象限 (右上) - 移动到父级右边，index为当前节点在父级中的位置-1
      const incomingEdges = this.graph.getIncomingEdges(maxIntersection.node)
      if (incomingEdges && incomingEdges.length > 0) {
        const parentNode = incomingEdges[0].getSourceNode()
        const parentOutgoingEdges = this.graph.getOutgoingEdges(parentNode!)
        if (parentOutgoingEdges) {
          const currentNodeIndex = parentOutgoingEdges.findIndex(
            (edge) => edge.getTargetNode()?.id === maxIntersection.node.id,
          )
          index = currentNodeIndex >= 0 ? Math.max(0, currentNodeIndex + 1) : 0
        } else {
          index = 0
        }
        console.log('第一象限 index:', index)
        this.preMoveParams = { parentNode: parentNode!, targetNode: this.state.dragNode!, index }
      }

      // result = createChildPreview(maxIntersection.node, targetNodeBBox, spacing, index)
    } else if (deltaX < 0 && deltaY < 0) {
      // 第二象限 (左上) - 移动到父级左边，index为当前节点在父级的位置
      const incomingEdges = this.graph.getIncomingEdges(maxIntersection.node)
      if (incomingEdges && incomingEdges.length > 0) {
        const parentNode = incomingEdges[0].getSourceNode()
        const parentOutgoingEdges = this.graph.getOutgoingEdges(parentNode!)
        if (parentOutgoingEdges) {
          const currentNodeIndex = parentOutgoingEdges.findIndex(
            (edge) => edge.getTargetNode()?.id === maxIntersection.node.id,
          )
          index = currentNodeIndex >= 0 ? currentNodeIndex : 0
        } else {
          index = 0
        }
        console.log('第二象限 index:', index)
        this.preMoveParams = { parentNode: parentNode!, targetNode: this.state.dragNode!, index }
      }

      // result = createChildPreview(maxIntersection.node, targetNodeBBox, spacing, index)
    } else if (deltaX < 0 && deltaY > 0) {
      // 第三象限 (左下) - 移动到子级左边，index为0
      index = 0
      console.log('第三象限 index:', index)

      this.preMoveParams = {
        parentNode: maxIntersection.node,
        targetNode: this.state.dragNode!,
        index,
      }
      // result = createChildPreview(maxIntersection.node, targetNodeBBox, spacing, index)
    } else if (deltaX > 0 && deltaY > 0) {
      // 第四象限 (右下) - 移动到子级右边，index为当前节点的子节点个数-1
      index = childrenCount > 0 ? childrenCount : 0
      console.log('第四象限 index:', index)
      this.preMoveParams = {
        parentNode: maxIntersection.node,
        targetNode: this.state.dragNode!,
        index,
      }
      // result = createChildPreview(maxIntersection.node, targetNodeBBox, spacing, index)
    }

    // this.state.previewEdge = result.previewEdge
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
