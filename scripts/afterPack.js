/**
 * electron-builder afterPack hook — 使用本地 rcedit 强制嵌入应用图标
 * 绕过 app-builder 内置的 rcedit（需从 GitHub 下载 winCodeSign，网络不稳定时静默失败）
 */
const { rcedit } = require('rcedit')
const path = require('path')
const fs = require('fs')

exports.default = async function (context) {
  const { appOutDir, packager } = context

  // 找到主 EXE 文件
  const exeName = `${packager.appInfo.productName}.exe`
  const exePath = path.join(appOutDir, exeName)

  if (!fs.existsSync(exePath)) {
    console.log('[afterPack] EXE not found:', exePath)
    return
  }

  // 图标文件路径
  const iconPath = path.join(packager.projectDir, 'build', 'icon.ico')
  if (!fs.existsSync(iconPath)) {
    console.log('[afterPack] Icon not found:', iconPath)
    return
  }

  console.log('[afterPack] Applying icon:', iconPath)
  console.log('[afterPack] Target EXE:', exePath)

  try {
    await rcedit(exePath, { icon: iconPath })
    console.log('[afterPack] Icon applied successfully')
  } catch (err) {
    console.error('[afterPack] Icon apply failed:', err.message)
  }
}
