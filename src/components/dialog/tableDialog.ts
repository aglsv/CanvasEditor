/**
 * @Description:
 * @author zjw.
 * @date 2024/5/31.
 */
import { Dialog, IDialogData, IDialogOptions } from './Dialog'
import { data } from '../../mock'

export interface ITableDialogInfo {
  rowIndex: number,
  colIndex: number,
  colspan: number,
  rowspan: number
}

export class TableDialog extends Dialog {
  private tableInfo: ITableDialogInfo[]

  constructor(options: IDialogOptions, tableInfo: ITableDialogInfo[]) {
    super(options)
    this.tableInfo = tableInfo
  }

  protected _render() {
    super._render()
  }

  protected renderOption(optionContainer: HTMLDivElement, data: IDialogData[]) {
    console.log(optionContainer, data)
    super.renderOption(optionContainer, data)
  }

  protected confirmBtnClick(onConfirm: Function | undefined) {
    if (onConfirm) {
      const payload = this.inputList.map((input, index) => {
        return {
          name: input.name,
          value: input.value,
          ...this.tableInfo[index]
        }
      })
      onConfirm(payload)
    }
    this._dispose()
  }
}