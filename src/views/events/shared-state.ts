import type { Edge, Graph, Node } from '@antv/x6'

/**
 * 节点相交检测结果类型
 */
export interface NodeIntersection {
  node: Node
  position: { x: number; y: number }
  overlap: number
  overlapCenter: { x: number; y: number }
}

/**
 * 事件监听器之间共享的状态
 */
export interface SharedEventState {
  // 编辑状态
  isEditing: boolean
  currentEditingNode: Node | null
  
  // 拖拽状态
  isDragging: boolean
  dragStartPos: { x: number; y: number } | null
  dragStartNodePos: { x: number; y: number } | null
  dragNode: Node | null
  ghostNode: Node | null
  
  // 预览状态
  previewEdge: Edge | null
  
  // UI状态
  clickTimer: number | null
}

/**
 * 创建初始状态
 */
export function createInitialState(): SharedEventState {
  return {
    isEditing: false,
    currentEditingNode: null,
    isDragging: false,
    dragStartPos: null,
    dragStartNodePos: null,
    dragNode: null,
    ghostNode: null,
    previewEdge: null,
    clickTimer: null,
  }
}

/**
 * 事件处理器的通用接口
 */
export interface EventHandler {
  init(graph: Graph, state: SharedEventState): void
  cleanup?(): void
}