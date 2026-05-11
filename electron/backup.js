const AdmZip = require('adm-zip')
const fs = require('fs')
const path = require('path')

class BackupManager {
  constructor(userDataPath, dbInstance) {
    this.userDataPath = userDataPath
    this.db = dbInstance
  }

  // 导出备份：打包 DB + images/ + settings.json → 返回 zip Buffer
  createBackup() {
    const zip = new AdmZip()

    // 数据库文件
    const dbPath = path.join(this.userDataPath, 'leave_records.db')
    if (fs.existsSync(dbPath)) {
      zip.addLocalFile(dbPath)
    } else {
      throw new Error('数据库文件不存在')
    }

    // 图片目录
    const imagesDir = path.join(this.userDataPath, 'images')
    if (fs.existsSync(imagesDir)) {
      const files = fs.readdirSync(imagesDir)
      for (const file of files) {
        const filePath = path.join(imagesDir, file)
        if (fs.statSync(filePath).isFile()) {
          zip.addLocalFile(filePath, 'images')
        }
      }
    }

    // 设置文件
    const settingsPath = path.join(this.userDataPath, 'settings.json')
    if (fs.existsSync(settingsPath)) {
      zip.addLocalFile(settingsPath)
    }

    return zip.toBuffer()
  }

  // 导入备份：解压 .zip 并全量替换数据
  async restore(backupFilePath) {
    if (!fs.existsSync(backupFilePath)) {
      throw new Error('备份文件不存在')
    }

    const buffer = fs.readFileSync(backupFilePath)
    const zip = new AdmZip(buffer)
    const entries = zip.getEntries()

    // 校验：必须包含数据库文件
    const hasDb = entries.some(e => e.entryName === 'leave_records.db')
    if (!hasDb) {
      throw new Error('备份文件无效：未找到 leave_records.db')
    }

    const dbPath = path.join(this.userDataPath, 'leave_records.db')
    const imagesDir = path.join(this.userDataPath, 'images')
    const settingsPath = path.join(this.userDataPath, 'settings.json')

    // 1. 关闭数据库
    if (this.db) {
      this.db.close()
    }

    try {
      // 2. 解压数据库文件
      const dbEntry = entries.find(e => e.entryName === 'leave_records.db')
      fs.writeFileSync(dbPath, dbEntry.getData())

      // 3. 清空并重建图片目录
      if (fs.existsSync(imagesDir)) {
        fs.rmSync(imagesDir, { recursive: true, force: true })
      }
      fs.mkdirSync(imagesDir, { recursive: true })

      for (const entry of entries) {
        if (entry.entryName.startsWith('images/') && !entry.isDirectory) {
          const fileName = path.basename(entry.entryName)
          const destPath = path.join(imagesDir, fileName)
          fs.writeFileSync(destPath, entry.getData())
        }
      }

      // 4. 解压设置文件
      if (entries.some(e => e.entryName === 'settings.json')) {
        const settingsEntry = entries.find(e => e.entryName === 'settings.json')
        fs.writeFileSync(settingsPath, settingsEntry.getData())
      }

      // 5. 重新初始化数据库
      await this.db.init()

      // 6. 修复图片路径（跨机还原后路径变化）
      this._fixupImagePaths(imagesDir)

      return { success: true, message: '备份数据已成功恢复' }
    } catch (err) {
      // 回滚：尝试重新打开数据库
      try { await this.db.init() } catch { /* ignore */ }
      throw err
    }
  }

  // 修复跨机还原后的图片绝对路径
  _fixupImagePaths(newImagesDir) {
    try {
      const records = this.db._queryAll(
        "SELECT id, image_path FROM leave_records WHERE image_path IS NOT NULL AND image_path != ''"
      )
      for (const record of records) {
        const oldPath = record.image_path || ''
        const fileName = oldPath.replace(/\\/g, '/').split('/').pop()
        if (!fileName) continue
        const newPath = path.join(newImagesDir, fileName)
        if (fs.existsSync(newPath)) {
          this.db._run('UPDATE leave_records SET image_path = ? WHERE id = ?', [newPath, record.id])
        }
      }
      this.db.save()
    } catch (err) {
      console.warn('图片路径修复失败（非致命）:', err.message)
    }
  }

  // 获取备份信息概览（用于展示）
  getBackupInfo(backupFilePath) {
    if (!fs.existsSync(backupFilePath)) {
      throw new Error('备份文件不存在')
    }
    const buffer = fs.readFileSync(backupFilePath)
    const zip = new AdmZip(buffer)
    const entries = zip.getEntries()

    const hasDb = entries.some(e => e.entryName === 'leave_records.db')
    const imageCount = entries.filter(e => e.entryName.startsWith('images/') && !e.isDirectory).length
    const hasSettings = entries.some(e => e.entryName === 'settings.json')
    const fileSize = fs.statSync(backupFilePath).size

    return { hasDb, imageCount, hasSettings, fileSize }
  }
}

module.exports = BackupManager
