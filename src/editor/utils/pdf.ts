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
  canvasContainer.forEach((canvas: HTMLCanvasElement, index) => {
    const img = canvas.toDataURL('image/jpeg', 1)
    if (index > 0) {
      doc.addPage()
      // doc.setPage(index + 1)
    }
    console.log(img)
    doc.addImage(img, 'JPEG', 0, 0, option.width, option.height)
  })
  // doc.html(canvasContainer)
  const url = doc.output('bloburl')
  // console.log(doc.output('bloburi'))
  window.open(url)
}

export function img2PDF(base64List: string[], options: IPrintImageBase64Option) {
  console.log('start docPDF')
  // const canvasContainer: HTMLCanvasElement = document.querySelector('.ce-page-container canvas')!
  // doc.addImage(canvasDom, 'JPEG', 0, 0, canvasDom.width, canvasDom.height)
  // doc.write(`${style.outerHTML}${container.innerHTML}`)
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
    docPDF.addImage(img, 'JPEG', 0, 0, options.width, options.height)

  })
  window.open(docPDF.output('bloburi'), '_blank')
}