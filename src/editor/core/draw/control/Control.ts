import { ControlComponent, ControlType } from '../../../dataset/enum/Control'
import { EditorZone } from '../../../dataset/enum/Editor'
import { ElementType } from '../../../dataset/enum/Element'
import { DeepRequired } from '../../../interface/Common'
import {
  IControl,
  IControlContext,
  IControlHighlight,
  IControlInitOption,
  IControlInstance,
  IControlOption,
  IControlRuleOption,
  IGetControlValueOption,
  IGetControlValueResult,
  IInitNextControlOption,
  INextControlContext,
  IRepaintControlOption,
  ISetControlExtensionOption,
  ISetControlProperties,
  ISetControlValueOption
} from '../../../interface/Control'
import { IEditorData, IEditorOption } from '../../../interface/Editor'
import { IElement, IElementPosition } from '../../../interface/Element'
import { EventBusMap } from '../../../interface/EventBus'
import { IRange } from '../../../interface/Range'
import { deepClone, nextTick, splitText } from '../../../utils'
import {
  formatElementContext,
  formatElementList,
  pickElementAttr,
  zipElementList
} from '../../../utils/element'
import { EventBus } from '../../event/eventbus/EventBus'
import { Listener } from '../../listener/Listener'
import { RangeManager } from '../../range/RangeManager'
import { Draw } from '../Draw'
import { CheckboxControl } from './checkbox/CheckboxControl'
import { RadioControl } from './radio/RadioControl'
import { ControlSearch } from './interactive/ControlSearch'
import { ControlBorder } from './richtext/Border'
import { SelectControl } from './select/SelectControl'
import { TextControl } from './text/TextControl'
import { DateControl } from './date/DateControl'
import { FormControl } from './form/FormControl'
import { EDITOR_PREFIX } from '../../../dataset/constant/Editor'
import { toggleToolbarByOther } from '../../../../plugins/floatingToolbar'
import { MoveDirection } from '../../../dataset/enum/Observer'
import { IRowElement } from '../../../interface/Row'

interface IMoveCursorResult {
  newIndex: number
  newElement: IElement
}

export class Control {
  private controlBorder: ControlBorder
  private draw: Draw
  private range: RangeManager
  private listener: Listener
  private eventBus: EventBus<EventBusMap>
  private controlSearch: ControlSearch
  private options: DeepRequired<IEditorOption>
  private controlOptions: IControlOption
  private activeControl: IControlInstance | null
  private shadowBoxList: HTMLDivElement[] = []
  public controlGroupMap: Map<string, string[]> = new Map()
  public controlToGroupMap: Map<string, string> = new Map()

  constructor(draw: Draw) {
    this.controlBorder = new ControlBorder(draw)

    this.draw = draw
    this.range = draw.getRange()
    this.listener = draw.getListener()
    this.eventBus = draw.getEventBus()
    this.controlSearch = new ControlSearch(this)

    this.options = draw.getOptions()
    this.controlOptions = this.options.control
    this.activeControl = null
  }

  // 搜索高亮匹配
  public setHighlightList(payload: IControlHighlight[]) {
    this.controlSearch.setHighlightList(payload)
  }

  public computeHighlightList() {
    const highlightList = this.controlSearch.getHighlightList()
    if (highlightList.length) {
      this.controlSearch.computeHighlightList()
    }
  }

  public renderHighlightList(ctx: CanvasRenderingContext2D, pageNo: number) {
    const highlightMatchResult = this.controlSearch.getHighlightMatchResult()
    if (highlightMatchResult.length) {
      this.controlSearch.renderHighlightList(ctx, pageNo)
    }
  }

  public getDraw(): Draw {
    return this.draw
  }

  // 过滤控件辅助元素（前后缀、背景提示）
  public filterAssistElement(elementList: IElement[]): IElement[] {
    return elementList.filter(element => {
      if (element.type === ElementType.TABLE) {
        const trList = element.trList!
        for (let r = 0; r < trList.length; r++) {
          const tr = trList[r]
          for (let d = 0; d < tr.tdList.length; d++) {
            const td = tr.tdList[d]
            td.value = this.filterAssistElement(td.value)
          }
        }
      }
      if (!element.controlId) return true
      if (element.control?.minWidth) {
        if (
          element.controlComponent === ControlComponent.PREFIX ||
          element.controlComponent === ControlComponent.POSTFIX
        ) {
          element.value = ''
          return true
        }
      }
      return (
        element.controlComponent !== ControlComponent.PREFIX &&
        element.controlComponent !== ControlComponent.POSTFIX &&
        element.controlComponent !== ControlComponent.PLACEHOLDER
      )
    })
  }

  // 是否属于控件可以捕获事件的选区
  public getIsRangeCanCaptureEvent(): boolean {
    if (!this.activeControl) return false
    const { startIndex, endIndex } = this.getRange()
    if (!~startIndex && !~endIndex) return false
    const elementList = this.getElementList()
    const startElement = elementList[startIndex]
    // 闭合光标在后缀处
    if (
      startIndex === endIndex &&
      startElement.controlComponent === ControlComponent.POSTFIX
    ) {
      return true
    }
    // 在控件内
    const endElement = elementList[endIndex]
    if (
      startElement.controlId &&
      startElement.controlId === endElement.controlId &&
      endElement.controlComponent !== ControlComponent.POSTFIX
    ) {
      return true
    }
    return false
  }

