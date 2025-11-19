// 性能管理器 - 优化性能和内存使用
const { logger } = require('./logger');
const { getCacheManager } = require('./cacheManager');
const { getDatabaseManager } = require('./databaseManager');

class PerformanceManager {
  constructor() {
    // 性能配置
    this.config = {
      enableMonitoring: true,
      enableOptimization: true,
      enableReporting: true,
      monitoringInterval: 5000, // 5秒
      performanceThresholds: {
        memory: 100 * 1024 * 1024, // 100MB
        executionTime: 1000, // 1秒
        cacheHitRate: 0.8, // 80%
        errorRate: 0.05 // 5%
      },
      optimizationStrategies: {
        enableMemoryOptimization: true,
        enableCacheOptimization: true,
        enableCodeOptimization: true,
        enableNetworkOptimization: true
      }
    };
    
    // 性能指标
    this.metrics = {
      memory: {
        used: 0,
        peak: 0,
        limit: 0,
        warnings: 0
      },
      execution: {
        totalExecutions: 0,
        averageTime: 0,
        peakTime: 0,
        slowExecutions: 0
      },
      cache: {
        hits: 0,
        misses: 0,
        hitRate: 0,
        evictions: 0
      },
      network: {
        requests: 0,
        failures: 0,
        averageResponseTime: 0,
        bandwidth: 0
      },
      errors: {
        total: 0,
        rate: 0,
        byType: new Map()
      }
    };
    
    // 性能监控
    this.performanceMonitor = null;
    this.monitoringTimer = null;
    this.performanceHistory = [];
    this.executionHistory = [];
    
    // 内存管理
    this.memoryManager = {
      gcRuns: 0,
      memoryLeaks: [],
      allocatedObjects: new Map(),
      objectPools: new Map()
    };
    
    // 缓存管理
    this.cacheManager = getCacheManager();
    this.databaseManager = getDatabaseManager();
    
    // 优化策略
    this.optimizationStrategies = new Map();
    
    // 初始化
    this.initialize();
  }

  // 初始化性能管理器
  initialize() {
    logger.info('开始初始化性能管理器');
    
    try {
      // 注册默认优化策略
      this.registerDefaultOptimizationStrategies();
      
      // 设置性能监控
      this.setupPerformanceMonitoring();
      
      // 设置内存管理
      this.setupMemoryManagement();
      
      // 开始性能监控
      this.startMonitoring();
      
      logger.info('性能管理器初始化成功');
      
    } catch (error) {
      logger.error('性能管理器初始化失败', error);
      throw error;
    }
  }

  // 注册默认优化策略
  registerDefaultOptimizationStrategies() {
    // 内存优化策略
    this.registerOptimizationStrategy('memory', {
      name: '内存优化',
      description: '优化内存使用，防止内存泄漏',
      enabled: true,
      execute: this.optimizeMemory.bind(this),
      threshold: 0.8, // 当内存使用率达到80%时触发
      interval: 30000 // 每30秒检查一次
    });
    
    // 缓存优化策略
    this.registerOptimizationStrategy('cache', {
      name: '缓存优化',
      description: '优化缓存命中率，清理过期缓存',
      enabled: true,
      execute: this.optimizeCache.bind(this),
      threshold: 0.6, // 当缓存命中率低于60%时触发
      interval: 60000 // 每60秒检查一次
    });
    
    // 执行优化策略
    this.registerOptimizationStrategy('execution', {
      name: '执行优化',
      description: '优化代码执行效率，减少慢查询',
      enabled: true,
      execute: this.optimizeExecution.bind(this),
      threshold: 0.1, // 当慢查询比例超过10%时触发
      interval: 45000 // 每45秒检查一次
    });
    
    // 网络优化策略
    this.registerOptimizationStrategy('network', {
      name: '网络优化',
      description: '优化网络请求，减少失败率',
      enabled: true,
      execute: this.optimizeNetwork.bind(this),
      threshold: 0.05, // 当网络失败率超过5%时触发
      interval: 120000 // 每120秒检查一次
    });
    
    // 错误优化策略
    this.registerOptimizationStrategy('error', {
      name: '错误优化',
      description: '优化错误处理，减少错误率',
      enabled: true,
      execute: this.optimizeErrors.bind(this),
      threshold: 0.03, // 当错误率超过3%时触发
      interval: 90000 // 每90秒检查一次
    });
  }

