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
          html: '<input type="text" class="input" />',
          visibility: 'hidden',
        },
      },
    },
    true,
  )

  // 幽灵节点（带阴影效果）
  Graph.registerNode(
    'ghost-node',
    {
      width: 200,
      height: 54,
      markup: [
        {
          tagName: 'defs',
        },
        {
          tagName: 'rect',
          selector: 'shadow',
          attrs: {
            class: 'shadow',
          },
        },
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
        defs: {
          markup: `
            <filter id="dropshadow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceAlpha" stdDeviation="3"/>
              <feOffset dx="2" dy="4" result="offset"/>
              <feComponentTransfer>
                <feFuncA type="linear" slope="0.3"/>
              </feComponentTransfer>
              <feMerge>
                <feMergeNode/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          `,
        },
        '.shadow': {
          x: 2,
          y: 4,
          rx: 4,
          ry: 4,
          refWidth: '100%',
          refHeight: '100%',
          fill: 'rgba(0, 0, 0, 0.15)',
        },
        '.card': {
          rx: 4,
          ry: 4,
          refWidth: '100%',
          refHeight: '100%',
          fill: 'rgba(230, 247, 255, 0.9)',
          stroke: '#007fff',
          strokeWidth: 2,
          strokeDasharray: '5,5',
          pointerEvents: 'none',
          filter: 'url(#dropshadow)',
        },
        '.name': {
          refX: '50%',
          refY: '50%',
          fill: '#0066cc',
          fontFamily: 'Arial',
          fontSize: 16,
          fontWeight: '600',
          textAnchor: 'middle',
          textVerticalAnchor: 'middle',
          opacity: 0.8,
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