  // 判断选区是否在后缀处
  public getIsRangeInPostfix(): boolean {
    if (!this.activeControl) return false
    const { startIndex, endIndex } = this.getRange()
    if (startIndex !== endIndex) return false
    const elementList = this.getElementList()
    const element = elementList[startIndex]
    return element.controlComponent === ControlComponent.POSTFIX
  }

  // 判断选区是否在控件内
  public getIsRangeWithinControl(): boolean {
    const { startIndex, endIndex } = this.getRange()
    if (!~startIndex && !~endIndex) return false
    const elementList = this.getElementList()
    const startElement = elementList[startIndex]
    const endElement = elementList[endIndex]
    if (
      startElement.controlId &&
      startElement.controlId === endElement.controlId &&
      endElement.controlComponent !== ControlComponent.POSTFIX
    ) {
      return true
    }
    return false
  }

  public getIsDisabledControl(): boolean {
    return !!this.activeControl?.getElement().control?.disabled
  }

  public getContainer(): HTMLDivElement {
    return this.draw.getContainer()
  }

  public getElementList(): IElement[] {
    return this.draw.getElementList()
  }

  /**
   * 获取控件元素列表
   */
  public getControlElementList(): { controlElementList: IElement[], controlPositionList: IElementPosition[] } {
    const { startIndex } = this.range.getRange()
    const elementList = this.getElementList()
    const positionList = this.draw.getPosition().getPositionList()

    const controlId = this.activeControl?.getElement().controlId
    const controlGroupId = this.activeControl?.getElement().controlGroupId
    //   根据控件id查找对应的元素列表
    const controlElementList: IElement[] = []
    const controlPositionList = []

    // 通过startIndex在elementList中向左向右找，并返回最有一个匹配控件id的选项
    for (let i = startIndex; i >= 0; i--) {
      const element = elementList[i]
      if (controlGroupId && controlGroupId === element.controlGroupId) {
        controlElementList.unshift(element)
        controlPositionList.unshift(positionList[i])
      } else if (element.controlId === controlId) {
        controlElementList.unshift(element)
        controlPositionList.unshift(positionList[i])
      } else {
        break
      }
    }
    // 向右找

    for (let i = startIndex + 1; i < elementList.length; i++) {
      const element = elementList[i]
      if (controlGroupId && controlGroupId === element.controlGroupId) {
        controlElementList.push(element)
        controlPositionList.push(positionList[i])
      } else if (element.controlId === controlId) {
        controlElementList.push(element)
        controlPositionList.push(positionList[i])
      } else {
        break
      }
    }
    return { controlElementList, controlPositionList }
  }

  public getPosition(): IElementPosition | null {
    const positionList = this.draw.getPosition().getPositionList()
    const { endIndex } = this.range.getRange()
    return positionList[endIndex] || null
  }

  public getPreY(): number {
    const height = this.draw.getHeight()
    const pageGap = this.draw.getPageGap()
    const pageNo = this.getPosition()?.pageNo ?? this.draw.getPageNo()
    return pageNo * (height + pageGap)
  }

  public getRange(): IRange {
    return this.range.getRange()
  }

  public shrinkBoundary(context: IControlContext = {}) {
    this.range.shrinkBoundary(context)
  }

  public getActiveControl(): IControlInstance | null {
    return this.activeControl
  }

  public initControl() {
    const isReadonly = this.draw.isReadonly()
    if (isReadonly) return
    const elementList = this.getElementList()
    const range = this.getRange()
    const element = elementList[range.startIndex]
    // 判断控件是否已经激活
    if (this.activeControl) {
      // 弹窗类控件唤醒弹窗，后缀处移除弹窗
      if (
        this.activeControl instanceof SelectControl ||
        this.activeControl instanceof DateControl
      ) {
        if (element.controlComponent === ControlComponent.POSTFIX) {
          this.activeControl.destroy()
        } else {
          this.activeControl.awake()
        }
      }
      const controlElement = this.activeControl.getElement()
      if (element.controlId === controlElement.controlId) return
    }
    // 销毁旧激活控件
    this.destroyControl()
    // 激活控件
    const control = element.control!
    if (control.type === ControlType.TEXT) {
      this.activeControl = new TextControl(element, this)
    } else if (control.type === ControlType.SELECT) {
      const selectControl = new SelectControl(element, this)
      this.activeControl = selectControl
      selectControl.awake()
    } else if (control.type === ControlType.CHECKBOX) {
      this.activeControl = new CheckboxControl(element, this)
    } else if (control.type === ControlType.RADIO) {
      this.activeControl = new RadioControl(element, this)
    } else if (control.type === ControlType.FORM) {
      this.activeControl = new FormControl(element, this)
    } else if (control.type === ControlType.DATE) {
      const dateControl = new DateControl(element, this)
      this.activeControl = dateControl
      dateControl.awake()
    }

    // 激活控件回调
    nextTick(() => {
      if (control.type !== ControlType.FORM) {
        const controlChangeListener = this.listener.controlChange
        const isSubscribeControlChange =
          this.eventBus.isSubscribe('controlChange')
        if (!controlChangeListener && !isSubscribeControlChange) return
        let payload: IControl
        const value = this.activeControl?.getValue()
        if (value && value.length) {
          payload = zipElementList(value)[0].control!
        } else {
          payload = pickElementAttr(deepClone(element)).control!
        }
        if (controlChangeListener) {
          controlChangeListener(payload)
        }
        if (isSubscribeControlChange) {
          this.eventBus.emit('controlChange', payload)
        }
        this.renderShadowBox()
      } else {
        console.log('表单控件激活')
        this.renderShadowBox()
      }
    })
  }

