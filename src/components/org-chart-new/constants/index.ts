/**
 * 组织架构图相关常量配置
 */

// 节点尺寸
export const NODE_DIMENSIONS = {
  // 标准节点尺寸
  STANDARD_WIDTH: 200,
  STANDARD_HEIGHT: 54,

  // 预览节点尺寸
  PREVIEW_WIDTH: 100,
  PREVIEW_HEIGHT: 27,
  PREVIEW_HALF_WIDTH: 50, // 预览节点宽度的一半

  // 文本区域尺寸
  TEXT_WIDTH: 160,
  TEXT_HEIGHT: 45,
} as const

// 布局间距
export const LAYOUT_SPACING = {
  // dagre 布局间距
  NODE_SEPARATION: 50, // nodesep - 同一行节点间距
  RANK_SEPARATION: 100, // ranksep - 行间距

  // 拖拽预览间距
  DRAG_SPACING: 60, // 拖拽时预览节点的间距
} as const

// Z-Index 层级管理
export const Z_INDEX = {
  PREVIEW_EDGE: 998, // 预览连线层级
  PREVIEW_NODE: 999, // 预览节点层级
  GHOST_NODE: 1000, // 幽灵节点层级（最高）
} as const

// 透明度
export const OPACITY = {
  PREVIEW: 0.8, // 预览元素透明度
  DRAGGING_NODE: 0.3, // 拖拽时原节点透明度
  GHOST_NODE: 0.8, // 幽灵节点透明度
} as const

// 时间间隔
export const TIMING = {
  CLICK_DELAY: 300, // 单击延迟时间（用于区分单击和双击）
  DEBOUNCE_DELAY: 0, // 防抖延迟时间
} as const

// 图标位置
export const ICON = {
  OFFSET: 12, // 图标偏移量
} as const

// 缩放
export const ZOOM = {
  DEFAULT_SCALE: 0.8, // 默认缩放比例
} as const
