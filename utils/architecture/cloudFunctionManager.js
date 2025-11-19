// 云函数管理器 - 重构云函数架构
const { logger } = require('./logger');
const { getCacheManager } = require('./cacheManager');
const { getDatabaseManager } = require('./databaseManager');

class CloudFunctionManager {
  constructor() {
    this.cloud = null;
    this.isInitialized = false;
    this.functionCache = new Map();
    this.executionQueue = [];
    this.maxConcurrent = 5;
    this.currentExecutions = 0;
    this.timeout = 30000; // 30秒超时
    this.retryCount = 3;
    this.retryDelay = 1000; // 1秒重试延迟
    
    this.cacheManager = getCacheManager();
    this.databaseManager = getDatabaseManager();
    
    // 云函数配置
    this.config = {
      enableCache: true,
      enableRetry: true,
      enableQueue: true,
      enableMetrics: true,
      timeout: 30000,
      maxRetries: 3,
      retryDelay: 1000
    };
    
    // 性能指标
    this.metrics = {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      averageExecutionTime: 0,
      cacheHits: 0,
      cacheMisses: 0,
      queueTime: 0
    };
    
    // 函数注册表
    this.functionRegistry = new Map();
    this.initializeRegistry();
  }

  // 初始化云函数管理器
  async initialize() {
    logger.info('开始初始化云函数管理器');
    
    try {
      // 等待数据库管理器初始化
      await this.databaseManager.initialize();
      
      // 初始化云开发环境
      if (wx.cloud) {
        this.cloud = wx.cloud;
        this.isInitialized = true;
        logger.info('云函数管理器初始化成功');
      } else {
        logger.warn('云开发环境未启用，云函数功能将不可用');
      }
      
    } catch (error) {
      logger.error('云函数管理器初始化失败', error);
      throw error;
    }
  }

  // 初始化函数注册表
  initializeRegistry() {
    // 用户管理相关云函数
    this.registerFunction('user-register', {
      handler: this.handleUserRegister.bind(this),
      cacheable: false,
      timeout: 10000,
      retryCount: 2
    });
    
    this.registerFunction('user-batch-register', {
      handler: this.handleBatchUserRegister.bind(this),
      cacheable: false,
      timeout: 30000,
      retryCount: 1
    });
    
    this.registerFunction('user-get-list', {
      handler: this.handleGetUserList.bind(this),
      cacheable: true,
      cacheTimeout: 300000, // 5分钟缓存
      timeout: 5000,
      retryCount: 1
    });
    
    this.registerFunction('user-get-stats', {
      handler: this.handleGetUserStats.bind(this),
      cacheable: true,
      cacheTimeout: 600000, // 10分钟缓存
      timeout: 5000,
      retryCount: 1
    });
    
    // 数据查询相关云函数
    this.registerFunction('data-query', {
      handler: this.handleDataQuery.bind(this),
      cacheable: true,
      cacheTimeout: 180000, // 3分钟缓存
      timeout: 10000,
      retryCount: 2
    });
    
    this.registerFunction('data-create', {
      handler: this.handleDataCreate.bind(this),
      cacheable: false,
      timeout: 8000,
      retryCount: 2
    });
    
    this.registerFunction('data-update', {
      handler: this.handleDataUpdate.bind(this),
      cacheable: false,
      timeout: 8000,
      retryCount: 2
    });
    
    this.registerFunction('data-delete', {
      handler: this.handleDataDelete.bind(this),
      cacheable: false,
      timeout: 8000,
      retryCount: 2
    });
    
    // 系统管理相关云函数
    this.registerFunction('health-check', {
      handler: this.handleHealthCheck.bind(this),
      cacheable: true,
      cacheTimeout: 60000, // 1分钟缓存
      timeout: 3000,
      retryCount: 1
    });
    
    this.registerFunction('system-stats', {
      handler: this.handleSystemStats.bind(this),
      cacheable: true,
      cacheTimeout: 300000, // 5分钟缓存
      timeout: 5000,
      retryCount: 1
    });
    
    logger.info(`注册 ${this.functionRegistry.size} 个云函数`);
  }

  // 注册云函数
  registerFunction(name, config) {
    this.functionRegistry.set(name, {
      name,
      handler: config.handler,
      cacheable: config.cacheable || false,
      cacheTimeout: config.cacheTimeout || 300000,
      timeout: config.timeout || this.timeout,
      retryCount: config.retryCount || this.retryCount,
      enabled: true
    });
  }

