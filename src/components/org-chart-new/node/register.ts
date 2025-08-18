import { Graph } from '@antv/x6'
import { NODE_DIMENSIONS, ICON, OPACITY } from '../constants'

export default () => {
  // 自定义节点
  Graph.registerNode(
    'org-node',
    {
      width: NODE_DIMENSIONS.STANDARD_WIDTH,
      height: NODE_DIMENSIONS.STANDARD_HEIGHT,
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
          x: NODE_DIMENSIONS.STANDARD_WIDTH / 2 - ICON.OFFSET,
          y: NODE_DIMENSIONS.STANDARD_HEIGHT,
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
          x: 0,
          y: 0,
          width: NODE_DIMENSIONS.STANDARD_WIDTH,
          height: NODE_DIMENSIONS.STANDARD_HEIGHT,
          html: '<input type="text" class="input" />',
          visibility: 'hidden',
        },
      },
    },
    true,
  )

  // 幽灵节点
  Graph.registerNode(
    'ghost-node',
    {
      width: NODE_DIMENSIONS.STANDARD_WIDTH,
      height: NODE_DIMENSIONS.STANDARD_HEIGHT,
      markup: [
        {
          tagName: 'rect',
          attrs: {
            class: 'card',
          },
        },
        {
          tagName: 'text',
          attrs: {
            class: 'name',
          },
        },
      ],
      attrs: {
        '.card': {
          rx: 4,
          ry: 4,
          refWidth: '100%',
          refHeight: '100%',
          fill: 'rgba(230, 247, 255, 0.9)',
          stroke: '#007fff',
          strokeWidth: 2,
          strokeDasharray: '5,5',
        },
        '.name': {
          refX: '50%',
          refY: '50%',
          fill: '#0066cc',
          fontSize: 16,
          fontWeight: '600',
          textAnchor: 'middle',
          textVerticalAnchor: 'middle',
          opacity: OPACITY.GHOST_NODE,
        },
      },
    },
    true,
  )
}
