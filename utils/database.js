// 云数据库连接工具类
// utils/database.js

const mysql = require('mysql2/promise');
const dbConfig = require('../config/database');
const { logger } = require('./logger');

class DatabaseManager {
  constructor() {
    this.connection = null;
    this.isConnected = false;
    this.syncQueue = [];
    this.offlineQueue = [];
  }

  // 初始化数据库连接
  async init() {
    try {
      logger.info('正在连接云数据库...');

      this.connection = await mysql.createConnection({
        host: dbConfig.database.host,
        port: dbConfig.database.port,
        user: dbConfig.database.user,
        password: dbConfig.database.password,
        database: dbConfig.database.database,
        charset: dbConfig.database.charset,
        connectionLimit: dbConfig.database.connectionLimit,
        acquireTimeout: dbConfig.database.acquireTimeout,
        timeout: dbConfig.database.timeout,
        reconnect: dbConfig.database.reconnect
      });

      this.isConnected = true;
      logger.info('云数据库连接成功');

      // 初始化表结构
      await this.initTables();

      return true;
    } catch (error) {
      logger.error('云数据库连接失败:', error);
      this.isConnected = false;

      // 启用离线模式
      if (dbConfig.offline.enabled) {
        logger.info('启用离线模式');
      }

      return false;
    }
  }

