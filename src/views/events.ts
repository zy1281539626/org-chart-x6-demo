import type { Graph, Node } from '@antv/x6'
import { createEdge } from './edge-hooks'
import { layout, reLayout } from './graph-hooks'
import { createNode } from './node-hooks'
import { waitForRender, debounce } from './utils'

export function initEventListener(graph: Graph) {
  // 是否编辑模式
  let isEditing = false
  // 拖拽状态管理
  let isDragging = false
  // 修改拖拽相关的变量声明
  let dragStartPos: { x: number; y: number } | null = null
  let dragStartGraphPos: { x: number; y: number } | null = null // 新增：记录图形坐标系中的起始位置
  let dragNode: Node | null = null
  let ghostNode: Node | null = null
  let dragOffset: { x: number; y: number } | null = null

  // 预置虚拟节点和连线
  let previewNode: Node | null = null
  let previewEdge: any = null

  let clickTimer: number | null = null
  let currentEditingNode: Node | null = null

  // 退出编辑模式的通用函数
  const exitEditMode = (save = false) => {
    if (currentEditingNode && isEditing) {
      const inputEl = currentEditingNode
        .findView(graph)
        ?.container.querySelector('input') as HTMLInputElement
      if (inputEl && save) {
        // 保存输入值
        currentEditingNode.attr('.name/text', inputEl.value)
      }
      // 隐藏输入框
      currentEditingNode.attr('input-container', { visibility: 'hidden' })
      isEditing = false
      currentEditingNode = null
    }
  }

  // 创建带阴影的幽灵节点
  const createGhostNode = (originalNode: Node) => {
    const currentText = (originalNode.getAttrByPath('.name/text') as string) || originalNode.id
    const originalPos = originalNode.getPosition()

    const ghost = graph.addNode({
      shape: 'ghost-node',
      x: originalPos.x,
      y: originalPos.y,
      zIndex: 1000, // 确保在最上层
      attrs: {
        '.name': {
          text: currentText,
        },
      },
    })

    return ghost
  }

  // 清理幽灵节点
  const cleanupGhost = () => {
    if (ghostNode) {
      graph.removeNode(ghostNode)
      ghostNode = null
    }
  }

  // 清理预览节点和连线
  const cleanupPreview = () => {
    if (previewNode) {
      graph.removeNode(previewNode)
      previewNode = null
    }
    if (previewEdge) {
      graph.removeEdge(previewEdge)
      previewEdge = null
    }
  }

  // 创建预览节点
  const createPreviewNode = (x: number, y: number) => {
    const preview = graph.addNode({
      shape: 'rect',
      x,
      y,
      zIndex: 999,
      width: 100,
      height: 40,
      attrs: {
        body: {
          fill: '#ff9500',
          stroke: '#ff6600',
          strokeWidth: 2,
          opacity: 0.8,
        },
      },
    })
    return preview
  }

  // 计算正交路由的单转折点
  const calculateOrthVertices = (source: Node, target: Node): { x: number; y: number }[] => {
    const sourceBBox = source.getBBox()
    const targetBBox = target.getBBox()

    // 连线起点：源节点底部中心
    const sourcePoint = {
      x: sourceBBox.x + sourceBBox.width / 2,
      y: sourceBBox.y + sourceBBox.height,
    }

    // 连线终点：目标节点顶部中心
    const targetPoint = {
      x: targetBBox.x + targetBBox.width / 2,
      y: targetBBox.y,
    }

    // 如果两个节点在垂直方向上需要转折，计算中间转折点
    if (sourcePoint.x !== targetPoint.x) {
      // 需要一个转折点：先垂直下降，再水平到目标
      const midY = sourcePoint.y + (targetPoint.y - sourcePoint.y) / 2
      return [
        {
          x: sourcePoint.x,
          y: midY,
        },
        {
          x: targetPoint.x,
          y: midY,
        },
      ]
    }

    // 如果水平对齐，不需要转折点
    return []
  }

  // 创建预览连线
  const createPreviewEdge = (source: Node, target: Node, vertices?: { x: number; y: number }[]) => {
    const edge = graph.addEdge({
      shape: 'org-edge',
      source: source.id,
      target: target.id,
      router: 'orth',
      vertices: vertices || [],
      zIndex: 998,
      attrs: {
        line: {
          stroke: '#ff9500',
          strokeWidth: 2,
          // strokeDasharray: '8,4',
          opacity: 0.8,
        },
      },
    })
    return edge
  }

  // 检测节点相交的方法 - 返回相交面积最大的节点
  const checkNodeIntersections = (
    targetNode: Node,
    excludeNode?: Node,
  ): {
    node: Node
    position: { x: number; y: number }
    overlap: number
    overlapCenter: { x: number; y: number }
  } | null => {
    const targetBBox = targetNode.getBBox()
    let maxIntersection: {
      node: Node
      position: { x: number; y: number }
      overlap: number
      overlapCenter: { x: number; y: number }
    } | null = null

    // 获取所有其他节点
    const allNodes = graph.getNodes().filter(
      (node) =>
        node.id !== targetNode.id &&
        (!excludeNode || node.id !== excludeNode.id) &&
        !node.id.startsWith('ghost-'), // 排除幽灵节点
    )

    allNodes.forEach((node) => {
      const nodeBBox = node.getBBox()

      // 检测两个矩形是否相交
      const isIntersecting = !(
        targetBBox.x + targetBBox.width < nodeBBox.x || // target在node左边
        nodeBBox.x + nodeBBox.width < targetBBox.x || // target在node右边
        targetBBox.y + targetBBox.height < nodeBBox.y || // target在node上边
        nodeBBox.y + nodeBBox.height < targetBBox.y // target在node下边
      )

      if (isIntersecting) {
        // 计算重叠区域的边界
        const overlapLeft = Math.max(targetBBox.x, nodeBBox.x)
        const overlapRight = Math.min(targetBBox.x + targetBBox.width, nodeBBox.x + nodeBBox.width)
        const overlapTop = Math.max(targetBBox.y, nodeBBox.y)
        const overlapBottom = Math.min(
          targetBBox.y + targetBBox.height,
          nodeBBox.y + nodeBBox.height,
        )

        // 计算重叠面积
        const overlapX = overlapRight - overlapLeft
        const overlapY = overlapBottom - overlapTop
        const overlapArea = overlapX * overlapY

        // 计算重叠区域的中心点
        const overlapCenterX = overlapLeft + overlapX / 2
        const overlapCenterY = overlapTop + overlapY / 2

        // 如果是第一个相交节点，或者重叠面积更大，则更新最大相交节点
        if (!maxIntersection || overlapArea > maxIntersection.overlap) {
          maxIntersection = {
            node,
            position: node.getPosition(),
            overlap: overlapArea,
            overlapCenter: { x: overlapCenterX, y: overlapCenterY },
          }
        }
      }
    })

    return maxIntersection
  }

  // 拖拽相关配置
  const DRAG_THRESHOLD = 0 // 拖拽阈值（像素）

  // 全局鼠标移动 - 处理拖拽
  const handleMouseMove = (e: MouseEvent) => {
    if (!dragStartPos || !dragStartGraphPos || !dragNode || isEditing || !dragOffset) return

    // 将当前鼠标位置转换为图形坐标
    const currentGraphPoint = graph.clientToGraph(e.clientX, e.clientY)

    // 计算在图形坐标系中的移动距离
    const deltaX = currentGraphPoint.x - dragStartGraphPos.x
    const deltaY = currentGraphPoint.y - dragStartGraphPos.y
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)

    // 超过阈值开始拖拽
    if (distance > DRAG_THRESHOLD && !isDragging) {
      isDragging = true
      exitEditMode(false) // 退出编辑模式
      // 禁用画布移动
      graph.disablePanning()
      // 创建幽灵节点
      ghostNode = createGhostNode(dragNode)
      // 隐藏原节点
      dragNode.attr('.card/opacity', 0.3)
    }

    // 更新幽灵节点位置
    if (isDragging && ghostNode) {
      // 直接使用当前图形坐标减去拖拽偏移量
      ghostNode.setPosition(currentGraphPoint.x - dragOffset.x, currentGraphPoint.y - dragOffset.y)

      // 检测幽灵节点与其他节点的相交情况 - 只返回相交面积最大的节点
      const maxIntersection = checkNodeIntersections(ghostNode, dragNode)

      if (maxIntersection) {
        const nodeText = maxIntersection.node.getAttrByPath('.name/text') || maxIntersection.node.id

        // 计算节点的中心点坐标
        const nodeBBox = maxIntersection.node.getBBox()
        const nodeCenterX = nodeBBox.x + nodeBBox.width / 2
        const nodeCenterY = nodeBBox.y + nodeBBox.height / 2

        // 计算相交区域中心点相对于节点中心点的象限
        const deltaX = maxIntersection.overlapCenter.x - nodeCenterX
        const deltaY = maxIntersection.overlapCenter.y - nodeCenterY

        let quadrant = ''
        if (deltaX > 0 && deltaY < 0) {
          quadrant = '第一象限 (右上)'
        } else if (deltaX < 0 && deltaY < 0) {
          quadrant = '第二象限 (左上)'
        } else if (deltaX < 0 && deltaY > 0) {
          quadrant = '第三象限 (左下)'
        } else if (deltaX > 0 && deltaY > 0) {
          quadrant = '第四象限 (右下)'
        } else if (deltaX === 0 && deltaY < 0) {
          quadrant = '正上方'
        } else if (deltaX === 0 && deltaY > 0) {
          quadrant = '正下方'
        } else if (deltaX < 0 && deltaY === 0) {
          quadrant = '正左方'
        } else if (deltaX > 0 && deltaY === 0) {
          quadrant = '正右方'
        } else {
          quadrant = '重合 (中心点)'
        }

        console.log(`🎯 最大相交节点: "${nodeText}"`)
        console.log(`   节点位置: (${maxIntersection.position.x}, ${maxIntersection.position.y})`)
        console.log(`🔵 节点中心点: (${nodeCenterX.toFixed(1)}, ${nodeCenterY.toFixed(1)})`)
        console.log(`   重叠面积: ${maxIntersection.overlap.toFixed(1)}px²`)
        console.log(
          `📍 相交区域中心点: (${maxIntersection.overlapCenter.x.toFixed(1)}, ${maxIntersection.overlapCenter.y.toFixed(1)})`,
        )
        console.log(`🧭 相对位置: ${quadrant}`)

        // 清理之前的预览元素
        cleanupPreview()

        // 根据象限判断插入位置并创建预览
        const targetNodeBBox = maxIntersection.node.getBBox()
        const spacing = 60 // 节点间距

        if (deltaX > 0 && deltaY < 0) {
          // 第一象限 (右上) - 移动到父级右边
          console.log(`   🎯 插入逻辑: 移动到父级，作为右兄弟节点`)
          const parentEdges = graph.getIncomingEdges(maxIntersection.node)
          if (parentEdges && parentEdges.length > 0) {
            const parentNode = parentEdges[0].getSourceNode()
            if (parentNode) {
              // 计算预览位置：在最大相交节点右侧
              const previewX = targetNodeBBox.x + targetNodeBBox.width + spacing
              const previewY = targetNodeBBox.y

              previewNode = createPreviewNode(previewX, previewY)
              const vertices = calculateOrthVertices(parentNode, previewNode)
              previewEdge = createPreviewEdge(parentNode, previewNode, vertices)
            }
          }
        } else if (deltaX < 0 && deltaY < 0) {
          // 第二象限 (左上) - 移动到父级左边
          console.log(`   🎯 插入逻辑: 移动到父级，作为左兄弟节点`)
          const parentEdges = graph.getIncomingEdges(maxIntersection.node)
          if (parentEdges && parentEdges.length > 0) {
            const parentNode = parentEdges[0].getSourceNode()
            if (parentNode) {
              // 计算预览位置：在最大相交节点左侧
              const previewX = targetNodeBBox.x - targetNodeBBox.width - spacing
              const previewY = targetNodeBBox.y

              previewNode = createPreviewNode(previewX, previewY)
              const vertices = calculateOrthVertices(parentNode, previewNode)
              previewEdge = createPreviewEdge(parentNode, previewNode, vertices)
            }
          }
        } else if (deltaX < 0 && deltaY > 0) {
          // 第三象限 (左下) - 移动到子级左边
          console.log(`   🎯 插入逻辑: 移动到子级，作为左子节点`)

          // 检查目标节点是否有子节点
          const getOutgoingEdges = graph.getOutgoingEdges(maxIntersection.node)
          const hasChildren = getOutgoingEdges ? getOutgoingEdges.length > 0 : false

          let previewX: number, previewY: number

          if (hasChildren) {
            // 有子节点：放在左侧
            previewX = targetNodeBBox.x - spacing
            previewY = targetNodeBBox.y + targetNodeBBox.height + spacing
          } else {
            // 没有子节点：直接放在下方中心
            previewX = targetNodeBBox.x + targetNodeBBox.width / 2 - 50 // 50是previewNode宽度的一半
            previewY = targetNodeBBox.y + targetNodeBBox.height + spacing
          }

          previewNode = createPreviewNode(previewX, previewY)
          const vertices = calculateOrthVertices(maxIntersection.node, previewNode)
          previewEdge = createPreviewEdge(maxIntersection.node, previewNode, vertices)
        } else if (deltaX > 0 && deltaY > 0) {
          // 第四象限 (右下) - 移动到子级右边
          console.log(`   🎯 插入逻辑: 移动到子级，作为右子节点`)

          // 检查目标节点是否有子节点
          const getOutgoingEdges = graph.getOutgoingEdges(maxIntersection.node)
          const hasChildren = getOutgoingEdges ? getOutgoingEdges.length > 0 : false

          let previewX: number, previewY: number

          if (hasChildren) {
            // 有子节点：放在右侧
            previewX = targetNodeBBox.x + targetNodeBBox.width + spacing
            previewY = targetNodeBBox.y + targetNodeBBox.height + spacing
          } else {
            // 没有子节点：直接放在下方中心
            previewX = targetNodeBBox.x + targetNodeBBox.width / 2 - 50 // 50是previewNode宽度的一半
            previewY = targetNodeBBox.y + targetNodeBBox.height + spacing
          }

          previewNode = createPreviewNode(previewX, previewY)
          const vertices = calculateOrthVertices(maxIntersection.node, previewNode)
          previewEdge = createPreviewEdge(maxIntersection.node, previewNode, vertices)
        }
      }
    }
  }

  // 创建防抖的鼠标移动处理函数
  const debouncedHandleMouseMove = debounce(handleMouseMove, 0) // 约60fps

  // 自定义拖拽事件监听
  // 鼠标按下 - 准备拖拽
  graph.on('node:mousedown', ({ e, node }: { e: MouseEvent; node: Node }) => {
    if (isEditing) return

    // 立即阻止所有默认行为和事件传播
    e.stopPropagation()
    e.stopImmediatePropagation()
    e.preventDefault()

    // 立即禁用画布移动，防止画布跟随拖拽
    graph.disablePanning()

    // 记录客户端坐标和图形坐标
    dragStartPos = { x: e.clientX, y: e.clientY }
    dragStartGraphPos = graph.clientToGraph(e.clientX, e.clientY) // 新增
    dragNode = node
    isDragging = false

    // 计算鼠标在节点内的偏移量
    const nodePos = node.getPosition()
    dragOffset = {
      x: dragStartGraphPos.x - nodePos.x,
      y: dragStartGraphPos.y - nodePos.y,
    }

    // 清除可能存在的点击定时器
    if (clickTimer) {
      clearTimeout(clickTimer)
      clickTimer = null
    }

    console.log('mousedown on node:', node.id)
  })

  // 全局鼠标抬起 - 结束拖拽
  const handleMouseUp = () => {
    // 总是重新启用画布移动
    graph.enablePanning()

    if (isDragging && dragNode && ghostNode) {
      // 恢复原节点显示
      dragNode.attr('.card/opacity', 1)

      // 将原节点移动到幽灵节点位置
      const ghostPos = ghostNode.getPosition()
      dragNode.setPosition(ghostPos.x, ghostPos.y)

      // 清理幽灵节点和预览元素
      cleanupGhost()
      cleanupPreview()

      // TODO: 这里可以添加拖拽完成后的逻辑，比如重新计算连接关系
      console.log('拖拽完成，节点移动到:', ghostPos)
    }

    // 重置拖拽状态
    isDragging = false
    dragStartPos = null
    dragStartGraphPos = null // 新增：重置图形坐标起始位置
    dragNode = null
    dragOffset = null
    // 移除reLayout调用，避免拖拽后重置画布位置
    layout(graph)
  }

  // 绑定全局事件
  document.addEventListener('mousemove', debouncedHandleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)

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

  // 画布移动时退出编辑模式
  graph.on('graph:panning', () => {
    exitEditMode(false)
  })

  // 画布缩放时退出编辑模式
  graph.on('graph:zoom', () => {
    exitEditMode(false)
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

  // 点击空白处取消选中并隐藏输入框
  graph.on('blank:click', () => {
    graph.getNodes().forEach((node: Node) => {
      node.attr('.card/selected', null)
    })
    // 退出编辑模式但不保存
    exitEditMode(false)
  })

  // 节点点击选中效果
  graph.on('node:click', ({ node }: { node: Node }) => {
    if (isEditing || isDragging) return
    if (clickTimer) {
      clearTimeout(clickTimer)
      clickTimer = null
      return // 这是双击的第二次点击，不执行单击逻辑
    }

    clickTimer = setTimeout(() => {
      if (!isDragging) {
        // 再次确保不是拖拽操作
        graph.getNodes().forEach((n) => {
          n.attr('.card/selected', null)
        })
        node.attr('.card/selected', 'true')
      }
      clickTimer = null
    }, 300)
  })

  // 双击节点开启编辑功能
  graph.on('node:dblclick', ({ e, node }: { e: Event; node: Node }) => {
    e.stopPropagation()
    if (isDragging) return

    if (clickTimer) {
      clearTimeout(clickTimer)
      clickTimer = null
    }

    // 如果已经在编辑其他节点，先退出
    if (isEditing && currentEditingNode !== node) {
      exitEditMode(false)
    }

    graph.getNodes().forEach((n) => {
      n.attr('.card/selected', null)
    })

    const currentText = (node.getAttrByPath('.name/text') as string) || node.id
    const inputEl = node.findView(graph)?.container.querySelector('input') as HTMLInputElement

    if (inputEl) {
      isEditing = true
      currentEditingNode = node
      node.attr('input-container', { visibility: 'visible' })

      waitForRender(() => {
        const freshInputEl = node
          .findView(graph)
          ?.container.querySelector('input') as HTMLInputElement
        if (freshInputEl) {
          freshInputEl.value = currentText
          freshInputEl.focus()
          freshInputEl.select()

          const cleanup = () => {
            freshInputEl.removeEventListener('blur', handleBlur)
            freshInputEl.removeEventListener('keydown', handleKeydown)
          }

          const handleBlur = () => {
            exitEditMode(true)
            cleanup()
          }

          const handleKeydown = (e: KeyboardEvent) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              exitEditMode(true)
              cleanup()
            }
            if (e.key === 'Escape') {
              e.preventDefault()
              exitEditMode(false)
              cleanup()
            }
          }

          freshInputEl.addEventListener('blur', handleBlur)
          freshInputEl.addEventListener('keydown', handleKeydown)
        }
      })
    }
  })
}