  // 执行云函数
  async executeFunction(name, params = {}, options = {}) {
    const startTime = Date.now();
    this.metrics.totalExecutions++;
    
    try {
      // 检查函数是否存在且启用
      const functionConfig = this.functionRegistry.get(name);
      if (!functionConfig || !functionConfig.enabled) {
        throw new Error(`云函数不存在或已禁用: ${name}`);
      }
      
      // 生成缓存键
      const cacheKey = this.generateCacheKey(name, params);
      
      // 检查缓存
      if (functionConfig.cacheable && this.config.enableCache) {
        const cachedResult = await this.cacheManager.get(cacheKey);
        if (cachedResult) {
          this.metrics.cacheHits++;
          logger.debug(`云函数缓存命中: ${name}`);
          return {
            success: true,
            data: cachedResult,
            cached: true,
            executionTime: Date.now() - startTime
          };
        }
        this.metrics.cacheMisses++;
      }
      
      // 加入执行队列
      if (this.config.enableQueue && this.currentExecutions >= this.maxConcurrent) {
        logger.debug(`云函数加入队列: ${name}`);
        await this.addToQueue(name, params, options);
      }
      
      // 执行函数
      this.currentExecutions++;
      const result = await this.executeWithRetry(name, params, functionConfig, options);
      this.currentExecutions--;
      
      // 缓存结果
      if (functionConfig.cacheable && this.config.enableCache && result.success) {
        await this.cacheManager.set(cacheKey, result.data, functionConfig.cacheTimeout);
      }
      
      // 更新性能指标
      const executionTime = Date.now() - startTime;
      this.updateMetrics(result.success, executionTime);
      
      logger.info(`云函数执行成功: ${name}`, { 
        executionTime: `${executionTime}ms`,
        cached: false,
        retryCount: result.retryCount || 0
      });
      
      return {
        success: true,
        data: result.data,
        cached: false,
        executionTime,
        retryCount: result.retryCount || 0
      };
      
    } catch (error) {
      this.currentExecutions--;
      this.metrics.failedExecutions++;
      
      logger.error(`云函数执行失败: ${name}`, error);
      
      return {
        success: false,
        error: error.message,
        executionTime: Date.now() - startTime
      };
    }
  }

  // 带重试的执行
  async executeWithRetry(name, params, functionConfig, options) {
    let lastError = null;
    const retryCount = options.retryCount || functionConfig.retryCount;
    
    for (let attempt = 1; attempt <= retryCount; attempt++) {
      try {
        const result = await this.executeWithTimeout(
          name, 
          params, 
          functionConfig.timeout,
          options
        );
        
        this.metrics.successfulExecutions++;
        return {
          success: true,
          data: result,
          retryCount: attempt > 1 ? attempt - 1 : 0
        };
        
      } catch (error) {
        lastError = error;
        logger.warn(`云函数执行尝试 ${attempt}/${retryCount} 失败: ${name}`, error);
        
        if (attempt < retryCount && this.config.enableRetry) {
          await this.delay(this.config.retryDelay * attempt); // 指数退避
        }
      }
    }
    
    throw lastError;
  }