  // 初始化数据表结构
  async initTables() {
    const tables = [
      // 用户表
      `CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        phone VARCHAR(20) UNIQUE NOT NULL,
        name VARCHAR(50) NOT NULL,
        avatar_url VARCHAR(255),
        register_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_login_time DATETIME,
        status ENUM('active', 'inactive', 'banned') DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

      // 会员信息表
      `CREATE TABLE IF NOT EXISTS member_cards (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_phone VARCHAR(20) NOT NULL,
        balance DECIMAL(10,2) DEFAULT 0.00,
        points INT DEFAULT 0,
        level VARCHAR(20) DEFAULT 'bronze',
        join_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_transaction_time DATETIME,
        status ENUM('active', 'frozen', 'cancelled') DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_phone) REFERENCES users(phone) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

      // 活动表
      `CREATE TABLE IF NOT EXISTS activities (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(200) NOT NULL,
        description TEXT,
        date DATE NOT NULL,
        time TIME NOT NULL,
        location VARCHAR(200),
        max_players INT DEFAULT 8,
        current_players INT DEFAULT 0,
        min_players INT DEFAULT 6,
        price DECIMAL(8,2) DEFAULT 0.00,
        status ENUM('planning', 'open', 'full', 'in_progress', 'completed', 'cancelled') DEFAULT 'planning',
        created_by VARCHAR(20),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_date (date),
        INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

      // 活动参与记录表
      `CREATE TABLE IF NOT EXISTS activity_participants (
        id INT AUTO_INCREMENT PRIMARY KEY,
        activity_id INT NOT NULL,
        user_phone VARCHAR(20) NOT NULL,
        join_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        payment_status ENUM('pending', 'paid', 'refunded') DEFAULT 'pending',
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE CASCADE,
        FOREIGN KEY (user_phone) REFERENCES users(phone) ON DELETE CASCADE,
        UNIQUE KEY unique_participant (activity_id, user_phone)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

      // 交易记录表
      `CREATE TABLE IF NOT EXISTS transactions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_phone VARCHAR(20) NOT NULL,
        type ENUM('recharge', 'payment', 'refund', 'bonus', 'penalty') NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        balance_after DECIMAL(10,2) NOT NULL,
        description VARCHAR(200),
        reference_id VARCHAR(50),
        reference_type VARCHAR(20),
        status ENUM('pending', 'completed', 'failed', 'cancelled') DEFAULT 'completed',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_phone) REFERENCES users(phone) ON DELETE CASCADE,
        INDEX idx_user_phone (user_phone),
        INDEX idx_type (type),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

      // 店铺状态表
      `CREATE TABLE IF NOT EXISTS store_status (
        id INT AUTO_INCREMENT PRIMARY KEY,
        is_open BOOLEAN DEFAULT FALSE,
        open_time TIME,
        close_time TIME,
        last_update DATETIME,
        message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

      // 管理员表
      `CREATE TABLE IF NOT EXISTS admins (
        id INT AUTO_INCREMENT PRIMARY KEY,
        phone VARCHAR(20) UNIQUE NOT NULL,
        name VARCHAR(50) NOT NULL,
        role ENUM('super', 'normal') DEFAULT 'normal',
        permissions JSON,
        created_by VARCHAR(20),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (phone) REFERENCES users(phone) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`
    ];

    for (const tableSQL of tables) {
      try {
        await this.execute(tableSQL);
      } catch (error) {
        logger.error('创建表失败:', error);
      }
    }

    logger.info('数据表结构初始化完成');
  }

  // 执行SQL查询
  async execute(sql, params = []) {
    if (!this.isConnected) {
      throw new Error('数据库未连接');
    }

    try {
      const [results] = await this.connection.execute(sql, params);
      return results;
    } catch (error) {
      logger.error('SQL执行错误:', error);
      throw error;
    }
  }

  // 查询单条记录
  async queryOne(sql, params = []) {
    const results = await this.execute(sql, params);
    return results.length > 0 ? results[0] : null;
  }

  // 查询多条记录
  async queryMany(sql, params = []) {
    return await this.execute(sql, params);
  }

  // 插入数据
  async insert(table, data) {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map(() => '?').join(', ');

    const sql = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`;
    const result = await this.execute(sql, values);

    return result.insertId;
  }

  // 更新数据
  async update(table, data, condition, conditionParams = []) {
    const setClause = Object.keys(data).map(key => `${key} = ?`).join(', ');
    const sql = `UPDATE ${table} SET ${setClause} WHERE ${condition}`;
    const result = await this.execute(sql, [...Object.values(data), ...conditionParams]);

    return result.affectedRows;
  }

  // 删除数据
  async delete(table, condition, conditionParams = []) {
    const sql = `DELETE FROM ${table} WHERE ${condition}`;
    const result = await this.execute(sql, conditionParams);

    return result.affectedRows;
  }

  // 获取用户信息
  async getUser(phone) {
    const sql = 'SELECT * FROM users WHERE phone = ?';
    return await this.queryOne(sql, [phone]);
  }

  // 创建或更新用户
  async saveUser(userData) {
    const existing = await this.getUser(userData.phone);

    if (existing) {
      // 更新用户
      await this.update('users', {
        name: userData.name,
        avatar_url: userData.avatarUrl,
        last_login_time: new Date()
      }, 'phone = ?', [userData.phone]);

      // 更新或创建会员卡
      await this.saveMemberCard(userData.phone, {});

      return existing;
    } else {
      // 创建用户
      await this.insert('users', {
        phone: userData.phone,
        name: userData.name,
        avatar_url: userData.avatarUrl || null,
        register_time: new Date()
      });

      // 创建会员卡
      await this.saveMemberCard(userData.phone, {
        balance: 0,
        points: 0,
        level: 'bronze'
      });

      return await this.getUser(userData.phone);
    }
  }

  // 获取会员卡信息
  async getMemberCard(phone) {
    const sql = 'SELECT * FROM member_cards WHERE user_phone = ? AND status = "active"';
    return await this.queryOne(sql, [phone]);
  }

  // 保存会员卡信息
  async saveMemberCard(phone, cardData) {
    const existing = await this.getMemberCard(phone);

    if (existing) {
      await this.update('member_cards', cardData, 'user_phone = ?', [phone]);
      return await this.getMemberCard(phone);
    } else {
      const cardId = await this.insert('member_cards', {
        user_phone: phone,
        ...cardData,
        join_date: new Date()
      });

      return await this.queryOne('SELECT * FROM member_cards WHERE id = ?', [cardId]);
    }
  }

  // 获取活动列表
  async getActivities(filters = {}) {
    let sql = 'SELECT * FROM activities WHERE 1=1';
    const params = [];

    if (filters.date) {
      sql += ' AND date = ?';
      params.push(filters.date);
    }

    if (filters.status) {
      sql += ' AND status = ?';
      params.push(filters.status);
    }

    sql += ' ORDER BY date ASC, time ASC';

    if (filters.limit) {
      sql += ' LIMIT ?';
      params.push(filters.limit);
    }

    return await this.queryMany(sql, params);
  }

  // 获取活动详情
  async getActivity(id) {
    const sql = 'SELECT * FROM activities WHERE id = ?';
    return await this.queryOne(sql, [id]);
  }

  // 保存活动
  async saveActivity(activityData) {
    if (activityData.id) {
      // 更新活动
      await this.update('activities', activityData, 'id = ?', [activityData.id]);
      return await this.getActivity(activityData.id);
    } else {
      // 创建活动
      const activityId = await this.insert('activities', activityData);
      return await this.getActivity(activityId);
    }
  }

  // 获取活动参与者
  async getActivityParticipants(activityId) {
    const sql = `
      SELECT u.phone, u.name, u.avatar_url, ap.join_time, ap.payment_status
      FROM activity_participants ap
      JOIN users u ON ap.user_phone = u.phone
      WHERE ap.activity_id = ?
      ORDER BY ap.join_time ASC
    `;
    return await this.queryMany(sql, [activityId]);
  }

  // 报名参加活动
  async joinActivity(activityId, userPhone) {
    // 检查是否已经报名
    const existing = await this.queryOne(
      'SELECT * FROM activity_participants WHERE activity_id = ? AND user_phone = ?',
      [activityId, userPhone]
    );

    if (existing) {
      throw new Error('已经报名参加此活动');
    }

    // 添加参与者
    await this.insert('activity_participants', {
      activity_id: activityId,
      user_phone: userPhone,
      payment_status: 'pending'
    });

    // 更新活动当前人数
    await this.execute(
      'UPDATE activities SET current_players = current_players + 1 WHERE id = ?',
      [activityId]
    );

    return true;
  }

  // 获取交易记录
  async getTransactions(userPhone, limit = 50) {
    const sql = `
      SELECT * FROM transactions 
      WHERE user_phone = ? 
      ORDER BY created_at DESC 
      LIMIT ?
    `;
    return await this.queryMany(sql, [userPhone, limit]);
  }

  // 添加交易记录
  async addTransaction(transactionData) {
    return await this.insert('transactions', transactionData);
  }

  // 获取店铺状态
  async getStoreStatus() {
    const sql = 'SELECT * FROM store_status ORDER BY updated_at DESC LIMIT 1';
    return await this.queryOne(sql);
  }

  // 更新店铺状态
  async updateStoreStatus(statusData) {
    const existing = await this.getStoreStatus();

    if (existing) {
      await this.update('store_status', statusData, 'id = ?', [existing.id]);
      return await this.getStoreStatus();
    } else {
      const statusId = await this.insert('store_status', statusData);
      return await this.queryOne('SELECT * FROM store_status WHERE id = ?', [statusId]);
    }
  }

  // 获取管理员列表
  async getAdmins() {
    const sql = 'SELECT phone, name, role, permissions FROM admins ORDER BY created_at DESC';
    return await this.queryMany(sql);
  }

  // 添加管理员
  async addAdmin(adminData) {
    return await this.insert('admins', adminData);
  }

  // 同步本地数据到云端
  async syncLocalToCloud() {
    try {
      // 同步用户数据
      const localUsers = wx.getStorageSync('members') || [];
      for (const user of localUsers) {
        await this.saveUser({
          phone: user.phone,
          name: user.name,
          avatarUrl: user.avatarUrl
        });

        if (user.balance !== undefined || user.transactions) {
          await this.saveMemberCard(user.phone, {
            balance: user.balance || 0,
            points: user.points || 0
          });
        }
      }

      // 同步活动数据
      const localActivities = wx.getStorageSync('activities') || [];
      for (const activity of localActivities) {
        await this.saveActivity({
          title: activity.title,
          description: activity.description,
          date: activity.date,
          time: activity.time,
          location: activity.location,
          max_players: activity.maxPlayers,
          current_players: activity.currentPlayers,
          min_players: activity.minPlayers,
          price: activity.price,
          status: this.mapLocalStatusToCloud(activity.status),
          created_by: activity.createdBy
        });
      }

      // 同步店铺状态
      const localStoreStatus = wx.getStorageSync('storeStatus');
      if (localStoreStatus) {
        await this.updateStoreStatus({
          is_open: localStoreStatus.isOpen,
          open_time: localStoreStatus.openTime,
          close_time: localStoreStatus.closeTime,
          last_update: localStoreStatus.lastUpdate
        });
      }

      // 同步管理员数据
      const localAdmins = wx.getStorageSync('adminList') || [];
      for (const admin of localAdmins) {
        await this.addAdmin({
          phone: admin.phone,
          name: admin.name,
          role: admin.role
        });
      }

      logger.info('本地数据同步到云端完成');
      return true;
    } catch (error) {
      logger.error('本地数据同步到云端失败:', error);
      return false;
    }
  }

  // 从云端同步数据到本地
  async syncCloudToLocal() {
    try {
      // 同步用户和会员数据
      const cloudUsers = await this.queryMany('SELECT u.*, mc.balance, mc.points, mc.level FROM users u LEFT JOIN member_cards mc ON u.phone = mc.user_phone WHERE mc.status = "active" OR mc.status IS NULL');

      const localUsers = [];
      for (const user of cloudUsers) {
        localUsers.push({
          phone: user.phone,
          name: user.name,
          avatarUrl: user.avatar_url,
          balance: user.balance || 0,
          points: user.points || 0,
          level: user.level || 'bronze',
          transactions: await this.getTransactions(user.phone)
        });
      }
      wx.setStorageSync('members', localUsers);

      // 同步活动数据
      const cloudActivities = await this.getActivities();
      const localActivities = [];
      for (const activity of cloudActivities) {
        const participants = await this.getActivityParticipants(activity.id);
        localActivities.push({
          id: activity.id,
          title: activity.title,
          description: activity.description,
          date: activity.date,
          time: activity.time,
          location: activity.location,
          maxPlayers: activity.max_players,
          currentPlayers: activity.current_players,
          minPlayers: activity.min_players,
          price: activity.price,
          status: this.mapCloudStatusToLocal(activity.status),
          participants,
          createdBy: activity.created_by
        });
      }
      wx.setStorageSync('activities', localActivities);

      // 同步店铺状态
      const cloudStoreStatus = await this.getStoreStatus();
      if (cloudStoreStatus) {
        wx.setStorageSync('storeStatus', {
          isOpen: cloudStoreStatus.is_open,
          openTime: cloudStoreStatus.open_time,
          closeTime: cloudStoreStatus.close_time,
          lastUpdate: cloudStoreStatus.last_update
        });
      }

      // 同步管理员数据
      const cloudAdmins = await this.getAdmins();
      wx.setStorageSync('adminList', cloudAdmins);

      logger.info('云端数据同步到本地完成');
      return true;
    } catch (error) {
      logger.error('云端数据同步到本地失败:', error);
      return false;
    }
  }

  // 映射本地状态到云端状态
  mapLocalStatusToCloud(localStatus) {
    const statusMap = {
      'planning': 'planning',
      'open': 'open',
      'full': 'full',
      'in_progress': 'in_progress',
      'completed': 'completed',
      'cancelled': 'cancelled'
    };
    return statusMap[localStatus] || 'planning';
  }

  // 映射云端状态到本地状态
  mapCloudStatusToLocal(cloudStatus) {
    const statusMap = {
      'planning': 'planning',
      'open': 'open',
      'full': 'full',
      'in_progress': 'in_progress',
      'completed': 'completed',
      'cancelled': 'cancelled'
    };
    return statusMap[cloudStatus] || 'planning';
  }

  // 关闭数据库连接
  async close() {
    if (this.connection) {
      await this.connection.end();
      this.isConnected = false;
      logger.info('云数据库连接已关闭');
    }
  }

  // 检查连接状态
  isHealthy() {
    return this.isConnected;
  }
}

// 单例模式
let dbManager = null;

function getDatabaseManager() {
  if (!dbManager) {
    dbManager = new DatabaseManager();
  }
  return dbManager;
}

module.exports = {
  DatabaseManager,
  getDatabaseManager
};
