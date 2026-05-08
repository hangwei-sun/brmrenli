<template>
  <div class="ocr-preview">
    <el-collapse v-model="activeNames" accordion>
      <el-collapse-item
        v-for="(item, index) in results"
        :key="index"
        :name="index"
      >
        <template #title>
          <div class="collapse-title">
            <el-tag :type="item.saved ? 'success' : 'warning'" size="small">
              {{ item.saved ? '已保存' : '待保存' }}
            </el-tag>
            <span class="title-text">
              <strong>{{ item.applicant || '(未识别)' }}</strong>
              - {{ item.leave_type || '未知类型' }}
              ({{ item.start_date }} ~ {{ item.end_date }})
            </span>
            <span class="title-confidence">置信度: {{ item.confidence }}%</span>
          </div>
        </template>

        <div class="preview-content">
          <div class="preview-image">
            <el-image
              :src="item.imageDataUrl"
              fit="contain"
              :preview-src-list="[item.imageDataUrl]"
              style="width:100%; max-height:400px"
            />
            <p class="image-label">原请假条图片（点击可放大）</p>
          </div>

          <div class="preview-form">
            <el-form label-width="90px" size="default">
              <el-form-item label="申请人">
                <el-input v-model="item.applicant" @change="emitUpdate(index, 'applicant', $event)">
                  <template #append>
                    <span class="confidence-stars">{{ getStars(item.fieldConfidence?.applicant) }}</span>
                  </template>
                </el-input>
              </el-form-item>

              <el-form-item label="部门">
                <el-input v-model="item.department" @change="emitUpdate(index, 'department', $event)">
                  <template #append>
                    <span class="confidence-stars">{{ getStars(item.fieldConfidence?.department) }}</span>
                  </template>
                </el-input>
              </el-form-item>

              <el-form-item label="代办人">
                <el-input v-model="item.agent" @change="emitUpdate(index, 'agent', $event)">
                  <template #append>
                    <span class="confidence-stars">{{ getStars(item.fieldConfidence?.agent) }}</span>
                  </template>
                </el-input>
              </el-form-item>

              <el-form-item label="请假类型">
                <el-select v-model="item.leave_type" @change="emitUpdate(index, 'leave_type', $event)" style="width:100%">
                  <el-option v-for="t in leaveTypes" :key="t" :label="t" :value="t" />
                </el-select>
                <span class="confidence-stars" style="margin-left:8px">{{ getStars(item.fieldConfidence?.leave_type) }}</span>
              </el-form-item>

              <el-row :gutter="12">
                <el-col :span="12">
                  <el-form-item label="开始日期">
                    <el-date-picker
                      v-model="item.start_date"
                      type="date"
                      value-format="YYYY-MM-DD"
                      @change="emitUpdate(index, 'start_date', $event)"
                      style="width:100%"
                    />
                    <span class="confidence-stars">{{ getStars(item.fieldConfidence?.start_date) }}</span>
                  </el-form-item>
                </el-col>
                <el-col :span="12">
                  <el-form-item label="结束日期">
                    <el-date-picker
                      v-model="item.end_date"
                      type="date"
                      value-format="YYYY-MM-DD"
                      @change="emitUpdate(index, 'end_date', $event)"
                      style="width:100%"
                    />
                    <span class="confidence-stars">{{ getStars(item.fieldConfidence?.end_date) }}</span>
                  </el-form-item>
                </el-col>
              </el-row>

              <el-row :gutter="12">
                <el-col :span="8">
                  <el-form-item label="天数">
                    <el-input-number v-model="item.days" :min="1" :max="365" @change="emitUpdate(index, 'days', $event)" style="width:100%" />
                    <span class="confidence-stars">{{ getStars(item.fieldConfidence?.days) }}</span>
                  </el-form-item>
                </el-col>
                <el-col :span="8">
                  <el-form-item label="申请日期">
                    <el-date-picker
                      v-model="item.apply_date"
                      type="date"
                      value-format="YYYY-MM-DD"
                      @change="emitUpdate(index, 'apply_date', $event)"
                      style="width:100%"
                    />
                  </el-form-item>
                </el-col>
                <el-col :span="8">
                  <el-form-item label="销假日期">
                    <el-date-picker
                      v-model="item.cancel_date"
                      type="date"
                      value-format="YYYY-MM-DD"
                      @change="emitUpdate(index, 'cancel_date', $event)"
                      style="width:100%"
                    />
                  </el-form-item>
                </el-col>
              </el-row>

              <el-form-item label="识别原文">
                <el-input
                  v-model="item.fullText"
                  type="textarea"
                  :rows="3"
                  readonly
                  style="font-size: 12px; color: #909399"
                />
              </el-form-item>

              <!-- OCR提取详情 -->
              <el-form-item label="提取详情" v-if="item.extractedWords">
                <div class="extraction-detail">
                  <div v-for="(words, field) in item.extractedWords" :key="field"
                       v-if="words && words.length > 0" class="field-match">
                    <el-tag size="small" type="success" effect="plain">{{ fieldMap[field] || field }}</el-tag>
                    <span v-for="(w, wi) in words" :key="wi" class="matched-word">
                      "{{ w.text }}"
                      <el-tag size="small" :type="w.confidence > 70 ? 'success' : 'warning'" effect="dark" round>
                        {{ Math.round(w.confidence) }}%
                      </el-tag>
                    </span>
                  </div>
                  <div v-if="!hasSpatialMatch(item)" class="no-match">
                    <el-tag size="small" type="info">使用文本正则匹配（建议人工核对）</el-tag>
                  </div>
                </div>
              </el-form-item>
            </el-form>

            <div class="preview-actions">
              <el-button
                type="primary"
                :disabled="item.saved"
                @click="$emit('save', index)"
              >
                {{ item.saved ? '已保存' : '保存到数据库' }}
              </el-button>
            </div>
          </div>
        </div>
      </el-collapse-item>
    </el-collapse>

    <div v-if="results.length > 0" style="margin-top: 16px; text-align: right">
      <el-button type="success" @click="$emit('saveAll')">
        <el-icon><Check /></el-icon>
        全部保存到数据库
      </el-button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

