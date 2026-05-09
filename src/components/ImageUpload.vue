<template>
  <div class="image-upload">
    <!-- 上传区域 -->
    <el-card class="section-card">
      <template #header>
        <div class="card-header">
          <el-icon><Upload /></el-icon>
          <span>上传请假条图片</span>
          <el-button type="primary" link size="small" style="margin-left:auto" @click="showManualDialog = true">
            <el-icon><Edit /></el-icon>
            手动录入
          </el-button>
        </div>
      </template>

      <!-- 拖拽/点击上传 -->
      <div
        class="upload-area"
        :class="{ 'is-dragover': isDragover }"
        @dragover.prevent="isDragover = true"
        @dragleave.prevent="isDragover = false"
        @drop.prevent="handleDrop"
        @click="handleClickUpload"
      >
        <el-icon :size="48" color="#c0c4cc"><Plus /></el-icon>
        <p class="upload-text">拖拽图片到此处，或点击选择文件</p>
        <p class="upload-hint">支持 JPG、PNG、BMP、TIFF、WebP 格式</p>
      </div>
    </el-card>

    <!-- 已选择的图片列表 -->
    <el-card v-if="imageList.length > 0" class="section-card">
      <template #header>
        <div class="card-header">
          <el-icon><PictureFilled /></el-icon>
          <span>待识别图片 ({{ imageList.length }})</span>
        </div>
      </template>

      <div class="image-grid">
        <div v-for="(img, index) in imageList" :key="index" class="image-item">
          <img :src="img.dataUrl" :alt="img.name" class="preview-thumb" />
          <div class="image-info">
            <span class="image-name">{{ img.name }}</span>
            <el-icon class="remove-btn" @click="removeImage(index)" color="#f56c6c">
              <CircleCloseFilled />
            </el-icon>
          </div>
        </div>
      </div>

      <div class="action-bar">
        <el-button @click="clearImages">清空全部</el-button>
        <el-button type="primary" @click="startOcr" :loading="ocrRunning" :disabled="ocrRunning">
          <el-icon><SwitchButton /></el-icon>
          {{ ocrRunning ? '正在识别中...' : '开始OCR识别' }}
        </el-button>
      </div>
    </el-card>

    <!-- OCR识别进度 -->
    <el-card v-if="ocrRunning" class="section-card">
      <template #header>
        <div class="card-header">
          <el-icon><Loading /></el-icon>
          <span>OCR识别进度</span>
        </div>
      </template>
      <el-steps :active="currentStep" align-center>
        <el-step title="加载OCR引擎" description="初始化Tesseract中文模型" />
        <el-step title="识别中" :description="'正在处理第 ' + (currentProgress + 1) + '/' + imageList.length + ' 张图片'" />
        <el-step title="提取字段" description="智能提取请假条信息" />
        <el-step title="完成" description="请核对并修正识别结果" />
      </el-steps>
      <el-progress
        :percentage="imageList.length > 0 ? Math.round((currentProgress / imageList.length) * 100) : 0"
        :stroke-width="8"
        style="margin-top: 16px"
      />
    </el-card>

    <!-- 识别结果预览 -->
    <el-card v-if="ocrResults.length > 0 && !ocrRunning" class="section-card">
      <template #header>
        <div class="card-header">
          <el-icon><List /></el-icon>
          <span>识别结果预览 (点击展开后可修改)</span>
        </div>
      </template>
      <OcrPreview
        :results="ocrResults"
        @update="handleOcrUpdate"
        @save="handleOcrSave"
        @saveAll="handleSaveAll"
      />
    </el-card>

    <!-- 手动录入对话框 -->
    <el-dialog
      v-model="showManualDialog"
      title="手动录入请假记录"
      width="600px"
      :close-on-click-modal="false"
      destroy-on-close
    >
      <el-form :model="manualForm" label-width="90px" :rules="manualRules" ref="manualFormRef">
        <!-- 申请日期 - 最上面，整行显示 -->
        <el-form-item label="申请日期">
          <el-date-picker v-model="manualForm.apply_date" type="date" value-format="YYYY-MM-DD" placeholder="选择申请日期" style="width:100%" />
        </el-form-item>

        <!-- 识图上传 -->
        <el-form-item label="图片上传">
          <div class="manual-upload" @click="manualFileInput?.click()">
            <input ref="manualFileInput" type="file" accept="image/*" @change="onManualImageChange" style="display:none" />
            <template v-if="manualImagePreview">
              <img :src="manualImagePreview" class="manual-image-preview" />
              <el-icon class="manual-image-remove" @click.stop="removeManualImage" color="#f56c6c"><CircleCloseFilled /></el-icon>
            </template>
            <template v-else>
              <el-icon :size="36" color="#c0c4cc"><Plus /></el-icon>
              <p class="manual-upload-hint">点击上传请假条图片（可选）</p>
            </template>
          </div>
        </el-form-item>

        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="申请人" prop="applicant">
              <el-input v-model="manualForm.applicant" placeholder="姓名" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="部门">
              <el-input v-model="manualForm.department" placeholder="所在部门" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="代办人">
              <el-input v-model="manualForm.agent" placeholder="代办人姓名" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="请假类型" prop="leave_type">
              <el-select v-model="manualForm.leave_type" placeholder="选择类型" style="width:100%">
                <el-option v-for="t in leaveTypes" :key="t" :label="t" :value="t" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="开始日期" prop="start_date">
              <el-date-picker v-model="manualForm.start_date" type="date" value-format="YYYY-MM-DD" placeholder="选择" style="width:100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="结束日期" prop="end_date">
              <el-date-picker v-model="manualForm.end_date" type="date" value-format="YYYY-MM-DD" placeholder="选择" style="width:100%" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="天数" prop="days">
              <el-input-number v-model="manualForm.days" :min="1" :max="365" style="width:100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="销假日期">
              <el-date-picker v-model="manualForm.cancel_date" type="date" value-format="YYYY-MM-DD" placeholder="选择" style="width:100%" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="备注">
          <el-input v-model="manualForm.remark" type="textarea" :rows="2" placeholder="可选备注" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showManualDialog = false">取消</el-button>
        <el-button type="primary" @click="saveManualEntry" :loading="savingManual">保存记录</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { ElMessage, ElNotification } from 'element-plus'
