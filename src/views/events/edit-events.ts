import type { Graph, Node } from '@antv/x6'
import type { EventHandler, SharedEventState } from './shared-state'

/**
 * 编辑事件处理器
 */
export class EditEventHandler implements EventHandler {
  private graph!: Graph
  private state!: SharedEventState

  init(graph: Graph, state: SharedEventState): void {
    this.graph = graph
    this.state = state

    // 双击节点开启编辑功能
    this.graph.on('node:dblclick', this.handleNodeDoubleClick.bind(this))

    // 画布移动时退出编辑模式
    this.graph.on('graph:panning', () => {
      this.exitEditMode(false)
    })

    // 画布缩放时退出编辑模式
    this.graph.on('graph:zoom', () => {
      this.exitEditMode(false)
    })
  }

  /**
   * 退出编辑模式的通用函数
   */
  exitEditMode(save = false): void {
    if (this.state.currentEditingNode && this.state.isEditing) {
      const inputEl = this.state.currentEditingNode
        .findView(this.graph)
        ?.container.querySelector('input') as HTMLInputElement
      if (inputEl && save) {
        // 保存输入值
        this.state.currentEditingNode.attr('.name/text', inputEl.value)
      }
      // 隐藏输入框
      this.state.currentEditingNode.attr('input-container', { visibility: 'hidden' })
      this.state.isEditing = false
      this.state.currentEditingNode = null
    }
  }

  /**
   * 处理节点双击事件
   */
  private handleNodeDoubleClick({ e, node }: { e: Event; node: Node }): void {
    e.stopPropagation()
    if (this.state.isDragging) return

    if (this.state.clickTimer) {
      clearTimeout(this.state.clickTimer)
      this.state.clickTimer = null
    }

    // 如果已经在编辑其他节点，先退出
    if (this.state.isEditing && this.state.currentEditingNode !== node) {
      this.exitEditMode(false)
    }

    this.graph.getNodes().forEach((n) => {
      n.attr('.card/selected', null)
    })

    const currentText = (node.getAttrByPath('.name/text') as string) || node.id
    const inputEl = node.findView(this.graph)?.container.querySelector('input') as HTMLInputElement

    if (inputEl) {
      this.state.isEditing = true
      this.state.currentEditingNode = node
      node.attr('input-container', { visibility: 'visible' })

      // 确保输入框正确设置
      const setupInput = () => {
        const freshInputEl = node
          .findView(this.graph)
          ?.container.querySelector('input') as HTMLInputElement

        if (freshInputEl) {
          freshInputEl.value = currentText
          freshInputEl.focus()

          const cleanup = () => {
            freshInputEl.removeEventListener('blur', handleBlur)
            freshInputEl.removeEventListener('keydown', handleKeydown)
          }

          const handleBlur = () => {
            this.exitEditMode(true)
            cleanup()
          }

          const handleKeydown = (e: KeyboardEvent) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              this.exitEditMode(true)
              cleanup()
            }
            if (e.key === 'Escape') {
              e.preventDefault()
              this.exitEditMode(false)
              cleanup()
            }
          }

          freshInputEl.addEventListener('blur', handleBlur)
          freshInputEl.addEventListener('keydown', handleKeydown)
        }
      }

      // 立即设置，并延迟重试确保成功
      setupInput()
      setTimeout(setupInput, 50)
    }
  }
}