defineProps({
  results: { type: Array, default: () => [] }
})

const emit = defineEmits(['update', 'save', 'saveAll'])

const activeNames = ref([0])

const leaveTypes = [
  '年休假', '病假', '事假', '婚假', '丧假',
  '探亲假', '产假', '护理假', '育儿假'
]

// 字段名映射
const fieldMap = {
  applicant: '申请人', department: '部门', agent: '代办人',
  leave_type: '请假类型', start_date: '开始日期', end_date: '结束日期',
  days: '天数', apply_date: '申请日期', cancel_date: '销假日期'
}

function getStars(confidence) {
  if (confidence >= 3) return '★★★ 高精度'
  if (confidence >= 2) return '★★☆ 中等'
  if (confidence >= 1) return '★☆☆ 低精度'
  return '☆☆☆ 需确认'
}

// 检查是否有空间位置匹配
function hasSpatialMatch(item) {
  if (!item.extractedWords) return false
  for (const words of Object.values(item.extractedWords)) {
    if (words && words.length > 0) return true
  }
  return false
}

function emitUpdate(index, field, value) {
  emit('update', { index, field, value })
}
</script>

<style scoped>
.collapse-title {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
}

.title-text {
  flex: 1;
  font-size: 14px;
}

.title-confidence {
  font-size: 12px;
  color: #909399;
}

.preview-content {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  padding: 16px 0;
}

.preview-image {
  border-right: 1px solid #ebeef5;
  padding-right: 16px;
}

.image-label {
  text-align: center;
  font-size: 12px;
  color: #909399;
  margin-top: 8px;
}

.preview-form {
  overflow-y: auto;
  max-height: 500px;
  padding-right: 8px;
}

.preview-actions {
  text-align: right;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #ebeef5;
}

.confidence-stars {
  color: #e6a23c;
  font-size: 12px;
}

.extraction-detail {
  font-size: 12px;
  line-height: 2;
}

.field-match {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 2px;
}

.matched-word {
  color: #409eff;
  margin-right: 2px;
}

.no-match {
  margin-top: 4px;
}
</style>
