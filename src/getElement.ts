/**
 * @Description:
 * @author zjw.
 * @date 2024/5/21.
 */

// import htmlJSON from '../mock/html.json'

interface HtmlInfo {
  header: string,
  main: string,
  footer: string
}

const titleTagName = ['H1', 'H2', 'H3', 'H4', 'H5', 'H6']
// eslint-disable-next-line @typescript-eslint/no-unused-vars
// const html = '<img src="https://files.catbox.moe/rc0fut.png"  /><p style="font-family: &quot;Microsoft YaHei&quot;; text-align: center; color: rgb(0, 0, 0); font-size: 16px;">撒旦法时代发生的</p><p style="font-family: &quot;Microsoft YaHei&quot;; text-align: center; color: rgb(0, 0, 0); font-size: 16px;"><br>  </p><span data-pageBack="true" style="font-family: &quot;Microsoft YaHei&quot;; font-size: 16px;"><br></span><p style="font-family: &quot;Microsoft YaHei&quot;; text-align: center; color: rgb(255, 75, 75); font-size: 24px;">文本</p><p style="font-family: &quot;Microsoft YaHei&quot;; text-align: center; color: rgb(255, 75, 75); font-weight: 600; font-size: 24px;">测试文</p><p style="font-family: &quot;Microsoft YaHei&quot;; text-align: center; color: rgb(255, 75, 75); font-size: 24px;">本测试</p><span style="font-family: &quot;Microsoft YaHei&quot;; font-size: 16px;"><br></span><table cellspacing="0" cellpadding="0" border="0" style="border-top: 1px solid rgb(0, 0, 0); border-left: 1px solid rgb(0, 0, 0); width: 555px;"><colgroup><col width="111"><col width="111"><col width="111"><col width="111"><col width="111"></colgroup><tr style="height: 42px;"><td colspan="2" rowspan="2" style="border-right: 1px solid; border-bottom: 1px solid; vertical-align: top;"><span style="font-family: &quot;Microsoft YaHei&quot;; color: rgb(68, 114, 196); font-size: 24px;">阿斯蒂芬</span></td><td colspan="1" rowspan="1" style="border-right: 1px solid; border-bottom: 1px solid; vertical-align: top;"></td><td colspan="1" rowspan="1" style="border-right: 1px solid; border-bottom: 1px solid; vertical-align: top;"></td><td colspan="1" rowspan="1" style="border-right: 1px solid; border-bottom: 1px solid; vertical-align: top;"></td></tr><tr style="height: 42px;"><td colspan="1" rowspan="1" style="border-right: 1px solid; border-bottom: 1px solid; vertical-align: top;"></td><td colspan="1" rowspan="1" style="border-right: 1px solid; border-bottom: 1px solid; vertical-align: top;"></td><td colspan="1" rowspan="1" style="border-right: 1px solid; border-bottom: 1px solid; vertical-align: top;"></td></tr><tr style="height: 45px;"><td colspan="1" rowspan="1" style="border-right: 1px solid; border-bottom: 1px solid; vertical-align: top;"><span style="font-family: &quot;Microsoft YaHei&quot;; color: rgb(255, 192, 0); font-size: 24px;">阿斯蒂芬</span></td><td colspan="1" rowspan="1" style="border-right: 1px solid; border-bottom: 1px solid; vertical-align: top;"><span style="font-family: &quot;Microsoft YaHei&quot;; color: rgb(255, 0, 0); font-size: 24px;">阿道夫</span></td><td colspan="1" rowspan="1" style="border-right: 1px solid; border-bottom: 1px solid; vertical-align: top;"><span style="font-family: &quot;Microsoft YaHei&quot;; color: rgb(255, 0, 0); font-size: 24px;">阿斯蒂芬</span></td><td colspan="1" rowspan="1" style="border-right: 1px solid; border-bottom: 1px solid; vertical-align: top;"></td><td colspan="1" rowspan="1" style="border-right: 1px solid; border-bottom: 1px solid; vertical-align: top;"></td></tr><tr style="height: 42px;"><td colspan="1" rowspan="1" style="border-right: 1px solid; border-bottom: 1px solid; vertical-align: top;"></td><td colspan="1" rowspan="1" style="border-right: 1px solid; border-bottom: 1px solid; vertical-align: top;"></td><td colspan="1" rowspan="1" style="border-right: 1px solid; border-bottom: 1px solid; vertical-align: top;"></td><td colspan="1" rowspan="1" style="border-right: 1px solid; border-bottom: 1px solid; vertical-align: top;"></td><td colspan="1" rowspan="1" style="border-right: 1px solid; border-bottom: 1px solid; vertical-align: top;"></td></tr></table><span style="font-family: &quot;Microsoft YaHei&quot;; color: rgb(255, 0, 0); font-size: 24px;">s</span><span style="font-family: &quot;Microsoft YaHei&quot;; font-size: 16px;"><br></span><span style="font-family: &quot;Microsoft YaHei&quot;; color: rgb(0, 0, 0); font-weight: 600; font-style: italic; font-size: 18px;">3.6.&nbsp;Svnserve Based Server</span>'
async function fetchHtmlContent(url: string): Promise<HtmlInfo> {
  console.log('start')
  try {
    let htmlContent = ''
    if (url === '') {
      // htmlContent = JSON.parse(htmlJSON)
      htmlContent = ''
    } else {
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      htmlContent = await response.text()
    }

    // 将HTML字符串解析为DOM
    const parser: DOMParser = new DOMParser()
    const dom: Document = parser.parseFromString(htmlContent, 'text/html')

    const body = dom.querySelector('body')
    if (!body) return {header: '', main: '', footer: ''}

    const headerInfo: any[] = []
    const footerInfo: any[] = []
    let headerHTML = ''
    let footerHTML = ''

    let bodyContent = ''
    const regex = /^(.*?)[^\/]+$/

    let pathHeader = ''
    const match = url.match(regex)
    if (match) {
      pathHeader = match[1]
    }
    // 处理图片
    body.innerHTML = await convertImages(body.innerHTML, pathHeader)


    console.log(body.children.length)
    Array.from(body.children).forEach((page, pageIndex) => {
      Array.from(page.children).forEach((element) => {
        const style = element.getAttribute('style')
        if (!style) return

        // 判断如果包含orphans和widows样式,则判断为分页符
        if (style.includes('orphans') && style.includes('widows')) {
          // 添加分页符
          element.setAttribute('data-pageBack','true')
        }
        // 判断是否是页脚页眉，从main结构中删除,添加到对应的header和footer中
        else if (style.includes('-aw-headerfooter-type:header-primary')) {
          // todo 添加第一页的页眉信息，后续改动
          if (pageIndex === 0) {
            headerHTML = element.outerHTML
            setHeaderFooterInfo((element as HTMLElement), headerInfo)
          }
          element.remove()
        } else if (style.includes('-aw-headerfooter-type:footer-primary') || style.includes('-aw-headerfooter-type:linked')) {
          // todo 添加第一页的页脚信息，后续改动
          if (pageIndex === 0) {
            footerHTML = element.outerHTML
            setHeaderFooterInfo((element as HTMLElement), footerInfo)
          }
          element.remove()
        }

        // 如果是标题标签，并且没有加粗字样，则修改标签为strong
        if (titleTagName.includes(element.tagName) && !element.querySelector('strong')) {
          element.innerHTML = `<strong style="${style}">${element.innerHTML}</strong>`
        }
      })
      bodyContent += page.innerHTML
      console.log(page.innerHTML)
    })

    console.log(headerHTML, footerInfo)
    // 获取并输出body内容
    // const bodyContent = dom.querySelector('body')?.outerHTML ?? ''
    // console.log(bodyContent)

    return {
      header: headerHTML,
      main: bodyContent,
      footer: footerHTML
    }

  } catch (error) {
    console.error('Error fetching HTML:', error)
    throw error // 重新抛出错误，以便在调用处可以处理
  }
}