  // 设置性能监控
  setupPerformanceMonitoring() {
    if (!this.config.enableMonitoring) {
      return;
    }
    
    // 使用 Performance API 进行监控
    if (typeof performance !== 'undefined') {
      this.performanceMonitor = {
        mark: performance.mark.bind(performance),
        measure: performance.measure.bind(performance),
        now: performance.now.bind(performance),
        getEntries: performance.getEntries.bind(performance),
        clearMarks: performance.clearMarks.bind(performance),
        clearMeasures: performance.clearMeasures.bind(performance)
      };
    }
  }

  // 设置内存管理
  setupMemoryManagement() {
    if (!this.config.optimizationStrategies.enableMemoryOptimization) {
      return;
    }
    
    // 模拟内存监控（实际环境中需要更复杂的实现）
    this.startMemoryMonitoring();
  }

  // 开始性能监控
  startMonitoring() {
    if (!this.config.enableMonitoring) {
      return;
    }
    
    this.monitoringTimer = setInterval(() => {
      this.collectPerformanceMetrics();
      this.analyzePerformance();
      this.applyOptimizations();
    }, this.config.monitoringInterval);
    
    logger.info(`性能监控已启动，间隔: ${this.config.monitoringInterval}ms`);
  }

  // 收集性能指标
  collectPerformanceMetrics() {
    try {
      // 收集内存指标
      this.collectMemoryMetrics();
      
      // 收集执行指标
      this.collectExecutionMetrics();
      
      // 收集缓存指标
      this.collectCacheMetrics();
      
      // 收集网络指标
      this.collectNetworkMetrics();
      
      // 收集错误指标
      this.collectErrorMetrics();
      
      // 记录历史数据
      this.recordPerformanceHistory();
      
    } catch (error) {
      logger.error('收集性能指标失败', error);
    }
  }

  // 收集内存指标
  collectMemoryMetrics() {
    try {
      if (typeof performance !== 'undefined' && performance.memory) {
        const memoryInfo = performance.memory;
        
        this.metrics.memory.used = memoryInfo.usedJSHeapSize;
        this.metrics.memory.limit = memoryInfo.jsHeapSizeLimit;
        
        // 更新峰值内存
        if (memoryInfo.usedJSHeapSize > this.metrics.memory.peak) {
          this.metrics.memory.peak = memoryInfo.usedJSHeapSize;
        }
        
        // 检查内存警告
        const memoryUsageRate = memoryInfo.usedJSHeapSize / memoryInfo.jsHeapSizeLimit;
        if (memoryUsageRate > 0.8) {
          this.metrics.memory.warnings++;
          logger.warn('内存使用率过高', { 
            usage: `${(memoryUsageRate * 100).toFixed(2)}%`,
            used: this.formatBytes(memoryInfo.usedJSHeapSize),
            limit: this.formatBytes(memoryInfo.jsHeapSizeLimit)
          });
        }
      }
      
    } catch (error) {
      logger.error('收集内存指标失败', error);
    }
  }

  // 收集执行指标
  collectExecutionMetrics() {
    try {
      // 计算平均执行时间
      if (this.executionHistory.length > 0) {
        const totalTime = this.executionHistory.reduce((sum, exec) => sum + exec.duration, 0);
        this.metrics.execution.averageTime = totalTime / this.executionHistory.length;
        
        // 更新峰值执行时间
        const peakTime = Math.max(...this.executionHistory.map(exec => exec.duration));
        if (peakTime > this.metrics.execution.peakTime) {
          this.metrics.execution.peakTime = peakTime;
        }
        
        // 统计慢执行
        this.metrics.execution.slowExecutions = this.executionHistory.filter(
          exec => exec.duration > this.config.performanceThresholds.executionTime
        ).length;
      }
      
    } catch (error) {
      logger.error('收集执行指标失败', error);
    }
  }

  // 收集缓存指标
  collectCacheMetrics() {
    try {
      const cacheStats = this.cacheManager.getStats();
      
      this.metrics.cache.hits = cacheStats.hits;
      this.metrics.cache.misses = cacheStats.misses;
      this.metrics.cache.hitRate = cacheStats.hitRate;
      this.metrics.cache.evictions = cacheStats.evictions;
      
    } catch (error) {
      logger.error('收集缓存指标失败', error);
    }
  }

  // 收集网络指标
  collectNetworkMetrics() {
    try {
      // 这里可以集成网络监控库或自定义实现
      // 目前使用模拟数据
      
    } catch (error) {
      logger.error('收集网络指标失败', error);
    }
  }

  // 收集错误指标
  collectErrorMetrics() {
    try {
      // 这里可以集成错误管理器
      // 目前使用模拟数据
      
    } catch (error) {
      logger.error('收集错误指标失败', error);
    }
  }