  public destroyControl() {
    if (this.activeControl) {
      if (
        this.activeControl instanceof SelectControl ||
        this.activeControl instanceof DateControl
      ) {
        this.activeControl.destroy()
      }
      this.activeControl = null
      this.destroyShadowBox()
      // 销毁控件回调
      nextTick(() => {
        const controlChangeListener = this.listener.controlChange
        const isSubscribeControlChange =
          this.eventBus.isSubscribe('controlChange')
        if (!controlChangeListener && !isSubscribeControlChange) return
        if (controlChangeListener) {
          controlChangeListener(null)
        }
        if (isSubscribeControlChange) {
          this.eventBus.emit('controlChange', null)
        }
      })
    }
  }

  public repaintControl(options: IRepaintControlOption = {}) {
    const { curIndex, isCompute = true, isSubmitHistory = true } = options
    // 重新渲染
    if (curIndex === undefined) {
      this.range.clearRange()
      this.draw.render({
        isCompute,
        isSubmitHistory,
        isSetCursor: false
      })
    } else {
      this.range.setRange(curIndex, curIndex)
      this.draw.render({
        curIndex,
        isCompute,
        isSubmitHistory
      })
    }
  }

  public reAwakeControl() {
    if (!this.activeControl) return
    const elementList = this.getElementList()
    const range = this.getRange()
    const element = elementList[range.startIndex]
    this.activeControl.setElement(element)
    if (
      (this.activeControl instanceof DateControl ||
        this.activeControl instanceof SelectControl) &&
      this.activeControl.getIsPopup()
    ) {
      this.activeControl.destroy()
      this.activeControl.awake()
    }
  }

  public moveCursor(position: IControlInitOption): IMoveCursorResult {
    const { index, trIndex, tdIndex, tdValueIndex } = position
    let elementList = this.draw.getOriginalElementList()
    let element: IElement
    const newIndex = position.isTable ? tdValueIndex! : index
    if (position.isTable) {
      elementList = elementList[index!].trList![trIndex!].tdList[tdIndex!].value
      element = elementList[tdValueIndex!]
    } else {
      element = elementList[index]
    }
    if (element.controlComponent === ControlComponent.VALUE) {
      // VALUE-无需移动
      return {
        newIndex,
        newElement: element
      }
    } else if (element.controlComponent === ControlComponent.POSTFIX) {
      // POSTFIX-移动到最后一个后缀字符后
      let startIndex = newIndex + 1
      while (startIndex < elementList.length) {
        const nextElement = elementList[startIndex]
        if (nextElement.controlId !== element.controlId) {
          return {
            newIndex: startIndex - 1,
            newElement: elementList[startIndex - 1]
          }
        }
        startIndex++
      }
    } else if (element.controlComponent === ControlComponent.PREFIX) {
      // PREFIX-移动到最后一个前缀字符后
      let startIndex = newIndex + 1
      while (startIndex < elementList.length) {
        const nextElement = elementList[startIndex]
        if (
          nextElement.controlId !== element.controlId ||
          nextElement.controlComponent !== ControlComponent.PREFIX
        ) {
          return {
            newIndex: startIndex - 1,
            newElement: elementList[startIndex - 1]
          }
        }
        startIndex++
      }
    } else if (element.controlComponent === ControlComponent.PLACEHOLDER) {
      // PLACEHOLDER-移动到第一个前缀后
      let startIndex = newIndex - 1
      while (startIndex > 0) {
        const preElement = elementList[startIndex]
        if (
          preElement.controlId !== element.controlId ||
          preElement.controlComponent === ControlComponent.PREFIX
        ) {
          return {
            newIndex: startIndex,
            newElement: elementList[startIndex]
          }
        }
        startIndex--
      }
    }
    return {
      newIndex,
      newElement: element
    }
  }

