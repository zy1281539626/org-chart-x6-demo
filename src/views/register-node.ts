import { Graph } from '@antv/x6'

export default () => {
  // 自定义节点
  Graph.registerNode(
    'org-node',
    {
      width: 200,
      height: 54,
      markup: [
        {
          tagName: 'rect',
          attrs: {
            class: 'card',
          },
        },
        {
          tagName: 'image',
          attrs: {
            class: 'addIcon',
          },
        },
        {
          tagName: 'text',
          attrs: {
            class: 'name',
          },
        },
        {
          tagName: 'foreignObject',
          selector: 'input-container',
        },
      ],
      attrs: {
        '.card': {
          rx: 0,
          ry: 0,
          refWidth: '100%',
          refHeight: '100%',
          fill: '#B6002A',
          stroke: '#B6002A',
          strokeWidth: 1,
          pointerEvents: 'visiblePainted',
        },
        '.addIcon': {
          x: 100 - 12,
          y: 54,
          width: 24,
          height: 24,
          event: 'node:add',
        },
        '.name': {
          refX: '50%',
          refY: '50%',
          fill: '#fff',
          fontFamily: 'Arial',
          fontSize: 16,
          fontWeight: '600',
          textAnchor: 'middle',
          textVerticalAnchor: 'middle',
        },
        'input-container': {
          x: -1,
          y: -1,
          width: 202,
          height: 56,
          html: '<input type="text" style="display:block;width: 100%; height: 100%; background: #ccc; border:none;outline:none; color: #000; text-align: center;z-index:1;display:none; font-size: 16px;font-weight: 500;" />',
        },
      },
    },
    true,
  )

  // 自定义边
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
