// import '@simonwep/pickr/dist/themes/nano.min.css'
// import Pickr from '@simonwep/pickr'
import Editor from '../../editor'
import './style/index.scss'
import { ToolbarType } from './enum'
import { IToolbarRegister } from './interface'
import { PLUGIN_PREFIX } from './constant'

let toolbarContainer: HTMLDivElement | null = null

// let CEditor: Editor

let isInside = false

let nowtargetId = ''

let nowTargetType = ''

// 工具栏列表
const toolbarRegisterList: IToolbarRegister[] = [
  {
    key:ToolbarType.EDITOR_VALUE,
    callback(editor) {
      // 编辑控件
      if (nowTargetType === 'control')
        editor.command.executeEditControl()
      // 编辑表格
      else
        editor.command.executeEditTable(nowtargetId)
      // toggleToolbarVisible(toolbarContainer!, false)
    }
  },
]

/**
 * 创建并返回一个包含多个工具栏项的浮动工具栏HTMLDivElement。
 *
 * @param editor - 当前编辑器实例，用于传递给工具栏项的回调函数。
 * @returns 一个新的HTMLDivElement，作为浮动工具栏的容器。
 */
function createToolbar(editor: Editor): HTMLDivElement {
  const toolbarContainer = document.createElement('div')
  toolbarContainer.classList.add(`${PLUGIN_PREFIX}-floating-toolbar`)
  // 便利遍历工具栏列表，创建并添加工具栏项
  for (const toolbar of toolbarRegisterList) {
    // 如果工具项有render方法,使用自定义渲染方法
    if (toolbar.render) {
      toolbar.render(toolbarContainer, editor)
    }
    // 如果是分割线
    else if (toolbar.isDivider) {
      const divider = document.createElement('div')
      divider.classList.add(`${PLUGIN_PREFIX}-divider`)
      toolbarContainer.append(divider)
    } else {
      const { key, callback } = toolbar
      const toolbarItem = document.createElement('div')
      toolbarItem.classList.add(`${PLUGIN_PREFIX}-${key}`)
      const icon = document.createElement('i')
      toolbarItem.append(icon)
      toolbarItem.onclick = () => {
        callback?.(editor)
      }
      toolbarContainer.append(toolbarItem)
    }
  }
  return toolbarContainer
}

/**
 * 控制工具栏显隐
 * @param toolbar
 * @param visible
 */
function toggleToolbarVisible(toolbar: HTMLDivElement, visible: boolean) {
  visible ? toolbar.classList.remove('hide') : toolbar.classList.add('hide')
}

function toggleToolbarItemActive(toolbarItem: HTMLDivElement, active: boolean) {
  active
    ? toolbarItem.classList.add('active')
    : toolbarItem.classList.remove('active')
}

export default function floatingToolbarPlugin(editor: Editor) {
  // CEditor = editor
  // 创建工具栏
  toolbarContainer = createToolbar(editor)
  const editorContainer = editor.command.getContainer()
  editorContainer.append(toolbarContainer)

  // 监听工具栏移入移出
  toolbarContainer.onmouseenter = () => {
    isInside = true
  }
  toolbarContainer.onmouseleave = () => {
    isInside = false
  }

  // 监听选区样式变化
  editor.eventBus.on('rangeStyleChange', rangeStyle => {
    if (!toolbarContainer) return
    if (rangeStyle.type === null) {
      toggleToolbarVisible(toolbarContainer, false)
      return
    }
    // setPositionByRange()
    // 样式回显
    const boldDom = toolbarContainer.querySelector<HTMLDivElement>(
      `.${PLUGIN_PREFIX}-bold`
    )
    if (boldDom) {
      toggleToolbarItemActive(boldDom, rangeStyle.bold)
    }
    const italicDom = toolbarContainer.querySelector<HTMLDivElement>(
      `.${PLUGIN_PREFIX}-italic`
    )
    if (italicDom) {
      toggleToolbarItemActive(italicDom, rangeStyle.italic)
    }
    const underlineDom = toolbarContainer.querySelector<HTMLDivElement>(
      `.${PLUGIN_PREFIX}-underline`
    )
    if (underlineDom) {
      toggleToolbarItemActive(underlineDom, rangeStyle.underline)
    }
    const strikeoutDom = toolbarContainer.querySelector<HTMLDivElement>(
      `.${PLUGIN_PREFIX}-strikeout`
    )
    if (strikeoutDom) {
      toggleToolbarItemActive(strikeoutDom, rangeStyle.strikeout)
    }
    // toggleToolbarVisible(toolbarContainer, true)
  })
}

// 用于存储setTimeout返回的定时器ID
const toggleToolbarTimeoutId: NodeJS.Timeout | null = null

/**
 * 外部控制工具栏显隐
 */
export function toggleToolbarByOther(visible: boolean, targetInfo: { id: string, type: string } = {
  id:'',
  type:''
}, position?: {
  x: number,
  y: number
}) {
  nowtargetId = targetInfo.id
  nowTargetType = targetInfo.type
  if (toggleToolbarTimeoutId) {
    clearTimeout(toggleToolbarTimeoutId)
  }
  // toggleToolbarTimeoutId = setTimeout(() => {
  if (toolbarContainer) {
    if (position && !isInside) {
      toolbarContainer.style.left = `${position.x}px`
      toolbarContainer.style.top = `${position.y - 36 - 8}px`
    }
    toggleToolbarVisible(toolbarContainer, visible)
  }
  // }, 500)
}

/**
 * 根据光标设置浮动窗口位置
 */
// function setPositionByRange(position?: IElementFillRect) {
//   if (CEditor && toolbarContainer) {
//     const context = CEditor.command.getRangeContext()
//     if (!context || context.isCollapsed || !context.rangeRects[0]) {
//       toggleToolbarVisible(toolbarContainer, false)
//       return
//     }
//     // 定位
//     position = position ? position : context.rangeRects[0]
//     toolbarContainer.style.left = `${position.x}px`
//     toolbarContainer.style.top = `${position.y + position.height}px`
//   }
// }