  public removeControl(
    startIndex: number,
    context: IControlContext = {}
  ): number | null {
    const elementList = context.elementList || this.getElementList()
    const startElement = elementList[startIndex]
    const { deletable = true } = startElement.control!
    if (!deletable) return null
    let leftIndex = -1
    let rightIndex = -1
    // 向左查找
    const startId = startElement.controlGroupId || startElement.controlId
    let preIndex = startIndex
    while (preIndex > 0) {
      const preElement = elementList[preIndex]
      const id = preElement.controlGroupId || preElement.controlId
      if (id !== startId) {
        leftIndex = preIndex
        break
      }
      preIndex--
    }
    // 向右查找
    let nextIndex = startIndex + 1
    while (nextIndex < elementList.length) {
      const nextElement = elementList[nextIndex]
      const id = nextElement.controlGroupId || nextElement.controlId
      if (id !== startId) {
        rightIndex = nextIndex - 1
        break
      }
      nextIndex++
    }
    // 控件在最后
    if (nextIndex === elementList.length) {
      rightIndex = nextIndex - 1
    }
    if (!~leftIndex && !~rightIndex) return startIndex
    leftIndex = ~leftIndex ? leftIndex : 0
    // 删除元素
    this.draw.spliceElementList(
      elementList,
      leftIndex + 1,
      rightIndex - leftIndex
    )
    return leftIndex
  }

  public removePlaceholder(startIndex: number, context: IControlContext = {}) {
    const elementList = context.elementList || this.getElementList()
    const startElement = elementList[startIndex]
    const nextElement = elementList[startIndex + 1]
    if (
      startElement.controlComponent === ControlComponent.PLACEHOLDER ||
      nextElement.controlComponent === ControlComponent.PLACEHOLDER
    ) {
      let isHasSubmitHistory = false
      let index = startIndex
      while (index < elementList.length) {
        const curElement = elementList[index]
        if (curElement.controlId !== startElement.controlId) break
        if (curElement.controlComponent === ControlComponent.PLACEHOLDER) {
          // 删除占位符时替换前一个历史记录
          if (!isHasSubmitHistory) {
            isHasSubmitHistory = true
            this.draw.getHistoryManager().popUndo()
            this.draw.submitHistory(startIndex)
          }
          elementList.splice(index, 1)
        } else {
          index++
        }
      }
    }
  }

  public addPlaceholder(startIndex: number, context: IControlContext = {}) {
    const elementList = context.elementList || this.getElementList()
    const startElement = elementList[startIndex]
    const control = startElement.control!
    if (!control.placeholder) return
    const placeholderStrList = splitText(control.placeholder)
    for (let p = 0; p < placeholderStrList.length; p++) {
      const value = placeholderStrList[p]
      const newElement: IElement = {
        value,
        controlId: startElement.controlId,
        controlGroupId: startElement.controlGroupId,
        type: ElementType.CONTROL,
        control: startElement.control,
        controlComponent: ControlComponent.PLACEHOLDER,
        color: this.controlOptions.placeholderColor
      }
      formatElementContext(elementList, [newElement], startIndex)
      this.draw.spliceElementList(
        elementList,
        startIndex + p + 1,
        0,
        newElement
      )
    }
  }

  public setValue(data: IElement[]): number {
    if (!this.activeControl) {
      throw new Error('active control is null')
    }
    return this.activeControl.setValue(data)
  }

  public keydown(evt: KeyboardEvent): number | null {
    if (!this.activeControl) {
      throw new Error('active control is null')
    }
    return this.activeControl.keydown(evt)
  }

  public cut(): number {
    if (!this.activeControl) {
      throw new Error('active control is null')
    }
    return this.activeControl.cut()
  }

  public getValueByConceptId(
    payload: IGetControlValueOption
  ): IGetControlValueResult {
    const { conceptId } = payload
    const result: IGetControlValueResult = []
    const getValue = (elementList: IElement[], zone: EditorZone) => {
      let i = 0
      while (i < elementList.length) {
        const element = elementList[i]
        i++
        // 表格下钻处理
        if (element.type === ElementType.TABLE) {
          const trList = element.trList!
          for (let r = 0; r < trList.length; r++) {
            const tr = trList[r]
            for (let d = 0; d < tr.tdList.length; d++) {
              const td = tr.tdList[d]
              getValue(td.value, zone)
            }
          }
        }
        if (element?.control?.conceptId !== conceptId) continue
        const { type, code, valueSets } = element.control!
        let j = i
        let textControlValue = ''
        while (j < elementList.length) {
          const nextElement = elementList[j]
          if (nextElement.controlId !== element.controlId) break
          if (
            (type === ControlType.TEXT || type === ControlType.DATE) &&
            nextElement.controlComponent === ControlComponent.VALUE
          ) {
            textControlValue += nextElement.value
          }
          j++
        }
        if (type === ControlType.TEXT || type === ControlType.DATE) {
          result.push({
            ...element.control,
            zone,
            value: textControlValue || null,
            innerText: textControlValue || null
          })
        } else if (
          type === ControlType.SELECT ||
          type === ControlType.CHECKBOX ||
          type === ControlType.RADIO
        ) {
          const innerText = code
            ?.split(',')
            .map(
              // @ts-ignore
              selectCode =>
                // @ts-ignore
                valueSets?.find(valueSet => valueSet.code === selectCode)?.value
            )
            .filter(Boolean)
            .join('')
          result.push({
            ...element.control,
            zone,
            value: code || null,
            innerText: innerText || null
          })
        }
        i = j
      }
    }
    const data = [
      {
        zone: EditorZone.HEADER,
        elementList: this.draw.getHeaderElementList()
      },
      {
        zone: EditorZone.MAIN,
        elementList: this.draw.getOriginalMainElementList()
      },
      {
        zone: EditorZone.FOOTER,
        elementList: this.draw.getFooterElementList()
      }
    ]
    for (const { zone, elementList } of data) {
      getValue(elementList, zone)
    }
    return result
  }

