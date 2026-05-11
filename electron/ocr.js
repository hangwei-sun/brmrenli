const { createWorker } = require('tesseract.js')
const sharp = require('sharp')
const tencentcloud = require('tencentcloud-sdk-nodejs-ocr')
const path = require('path')
const fs = require('fs')
const os = require('os')

// ============ 字段标签定义 ============
const FIELD_LABELS = {
  applicant:    ['申请人', '姓名', '请假人', '申请人姓名'],
  department:   ['部门', '科室', '所在部门', '所属部门'],
  agent:        ['代办人', '代理人', '代办'],
  leave_type:   ['请假类型', '请假类别', '假别'],
  start_date:   ['开始日期', '起始日期', '起假日期', '开始时间'],
  end_date:     ['结束日期', '截止日期', '结束时间'],
  apply_date:   ['申请日期', '填表日期', '申请时间'],
  cancel_date:  ['销假日期', '销假时间', '实际销假日期'],
  days:         ['天数', '合计天数', '共计天数', '请假天数']
}

const LEAVE_TYPE_KEYWORDS = [
  { key: '年休假', patterns: ['年休', '年假', '年休假'] },
  { key: '病假',   patterns: ['病假', '因病'] },
  { key: '事假',   patterns: ['事假', '因事'] },
  { key: '婚假',   patterns: ['婚假', '结婚'] },
  { key: '丧假',   patterns: ['丧假', '奔丧', '治丧'] },
  { key: '探亲假', patterns: ['探亲', '探亲假'] },
  { key: '产假',   patterns: ['产假', '生育', '分娩'] },
  { key: '护理假', patterns: ['护理', '护理假', '陪护'] },
  { key: '育儿假', patterns: ['育儿', '育儿假'] }
]

// ============ 表格印刷体黑名单 ============
// 请假条表格上固定印刷的文字，这些不是手写内容，需要过滤
const PRINTED_TEXT_PATTERNS = [
  // 标题行
  /包头市融媒体中心/,
  /干部职工请[（(]?[休休][）)]?假申请[表表]/,
  /请[（(]?休[）)]?假申请[表表]/,
  /干部职工/,

  // 固定标签
  /^申请时间$/,
  /^存根$/,
  /[（(]存根[）)]/,

  // 字段标签（单独出现时为印刷体）
  /^申请人$/,
  /^所属部门$/,
  /^代办人$/,
  /^部门$/,

  // 请假类型区域
  /请[（(]?休[）)]?假种[类类]/,
  /年休假[□☑✓✔☐]/,
  /病假[□☑✓✔☐]/,
  /事假[□☑✓✔☐]/,
  /婚假[□☑✓✔☐]/,
  /丧假[□☑✓✔☐]/,
  /探亲假[□☑✓✔☐]/,
  /产假[□☑✓✔☐]/,
  /护理假[□☑✓✔☐]/,
  /育儿假[□☑✓✔☐]/,
  /[□☑✓✔☐]/,

  // 日期标签行
  /请[（(]?休[）)]?假时间/,
  /销假时间/,
  /^共计$/,
  /天[（(]月[）)]/,

  // 底部注释（整段）
  /^注[：:]/,
  /干部职工请休假均须填写此表/,
  /参加工作时间满/,
  /每年休假\d+天/,
  /年休假期不包括法定节假日/,
  /婚假需提供结婚证复印件/,
  /产假需提供医院的分娩证明/,
  /病假需提供二级甲等以上医院/,
  /探亲假需提供亲属/,
  /护理假需提供医院/,
  /育儿假需提供出生证明/,
  /公休日/,
  /法定节假日/,
  /诊断证明/,
  /病历/,
  /病假单票据/,
  /复印件/,
  /社区/,
  /单位/,

  // 通用印刷符号和短词
  /^[：:]+$/,
  /^[□☑✓✔☐]+$/,
  /^[一二三四五六七八九十]+$/,
]

// 印刷文本特征词（半匹配即可过滤）
const PRINTED_KEYWORDS = [
  '包头市融媒体中心', '干部职工', '申请表', '存根',
  '请休假时间', '销假时间', '请假种类', '请休假种类',
  '共计', '注：', '注:', '填写此表',
  '参加工作时间', '每年休假', '法定节假日', '公休日',
  '结婚证复印件', '分娩证明', '诊断证明',
  '出生证明', '居住证明',
  '年休假□', '病假□', '事假□', '婚假□', '丧假□',
  '探亲假□', '产假□', '护理假□', '育儿假□'
]

class OcrEngine {
  constructor() {
    this.worker = null
    this.initialized = false
    this.settings = null
  }

  // 更新设置（由main.js调用）
  updateSettings(settings) {
    this.settings = settings
  }

