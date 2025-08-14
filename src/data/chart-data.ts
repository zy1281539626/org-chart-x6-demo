export default {
  nodes: [
    {
      id: '0',
      data: {
        name: '母公司',
        status: 'online',
      },
    },
    {
      id: '1',
      data: {
        name: '子公司1',
        status: 'offline',
      },
    },
    {
      id: '2',
      data: {
        name: '子公司2',
        status: 'offline',
      },
    },
    {
      id: '3',
      data: {
        name: '子公司2-1',
        status: 'offline',
      },
    },
    {
      id: '4',
      data: {
        name: '子公司2-2',
        status: 'offline',
      },
    },
  ],
  edges: [
    {
      source: '0',
      target: '1',
    },
    {
      source: '0',
      target: '2',
    },
    {
      source: '2',
      target: '3',
    },
    {
      source: '2',
      target: '4',
    },
  ],
}
