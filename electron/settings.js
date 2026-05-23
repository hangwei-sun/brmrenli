const fs = require('fs')
const path = require('path')

const DEFAULT_SETTINGS = {
  // OCR引擎: 'tesseract' | 'tencent'
  ocrEngine: 'tesseract',

  // 腾讯云API配置
  tencentSecretId: '',
  tencentSecretKey: '',
  tencentRegion: 'ap-guangzhou',

  // 智谱AI GLM-4.6V-Flash配置
  glmApiKey: '',

  // 阿里云百炼 DashScope配置（Qwen-VL通道3/4）
  dashscopeApiKey: '',

  // 主题: 'light' | 'dark' | 'system'
  theme: 'light',

  // 语言
  language: 'zh-CN',

  // 自动保存识别结果
  autoSave: false,

  // 隐私模式：开启后电话和身份证号部分隐藏
  privacyMode: false,

  // 登录密码
  loginEnabled: false,
  loginPassword: '',

  // 管理员密码（用于删除职工等敏感操作，初始默认 654321）
  adminPassword: '481f6cc0511143ccdd7e2d1b1b94faf0a700a8b49cd13922a70b5ae28acaa8c5',

  // 首次使用引导
  onboarded: false
}

class SettingsStore {
  constructor(userDataPath) {
    this.filePath = path.join(userDataPath, 'settings.json')
    this.settings = { ...DEFAULT_SETTINGS }
    this.load()
  }

  load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const data = fs.readFileSync(this.filePath, 'utf-8')
        const saved = JSON.parse(data)
        // 合并默认值，确保新增配置项有默认值
        this.settings = { ...DEFAULT_SETTINGS, ...saved }
      }
    } catch (err) {
      console.error('加载设置失败:', err)
      this.settings = { ...DEFAULT_SETTINGS }
    }
  }

  save() {
    try {
      const dir = path.dirname(this.filePath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      fs.writeFileSync(this.filePath, JSON.stringify(this.settings, null, 2), 'utf-8')
      return true
    } catch (err) {
      console.error('保存设置失败:', err)
      return false
    }
  }

  get(key) {
    return this.settings[key]
  }

  set(key, value) {
    this.settings[key] = value
    return this.save()
  }

  getAll() {
    return { ...this.settings }
  }

  updateAll(newSettings) {
    this.settings = { ...this.settings, ...newSettings }
    return this.save()
  }
}

module.exports = SettingsStore
