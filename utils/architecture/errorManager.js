// 错误处理管理器 - 改进错误处理和日志系统
const { logger } = require('./logger');
const { getCacheManager } = require('./cacheManager');
const { getDatabaseManager } = require('./databaseManager');

class ErrorManager {
  constructor() {
    // 错误配置
    this.config = {
      enableLogging: true,
      enableReporting: true,
      enableRecovery: true,
      enableMetrics: true,
      maxErrorHistory: 1000,
      errorTimeout: 5000,
      retryAttempts: 3,
      retryDelay: 1000
    };
    
    // 错误历史
    this.errorHistory = [];
    
    // 错误统计
    this.errorStats = {
      totalErrors: 0,
      handledErrors: 0,
      unhandledErrors: 0,
      recoveredErrors: 0,
      errorTypes: new Map(),
      errorSources: new Map(),
      errorTimes: []
    };
    
    // 错误处理器
    this.errorHandlers = new Map();
    
    // 错误恢复策略
    this.recoveryStrategies = new Map();
    
    // 错误缓存
    this.errorCache = new Map();
    
    // 全局错误处理
    this.globalErrorHandler = null;
    this.globalUnhandledRejectionHandler = null;
    
    this.cacheManager = getCacheManager();
    this.databaseManager = getDatabaseManager();
    
    // 初始化
    this.initialize();
  }

  // 初始化错误管理器
  initialize() {
    logger.info('开始初始化错误管理器');
    
    try {
      // 注册默认错误处理器
      this.registerDefaultHandlers();
      
      // 注册默认恢复策略
      this.registerDefaultRecoveryStrategies();
      
      // 设置全局错误处理
      this.setupGlobalErrorHandling();
      
      // 加载历史错误
      this.loadErrorHistory();
      
      logger.info('错误管理器初始化成功');
      
    } catch (error) {
      logger.error('错误管理器初始化失败', error);
      throw error;
    }
  }

  // 注册默认错误处理器
  registerDefaultHandlers() {
    // 网络错误处理器
    this.registerErrorHandler('NetworkError', async (error, context) => {
      logger.warn('网络错误，尝试重试', { error: error.message, context });
      
      // 检查网络状态
      if (this.checkNetworkStatus()) {
        // 网络正常，可能是服务器问题
        return {
          recovered: false,
          message: '网络连接正常，可能是服务器问题',
          suggestion: '请稍后重试'
        };
      } else {
        // 网络异常
        return {
          recovered: false,
          message: '网络连接异常',
          suggestion: '请检查网络连接'
        };
      }
    });
    
    // 数据库错误处理器
    this.registerErrorHandler('DatabaseError', async (error, context) => {
      logger.warn('数据库错误，尝试恢复', { error: error.message, context });
      
      try {
        // 尝试重新连接数据库
        await this.databaseManager.recoverFromError(error, context);
        
        return {
          recovered: true,
          message: '数据库连接已恢复',
          suggestion: '请重试操作'
        };
      } catch (recoveryError) {
        return {
          recovered: false,
          message: '数据库错误无法恢复',
          suggestion: '请联系技术支持'
        };
      }
    });
    
    // 云函数错误处理器
    this.registerErrorHandler('CloudFunctionError', async (error, context) => {
      logger.warn('云函数错误，尝试回退到本地', { error: error.message, context });
      
      // 云函数错误通常会自动回退到本地执行
      return {
        recovered: true,
        message: '已回退到本地执行',
        suggestion: '云函数暂时不可用'
      };
    });
    
    // 验证错误处理器
    this.registerErrorHandler('ValidationError', async (error, context) => {
      logger.warn('验证错误', { error: error.message, context });
      
      return {
        recovered: false,
        message: error.message,
        suggestion: '请检查输入数据'
      };
    });
    
    // 权限错误处理器
    this.registerErrorHandler('PermissionError', async (error, context) => {
      logger.warn('权限错误', { error: error.message, context });
      
      return {
        recovered: false,
        message: '权限不足',
        suggestion: '请联系管理员获取权限'
      };
    });
  }

