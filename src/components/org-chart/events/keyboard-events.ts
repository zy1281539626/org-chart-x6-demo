import type { Graph, Node } from '@antv/x6'
import { reLayout } from '../hooks/graph-hooks'
import type { EventHandler, SharedEventState } from './shared-state'

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
          this.graph.removeCell(node)
        })
        reLayout(this.graph)
      }
    }
  }
}
