/**
 * 全局错误处理和恢复系统
 * 提供统一的错误捕获、报告和恢复机制
 */

const { logger } = require('./logger');

class GlobalErrorHandler {
  constructor() {
    this.errorHistory = [];
    this.retryQueue = new Map();
    this.recoveryStrategies = new Map();
    this.isOnline = true;

    this.initErrorHandlers();
    this.initNetworkMonitoring();
    this.registerDefaultRecoveryStrategies();
  }

  /**
   * 初始化错误处理器
   * @private
   */
  initErrorHandlers() {
    // 小程序错误事件
    wx.onError((error) => {
      this.handleAppError(error);
    });

    // 未处理的Promise拒绝
    wx.onUnhandledRejection((event) => {
      this.handleUnhandledRejection(event);
    });

    // 小程序生命周期错误
    this.setupLifecycleErrorHandling();
  }

  /**
   * 设置生命周期错误处理
   * @private
   */
  setupLifecycleErrorHandling() {
    // 重写App方法以添加错误处理
    const originalApp = App;
    // eslint-disable-next-line no-global-assign
    App = (config) => {
      const wrappedConfig = { ...config };

      // 包装生命周期方法
      const lifecycleMethods = ['onLaunch', 'onShow', 'onHide', 'onError'];
      lifecycleMethods.forEach(method => {
        if (wrappedConfig[method]) {
          const originalMethod = wrappedConfig[method];
          wrappedConfig[method] = (...args) => {
            try {
              return originalMethod.apply(wrappedConfig, args);
            } catch (error) {
              this.handleLifecycleError(method, error);
              return null;
            }
          };
        }
      });

      originalApp(wrappedConfig);
    };

    // 重写Page方法以添加错误处理
    const originalPage = Page;
    // eslint-disable-next-line no-global-assign
    Page = (config) => {
      const wrappedConfig = { ...config };

      const lifecycleMethods = ['onLoad', 'onShow', 'onReady', 'onHide', 'onUnload'];
      lifecycleMethods.forEach(method => {
        if (wrappedConfig[method]) {
          const originalMethod = wrappedConfig[method];
          wrappedConfig[method] = (...args) => {
            try {
              return originalMethod.apply(wrappedConfig, args);
            } catch (error) {
              this.handlePageError(wrappedConfig.route || wrappedConfig.__route__, method, error);
              return null;
            }
          };
        }
      });

      // 包装事件处理方法
      const eventMethods = ['onPullDownRefresh', 'onReachBottom', 'onShareAppMessage', 'onShareTimeline'];
      eventMethods.forEach(method => {
        if (wrappedConfig[method]) {
          const originalMethod = wrappedConfig[method];
          wrappedConfig[method] = async (...args) => {
            try {
              return await originalMethod.apply(wrappedConfig, args);
            } catch (error) {
              this.handleEventError(wrappedConfig.route || wrappedConfig.__route__, method, error);
              return null;
            }
          };
        }
      });

      originalPage(wrappedConfig);
    };

    // 重写Component方法以添加错误处理
    const originalComponent = Component;
    // eslint-disable-next-line no-global-assign
    Component = (config) => {
      const wrappedConfig = { ...config };

      const lifecycleMethods = ['attached', 'ready', 'detached'];
      lifecycleMethods.forEach(method => {
        if (wrappedConfig[method]) {
          const originalMethod = wrappedConfig[method];
          wrappedConfig[method] = (...args) => {
            try {
              return originalMethod.apply(wrappedConfig, args);
            } catch (error) {
              this.handleComponentError(wrappedConfig.is || 'unknown', method, error);
              return null;
            }
          };
        }
      });

      originalComponent(wrappedConfig);
    };
  }

  /**
   * 初始化网络监控
   * @private
   */
  initNetworkMonitoring() {
    // 检查网络状态
    wx.onNetworkStatusChange((res) => {
      const wasOnline = this.isOnline;
      this.isOnline = res.isConnected;

      if (wasOnline && !this.isOnline) {
        this.handleNetworkDisconnected();
      } else if (!wasOnline && this.isOnline) {
        this.handleNetworkReconnected();
      }
    });

    // 定期检查网络状态
    setInterval(() => {
      this.checkNetworkStatus();
    }, 30000);
  }

  /**
   * 检查网络状态
   * @private
   */
  checkNetworkStatus() {
    wx.getNetworkType({
      success: (res) => {
        const wasOnline = this.isOnline;
        this.isOnline = res.networkType !== 'none';

        if (wasOnline && !this.isOnline) {
          this.handleNetworkDisconnected();
        }
      },
      fail: () => {
        this.isOnline = false;
        this.handleNetworkDisconnected();
      }
    });
  }