  // 初始化Tesseract Worker
  async initWorker() {
    if (this.initialized && this.worker) return this.worker
    this.worker = await createWorker('chi_sim', 1, {
      logger: (m) => {
        if (this.onProgress && m.status === 'recognizing text') {
          this.onProgress(Math.round(m.progress * 100))
        }
      }
    })
    await this.worker.setParameters({
      tessedit_pageseg_mode: '6',
      preserve_interword_spaces: '1',
      textord_min_linesize: '1.5'
    })
    this.initialized = true
    return this.worker
  }

  // ============ 主识别入口（自动选择引擎） ============
  async recognize(imagePath) {
    const engine = this.settings?.ocrEngine || 'tesseract'
    if (engine === 'tencent' && this.settings?.tencentSecretId && this.settings?.tencentSecretKey) {
      return this.recognizeWithTencent(imagePath)
    }
    if (engine === 'glm' && this.settings?.glmApiKey) {
      return this.recognizeWithGLM(imagePath)
    }
    if (engine === 'glm-ocr' && this.settings?.glmApiKey) {
      return this.recognizeWithGlmOcr(imagePath)
    }
    if (engine === 'paddle' && this.settings?.paddleOcrApiKey) {
      return this.recognizeWithPaddleOcr(imagePath)
    }
    return this.recognizeWithTesseract(imagePath)
  }

  // ============ 腾讯云OCR识别 ============
  async recognizeWithTencent(imagePath) {
    if (!this.settings?.tencentSecretId || !this.settings?.tencentSecretKey) {
      throw new Error('请先在设置中配置腾讯云API密钥')
    }

    const imageBase64 = fs.readFileSync(imagePath).toString('base64')

    const OcrClient = tencentcloud.ocr.v20181119.Client
    const client = new OcrClient({
      credential: {
        secretId: this.settings.tencentSecretId,
        secretKey: this.settings.tencentSecretKey
      },
      region: this.settings.tencentRegion || 'ap-guangzhou',
      profile: {
        httpProfile: { endpoint: 'ocr.tencentcloudapi.com' }
      }
    })

    // 使用手写体识别API（专门优化过手写中文）
    const response = await client.GeneralHandwritingOCR({
      ImageBase64: imageBase64,
      EnableDetectText: true
    })

    if (!response.TextDetections || response.TextDetections.length === 0) {
      throw new Error('腾讯云OCR未检测到文字，请确认图片清晰度')
    }

    // 提取所有检测到的文本
    const words = response.TextDetections.map((item, index) => ({
      text: item.DetectedText || '',
      confidence: item.Confidence || 0,
      bbox: item.Polygon ? {
        x0: Math.min(...item.Polygon.map(p => p.X)),
        y0: Math.min(...item.Polygon.map(p => p.Y)),
        x1: Math.max(...item.Polygon.map(p => p.X)),
        y1: Math.max(...item.Polygon.map(p => p.Y))
      } : { x0: 0, y0: index * 30, x1: 100, y1: (index + 1) * 30 },
      advancedInfo: item.AdvancedInfo || ''
    }))

    // 计算整体置信度
    const avgConfidence = words.length > 0
      ? Math.round(words.reduce((s, w) => s + w.confidence, 0) / words.length)
      : 0

    // 提取全文
    const fullText = words.map(w => w.text).join('\n')

    // 使用空间位置提取字段（与Tesseract同样的逻辑）
    const extracted = this.extractFieldsWithSpatialAnalysis({
      text: fullText,
      confidence: avgConfidence,
      words: words,
      lines: this.groupWordsByLines(words),
      blocks: []
    })

    return {
      fullText: this.filterFullText(fullText),
      confidence: avgConfidence,
      engine: 'tencent',
      ...extracted
    }
  }