  public setValueByConceptId(payload: ISetControlValueOption) {
    const isReadonly = this.draw.isReadonly()
    if (isReadonly) return
    let isExistSet = false
    // todo 原本为conceptId，修改为controlId
    const { controlId, value } = payload
    // 设置值
    const setValue = (elementList: IElement[]) => {
      let i = 0
      while (i < elementList.length) {
        const element = elementList[i]
        i++
        // 表格下钻处理
        if (element.type === ElementType.TABLE) {
          const trList = element.trList!
          for (let r = 0; r < trList.length; r++) {
            const tr = trList[r]
            for (let d = 0; d < tr.tdList.length; d++) {
              const td = tr.tdList[d]
              setValue(td.value)
            }
          }
        }
        if (element?.controlId !== controlId) continue
        isExistSet = true
        const { type } = element.control!
        // 当前控件结束索引
        let currentEndIndex = i
        while (currentEndIndex < elementList.length) {
          const nextElement = elementList[currentEndIndex]
          if (nextElement.controlId !== element.controlId) break
          currentEndIndex++
        }
        // 模拟光标选区上下文
        const fakeRange = {
          startIndex: i - 1,
          endIndex: currentEndIndex - 2
        }
        const controlContext: IControlContext = {
          range: fakeRange,
          elementList
        }
        const controlRule: IControlRuleOption = {
          isIgnoreDisabledRule: true
        }
        if (type === ControlType.TEXT) {
          const formatValue = [{ value }]
          formatElementList(formatValue, {
            isHandleFirstElement: false,
            editorOptions: this.options
          })
          const text = new TextControl(element, this)
          this.activeControl = text
          if (value) {
            text.setValue(formatValue, controlContext, controlRule)
          } else {
            text.clearValue(controlContext, controlRule)
          }
        } else if (type === ControlType.SELECT) {
          const select = new SelectControl(element, this)
          this.activeControl = select
          if (value) {
            select.setSelect(value, controlContext, controlRule)
          } else {
            select.clearSelect(controlContext, controlRule)
          }
        } else if (type === ControlType.CHECKBOX) {
          const checkbox = new CheckboxControl(element, this)
          this.activeControl = checkbox
          const codes = value?.split(',') || []
          checkbox.setSelect(codes, controlContext, controlRule)
        } else if (type === ControlType.RADIO) {
          const radio = new RadioControl(element, this)
          this.activeControl = radio
          const codes = value ? [value] : []
          radio.setSelect(codes, controlContext, controlRule)
        } else if (type === ControlType.DATE) {
          const date = new DateControl(element, this)
          this.activeControl = date
          if (value) {
            date.setSelect(value, controlContext, controlRule)
          } else {
            date.clearSelect(controlContext, controlRule)
          }
        }
        // 模拟控件激活后销毁
        this.activeControl = null
        // 修改后控件结束索引
        let newEndIndex = i
        while (newEndIndex < elementList.length) {
          const nextElement = elementList[newEndIndex]
          if (nextElement.controlId !== element.controlId) break
          newEndIndex++
        }
        i = newEndIndex
      }
    }
    // 销毁旧控件
    this.destroyControl()
    // 页眉、内容区、页脚同时处理
    const data = [
      this.draw.getHeaderElementList(),
      this.draw.getOriginalMainElementList(),
      this.draw.getFooterElementList()
    ]
    for (const elementList of data) {
      setValue(elementList)
    }
    if (isExistSet) {
      this.draw.render({
        isSetCursor: false
      })
    }
  }

  public setExtensionByConceptId(payload: ISetControlExtensionOption) {
    const isReadonly = this.draw.isReadonly()
    if (isReadonly) return
    const { conceptId, extension } = payload
    const setExtension = (elementList: IElement[]) => {
      let i = 0
      while (i < elementList.length) {
        const element = elementList[i]
        i++
        // 表格下钻处理
        if (element.type === ElementType.TABLE) {
          const trList = element.trList!
          for (let r = 0; r < trList.length; r++) {
            const tr = trList[r]
            for (let d = 0; d < tr.tdList.length; d++) {
              const td = tr.tdList[d]
              setExtension(td.value)
            }
          }
        }
        if (element?.control?.conceptId !== conceptId) continue
        element.control.extension = extension
        // 修改后控件结束索引
        let newEndIndex = i
        while (newEndIndex < elementList.length) {
          const nextElement = elementList[newEndIndex]
          if (nextElement.controlId !== element.controlId) break
          newEndIndex++
        }
        i = newEndIndex
      }
    }
    const data = [
      this.draw.getHeaderElementList(),
      this.draw.getOriginalMainElementList(),
      this.draw.getFooterElementList()
    ]
    for (const elementList of data) {
      setExtension(elementList)
    }
  }

