<script lang="ts" setup>
import { Graph } from '@antv/x6'

import { onMounted } from 'vue'
import initNodeStyle from './style'
import registerNode from './register-node'

import { createEdge } from './edge-hooks'
import { reLayout } from './graph-hooks'
import { createNode } from './node-hooks'
import { initEventListener } from './events'

// 初始化样式
initNodeStyle()
// 注册节点
registerNode()

// 创建画布变量
let graph: Graph

onMounted(() => {
  // 创建画布
  graph = new Graph({
    autoResize: true,
    container: document.getElementById('container')!,
    panning: {
      enabled: true, // 启用画布平移
      eventTypes: ['leftMouseDown'], // 只支持鼠标左键拖拽平移，禁用滚轮平移
    },
    mousewheel: {
      enabled: true, // 启用鼠标滚轮缩放
      zoomAtMousePosition: false, // 以图形中心缩放
      factor: 1.1, // 缩放因子
      maxScale: 3, // 最大缩放比例
      minScale: 0.5, // 最小缩放比例
    },
    interacting: {
      nodeMovable: false, // 启用节点移动
      magnetConnectable: false, // 禁用连接点
      edgeMovable: false, // 禁用边移动
      arrowheadMovable: false, // 禁用箭头移动
      vertexMovable: false, // 禁用顶点移动
      vertexAddable: false, // 禁用添加顶点
      vertexDeletable: false, // 禁用删除顶点
      edgeLabelMovable: false, // 禁用边标签移动
    },
  })

  const nodes = [
    createNode(graph, '母公司', 1),
    createNode(graph, '子公司1', 2),
    createNode(graph, '子公司2', 2),
    createNode(graph, '子公司3', 2),
    createNode(graph, '子公司4', 2),
  ]

  const edges = [
    createEdge(graph, nodes[0], nodes[1]),
    createEdge(graph, nodes[0], nodes[2]),
    createEdge(graph, nodes[2], nodes[3]),
    createEdge(graph, nodes[2], nodes[4]),
  ]

  graph.resetCells([...nodes, ...edges])
  reLayout(graph)
  initEventListener(graph)
})
</script>

<template>
  <div id="container"></div>
</template>

<style scoped>
#container {
  width: 100dvw;
  height: 100dvh;
}
</style>
