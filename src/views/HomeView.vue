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
    container: document.getElementById('container')!,
    interacting: {
      nodeMovable: true, // 启用节点移动
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
    createNode(graph, '子公司', 2),
    createNode(graph, '子公司', 2),
    createNode(graph, '子公司', 2),
    createNode(graph, '子公司', 2),
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
  min-width: 400px;
  min-height: 600px;
  border: 1px solid red;
}
</style>
