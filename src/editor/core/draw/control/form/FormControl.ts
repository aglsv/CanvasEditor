/**
 * @Description:
 * @author zjw.
 * @date 2024/5/24.
 */
import { IElement } from '../../../../interface/Element'
import { Control } from '../Control'
import { IControlContext, IControlInstance, IControlRuleOption } from '../../../../interface/Control'
import { ControlComponent } from '../../../../dataset/enum/Control'
import { CONTROL_STYLE_ATTR, TEXTLIKE_ELEMENT_TYPE } from '../../../../dataset/constant/Element'
import { omitObject, pickObject } from '../../../../utils'
import { formatElementContext } from '../../../../utils/element'
import { Dialog } from '../../../../../components/dialog/Dialog'

export class FormControl implements IControlInstance{
  protected element: IElement
  protected control: Control

  constructor(element: IElement, control: Control) {
    this.element = element
    this.control = control
  }

  cut(): number {
    return 0
  }

  getElement(): IElement {
    return this.element
  }

  getValue(): IElement[] {
    return []
  }

  public keydown(evt: KeyboardEvent): number | null {
    return null
  }

  setElement(element: IElement): void {
    this.element = element
  }

  public setValue(
    data: IElement[],
    context: IControlContext = {},
    options: IControlRuleOption = {}
  ): number {
    // 校验是否可以设置
    if (!options.isIgnoreDisabledRule && this.control.getIsDisabledControl()) {
      return -1
    }
    const elementList = context.elementList || this.control.getElementList()
    const range = context.range || this.control.getRange()
    // 收缩边界到Value内
    this.control.shrinkBoundary(context)
    const { startIndex, endIndex } = range
    const draw = this.control.getDraw()
    // 移除选区元素
    if (startIndex !== endIndex) {
      draw.spliceElementList(elementList, startIndex + 1, endIndex - startIndex)
    } else {
      // 移除空白占位符
      this.control.removePlaceholder(startIndex, context)
    }
    // 非文本类元素或前缀过渡掉样式属性
    const startElement = elementList[startIndex]
    const anchorElement =
      (startElement.type &&
        !TEXTLIKE_ELEMENT_TYPE.includes(startElement.type)) ||
      startElement.controlComponent === ControlComponent.PREFIX
        ? pickObject(startElement, [
          'control',
          'controlId',
          ...CONTROL_STYLE_ATTR
        ])
        : omitObject(startElement, ['type'])
    // 插入起始位置
    const start = range.startIndex + 1
    for (let i = 0; i < data.length; i++) {
      const newElement: IElement = {
        ...anchorElement,
        ...data[i],
        controlComponent: ControlComponent.VALUE
      }
      formatElementContext(elementList, [newElement], startIndex)
      draw.spliceElementList(elementList, start + i, 0, newElement)
    }
    return start + data.length - 1
  }

}