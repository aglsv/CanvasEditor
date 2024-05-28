import '@simonwep/pickr/dist/themes/nano.min.css'
// import Pickr from '@simonwep/pickr'
import Editor from '../../editor'
import './style/index.scss'
import { ToolbarType } from './enum'
import { IToolbarRegister } from './interface'
import { PLUGIN_PREFIX } from './constant'
import { IElementFillRect } from '../../editor/interface/Element'

let toolbarContainer: HTMLDivElement | null = null

let CEditor: Editor

let isInside = false
// function createPickerToolbar(
//   container: HTMLDivElement,
//   toolbarType: ToolbarType,
//   changed: (color: string) => void
// ) {
//   const toolbarItem = document.createElement('div')
//   toolbarItem.classList.add(`${PLUGIN_PREFIX}-picker`)
//   toolbarItem.classList.add(`${PLUGIN_PREFIX}-${toolbarType}`)
//   // 颜色选择容器
//   const pickerContainer = document.createElement('div')
//   pickerContainer.classList.add(`${PLUGIN_PREFIX}-picker-container`)
//   const pickerDom = document.createElement('div')
//   pickerContainer.append(pickerDom)
//   toolbarItem.append(pickerContainer)
//   container.append(toolbarItem)
//   // 实例化颜色选择器
//   const currentColor = '#000000'
//   const pickr = new Pickr({
//     el: pickerDom,
//     theme: 'nano',
//     useAsButton: true,
//     inline: true,
//     default: currentColor,
//     i18n: {
//       'btn:save': '✓'
//     },
//     components: {
//       preview: true,
//       opacity: true,
//       hue: true,
//       interaction: {
//         input: true,
//         save: true
//       }
//     }
//   })
//   const icon = document.createElement('i')
//   toolbarItem.append(icon)
//   const colorBar = document.createElement('span')
//   colorBar.style.backgroundColor = currentColor
//   toolbarItem.append(colorBar)
//   toolbarItem.onclick = evt => {
//     const target = evt.target as HTMLElement
//     if (pickerContainer !== target && !pickerContainer.contains(target)) {
//       pickr.show()
//     }
//   }
//   pickr.on('save', (cb: any) => {
//     pickr.hide()
//     const color = cb.toHEXA().toString()
//     colorBar.style.backgroundColor = color
//     changed(color)
//   })
// }


// 工具栏列表
const toolbarRegisterList: IToolbarRegister[] = [
  // {
  //   key: ToolbarType.SIZE_ADD,
  //   callback(editor) {
  //     editor.command.executeSizeAdd()
  //   }
  // },
  // {
  //   key: ToolbarType.SIZE_MINUS,
  //   callback(editor) {
  //     editor.command.executeSizeMinus()
  //   }
  // },
  // {
  //   isDivider: true
  // },
  // {
  //   key: ToolbarType.BOLD,
  //   callback(editor) {
  //     editor.command.executeBold()
  //   }
  // },
  // {
  //   key: ToolbarType.ITALIC,
  //   callback(editor) {
  //     editor.command.executeItalic()
  //   }
  // },
  // {
  //   key: ToolbarType.UNDERLINE,
  //   callback(editor) {
  //     editor.command.executeUnderline()
  //   }
  // },
  // {
  //   key: ToolbarType.STRIKEOUT,
  //   callback(editor) {
  //     editor.command.executeStrikeout()
  //   }
  // },
  {
    key: ToolbarType.EDITOR_VALUE,
    callback(editor) {
      // 获取当前活动控件
      editor.command.executeEditForm()
      toggleToolbarVisible(toolbarContainer!, false)
    }
  },
  // {
  //   isDivider: true
  // },
  // {
  //   render(container, editor) {
  //     createPickerToolbar(container, ToolbarType.COLOR, color => {
  //       editor.command.executeColor(color)
  //     })
  //   }
  // },
  // {
  //   render(container, editor) {
  //     createPickerToolbar(container, ToolbarType.HIGHLIGHT, color => {
  //       editor.command.executeHighlight(color)
  //     })
  //   }
  // }
]

function createToolbar(editor: Editor): HTMLDivElement {
  const toolbarContainer = document.createElement('div')
  toolbarContainer.classList.add(`${PLUGIN_PREFIX}-floating-toolbar`)
  for (const toolbar of toolbarRegisterList) {
    if (toolbar.render) {
      toolbar.render(toolbarContainer, editor)
    } else if (toolbar.isDivider) {
      const divider = document.createElement('div')
      divider.classList.add(`${PLUGIN_PREFIX}-divider`)
      toolbarContainer.append(divider)
    } else {
      const {key, callback} = toolbar
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
  CEditor = editor
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
let toggleToolbarTimeoutId: NodeJS.Timeout | null = null

/**
 * 外部控制工具栏显隐
 */
export function toggleToolbarByOther(visible: boolean, position?: { x: number, y: number }) {
  if (toggleToolbarTimeoutId) {
    clearTimeout(toggleToolbarTimeoutId)
  }
  // toggleToolbarTimeoutId = setTimeout(() => {
    if (toolbarContainer) {
      if (position && !isInside) {
        toolbarContainer.style.left = `${position.x}px`
        toolbarContainer.style.top = `${position.y + 10}px`
      }
      toggleToolbarVisible(toolbarContainer, visible)
    }
  // }, 500)
}

/**
 * 根据光标设置浮动窗口位置
 */
function setPositionByRange(position?: IElementFillRect) {
  if (CEditor && toolbarContainer) {
    const context = CEditor.command.getRangeContext()
    if (!context || context.isCollapsed || !context.rangeRects[0]) {
      toggleToolbarVisible(toolbarContainer, false)
      return
    }
    // 定位
    position = position ? position : context.rangeRects[0]
    toolbarContainer.style.left = `${position.x}px`
    toolbarContainer.style.top = `${position.y + position.height}px`
  }
}