// 数据库连接管理器 - 优化数据库连接和错误处理
const { logger } = require('./logger');
const { getCacheManager } = require('./cacheManager');

class DatabaseManager {
  constructor() {
    this.db = null;
    this.isConnected = false;
    this.connectionAttempts = 0;
    this.maxAttempts = 3;
    this.retryDelay = 1000; // 1秒
    this.connectionTimeout = 5000; // 5秒
    this.cacheManager = getCacheManager();
    this.connectionPool = new Map();
    this.transactionStack = [];
    
    // 数据库配置
    this.config = {
      env: 'development', // development, production
      timeout: 30000, // 30秒查询超时
      maxPoolSize: 10,
      minPoolSize: 2,
      idleTimeout: 60000, // 60秒空闲超时
      connectionRetryCount: 3,
      enableCache: true,
      enableLog: true
    };
  }

  // 初始化数据库连接
  async initialize() {
    logger.info('开始初始化数据库连接管理器');
    
    try {
      // 初始化云开发环境
      if (wx.cloud) {
        await this.initializeCloudEnvironment();
      }
      
      // 初始化本地数据库
      await this.initializeLocalDatabase();
      
      // 测试连接
      await this.testConnection();
      
      this.isConnected = true;
      logger.info('数据库连接管理器初始化成功');
      
    } catch (error) {
      logger.error('数据库连接管理器初始化失败', error);
      throw error;
    }
  }

  // 初始化云开发环境
  async initializeCloudEnvironment() {
    try {
      await wx.cloud.init({
        env: this.config.env,
        traceUser: true
      });
      
      logger.info('云开发环境初始化成功');
    } catch (error) {
      logger.warn('云开发环境初始化失败，将使用本地数据库', error);
    }
  }

  // 初始化本地数据库
  async initializeLocalDatabase() {
    try {
      // 获取数据库实例
      this.db = wx.cloud.database({
        env: this.config.env
      });
      
      logger.info('本地数据库初始化成功');
    } catch (error) {
      logger.error('本地数据库初始化失败', error);
      throw error;
    }
  }

  // 测试数据库连接
  async testConnection() {
    try {
      // 测试云函数调用
      if (wx.cloud) {
        const result = await wx.cloud.callFunction({
          name: 'health-check',
          data: {}
        });
        
        if (result.result && result.result.success) {
          logger.info('云函数连接测试成功');
        }
      }
      
      // 测试数据库查询
      const result = await this.db.collection('users').limit(1).get();
      logger.info('数据库查询测试成功', { count: result.data.length });
      
    } catch (error) {
      logger.warn('数据库连接测试失败', error);
      // 不抛出错误，允许系统继续运行
    }
  }

  // 获取数据库实例
  async getDatabase() {
    if (!this.isConnected) {
      await this.initialize();
    }
    
    return this.db;
  }

  // 获取云函数实例
  getCloud() {
    return wx.cloud;
  }

