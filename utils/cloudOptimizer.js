/**
 * 云函数和数据库操作优化器
 * 提供云函数调用优化、数据库查询优化、缓存策略等功能
 */

const { logger } = require('./logger');
const { performanceMonitor } = require('./performance');
const { CacheManager } = require('./cache');
const Constants = require('./constants');
const Validator = require('./validator');

class CloudFunctionManager {
  constructor() {
    this.requestCache = new CacheManager({ ttl: 5 * 60 * 1000 }); // 5分钟缓存
    this.batchQueue = new Map();
    this.concurrencyLimit = 3; // 最大并发数
    this.currentRequests = 0;
    this.requestQueue = [];

    this.init();
  }

  /**
   * 初始化
   * @private
   */
  init() {
    this.setupBatchProcessor();
    this.setupPerformanceMonitoring();
  }

  /**
   * 设置批处理处理器
   * @private
   */
  setupBatchProcessor() {
    setInterval(() => {
      this.processBatchQueue();
    }, 1000); // 每秒处理一次批处理队列
  }

  /**
   * 设置性能监控
   * @private
   */
  setupPerformanceMonitoring() {
    // 定期清理过期缓存
    setInterval(() => {
      this.requestCache.cleanup();
    }, 30000);
  }

  /**
   * 优化的云函数调用
   * @param {string} functionName - 云函数名称
   * @param {object} data - 请求数据
   * @param {object} options - 选项配置
   * @returns {Promise} 调用结果
   */
  async call(functionName, data = {}, options = {}) {
    const {
      useCache = false,
      cacheKey = null,
      timeout = Constants.NETWORK.TIMEOUT,
      retry = true,
      retryCount = 3,
      batch = false,
      priority = 'normal'
    } = options;

    const startTime = Date.now();
    const requestId = this.generateRequestId();

    try {
      // 验证输入数据
      this.validateCallData(functionName, data);

      // 生成缓存键
      const finalCacheKey = cacheKey || this.generateCacheKey(functionName, data);

      // 检查缓存
      if (useCache && data.method === 'GET') {
        const cachedResult = await this.getCachedResult(finalCacheKey);
        if (cachedResult) {
          logger.debug(`Using cached result for ${functionName}`, { cacheKey: finalCacheKey });
          performanceMonitor.recordMetric('cloud_cache_hit', 1);
          return cachedResult;
        }
      }

      // 批处理模式
      if (batch) {
        return this.addToBatchQueue(functionName, data, options);
      }

      // 执行云函数调用
      const result = await this.executeCall(functionName, data, {
        timeout,
        retry,
        retryCount,
        requestId,
        priority
      });

      // 缓存结果
      if (useCache && this.shouldCache(functionName, data)) {
        await this.cacheResult(finalCacheKey, result);
      }

      // 记录性能指标
      const duration = Date.now() - startTime;
      this.recordPerformanceMetrics(functionName, duration, 'success');

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.recordPerformanceMetrics(functionName, duration, 'error');

      logger.error(`Cloud function call failed: ${functionName}`, error);
      throw error;
    }
  }

  /**
   * 执行云函数调用
   * @private
   */
  executeCall(functionName, data, options) {
    return new Promise((resolve, reject) => {
      const requestTask = {
        functionName,
        data,
        resolve,
        reject,
        ...options
      };

      if (this.currentRequests >= this.concurrencyLimit) {
        this.requestQueue.push(requestTask);
        this.requestQueue.sort((a, b) => {
          const priorityOrder = { high: 3, normal: 2, low: 1 };
          return priorityOrder[b.priority] - priorityOrder[a.priority];
        });
      } else {
        this.processRequest(requestTask);
      }
    });
  }

  /**
   * 处理请求
   * @private
   */
  async processRequest(requestTask) {
    this.currentRequests++;
    const { functionName, data, resolve, reject, timeout, retry, retryCount } = requestTask;

    try {
      const result = await this.performCloudCall(functionName, data, timeout);
      resolve(result);
    } catch (error) {
      if (retry && retryCount > 0) {
        await this.retryRequest(requestTask, retryCount - 1);
      } else {
        reject(error);
      }
    } finally {
      this.currentRequests--;
      this.processNextRequest();
    }
  }

