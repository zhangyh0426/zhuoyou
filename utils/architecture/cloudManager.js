// 云函数管理器 - 统一处理云函数调用和错误处理
const { logger } = require('../logger');
const { ErrorHandler } = require('../errorHandler');

class CloudManager {
  constructor() {
    this.cloudFunctions = new Map();
    this.requestQueue = [];
    this.isProcessing = false;
    this.retryAttempts = 3;
    this.retryDelay = 1000; // 1秒
    this.timeout = 10000; // 10秒超时
    this.circuitBreaker = new Map();
    this.maxFailures = 5;
    this.resetTimeout = 60000; // 1分钟后重置熔断器
  }

  // 初始化云函数
  initCloudFunctions() {
    if (!wx.cloud) {
      logger.warn('微信云开发环境未检测到');
      return false;
    }

    // 定义可用的云函数
    const functions = [
      'userAuth',
      'activityManager', 
      'transactionManager',
      'storeManager'
    ];

    functions.forEach(funcName => {
      this.cloudFunctions.set(funcName, this.createCloudFunctionWrapper(funcName));
    });

    logger.info('云函数初始化完成');
    return true;
  }

  // 创建云函数包装器
  createCloudFunctionWrapper(functionName) {
    return async (action, data = {}, options = {}) => {
      return await this.callCloudFunction(functionName, action, data, options);
    };
  }