  /**
   * 注册默认恢复策略
   * @private
   */
  registerDefaultRecoveryStrategies() {
    // 网络错误恢复策略
    this.recoveryStrategies.set('NETWORK_ERROR', {
      name: 'networkRetry',
      maxRetries: 3,
      delay: 1000,
      shouldRetry: (error) => this.isNetworkError(error),
      recover: (error, context) => this.retryNetworkRequest(error, context)
    });

    // 数据库错误恢复策略
    this.recoveryStrategies.set('DATABASE_ERROR', {
      name: 'databaseRetry',
      maxRetries: 2,
      delay: 500,
      shouldRetry: (error) => this.isDatabaseError(error),
      recover: (error, context) => this.retryDatabaseOperation(error, context)
    });

    // 缓存错误恢复策略
    this.recoveryStrategies.set('CACHE_ERROR', {
      name: 'cacheCleanup',
      maxRetries: 1,
      delay: 100,
      shouldRetry: (error) => this.isCacheError(error),
      recover: (error, context) => this.cleanupCache(error, context)
    });
  }

  /**
   * 处理应用级错误
   * @param {Error} error - 错误对象
   */
  handleAppError(error) {
    const errorInfo = this.formatError(error, {
      type: 'APP_ERROR',
      level: 'ERROR',
      timestamp: Date.now()
    });

    this.logError(errorInfo);
    this.recordError(errorInfo);
    this.attemptRecovery(errorInfo);
  }

  /**
   * 处理未处理的Promise拒绝
   * @param {object} event - 拒绝事件
   */
  handleUnhandledRejection(event) {
    const error = new Error(event.reason || 'Unhandled promise rejection');
    const errorInfo = this.formatError(error, {
      type: 'UNHANDLED_REJECTION',
      level: 'WARNING',
      timestamp: Date.now()
    });

    this.logError(errorInfo);
    this.recordError(errorInfo);
  }

  /**
   * 处理生命周期错误
   * @param {string} method - 生命周期方法名
   * @param {Error} error - 错误对象
   */
  handleLifecycleError(method, error) {
    const errorInfo = this.formatError(error, {
      type: 'LIFECYCLE_ERROR',
      level: 'ERROR',
      context: { method },
      timestamp: Date.now()
    });

    this.logError(errorInfo);
    this.recordError(errorInfo);

    // 生命周期错误通常比较严重，可能需要重启应用
    if (method === 'onLaunch') {
      this.suggestAppRestart();
    }
  }

  /**
   * 处理页面错误
   * @param {string} pagePath - 页面路径
   * @param {string} method - 页面方法名
   * @param {Error} error - 错误对象
   */
  handlePageError(pagePath, method, error) {
    const errorInfo = this.formatError(error, {
      type: 'PAGE_ERROR',
      level: 'ERROR',
      context: { pagePath, method },
      timestamp: Date.now()
    });

    this.logError(errorInfo);
    this.recordError(errorInfo);

    // 页面加载错误可以尝试重新加载
    if (method === 'onLoad') {
      this.suggestPageReload(pagePath);
    }
  }

  /**
   * 处理事件错误
   * @param {string} pagePath - 页面路径
   * @param {string} eventName - 事件名称
   * @param {Error} error - 错误对象
   */
  handleEventError(pagePath, eventName, error) {
    const errorInfo = this.formatError(error, {
      type: 'EVENT_ERROR',
      level: 'WARNING',
      context: { pagePath, eventName },
      timestamp: Date.now()
    });

    this.logError(errorInfo);
    this.recordError(errorInfo);
  }

  /**
   * 处理组件错误
   * @param {string} componentName - 组件名称
   * @param {string} method - 组件方法名
   * @param {Error} error - 错误对象
   */
  handleComponentError(componentName, method, error) {
    const errorInfo = this.formatError(error, {
      type: 'COMPONENT_ERROR',
      level: 'WARNING',
      context: { componentName, method },
      timestamp: Date.now()
    });

    this.logError(errorInfo);
    this.recordError(errorInfo);
  }

  /**
   * 处理网络断开
   * @private
   */
  handleNetworkDisconnected() {
    logger.warn('Network disconnected');

    // 清理网络请求队列
    this.clearPendingRequests();

    // 保存未完成的操作
    this.savePendingOperations();

    // 显示网络断开提示
    this.showNetworkError();
  }

  /**
   * 处理网络重连
   * @private
   */
  handleNetworkReconnected() {
    logger.info('Network reconnected');

    // 恢复待处理的操作
    this.restorePendingOperations();

    // 隐藏网络错误提示
    this.hideNetworkError();
  }

