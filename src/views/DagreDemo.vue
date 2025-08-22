<script lang="ts" setup>
import Hierarchy from '@antv/hierarchy'
import data from './data'
import { Cell, Graph, Model } from '@antv/x6'
import { onMounted } from 'vue'

interface HierarchyResult {
  id: number
  x: number
  y: number
  children: HierarchyResult[]
}

onMounted(() => {
  const graph = new Graph({
    container: document.getElementById('container')!,
    connecting: {
      connector: 'smooth',
    },
  })

  const getResult = (data: any) =>
    Hierarchy.compactBox(data, {
      direction: 'TB',
      getWidth() {
        return 80
      },
      getHeight() {
        return 30
      },
      // 水平间距
      getHGap() {
        return 20
      },
      // 垂直间距
      getVGap() {
        return 20
      },
    })
  const result = getResult(data)
  const model: Model.FromJSONData = { nodes: [], edges: [] }
  const traverse = (data: HierarchyResult) => {
    if (data) {
      model.nodes?.push({
        id: `${data.id}`,
        x: data.x,
        y: data.y,
        shape: 'rect',
        width: 80,
        height: 30,
        label: `${data.id}`,
        attrs: {
          body: {
            fill: '#5F95FF',
            stroke: 'transparent',
          },
        },
      })
    }
    if (data.children) {
      data.children.forEach((item: HierarchyResult) => {
        model.edges?.push({
          source: `${data.id}`,
          target: `${item.id}`,
          connector: { name: 'normal' },
          router: {
            name: 'er',
            args: {
              offset: 'center',
            },
          },
          attrs: {
            line: {
              stroke: '#ccc',
              strokeWidth: 2,
              targetMarker: null,
            },
          },
        })
        traverse(item)
      })
    }
  }
  traverse(result)

  graph.fromJSON(model)
  graph.centerContent()

  const rootNode = graph.getRootNodes()[0]
  const node1 = graph.getCellById('1')
  const node1_1 = graph.getCellById('1-1')
  const node1_1_1 = graph.getCellById('1-1-1')
  const node1_1_2 = graph.getCellById('1-1-2')
  // console.log('node1_1', node1_1)

  const node1_2 = graph.getCellById('1-2')
  // console.log(graph.isNeighbor(node1_1, node1_2))

  // 是否根节点
  // console.log('isRootNode', graph.isRootNode('1'))
  // 叶子节点，没有子节点
  // console.log('getLeafNodes', graph.getLeafNodes())
  // 所有tree的链路中，node1_1的上下邻居 TODO:？？？
  // console.log('getNeighbors', graph.getNeighbors(node1_1))
  // 是否是上下邻居
  // console.log('isNeighbor', graph.isNeighbor(node1_1, rootNode))
  // 前面所有节点
  // console.log('getPredecessors', graph.getPredecessors(node1_1))
  // 返回 cell2 是否是 cell1 的前序节点
  // console.log('isPredecessor', graph.isPredecessor(node1_1_1, node1))
  // 后面所有子节点(包含分支)
  // console.log('getSuccessors', graph.getSuccessors(node1_1))
  // 返回 cell2 是否是 cell1 的后续节点
  // console.log('isSuccessor', graph.isSuccessor(node1_1, node1_1_1))
  // TODO:
  // console.log('getCommonAncestor', graph.getCommonAncestor(node1_1_1, node1_1))
  // TODO: 返回与指定节点位置的节点，通过 options.by 选项来指定获取方式，包含：center origin topLeft topCenter topRight ...
  // getNodesUnderNode
  // 从指定的节点/边开始进行遍历 (遍历所有节点)
  // graph.searchCell(node1_1, (cell: Cell, distance: number) => {
  //   console.log(cell, distance)
  // })

  // NOTE: 可以用来获取图形宽高，用来导出图片设置宽高
  // console.log('getAllCellsBBox', graph.getAllCellsBBox())

  // TODO: 修改数据，上下关系，左右顺序 ==> 修改Data
  // TODO: 为什么getNode没有children
  // NOTE: 修改数据：混合式
  // 【1初始化大批量】graph.fromJSON  如初始化，批量移动子tree
  // setTimeout(() => {
  //   const res1 = getResult({
  //     id: 'A',
  //     children: [
  //       {
  //         id: 'B',
  //       },
  //       { id: 'C' },
  //     ],
  //   })
  //   model = { nodes: [], edges: [] }
  //   traverse(res1)
  //   graph.fromJSON(model)
  //   graph.centerContent()
  // }, 3000)
  // 【2小批量】batchUpdate + API
  // 【3单个节点】API node.setAttr，如新增，删除，修改data
  //

  // 使用
  // const treeManager = new TreeManager(graph)
  // treeManager.moveNode('node-3', 'node-1', 2) // 移动到node-1下的第2个位置
})

class TreeManager {
  private graph: Graph
  private treeData: Model.FromJSONData | null

  constructor(graph: Graph) {
    this.graph = graph
    this.treeData = null
  }

  // 移动节点到新位置
  moveNode(nodeId: string, targetParentId: string, position = 'last') {
    this.treeData = this.graph.toJSON()

    // 数据重构
    this.restructureTree(nodeId, targetParentId, position)

    // 重新计算布局
    this.recalculateLayout()

    // 一次性更新
    this.graph.fromJSON(this.treeData)

    return this
  }

  // 重新计算整个树的布局
  recalculateLayout() {
    // 使用算法重新计算所有节点位置
    const layout = new TreeLayout(this.treeData)
    this.treeData = layout.calculate()
  }
}
</script>

<template>
  <div id="container"></div>
</template>

<style scoped>
#container {
  width: 600px;
  height: 600px;
  border: 1px solid red;
}
</style>