  // 记录性能历史
  recordPerformanceHistory() {
    try {
      const timestamp = Date.now();
      const performanceSnapshot = {
        timestamp,
        memory: { ...this.metrics.memory },
        execution: { ...this.metrics.execution },
        cache: { ...this.metrics.cache },
        network: { ...this.metrics.network },
        errors: { ...this.metrics.errors }
      };
      
      this.performanceHistory.push(performanceSnapshot);
      
      // 限制历史记录大小（保留最近100条）
      if (this.performanceHistory.length > 100) {
        this.performanceHistory = this.performanceHistory.slice(-100);
      }
      
    } catch (error) {
      logger.error('记录性能历史失败', error);
    }
  }

  // 分析性能
  analyzePerformance() {
    try {
      // 检查性能阈值
      this.checkPerformanceThresholds();
      
      // 生成性能报告
      this.generatePerformanceReport();
      
      // 预测性能趋势
      this.predictPerformanceTrends();
      
    } catch (error) {
      logger.error('分析性能失败', error);
    }
  }

  // 检查性能阈值
  checkPerformanceThresholds() {
    const alerts = [];
    
    // 检查内存使用率
    const memoryUsageRate = this.metrics.memory.used / this.metrics.memory.limit;
    if (memoryUsageRate > this.config.performanceThresholds.memory) {
      alerts.push({
        type: 'memory',
        severity: 'warning',
        message: '内存使用率过高',
        value: memoryUsageRate,
        threshold: this.config.performanceThresholds.memory
      });
    }
    
    // 检查执行时间
    if (this.metrics.execution.averageTime > this.config.performanceThresholds.executionTime) {
      alerts.push({
        type: 'execution',
        severity: 'warning',
        message: '平均执行时间过长',
        value: this.metrics.execution.averageTime,
        threshold: this.config.performanceThresholds.executionTime
      });
    }
    
    // 检查缓存命中率
    if (this.metrics.cache.hitRate < this.config.performanceThresholds.cacheHitRate) {
      alerts.push({
        type: 'cache',
        severity: 'info',
        message: '缓存命中率过低',
        value: this.metrics.cache.hitRate,
        threshold: this.config.performanceThresholds.cacheHitRate
      });
    }
    
    // 记录警告
    if (alerts.length > 0) {
      logger.warn('性能警告', { alerts });
    }
  }

  // 生成性能报告
  generatePerformanceReport() {
    if (!this.config.enableReporting) {
      return;
    }
    
    try {
      const report = {
        timestamp: new Date().toISOString(),
        metrics: { ...this.metrics },
        alerts: this.getPerformanceAlerts(),
        recommendations: this.generateRecommendations()
      };
      
      logger.info('性能报告', report);
      
    } catch (error) {
      logger.error('生成性能报告失败', error);
    }
  }

  // 预测性能趋势
  predictPerformanceTrends() {
    try {
      if (this.performanceHistory.length < 10) {
        return; // 数据不足，无法预测
      }
      
      // 简单的线性趋势预测
      const recentData = this.performanceHistory.slice(-10);
      const memoryTrend = this.calculateTrend(recentData.map(d => d.memory.used));
      const executionTrend = this.calculateTrend(recentData.map(d => d.execution.averageTime));
      
      if (memoryTrend > 0.1) {
        logger.warn('内存使用呈上升趋势，可能需要优化');
      }
      
      if (executionTrend > 0.1) {
        logger.warn('执行时间呈上升趋势，可能需要优化');
      }
      
    } catch (error) {
      logger.error('预测性能趋势失败', error);
    }
  }

