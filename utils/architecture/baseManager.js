const { logger, errorHandler, performanceMonitor } = require('./logger');
const { getCacheManager } = require('./cacheManager');

// 基础管理器类 - 提供通用的CRUD操作和错误处理
class BaseManager {
  constructor(tableName, primaryKey = 'id') {
    this.tableName = tableName;
    this.primaryKey = primaryKey;
    this.cacheManager = getCacheManager();
    this.cache = new Map(); // 实例缓存
    this.cacheTimeout = 5 * 60 * 1000; // 默认5分钟
    this.isCloudConnected = false;
    this.errorCount = 0;
    this.maxErrors = 10;
    this.lastError = null;
    this.performanceMetrics = {
      operations: 0,
      averageTime: 0,
      errors: 0
    };
  }

  // 查询记录 - 支持缓存和性能监控
  async query(conditions = {}, options = {}) {
    const startTime = Date.now();
    const operation = '查询记录';
    
    try {
      logger.info(`${this.tableName} - ${operation}`, { conditions, options });
      
      // 生成缓存键
      const cacheKey = this.generateCacheKey('query', { conditions, options });
      
      // 检查缓存
      if (!options.skipCache) {
        const cached = this.cacheManager.get(cacheKey);
        if (cached) {
          logger.debug(`${this.tableName} - 命中缓存`, { cacheKey });
          return cached;
        }
      }

      let result;
      
      if (this.isCloudConnected && !options.skipCloud) {
        // 云端查询
        result = await this.cloudQuery(conditions, options);
      } else {
        // 本地查询
        result = await this.localQuery(conditions, options);
      }

      // 缓存结果
      if (result && !options.skipCache) {
        this.cacheManager.set(cacheKey, result, options.cacheTTL);
      }

      const duration = Date.now() - startTime;
      this.recordPerformance(duration);
      
      return this.handleSuccess(operation, result);
      
    } catch (error) {
      const duration = Date.now() - startTime;
      this.recordPerformance(duration);
      throw this.handleError(error, operation);
    }
  }

  // 云端查询
  async cloudQuery(conditions, options) {
    try {
      const cloudResult = await wx.cloud.callFunction({
        name: 'database',
        data: {
          operation: 'query',
          table: this.tableName,
          conditions: conditions,
          options: options
        }
      });

      if (cloudResult.result && cloudResult.result.success) {
        return cloudResult.result.data;
      } else {
        throw new Error(cloudResult.result?.message || '云端查询失败');
      }
    } catch (error) {
      logger.warn(`${this.tableName} - 云端查询失败，回退到本地`, { error: error.message });
      return await this.localQuery(conditions, options);
    }
  }

  // 本地查询
  async localQuery(conditions, options) {
    try {
      const db = await this.getDatabase();
      let query = db.collection(this.tableName);
      
      // 构建查询条件
      if (conditions.where) {
        query = query.where(conditions.where);
      }
      
      // 排序
      if (conditions.orderBy) {
        const { field, order } = conditions.orderBy;
        query = query.orderBy(field, order || 'asc');
      }
      
      // 限制数量
      if (conditions.limit) {
        query = query.limit(conditions.limit);
      }
      
      // 跳过数量
      if (conditions.skip) {
        query = query.skip(conditions.skip);
      }
      
      // 执行查询
      const result = await new Promise((resolve, reject) => {
        query.get({
          success: resolve,
          fail: reject
        });
      });
      
      return result.data || [];
    } catch (error) {
      throw new Error(`本地查询失败: ${error.message}`);
    }
  }

  // 初始化云函数状态
  initCloudStatus(isConnected) {
    this.isCloudConnected = isConnected;
    logger.info(`${this.tableName}管理器云函数状态: ${isConnected ? '已连接' : '未连接'}`);
  }

  // 错误处理
  handleError(error, context) {
    this.errorCount++;
    this.lastError = error;
    this.performanceMetrics.errors++;
    
    const errorInfo = {
      message: error.message,
      stack: error.stack,
      context: context,
      tableName: this.tableName,
      errorCount: this.errorCount,
      timestamp: new Date().toISOString()
    };

    logger.error(`${this.tableName}管理器错误`, errorInfo);

    // 如果错误次数过多，触发熔断机制
    if (this.errorCount >= this.maxErrors) {
      logger.warn(`${this.tableName}管理器错误次数过多，触发熔断保护`);
      throw new Error(`${this.tableName}服务暂时不可用，请稍后重试`);
    }

    return errorInfo;
  }

  // 成功处理
  handleSuccess(operation, data) {
    // 重置错误计数
    this.errorCount = 0;
    this.lastError = null;
    
    logger.info(`${this.tableName}管理器${operation}成功`, {
      operation,
      tableName: this.tableName,
      dataSize: data ? JSON.stringify(data).length : 0
    });

    return data;
  }