  // ============ GLM-4.6V-Flash 大模型识别 ============
  async recognizeWithGLM(imagePath) {
    if (!this.settings?.glmApiKey) {
      throw new Error('请先在设置中配置智谱AI API密钥')
    }

    const imageBuffer = fs.readFileSync(imagePath)
    const ext = path.extname(imagePath).toLowerCase().replace('.', '')
    const mimeType = ext === 'png' ? 'image/png' : ext === 'bmp' ? 'image/bmp' : ext === 'webp' ? 'image/webp' : 'image/jpeg'
    const base64 = imageBuffer.toString('base64')
    const dataUrl = `data:${mimeType};base64,${base64}`

    const prompt = `你是一个专业的手写体OCR识别助手。请仔细查看这张请假条图片，**只识别手写体内容**，忽略所有印刷体的表格文字、标签、注释。

请提取以下字段（只返回手写的内容，如果某个字段没有手写内容则留空）：
- 申请人（姓名）
- 所属部门
- 代办人
- 请假类型（年休假/病假/事假/婚假/丧假/探亲假/产假/护理假/育儿假）
- 开始日期（格式：YYYY-MM-DD）
- 结束日期（格式：YYYY-MM-DD）
- 请假天数
- 申请日期（格式：YYYY-MM-DD）
- 销假日期（格式：YYYY-MM-DD）

请严格按照以下JSON格式返回，不要返回其他内容：
{
  "applicant": "",
  "department": "",
  "agent": "",
  "leave_type": "",
  "start_date": "",
  "end_date": "",
  "days": 0,
  "apply_date": "",
  "cancel_date": ""
}`

    const apiKey = this.settings.glmApiKey
    const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'glm-4.6v-flash',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: dataUrl } },
              { type: 'text', text: prompt }
            ]
          }
        ],
        temperature: 0.1,
        max_tokens: 1024
      })
    })

    if (!response.ok) {
      const errText = await response.text().catch(() => '')
      let errMsg
      try {
        const errJson = JSON.parse(errText)
        errMsg = errJson.error?.message || errText
      } catch {
        errMsg = errText || `HTTP ${response.status}`
      }
      throw new Error(`GLM API调用失败: ${errMsg}`)
    }

    const result = await response.json()
    const content = result.choices?.[0]?.message?.content || ''

    // 解析JSON响应
    let parsed = null
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0])
      }
    } catch {
      // JSON解析失败，尝试逐字段正则提取
    }

    if (!parsed) {
      // 回退：从文本中逐字段提取
      parsed = this.parseFieldsFromText(content)
    }

    // 构建伪words用于兼容现有结构
    const words = []
    let idx = 0
    for (const [key, value] of Object.entries(parsed)) {
      if (value && typeof value === 'string' && value.length > 0) {
        words.push({ text: `${key}:${value}`, confidence: 90, bbox: { x0: 0, y0: idx * 30, x1: 100, y1: idx * 30 + 30 } })
        idx++
      }
    }

    const fullText = Object.entries(parsed)
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}: ${v}`)
      .join('\n')

    return {
      fullText,
      confidence: 90,
      engine: 'glm',
      applicant: parsed.applicant || '',
      department: parsed.department || '',
      agent: parsed.agent || '',
      leave_type: parsed.leave_type || '',
      start_date: parsed.start_date || '',
      end_date: parsed.end_date || '',
      days: parseInt(parsed.days) || this.calcDays(parsed.start_date, parsed.end_date),
      apply_date: parsed.apply_date || '',
      cancel_date: parsed.cancel_date || '',
      fieldConfidence: {},
      extractedWords: {}
    }
  }

  // ============ GLM-OCR 专用OCR模型 ============
  async recognizeWithGlmOcr(imagePath) {
    if (!this.settings?.glmApiKey) {
      throw new Error('请先在设置中配置智谱AI API密钥')
    }

    const imageBuffer = fs.readFileSync(imagePath)
    const ext = path.extname(imagePath).toLowerCase().replace('.', '')
    const mimeType = ext === 'png' ? 'image/png' : ext === 'bmp' ? 'image/bmp' : ext === 'webp' ? 'image/webp' : 'image/jpeg'
    const base64 = imageBuffer.toString('base64')
    const dataUrl = `data:${mimeType};base64,${base64}`

    const apiKey = this.settings.glmApiKey
    const response = await fetch('https://open.bigmodel.cn/api/paas/v4/layout_parsing', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'glm-ocr',
        file: dataUrl
      })
    })

    if (!response.ok) {
      const errText = await response.text().catch(() => '')
      let errMsg
      try {
        errMsg = JSON.parse(errText).error?.message || errText
      } catch {
        errMsg = errText || `HTTP ${response.status}`
      }
      throw new Error(`GLM-OCR调用失败: ${errMsg}`)
    }

    const result = await response.json()
    console.log("GLM-OCR raw keys:", Object.keys(result))

    let allElements = []
    let markdownText = ""

    // 路径1：嵌套 pages.elements
    const pages = result.pages || result.data?.pages || []
    for (const page of pages) {
      for (const el of (page.elements || [])) {
        const text = el.content || el.text || ""
        if (text.trim()) {
          allElements.push({
            text,
            confidence: Math.round((el.confidence || 0.9) * 100),
            bbox: el.bbox || el.box || [0, 0, 0, 0]
          })
        }
      }
    }

    // 路径2：扁平 elements 数组
    if (allElements.length === 0 && Array.isArray(result.elements)) {
      for (const el of result.elements) {
        const text = el.content || el.text || ""
        if (text.trim()) {
          allElements.push({
            text,
            confidence: Math.round((el.confidence || 0.85) * 100),
            bbox: el.bbox || el.box || [0, 0, 0, 0]
          })
        }
      }
    }

    // 路径3：result.ocr_result 或 result.text
    if (allElements.length === 0 && (result.ocr_result || result.text)) {
      const rawText = result.ocr_result || result.text || ''
      rawText.split('\n').filter(l => l.trim()).forEach((line, i) => {
        allElements.push({
          text: line.trim(),
          confidence: 85,
          bbox: [0, i * 30, 100, i * 30 + 30]
        })
      })
    }

    // 路径4：从 markdown 解析
    markdownText = result.markdown || result.data?.markdown || ''
    if (allElements.length === 0 && markdownText) {
      markdownText.split('\n').filter(l => l.trim() && !l.startsWith('|'))
        .forEach((line, i) => {
          const text = line.replace(/^[*#\\-]+\\s*/, '').replace(/\\*\\*/g, '').trim()
          if (text) {
            allElements.push({ text, confidence: 80, bbox: [0, i * 30, 100, i * 30 + 30] })
          }
        })
    }

    // 路径5：完全回退到GLM-4.6V
    if (allElements.length === 0) {
      console.log("GLM-OCR empty, falling back to GLM-4.6V")
      return this.recognizeWithGLM(imagePath)
    }

    console.log("GLM-OCR:", allElements.length, "elements")

    // 转为统一格式
    const words = allElements.map((el, idx) => ({
      text: el.text,
      confidence: el.confidence,
      bbox: Array.isArray(el.bbox) && el.bbox.length === 4
        ? { x0: el.bbox[0], y0: el.bbox[1], x1: el.bbox[2], y1: el.bbox[3] }
        : { x0: 0, y0: idx * 30, x1: 100, y1: idx * 30 + 30 }
    }))

    const fullText = words.map(w => w.text).join('\n')
    const avgConfidence = words.length > 0
      ? Math.round(words.reduce((s, w) => s + w.confidence, 0) / words.length)
      : 85

    // 过滤印刷体
    const filteredWords = words.filter(w => !this.isPrintedText(w.text))

    // 空间分析提取字段
    const lines = this.groupWordsByLines(filteredWords.length > 0 ? filteredWords : words)
    const extracted = this.extractFieldsWithSpatialAnalysis({
      text: fullText,
      confidence: avgConfidence,
      words: filteredWords.length > 0 ? filteredWords : words,
      lines,
      blocks: []
    })

    // GLM-OCR未识别的字段通过大模型补充
    const missingFields = []
    if (!extracted.applicant) missingFields.push('申请人')
    if (!extracted.leave_type) missingFields.push('请假类型')
    if (!extracted.start_date) missingFields.push('开始日期')
    if (!extracted.end_date) missingFields.push('结束日期')

    if (missingFields.length > 0) {
      try {
        const supplement = await this.recognizeWithGLM(imagePath)
        for (const field of missingFields) {
          const keyMap = {
            '申请人': 'applicant', '请假类型': 'leave_type',
            '开始日期': 'start_date', '结束日期': 'end_date'
          }
          const key = keyMap[field]
          if (supplement[key] && !extracted[key]) {
            extracted[key] = supplement[key]
          }
        }
      } catch { /* GLM补充失败不阻塞主流程 */ }
    }

    return {
      fullText: this.filterFullText(fullText),
      confidence: avgConfidence,
      engine: 'glm-ocr',
      ...extracted
    }
  }

  // ============ 百度千帆 PaddleOCR-VL ============
  async recognizeWithPaddleOcr(imagePath) {
    if (!this.settings?.paddleOcrApiKey) {
      throw new Error('请先在设置中配置百度千帆API Key')
    }

    const imageBuffer = fs.readFileSync(imagePath)
    const base64 = imageBuffer.toString('base64')

    const response = await fetch('https://qianfan.baidubce.com/v2/ocr/paddleocr', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.settings.paddleOcrApiKey}`
      },
      body: JSON.stringify({
        model: 'paddleocr-vl-0.9b',
        file: base64,
        fileType: 1,
        useChartRecognition: true,
        useDocUnwarping: true,
        useLayoutDetection: true,
        layoutNms: true,
        temperature: 0,
        topP: 1.0
      })
    })

    if (!response.ok) {
      const errText = await response.text().catch(() => '')
      let errMsg
      try {
        errMsg = JSON.parse(errText).error?.message || errText
      } catch {
        errMsg = errText || `HTTP ${response.status}`
      }
      throw new Error(`PaddleOCR-VL调用失败: ${errMsg}`)
    }

    const result = await response.json()

    // 解析版面结果
    const layoutResults = result.result?.layoutParsingResults
    let allElements = []

    if (layoutResults && layoutResults.length > 0) {
      const lr = layoutResults[0]
      // 从 parsing_res_list 提取文本块
      if (lr.parsing_res_list && Array.isArray(lr.parsing_res_list)) {
        for (const block of lr.parsing_res_list) {
          const text = block.block_content || ''
          if (text.trim()) {
            allElements.push({
              text: text.trim(),
              confidence: 90,
              bbox: Array.isArray(block.block_bbox) && block.block_bbox.length === 4
                ? { x0: block.block_bbox[0], y0: block.block_bbox[1], x1: block.block_bbox[2], y1: block.block_bbox[3] }
                : { x0: 0, y0: allElements.length * 30, x1: 100, y1: allElements.length * 30 + 30 }
            })
          }
        }
      }
      // 回退: 从 markdown 文本提取
      if (allElements.length === 0 && lr.markdown?.text) {
        lr.markdown.text.split('\n').filter(l => l.trim())
          .forEach((line, i) => {
            allElements.push({ text: line.trim(), confidence: 80, bbox: { x0: 0, y0: i * 30, x1: 100, y1: i * 30 + 30 } })
          })
      }
    }

    if (allElements.length === 0) {
      throw new Error('PaddleOCR-VL未检测到文字，请确认图片清晰度')
    }

    const words = allElements.map((el, idx) => ({
      text: el.text,
      confidence: el.confidence,
      bbox: el.bbox
    }))

    const fullText = words.map(w => w.text).join('\n')
    const avgConfidence = Math.round(words.reduce((s, w) => s + w.confidence, 0) / words.length)

    const filteredWords = words.filter(w => !this.isPrintedText(w.text))
    const lines = this.groupWordsByLines(filteredWords.length > 0 ? filteredWords : words)
    const extracted = this.extractFieldsWithSpatialAnalysis({
      text: fullText,
      confidence: avgConfidence,
      words: filteredWords.length > 0 ? filteredWords : words,
      lines,
      blocks: []
    })

    return {
      fullText: this.filterFullText(fullText),
      confidence: avgConfidence,
      engine: 'paddle',
      ...extracted
    }
  }

  // 文本回退解析
  parseFieldsFromText(text) {
    const result = {}
    const patterns = {
      applicant: /申请人[：:]?\s*([^\s\n]{2,4})/,
      department: /(?:所属)?部门[：:]?\s*([^\s\n]{2,10})/,
      agent: /代办人[：:]?\s*([^\s\n]{2,4})/,
      leave_type: /请假类型[：:]?\s*(年休假|病假|事假|婚假|丧假|探亲假|产假|护理假|育儿假)/,
      start_date: /开始日期[：:]?\s*(\d{4}-\d{2}-\d{2})/,
      end_date: /结束日期[：:]?\s*(\d{4}-\d{2}-\d{2})/,
      days: /天数[：:]?\s*(\d+)/,
      apply_date: /申请日期[：:]?\s*(\d{4}-\d{2}-\d{2})/,
      cancel_date: /销假日期[：:]?\s*(\d{4}-\d{2}-\d{2})/
    }
    for (const [key, pattern] of Object.entries(patterns)) {
      const match = text.match(pattern)
      result[key] = match ? match[1] : ''
    }
    return result
  }

  // 从日期计算天数
  calcDays(startDate, endDate) {
    if (!startDate || !endDate) return 0
    const start = new Date(startDate)
    const end = new Date(endDate)
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0
    return Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1
  }

  // 将词按行分组（腾讯云返回的是坐标点，需要按Y坐标聚类）
  groupWordsByLines(words) {
    if (!words || words.length === 0) return []
    const sorted = [...words].sort((a, b) => a.bbox.y0 - b.bbox.y0)
    const lines = []
    let currentLine = [sorted[0]]
    let currentY = sorted[0].bbox.y0

    for (let i = 1; i < sorted.length; i++) {
      const word = sorted[i]
      if (Math.abs(word.bbox.y0 - currentY) < 20) {
        currentLine.push(word)
      } else {
        lines.push({
          text: currentLine.map(w => w.text).join(' '),
          bbox: {
            x0: Math.min(...currentLine.map(w => w.bbox.x0)),
            y0: Math.min(...currentLine.map(w => w.bbox.y0)),
            x1: Math.max(...currentLine.map(w => w.bbox.x1)),
            y1: Math.max(...currentLine.map(w => w.bbox.y1))
          },
          words: currentLine
        })
        currentLine = [word]
        currentY = word.bbox.y0
      }
    }
    // 添加最后一行
    if (currentLine.length > 0) {
      lines.push({
        text: currentLine.map(w => w.text).join(' '),
        bbox: {
          x0: Math.min(...currentLine.map(w => w.bbox.x0)),
          y0: Math.min(...currentLine.map(w => w.bbox.y0)),
          x1: Math.max(...currentLine.map(w => w.bbox.x1)),
          y1: Math.max(...currentLine.map(w => w.bbox.y1))
        },
        words: currentLine
      })
    }
    return lines
  }

  // ============ Tesseract OCR识别 ============
  async recognizeWithTesseract(imagePath) {
    const worker = await this.initWorker()
    const processedPath = await this.preprocessImage(imagePath)
    const { data: primaryResult } = await worker.recognize(processedPath)
    const hwPath = await this.preprocessForHandwriting(imagePath)
    const { data: secondaryResult } = await worker.recognize(hwPath)
    const merged = this.mergeResults(primaryResult, secondaryResult)
    const extracted = this.extractFieldsWithSpatialAnalysis(merged)
    this.cleanupTempFiles([processedPath, hwPath])

    return {
      fullText: this.filterFullText(merged.text),
      confidence: Math.round(merged.confidence || 0),
      engine: 'tesseract',
      ...extracted
    }
  }

  // ============ 图像预处理 ============
  async preprocessImage(imagePath) {
    const tmpDir = os.tmpdir()
    const basename = path.basename(imagePath, path.extname(imagePath))
    const processedPath = path.join(tmpDir, `${basename}_ocr_processed.png`)
    try {
      await sharp(imagePath)
        .grayscale()
        .normalize()
        .sharpen({ sigma: 1.5, m1: 1.0, m2: 0.3 })
        .linear(1.3, -0.15)
        .median(1)
        .png({ quality: 100, compressionLevel: 0 })
        .toFile(processedPath)
      return processedPath
    } catch (err) {
      console.error('图像预处理失败，使用原图:', err.message)
      return imagePath
    }
  }

  async preprocessForHandwriting(imagePath) {
    const tmpDir = os.tmpdir()
    const basename = path.basename(imagePath, path.extname(imagePath))
    const processedPath = path.join(tmpDir, `${basename}_ocr_hw.png`)
    try {
      await sharp(imagePath)
        .grayscale()
        .normalize()
        .blur(0.5)
        .sharpen({ sigma: 2.0, m1: 2.0, m2: 0.5 })
        .linear(1.8, -0.25)
        .median(1)
        .png({ quality: 100, compressionLevel: 0 })
        .toFile(processedPath)
      return processedPath
    } catch (err) {
      console.error('手写体预处理失败:', err.message)
      return imagePath
    }
  }

  // ============ 结果合并 ============
  mergeResults(result1, result2) {
    const text = (result1.confidence >= result2.confidence) ? result1.text : result2.text
    const words1 = result1.words || []
    const words2 = result2.words || []
    const allWords = [...words1]
    for (const w2 of words2) {
      const exists = allWords.some(w1 =>
        Math.abs(w1.bbox.x0 - w2.bbox.x0) < 10 &&
        Math.abs(w1.bbox.y0 - w2.bbox.y0) < 10
      )
      if (!exists) allWords.push(w2)
    }
    return {
      text,
      confidence: Math.max(result1.confidence || 0, result2.confidence || 0),
      words: allWords,
      lines: (result1.lines || []).length >= (result2.lines || []).length
        ? result1.lines : result2.lines
    }
  }

  // ============ 空间位置字段提取 ============
  extractFieldsWithSpatialAnalysis(data) {
    const words = data.words || []
    const lines = data.lines || []
    const fullText = data.text || ''
    const cleanText = fullText.replace(/\s+/g, '')

    const result = {
      applicant: '',
      department: '',
      agent: '',
      leave_type: '',
      start_date: '',
      end_date: '',
      days: 0,
      apply_date: '',
      cancel_date: '',
      fieldConfidence: {},
      extractedWords: {}
    }

    for (const [fieldName, labelPatterns] of Object.entries(FIELD_LABELS)) {
      const extraction = this.findFieldValueByPosition(fieldName, labelPatterns, words, lines)
      if (extraction.value) {
        result[fieldName] = extraction.value
        result.fieldConfidence[fieldName] = extraction.confidence
        result.extractedWords[fieldName] = extraction.matchedWords
        continue
      }
      const regexResult = this.findFieldValueByRegex(fieldName, labelPatterns, cleanText)
      if (regexResult) {
        result[fieldName] = regexResult.value
        result.fieldConfidence[fieldName] = regexResult.confidence
      }
    }

    // 请假类型检测
    if (!result.leave_type || result.fieldConfidence.leave_type < 2) {
      const typeResult = this.detectLeaveType(cleanText, words)
      if (typeResult) {
        result.leave_type = typeResult.value
        result.fieldConfidence.leave_type = typeResult.confidence
      }
    }

    // 天数计算
    if ((!result.days || result.days <= 0) && result.start_date && result.end_date) {
      const startDate = this.parseDate(result.start_date)
      const endDate = this.parseDate(result.end_date)
      if (startDate && endDate && endDate >= startDate) {
        result.days = Math.ceil((endDate.getTime() - startDate.getTime()) / 86400000) + 1
        result.fieldConfidence.days = Math.min(result.fieldConfidence.days || 0, 2) + 1
      }
    }
    if (!result.days || result.days <= 0) {
      const daysMatch = cleanText.match(/(\d+)\s*[天日]/)
      if (daysMatch) {
        const d = parseInt(daysMatch[1])
        if (d > 0 && d <= 365) { result.days = d; result.fieldConfidence.days = 1 }
      }
    }

    return result
  }

  // 空间位置字段值查找
  findFieldValueByPosition(fieldName, labelPatterns, words, lines) {
    if (!words || words.length === 0) return { value: '', confidence: 0, matchedWords: [] }

    let labelWord = null
    for (const pattern of labelPatterns) {
      labelWord = words.find(w => {
        const clean = (w.text || '').replace(/\s+/g, '').replace(/[：:]/g, '')
        return clean === pattern || clean.includes(pattern)
      })
      if (labelWord) break
    }
    if (!labelWord) {
      for (const pattern of labelPatterns) {
        labelWord = words.find(w => {
          const clean = (w.text || '').replace(/\s+/g, '').replace(/[：:]/g, '')
          return clean.length >= 1 && pattern.includes(clean)
        })
        if (labelWord) break
      }
    }
    if (!labelWord) return { value: '', confidence: 0, matchedWords: [] }

    const bbox = labelWord.bbox
    const labelCenterY = (bbox.y0 + bbox.y1) / 2
    const labelRight = bbox.x1

    const sameRowWords = words.filter(w => {
      if (w === labelWord) return false
      const wCenterY = (w.bbox.y0 + w.bbox.y1) / 2
      const height = Math.max(w.bbox.y1 - w.bbox.y0, 10)
      return Math.abs(wCenterY - labelCenterY) < height && w.bbox.x0 >= labelRight - 15
    })

    const belowWords = words.filter(w => {
      if (w === labelWord) return false
      return w.bbox.y0 > bbox.y1 - 5 && w.bbox.y0 < bbox.y1 + 60
    })

    const seen = new Set()
    const uniqueCandidates = []
    for (const w of [...sameRowWords, ...belowWords]) {
      const key = `${w.text}_${Math.round(w.bbox.x0)}_${Math.round(w.bbox.y0)}`
      if (!seen.has(key)) { seen.add(key); uniqueCandidates.push(w) }
    }
    if (uniqueCandidates.length === 0) return { value: '', confidence: 0, matchedWords: [] }

    uniqueCandidates.sort((a, b) => a.bbox.x0 - b.bbox.x0)
    const valueWords = uniqueCandidates.filter(w => {
      const clean = (w.text || '').replace(/[：:\s]/g, '')
      for (const pattern of labelPatterns) {
        if (clean === pattern || clean.includes(pattern)) return false
      }
      return clean.length > 0
    })
    if (valueWords.length === 0) return { value: '', confidence: 0, matchedWords: [] }

    const value = valueWords.map(w => (w.text || '').replace(/\s+/g, '')).join('')
    const avgConfidence = valueWords.reduce((s, w) => s + (w.confidence || 80), 0) / valueWords.length

    return {
      value: this.cleanFieldValue(fieldName, value),
      confidence: avgConfidence > 90 ? 3 : avgConfidence > 65 ? 2 : 1,
      matchedWords: valueWords.map(w => ({
        text: w.text, confidence: Math.round(w.confidence), bbox: w.bbox
      }))
    }
  }

  // 正则回退
  findFieldValueByRegex(fieldName, labelPatterns, cleanText) {
    for (const pattern of labelPatterns) {
      let regex
      switch (fieldName) {
        case 'applicant':
        case 'agent':
          regex = new RegExp(`${pattern}[：:]?\\s*([\\u4e00-\\u9fa5]{2,4})`, 'i')
          break
        case 'department':
          regex = new RegExp(`${pattern}[：:]?\\s*([\\u4e00-\\u9fa5]{2,10})`, 'i')
          break
        case 'days':
          regex = new RegExp(`${pattern}[：:]?\\s*(\\d+)\\s*[天日]?`, 'i')
          break
        default:
          regex = new RegExp(`${pattern}[：:]?\\s*([^\\n\\r，,。.]{1,20})`, 'i')
      }
      const match = cleanText.match(regex)
      if (match && match[1]) {
        const value = this.cleanFieldValue(fieldName, match[1])
        if (value) return { value, confidence: 1 }
      }
    }
    return null
  }

  // 请假类型检测
  detectLeaveType(cleanText, words) {
    const searchIn = words || []
    for (const typeInfo of LEAVE_TYPE_KEYWORDS) {
      const found = searchIn.find(w => typeInfo.patterns.some(p => (w.text || '').includes(p)))
      if (found && (found.confidence || 50) > 40) {
        return { value: typeInfo.key, confidence: 3 }
      }
    }
    for (const typeInfo of LEAVE_TYPE_KEYWORDS) {
      for (const pattern of typeInfo.patterns) {
        if (cleanText.includes(pattern)) return { value: typeInfo.key, confidence: 2 }
      }
    }
    return null
  }

  // 过滤全文中的印刷体行
  filterFullText(fullText) {
    if (!fullText) return ''
    const lines = fullText.split(/[\n\r]+/)
    const filteredLines = lines.filter(line => {
      const trimmed = line.trim()
      if (!trimmed) return false
      if (this.isPrintedText(trimmed)) return false
      return true
    })
    return filteredLines.join('\n')
  }

  // ============ 工具函数 ============
  // 判断文本是否为印刷体（表格固定文字）
  isPrintedText(text) {
    if (!text || text.length === 0) return true

    // 精确匹配黑名单
    for (const pattern of PRINTED_TEXT_PATTERNS) {
      if (pattern.test(text)) return true
    }

    // 关键词模糊匹配
    for (const keyword of PRINTED_KEYWORDS) {
      if (text.includes(keyword)) return true
    }

    return false
  }

  // 从文本中移除印刷体内容
  filterPrintedText(text) {
    if (!text) return ''
    // 移除匹配印刷体模式的部分
    let filtered = text
    for (const pattern of PRINTED_TEXT_PATTERNS) {
      filtered = filtered.replace(pattern, '')
    }
    // 移除印刷关键词
    for (const keyword of PRINTED_KEYWORDS) {
      filtered = filtered.replace(new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '')
    }
    return filtered.replace(/\s+/g, '').trim()
  }

  cleanFieldValue(fieldName, value) {
    if (!value) return ''

    // 先检查是否为印刷体
    if (this.isPrintedText(value)) {
      // 尝试过滤掉印刷部分
      const filtered = this.filterPrintedText(value)
      if (!filtered) return '' // 全部是印刷体，返回空
      value = filtered
    }

    let cleaned = value.replace(/[：:＝=\s]+/g, '').replace(/[|｜\[\]【】{}《》<>]/g, '').trim()
    switch (fieldName) {
      case 'applicant':
      case 'agent':
        cleaned = cleaned.replace(/[^一-龥]/g, '')
        // 再次检查过滤后是否为空或纯印刷
        if (this.isPrintedText(cleaned)) cleaned = ''
        break
      case 'department':
        cleaned = cleaned.replace(/[^一-龥]/g, '')
        break
      case 'start_date':
      case 'end_date':
      case 'apply_date':
      case 'cancel_date':
        cleaned = this.normalizeDate(cleaned)
        break
      case 'days':
        cleaned = cleaned.replace(/[^\d]/g, '')
        break
    }

    // 最终检查：如果结果仍是已知印刷体，返回空
    if (cleaned && this.isPrintedText(cleaned)) {
      return ''
    }

    return cleaned
  }

  normalizeDate(str) {
    if (!str) return ''
    const patterns = [
      /(\d{4})[年\-\/\.](\d{1,2})[月\-\/\.](\d{1,2})[日]?/,
      /(\d{4})(\d{2})(\d{2})/,
      /(\d{1,2})[月\-\/\.](\d{1,2})[日]?/
    ]
    for (const p of patterns) {
      const match = str.match(p)
      if (match) {
        if (match.length === 4) return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`
        if (match.length === 3) return `${new Date().getFullYear()}-${match[1].padStart(2, '0')}-${match[2].padStart(2, '0')}`
      }
    }
    return str
  }

  parseDate(str) {
    if (!str) return null
    const match = str.match(/(\d{4})-(\d{2})-(\d{2})/)
    if (match) return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]))
    return null
  }

  cleanupTempFiles(paths) {
    for (const p of paths) {
      try { if (p && fs.existsSync(p) && p.includes('_ocr_')) fs.unlinkSync(p) } catch { /* ignore */ }
    }
  }

  async terminate() {
    if (this.worker) { await this.worker.terminate(); this.worker = null; this.initialized = false }
  }
}

module.exports = OcrEngine