  // 连接重试机制
  async connectWithRetry() {
    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      try {
        logger.info(`数据库连接尝试 ${attempt}/${this.maxAttempts}`);
        await this.initialize();
        return true;
      } catch (error) {
        logger.warn(`数据库连接尝试 ${attempt} 失败`, error);
        
        if (attempt < this.maxAttempts) {
          await this.delay(this.retryDelay * attempt); // 指数退避
        } else {
          logger.error('数据库连接失败，已达到最大重试次数');
          throw error;
        }
      }
    }
  }

  // 延迟函数
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // 连接池管理
  async getConnectionFromPool(tableName) {
    const poolKey = `${this.config.env}:${tableName}`;
    
    if (this.connectionPool.has(poolKey)) {
      const connection = this.connectionPool.get(poolKey);
      if (this.isConnectionValid(connection)) {
        logger.debug(`从连接池获取连接: ${poolKey}`);
        return connection;
      } else {
        this.connectionPool.delete(poolKey);
      }
    }
    
    // 创建新连接
    const newConnection = await this.createConnection(tableName);
    this.connectionPool.set(poolKey, newConnection);
    
    return newConnection;
  }

  // 创建数据库连接
  async createConnection(tableName) {
    try {
      const db = await this.getDatabase();
      return db.collection(tableName);
    } catch (error) {
      logger.error(`创建数据库连接失败: ${tableName}`, error);
      throw error;
    }
  }

  // 验证连接是否有效
  isConnectionValid(connection) {
    try {
      // 简单的连接验证
      return connection && typeof connection.get === 'function';
    } catch (error) {
      return false;
    }
  }

  // 清理连接池
  cleanupPool() {
    const beforeSize = this.connectionPool.size;
    
    for (const [key, connection] of this.connectionPool) {
      if (!this.isConnectionValid(connection)) {
        this.connectionPool.delete(key);
        logger.debug(`清理无效连接: ${key}`);
      }
    }
    
    const afterSize = this.connectionPool.size;
    logger.info(`连接池清理完成`, { 
      before: beforeSize, 
      after: afterSize, 
      cleaned: beforeSize - afterSize 
    });
  }

  // 事务管理
  async beginTransaction(tableName) {
    const transaction = {
      id: this.generateTransactionId(),
      tableName,
      startTime: Date.now(),
      operations: [],
      state: 'active'
    };
    
    this.transactionStack.push(transaction);
    logger.info(`开始事务: ${transaction.id}`, { tableName });
    
    return transaction;
  }

  // 提交事务
  async commitTransaction(transactionId) {
    const transaction = this.findTransaction(transactionId);
    if (!transaction) {
      throw new Error(`事务不存在: ${transactionId}`);
    }
    
    try {
      // 执行所有操作
      for (const operation of transaction.operations) {
        await operation();
      }
      
      transaction.state = 'committed';
      this.removeTransaction(transactionId);
      
      logger.info(`事务提交成功: ${transactionId}`, { 
        operationCount: transaction.operations.length,
        duration: Date.now() - transaction.startTime 
      });
      
    } catch (error) {
      transaction.state = 'failed';
      logger.error(`事务提交失败: ${transactionId}`, error);
      throw error;
    }
  }

  // 回滚事务
  async rollbackTransaction(transactionId) {
    const transaction = this.findTransaction(transactionId);
    if (!transaction) {
      throw new Error(`事务不存在: ${transactionId}`);
    }
    
    transaction.state = 'rolled_back';
    this.removeTransaction(transactionId);
    
    logger.info(`事务回滚: ${transactionId}`, { 
      operationCount: transaction.operations.length,
      duration: Date.now() - transaction.startTime 
    });
  }

  // 生成事务ID
  generateTransactionId() {
    return `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // 查找事务
  findTransaction(transactionId) {
    return this.transactionStack.find(tx => tx.id === transactionId);
  }

  // 移除事务
  removeTransaction(transactionId) {
    const index = this.transactionStack.findIndex(tx => tx.id === transactionId);
    if (index !== -1) {
      this.transactionStack.splice(index, 1);
    }
  }

  // 错误恢复机制
  async recoverFromError(error, context) {
    logger.error('数据库错误恢复', { error: error.message, context });
    
    const recoveryStrategies = [
      this.retryConnection.bind(this),
      this.clearConnectionPool.bind(this),
      this.resetTransactionStack.bind(this),
      this.fallbackToLocal.bind(this)
    ];
    
    for (const strategy of recoveryStrategies) {
      try {
        const result = await strategy(error, context);
        if (result) {
          logger.info('错误恢复成功', { strategy: strategy.name });
          return result;
        }
      } catch (recoveryError) {
        logger.warn(`恢复策略 ${strategy.name} 失败`, recoveryError);
      }
    }
    
    throw new Error('所有错误恢复策略都失败了');
  }

  // 重试连接
  async retryConnection(error, context) {
    if (this.connectionAttempts < this.maxAttempts) {
      this.connectionAttempts++;
      await this.connectWithRetry();
      return true;
    }
    return false;
  }

  // 清空连接池
  async clearConnectionPool() {
    this.connectionPool.clear();
    logger.info('连接池已清空');
    return true;
  }

  // 重置事务栈
  async resetTransactionStack() {
    this.transactionStack = [];
    logger.info('事务栈已重置');
    return true;
  }

  // 回退到本地模式
  async fallbackToLocal() {
    logger.warn('回退到本地数据库模式');
    this.isConnected = false;
    // 这里可以实现本地存储逻辑
    return true;
  }

  // 健康检查
  async healthCheck() {
    const checks = {
      timestamp: new Date().toISOString(),
      database: await this.checkDatabaseHealth(),
      cloud: await this.checkCloudHealth(),
      connectionPool: this.checkConnectionPoolHealth(),
      transactions: this.checkTransactionHealth(),
      cache: this.checkCacheHealth()
    };
    
    checks.overall = this.calculateOverallHealth(checks);
    return checks;
  }

  // 数据库健康检查
  async checkDatabaseHealth() {
    try {
      const startTime = Date.now();
      await this.db.collection('users').limit(1).get();
      const responseTime = Date.now() - startTime;
      
      return {
        status: 'healthy',
        responseTime: `${responseTime}ms`,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  // 云函数健康检查
  async checkCloudHealth() {
    try {
      if (!wx.cloud) {
        return { status: 'disabled', message: '云函数未启用' };
      }
      
      const startTime = Date.now();
      const result = await wx.cloud.callFunction({
        name: 'health-check',
        data: {}
      });
      const responseTime = Date.now() - startTime;
      
      return {
        status: result.result?.success ? 'healthy' : 'unhealthy',
        responseTime: `${responseTime}ms`,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  // 连接池健康检查
  checkConnectionPoolHealth() {
    return {
      status: 'healthy',
      poolSize: this.connectionPool.size,
      maxPoolSize: this.config.maxPoolSize,
      utilization: `${(this.connectionPool.size / this.config.maxPoolSize * 100).toFixed(2)}%`
    };
  }

  // 事务健康检查
  checkTransactionHealth() {
    const activeTransactions = this.transactionStack.filter(tx => tx.state === 'active');
    
    return {
      status: activeTransactions.length > 10 ? 'warning' : 'healthy',
      activeCount: activeTransactions.length,
      totalCount: this.transactionStack.length,
      oldestTransaction: this.transactionStack.length > 0 
        ? Math.max(...this.transactionStack.map(tx => tx.startTime))
        : null
    };
  }

  // 缓存健康检查
  checkCacheHealth() {
    const cacheStats = this.cacheManager.getStats();
    
    return {
      status: cacheStats.hitRate > '80%' ? 'healthy' : 'warning',
      hitRate: cacheStats.hitRate,
      cacheSize: cacheStats.cacheSize,
      memoryUsage: cacheStats.memoryUsage
    };
  }

  // 计算整体健康状态
  calculateOverallHealth(checks) {
    const statuses = Object.values(checks)
      .filter(check => typeof check === 'object' && check.status)
      .map(check => check.status);
    
    if (statuses.includes('unhealthy')) return 'unhealthy';
    if (statuses.includes('warning')) return 'warning';
    return 'healthy';
  }

  // 获取统计信息
  getStats() {
    return {
      connectionAttempts: this.connectionAttempts,
      poolSize: this.connectionPool.size,
      activeTransactions: this.transactionStack.filter(tx => tx.state === 'active').length,
      cacheStats: this.cacheManager.getStats(),
      config: this.config,
      isConnected: this.isConnected
    };
  }

  // 清理资源
  async cleanup() {
    logger.info('开始清理数据库连接管理器资源');
    
    // 清空连接池
    this.connectionPool.clear();
    
    // 清理事务栈
    this.transactionStack = [];
    
    // 重置状态
    this.isConnected = false;
    this.connectionAttempts = 0;
    
    logger.info('数据库连接管理器资源清理完成');
  }
}

// 单例模式
let databaseManager = null;

function getDatabaseManager() {
  if (!databaseManager) {
    databaseManager = new DatabaseManager();
  }
  return databaseManager;
}

module.exports = {
  DatabaseManager,
  getDatabaseManager
};