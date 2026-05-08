<template>
  <div class="statistics">
    <!-- 顶部操作栏 -->
    <div class="stats-toolbar">
      <el-button type="primary" @click="loadStats" :loading="loading">
        <el-icon><Refresh /></el-icon>
        刷新数据
      </el-button>
      <div class="year-selector">
        <span class="year-label">年度：</span>
        <el-select v-model="selectedYear" placeholder="全部年份" clearable @change="onYearChange" style="width:140px">
          <el-option label="全部年份" value="" />
          <el-option v-for="y in availableYears" :key="y" :label="y + ' 年'" :value="y" />
        </el-select>
      </div>
    </div>

    <!-- 概览卡片 -->
    <el-row :gutter="16" class="overview-row">
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card total-card">
          <div class="stat-content">
            <div class="stat-icon">
              <el-icon :size="36"><Document /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-number">{{ stats.total }}</div>
              <div class="stat-label">总记录数</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card dept-card">
          <div class="stat-content">
            <div class="stat-icon">
              <el-icon :size="36"><OfficeBuilding /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-number">{{ stats.byDepartment?.length || 0 }}</div>
              <div class="stat-label">涉及部门数</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card person-card">
          <div class="stat-content">
            <div class="stat-icon">
              <el-icon :size="36"><User /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-number">{{ selectedYear ? yearTotalPersons : (stats.personRanking?.length || 0) }}</div>
              <div class="stat-label">{{ selectedYear ? selectedYear + '年请假人次' : '请假人次' }}</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card type-card">
          <div class="stat-content">
            <div class="stat-icon">
              <el-icon :size="36"><DataAnalysis /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-number">{{ stats.byType?.length || 0 }}</div>
              <div class="stat-label">请假类型数</div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 图表区 第一行 -->
    <el-row :gutter="16">
      <el-col :span="12">
        <el-card class="chart-card">
          <template #header>
            <div class="card-header">
              <el-icon><PieChart /></el-icon>
              <span>请假类型占比</span>
              <el-button size="small" @click="exportChart('pieChart')" style="margin-left:auto">导出图片</el-button>
            </div>
          </template>
          <div ref="pieChartRef" class="chart-box"></div>
        </el-card>
      </el-col>

      <el-col :span="12">
        <el-card class="chart-card">
          <template #header>
            <div class="card-header">
              <el-icon><Histogram /></el-icon>
              <span>各部门请假人次统计</span>
              <el-button size="small" @click="exportChart('barChart')" style="margin-left:auto">导出图片</el-button>
            </div>
          </template>
          <div ref="barChartRef" class="chart-box"></div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 图表区 第二行 -->
    <el-row :gutter="16">
      <el-col :span="12">
        <el-card class="chart-card">
          <template #header>
            <div class="card-header">
              <el-icon><TrendCharts /></el-icon>
              <span>{{ selectedYear ? selectedYear + '年 年度请假趋势（每月人数）' : '月度请假趋势' }}</span>
              <el-button size="small" @click="exportChart('lineChart')" style="margin-left:auto">导出图片</el-button>
            </div>
          </template>
          <div ref="lineChartRef" class="chart-box"></div>
        </el-card>
      </el-col>

      <el-col :span="12">
        <el-card class="chart-card">
          <template #header>
            <div class="card-header">
              <el-icon><TrophyBase /></el-icon>
              <span>{{ selectedYear ? selectedYear + '年 年度请假排行榜 (TOP 10)' : '人员请假排行榜 (TOP 10)' }}</span>
              <el-button size="small" @click="exportChart('rankChart')" style="margin-left:auto">导出图片</el-button>
            </div>
          </template>
          <div ref="rankChartRef" class="chart-box"></div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import * as echarts from 'echarts'
import { getLeaveTypeStats, getDepartmentStats, getMonthlyTrend, getPersonRanking, getAvailableYears } from '../utils/api.js'

const pieChartRef = ref(null)
const barChartRef = ref(null)
const lineChartRef = ref(null)
const rankChartRef = ref(null)

let pieChart = null
let barChart = null
let lineChart = null
let rankChart = null

const loading = ref(false)
const selectedYear = ref('')
const availableYears = ref([])

const stats = reactive({
  total: 0,
  byType: [],
  byDepartment: [],
  monthlyTrend: [],
  personRanking: []
})

const chartColors = ['#409EFF', '#67C23A', '#E6A23C', '#F56C6C', '#909399', '#00D4FF', '#FF6B9D', '#C990F2', '#FFD700', '#87CEEB']