  // 注册默认恢复策略
  registerDefaultRecoveryStrategies() {
    // 重试策略
    this.registerRecoveryStrategy('retry', async (error, context) => {
      const maxRetries = context.retries || this.config.retryAttempts;
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          logger.info(`重试策略 - 尝试 ${attempt}/${maxRetries}`);
          
          // 延迟重试（指数退避）
          await this.delay(this.config.retryDelay * attempt);
          
          // 重新执行原始操作
          if (context.retryFunction) {
            const result = await context.retryFunction();
            return {
              success: true,
              data: result,
              attempts: attempt
            };
          }
          
        } catch (retryError) {
          logger.warn(`重试 ${attempt} 失败`, retryError);
          
          if (attempt === maxRetries) {
            throw retryError;
          }
        }
      }
      
      throw new Error('重试策略失败');
    });
    
    // 回退策略
    this.registerRecoveryStrategy('fallback', async (error, context) => {
      if (context.fallbackFunction) {
        logger.info('执行回退策略');
        
        try {
          const result = await context.fallbackFunction();
          return {
            success: true,
            data: result,
            fromFallback: true
          };
        } catch (fallbackError) {
          throw new Error('回退策略失败: ' + fallbackError.message);
        }
      } else {
        throw new Error('没有可用的回退函数');
      }
    });
    
    // 缓存策略
    this.registerRecoveryStrategy('cache', async (error, context) => {
      if (context.cacheKey) {
        logger.info('执行缓存策略');
        
        const cachedData = await this.cacheManager.get(context.cacheKey);
        if (cachedData !== null) {
          return {
            success: true,
            data: cachedData,
            fromCache: true
          };
        } else {
          throw new Error('缓存中没有可用数据');
        }
      } else {
        throw new Error('没有缓存键');
      }
    });
    
    // 降级策略
    this.registerRecoveryStrategy('degrade', async (error, context) => {
      logger.info('执行降级策略');
      
      if (context.degradedFunction) {
        try {
          const result = await context.degradedFunction();
          return {
            success: true,
            data: result,
            degraded: true
          };
        } catch (degradeError) {
          throw new Error('降级策略失败: ' + degradeError.message);
        }
      } else {
        // 返回降级数据
        return {
          success: true,
          data: context.degradedData || {},
          degraded: true
        };
      }
    });
  }

  // 设置全局错误处理
  setupGlobalErrorHandling() {
    // 全局错误处理
    this.globalErrorHandler = (event) => {
      this.handleGlobalError(event.error || event, {
        source: 'global',
        type: 'error',
        timestamp: new Date().toISOString()
      });
    };
    
    // 全局未处理Promise拒绝
    this.globalUnhandledRejectionHandler = (event) => {
      this.handleGlobalError(event.reason, {
        source: 'global',
        type: 'unhandledrejection',
        timestamp: new Date().toISOString()
      });
    };
    
    // 绑定事件监听器
    if (typeof window !== 'undefined') {
      window.addEventListener('error', this.globalErrorHandler);
      window.addEventListener('unhandledrejection', this.globalUnhandledRejectionHandler);
    }
  }

  // 处理错误
  async handleError(error, context = {}) {
    try {
      this.errorStats.totalErrors++;
      
      // 记录错误
      const errorRecord = await this.recordError(error, context);
      
      // 分类错误
      const errorType = this.classifyError(error);
      this.updateErrorStats(errorType, context);
      
      // 查找错误处理器
      const handler = this.findErrorHandler(errorType);
      
      if (handler) {
        this.errorStats.handledErrors++;
        
        try {
          const result = await handler(error, context);
          
          if (result.recovered) {
            this.errorStats.recoveredErrors++;
            logger.info('错误已恢复', { 
              errorType, 
              message: result.message 
            });
          }
          
          return result;
          
        } catch (handlerError) {
          logger.error('错误处理器执行失败', handlerError);
          return this.createDefaultErrorResult(error, context);
        }
      } else {
        this.errorStats.unhandledErrors++;
        logger.warn('未找到错误处理器', { errorType, error: error.message });
        return this.createDefaultErrorResult(error, context);
      }
      
    } catch (errorHandlingError) {
      logger.error('错误处理失败', errorHandlingError);
      return this.createDefaultErrorResult(error, context);
    }
  }

  // 处理全局错误
  handleGlobalError(error, context) {
    logger.error('全局错误捕获', { error: error.message, context });
    
    // 异步处理，避免阻塞主线程
    setTimeout(() => {
      this.handleError(error, {
        ...context,
        isGlobal: true
      }).catch(handleError => {
        logger.error('全局错误处理失败', handleError);
      });
    }, 0);
  }

  // 记录错误
  async recordError(error, context) {
    try {
      const errorRecord = {
        id: this.generateErrorId(),
        timestamp: new Date().toISOString(),
        message: error.message,
        stack: error.stack,
        type: this.classifyError(error),
        source: context.source || 'unknown',
        context: this.sanitizeContext(context),
        userAgent: this.getUserAgent(),
        url: this.getCurrentUrl(),
        severity: this.calculateSeverity(error, context)
      };
      
      // 添加到历史记录
      this.errorHistory.push(errorRecord);
      
      // 限制历史记录大小
      if (this.errorHistory.length > this.config.maxErrorHistory) {
        this.errorHistory = this.errorHistory.slice(-this.config.maxErrorHistory);
      }
      
      // 记录到日志
      if (this.config.enableLogging) {
        logger.error('错误记录', {
          errorId: errorRecord.id,
          message: errorRecord.message,
          type: errorRecord.type,
          source: errorRecord.source,
          severity: errorRecord.severity
        });
      }
      
      // 持久化到数据库
      if (this.config.enableReporting) {
        this.persistError(errorRecord);
      }
      
      return errorRecord;
      
    } catch (recordingError) {
      logger.error('错误记录失败', recordingError);
      return null;
    }
  }

  // 分类错误
  classifyError(error) {
    const message = error.message || error.toString();
    
    // 网络错误
    if (message.includes('network') || message.includes('Network')) {
      return 'NetworkError';
    }
    
    // 数据库错误
    if (message.includes('database') || message.includes('Database') || 
        message.includes('collection') || message.includes('query')) {
      return 'DatabaseError';
    }
    
    // 云函数错误
    if (message.includes('cloud') || message.includes('Cloud') || 
        message.includes('function') || message.includes('Function')) {
      return 'CloudFunctionError';
    }
    
    // 验证错误
    if (message.includes('validation') || message.includes('Validation') ||
        message.includes('invalid') || message.includes('Invalid')) {
      return 'ValidationError';
    }
    
    // 权限错误
    if (message.includes('permission') || message.includes('Permission') ||
        message.includes('unauthorized') || message.includes('Unauthorized')) {
      return 'PermissionError';
    }
    
    // 超时错误
    if (message.includes('timeout') || message.includes('Timeout')) {
      return 'TimeoutError';
    }
    
    // 内存错误
    if (message.includes('memory') || message.includes('Memory') ||
        message.includes('out of memory')) {
      return 'MemoryError';
    }
    
    // 默认类型
    return 'ApplicationError';
  }

  // 更新错误统计
  updateErrorStats(errorType, context) {
    // 错误类型统计
    const currentCount = this.errorStats.errorTypes.get(errorType) || 0;
    this.errorStats.errorTypes.set(errorType, currentCount + 1);
    
    // 错误来源统计
    const source = context.source || 'unknown';
    const currentSourceCount = this.errorStats.errorSources.get(source) || 0;
    this.errorStats.errorSources.set(source, currentSourceCount + 1);
    
    // 错误时间统计
    const currentTime = Date.now();
    this.errorStats.errorTimes.push(currentTime);
    
    // 清理过期的时间记录（只保留最近1小时）
    const oneHourAgo = currentTime - 3600000;
    this.errorStats.errorTimes = this.errorStats.errorTimes.filter(
      time => time > oneHourAgo
    );
  }

  // 查找错误处理器
  findErrorHandler(errorType) {
    // 首先查找特定类型的处理器
    if (this.errorHandlers.has(errorType)) {
      return this.errorHandlers.get(errorType);
    }
      
    // 然后查找父类型的处理器
    const parentType = this.getParentErrorType(errorType);
    if (parentType && this.errorHandlers.has(parentType)) {
      return this.errorHandlers.get(parentType);
    }
    
    // 最后查找通用处理器
    if (this.errorHandlers.has('Error')) {
      return this.errorHandlers.get('Error');
    }
    
    return null;
  }

  // 获取父错误类型
  getParentErrorType(errorType) {
    const parentTypes = {
      'NetworkError': 'Error',
      'DatabaseError': 'Error',
      'CloudFunctionError': 'Error',
      'ValidationError': 'Error',
      'PermissionError': 'Error',
      'TimeoutError': 'Error',
      'MemoryError': 'Error',
      'ApplicationError': 'Error'
    };
    
    return parentTypes[errorType] || null;
  }

  // 创建默认错误结果
  createDefaultErrorResult(error, context) {
    return {
      recovered: false,
      message: error.message || '发生未知错误',
      suggestion: '请稍后重试或联系技术支持'
    };
  }

  // 错误恢复
  async recoverFromError(error, strategies = [], context = {}) {
    if (!this.config.enableRecovery) {
      return {
        success: false,
        message: '错误恢复已禁用'
      };
    }
    
    // 如果没有指定策略，使用默认策略
    if (strategies.length === 0) {
      strategies = ['retry', 'fallback', 'cache', 'degrade'];
    }
    
    for (const strategyName of strategies) {
      try {
        logger.info(`尝试错误恢复策略: ${strategyName}`);
        
        const strategy = this.recoveryStrategies.get(strategyName);
        if (!strategy) {
          logger.warn(`恢复策略不存在: ${strategyName}`);
          continue;
        }
        
        const result = await strategy(error, context);
        
        if (result.success) {
          logger.info(`错误恢复成功: ${strategyName}`);
          return result;
        }
        
      } catch (strategyError) {
        logger.error(`恢复策略 ${strategyName} 失败`, strategyError);
      }
    }
    
    logger.error('所有错误恢复策略都失败了');
    return {
      success: false,
      message: '错误恢复失败'
    };
  }

  // 注册错误处理器
  registerErrorHandler(errorType, handler) {
    this.errorHandlers.set(errorType, handler);
    logger.info(`注册错误处理器: ${errorType}`);
  }

  // 注册恢复策略
  registerRecoveryStrategy(strategyName, strategy) {
    this.recoveryStrategies.set(strategyName, strategy);
    logger.info(`注册错误恢复策略: ${strategyName}`);
  }

  // 工具函数
  generateErrorId() {
    return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  sanitizeContext(context) {
    // 清理敏感信息
    const sanitized = { ...context };
    
    // 删除敏感字段
    const sensitiveFields = ['password', 'token', 'secret', 'key'];
    sensitiveFields.forEach(field => {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    });
    
    return sanitized;
  }

  getUserAgent() {
    return typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown';
  }

  getCurrentUrl() {
    return typeof window !== 'undefined' ? window.location.href : 'unknown';
  }

  calculateSeverity(error, context) {
    // 根据错误类型和上下文计算严重程度
    const errorType = this.classifyError(error);
    
    const severityMap = {
      'NetworkError': 'warning',
      'DatabaseError': 'error',
      'CloudFunctionError': 'warning',
      'ValidationError': 'info',
      'PermissionError': 'warning',
      'TimeoutError': 'warning',
      'MemoryError': 'critical',
      'ApplicationError': 'error'
    };
    
    return severityMap[errorType] || 'error';
  }

  checkNetworkStatus() {
    return typeof navigator !== 'undefined' && navigator.onLine;
  }

  async persistError(errorRecord) {
    try {
      const db = await this.databaseManager.getDatabase();
      
      await db.collection('error_logs').add({
        data: errorRecord
      });
      
      logger.debug(`错误记录已持久化: ${errorRecord.id}`);
      
    } catch (error) {
      logger.error('错误持久化失败', error);
    }
  }

  async loadErrorHistory() {
    try {
      const cachedHistory = await this.cacheManager.get('errorManager:history');
      if (cachedHistory) {
        this.errorHistory = cachedHistory;
        logger.info(`从缓存加载 ${this.errorHistory.length} 条错误历史`);
      }
      
    } catch (error) {
      logger.warn('加载错误历史失败', error);
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // 获取错误统计
  getErrorStats() {
    const now = Date.now();
    const oneHourAgo = now - 3600000;
    const oneDayAgo = now - 86400000;
    
    const recentErrors = this.errorHistory.filter(
      error => new Date(error.timestamp).getTime() > oneHourAgo
    );
    
    const dailyErrors = this.errorHistory.filter(
      error => new Date(error.timestamp).getTime() > oneDayAgo
    );
    
    return {
      total: this.errorStats.totalErrors,
      handled: this.errorStats.handledErrors,
      unhandled: this.errorStats.unhandledErrors,
      recovered: this.errorStats.recoveredErrors,
      recent: {
        lastHour: recentErrors.length,
        lastDay: dailyErrors.length
      },
      byType: Object.fromEntries(this.errorStats.errorTypes),
      bySource: Object.fromEntries(this.errorStats.errorSources),
      errorRate: this.calculateErrorRate()
    };
  }

  // 计算错误率
  calculateErrorRate() {
    const now = Date.now();
    const oneHourAgo = now - 3600000;
    
    const recentErrors = this.errorTimes.filter(time => time > oneHourAgo);
    
    if (recentErrors.length === 0) {
      return '0%';
    }
    
    // 计算平均每分钟错误数
    const errorsPerMinute = recentErrors.length / 60;
    
    if (errorsPerMinute < 1) {
      return '低';
    } else if (errorsPerMinute < 5) {
      return '中';
    } else {
      return '高';
    }
  }

  // 健康检查
  async healthCheck() {
    const stats = this.getErrorStats();
    
    const checks = {
      timestamp: new Date().toISOString(),
      errorRate: stats.errorRate,
      recentErrors: stats.recent,
      handlers: this.errorHandlers.size,
      recoveryStrategies: this.recoveryStrategies.size,
      historySize: this.errorHistory.length
    };
    
    // 根据错误率判断健康状态
    if (stats.errorRate === '高' || stats.recent.lastHour > 10) {
      checks.overall = 'unhealthy';
    } else if (stats.errorRate === '中' || stats.recent.lastHour > 5) {
      checks.overall = 'warning';
    } else {
      checks.overall = 'healthy';
    }
    
    return checks;
  }

  // 清理资源
  async cleanup() {
    logger.info('开始清理错误管理器资源');
    
    // 移除全局错误处理
    if (typeof window !== 'undefined') {
      if (this.globalErrorHandler) {
        window.removeEventListener('error', this.globalErrorHandler);
      }
      
      if (this.globalUnhandledRejectionHandler) {
        window.removeEventListener('unhandledrejection', this.globalUnhandledRejectionHandler);
      }
    }
    
    // 清空缓存
    this.errorCache.clear();
    
    // 保存历史记录到缓存
    await this.cacheManager.set('errorManager:history', this.errorHistory, 86400000); // 缓存1天
    
    logger.info('错误管理器资源清理完成');
  }
}

// 单例模式
let errorManager = null;

function getErrorManager() {
  if (!errorManager) {
    errorManager = new ErrorManager();
  }
  return errorManager;
}

module.exports = {
  ErrorManager,
  getErrorManager
};