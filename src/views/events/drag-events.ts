import type { Graph, Node } from '@antv/x6'
import { debounce } from '../utils'
import { LAYOUT_SPACING, OPACITY, TIMING } from '../constants'
import { layout, checkNodeIntersections } from '../graph-hooks'
import {
  createGhostNode,
  removePreviewNode,
  checkSiblingPosition,
  checkChildPosition,
  createSiblingPreview,
  createChildPreview,
} from '../node-hooks'
import { OrgStructureUpdater, type DragContext } from '../org-structure-updater'
import type { EventHandler, SharedEventState, NodeIntersection } from './shared-state'

/**
 * 拖拽事件处理器
 */
export class DragEventHandler implements EventHandler {
  private graph!: Graph
  private state!: SharedEventState
  private debouncedHandleMouseMove!: (e: MouseEvent) => void
  private editHandler?: { exitEditMode: (save: boolean) => void }
  private orgUpdater!: OrgStructureUpdater

  // 拖拽上下文信息
  private currentDragContext: DragContext | null = null

  init(graph: Graph, state: SharedEventState): void {
    this.graph = graph
    this.state = state

    // 创建组织结构更新器
    this.orgUpdater = new OrgStructureUpdater(graph)

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
    removePreviewNode(this.graph)
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
      this.state.ghostNode = createGhostNode(this.graph, this.state.dragNode)
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
      const maxIntersection = checkNodeIntersections(
        this.graph,
        this.state.ghostNode,
        this.state.dragNode,
      )

      if (maxIntersection) {
        this.handleIntersection(maxIntersection)
      } else {
        // 没有相交节点时，清理所有预览元素和上下文
        this.cleanupPreview()
        this.currentDragContext = null
      }
    }
  }

  /**
   * 处理节点相交逻辑
   */
  private handleIntersection(maxIntersection: NodeIntersection): void {
    // 计算节点的中心点坐标
    const nodeBBox = maxIntersection.node.getBBox()
    const nodeCenterX = nodeBBox.x + nodeBBox.width / 2
    const nodeCenterY = nodeBBox.y + nodeBBox.height / 2

    // 计算相交区域中心点相对于节点中心点的象限
    const deltaX = maxIntersection.overlapCenter.x - nodeCenterX
    const deltaY = maxIntersection.overlapCenter.y - nodeCenterY

    // 创建拖拽上下文
    this.currentDragContext = OrgStructureUpdater.createDragContext(
      this.state.dragNode!,
      maxIntersection.node,
      deltaX,
      deltaY,
    )

    // 清理之前的预览元素
    this.cleanupPreview()

    // 根据象限判断插入位置并创建预览
    const targetNodeBBox = maxIntersection.node.getBBox()
    const spacing = LAYOUT_SPACING.DRAG_SPACING

    if (deltaX > 0 && deltaY < 0) {
      // 第一象限 (右上) - 移动到父级右边
      if (!checkSiblingPosition(this.graph, this.state.dragNode!, maxIntersection.node, true)) {
        const result = createSiblingPreview(
          this.graph,
          maxIntersection.node,
          targetNodeBBox,
          spacing,
          true,
        )
        this.state.previewEdge = result.previewEdge
      } else {
        this.cleanupPreview()
        this.currentDragContext = null // 无效操作，清除上下文
      }
    } else if (deltaX < 0 && deltaY < 0) {
      // 第二象限 (左上) - 移动到父级左边
      if (!checkSiblingPosition(this.graph, this.state.dragNode!, maxIntersection.node, false)) {
        const result = createSiblingPreview(
          this.graph,
          maxIntersection.node,
          targetNodeBBox,
          spacing,
          false,
        )
        this.state.previewEdge = result.previewEdge
      } else {
        this.cleanupPreview()
        this.currentDragContext = null // 无效操作，清除上下文
      }
    } else if (deltaX < 0 && deltaY > 0) {
      // 第三象限 (左下) - 移动到子级左边
      if (!checkChildPosition(this.graph, this.state.dragNode!, maxIntersection.node, false)) {
        const result = createChildPreview(
          this.graph,
          maxIntersection.node,
          targetNodeBBox,
          spacing,
          false,
        )
        this.state.previewEdge = result.previewEdge
      } else {
        this.cleanupPreview()
        this.currentDragContext = null // 无效操作，清除上下文
      }
    } else if (deltaX > 0 && deltaY > 0) {
      // 第四象限 (右下) - 移动到子级右边
      if (!checkChildPosition(this.graph, this.state.dragNode!, maxIntersection.node, true)) {
        const result = createChildPreview(
          this.graph,
          maxIntersection.node,
          targetNodeBBox,
          spacing,
          true,
        )
        this.state.previewEdge = result.previewEdge
      } else {
        this.cleanupPreview()
        this.currentDragContext = null // 无效操作，清除上下文
      }
    }
  }

  /**
   * 处理鼠标抬起事件 - 结束拖拽
   */
  private handleMouseUp(): void {
    // 总是重新启用画布移动
    this.graph.enablePanning()

    if (this.state.isDragging && this.state.dragNode && this.state.ghostNode) {
      // 恢复原节点显示
      this.state.dragNode.attr('.card/opacity', 1)

      // 检查是否有有效的拖拽上下文（即有预览状态）
      if (this.currentDragContext && this.state.previewEdge) {
        // 获取预览节点的位置信息
        const previewNodeEl = this.graph.container.querySelector('.preview-node')
        let previewPosition: { x: number; y: number } | undefined

        if (previewNodeEl) {
          // 从DOM元素获取预览节点位置
          const transform = previewNodeEl.getAttribute('transform')
          if (transform) {
            const match = transform.match(/translate\(([^,]+),([^)]+)\)/)
            if (match) {
              previewPosition = {
                x: parseFloat(match[1]),
                y: parseFloat(match[2]),
              }
            }
          }
        }

        // 如果无法从DOM获取，尝试从node-hooks中获取预览节点
        if (!previewPosition) {
          try {
            const previewNodes = this.graph
              .getNodes()
              .filter((node) => node.getData()?.type === 'preview-node')
            console.log('预览节点列表:', previewNodes)
            if (previewNodes.length > 0) {
              const previewNode = previewNodes[0]
              previewPosition = previewNode.getPosition()
            }
          } catch (error) {
            console.warn('无法获取预览节点位置:', error)
          }
        }

        // 将预览位置添加到拖拽上下文
        const enhancedContext = {
          ...this.currentDragContext,
          previewPosition,
        }

        console.log('🎯 执行组织结构更新:', enhancedContext)

        // 应用组织结构更新
        this.orgUpdater.updateStructure(enhancedContext)

        console.log('✅ 组织结构更新完成')
      } else {
        // 没有预览状态，将原节点移动到幽灵节点位置（普通拖拽）
        const ghostPos = this.state.ghostNode.getPosition()
        this.state.dragNode.setPosition(ghostPos.x, ghostPos.y)

        // 重新布局
        layout(this.graph)

        console.log('📍 普通拖拽完成，节点移动到:', ghostPos)
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
    this.currentDragContext = null

    layout(this.graph) // 最终布局调整
  }
}
