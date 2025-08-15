import insertCss from 'insert-css'

export default () => {
  // 定义样式
  insertCss(`
    .x6-cell {
      cursor: default;
    }
    .x6-node .btn {
      cursor: pointer;
    }
    .x6-node .addIcon {
      cursor: pointer;
    }
    .x6-node .card.type-1 {
      fill: #B6002A !important;
      stroke: #B6002A !important;
    }
    .x6-node .card.type-1 ~ .name {
      fill: #fff !important;
    }
    .x6-node .card.type-2 {
      fill: #eeeeee !important;
      stroke: #eeeeee !important;
    }
    .x6-node .card.type-2 ~ .name {
      fill: #000 !important;
    }
    .x6-node .card[selected="true"] {
      stroke: #B6002A !important;
      stroke-width: 2 !important;
    }

    .input {
      width: 100%;
      height: 100%;
      background: #ccc;
      border:none;
      outline:none;
      color: #000;
      text-align: center;
      z-index:1;
      font-size: 16px;
      font-weight: 500;
    }
  `)
}
