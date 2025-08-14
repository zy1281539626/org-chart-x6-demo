import { Dom, type Graph } from '@antv/x6'
import addIcon from './icons.png'

export function createNode(graph: Graph, name: string, type: number = 2) {
  return graph.createNode({
    shape: 'org-node',
    attrs: {
      '.addIcon': { xlinkHref: addIcon },
      '.card': { class: `card type-${type}` },
      '.name': {
        text: Dom.breakText(name, { width: 160, height: 45 }),
      },
    },
  })
}
