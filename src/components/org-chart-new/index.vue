<script lang="ts" setup>
import { Graph, Node, type Edge } from '@antv/x6'
import registerNode from './node/register'
import registerEdge from './edge/register'
import { onMounted, ref } from 'vue'
import { edges, graph, nodes } from './state'
import { createNode, createPreviewNode, findNodeByName, moveNode } from './node/hooks'
import { createEdge } from './edge/hooks'
import { layout, initializeChildrenOrder } from './graph/hooks'
import initNodeStyle from './styles'
import { initEventListener } from './events'

// 1.注册节点和边线
registerNode()
registerEdge()

// 2.初始化样式
initNodeStyle()

// 3.初始化画布
const containerRef = ref()
onMounted(() => {
  graph.value = new Graph({
    container: containerRef.value,
    // autoResize: true, // 没有设置大小，以父级容器自动
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

  // 4.创建节点，边线
  nodes.value = [
    createNode('A', 1),
    createNode('B', 2),
    createNode('C', 2),
    createNode('D', 2),
    createNode('E', 2),
  ]
  edges.value = [
    createEdge(nodes.value[0] as Node, nodes.value[1] as Node),
    createEdge(nodes.value[0] as Node, nodes.value[2] as Node),
    createEdge(nodes.value[2] as Node, nodes.value[3] as Node),
    createEdge(nodes.value[2] as Node, nodes.value[4] as Node),
  ]

  // 5.重置画布内容并布局
  graph.value?.resetCells([...(nodes.value as Node[]), ...(edges.value as Edge[])])

  // 6.初始化childrenOrder（必须在layout之前）
  initializeChildrenOrder()

  layout()

  graph.value.zoomTo(0.8)
  graph.value.centerContent()

  // 7.初始化事件监听
  initEventListener()
})

const parent = ref()
const target = ref()
const index = ref()
const onTest = () => {
  const parentNode = findNodeByName(parent.value)
  const targetNode = findNodeByName(target.value)
  if (parentNode && targetNode) {
    moveNode(parentNode, targetNode, index.value)
  }
}

const onPreview = () => {
  const parentNode = findNodeByName(parent.value)
  if (parentNode) {
    createPreviewNode(parentNode, index.value)
  }
}

const onPrint = () => {
  console.log(graph.value?.toJSON())
}
</script>

<template>
  <div>
    父节点：<input type="text" v-model="parent" /> 目标节点：<input type="text" v-model="target" />
    位置：<input type="text" v-model="index" />
    <button @click="onTest" class="action-button">转移Test</button>
    <button @click="onPreview" class="action-button">显示Preview</button>
    <button @click="onPrint" class="action-button">打印Json</button>
  </div>
  <div ref="containerRef" id="chart-container"></div>
</template>

<style scoped>
#chart-container {
  width: 800px;
  height: 600px;
  border: 1px solid red;
}
</style>