  // 性能监控
  recordPerformance(duration) {
    this.performanceMetrics.operations++;
    const totalTime = this.performanceMetrics.averageTime * (this.performanceMetrics.operations - 1) + duration;
    this.performanceMetrics.averageTime = totalTime / this.performanceMetrics.operations;
  }

  // 获取性能统计
  getPerformanceStats() {
    return {
      ...this.performanceMetrics,
      errorRate: this.performanceMetrics.operations > 0 
        ? (this.performanceMetrics.errors / this.performanceMetrics.operations * 100).toFixed(2) + '%'
        : '0%'
    };
  }

  // 缓存管理
  setCache(key, data, timeout = this.cacheTimeout) {
    const cacheItem = {
      data,
      timestamp: Date.now(),
      timeout
    };
    this.cache.set(key, cacheItem);
    
    // 设置自动过期
    setTimeout(() => {
      this.cache.delete(key);
    }, timeout);
  }

  getCache(key) {
    const cacheItem = this.cache.get(key);
    if (!cacheItem) return null;

    // 检查是否过期
    if (Date.now() - cacheItem.timestamp > cacheItem.timeout) {
      this.cache.delete(key);
      return null;
    }

    return cacheItem.data;
  }

  clearCache() {
    this.cache.clear();
  }

  // 数据验证
  validateData(data, schema) {
    const errors = [];
    
    for (const [field, rules] of Object.entries(schema)) {
      const value = data[field];
      
      if (rules.required && (value === undefined || value === null || value === '')) {
        errors.push(`${field} 是必填项`);
        continue;
      }

      if (value !== undefined && value !== null) {
        // 类型检查
        if (rules.type && !this.checkType(value, rules.type)) {
          errors.push(`${field} 类型应该是 ${rules.type}`);
        }

        // 长度检查
        if (rules.minLength && value.length < rules.minLength) {
          errors.push(`${field} 长度至少为 ${rules.minLength}`);
        }
        
        if (rules.maxLength && value.length > rules.maxLength) {
          errors.push(`${field} 长度不能超过 ${rules.maxLength}`);
        }

        // 范围检查
        if (rules.min && value < rules.min) {
          errors.push(`${field} 最小值为 ${rules.min}`);
        }
        
        if (rules.max && value > rules.max) {
          errors.push(`${field} 最大值为 ${rules.max}`);
        }

        // 自定义验证
        if (rules.validate && typeof rules.validate === 'function') {
          if (!rules.validate(value)) {
            errors.push(`${field} 验证失败`);
          }
        }
      }
    }

    return errors.length > 0 ? errors : null;
  }

  checkType(value, expectedType) {
    const actualType = typeof value;
    
    switch (expectedType) {
      case 'string':
        return actualType === 'string';
      case 'number':
        return actualType === 'number' && !isNaN(value);
      case 'boolean':
        return actualType === 'boolean';
      case 'array':
        return Array.isArray(value);
      case 'object':
        return actualType === 'object' && value !== null && !Array.isArray(value);
      case 'date':
        return value instanceof Date || !isNaN(Date.parse(value));
      default:
        return true;
    }
  }

  // 构建查询条件
  buildWhereClause(conditions) {
    if (!conditions || Object.keys(conditions).length === 0) {
      return { clause: '', params: [] };
    }

    const clauses = [];
    const params = [];

    for (const [key, value] of Object.entries(conditions)) {
      if (value === null || value === undefined) {
        clauses.push(`${key} IS NULL`);
      } else if (Array.isArray(value)) {
        if (value.length > 0) {
          const placeholders = value.map(() => '?').join(',');
          clauses.push(`${key} IN (${placeholders})`);
          params.push(...value);
        }
      } else if (typeof value === 'object' && value.operator) {
        // 支持复杂查询条件
        switch (value.operator) {
          case '>':
          case '>=':
          case '<':
          case '<=':
          case '!=':
            clauses.push(`${key} ${value.operator} ?`);
            params.push(value.value);
            break;
          case 'LIKE':
            clauses.push(`${key} LIKE ?`);
            params.push(`%${value.value}%`);
            break;
          case 'BETWEEN':
            clauses.push(`${key} BETWEEN ? AND ?`);
            params.push(value.start, value.end);
            break;
        }
      } else {
        clauses.push(`${key} = ?`);
        params.push(value);
      }
    }

    return {
      clause: clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '',
      params
    };
  }

  // 构建排序子句
  buildOrderClause(orderBy) {
    if (!orderBy) return '';

    if (typeof orderBy === 'string') {
      return `ORDER BY ${orderBy}`;
    }

    if (Array.isArray(orderBy)) {
      return `ORDER BY ${orderBy.join(', ')}`;
    }

    if (typeof orderBy === 'object') {
      const clauses = [];
      for (const [field, direction] of Object.entries(orderBy)) {
        clauses.push(`${field} ${direction.toUpperCase()}`);
      }
      return `ORDER BY ${clauses.join(', ')}`;
    }

    return '';
  }

  // 构建分页子句
  buildLimitClause(limit, offset = 0) {
    if (!limit) return '';
    return `LIMIT ${offset}, ${limit}`;
  }

