// 用户管理器 - 专门处理用户相关的业务逻辑
const { BaseManager } = require('./baseManager');
const { logger, errorHandler, performanceMonitor } = require('./logger');
const { getCacheManager } = require('./cacheManager');

class UserManager extends BaseManager {
  constructor() {
    super('users', '_id');
    this.cacheManager = getCacheManager();
    this.userRoleCache = new Map();
    this.rolePermissions = {
      super_admin: ['*'],
      admin: ['read', 'write', 'update', 'delete'],
      user: ['read', 'write'],
      guest: ['read']
    };
    this.memberManager = null;
  }

  // 设置会员管理器
  setMemberManager(memberManager) {
    this.memberManager = memberManager;
  }

  // 用户数据验证模式
  getUserSchema() {
    return {
      phone: {
        required: true,
        type: 'string',
        minLength: 11,
        maxLength: 11,
        validate: (value) => /^1[3-9]\d{9}$/.test(value)
      },
      name: {
        required: true,
        type: 'string',
        minLength: 2,
        maxLength: 50
      },
      avatarUrl: {
        required: false,
        type: 'string',
        maxLength: 255,
        validate: (value) => !value || /^https?:\/\//.test(value)
      }
    };
  }

  // 用户注册 - 带数据验证和错误处理
  async register(userData) {
    const startTime = Date.now();
    const operation = '用户注册';
    
    try {
      logger.info('用户注册开始', { phone: userData.phone });
      
      // 数据验证
      this.validateUserData(userData);
      
      // 检查用户是否已存在
      const existingUser = await this.getUserByPhone(userData.phone);
      if (existingUser) {
        throw new Error('用户已存在');
      }
      
      // 创建用户
      const newUser = await this.createUser(userData);
      
      // 创建会员卡片
      if (this.memberManager) {
        await this.memberManager.createMemberCard(newUser._id, {
          level: 'bronze',
          points: 0,
          balance: 0
        });
      }
      
      const duration = Date.now() - startTime;
      this.recordPerformance(duration);
      
      logger.info('用户注册成功', { userId: newUser._id, duration: `${duration}ms` });
      return this.handleSuccess(operation, newUser);
      
    } catch (error) {
      const duration = Date.now() - startTime;
      this.recordPerformance(duration);
      throw this.handleError(error, operation);
    }
  }

  // 验证用户数据
  validateUserData(userData) {
    if (!userData.phone || !/^1[3-9]\d{9}$/.test(userData.phone)) {
      throw new Error('无效的手机号码');
    }
    
    if (!userData.nickname || userData.nickname.length < 2) {
      throw new Error('昵称至少需要2个字符');
    }
    
    if (userData.password && userData.password.length < 6) {
      throw new Error('密码至少需要6个字符');
    }
    
    if (userData.role && !this.rolePermissions[userData.role]) {
      throw new Error('无效的用户角色');
    }
  }