  public setPropertiesByConceptId(payload: ISetControlProperties) {
    const isReadonly = this.draw.isReadonly()
    if (isReadonly) return
    const { conceptId, properties } = payload
    let isExistUpdate = false
    const pageComponentData: IEditorData = {
      header: this.draw.getHeaderElementList(),
      main: this.draw.getOriginalMainElementList(),
      footer: this.draw.getFooterElementList()
    }
    for (const key in pageComponentData) {
      const elementList = pageComponentData[<keyof IEditorData>key]!
      let i = 0
      while (i < elementList.length) {
        const element = elementList[i]
        i++
        if (element?.control?.conceptId !== conceptId) continue
        isExistUpdate = true
        element.control = {
          ...element.control,
          ...properties,
          value: element.control.value
        }
        // 修改后控件结束索引
        let newEndIndex = i
        while (newEndIndex < elementList.length) {
          const nextElement = elementList[newEndIndex]
          if (nextElement.controlId !== element.controlId) break
          newEndIndex++
        }
        i = newEndIndex
      }
    }
    if (!isExistUpdate) return
    // 强制更新
    for (const key in pageComponentData) {
      const pageComponentKey = <keyof IEditorData>key
      const elementList = zipElementList(pageComponentData[pageComponentKey]!)
      pageComponentData[pageComponentKey] = elementList
      formatElementList(elementList, {
        editorOptions: this.options
      })
    }
    this.draw.setEditorData(pageComponentData)
    this.draw.render({
      isSetCursor: false
    })
  }

  public getList(): IElement[] {
    const controlElementList: IElement[] = []
    function getControlElementList(elementList: IElement[]) {
      for (let e = 0; e < elementList.length; e++) {
        const element = elementList[e]
        if (element.type === ElementType.TABLE) {
          const trList = element.trList!
          for (let r = 0; r < trList.length; r++) {
            const tr = trList[r]
            for (let d = 0; d < tr.tdList.length; d++) {
              const td = tr.tdList[d]
              const tdElement = td.value
              getControlElementList(tdElement)
            }
          }
        }
        if (element.controlId) {
          controlElementList.push(element)
        }
      }
    }
    const data = [
      this.draw.getHeader().getElementList(),
      this.draw.getOriginalMainElementList(),
      this.draw.getFooter().getElementList()
    ]
    for (const elementList of data) {
      getControlElementList(elementList)
    }
    return zipElementList(controlElementList, {
      extraPickAttrs: ['controlId']
    })
  }

  public recordBorderInfo(x: number, y: number, width: number, height: number) {
    this.controlBorder.recordBorderInfo(x, y, width, height)
  }

  public drawBorder(ctx: CanvasRenderingContext2D) {
    this.controlBorder.render(ctx)
  }

  /**
   * 绘制控件背景框
   */
  public renderShadowBox(): void {
    // 获取控件尺寸信息
    const controlId = this.activeControl?.getElement().controlId
    const controlGroupId = this.activeControl?.getElement().controlGroupId
    const id = controlGroupId ?? controlId
    if (!id) return
    console.log(id, `是控件组吗：${id === controlId}`)
    const { controlPositionList } = this.getControlElementList()
    // console.table(controlPositionList)
    const { rowNo: startRowNo, pageNo: startPageNo } = controlPositionList[0]
    const { rowNo: endRowNo, pageNo: endPageNo } = controlPositionList[controlPositionList.length - 1]
    // let height = controlPositionList[0].lineHeight
    const x = controlPositionList[0].coordinate.leftTop[0]
    let y = controlPositionList[0].coordinate.leftTop[1]
    const endY = controlPositionList[controlPositionList.length - 1].coordinate.leftTop[1]
    // let rowHeight = rowList[rowNo].height
    const pageRowList = this.draw.getPageRowList()
    const nowPageRowList = pageRowList.slice(startPageNo, endPageNo + 1)
    console.log(pageRowList)
    console.log(controlPositionList[controlPositionList.length - 1])
    // console.log(startRowNo, endRowNo)
    // 循环行内容列表
    const isHaveValue = (rowElementList: IRowElement[]) => {
      let haveValue = false
      let width = 0
      for (let i = 0; i <= rowElementList.length; i++) {
        if ((rowElementList[i].controlGroupId ?? rowElementList[i].controlId) === id) {
          break
        } else if (rowElementList[i].value.replace(/[\u200b\s]/g, '') !== '') {
          haveValue = true
          width += rowElementList[i].metrics.width
        }
      }
      return { haveValue, width }
    }
    const {
      haveValue: startHaveValue,
      width: startWidth
    } = isHaveValue(pageRowList[startPageNo][startRowNo].elementList)
    const {
      haveValue: endHaveValue,
      width: endWidth
      // @ts-ignore
    } = isHaveValue(pageRowList[endPageNo][endRowNo].elementList.toReversed())

    console.log(startHaveValue, endHaveValue)

    const baseWidth = this.options.width - this.options.margins[1] - this.options.margins[3]
    const baseX = this.options.margins[3]
    const baseY = this.options.margins[0]
    // const basePageHeight = this.options.height + this.options.pageGap
    // 如果只有一页，并且只有一行，直接绘制
    if (nowPageRowList.length === 1 && endRowNo === startRowNo) {
      this.generateShadowBox(x, y, nowPageRowList[0][0].width, nowPageRowList[0][0].height, id, startPageNo)
    } else {
      nowPageRowList.forEach((rowList, pageIndex) => {
        let height = 0
        rowList.forEach((row, rowIndex) => {
          // 如果是第一行并且非起始位置，设置阴影块
          if (pageIndex === 0 && rowIndex === startRowNo && startHaveValue) {
            this.generateShadowBox(x, y, baseWidth - startWidth, row.height, id, pageIndex + startPageNo)
            y += row.height
            return
          }
          // 如果是最后一行并且后续还有内容，设置阴影块
          else if (pageIndex === nowPageRowList.length - 1 && rowIndex === endRowNo && endHaveValue) {
            this.generateShadowBox(baseX, endY, row.width - endWidth, row.height, id, pageIndex + startPageNo)
          }
          // 如果是中间放，则添加高度，设置为一整块
          else {
            if ((pageIndex === nowPageRowList.length - 1 && rowIndex > endRowNo)
              || (pageIndex === 0 && rowIndex < startRowNo)) return
            height += row.height
          }
        })
        // 如果高度不等于0，则设置中间阴影块，，x为基准x，y根据是否是第一页判断，宽度为基准宽
        if (height !== 0)
          this.generateShadowBox(baseX, pageIndex === 0 ? y : baseY, baseWidth, height, id, pageIndex + startPageNo)
      })
    }

    toggleToolbarByOther(true, { id: id, type: 'control' }, {
      x,
      y: y + startPageNo * (this.options.height + this.options.pageGap)
    })
  }

