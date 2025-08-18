import { Graph } from '@antv/x6'

export default () => {
  Graph.registerEdge(
    'org-edge',
    {
      zIndex: -1,
      attrs: {
        line: {
          strokeWidth: 2,
          stroke: '#999999',
          sourceMarker: null,
          targetMarker: null,
        },
      },
    },
    true,
  )
}