// 年度请假总人次
const yearTotalPersons = computed(() => {
  if (!stats.personRanking) return 0
  return stats.personRanking.reduce((sum, p) => sum + p.value, 0)
})

// 月份名称映射
const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']

// 加载可用年份
async function loadYears() {
  try {
    availableYears.value = await getAvailableYears()
    // 默认选中最新年份
    if (availableYears.value.length > 0 && !selectedYear.value) {
      selectedYear.value = availableYears.value[0]
    }
  } catch {
    // ignore
  }
}

// 年度切换
function onYearChange() {
  loadStats()
}

// 加载统计数据
async function loadStats() {
  loading.value = true
  try {
    const year = selectedYear.value || ''
    const [typeStats, deptStats, trend, ranking] = await Promise.all([
      getLeaveTypeStats(),
      getDepartmentStats(),
      getMonthlyTrend(year),
      getPersonRanking(year)
    ])

    stats.total = (typeStats || []).reduce((sum, item) => sum + item.value, 0)
    stats.byType = typeStats || []
    stats.byDepartment = deptStats || []
    // 当年份筛选时，补全12个月的数据
    if (year) {
      const monthlyMap = {}
      ;(trend || []).forEach(t => { monthlyMap[t.month] = t.value })
      stats.monthlyTrend = monthNames.map((name, i) => ({
        month: name,
        value: monthlyMap[String(i + 1).padStart(2, '0')] || 0
      }))
    } else {
      stats.monthlyTrend = trend || []
    }
    stats.personRanking = ranking || []

    await nextTick()
    renderAllCharts()
  } catch (err) {
    console.error('加载统计数据失败:', err)
    ElMessage.error('加载统计数据失败')
  } finally {
    loading.value = false
  }
}

function renderAllCharts() {
  renderPieChart()
  renderBarChart()
  renderLineChart()
  renderRankChart()
}

// 饼图 - 请假类型占比
function renderPieChart() {
  if (!pieChartRef.value) return
  if (pieChart) pieChart.dispose()
  pieChart = echarts.init(pieChartRef.value)

  const data = stats.byType.length > 0 ? stats.byType : [{ name: '暂无数据', value: 1 }]
  pieChart.setOption({
    tooltip: { trigger: 'item', formatter: '{b}: {c} 次 ({d}%)' },
    legend: { orient: 'vertical', right: 10, top: 'center' },
    color: chartColors,
    series: [{
      type: 'pie',
      radius: ['40%', '70%'],
      center: ['40%', '50%'],
      avoidLabelOverlap: false,
      itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
      label: { show: true, formatter: '{b}\n{d}%' },
      emphasis: { label: { fontSize: 16, fontWeight: 'bold' } },
      data: data.map(t => ({ name: t.name, value: t.value }))
    }]
  })
}

// 柱状图 - 各部门统计
function renderBarChart() {
  if (!barChartRef.value) return
  if (barChart) barChart.dispose()
  barChart = echarts.init(barChartRef.value)

  const data = stats.byDepartment.length > 0 ? stats.byDepartment : [{ name: '暂无数据', value: 0 }]
  barChart.setOption({
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: '3%', right: '10%', bottom: '3%', containLabel: true },
    xAxis: {
      type: 'category',
      data: data.map(d => d.name),
      axisLabel: { rotate: 30, fontSize: 11 }
    },
    yAxis: { type: 'value', name: '人次', minInterval: 1 },
    series: [{
      type: 'bar',
      data: data.map((d, i) => ({
        value: d.value,
        itemStyle: { color: chartColors[i % chartColors.length], borderRadius: [4, 4, 0, 0] }
      })),
      barWidth: '50%',
      label: { show: true, position: 'top', fontSize: 11 }
    }]
  })
}