  /**
   * 销毁控件背景框
   */
  public destroyShadowBox(): void {
    console.log('触发销毁')
    // 删除所有的控件背景框
    this.shadowBoxList.forEach((shadowBox) => {
      shadowBox.remove()
    })
    this.shadowBoxList = []
    toggleToolbarByOther(false)
  }

  /**
   * 生成控件背景框
   */
  public generateShadowBox(x: number, y: number, width: number, height: number, controlId: string, pageNo: number): void {
    const baseY = pageNo * (this.options.height + this.options.pageGap)
    // todo 根据pageNo修改top
    // todo 单页上宽度，left相同的合为一个shadow框
    const shadowBox = document.createElement('div')
    shadowBox.classList.add(`${EDITOR_PREFIX}-control-shadowBox`)
    // shadowBox.style.position = 'absolute'
    shadowBox.style.left = `${x}px`
    shadowBox.style.top = `${y + baseY}px`
    shadowBox.style.width = `${width}px`
    shadowBox.style.height = `${height}px`
    shadowBox.setAttribute('data-controlId', controlId)
    const container = this.draw.getContainer()
    container.append(shadowBox)
    this.shadowBoxList.push(shadowBox)
    console.log(x, y, width, height)
  }

  public getPreControlContext(): INextControlContext | null {
    if (!this.activeControl) return null
    const position = this.draw.getPosition()
    const positionContext = position.getPositionContext()
    if (!positionContext) return null
    const controlElement = this.activeControl.getElement()

    // 获取上一个控件上下文本信息
    function getPreContext(
      elementList: IElement[],
      start: number
    ): INextControlContext | null {
      for (let e = start; e > 0; e--) {
        const element = elementList[e]
        // 表格元素
        if (element.type === ElementType.TABLE) {
          const trList = element.trList || []
          for (let r = trList.length - 1; r >= 0; r--) {
            const tr = trList[r]
            const tdList = tr.tdList
            for (let d = tdList.length - 1; d >= 0; d--) {
              const td = tdList[d]
              const context = getPreContext(td.value, td.value.length - 1)
              if (context) {
                return {
                  positionContext: {
                    isTable: true,
                    index: e,
                    trIndex: r,
                    tdIndex: d,
                    tdId: td.id,
                    trId: tr.id,
                    tableId: element.id
                  },
                  nextIndex: context.nextIndex
                }
              }
            }
          }
        }
        if (
          !element.controlId ||
          element.controlId === controlElement.controlId
        ) {
          continue
        }
        // 找到尾部第一个非占位符元素
        let nextIndex = e
        while (nextIndex > 0) {
          const nextElement = elementList[nextIndex]
          if (
            nextElement.controlComponent === ControlComponent.VALUE ||
            nextElement.controlComponent === ControlComponent.PREFIX
          ) {
            break
          }
          nextIndex--
        }
        return {
          positionContext: {
            isTable: false
          },
          nextIndex
        }
      }
      return null
    }

    // 当前上下文控件信息
    const { startIndex } = this.range.getRange()
    const elementList = this.getElementList()
    const context = getPreContext(elementList, startIndex)
    if (context) {
      return {
        positionContext: positionContext.isTable
          ? positionContext
          : context.positionContext,
        nextIndex: context.nextIndex
      }
    }
    // 控件在单元内时继续循环
    if (controlElement.tableId) {
      const originalElementList = this.draw.getOriginalElementList()
      const { index, trIndex, tdIndex } = positionContext
      const trList = originalElementList[index!].trList!
      for (let r = trIndex!; r >= 0; r--) {
        const tr = trList[r]
        const tdList = tr.tdList
        for (let d = tdList.length - 1; d >= 0; d--) {
          if (trIndex === r && d >= tdIndex!) continue
          const td = tdList[d]
          const context = getPreContext(td.value, td.value.length - 1)
          if (context) {
            return {
              positionContext: {
                isTable: true,
                index: positionContext.index,
                trIndex: r,
                tdIndex: d,
                tdId: td.id,
                trId: tr.id,
                tableId: controlElement.tableId
              },
              nextIndex: context.nextIndex
            }
          }
        }
      }
      // 跳出表格继续循环
      const context = getPreContext(originalElementList, index! - 1)
      if (context) {
        return {
          positionContext: {
            isTable: false
          },
          nextIndex: context.nextIndex
        }
      }
    }
    return null
  }

