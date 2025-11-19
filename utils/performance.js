/**
 * 性能监控和优化工具
 * 提供页面性能分析、内存监控、网络优化等功能
 */

const { logger } = require('./logger');
const Constants = require('./constants');

class PerformanceMonitor {
  constructor() {
    this.metrics = new Map();
    this.observers = new Map();
    this.memoryUsage = 0;
    this.startTime = Date.now();

    this.initPerformanceObserver();
    this.startMemoryMonitoring();
  }

  /**
   * 初始化性能观察者
   * @private
   */
  initPerformanceObserver() {
    try {
      // 页面加载性能监控
      if (typeof wx.getPerformance === 'function') {
        const performance = wx.getPerformance();
        const entries = performance.getEntries();

        entries.forEach(entry => {
          this.recordMetric(`${entry.name}_load`, entry.duration);
        });
      }
    } catch (error) {
      logger.error('Performance observer initialization failed:', error);
    }
  }

  /**
   * 记录性能指标
   * @param {string} name - 指标名称
   * @param {number} value - 指标值
   * @param {object} metadata - 额外元数据
   */
  recordMetric(name, value, metadata = {}) {
    const metric = {
      value,
      timestamp: Date.now(),
      metadata,
      page: this.getCurrentPage()
    };

    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    this.metrics.get(name).push(metric);

    // 保持最近的100个指标
    const metrics = this.metrics.get(name);
    if (metrics.length > 100) {
      metrics.shift();
    }

    // 性能阈值检查
    this.checkPerformanceThreshold(name, value);
  }

  /**
   * 检查性能阈值
   * @private
   */
  checkPerformanceThreshold(name, value) {
    const thresholds = {
      'page_load': 3000, // 3秒
      'api_request': 5000, // 5秒
      'image_load': 2000, // 2秒
      'db_operation': 1000 // 1秒
    };

    const threshold = thresholds[name];
    if (threshold && value > threshold) {
      logger.warn(`Performance threshold exceeded: ${name} took ${value}ms (threshold: ${threshold}ms)`);

      // 可以在这里添加性能告警逻辑
      this.triggerPerformanceAlert(name, value, threshold);
    }
  }

  /**
   * 触发性能告警
   * @private
   */
  triggerPerformanceAlert(name, value, threshold) {
    const alert = {
      name,
      value,
      threshold,
      timestamp: Date.now(),
      page: this.getCurrentPage(),
      userAgent: wx.getSystemInfoSync()
    };

    // 存储告警信息
    this.storePerformanceAlert(alert);
  }

  /**
   * 存储性能告警
   * @private
   */
  storePerformanceAlert(alert) {
    try {
      const alerts = wx.getStorageSync('werewolf_performance_alerts') || [];
      alerts.unshift(alert);

      // 只保留最近10个告警
      if (alerts.length > 10) {
        alerts.splice(10);
      }

      wx.setStorageSync('werewolf_performance_alerts', alerts);
    } catch (error) {
      logger.error('Failed to store performance alert:', error);
    }
  }

  /**
   * 开始内存监控
   * @private
   */
  startMemoryMonitoring() {
    setInterval(() => {
      this.checkMemoryUsage();
    }, 30000); // 每30秒检查一次
  }

  /**
   * 检查内存使用情况
   * @private
   */
  checkMemoryUsage() {
    try {
      const info = wx.getSystemInfoSync();
      const usedMemory = (info.totalMemory ?
        info.totalMemory - (info.availMemory || 0) : 0);

      this.memoryUsage = usedMemory;

      // 内存使用超过500MB时告警
      if (usedMemory > 500 * 1024 * 1024) {
        logger.warn(`High memory usage detected: ${Math.round(usedMemory / 1024 / 1024)}MB`);
        this.triggerMemoryAlert(usedMemory);
      }
    } catch (error) {
      logger.error('Memory monitoring failed:', error);
    }
  }

  /**
   * 触发内存告警
   * @private
   */
  triggerMemoryAlert() {
    // 清理缓存
    this.cleanupCache();

    // 强制垃圾回收（如果支持）
    if (global && global.gc) {
      global.gc();
    }
  }