import OcrPreview from './OcrPreview.vue'
import { openImages, readImage, copyImage, recognizeOcr, insertRecord, saveBase64Image } from '../utils/api.js'

const emit = defineEmits(['recognized'])

const leaveTypes = [
  '年休假', '病假', '事假', '婚假', '丧假',
  '探亲假', '产假', '护理假', '育儿假'
]

// 手动录入
const showManualDialog = ref(false)
const savingManual = ref(false)
const manualFormRef = ref(null)
const manualFileInput = ref(null)
const manualImagePreview = ref('')
const manualImageFile = ref(null)

const manualForm = reactive({
  applicant: '',
  department: '',
  agent: '',
  leave_type: '',
  start_date: '',
  end_date: '',
  days: 0,
  apply_date: '',
  cancel_date: '',
  remark: ''
})

const manualRules = {
  applicant: [{ required: true, message: '请输入申请人', trigger: 'blur' }],
  leave_type: [{ required: true, message: '请选择请假类型', trigger: 'change' }],
  start_date: [{ required: true, message: '请选择开始日期', trigger: 'change' }],
  end_date: [{ required: true, message: '请选择结束日期', trigger: 'change' }],
  days: [{ required: true, message: '请输入天数', trigger: 'blur' }]
}

// 手动录入图片处理
function onManualImageChange(e) {
  const file = e.target.files?.[0]
  if (!file) return
  manualImageFile.value = file
  const reader = new FileReader()
  reader.onload = (ev) => {
    manualImagePreview.value = ev.target.result
  }
  reader.readAsDataURL(file)
}

function removeManualImage() {
  manualImagePreview.value = ''
  manualImageFile.value = null
  if (manualFileInput.value) manualFileInput.value.value = ''
}

