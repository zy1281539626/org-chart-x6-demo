/**
 * 等待浏览器渲染完成后执行回调
 * 使用双重 requestAnimationFrame 确保 DOM 完全更新
 */
export const waitForRender = (callback: () => void): void => {
  requestAnimationFrame(() => {
    requestAnimationFrame(callback)
  })
}

/**
 * 等待指定元素在容器中出现
 */
export const waitForElement = (
  selector: string,
  container: Element,
  callback: (element: Element) => void,
  timeout = 5000,
): void => {
  const observer = new MutationObserver(() => {
    const element = container.querySelector(selector)
    if (element) {
      observer.disconnect()
      callback(element)
    }
  })

  // 设置超时
  const timeoutId = setTimeout(() => {
    observer.disconnect()
  }, timeout)

  observer.observe(container, { childList: true, subtree: true })

  // 立即检查一次
  const existingElement = container.querySelector(selector)
  if (existingElement) {
    observer.disconnect()
    clearTimeout(timeoutId)
    callback(existingElement)
  }
}

/**
 * 等待元素变为可见状态
 */
export const waitForElementVisible = (
  element: HTMLElement,
  callback: () => void,
  maxAttempts = 10,
): void => {
  let attempts = 0
  const check = () => {
    if (element.offsetParent !== null && attempts < maxAttempts) {
      callback()
    } else if (attempts < maxAttempts) {
      attempts++
      requestAnimationFrame(check)
    }
  }
  check()
}

/**
 * 防抖函数
 * @param func 要防抖的函数
 * @param wait 延迟时间（毫秒）
 * @param immediate 是否立即执行
 */
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number,
  immediate = false,
): ((...args: Parameters<T>) => void) => {
  let timeout: number | null = null

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null
      if (!immediate) func(...args)
    }

    const callNow = immediate && !timeout

    if (timeout !== null) {
      clearTimeout(timeout)
    }
    timeout = setTimeout(later, wait)

    if (callNow) func(...args)
  }
}
