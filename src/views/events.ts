import type { Graph, Node } from '@antv/x6'
import { createEdge } from './edge-hooks'
import { reLayout } from './graph-hooks'
import { createNode } from './node-hooks'

export function initEventListener(graph: Graph) {
  let clickTimer: number | null = null
  let isEditing = false
  let isDragging = false

  // 键盘事件监听
  document.addEventListener('keydown', (e: KeyboardEvent) => {
    // 如果正在编辑文本，不处理删除键
    if (document.activeElement?.tagName === 'INPUT') return

    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault()
      const selectedNodes = graph
        .getNodes()
        .filter((node: Node) => node.getAttrByPath('.card/selected') === 'true')

      if (selectedNodes.length > 0) {
        selectedNodes.forEach((node: Node) => {
          graph.removeCell(node)
        })
        reLayout(graph)
      }
    }
  })

  // 拖拽开始
  graph.on('node:move:start', () => {
    isDragging = true
    if (clickTimer) {
      clearTimeout(clickTimer)
      clickTimer = null
    }
  })

  // 拖拽结束
  graph.on('node:moved', ({ node }: { node: Node }) => {
    isDragging = false
    
    // 基于拖拽位置重新计算父子关系
    const draggedNodePos = node.getPosition()
    const allNodes = graph.getNodes()
    
    // 找到最接近的潜在父节点（在拖拽节点上方且距离最近的节点）
    let potentialParent: Node | null = null
    let minDistance = Infinity
    
    allNodes.forEach(n => {
      if (n.id === node.id) return
      
      const pos = n.getPosition()
      
      // 只考虑在拖拽节点上方或左侧的节点作为潜在父节点
      if (pos.y < draggedNodePos.y - 30) {
        const distance = Math.sqrt(
          Math.pow(pos.x - draggedNodePos.x, 2) + 
          Math.pow(pos.y - draggedNodePos.y, 2)
        )
        
        if (distance < minDistance && distance < 200) { // 200px 范围内
          minDistance = distance
          potentialParent = n
        }
      }
    })
    
    // 重新建立连接关系
    if (potentialParent) {
      // 删除原有的连入边
      const incomingEdges = graph.getIncomingEdges(node)
      if (incomingEdges) {
        incomingEdges.forEach(edge => graph.removeCell(edge))
      }
      
      // 创建新的连接
      const newEdge = createEdge(graph, potentialParent, node)
      graph.addCell(newEdge)
    }
    
    // 延迟重新布局，保持新的层级关系
    setTimeout(() => {
      reLayout(graph)
    }, 100)
  })

  // 点击加号图标新增子节点
  graph.on('node:add', ({ e, node }: { e: Event; node: Node }) => {
    e.stopPropagation()
    const member = createNode(graph, '子公司')
    graph.addCell([member, createEdge(graph, node, member)])
    reLayout(graph)
  })
  // 删除节点
  graph.on('node:delete', ({ e, node }: { e: Event; node: Node }) => {
    e.stopPropagation()
    graph.removeCell(node)
    reLayout(graph)
  })

  // 点击空白处取消选中
  graph.on('blank:click', () => {
    graph.getNodes().forEach((node: Node) => {
      node.attr('.card/selected', null)
    })
  })

  // 节点点击选中效果
  graph.on('node:click', ({ node }: { node: Node }) => {
    if (isEditing || isDragging) return // 编辑模式或拖拽时不处理单击

    if (clickTimer) {
      clearTimeout(clickTimer)
      clickTimer = null
      return // 这是双击的第二次点击，不执行单击逻辑
    }

    clickTimer = setTimeout(() => {
      if (!isDragging) { // 再次确保不是拖拽操作
        graph.getNodes().forEach((n) => {
          n.attr('.card/selected', null)
        })
        node.attr('.card/selected', 'true')
      }
      clickTimer = null
    }, 200)
  })

  // 双击节点开启编辑功能
  graph.on('node:dblclick', ({ node }: { node: Node }) => {
    if (isDragging) return // 拖拽时不处理双击

    if (clickTimer) {
      clearTimeout(clickTimer)
      clickTimer = null
    }

    graph.getNodes().forEach((n) => {
      n.attr('.card/selected', null)
    })

    const currentText = (node.getAttrByPath('.name/text') as string) || node.id
    const inputEl = node.findView(graph)?.container.querySelector('input') as HTMLInputElement

    if (inputEl) {
      isEditing = true
      inputEl.value = currentText
      inputEl.style.display = 'block'
      inputEl.focus()
      inputEl.select()

      const handleBlur = () => {
        node.attr('.name/text', inputEl.value)
        inputEl.style.display = 'none'
        isEditing = false
        inputEl.removeEventListener('blur', handleBlur)
        inputEl.removeEventListener('keydown', handleKeydown)
      }

      const handleKeydown = (e: KeyboardEvent) => {
        if (e.key === 'Enter') {
          inputEl.blur()
        }
        if (e.key === 'Escape') {
          inputEl.value = currentText
          inputEl.blur()
        }
      }

      inputEl.addEventListener('blur', handleBlur)
      inputEl.addEventListener('keydown', handleKeydown)
    }
  })
}