  /**
   * 尝试错误恢复
   * @param {object} errorInfo - 错误信息
   */
  attemptRecovery(errorInfo) {
    const errorType = this.getErrorType(errorInfo.error);
    const strategy = this.recoveryStrategies.get(errorType);

    if (strategy && strategy.shouldRetry(errorInfo.error)) {
      this.executeRecoveryStrategy(strategy, errorInfo);
    }
  }

  /**
   * 执行恢复策略
   * @private
   */
  async executeRecoveryStrategy(strategy, errorInfo) {
    const retryCount = this.getRetryCount(errorInfo);

    if (retryCount >= strategy.maxRetries) {
      logger.error('Max retries exceeded for error:', errorInfo);
      this.showErrorMessage(errorInfo);
      return;
    }

    try {
      logger.info(`Attempting recovery strategy: ${strategy.name}`, { errorType: errorInfo.type, retryCount });

      await this.sleep(strategy.delay * (retryCount + 1));
      await strategy.recover(errorInfo.error, errorInfo.context);

      logger.info(`Recovery strategy successful: ${strategy.name}`);
    } catch (recoveryError) {
      logger.error('Recovery strategy failed:', recoveryError);
      this.recordRetry(errorInfo);

      // 重试恢复策略
      if (retryCount < strategy.maxRetries) {
        setTimeout(() => {
          this.executeRecoveryStrategy(strategy, errorInfo);
        }, strategy.delay * (retryCount + 2));
      }
    }
  }

  /**
   * 重试网络请求
   * @private
   */
  async retryNetworkRequest() {
    // 这里可以添加具体的重试逻辑
    // 比如重新发起请求
    return Promise.resolve();
  }

  /**
   * 重试数据库操作
   * @private
   */
  async retryDatabaseOperation() {
    // 这里可以添加数据库重试逻辑
    return Promise.resolve();
  }

  /**
   * 清理缓存
   * @private
   */
  async cleanupCache() {
    try {
      // 清理损坏的缓存数据
      wx.clearStorageSync();
      logger.info('Cache cleanup completed');
    } catch (cleanupError) {
      logger.error('Cache cleanup failed:', cleanupError);
    }
    return Promise.resolve();
  }

  /**
   * 格式化错误信息
   * @private
   */
  formatError(error, additionalInfo) {
    return {
      ...additionalInfo,
      error: {
        message: error.message || error.errMsg || 'Unknown error',
        stack: error.stack || '',
        name: error.name || 'Error'
      },
      context: {
        ...additionalInfo.context,
        userAgent: wx.getSystemInfoSync(),
        timestamp: additionalInfo.timestamp || Date.now()
      }
    };
  }

  /**
   * 记录错误
   * @private
   */
  recordError(errorInfo) {
    this.errorHistory.unshift(errorInfo);

    // 保持最近50个错误
    if (this.errorHistory.length > 50) {
      this.errorHistory = this.errorHistory.slice(0, 50);
    }
  }

  /**
   * 记录重试
   * @private
   */
  recordRetry(errorInfo) {
    const key = this.getErrorKey(errorInfo);
    const retry = this.retryQueue.get(key) || 0;
    this.retryQueue.set(key, retry + 1);
  }

  /**
   * 获取重试次数
   * @private
   */
  getRetryCount(errorInfo) {
    const key = this.getErrorKey(errorInfo);
    return this.retryQueue.get(key) || 0;
  }

  /**
   * 获取错误键
   * @private
   */
  getErrorKey(errorInfo) {
    return `${errorInfo.type}_${errorInfo.error.message}_${JSON.stringify(errorInfo.context)}`;
  }

  /**
   * 获取错误类型
   * @private
   */
  getErrorType(error) {
    if (this.isNetworkError(error)) return 'NETWORK_ERROR';
    if (this.isDatabaseError(error)) return 'DATABASE_ERROR';
    if (this.isCacheError(error)) return 'CACHE_ERROR';
    return 'UNKNOWN_ERROR';
  }

  /**
   * 判断是否为网络错误
   * @private
   */
  isNetworkError(error) {
    const message = error.message || error.errMsg || '';
    return message.includes('network') ||
           message.includes('timeout') ||
           message.includes('ECONNRESET') ||
           error.statusCode >= 500;
  }

  /**
   * 判断是否为数据库错误
   * @private
   */
  isDatabaseError(error) {
    const message = error.message || error.errMsg || '';
    return message.includes('database') ||
           message.includes('collection') ||
           message.includes('document') ||
           error.code === 'DATABASE_ERROR';
  }

  /**
   * 判断是否为缓存错误
   * @private
   */
  isCacheError(error) {
    const message = error.message || error.errMsg || '';
    return message.includes('storage') ||
           message.includes('cache') ||
           message.includes('localStorage');
  }

