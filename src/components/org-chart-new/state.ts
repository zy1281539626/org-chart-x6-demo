import { Graph, type Edge, type Node } from '@antv/x6'
import { ref } from 'vue'

export const graph = ref<Graph | null>(null)

// 存储节点
export const nodes = ref<Node[]>([])
// 存储边线
export const edges = ref<Edge[]>([])
// 存储子节点的排序信息
export const childrenOrder = ref<Record<string, string[]>>({})