  // 创建用户
  async createUser(userData) {
    const user = {
      phone: userData.phone,
      nickname: userData.nickname,
      password: userData.password || '',
      role: userData.role || 'user',
      avatar: userData.avatar || '/assets/images/default-avatar.png',
      status: userData.status || 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    return await this.create(user);
  }

  // 根据手机号获取用户
  async getUserByPhone(phone) {
    const cacheKey = `user_phone_${phone}`;
    
    // 检查缓存
    const cached = this.cacheManager.get(cacheKey);
    if (cached) {
      return cached;
    }
    
    // 查询数据库
    const users = await this.query({ phone });
    const user = users.length > 0 ? users[0] : null;
    
    // 缓存结果
    if (user) {
      this.cacheManager.set(cacheKey, user, 5 * 60 * 1000); // 5分钟缓存
    }
    
    return user;
  }

  // 创建用户
  async createUser(userData) {
    const user = {
      phone: userData.phone,
      name: userData.name,
      avatar_url: userData.avatarUrl || null,
      register_time: new Date(),
      last_login_time: new Date(),
      status: 'active'
    };

    // 这里应该调用实际的数据库操作
    // 暂时使用本地存储模拟
    const users = this.getLocalUsers();
    users.push(user);
    this.setLocalUsers(users);

    return user;
  }

  // 获取用户信息
  async getUser(phone, useCache = true) {
    if (!phone) {
      throw new Error('手机号不能为空');
    }

    return await this.measurePerformance('getUser', async () => {
      // 使用缓存
      if (useCache) {
        const cacheKey = this.generateCacheKey('getUser', { phone });
        const cachedUser = this.getCache(cacheKey);
        if (cachedUser) {
          logger.info(`用户 ${phone} 从缓存获取`);
          return cachedUser;
        }
      }

      // 从数据库获取
      const user = await this.withConnection(async () => {
        // 这里应该调用实际的数据库查询
        // 暂时使用本地存储模拟
        const users = this.getLocalUsers();
        return users.find(u => u.phone === phone);
      });

      // 缓存结果
      if (user && useCache) {
        const cacheKey = this.generateCacheKey('getUser', { phone });
        this.setCache(cacheKey, user);
      }

      return user;
    });
  }

  // 更新用户信息
  async updateUser(phone, updateData) {
    if (!phone) {
      throw new Error('手机号不能为空');
    }

    return await this.measurePerformance('updateUser', async () => {
      // 验证更新数据
      const updateSchema = this.getUserSchema();
      const filteredSchema = {};
      for (const [key, rules] of Object.entries(updateSchema)) {
        if (updateData.hasOwnProperty(key)) {
          filteredSchema[key] = { ...rules, required: false };
        }
      }

      const validationErrors = this.validateData(updateData, filteredSchema);
      if (validationErrors) {
        throw new Error(`更新数据验证失败: ${validationErrors.join(', ')}`);
      }

      return await this.withConnection(async () => {
        // 这里应该调用实际的数据库更新
        // 暂时使用本地存储模拟
        const users = this.getLocalUsers();
        const userIndex = users.findIndex(u => u.phone === phone);
        
        if (userIndex === -1) {
          throw new Error(`用户 ${phone} 不存在`);
        }

        // 更新用户信息
        users[userIndex] = {
          ...users[userIndex],
          ...updateData,
          last_login_time: new Date()
        };

        this.setLocalUsers(users);

        // 清除缓存
        const cacheKey = this.generateCacheKey('getUser', { phone });
        this.cache.delete(cacheKey);

        logger.info(`用户 ${phone} 更新成功`);
        return users[userIndex];
      });
    });
  }

  // 批量注册用户 - 带事务处理和错误恢复
  async batchRegister(userDataList) {
    const startTime = Date.now();
    const operation = '批量注册用户';
    
    try {
      logger.info('批量注册用户开始', { count: userDataList.length });
      
      if (!Array.isArray(userDataList) || userDataList.length === 0) {
        throw new Error('用户数据列表不能为空');
      }
      
      if (userDataList.length > 100) {
        throw new Error('批量注册用户数量不能超过100个');
      }
      
      const results = {
        success: [],
        failed: [],
        total: userDataList.length
      };
      
      // 分批处理，每批10个
      const batchSize = 10;
      for (let i = 0; i < userDataList.length; i += batchSize) {
        const batch = userDataList.slice(i, Math.min(i + batchSize, userDataList.length));
        
        logger.debug(`处理批次 ${Math.floor(i / batchSize) + 1}`, { batchSize: batch.length });
        
        await Promise.all(batch.map(async (userData) => {
          try {
            const user = await this.register(userData);
            results.success.push({
              phone: userData.phone,
              userId: user._id,
              nickname: user.nickname
            });
          } catch (error) {
            results.failed.push({
              phone: userData.phone,
              error: error.message
            });
          }
        }));
      }
      
      const duration = Date.now() - startTime;
      this.recordPerformance(duration);
      
      logger.info('批量注册用户完成', {
        total: results.total,
        success: results.success.length,
        failed: results.failed.length,
        duration: `${duration}ms`
      });
      
      return this.handleSuccess(operation, results);
      
    } catch (error) {
      const duration = Date.now() - startTime;
      this.recordPerformance(duration);
      throw this.handleError(error, operation);
    }
  }

  // 获取用户列表 - 支持分页和筛选
  async getUserList(options = {}) {
    const startTime = Date.now();
    const operation = '获取用户列表';
    
    try {
      const {
        page = 1,
        pageSize = 20,
        role,
        status,
        search,
        orderBy = 'created_at',
        order = 'desc'
      } = options;
      
      logger.info('获取用户列表', { page, pageSize, role, status, search });
      
      // 构建查询条件
      const conditions = { where: {} };
      
      if (role) {
        conditions.where.role = role;
      }
      
      if (status) {
        conditions.where.status = status;
      }
      
      if (search) {
        conditions.where.nickname = db.RegExp({
          regexp: search,
          options: 'i'
        });
      }
      
      // 分页
      conditions.skip = (page - 1) * pageSize;
      conditions.limit = pageSize;
      
      // 排序
      conditions.orderBy = { field: orderBy, order };
      
      const users = await this.query(conditions);
      
      // 获取总数
      const total = await this.countUsers(conditions.where);
      
      const result = {
        users,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize)
        }
      };
      
      const duration = Date.now() - startTime;
      this.recordPerformance(duration);
      
      return this.handleSuccess(operation, result);
      
    } catch (error) {
      const duration = Date.now() - startTime;
      this.recordPerformance(duration);
      throw this.handleError(error, operation);
    }
  }

  // 统计用户数量
  async countUsers(where = {}) {
    try {
      const db = await this.getDatabase();
      const result = await new Promise((resolve, reject) => {
        db.collection(this.tableName)
          .where(where)
          .count({
            success: resolve,
            fail: reject
          });
      });
      
      return result.total || 0;
    } catch (error) {
      logger.warn('统计用户数量失败', { error: error.message });
      return 0;
    }
  }

  // 检查用户是否存在
  async userExists(phone) {
    try {
      const user = await this.getUser(phone);
      return !!user;
    } catch (error) {
      return false;
    }
  }

  // 获取用户统计 - 包含各种维度的统计数据
  async getUserStats() {
    const startTime = Date.now();
    const operation = '获取用户统计';
    
    try {
      logger.info('获取用户统计');
      
      // 并行获取各种统计
      const [
        totalUsers,
        activeUsers,
        usersByRole,
        usersByStatus,
        recentUsers
      ] = await Promise.all([
        this.countUsers(),
        this.countUsers({ status: 'active' }),
        this.getUsersByRole(),
        this.getUsersByStatus(),
        this.getRecentUsers(7) // 最近7天
      ]);
      
      const stats = {
        overview: {
          total: totalUsers,
          active: activeUsers,
          inactive: totalUsers - activeUsers,
          activationRate: totalUsers > 0 ? ((activeUsers / totalUsers) * 100).toFixed(2) + '%' : '0%'
        },
        byRole: usersByRole,
        byStatus: usersByStatus,
        recentActivity: recentUsers,
        timestamp: new Date().toISOString()
      };
      
      const duration = Date.now() - startTime;
      this.recordPerformance(duration);
      
      return this.handleSuccess(operation, stats);
      
    } catch (error) {
      const duration = Date.now() - startTime;
      this.recordPerformance(duration);
      throw this.handleError(error, operation);
    }
  }

  // 按角色统计用户
  async getUsersByRole() {
    const stats = {};
    
    for (const role of Object.keys(this.rolePermissions)) {
      const count = await this.countUsers({ role });
      stats[role] = {
        count,
        percentage: 0 // 将在外部计算
      };
    }
    
    // 计算百分比
    const total = Object.values(stats).reduce((sum, stat) => sum + stat.count, 0);
    if (total > 0) {
      for (const role in stats) {
        stats[role].percentage = ((stats[role].count / total) * 100).toFixed(2) + '%';
      }
    }
    
    return stats;
  }

  // 按状态统计用户
  async getUsersByStatus() {
    const statuses = ['active', 'inactive', 'banned', 'pending'];
    const stats = {};
    
    for (const status of statuses) {
      const count = await this.countUsers({ status });
      stats[status] = count;
    }
    
    return stats;
  }

  // 获取最近用户
  async getRecentUsers(days = 7) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const users = await this.query({
      where: {
        created_at: db.command.gte(startDate.toISOString())
      },
      orderBy: { field: 'created_at', order: 'desc' }
    });
    
    // 按天分组
    const dailyStats = {};
    users.forEach(user => {
      const date = user.created_at.split('T')[0];
      dailyStats[date] = (dailyStats[date] || 0) + 1;
    });
    
    return dailyStats;
  }

  // 计算用户增长率
  calculateGrowthRate(users) {
    if (users.length < 2) return 0;

    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const lastMonthUsers = users.filter(u => new Date(u.register_time) < thisMonth && new Date(u.register_time) >= lastMonth).length;
    const thisMonthUsers = users.filter(u => new Date(u.register_time) >= thisMonth).length;

    if (lastMonthUsers === 0) return thisMonthUsers > 0 ? 100 : 0;
    
    return ((thisMonthUsers - lastMonthUsers) / lastMonthUsers * 100);
  }

  // 本地存储辅助方法（模拟数据库）
  getLocalUsers() {
    try {
      return wx.getStorageSync('users') || [];
    } catch (error) {
      logger.error('获取本地用户数据失败:', error);
      return [];
    }
  }

  setLocalUsers(users) {
    try {
      wx.setStorageSync('users', users);
    } catch (error) {
      logger.error('保存本地用户数据失败:', error);
      throw error;
    }
  }

  // 清理过期缓存
  cleanup() {
    this.clearCache();
    logger.info('用户管理器缓存已清理');
  }
}

module.exports = { UserManager };