  public getNextControlContext(): INextControlContext | null {
    if (!this.activeControl) return null
    const position = this.draw.getPosition()
    const positionContext = position.getPositionContext()
    if (!positionContext) return null
    const controlElement = this.activeControl.getElement()

    // 获取下一个控件上下文本信息
    function getNextContext(
      elementList: IElement[],
      start: number
    ): INextControlContext | null {
      for (let e = start; e < elementList.length; e++) {
        const element = elementList[e]
        // 表格元素
        if (element.type === ElementType.TABLE) {
          const trList = element.trList || []
          for (let r = 0; r < trList.length; r++) {
            const tr = trList[r]
            const tdList = tr.tdList
            for (let d = 0; d < tdList.length; d++) {
              const td = tdList[d]
              const context = getNextContext(td.value!, 0)
              if (context) {
                return {
                  positionContext: {
                    isTable: true,
                    index: e,
                    trIndex: r,
                    tdIndex: d,
                    tdId: td.id,
                    trId: tr.id,
                    tableId: element.id
                  },
                  nextIndex: context.nextIndex
                }
              }
            }
          }
        }
        if (
          !element.controlId ||
          element.controlId === controlElement.controlId
        ) {
          continue
        }
        return {
          positionContext: {
            isTable: false
          },
          nextIndex: e
        }
      }
      return null
    }

    // 当前上下文控件信息
    const { endIndex } = this.range.getRange()
    const elementList = this.getElementList()
    const context = getNextContext(elementList, endIndex)
    if (context) {
      return {
        positionContext: positionContext.isTable
          ? positionContext
          : context.positionContext,
        nextIndex: context.nextIndex
      }
    }
    // 控件在单元内时继续循环
    if (controlElement.tableId) {
      const originalElementList = this.draw.getOriginalElementList()
      const { index, trIndex, tdIndex } = positionContext
      const trList = originalElementList[index!].trList!
      for (let r = trIndex!; r < trList.length; r++) {
        const tr = trList[r]
        const tdList = tr.tdList
        for (let d = 0; d < tdList.length; d++) {
          if (trIndex === r && d <= tdIndex!) continue
          const td = tdList[d]
          const context = getNextContext(td.value, 0)
          if (context) {
            return {
              positionContext: {
                isTable: true,
                index: positionContext.index,
                trIndex: r,
                tdIndex: d,
                tdId: td.id,
                trId: tr.id,
                tableId: controlElement.tableId
              },
              nextIndex: context.nextIndex
            }
          }
        }
      }
      // 跳出表格继续循环
      const context = getNextContext(originalElementList, index! + 1)
      if (context) {
        return {
          positionContext: {
            isTable: false
          },
          nextIndex: context.nextIndex
        }
      }
    }
    return null
  }

  public initNextControl(option: IInitNextControlOption = {}) {
    const { direction = MoveDirection.DOWN } = option
    let context: INextControlContext | null = null
    if (direction === MoveDirection.UP) {
      context = this.getPreControlContext()
    } else {
      context = this.getNextControlContext()
    }
    if (!context) return
    const { nextIndex, positionContext } = context
    const position = this.draw.getPosition()
    // 设置上下文
    position.setPositionContext(positionContext)
    this.draw.getRange().replaceRange({
      startIndex: nextIndex,
      endIndex: nextIndex
    })
    // 重新渲染并定位
    this.draw.render({
      curIndex: nextIndex,
      isCompute: false,
      isSetCursor: true,
      isSubmitHistory: false
    })
    const positionList = position.getPositionList()
    this.draw.getCursor().moveCursorToVisible({
      cursorPosition: positionList[nextIndex],
      direction
    })
  }

  // 设置对应控件组
  public setControlGroup(elementList: IElement[], controlGroupId?: string) {
    if (controlGroupId) {
      this.controlGroupMap.delete(controlGroupId)
    }
    const groupList: string[] = []
    elementList.forEach((element) => {
      const id = element.controlId || element.id
      if (id && !groupList.includes(id)) {
        groupList.push(id)
      }
    })
  }
}