async function saveManualEntry() {
  const valid = await manualFormRef.value.validate().catch(() => false)
  if (!valid) return

  savingManual.value = true
  try {
    let imagePath = ''
    // 如果手动上传了图片，通过base64保存到应用目录
    if (manualImagePreview.value && manualImageFile.value) {
      try {
        imagePath = await saveBase64Image(manualImagePreview.value, manualImageFile.value.name || 'image.png')
      } catch { /* 浏览器模式回退 */ }
    }
    await insertRecord({
      applicant: manualForm.applicant,
      department: manualForm.department,
      agent: manualForm.agent,
      leave_type: manualForm.leave_type,
      start_date: manualForm.start_date,
      end_date: manualForm.end_date,
      days: manualForm.days,
      apply_date: manualForm.apply_date,
      cancel_date: manualForm.cancel_date,
      image_path: imagePath,
      ocr_confidence: 100,
      remark: manualForm.remark
    })
    ElMessage.success('手动录入保存成功')
    showManualDialog.value = false
    manualImagePreview.value = ''
    manualImageFile.value = null
    Object.assign(manualForm, {
      applicant: '', department: '', agent: '', leave_type: '',
      start_date: '', end_date: '', days: 0, apply_date: '', cancel_date: '', remark: ''
    })
    emit('recognized', null)
  } catch (err) {
    ElMessage.error('保存失败: ' + err.message)
  } finally {
    savingManual.value = false
  }
}

const isDragover = ref(false)
const imageList = ref([])
const ocrRunning = ref(false)
const currentStep = ref(0)
const currentProgress = ref(0)
const ocrResults = ref([])

// 判断是否在Electron环境
function isElectron() {
  return !!window.electronAPI
}

// 处理文件（通用）
async function processFiles(files) {
  const validTypes = ['image/jpeg', 'image/png', 'image/bmp', 'image/tiff', 'image/webp']
  for (const file of files) {
    if (!validTypes.includes(file.type)) {
      ElMessage.warning('文件 ' + file.name + ' 不是支持的图片格式，已跳过')
      continue
    }
    const reader = new FileReader()
    const dataUrl = await new Promise((resolve) => {
      reader.onload = (e) => resolve(e.target.result)
      reader.readAsDataURL(file)
    })
    imageList.value.push({
      file,
      name: file.name,
      dataUrl,
      path: file.path || ''
    })
  }
}

// 拖拽放下处理
function handleDrop(e) {
  isDragover.value = false
  const files = Array.from(e.dataTransfer.files)
  if (files.length > 0) {
    processFiles(files)
  }
}

// 点击上传
async function handleClickUpload() {
  if (isElectron()) {
    const filePaths = await openImages()
    if (filePaths && filePaths.length > 0) {
      for (const fpath of filePaths) {
        const base64 = await readImage(fpath)
        const name = fpath.split(/[\\/]/).pop()
        imageList.value.push({
          file: null,
          name,
          dataUrl: base64 || '',
          path: fpath
        })
      }
    }
  } else {
    // 浏览器环境：创建隐藏input
    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = true
    input.accept = 'image/*'
    input.onchange = (e) => {
      processFiles(Array.from(e.target.files))
    }
    input.click()
  }
}

// 移除图片
function removeImage(index) {
  imageList.value.splice(index, 1)
}

// 清空图片列表
function clearImages() {
  imageList.value = []
  ocrResults.value = []
}

// 开始OCR识别
async function startOcr() {
  if (imageList.value.length === 0) {
    ElMessage.warning('请先上传图片')
    return
  }

  if (!isElectron()) {
    ElMessage.warning('OCR识别功能需要在 Electron 应用中运行')
    return
  }

  ocrRunning.value = true
  currentStep.value = 0
  currentProgress.value = 0
  ocrResults.value = []

  try {
    currentStep.value = 1

    for (let i = 0; i < imageList.value.length; i++) {
      const img = imageList.value[i]
      currentProgress.value = i

      // 复制图片到应用目录备份
      let imagePath = img.path || img.dataUrl
      if (img.path) {
        imagePath = await copyImage(img.path)
      }

      // 执行OCR识别
      const ocrResult = await recognizeOcr(imagePath)
      if (ocrResult.success) {
        ocrResults.value.push({
          ...ocrResult.data,
          imagePath,
          imageDataUrl: img.dataUrl,
          imageName: img.name,
          saved: false
        })
      } else {
        ElMessage.error('识别 ' + img.name + ' 失败: ' + ocrResult.error)
      }
    }

    currentProgress.value = imageList.value.length
    currentStep.value = 2
    // 模拟字段提取步骤
    await new Promise(r => setTimeout(r, 400))
    currentStep.value = 3

    ElNotification({
      title: 'OCR识别完成',
      message: '成功识别 ' + ocrResults.value.length + ' 张请假条，请核对并修正后保存',
      type: 'success',
      duration: 5000
    })
  } catch (err) {
    ElMessage.error('OCR识别出错: ' + err.message)
  } finally {
    ocrRunning.value = false
  }
}

