import type { Graph, Node } from '@antv/x6'
import { createEdge } from '../edge/hooks'
import { layout } from '../graph/hooks'
import { createNode } from '../node/hooks'
import { TIMING } from '../constants'
import { nodes, edges, childrenOrder } from '../state'
import type { EventHandler, SharedEventState } from './shared-state'

/**
 * 节点操作事件处理器
 */
export class NodeEventHandler implements EventHandler {
  private graph!: Graph
  private state!: SharedEventState
  private editHandler?: { exitEditMode: (save: boolean) => void }

  init(graph: Graph, state: SharedEventState): void {
    this.graph = graph
    this.state = state

    // 节点操作事件
    this.graph.on('node:add', this.handleNodeAdd.bind(this))
    this.graph.on('node:delete', this.handleNodeDelete.bind(this))
    this.graph.on('node:click', this.handleNodeClick.bind(this))

    // 画布点击事件
    this.graph.on('blank:click', this.handleBlankClick.bind(this))
  }

  /**
   * 设置编辑处理器引用（用于处理器间交互）
   */
  setEditHandler(editHandler: { exitEditMode: (save: boolean) => void }): void {
    this.editHandler = editHandler
  }

  /**
   * 处理节点添加事件
   */
  private handleNodeAdd({ e, node }: { e: Event; node: Node }): void {
    e.stopPropagation()
    const member = createNode('子公司')
    if (member) {
      const edge = createEdge(node, member)
      this.graph.addCell([member, edge])
      
      // 同步更新状态数组
      nodes.value.push(member)
      edges.value.push(edge)
      
      // 更新childrenOrder - 将新节点添加到父节点的子节点列表末尾
      const parentId = node.id
      if (!childrenOrder.value[parentId]) {
        childrenOrder.value[parentId] = []
      }
      childrenOrder.value[parentId].push(member.id)
      
      layout()
    }
  }

  /**
   * 处理节点删除事件
   */
  private handleNodeDelete({ e, node }: { e: Event; node: Node }): void {
    e.stopPropagation()
    
    // 从状态数组中移除节点
    const nodeIndex = nodes.value.findIndex(n => n.id === node.id)
    if (nodeIndex > -1) {
      nodes.value.splice(nodeIndex, 1)
    }
    
    // 从父节点的childrenOrder中移除
    const parentEdges = this.graph.getIncomingEdges(node)
    if (parentEdges && parentEdges.length > 0) {
      const parentId = parentEdges[0].getSourceCellId()
      if (childrenOrder.value[parentId]) {
        const childIndex = childrenOrder.value[parentId].indexOf(node.id)
        if (childIndex > -1) {
          childrenOrder.value[parentId].splice(childIndex, 1)
        }
      }
    }
    
    // 清理该节点的childrenOrder记录
    delete childrenOrder.value[node.id]
    
    // 移除相关的边
    const relatedEdges = this.graph.getConnectedEdges(node)
    relatedEdges.forEach(edge => {
      const edgeIndex = edges.value.findIndex(e => e.id === edge.id)
      if (edgeIndex > -1) {
        edges.value.splice(edgeIndex, 1)
      }
    })
    
    // 从图中移除节点（这会自动移除相关边）
    this.graph.removeCell(node)
    layout()
  }

  /**
   * 处理节点点击事件 - 选中效果
   */
  private handleNodeClick({ node }: { node: Node }): void {
    if (this.state.isEditing || this.state.isDragging) return

    if (this.state.clickTimer) {
      clearTimeout(this.state.clickTimer)
      this.state.clickTimer = null
      return // 这是双击的第二次点击，不执行单击逻辑
    }

    this.state.clickTimer = setTimeout(() => {
      if (!this.state.isDragging) {
        // 再次确保不是拖拽操作
        this.graph.getNodes().forEach((n) => {
          n.attr('.card/selected', null)
        })
        node.attr('.card/selected', 'true')
      }
      this.state.clickTimer = null
    }, TIMING.CLICK_DELAY)
  }

  /**
   * 处理空白区域点击事件
   */
  private handleBlankClick(): void {
    this.graph.getNodes().forEach((node: Node) => {
      node.attr('.card/selected', null)
    })
    // 退出编辑模式但不保存
    if (this.editHandler) {
      this.editHandler.exitEditMode(false)
    }
  }
}