// 折线图 - 年度月度趋势
function renderLineChart() {
  if (!lineChartRef.value) return
  if (lineChart) lineChart.dispose()
  lineChart = echarts.init(lineChartRef.value)

  const data = stats.monthlyTrend.length > 0 ? stats.monthlyTrend : [{ month: '暂无', value: 0 }]
  const title = selectedYear.value ? '请假人次' : '人次'
  lineChart.setOption({
    tooltip: {
      trigger: 'axis',
      formatter: function(params) {
        const p = params[0]
        return (selectedYear.value ? selectedYear.value + '年 ' : '') + p.name + '<br/>请假人数: ' + p.value + ' 人'
      }
    },
    grid: { left: '3%', right: '8%', bottom: '3%', top: '8%', containLabel: true },
    xAxis: {
      type: 'category',
      data: data.map(d => d.month),
      boundaryGap: false
    },
    yAxis: { type: 'value', name: title, minInterval: 1 },
    series: [{
      type: 'line',
      name: '请假人数',
      data: data.map(d => d.value),
      smooth: true,
      lineStyle: { color: '#409EFF', width: 3 },
      itemStyle: { color: '#409EFF' },
      symbol: 'circle',
      symbolSize: 8,
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: 'rgba(64, 158, 255, 0.3)' },
          { offset: 1, color: 'rgba(64, 158, 255, 0.05)' }
        ])
      },
      label: { show: true, fontSize: 11, formatter: '{c}人' },
      markLine: {
        silent: true,
        data: [{ type: 'average', name: '月均' }],
        lineStyle: { color: '#E6A23C', type: 'dashed' }
      }
    }]
  })
}

// 横向柱状图 - 人员排行榜 TOP 10
function renderRankChart() {
  if (!rankChartRef.value) return
  if (rankChart) rankChart.dispose()
  rankChart = echarts.init(rankChartRef.value)

  const data = stats.personRanking.length > 0 ? [...stats.personRanking].reverse() : [{ name: '暂无数据', value: 0 }]
  rankChart.setOption({
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: function(params) {
        const p = params[0]
        return p.name + '<br/>请假次数: ' + p.value + ' 次'
      }
    },
    grid: { left: '3%', right: '10%', bottom: '3%', containLabel: true },
    xAxis: { type: 'value', name: '次数', minInterval: 1 },
    yAxis: {
      type: 'category',
      data: data.map(d => d.name),
      axisLabel: { fontSize: 12 }
    },
    series: [{
      type: 'bar',
      data: data.map((d, i) => ({
        value: d.value,
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
            { offset: 0, color: i < 3 ? '#F56C6C' : '#409EFF' },
            { offset: 1, color: i < 3 ? '#E6A23C' : '#67C23A' }
          ]),
          borderRadius: [0, 4, 4, 0]
        }
      })),
      barWidth: '60%',
      label: { show: true, position: 'right', fontSize: 12, formatter: '{c}次' }
    }]
  })
}

// 导出图表为图片
function exportChart(chartName) {
  let chart = null
  let filename = ''
  switch (chartName) {
    case 'pieChart': chart = pieChart; filename = '请假类型占比'; break
    case 'barChart': chart = barChart; filename = '各部门统计'; break
    case 'lineChart': chart = lineChart; filename = (selectedYear.value || '全部') + '_请假趋势'; break
    case 'rankChart': chart = rankChart; filename = (selectedYear.value || '全部') + '_请假排行榜'; break
  }
  if (chart) {
    const url = chart.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#fff' })
    const link = document.createElement('a')
    link.href = url
    link.download = filename + '_' + new Date().toISOString().slice(0, 10) + '.png'
    link.click()
    ElMessage.success(filename + ' 导出成功')
  }
}

// 窗口resize
function handleResize() {
  pieChart?.resize()
  barChart?.resize()
  lineChart?.resize()
  rankChart?.resize()
}

onMounted(() => {
  loadYears().then(() => loadStats())
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  pieChart?.dispose()
  barChart?.dispose()
  lineChart?.dispose()
  rankChart?.dispose()
})
</script>

<style scoped>
.stats-toolbar {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 12px;
}

.year-selector {
  display: flex;
  align-items: center;
  gap: 8px;
}

.year-label {
  font-size: 14px;
  color: #606266;
  font-weight: 500;
}

.overview-row {
  margin-bottom: 16px;
}

.stat-card {
  cursor: default;
}

.stat-content {
  display: flex;
  align-items: center;
  gap: 16px;
}

.stat-icon {
  width: 60px;
  height: 60px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.total-card .stat-icon { background: rgba(64, 158, 255, 0.1); color: #409EFF; }
.dept-card .stat-icon { background: rgba(103, 194, 58, 0.1); color: #67C23A; }
.person-card .stat-icon { background: rgba(230, 162, 60, 0.1); color: #E6A23C; }
.type-card .stat-icon { background: rgba(245, 108, 108, 0.1); color: #F56C6C; }

.stat-number {
  font-size: 28px;
  font-weight: 700;
  color: #303133;
}

.stat-label {
  font-size: 13px;
  color: #909399;
  margin-top: 4px;
}

.chart-card {
  margin-bottom: 16px;
  break-inside: avoid;
}

.chart-box {
  width: 100%;
  height: 350px;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
}
</style>