// 更新OCR结果
function handleOcrUpdate({ index, field, value }) {
  ocrResults.value[index][field] = value
}

// 保存单条
async function handleOcrSave(index) {
  const item = ocrResults.value[index]
  try {
    await insertRecord({
      applicant: item.applicant,
      department: item.department,
      agent: item.agent,
      leave_type: item.leave_type,
      start_date: item.start_date,
      end_date: item.end_date,
      days: item.days,
      apply_date: item.apply_date,
      cancel_date: item.cancel_date,
      image_path: item.imagePath,
      ocr_confidence: item.confidence,
      remark: ''
    })
    ocrResults.value[index].saved = true
    ElMessage.success('保存成功')
    emit('recognized', item)
  } catch (err) {
    ElMessage.error('保存失败: ' + err.message)
  }
}

// 保存全部
async function handleSaveAll() {
  let savedCount = 0
  for (let i = 0; i < ocrResults.value.length; i++) {
    if (ocrResults.value[i].saved) continue
    try {
      await insertRecord({
        applicant: ocrResults.value[i].applicant,
        department: ocrResults.value[i].department,
        agent: ocrResults.value[i].agent,
        leave_type: ocrResults.value[i].leave_type,
        start_date: ocrResults.value[i].start_date,
        end_date: ocrResults.value[i].end_date,
        days: ocrResults.value[i].days,
        apply_date: ocrResults.value[i].apply_date,
        cancel_date: ocrResults.value[i].cancel_date,
        image_path: ocrResults.value[i].imagePath,
        ocr_confidence: ocrResults.value[i].confidence,
        remark: ''
      })
      ocrResults.value[i].saved = true
      savedCount++
    } catch {
      // 跳过保存失败的记录
    }
  }
  ElMessage.success('成功保存 ' + savedCount + ' 条记录')
  emit('recognized', null)
}
</script>

<style scoped>
.upload-area {
  border: 2px dashed #dcdfe6;
  border-radius: 8px;
  padding: 48px 0;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s;
  background: #fafafa;
}

.upload-area:hover,
.upload-area.is-dragover {
  border-color: #409eff;
  background: #ecf5ff;
}

.upload-text {
  margin: 12px 0 4px;
  color: #606266;
  font-size: 16px;
}

.upload-hint {
  color: #c0c4cc;
  font-size: 13px;
}

.image-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 16px;
}

.image-item {
  border: 1px solid #ebeef5;
  border-radius: 6px;
  overflow: hidden;
  background: #fff;
}

.preview-thumb {
  width: 100%;
  height: 160px;
  object-fit: cover;
  display: block;
}

.image-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 10px;
}

.image-name {
  font-size: 12px;
  color: #606266;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.remove-btn {
  cursor: pointer;
  flex-shrink: 0;
}

.action-bar {
  margin-top: 16px;
  text-align: right;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
}

/* 手动录入图片上传 */
.manual-upload {
  width: 100%;
  min-height: 100px;
  border: 2px dashed #d9d9d9;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s;
  position: relative;
  overflow: hidden;
}

.manual-upload:hover {
  border-color: #409EFF;
  background: rgba(64, 158, 255, 0.04);
}

.manual-upload-hint {
  font-size: 12px;
  color: #c0c4cc;
  margin-left: 8px;
}

.manual-image-preview {
  max-width: 100%;
  max-height: 200px;
  object-fit: contain;
}

.manual-image-remove {
  position: absolute;
  top: 8px;
  right: 8px;
  font-size: 20px;
  cursor: pointer;
  z-index: 1;
}
</style>