  // 格式化返回数据
  formatResult(data, isArray = false) {
    if (!data) return null;

    if (isArray) {
      return Array.isArray(data) ? data : [data];
    }

    return Array.isArray(data) ? (data.length > 0 ? data[0] : null) : data;
  }

  // 生成缓存键
  generateCacheKey(operation, params) {
    const keyString = JSON.stringify({ operation, params });
    return `${this.tableName}:${this.hashCode(keyString)}`;
  }

  // 简单的哈希函数
  hashCode(str) {
    let hash = 0;
    if (str.length === 0) return hash;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为32位整数
    }
    return Math.abs(hash).toString(36);
  }

  // 健康检查
  async healthCheck() {
    return {
      tableName: this.tableName,
      isCloudConnected: this.isCloudConnected,
      errorCount: this.errorCount,
      lastError: this.lastError?.message,
      performance: this.getPerformanceStats(),
      cacheStats: this.cacheManager.getStats(),
      timestamp: new Date().toISOString()
    };
  }

  // 清理资源
  async cleanup() {
    logger.info(`${this.tableName}管理器开始清理资源`);
    
    // 清理实例缓存
    this.cache.clear();
    
    // 清理命名空间缓存
    this.cacheManager.clear(this.tableName);
    
    logger.info(`${this.tableName}管理器资源清理完成`);
  }

  // 获取数据库实例
  async getDatabase() {
    const { getDatabase } = require('../database');
    return await getDatabase();
  }

  // 创建记录 - 带错误处理和性能监控
  async create(data, options = {}) {
    const startTime = Date.now();
    const operation = '创建记录';
    
    try {
      logger.info(`${this.tableName} - ${operation}`, { data, options });
      
      // 数据验证
      if (!data || typeof data !== 'object') {
        throw new Error('无效的数据格式');
      }

      // 添加时间戳
      const now = new Date().toISOString();
      const recordData = {
        ...data,
        created_at: now,
        updated_at: now
      };

      let result;
      
      if (this.isCloudConnected && !options.skipCloud) {
        // 云端创建
        result = await this.cloudCreate(recordData, options);
      } else {
        // 本地创建
        result = await this.localCreate(recordData, options);
      }

      // 缓存结果
      if (result && result[this.primaryKey]) {
        this.setCache(result[this.primaryKey], result);
      }

      const duration = Date.now() - startTime;
      this.recordPerformance(duration);
      
      return this.handleSuccess(operation, result);
      
    } catch (error) {
      const duration = Date.now() - startTime;
      this.recordPerformance(duration);
      throw this.handleError(error, operation);
    }
  }

  // 云端创建
  async cloudCreate(data, options) {
    try {
      const cloudResult = await wx.cloud.callFunction({
        name: 'database',
        data: {
          operation: 'create',
          table: this.tableName,
          data: data,
          ...options
        }
      });

      if (cloudResult.result && cloudResult.result.success) {
        return cloudResult.result.data;
      } else {
        throw new Error(cloudResult.result?.message || '云端创建失败');
      }
    } catch (error) {
      logger.warn(`${this.tableName} - 云端创建失败，回退到本地`, { error: error.message });
      return await this.localCreate(data, options);
    }
  }

  // 本地创建
  async localCreate(data, options) {
    try {
      const db = await this.getDatabase();
      const result = await new Promise((resolve, reject) => {
        db.collection(this.tableName).add({
          data: data,
          success: resolve,
          fail: reject
        });
      });
      
      return {
        ...data,
        [this.primaryKey]: result._id || result.id
      };
    } catch (error) {
      throw new Error(`本地创建失败: ${error.message}`);
    }
  }

  // 性能监控
  async measurePerformance(operation, fn) {
    const startTime = Date.now();
    try {
      const result = await fn();
      const endTime = Date.now();
      const duration = endTime - startTime;

      logger.info(`${this.constructor.name}.${operation} 执行时间: ${duration}ms`);

      // 如果执行时间超过阈值，记录警告
      if (duration > 1000) { // 1秒
        logger.warn(`${this.constructor.name}.${operation} 执行时间过长: ${duration}ms`);
      }

      return result;
    } catch (error) {
      const endTime = Date.now();
      const duration = endTime - startTime;
      logger.error(`${this.constructor.name}.${operation} 执行失败 (${duration}ms):`, error);
      throw error;
    }
  }

  // 批量操作优化
  async batchOperation(items, operationFn, batchSize = 100) {
    const results = [];
    
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(item => operationFn(item).catch(error => ({ error, item })))
      );
      results.push(...batchResults);
    }

    return results;
  }

  // 连接池管理
  async withConnection(operationFn) {
    if (!this.isCloudConnected) {
      throw new Error('云数据库未连接');
    }

    try {
      return await operationFn();
    } catch (error) {
      this.handleError(error, '数据库操作');
      throw error;
    }
  }
}

module.exports = { BaseManager };