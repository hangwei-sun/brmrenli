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
    this.createEmployeeTable()
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
        apply_date = ?, cancel_date = ?, image_path = ?, remark = ?
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
      record.image_path || '',
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

  // ============ 员工管理 ============

  // 创建员工表
  createEmployeeTable() {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS employees (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT,
        id_number TEXT DEFAULT '',
        department TEXT,
        position TEXT,
        employment_type TEXT,
        seq_number INTEGER DEFAULT 0,
        category_seq INTEGER DEFAULT 0,
        remark TEXT,
        created_at DATETIME DEFAULT (datetime('now', 'localtime'))
      )
    `)
    // 为 id_number 非空值创建唯一索引（允许多个空值）
    this.db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_id_number ON employees(id_number) WHERE id_number IS NOT NULL AND id_number != ''`)
    this.migrateEmployeeTable()
  }

  // 自动迁移旧表结构（补齐缺失列、修复约束）
  migrateEmployeeTable() {
    const tableInfo = this._queryAll("PRAGMA table_info(employees)")
    const columnNames = tableInfo.map(c => c.name)

    const migrations = [
      { name: 'position', sql: 'ALTER TABLE employees ADD COLUMN position TEXT' },
      { name: 'employment_type', sql: 'ALTER TABLE employees ADD COLUMN employment_type TEXT' },
      { name: 'remark', sql: 'ALTER TABLE employees ADD COLUMN remark TEXT' },
      { name: 'seq_number', sql: 'ALTER TABLE employees ADD COLUMN seq_number INTEGER DEFAULT 0' },
      { name: 'category_seq', sql: 'ALTER TABLE employees ADD COLUMN category_seq INTEGER DEFAULT 0' },
      { name: 'active', sql: 'ALTER TABLE employees ADD COLUMN active INTEGER DEFAULT 1' }
    ]

    for (const m of migrations) {
      if (!columnNames.includes(m.name)) {
        this.db.run(m.sql)
        this.save()
      }
    }

    // 迁移 id_number 列：去除 NOT NULL UNIQUE 约束，改为部分唯一索引
    this._migrateIdNumberConstraint()
  }

  // 修复 id_number 约束：旧表有 NOT NULL UNIQUE，新结构允许空值
  _migrateIdNumberConstraint() {
    try {
      // 先检查表结构中是否仍有 UNIQUE 约束（这是根因）
      const tableSQL = this._queryOne("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'employees'")
      const hasUnique = tableSQL && tableSQL.sql && tableSQL.sql.includes('UNIQUE')

      if (!hasUnique) {
        // 表已无 UNIQUE，确保部分唯一索引存在
        const indexExists = this._queryOne("SELECT 1 FROM sqlite_master WHERE type = 'index' AND name = 'idx_employees_id_number'")
        if (!indexExists) {
          this.db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_id_number ON employees(id_number) WHERE id_number IS NOT NULL AND id_number != ''`)
          this.save()
        }
        return
      }

      // 重建表：读出所有数据 → 创建新表 → 插入 → 删旧表
      const rows = this._queryAll('SELECT * FROM employees')
      this.db.run('DROP TABLE employees')
      this.createEmployeeTable()
      // 重新插入所有行
      for (const row of rows) {
        this.db.run(`
          INSERT INTO employees (id, name, phone, id_number, department, position, employment_type, seq_number, category_seq, remark, active, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [row.id, row.name, row.phone || '', row.id_number || '', row.department || '', row.position || '', row.employment_type || '', row.seq_number || 0, row.category_seq || 0, row.remark || '', row.active !== undefined ? row.active : 1, row.created_at])
      }
      this.save()
    } catch (err) {
      console.error('id_number migration error:', err)
    }
  }

  // 插入单个员工
  insertEmployee(record) {
    const idNumber = (record.id_number || '').trim()
    this._run(`
      INSERT INTO employees (name, phone, id_number, department, position, employment_type, seq_number, category_seq, remark, active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      record.name || '',
      record.phone || '',
      idNumber,
      record.department || '',
      record.position || '',
      record.employment_type || '',
      record.seq_number || 0,
      record.category_seq || 0,
      record.remark || '',
      record.active !== undefined ? record.active : 1
    ])
    const result = this._queryOne('SELECT last_insert_rowid() as id')
    return result ? result.id : null
  }

  // 批量插入员工（跳过重复身份证号）
  insertEmployeesBatch(records) {
    let inserted = 0
    let skipped = 0
    for (const record of records) {
      if (record.id_number) {
        const exists = this._queryOne('SELECT id FROM employees WHERE id_number = ?', [record.id_number])
        if (exists) { skipped++; continue }
      }
      try {
        this.insertEmployee(record)
        inserted++
      } catch (e) {
        console.error('insertEmployee error:', e)
        skipped++
      }
    }
    return { inserted, skipped }
  }

  // 获取所有员工
  getAllEmployees() {
    return this._queryAll('SELECT * FROM employees ORDER BY created_at DESC')
  }

  // 获取活跃员工（active=1 或 active IS NULL）
  getActiveEmployees() {
    return this._queryAll("SELECT * FROM employees WHERE active IS NULL OR active = 1 ORDER BY created_at DESC")
  }

  // 获取所有不重复的部门列表
  getDistinctDepartments() {
    const rows = this._queryAll("SELECT DISTINCT department FROM employees WHERE department IS NOT NULL AND department != '' ORDER BY department")
    return rows.map(r => r.department)
  }

  // 删除员工
  deleteEmployee(id) {
    this._run('DELETE FROM employees WHERE id = ?', [id])
    return true
  }

  // 批量删除员工
  deleteEmployeesBatch(ids) {
    if (!ids || ids.length === 0) return false
    const placeholders = ids.map(() => '?').join(',')
    this._run(`DELETE FROM employees WHERE id IN (${placeholders})`, ids)
    return true
  }

  // 更新员工（仅更新传入的字段）
  updateEmployee(id, record) {
    const setClauses = []
    const values = []
    for (const [key, value] of Object.entries(record)) {
      if (key === 'id_number') {
        setClauses.push('id_number = ?')
        values.push((value || '').trim())
      } else if (key === 'id') {
        continue
      } else {
        setClauses.push(`${key} = ?`)
        values.push(value)
      }
    }
    if (setClauses.length === 0) return false
    values.push(id)
    this._run(`UPDATE employees SET ${setClauses.join(', ')} WHERE id = ?`, values)
    this.save()
    return true
  }

  // 搜索员工
  searchEmployees(conditions = {}) {
    let sql = "SELECT * FROM employees WHERE 1=1"
    const params = []
    if (conditions.name) {
      sql += " AND name LIKE ?"
      params.push(`%${conditions.name}%`)
    }
    if (conditions.department) {
      sql += " AND department LIKE ?"
      params.push(`%${conditions.department}%`)
    }
    sql += " ORDER BY created_at DESC"
    if (conditions.limit) {
      sql += " LIMIT ?"
      params.push(conditions.limit)
    }
    return this._queryAll(sql, params)
  }

  // 获取员工总数
  getEmployeeCount() {
    const result = this._queryOne('SELECT COUNT(*) as total FROM employees')
    return result ? result.total : 0
  }

  // 获取指定月份过生日的员工（从身份证号提取）
  getBirthdayByMonth(month) {
    const m = String(month).padStart(2, '0')
    return this._queryAll(`
      SELECT *, substr(id_number, 7, 8) as birth_date
      FROM employees
      WHERE substr(id_number, 11, 2) = ?
      ORDER BY substr(id_number, 13, 2) ASC
    `, [m])
  }

  // 获取指定月份范围过生日的员工
  getBirthdayByRange(startMonth, endMonth) {
    const sm = String(startMonth).padStart(2, '0')
    const em = String(endMonth).padStart(2, '0')
    return this._queryAll(`
      SELECT *, substr(id_number, 7, 8) as birth_date
      FROM employees
      WHERE CAST(substr(id_number, 11, 2) AS INTEGER) BETWEEN ? AND ?
      ORDER BY substr(id_number, 11, 2) ASC, substr(id_number, 13, 2) ASC
    `, [parseInt(startMonth), parseInt(endMonth)])
  }

  // 获取当前月份生日人数
  getBirthdayCountByMonth(month) {
    const m = String(month).padStart(2, '0')
    const result = this._queryOne(`
      SELECT COUNT(*) as total FROM employees
      WHERE substr(id_number, 11, 2) = ?
    `, [m])
    return result ? result.total : 0
  }

  // 获取按月份分组的生日人数统计
  getBirthdayStats() {
    return this._queryAll(`
      SELECT substr(id_number, 11, 2) as month, COUNT(*) as count
      FROM employees
      WHERE id_number IS NOT NULL AND length(id_number) >= 15
      GROUP BY month
      ORDER BY month ASC
    `)
  }

  // ============ 重写createTables以包含员工表 ============

  // 关闭数据库
  close() {
    if (this.db) {
      this.save()
      this.db.close()
    }
  }
}

module.exports = LeaveDatabase
