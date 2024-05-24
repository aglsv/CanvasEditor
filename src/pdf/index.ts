import { IEditorData, IEditorOption, IElement } from '../editor'
import { DeepRequired } from '../editor/interface/Common'
import { Context2d, jsPDF } from 'jspdf'
import { formatElementList } from '../editor/utils/element'
import { IElementPosition } from '../editor/interface/Element'
import { IRow } from '../editor/interface/Row'

/**
 * @Description:
 * @author zjw.
 * @date 2024/5/23.
 */
export class Pdf {
  private elementList: IEditorData
  private options: DeepRequired<IEditorOption>
  private doc: jsPDF
  private ctx: Context2d
  private positionList: IElementPosition[] = []
  private rowList: IRow[] = []

  constructor(elementList: IEditorData, options: DeepRequired<IEditorOption>) {
    this.elementList = elementList
    this.options = options

    //   创建doc
    this.doc = new jsPDF({
      orientation: 'p',
      unit: 'px',
      format: [options.width, options.height],
      hotfixes: ['px_scaling'],
      compress: true,
    })

    this.ctx = this.doc.context2d

    this.init()
  }

  // ------------------------------------ 主体方法 ------------------------------------

  /**
   * 初始化方法，负责组织页面元素列表并进行格式化处理
   */
  private init(): void {
    // 添加字体
    this.addFont()

    // 初始化元素列表变量，用于存放头部、主体和尾部的元素
    let headerElementList: IElement[] = []
    let mainElementList: IElement[] = []
    let footerElementList: IElement[] = []

    // 根据this.elementList的类型（数组或对象）组织元素列表
    if (Array.isArray(this.elementList)) {
      // 若为数组，则直接视为主体元素列表
      mainElementList = this.elementList
    } else {
      // 若为对象，则分别提取头部、主体、尾部元素
      headerElementList = this.elementList.header || []
      mainElementList = this.elementList.main
      footerElementList = this.elementList.footer || []
    }

    // 构建元素列表
    const pageComponentData: IElement[][] = [
      headerElementList,
      mainElementList,
      footerElementList
    ]

    // 遍历每个部分的元素列表，调用formatElementList进行格式化处理
    pageComponentData.forEach(elementList => {
      formatElementList(elementList, {
        editorOptions: this.options // 传递编辑器选项给格式化方法
      })
    })
  }

  /**
   * 添加字体
   * @private
   */
  private addFont() {
    this.doc.addFont('/src/assets/font/msyh.ttf', 'Yahei', 'normal')
    this.doc.addFont('/src/assets/font/msyh-bold.ttf', 'Yahei', 'bold')
    this.doc.setFont('Yahei')
  }

  /**
   * 绘制
   */
  private draw(){
    const { height, margins } = this.options
    const innerWidth = this.getInnerWidth()
    // 计算行信息
    this.rowList =
    // 清除光标等副作用
    this.positionList = []
    // 按页渲染
    const marginHeight = margins[0] + margins[2]
    let pageHeight = marginHeight
    let pageNo = 0
  }


  // ------------------------------------ 工具方法 ------------------------------------

  public getInnerWidth(){
    return this.options.width - this.options.margins[1] - this.options.margins[3]
  }

  public computeRowList(innerWidth: number, elementList: IElement[]){
    const rowList: IRow[] = []
    if (elementList.length) {
      rowList.push({
        startIndex: 0,
        width: 0,
        height: 0,
        ascent: 0,
        elementList: [],
        rowFlex: elementList?.[1]?.rowFlex
      })
    }

    // for (let i = 0; i < ; i++) {
    //
    // }
  }

}