  // 带超时的执行
  async executeWithTimeout(name, params, timeout, options) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`云函数执行超时: ${name}`));
      }, timeout);
      
      // 执行实际的云函数
      this.executeActualFunction(name, params, options)
        .then(result => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  // 执行实际的云函数
  async executeActualFunction(name, params, options) {
    // 检查是否是本地模式
    if (!this.isInitialized || !this.cloud) {
      return await this.executeLocalFunction(name, params, options);
    }
    
    // 执行云端函数
    try {
      const result = await this.cloud.callFunction({
        name,
        data: params
      });
      
      if (result.result && result.result.success) {
        return result.result.data;
      } else {
        throw new Error(result.result?.error || '云函数执行失败');
      }
      
    } catch (error) {
      logger.warn(`云端函数执行失败，回退到本地: ${name}`, error);
      return await this.executeLocalFunction(name, params, options);
    }
  }

  // 执行本地函数
  async executeLocalFunction(name, params, options) {
    const functionConfig = this.functionRegistry.get(name);
    if (!functionConfig || !functionConfig.handler) {
      throw new Error(`本地函数不存在: ${name}`);
    }
    
    try {
      return await functionConfig.handler(params, options);
    } catch (error) {
      logger.error(`本地函数执行失败: ${name}`, error);
      throw error;
    }
  }

  // 用户注册处理函数
  async handleUserRegister(params) {
    const { phone, nickname, password, role = 'user' } = params;
    
    // 数据验证
    if (!phone || !nickname || !password) {
      throw new Error('用户注册信息不完整');
    }
    
    // 检查用户是否已存在
    const existingUser = await this.databaseManager.db
      .collection('users')
      .where({ phone })
      .limit(1)
      .get();
    
    if (existingUser.data.length > 0) {
      throw new Error('用户已存在');
    }
    
    // 创建用户
    const user = {
      phone,
      nickname,
      password: this.hashPassword(password),
      role,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const result = await this.databaseManager.db
      .collection('users')
      .add({ data: user });
    
    return {
      userId: result._id,
      phone: user.phone,
      nickname: user.nickname,
      role: user.role
    };
  }

  // 批量用户注册处理函数
  async handleBatchUserRegister(params) {
    const { users } = params;
    
    if (!Array.isArray(users) || users.length === 0) {
      throw new Error('用户列表不能为空');
    }
    
    if (users.length > 100) {
      throw new Error('批量注册用户数量不能超过100个');
    }
    
    const results = {
      successful: [],
      failed: []
    };
    
    // 分批处理，每批10个
    const batchSize = 10;
    for (let i = 0; i < users.length; i += batchSize) {
      const batch = users.slice(i, i + batchSize);
      
      try {
        // 开始事务
        const transaction = await this.databaseManager.beginTransaction('users');
        
        for (const userData of batch) {
          try {
            const result = await this.handleUserRegister(userData);
            results.successful.push({
              phone: userData.phone,
              nickname: userData.nickname,
              userId: result.userId
            });
          } catch (error) {
            results.failed.push({
              phone: userData.phone,
              nickname: userData.nickname,
              error: error.message
            });
          }
        }
        
        // 提交事务
        await this.databaseManager.commitTransaction(transaction.id);
        
      } catch (error) {
        logger.error('批量注册用户事务失败', error);
        // 回滚事务
        if (transaction) {
          await this.databaseManager.rollbackTransaction(transaction.id);
        }
        
        // 将整批标记为失败
        for (const userData of batch) {
          results.failed.push({
            phone: userData.phone,
            nickname: userData.nickname,
            error: '批量处理失败'
          });
        }
      }
    }
    
    return results;
  }

  // 获取用户列表处理函数
  async handleGetUserList(params) {
    const { page = 1, pageSize = 20, search, status, role } = params;
    
    const db = await this.databaseManager.getDatabase();
    let query = db.collection('users');
    
    // 构建查询条件
    if (search) {
      query = query.where({
        nickname: db.RegExp({
          regexp: search,
          options: 'i'
        })
      });
    }
    
    if (status) {
      query = query.where({ status });
    }
    
    if (role) {
      query = query.where({ role });
    }
    
    // 获取总数
    const totalResult = await query.count();
    const total = totalResult.total;
    
    // 获取分页数据
    const result = await query
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .orderBy('createdAt', 'desc')
      .get();
    
    return {
      users: result.data,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize)
      }
    };
  }

  // 获取用户统计处理函数
  async handleGetUserStats() {
    const db = await this.databaseManager.getDatabase();
    
    // 并行查询统计信息
    const [
      totalUsers,
      activeUsers,
      usersByRole,
      usersByStatus,
      recentUsers
    ] = await Promise.all([
      db.collection('users').count(),
      db.collection('users').where({ status: 'active' }).count(),
      db.collection('users').group({
        _id: '$role',
        count: { $sum: 1 }
      }),
      db.collection('users').group({
        _id: '$status',
        count: { $sum: 1 }
      }),
      db.collection('users')
        .where({
          createdAt: db.command.gt(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
        })
        .count()
    ]);
    
    return {
      overview: {
        total: totalUsers.total,
        active: activeUsers.total,
        activationRate: totalUsers.total > 0 
          ? ((activeUsers.total / totalUsers.total) * 100).toFixed(2) + '%'
          : '0%'
      },
      byRole: usersByRole.data,
      byStatus: usersByStatus.data,
      recentActivity: {
        last7Days: recentUsers.total
      }
    };
  }

  // 数据查询处理函数
  async handleDataQuery(params) {
    const { table, conditions, options = {} } = params;
    
    if (!table) {
      throw new Error('表名不能为空');
    }
    
    const db = await this.databaseManager.getDatabase();
    let query = db.collection(table);
    
    // 构建查询条件
    if (conditions) {
      query = query.where(conditions);
    }
    
    // 排序
    if (options.orderBy) {
      const order = options.order || 'asc';
      query = query.orderBy(options.orderBy, order);
    }
    
    // 分页
    if (options.skip) {
      query = query.skip(options.skip);
    }
    
    if (options.limit) {
      query = query.limit(options.limit);
    }
    
    const result = await query.get();
    return result.data;
  }

  // 数据创建处理函数
  async handleDataCreate(params) {
    const { table, data } = params;
    
    if (!table || !data) {
      throw new Error('表名和数据不能为空');
    }
    
    const db = await this.databaseManager.getDatabase();
    const result = await db.collection(table).add({ data });
    
    return {
      id: result._id,
      ...data
    };
  }

  // 数据更新处理函数
  async handleDataUpdate(params) {
    const { table, id, data } = params;
    
    if (!table || !id || !data) {
      throw new Error('表名、ID和数据不能为空');
    }
    
    const db = await this.databaseManager.getDatabase();
    await db.collection(table).doc(id).update({ data });
    
    return { success: true };
  }

  // 数据删除处理函数
  async handleDataDelete(params) {
    const { table, id } = params;
    
    if (!table || !id) {
      throw new Error('表名和ID不能为空');
    }
    
    const db = await this.databaseManager.getDatabase();
    await db.collection(table).doc(id).remove();
    
    return { success: true };
  }

  // 健康检查处理函数
  async handleHealthCheck() {
    const dbHealth = await this.databaseManager.healthCheck();
    
    return {
      success: true,
      timestamp: new Date().toISOString(),
      database: dbHealth,
      cloud: {
        status: this.isInitialized ? 'connected' : 'disconnected',
        functions: this.functionRegistry.size
      }
    };
  }

  // 系统统计处理函数
  async handleSystemStats() {
    const dbStats = await this.databaseManager.getStats();
    
    return {
      database: dbStats,
      cloud: {
        functions: this.functionRegistry.size,
        metrics: this.metrics,
        queue: {
          length: this.executionQueue.length,
          concurrent: this.currentExecutions
        }
      }
    };
  }

  // 加入执行队列
  async addToQueue(name, params, options) {
    return new Promise((resolve, reject) => {
      const queueItem = {
        name,
        params,
        options,
        resolve,
        reject,
        enqueueTime: Date.now()
      };
      
      this.executionQueue.push(queueItem);
      this.processQueue();
    });
  }

  // 处理队列
  async processQueue() {
    if (this.currentExecutions >= this.maxConcurrent || this.executionQueue.length === 0) {
      return;
    }
    
    const queueItem = this.executionQueue.shift();
    const queueTime = Date.now() - queueItem.enqueueTime;
    this.metrics.queueTime += queueTime;
    
    try {
      const result = await this.executeFunction(
        queueItem.name,
        queueItem.params,
        queueItem.options
      );
      
      queueItem.resolve(result);
    } catch (error) {
      queueItem.reject(error);
    }
    
    // 继续处理队列
    this.processQueue();
  }

  // 生成缓存键
  generateCacheKey(name, params) {
    const paramsStr = JSON.stringify(params, Object.keys(params).sort());
    return `cloud:${name}:${this.hashCode(paramsStr)}`;
  }

  // 哈希函数
  hashCode(str) {
    let hash = 0;
    if (str.length === 0) return hash;
    
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    
    return hash.toString(36);
  }

  // 更新性能指标
  updateMetrics(success, executionTime) {
    const total = this.metrics.successfulExecutions + this.metrics.failedExecutions;
    const oldAverage = this.metrics.averageExecutionTime;
    
    this.metrics.averageExecutionTime = 
      (oldAverage * (total - 1) + executionTime) / total;
  }

  // 密码哈希函数
  hashPassword(password) {
    // 简单的哈希函数，实际应用中应该使用更安全的算法
    let hash = 0;
    for (let i = 0; i < password.length; i++) {
      const char = password.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }

  // 延迟函数
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // 获取性能指标
  getMetrics() {
    return {
      ...this.metrics,
      hitRate: this.metrics.totalExecutions > 0 
        ? ((this.metrics.cacheHits / this.metrics.totalExecutions) * 100).toFixed(2) + '%'
        : '0%',
      successRate: this.metrics.totalExecutions > 0
        ? ((this.metrics.successfulExecutions / this.metrics.totalExecutions) * 100).toFixed(2) + '%'
        : '0%'
    };
  }

  // 健康检查
  async healthCheck() {
    const checks = {
      timestamp: new Date().toISOString(),
      initialized: this.isInitialized,
      queue: {
        length: this.executionQueue.length,
        concurrent: this.currentExecutions,
        maxConcurrent: this.maxConcurrent
      },
      metrics: this.getMetrics(),
      functions: this.functionRegistry.size
    };
    
    checks.overall = checks.initialized ? 'healthy' : 'unhealthy';
    return checks;
  }

  // 清理资源
  async cleanup() {
    logger.info('开始清理云函数管理器资源');
    
    // 清空执行队列
    this.executionQueue = [];
    this.currentExecutions = 0;
    
    // 清空函数缓存
    this.functionCache.clear();
    
    logger.info('云函数管理器资源清理完成');
  }
}

// 单例模式
let cloudFunctionManager = null;

function getCloudFunctionManager() {
  if (!cloudFunctionManager) {
    cloudFunctionManager = new CloudFunctionManager();
  }
  return cloudFunctionManager;
}

module.exports = {
  CloudFunctionManager,
  getCloudFunctionManager
};