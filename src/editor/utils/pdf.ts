/**
 * @Description:
 * @author zjw.
 * @date 2024/5/23.
 */
import jsPDF from 'jspdf'
import { IPrintImageBase64Option } from './print'

export function getPdf(option: { width: number, height: number }) {
  const doc = new jsPDF({
    orientation: 'p',
    unit: 'px',
    format: [option.width, option.height],
    hotfixes: ['px_scaling'],
    compress: true
  })
  const canvasContainer = document.querySelectorAll('canvas')
  const imgSrcList:string[] = []
  canvasContainer.forEach((canvas: HTMLCanvasElement, index) => {
    const img = canvas.toDataURL('image/jpeg', 1)
    imgSrcList.push(img)
    if (index > 0) {
      doc.addPage()
      // doc.setPage(index + 1)
    }
    console.time('getPDF' + index)
    doc.addImage(img, 'JPEG', 0, 0, option.width, option.height)
    console.timeEnd('getPDF' + index)
  })
  console.log(imgSrcList)
  // doc.html(canvasContainer)
  const url = doc.output('bloburl')
  // console.log(doc.output('bloburi'))
  window.open(url)
}

export function img2PDF(base64List: string[], options: IPrintImageBase64Option) {
  console.log('start docPDF')
  const docPDF = new jsPDF({
    orientation: 'p',
    unit: 'px',
    format: [options.width, options.height],
    hotfixes: ['px_scaling'],
    compress: true,
  })
  base64List.forEach((img, index) => {
    console.log('当前进度', index)
    if (index > 0) {
      docPDF.addPage()
      // docPDF.setPage(index + 1)
    }
    console.time('img2PDF' + index)
    docPDF.addImage(img, 'JPEG', 0, 0, options.width, options.height)
    console.timeEnd('img2PDF' + index)
  })
  console.log(base64List)
  window.open(docPDF.output('bloburi'), '_blank')
}