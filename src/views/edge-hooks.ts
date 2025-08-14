import type { Cell, Graph } from '@antv/x6'

/**
 * 创建边线
 * @param graph
 * @param source
 * @param target
 * @returns
 */
export function createEdge(graph: Graph, source: Cell, target: Cell) {
  return graph.createEdge({
    shape: 'org-edge',
    source: { cell: source.id },
    target: { cell: target.id },
  })
}