  /**
   * 记录错误到日志
   * @private
   */
  logError(errorInfo) {
    const logLevel = errorInfo.level === 'ERROR' ? 'error' : 'warn';
    logger[logLevel]('Global error occurred:', errorInfo);
  }

  /**
   * 显示错误消息
   * @private
   */
  showErrorMessage(errorInfo) {
    const userMessage = this.getUserFriendlyMessage(errorInfo);

    wx.showModal({
      title: '操作失败',
      content: userMessage,
      showCancel: false,
      confirmText: '我知道了'
    });
  }

  /**
   * 获取用户友好的错误消息
   * @private
   */
  getUserFriendlyMessage(errorInfo) {
    const messages = {
      'NETWORK_ERROR': '网络连接出现问题，请检查网络设置后重试',
      'DATABASE_ERROR': '数据操作失败，请稍后重试',
      'CACHE_ERROR': '缓存出现问题，已为您清理，请重试',
      'UNKNOWN_ERROR': '程序出现异常，请稍后重试'
    };

    return messages[errorInfo.type] || '程序出现异常，请稍后重试';
  }

  /**
   * 显示网络错误提示
   * @private
   */
  showNetworkError() {
    wx.showToast({
      title: '网络连接异常',
      icon: 'none',
      duration: 0,
      mask: true
    });
  }

  /**
   * 隐藏网络错误提示
   * @private
   */
  hideNetworkError() {
    wx.hideToast();

    wx.showToast({
      title: '网络已恢复',
      icon: 'success',
      duration: 2000
    });
  }

  /**
   * 建议重启应用
   * @private
   */
  suggestAppRestart() {
    wx.showModal({
      title: '应用异常',
      content: '应用启动时出现异常，建议重启应用',
      confirmText: '重启',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          wx.reLaunch({
            url: '/pages/index/index'
          });
        }
      }
    });
  }

  /**
   * 建议重新加载页面
   * @private
   */
  suggestPageReload(pagePath) {
    wx.showModal({
      title: '页面加载失败',
      content: '页面加载出现问题，是否重新加载？',
      confirmText: '重新加载',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          wx.reLaunch({
            url: `/${pagePath}`
          });
        }
      }
    });
  }

  /**
   * 清理待处理的请求
   * @private
   */
  clearPendingRequests() {
    // 清理网络请求队列
    // 这里可以添加具体的清理逻辑
  }

  /**
   * 保存待处理的操作
   * @private
   */
  savePendingOperations() {
    // 保存未完成的重要操作到本地存储
    try {
      const pendingOps = {
        timestamp: Date.now(),
        operations: []
        // 这里可以添加具体的待处理操作
      };
      wx.setStorageSync('pendingOperations', pendingOps);
    } catch (error) {
      logger.error('Failed to save pending operations:', error);
    }
  }

  /**
   * 恢复待处理的操作
   * @private
   */
  async restorePendingOperations() {
    try {
      const pendingOps = wx.getStorageSync('pendingOperations');
      if (pendingOps) {
        // 恢复待处理的操作
        // 这里可以添加具体的恢复逻辑

        // 清理已恢复的操作
        wx.removeStorageSync('pendingOperations');
      }
    } catch (error) {
      logger.error('Failed to restore pending operations:', error);
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
   * 获取错误历史
   * @returns {Array} 错误历史数组
   */
  getErrorHistory() {
    return [...this.errorHistory];
  }

  /**
   * 清除错误历史
   */
  clearErrorHistory() {
    this.errorHistory = [];
    this.retryQueue.clear();
    logger.info('Error history cleared');
  }

  /**
   * 获取错误统计信息
   * @returns {object} 错误统计信息
   */
  getErrorStatistics() {
    const stats = {
      total: this.errorHistory.length,
      byType: {},
      byLevel: {},
      recent: this.errorHistory.slice(0, 10)
    };

    this.errorHistory.forEach(error => {
      // 按类型统计
      stats.byType[error.type] = (stats.byType[error.type] || 0) + 1;

      // 按级别统计
      stats.byLevel[error.level] = (stats.byLevel[error.level] || 0) + 1;
    });

    return stats;
  }

  /**
   * 手动触发错误报告
   * @param {Error} error - 错误对象
   * @param {object} context - 错误上下文
   */
  reportError(error, context = {}) {
    const errorInfo = this.formatError(error, {
      type: 'MANUAL_REPORT',
      level: 'ERROR',
      context,
      timestamp: Date.now()
    });

    this.logError(errorInfo);
    this.recordError(errorInfo);
    this.attemptRecovery(errorInfo);
  }
}

// 创建全局实例
const globalErrorHandler = new GlobalErrorHandler();

module.exports = {
  globalErrorHandler,
  GlobalErrorHandler
};