  /**
   * 执行实际的云函数调用
   * @private
   */
  performCloudCall(functionName, data, timeout) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();

      wx.cloud.callFunction({
        name: functionName,
        data,
        timeout,
        success: (res) => {
          const duration = Date.now() - startTime;
          logger.debug(`Cloud function call success: ${functionName} (${duration}ms)`, res);
          resolve(res.result);
        },
        fail: (error) => {
          const duration = Date.now() - startTime;
          logger.error(`Cloud function call failed: ${functionName} (${duration}ms)`, error);
          reject(error);
        }
      });
    });
  }

  /**
   * 重试请求
   * @private
   */
  async retryRequest(requestTask, remainingRetries) {
    const delay = (4 - remainingRetries) * 1000; // 指数退避

    await this.sleep(delay);
    requestTask.retryCount = remainingRetries;

    try {
      const result = await this.performCloudCall(
        requestTask.functionName,
        requestTask.data,
        requestTask.timeout
      );
      requestTask.resolve(result);
    } catch (error) {
      if (remainingRetries > 0) {
        await this.retryRequest(requestTask, remainingRetries - 1);
      } else {
        requestTask.reject(error);
      }
    }
  }

  /**
   * 添加到批处理队列
   * @private
   */
  addToBatchQueue(functionName, data, options) {
    return new Promise((resolve, reject) => {
      const batchId = this.generateBatchId();

      if (!this.batchQueue.has(batchId)) {
        this.batchQueue.set(batchId, {
          items: [],
          resolve: null,
          reject: null
        });
      }

      const batch = this.batchQueue.get(batchId);
      batch.items.push({
        functionName,
        data,
        resolve,
        reject,
        ...options
      });

      // 立即解析Promise，实际结果在批处理完成后返回
      resolve({ batchId, status: 'processing' });
    });
  }

  /**
   * 处理批处理队列
   * @private
   */
  async processBatchQueue() {
    // 这里可以添加具体的批处理逻辑
    // 暂时简化处理
  }

  /**
   * 验证调用数据
   * @private
   */
  validateCallData(functionName, data) {
    // 检查云函数名称
    if (!functionName || typeof functionName !== 'string') {
      throw new Error('Invalid function name');
    }

    // 检查数据格式
    if (data && typeof data !== 'object') {
      throw new Error('Invalid data format');
    }
  }

  /**
   * 生成请求ID
   * @private
   */
  generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 生成批次ID
   * @private
   */
  generateBatchId() {
    return `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 生成缓存键
   * @private
   */
  generateCacheKey(functionName, data) {
    return `cloud_${functionName}_${JSON.stringify(data)}`;
  }

  /**
   * 检查是否应该缓存
   * @private
   */
  shouldCache(functionName, data) {
    const noCacheFunctions = ['login', 'upload', 'delete'];
    return !noCacheFunctions.some(fn => functionName.includes(fn));
  }

  /**
   * 获取缓存结果
   * @private
   */
  async getCachedResult(cacheKey) {
    return this.requestCache.get(cacheKey);
  }

  /**
   * 缓存结果
   * @private
   */
  async cacheResult(cacheKey, result) {
    try {
      await this.requestCache.set(cacheKey, result);
    } catch (error) {
      logger.warn('Failed to cache cloud function result:', error);
    }
  }

  /**
   * 记录性能指标
   * @private
   */
  recordPerformanceMetrics(functionName, duration, status) {
    performanceMonitor.recordMetric(`cloud_${functionName}_duration`, duration);
    performanceMonitor.recordMetric(`cloud_${functionName}_status`, status === 'success' ? 1 : 0);

    if (duration > 5000) {
      logger.warn(`Slow cloud function call: ${functionName} took ${duration}ms`);
    }
  }

  /**
   * 处理下一个请求
   * @private
   */
  processNextRequest() {
    if (this.requestQueue.length > 0 && this.currentRequests < this.concurrencyLimit) {
      const nextRequest = this.requestQueue.shift();
      this.processRequest(nextRequest);
    }
  }

  /**
   * 延迟函数
   * @private
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 清理缓存
   */
  clearCache() {
    this.requestCache.clear();
  }

  /**
   * 获取性能统计
   */
  getPerformanceStats() {
    return {
      activeRequests: this.currentRequests,
      queueLength: this.requestQueue.length,
      cacheSize: this.requestCache.getSize(),
      batchQueueSize: this.batchQueue.size
    };
  }
}

class DatabaseOptimizer {
  constructor() {
    this.queryCache = new CacheManager({ ttl: 10 * 60 * 1000 }); // 10分钟缓存
    this.queryQueue = new Map();
    this.connectionPool = new Map();
    this.statistics = {
      totalQueries: 0,
      cacheHits: 0,
      cacheMisses: 0,
      slowQueries: 0
    };
  }

  /**
   * 优化的数据库查询
   * @param {string} collection - 集合名称
   * @param {object} query - 查询条件
   * @param {object} options - 查询选项
   * @returns {Promise} 查询结果
   */
  async query(collection, query = {}, options = {}) {
    const {
      useCache = false,
      cacheKey = null,
      timeout = 10000,
      limit = null,
      sort = null,
      fields = null,
      aggregate = false
    } = options;

    const startTime = Date.now();
    const queryId = this.generateQueryId();

    try {
      // 构建完整查询
      const dbQuery = this.buildQuery(query, { limit, sort, fields });

      // 生成缓存键
      const finalCacheKey = cacheKey || this.generateQueryCacheKey(collection, dbQuery);

      // 检查缓存
      if (useCache && !aggregate) {
        const cachedResult = await this.getCachedQueryResult(finalCacheKey);
        if (cachedResult) {
          this.statistics.cacheHits++;
          logger.debug(`Using cached query result for ${collection}`, { cacheKey: finalCacheKey });
          return cachedResult;
        }
        this.statistics.cacheMisses++;
      }

      // 执行查询
      const result = await this.executeQuery(collection, dbQuery, {
        timeout,
        aggregate,
        queryId
      });

      // 缓存结果
      if (useCache && this.shouldCacheQuery(collection, query)) {
        await this.cacheQueryResult(finalCacheKey, result);
      }

      // 记录统计信息
      const duration = Date.now() - startTime;
      this.recordQueryStatistics(collection, duration, 'success');

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.recordQueryStatistics(collection, duration, 'error');

      logger.error(`Database query failed: ${collection}`, error);
      throw error;
    }
  }

  /**
   * 构建查询
   * @private
   */
  buildQuery(query, options) {
    const dbQuery = { ...query };

    if (options.limit) {
      dbQuery.limit = options.limit;
    }

    if (options.sort) {
      dbQuery.orderBy = options.sort;
    }

    if (options.fields) {
      dbQuery.field = options.fields;
    }

    return dbQuery;
  }

  /**
   * 执行查询
   * @private
   */
  executeQuery(collection, query, options) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();

      const queryOptions = {
        ...query,
        success: (res) => {
          const duration = Date.now() - startTime;
          logger.debug(`Database query success: ${collection} (${duration}ms)`, res);
          resolve(res.result);
        },
        fail: (error) => {
          const duration = Date.now() - startTime;
          logger.error(`Database query failed: ${collection} (${duration}ms)`, error);
          reject(error);
        }
      };

      wx.cloud.database().collection(collection).where(queryOptions.where || {}).get(queryOptions);
    });
  }

  /**
   * 优化的批量操作
   * @param {string} collection - 集合名称
   * @param {Array} operations - 操作数组
   * @param {object} options - 选项配置
   * @returns {Promise} 操作结果
   */
  async batchOperations(collection, operations, options = {}) {
    const {
      atomic = false, // 原子操作
      validate = true,
      maxBatchSize = 100
    } = options;

    try {
      // 验证操作
      if (validate) {
        this.validateBatchOperations(operations);
      }

      // 分批处理大批量操作
      const batches = this.splitIntoBatches(operations, maxBatchSize);
      const results = [];

      for (const batch of batches) {
        const batchResult = await this.executeBatch(collection, batch, { atomic });
        results.push(...batchResult);
      }

      return results;
    } catch (error) {
      logger.error(`Batch operations failed for ${collection}:`, error);
      throw error;
    }
  }

  /**
   * 执行批量操作
   * @private
   */
  executeBatch(collection, operations, options) {
    return new Promise((resolve, reject) => {
      const db = wx.cloud.database();
      const transaction = db.startTransaction();

      try {
        const promises = operations.map(operation => {
          const { type, data, condition } = operation;

          switch (type) {
          case 'insert':
            return transaction.collection(collection).add({ data });
          case 'update':
            return transaction.collection(collection).where(condition).update({ data });
          case 'delete':
            return transaction.collection(collection).where(condition).remove();
          default:
            throw new Error(`Unknown operation type: ${type}`);
          }
        });

        Promise.all(promises).then(results => {
          if (options.atomic) {
            transaction.commit();
          }
          resolve(results);
        }).catch(error => {
          if (options.atomic) {
            transaction.rollback();
          }
          reject(error);
        });
      } catch (error) {
        if (options.atomic) {
          transaction.rollback();
        }
        reject(error);
      }
    });
  }

  /**
   * 生成查询ID
   * @private
   */
  generateQueryId() {
    return `query_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 生成查询缓存键
   * @private
   */
  generateQueryCacheKey(collection, query) {
    return `db_${collection}_${JSON.stringify(query)}`;
  }

  /**
   * 检查是否应该缓存查询
   * @private
   */
  shouldCacheQuery(collection, query) {
    const noCacheCollections = ['logs', 'sessions', 'temp'];
    const noCacheConditions = ['_openid', 'timestamp', 'updatedAt'];

    return !noCacheCollections.includes(collection) &&
           !noCacheConditions.some(condition => query[condition]);
  }

  /**
   * 获取缓存的查询结果
   * @private
   */
  async getCachedQueryResult(cacheKey) {
    return this.queryCache.get(cacheKey);
  }

  /**
   * 缓存查询结果
   * @private
   */
  async cacheQueryResult(cacheKey, result) {
    try {
      await this.queryCache.set(cacheKey, result);
    } catch (error) {
      logger.warn('Failed to cache query result:', error);
    }
  }

  /**
   * 记录查询统计信息
   * @private
   */
  recordQueryStatistics(collection, duration, status) {
    this.statistics.totalQueries++;

    if (duration > 1000) {
      this.statistics.slowQueries++;
      logger.warn(`Slow database query: ${collection} took ${duration}ms`);
    }
  }

  /**
   * 验证批量操作
   * @private
   */
  validateBatchOperations(operations) {
    if (!Array.isArray(operations)) {
      throw new Error('Operations must be an array');
    }

    operations.forEach((operation, index) => {
      if (!operation.type || !['insert', 'update', 'delete'].includes(operation.type)) {
        throw new Error(`Invalid operation type at index ${index}`);
      }

      if (!operation.data && operation.type !== 'delete') {
        throw new Error(`Missing data for operation at index ${index}`);
      }
    });
  }

  /**
   * 分割为批次
   * @private
   */
  splitIntoBatches(operations, maxBatchSize) {
    const batches = [];
    for (let i = 0; i < operations.length; i += maxBatchSize) {
      batches.push(operations.slice(i, i + maxBatchSize));
    }
    return batches;
  }

  /**
   * 获取数据库统计信息
   */
  getStatistics() {
    return {
      ...this.statistics,
      cacheHitRate: this.statistics.totalQueries > 0 ?
        (this.statistics.cacheHits / (this.statistics.cacheHits + this.statistics.cacheMisses)) * 100 : 0,
      slowQueryRate: this.statistics.totalQueries > 0 ?
        (this.statistics.slowQueries / this.statistics.totalQueries) * 100 : 0,
      cacheSize: this.queryCache.getSize()
    };
  }

  /**
   * 清理缓存
   */
  clearCache() {
    this.queryCache.clear();
    this.statistics = {
      totalQueries: 0,
      cacheHits: 0,
      cacheMisses: 0,
      slowQueries: 0
    };
  }
}

// 创建全局实例
const cloudFunctionManager = new CloudFunctionManager();
const databaseOptimizer = new DatabaseOptimizer();

module.exports = {
  cloudFunctionManager,
  databaseOptimizer,
  CloudFunctionManager,
  DatabaseOptimizer
};
