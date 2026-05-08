const initSqlJs = require('sql.js')
const fs = require('fs')
const path = require('path')

class LeaveDatabase {
  constructor(dbPath) {
    this.dbPath = dbPath
    this.db = null
    this.ready = false
  }

  // 初始化数据库（异步，首次使用时调用）
  async init() {
    const SQL = await initSqlJs()

    // 如果数据库文件已存在，加载它；否则创建新数据库
    if (fs.existsSync(this.dbPath)) {
      const buffer = fs.readFileSync(this.dbPath)
      this.db = new SQL.Database(buffer)
    } else {
      this.db = new SQL.Database()
    }

    // 自动建表
    this.createTables()
    this.save()

    this.ready = true
  }

  // 确保数据库已初始化
  async ensureReady() {
    if (!this.ready) {
      await this.init()
    }
  }

  // 持久化保存到磁盘
  save() {
    if (this.db) {
      const data = this.db.export()
      const buffer = Buffer.from(data)
      const dir = path.dirname(this.dbPath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      fs.writeFileSync(this.dbPath, buffer)
    }
  }

  // 创建数据表
  createTables() {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS leave_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        applicant TEXT NOT NULL,
        department TEXT,
        agent TEXT,
        leave_type TEXT NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        days INTEGER NOT NULL,
        apply_date DATE,
        cancel_date DATE,
        image_path TEXT,
        ocr_confidence REAL,
        remark TEXT,
        created_at DATETIME DEFAULT (datetime('now', 'localtime'))
      )
    `)
  }

  // 执行查询并返回结果数组（每行为对象）
  _queryAll(sql, params = []) {
    const stmt = this.db.prepare(sql)
    if (params.length > 0) stmt.bind(params)
    const results = []
    while (stmt.step()) {
      results.push(stmt.getAsObject())
    }
    stmt.free()
    return results
  }

  // 执行查询并返回单行
  _queryOne(sql, params = []) {
    const results = this._queryAll(sql, params)
    return results.length > 0 ? results[0] : null
  }

  // 执行写操作
  _run(sql, params = []) {
    this.db.run(sql, params)
    this.save()
  }

  // 插入记录（参数化查询，防SQL注入）
  insert(record) {
    this._run(`
      INSERT INTO leave_records
        (applicant, department, agent, leave_type, start_date, end_date, days, apply_date, cancel_date, image_path, ocr_confidence, remark)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      record.applicant || '',
      record.department || '',
      record.agent || '',
      record.leave_type || '',
      record.start_date || '',
      record.end_date || '',
      record.days || 0,
      record.apply_date || '',
      record.cancel_date || '',
      record.image_path || '',
      record.ocr_confidence || 0,
      record.remark || ''
    ])

    // 获取最后插入的ID
    const result = this._queryOne('SELECT last_insert_rowid() as id')
    return result ? result.id : null
  }

  // 更新记录
  update(id, record) {
    this._run(`
      UPDATE leave_records SET
        applicant = ?, department = ?, agent = ?, leave_type = ?,
        start_date = ?, end_date = ?, days = ?,
        apply_date = ?, cancel_date = ?, remark = ?
      WHERE id = ?
    `, [
      record.applicant || '',
      record.department || '',
      record.agent || '',
      record.leave_type || '',
      record.start_date || '',
      record.end_date || '',
      record.days || 0,
      record.apply_date || '',
      record.cancel_date || '',
      record.remark || '',
      id
    ])
    return true
  }

  // 删除单条记录
  delete(id) {
    this._run('DELETE FROM leave_records WHERE id = ?', [id])
    return true
  }

  // 批量删除
  deleteBatch(ids) {
    if (!ids || ids.length === 0) return false
    const placeholders = ids.map(() => '?').join(',')
    this._run(`DELETE FROM leave_records WHERE id IN (${placeholders})`, ids)
    return true
  }

  // 根据ID查询
  getById(id) {
    return this._queryOne('SELECT * FROM leave_records WHERE id = ?', [id])
  }

  // 查询所有记录（按创建时间倒序）
  getAll() {
    return this._queryAll('SELECT * FROM leave_records ORDER BY created_at DESC')
  }

  // 条件查询
  search(conditions = {}) {
    let sql = 'SELECT * FROM leave_records WHERE 1=1'
    const params = []

    if (conditions.applicant) {
      sql += ' AND applicant LIKE ?'
      params.push(`%${conditions.applicant}%`)
    }
    if (conditions.department) {
      sql += ' AND department LIKE ?'
      params.push(`%${conditions.department}%`)
    }
    if (conditions.leave_type) {
      sql += ' AND leave_type = ?'
      params.push(conditions.leave_type)
    }
    if (conditions.start_date_begin) {
      sql += ' AND start_date >= ?'
      params.push(conditions.start_date_begin)
    }
    if (conditions.start_date_end) {
      sql += ' AND start_date <= ?'
      params.push(conditions.start_date_end)
    }
    if (conditions.end_date_begin) {
      sql += ' AND end_date >= ?'
      params.push(conditions.end_date_begin)
    }
    if (conditions.end_date_end) {
      sql += ' AND end_date <= ?'
      params.push(conditions.end_date_end)
    }

    sql += ' ORDER BY created_at DESC'

    if (conditions.limit) {
      sql += ' LIMIT ?'
      params.push(conditions.limit)
    }

    return this._queryAll(sql, params)
  }

  // 请假类型分布统计
  getLeaveTypeStats() {
    return this._queryAll(`
      SELECT leave_type as name, COUNT(*) as value
      FROM leave_records
      GROUP BY leave_type
      ORDER BY value DESC
    `)
  }

  // 各部门统计
  getDepartmentStats() {
    return this._queryAll(`
      SELECT department as name, COUNT(*) as value
      FROM leave_records
      WHERE department IS NOT NULL AND department != ''
      GROUP BY department
      ORDER BY value DESC
    `)
  }

  // 月度请假趋势（支持按年筛选）
  getMonthlyTrend(year = '') {
    if (year) {
      return this._queryAll(`
        SELECT
          substr(start_date, 6, 2) as month,
          COUNT(*) as value
        FROM leave_records
        WHERE start_date IS NOT NULL AND start_date != ''
          AND substr(start_date, 1, 4) = ?
        GROUP BY month
        ORDER BY month ASC
      `, [String(year)])
    }
    return this._queryAll(`
      SELECT
        substr(start_date, 1, 7) as month,
        COUNT(*) as value
      FROM leave_records
      WHERE start_date IS NOT NULL AND start_date != ''
      GROUP BY month
      ORDER BY month ASC
    `)
  }

  // 人员请假排行榜（支持按年筛选，TOP 10）
  getPersonRanking(year = '') {
    if (year) {
      return this._queryAll(`
        SELECT applicant as name, COUNT(*) as value
        FROM leave_records
        WHERE start_date IS NOT NULL AND start_date != ''
          AND substr(start_date, 1, 4) = ?
        GROUP BY applicant
        ORDER BY value DESC
        LIMIT 10
      `, [String(year)])
    }
    return this._queryAll(`
      SELECT applicant as name, COUNT(*) as value
      FROM leave_records
      GROUP BY applicant
      ORDER BY value DESC
      LIMIT 10
    `)
  }

  // 获取可用年份列表
  getAvailableYears() {
    const rows = this._queryAll(`
      SELECT DISTINCT substr(start_date, 1, 4) as year
      FROM leave_records
      WHERE start_date IS NOT NULL AND start_date != ''
      ORDER BY year DESC
    `)
    return rows.map(r => r.year).filter(y => y && y.length === 4)
  }

  // 获取统计概览
  getStatistics(params = {}) {
    const result = {
      total: 0,
      byType: this.getLeaveTypeStats(),
      byDepartment: this.getDepartmentStats(),
      monthlyTrend: this.getMonthlyTrend(),
      personRanking: this.getPersonRanking()
    }
    const countResult = this._queryOne('SELECT COUNT(*) as total FROM leave_records')
    result.total = countResult ? countResult.total : 0
    return result
  }

  // 关闭数据库
  close() {
    if (this.db) {
      this.save()
      this.db.close()
    }
  }
}

module.exports = LeaveDatabase