  // 计算趋势
  calculateTrend(values) {
    if (values.length < 2) return 0;
    
    const n = values.length;
    const sumX = values.reduce((sum, _, index) => sum + index, 0);
    const sumY = values.reduce((sum, value) => sum + value, 0);
    const sumXY = values.reduce((sum, value, index) => sum + index * value, 0);
    const sumXX = values.reduce((sum, _, index) => sum + index * index, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    return slope;
  }

  // 应用优化
  applyOptimizations() {
    if (!this.config.enableOptimization) {
      return;
    }
    
    try {
      for (const [strategyName, strategy] of this.optimizationStrategies) {
        if (!strategy.enabled) {
          continue;
        }
        
        // 检查是否需要执行优化
        if (this.shouldApplyOptimization(strategy)) {
          logger.info(`应用优化策略: ${strategy.name}`);
          
          try {
            strategy.execute();
            
          } catch (optimizationError) {
            logger.error(`优化策略 ${strategyName} 执行失败`, optimizationError);
          }
        }
      }
      
    } catch (error) {
      logger.error('应用优化失败', error);
    }
  }

  // 检查是否应该应用优化
  shouldApplyOptimization(strategy) {
    try {
      // 检查阈值
      switch (strategy.name) {
        case '内存优化':
          const memoryUsageRate = this.metrics.memory.used / this.metrics.memory.limit;
          return memoryUsageRate > strategy.threshold;
          
        case '缓存优化':
          return this.metrics.cache.hitRate < strategy.threshold;
          
        case '执行优化':
          const slowExecutionRate = this.metrics.execution.slowExecutions / this.metrics.execution.totalExecutions;
          return slowExecutionRate > strategy.threshold;
          
        case '网络优化':
          const networkFailureRate = this.metrics.network.failures / this.metrics.network.requests;
          return networkFailureRate > strategy.threshold;
          
        case '错误优化':
          return this.metrics.errors.rate > strategy.threshold;
          
        default:
          return false;
      }
      
    } catch (error) {
      logger.error('检查优化条件失败', error);
      return false;
    }
  }

  // 内存优化
  optimizeMemory() {
    try {
      logger.info('开始内存优化');
      
      // 执行垃圾回收（如果可用）
      if (typeof gc === 'function') {
        gc();
        this.memoryManager.gcRuns++;
        logger.info('手动垃圾回收完成');
      }
      
      // 清理缓存
      this.cacheManager.cleanup();
      
      // 清理对象池
      this.cleanupObjectPools();
      
      // 清理执行历史
      if (this.executionHistory.length > 50) {
        this.executionHistory = this.executionHistory.slice(-50);
      }
      
      logger.info('内存优化完成');
      
    } catch (error) {
      logger.error('内存优化失败', error);
    }
  }

  // 缓存优化
  optimizeCache() {
    try {
      logger.info('开始缓存优化');
      
      // 清理过期缓存
      this.cacheManager.cleanup();
      
      // 预加载常用数据
      this.preloadCommonData();
      
      logger.info('缓存优化完成');
      
    } catch (error) {
      logger.error('缓存优化失败', error);
    }
  }

  // 执行优化
  optimizeExecution() {
    try {
      logger.info('开始执行优化');
      
      // 分析慢执行
      const slowExecutions = this.executionHistory.filter(
        exec => exec.duration > this.config.performanceThresholds.executionTime
      );
      
      if (slowExecutions.length > 0) {
        logger.warn(`发现 ${slowExecutions.length} 个慢执行`, {
          averageDuration: slowExecutions.reduce((sum, exec) => sum + exec.duration, 0) / slowExecutions.length
        });
      }
      
      logger.info('执行优化完成');
      
    } catch (error) {
      logger.error('执行优化失败', error);
    }
  }

  // 网络优化
  optimizeNetwork() {
    try {
      logger.info('开始网络优化');
      
      // 这里可以实现具体的网络优化策略
      // 如：连接池优化、请求合并、缓存策略等
      
      logger.info('网络优化完成');
      
    } catch (error) {
      logger.error('网络优化失败', error);
    }
  }

  // 错误优化
  optimizeErrors() {
    try {
      logger.info('开始错误优化');
      
      // 分析错误模式
      this.analyzeErrorPatterns();
      
      // 改进错误处理
      this.improveErrorHandling();
      
      logger.info('错误优化完成');
      
    } catch (error) {
      logger.error('错误优化失败', error);
    }
  }

  // 开始内存监控
  startMemoryMonitoring() {
    setInterval(() => {
      this.collectMemoryMetrics();
    }, 10000); // 每10秒检查一次
  }

  // 清理对象池
  cleanupObjectPools() {
    try {
      for (const [poolName, pool] of this.memoryManager.objectPools) {
        if (pool.size > 100) {
          // 清理超过100个对象的对象池
          const objectsToRemove = Array.from(pool).slice(100);
          objectsToRemove.forEach(obj => pool.delete(obj));
          
          logger.debug(`清理对象池 ${poolName}，移除 ${objectsToRemove.length} 个对象`);
        }
      }
      
    } catch (error) {
      logger.error('清理对象池失败', error);
    }
  }

  // 预加载常用数据
  preloadCommonData() {
    try {
      // 这里可以实现常用数据的预加载逻辑
      // 如：用户配置、系统设置、常用列表等
      
    } catch (error) {
      logger.error('预加载常用数据失败', error);
    }
  }

  // 分析错误模式
  analyzeErrorPatterns() {
    try {
      // 这里可以实现错误模式分析逻辑
      // 如：频率分析、类型分析、时间分析等
      
    } catch (error) {
      logger.error('分析错误模式失败', error);
    }
  }

  // 改进错误处理
  improveErrorHandling() {
    try {
      // 这里可以实现错误处理改进逻辑
      // 如：重试策略优化、回退机制改进等
      
    } catch (error) {
      logger.error('改进错误处理失败', error);
    }
  }

  // 获取性能警告
  getPerformanceAlerts() {
    const alerts = [];
    
    // 内存警告
    const memoryUsageRate = this.metrics.memory.used / this.metrics.memory.limit;
    if (memoryUsageRate > 0.8) {
      alerts.push({
        type: 'memory',
        level: 'warning',
        message: `内存使用率过高: ${(memoryUsageRate * 100).toFixed(2)}%`
      });
    }
    
    // 执行时间警告
    if (this.metrics.execution.averageTime > 1000) {
      alerts.push({
        type: 'execution',
        level: 'warning',
        message: `平均执行时间过长: ${this.metrics.execution.averageTime.toFixed(2)}ms`
      });
    }
    
    // 缓存命中率警告
    if (this.metrics.cache.hitRate < 0.6) {
      alerts.push({
        type: 'cache',
        level: 'info',
        message: `缓存命中率过低: ${(this.metrics.cache.hitRate * 100).toFixed(2)}%`
      });
    }
    
    return alerts;
  }

  // 生成优化建议
  generateRecommendations() {
    const recommendations = [];
    
    // 内存优化建议
    const memoryUsageRate = this.metrics.memory.used / this.metrics.memory.limit;
    if (memoryUsageRate > 0.7) {
      recommendations.push({
        type: 'memory',
        priority: 'high',
        suggestion: '考虑清理缓存和优化内存使用'
      });
    }
    
    // 缓存优化建议
    if (this.metrics.cache.hitRate < 0.7) {
      recommendations.push({
        type: 'cache',
        priority: 'medium',
        suggestion: '考虑增加缓存大小或优化缓存策略'
      });
    }
    
    // 执行优化建议
    if (this.metrics.execution.slowExecutions > 0) {
      recommendations.push({
        type: 'execution',
        priority: 'high',
        suggestion: '分析慢执行并优化相关代码'
      });
    }
    
    return recommendations;
  }

  // 注册优化策略
  registerOptimizationStrategy(name, strategy) {
    this.optimizationStrategies.set(name, strategy);
    logger.info(`注册优化策略: ${strategy.name}`);
  }

  // 工具函数
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // 获取性能统计
  getPerformanceStats() {
    return {
      ...this.metrics,
      historySize: this.performanceHistory.length,
      strategies: this.optimizationStrategies.size,
      isMonitoring: this.monitoringTimer !== null
    };
  }

  // 健康检查
  async healthCheck() {
    const checks = {
      timestamp: new Date().toISOString(),
      monitoring: this.monitoringTimer !== null,
      memory: {
        usage: this.formatBytes(this.metrics.memory.used),
        peak: this.formatBytes(this.metrics.memory.peak),
        warnings: this.metrics.memory.warnings
      },
      execution: {
        averageTime: `${this.metrics.execution.averageTime.toFixed(2)}ms`,
        peakTime: `${this.metrics.execution.peakTime.toFixed(2)}ms`,
        slowExecutions: this.metrics.execution.slowExecutions
      },
      cache: {
        hitRate: `${(this.metrics.cache.hitRate * 100).toFixed(2)}%`,
        evictions: this.metrics.cache.evictions
      },
      alerts: this.getPerformanceAlerts().length
    };
    
    // 根据内存使用情况判断健康状态
    const memoryUsageRate = this.metrics.memory.used / this.metrics.memory.limit;
    if (memoryUsageRate > 0.9) {
      checks.overall = 'unhealthy';
    } else if (memoryUsageRate > 0.7) {
      checks.overall = 'warning';
    } else {
      checks.overall = 'healthy';
    }
    
    return checks;
  }

  // 清理资源
  async cleanup() {
    logger.info('开始清理性能管理器资源');
    
    // 停止监控
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
      this.monitoringTimer = null;
    }
    
    // 清理历史记录
    this.performanceHistory = [];
    this.executionHistory = [];
    
    // 清理对象池
    this.memoryManager.objectPools.clear();
    this.memoryManager.allocatedObjects.clear();
    
    logger.info('性能管理器资源清理完成');
  }
}

// 单例模式
let performanceManager = null;

function getPerformanceManager() {
  if (!performanceManager) {
    performanceManager = new PerformanceManager();
  }
  return performanceManager;
}

module.exports = {
  PerformanceManager,
  getPerformanceManager
};