  // 调用云函数
  async callCloudFunction(functionName, action, data, options = {}) {
    const requestId = this.generateRequestId();
    const startTime = Date.now();

    try {
      // 检查熔断器状态
      if (this.isCircuitBreakerOpen(functionName)) {
        throw new Error(`云函数 ${functionName} 熔断器开启，暂时不可用`);
      }

      logger.info(`[${requestId}] 调用云函数: ${functionName}.${action}`, { data });

      // 构建请求参数
      const requestData = {
        action,
        data,
        timestamp: Date.now(),
        requestId
      };

      // 执行云函数调用
      const result = await this.executeWithTimeout(
        this.callWithRetry(functionName, requestData),
        options.timeout || this.timeout
      );

      const duration = Date.now() - startTime;
      logger.info(`[${requestId}] 云函数调用成功 (${duration}ms):`, result);

      // 重置熔断器失败计数
      this.resetCircuitBreaker(functionName);

      return this.processResult(result, options);

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`[${requestId}] 云函数调用失败 (${duration}ms):`, error);

      // 更新熔断器状态
      this.recordFailure(functionName);

      // 处理特定错误类型
      const handledError = this.handleCloudFunctionError(error, functionName, action);
      
      throw handledError;
    }
  }

  // 带重试机制的调用
  async callWithRetry(functionName, requestData) {
    let lastError;

    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        logger.info(`[${requestData.requestId}] 第 ${attempt} 次尝试调用 ${functionName}`);
        
        const result = await wx.cloud.callFunction({
          name: functionName,
          data: requestData
        });

        return result;

      } catch (error) {
        lastError = error;
        logger.warn(`[${requestData.requestId}] 第 ${attempt} 次尝试失败:`, error);

        // 如果是最后一次尝试，不再重试
        if (attempt === this.retryAttempts) {
          break;
        }

        // 等待重试延迟
        await this.delay(this.retryDelay * attempt);
      }
    }

    throw lastError;
  }

  // 超时执行
  async executeWithTimeout(promise, timeout) {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`云函数调用超时 (${timeout}ms)`));
      }, timeout);
    });

    return Promise.race([promise, timeoutPromise]);
  }

  // 处理返回结果
  processResult(result, options) {
    if (!result || !result.result) {
      throw new Error('云函数返回结果格式错误');
    }

    const { result: data } = result;

    // 检查业务逻辑错误
    if (data.code && data.code !== 0) {
      const error = new Error(data.message || '业务逻辑错误');
      error.code = data.code;
      error.data = data.data;
      throw error;
    }

    // 返回格式化数据
    return {
      success: true,
      data: data.data || data,
      message: data.message || '操作成功',
      timestamp: Date.now()
    };
  }

  // 处理云函数错误
  handleCloudFunctionError(error, functionName, action) {
    let errorMessage = error.message || '未知错误';
    let errorCode = 'CLOUD_FUNCTION_ERROR';
    let shouldRetry = false;

    // 网络错误
    if (error.message && error.message.includes('network')) {
      errorMessage = '网络连接失败，请检查网络设置';
      errorCode = 'NETWORK_ERROR';
      shouldRetry = true;
    }

    // 云函数不存在
    if (error.message && error.message.includes('not found')) {
      errorMessage = `云函数 ${functionName} 不存在`;
      errorCode = 'FUNCTION_NOT_FOUND';
    }

    // 权限错误
    if (error.message && error.message.includes('permission')) {
      errorMessage = '权限不足，无法执行此操作';
      errorCode = 'PERMISSION_DENIED';
    }

    // 参数错误
    if (error.message && error.message.includes('invalid')) {
      errorMessage = '参数错误，请检查输入数据';
      errorCode = 'INVALID_PARAMETER';
    }

    const handledError = new Error(errorMessage);
    handledError.originalError = error;
    handledError.code = errorCode;
    handledError.functionName = functionName;
    handledError.action = action;
    handledError.shouldRetry = shouldRetry;
    handledError.timestamp = Date.now();

    return handledError;
  }

  // 熔断器相关方法
  isCircuitBreakerOpen(functionName) {
    const breaker = this.circuitBreaker.get(functionName);
    if (!breaker) return false;

    const now = Date.now();
    if (now - breaker.lastFailure > this.resetTimeout) {
      this.circuitBreaker.delete(functionName);
      return false;
    }

    return breaker.failureCount >= this.maxFailures;
  }

  recordFailure(functionName) {
    const breaker = this.circuitBreaker.get(functionName) || {
      failureCount: 0,
      lastFailure: 0
    };

    breaker.failureCount++;
    breaker.lastFailure = Date.now();
    
    this.circuitBreaker.set(functionName, breaker);

    logger.warn(`云函数 ${functionName} 失败次数: ${breaker.failureCount}`);
  }

  resetCircuitBreaker(functionName) {
    this.circuitBreaker.delete(functionName);
  }

  // 队列管理
  addToQueue(request) {
    this.requestQueue.push(request);
    this.processQueue();
  }

  async processQueue() {
    if (this.isProcessing || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.requestQueue.length > 0) {
      const request = this.requestQueue.shift();
      
      try {
        await request();
      } catch (error) {
        logger.error('队列请求处理失败:', error);
      }

      // 短暂延迟，避免过于频繁的请求
      await this.delay(100);
    }

    this.isProcessing = false;
  }

  // 批量调用优化
  async batchCall(functionName, actions, batchSize = 10) {
    const results = [];
    
    for (let i = 0; i < actions.length; i += batchSize) {
      const batch = actions.slice(i, i + batchSize);
      const batchResults = await Promise.allSettled(
        batch.map(action => this.callCloudFunction(functionName, action.type, action.data))
      );
      
      results.push(...batchResults);
    }

    return results;
  }

  // 获取云函数实例
  getCloudFunction(functionName) {
    return this.cloudFunctions.get(functionName);
  }

  // 获取所有云函数
  getAllCloudFunctions() {
    return Object.fromEntries(this.cloudFunctions);
  }

  // 健康检查
  async healthCheck() {
    const results = {};
    
    for (const [functionName, func] of this.cloudFunctions) {
      try {
        const startTime = Date.now();
        await func('healthCheck', {});
        const duration = Date.now() - startTime;
        
        results[functionName] = {
          status: 'healthy',
          responseTime: duration,
          circuitBreaker: this.isCircuitBreakerOpen(functionName) ? 'open' : 'closed'
        };
      } catch (error) {
        results[functionName] = {
          status: 'unhealthy',
          error: error.message,
          circuitBreaker: this.isCircuitBreakerOpen(functionName) ? 'open' : 'closed'
        };
      }
    }

    return results;
  }

  // 获取统计信息
  getStats() {
    return {
      totalFunctions: this.cloudFunctions.size,
      queueLength: this.requestQueue.length,
      circuitBreakers: Array.from(this.circuitBreaker.entries()).map(([name, breaker]) => ({
        functionName: name,
        failureCount: breaker.failureCount,
        isOpen: this.isCircuitBreakerOpen(name)
      }))
    };
  }

  // 清理资源
  cleanup() {
    this.requestQueue = [];
    this.isProcessing = false;
    this.circuitBreaker.clear();
    logger.info('云函数管理器资源已清理');
  }

  // 工具方法
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// 单例模式
let cloudManager = null;

function getCloudManager() {
  if (!cloudManager) {
    cloudManager = new CloudManager();
  }
  return cloudManager;
}

module.exports = {
  CloudManager,
  getCloudManager
};