/**
 * 设置页眉页脚信息
 */
function setHeaderFooterInfo(element: HTMLElement, infoArr: any[]) {
  // 获取页眉页脚信息
  const textAlign = (element.firstElementChild as HTMLElement).style.textAlign
  let text = '';
  (element.firstElementChild as HTMLElement).querySelectorAll('span').forEach((textEle) => {
    text += textEle.innerHTML
  })
  infoArr.push({
    value: text,
    textAlign: textAlign.toUpperCase()
  })
}

/**
 * 图片链接转换
 */
async function convertImages(html: string, pathHeader: string) {
  const imgReg = /<img src="(.*?)"/g
  let match
  const imgSrcSet: Set<string> = new Set()

  // 先收集所有不重复的img src
  while ((match = imgReg.exec(html)) !== null) {
    imgSrcSet.add(match[1])
  }

  // 遍历集合，确保每个src只处理一次，并等待异步操作完成
  for (const imgSrc of imgSrcSet) {
    // const base64 = await imgSrc2base64(pathHeader + imgSrc)
    // 注意这里需要精确匹配src并保留其他属性，修正替换逻辑
    const srcPattern = new RegExp(`(<img[^>]*src\\s*=\\s*["']?)(${imgSrc})(["']?[^>]*>)`, 'g')
    html = html.replace(srcPattern, `$1${pathHeader + imgSrc}$3`)
  }

  return html
}


/**
 * imgSrc转base64
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
// async function imgSrc2base64(imgSrc: string) {
//   try {
//     const response = await fetch(imgSrc)
//     if (!response.ok) {
//       throw new Error('Failed to fetch image')
//     }
//     const blob = await response.blob()
//
//     const reader = new FileReader()
//     return await new Promise((resolve, reject) => {
//       reader.onload = () => resolve(reader.result as string)
//       reader.onerror = reject
//       reader.readAsDataURL(blob)
//     })
//   } catch (error) {
//     console.error('Error converting image:', error)
//   }
// }


export default fetchHtmlContent