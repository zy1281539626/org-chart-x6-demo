import type { Graph } from '@antv/x6'
import { createInitialState, type EventHandler } from './shared-state'
import { EditEventHandler } from './edit-events'
import { DragEventHandler } from './drag-events'
import { NodeEventHandler } from './node-events'
import { KeyboardEventHandler } from './keyboard-events'
import { graph } from '../state'

/**
 * 处理器信息接口
 */
interface HandlerInfo {
  handler: new () => EventHandler
  instance: EventHandler
}

/**
 * 事件管理器 - 统一管理所有事件处理器
 */
export class EventManager {
  private graph: Graph
  private state = createInitialState()
  private handlers: HandlerInfo[] = []

  constructor() {
    this.graph = graph.value as Graph
  }

  /**
   * 初始化所有事件处理器
   */
  init(): void {
    // 创建各个事件处理器实例
    const editHandler = new EditEventHandler()
    const dragHandler = new DragEventHandler()
    const nodeHandler = new NodeEventHandler()
    const keyboardHandler = new KeyboardEventHandler()

    // 保存处理器实例以便后续清理
    this.handlers = [
      { handler: EditEventHandler, instance: editHandler },
      { handler: DragEventHandler, instance: dragHandler },
      { handler: NodeEventHandler, instance: nodeHandler },
      { handler: KeyboardEventHandler, instance: keyboardHandler },
    ]

    // 初始化所有处理器
    this.handlers.forEach(({ instance }) => {
      instance.init(this.graph, this.state)
    })

    // 设置处理器间的交互
    this.setupHandlerInteractions(editHandler, nodeHandler)
  }

  /**
   * 设置处理器间的交互
   */
  private setupHandlerInteractions(
    editHandler: EditEventHandler,
    nodeHandler: NodeEventHandler,
  ): void {
    // 找到对应的处理器实例
    const dragHandlerInfo = this.handlers.find((h) => h.handler === DragEventHandler)

    if (dragHandlerInfo) {
      const dragHandler = dragHandlerInfo.instance as DragEventHandler

      // 设置处理器间的引用
      dragHandler.setEditHandler(editHandler)
      nodeHandler.setEditHandler(editHandler)
    }
  }

  /**
   * 清理所有事件处理器
   */
  cleanup(): void {
    this.handlers.forEach(({ instance }) => {
      if (instance.cleanup) {
        instance.cleanup()
      }
    })
    this.handlers = []
  }

  /**
   * 获取共享状态（用于调试或特殊需求）
   */
  getState() {
    return this.state
  }
}

/**
 * 初始化事件监听器的主入口函数
 * 保持与原有 API 的兼容性
 */
export function initEventListener(): EventManager {
  const eventManager = new EventManager()
  eventManager.init()
  return eventManager
}