  /**
   * 清理缓存
   * @private
   */
  cleanupCache() {
    try {
      // 清理本地存储中过大的数据
      const keys = wx.getStorageInfoSync().keys;

      keys.forEach(key => {
        try {
          const data = wx.getStorageSync(key);
          const dataSize = JSON.stringify(data).length;

          // 如果数据超过1MB，尝试压缩或清理
          if (dataSize > 1024 * 1024) {
            logger.info(`Cleaning up large cache item: ${key} (${Math.round(dataSize / 1024)}KB)`);
            // 这里可以实现数据压缩逻辑
          }
        } catch (error) {
          logger.error(`Failed to process cache key ${key}:`, error);
        }
      });
    } catch (error) {
      logger.error('Cache cleanup failed:', error);
    }
  }

  /**
   * 获取当前页面
   * @private
   */
  getCurrentPage() {
    try {
      const pages = getCurrentPages();
      const currentPage = pages[pages.length - 1];
      return currentPage ? currentPage.route : 'unknown';
    } catch (error) {
      return 'unknown';
    }
  }

  /**
   * 开始性能测量
   * @param {string} label - 测量标签
   */
  startMeasure(label) {
    const measureId = `${label}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();

    return {
      end: () => {
        const duration = Date.now() - startTime;
        this.recordMetric(`${label}_duration`, duration);
        return duration;
      },
      label,
      startTime,
      id: measureId
    };
  }

  /**
   * 测量函数执行时间
   * @param {string} label - 测量标签
   * @param {Function} fn - 要测量的函数
   * @returns {any} 函数执行结果
   */
  measure(label, fn) {
    const measure = this.startMeasure(label);

    try {
      const result = fn();

      // 如果是Promise，等待完成
      if (result && typeof result.then === 'function') {
        return result.then(res => {
          measure.end();
          return res;
        }).catch(error => {
          measure.end();
          throw error;
        });
      } else {
        measure.end();
        return result;
      }
    } catch (error) {
      measure.end();
      throw error;
    }
  }

  /**
   * 获取性能报告
   * @param {string} metricName - 特定指标名称
   * @returns {object} 性能报告
   */
  getPerformanceReport(metricName = null) {
    const report = {
      timestamp: Date.now(),
      memoryUsage: this.memoryUsage,
      uptime: Date.now() - this.startTime,
      metrics: {},
      summary: {}
    };

    if (metricName) {
      const metricData = this.metrics.get(metricName);
      if (metricData) {
        report.metrics[metricName] = this.analyzeMetricData(metricData);
      }
    } else {
      // 生成所有指标的报告
      this.metrics.forEach((data, name) => {
        report.metrics[name] = this.analyzeMetricData(data);
      });
    }

    // 生成汇总统计
    this.generateSummary(report);

    return report;
  }

  /**
   * 分析指标数据
   * @private
   */
  analyzeMetricData(data) {
    if (data.length === 0) {
      return { count: 0 };
    }

    const values = data.map(item => item.value);
    const sum = values.reduce((a, b) => a + b, 0);
    const average = sum / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const last = values[values.length - 1];

    return {
      count: data.length,
      min,
      max,
      average: Math.round(average * 100) / 100,
      last,
      trend: values.length >= 2 ? (values[values.length - 1] > values[values.length - 2] ? 'increasing' : 'decreasing') : 'stable'
    };
  }

  /**
   * 生成汇总统计
   * @private
   */
  generateSummary(report) {
    const allMetrics = Object.values(report.metrics);

    if (allMetrics.length === 0) {
      report.summary = {
        totalMetrics: 0,
        averageResponseTime: 0,
        performanceScore: 100
      };
      return;
    }

    const totalMetrics = allMetrics.length;
    const averageResponseTime = allMetrics.reduce((sum, metric) => sum + (metric.average || 0), 0) / totalMetrics;

    // 计算性能评分（100分制）
    let performanceScore = 100;
    if (averageResponseTime > 1000) performanceScore -= 20;
    if (averageResponseTime > 2000) performanceScore -= 20;
    if (averageResponseTime > 3000) performanceScore -= 30;
    if (this.memoryUsage > 400 * 1024 * 1024) performanceScore -= 10;

    report.summary = {
      totalMetrics,
      averageResponseTime: Math.round(averageResponseTime),
      performanceScore: Math.max(0, performanceScore)
    };
  }

  /**
   * 清除性能数据
   * @param {string} metricName - 特定指标名称（可选）
   */
  clearMetrics(metricName = null) {
    if (metricName) {
      this.metrics.delete(metricName);
    } else {
      this.metrics.clear();
    }
    logger.info('Performance metrics cleared', { metricName });
  }
}

// 网络性能优化器
class NetworkOptimizer {
  constructor() {
    this.requestCache = new Map();
    this.requestQueue = [];
    this.maxConcurrent = 3; // 最大并发请求数
    this.currentRequests = 0;
  }

  /**
   * 优化的请求方法
   * @param {object} options - 请求配置
   * @returns {Promise} 请求结果
   */
  async request(options) {
    const cacheKey = this.generateCacheKey(options);

    // 检查缓存
    if (options.method === 'GET' && this.requestCache.has(cacheKey)) {
      const cached = this.requestCache.get(cacheKey);
      if (!this.isCacheExpired(cached)) {
        logger.debug(`Using cached response for ${options.url}`);
        return cached.data;
      }
    }

    // 添加到队列
    return this.addToQueue(options, cacheKey);
  }

  /**
   * 添加请求到队列
   * @private
   */
  addToQueue(options, cacheKey) {
    return new Promise((resolve, reject) => {
      const requestTask = {
        options,
        resolve,
        reject,
        cacheKey,
        priority: this.getRequestPriority(options)
      };

      this.requestQueue.push(requestTask);
      this.requestQueue.sort((a, b) => b.priority - a.priority);

      this.processQueue();
    });
  }

  /**
   * 处理请求队列
   * @private
   */
  async processQueue() {
    if (this.currentRequests >= this.maxConcurrent || this.requestQueue.length === 0) {
      return;
    }

    this.currentRequests++;
    const task = this.requestQueue.shift();

    try {
      const startTime = Date.now();
      const response = await this.executeRequest(task.options);
      const duration = Date.now() - startTime;

      // 缓存响应
      if (task.options.method === 'GET') {
        this.cacheResponse(task.cacheKey, response);
      }

      logger.debug(`Request completed: ${task.options.url} (${duration}ms)`);
      task.resolve(response);
    } catch (error) {
      logger.error(`Request failed: ${task.options.url}`, error);
      task.reject(error);
    } finally {
      this.currentRequests--;
      this.processQueue(); // 继续处理队列
    }
  }

  /**
   * 执行实际请求
   * @private
   */
  executeRequest(options) {
    return new Promise((resolve, reject) => {
      const requestOptions = {
        timeout: Constants.NETWORK.TIMEOUT,
        ...options,
        success: resolve,
        fail: reject
      };

      wx.request(requestOptions);
    });
  }

  /**
   * 获取请求优先级
   * @private
   */
  getRequestPriority(options) {
    if (options.priority === 'high') return 3;
    if (options.priority === 'medium') return 2;
    return 1;
  }

  /**
   * 生成缓存键
   * @private
   */
  generateCacheKey(options) {
    return `${options.method}_${options.url}_${JSON.stringify(options.data || {})}`;
  }

  /**
   * 缓存响应
   * @private
   */
  cacheResponse(key, response) {
    this.requestCache.set(key, {
      data: response,
      timestamp: Date.now(),
      ttl: 5 * 60 * 1000 // 5分钟缓存
    });
  }

  /**
   * 检查缓存是否过期
   * @private
   */
  isCacheExpired(cached) {
    return Date.now() - cached.timestamp > cached.ttl;
  }

  /**
   * 清除请求缓存
   */
  clearCache() {
    this.requestCache.clear();
  }
}

// 创建全局实例
const performanceMonitor = new PerformanceMonitor();
const networkOptimizer = new NetworkOptimizer();

module.exports = {
  performanceMonitor,
  networkOptimizer,
  PerformanceMonitor,
  NetworkOptimizer
};
