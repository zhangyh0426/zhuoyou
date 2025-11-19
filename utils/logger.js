/**
 * 日志管理系统
 * 提供统一的日志记录、错误处理和调试信息管理
 */

const Constants = require('./constants');

class Logger {
  constructor() {
    this.levels = {
      DEBUG: 0,
      INFO: 1,
      WARN: 2,
      ERROR: 3
    };

    this.currentLevel = this.levels.INFO; // 修复未定义变量问题
    this.logs = [];
  }

  /**
   * 设置日志级别
   * @param {string} level - DEBUG, INFO, WARN, ERROR
   */
  setLevel(level) {
    if (typeof level === 'string' && this.levels[level.toUpperCase()]) {
      this.currentLevel = this.levels[level.toUpperCase()];
    }
  }

  /**
   * 记录调试信息
   */
  debug(...args) {
    if (this.currentLevel <= this.levels.DEBUG) {
      const message = this.formatMessage('DEBUG', args);
      this.addLog('DEBUG', message);
    }
  }

  /**
   * 记录一般信息
   */
  info(...args) {
    if (this.currentLevel <= this.levels.INFO) {
      const message = this.formatMessage('INFO', args);
      this.addLog('INFO', message);
    }
  }

  /**
   * 记录警告信息
   */
  warn(...args) {
    if (this.currentLevel <= this.levels.WARN) {
      const message = this.formatMessage('WARN', args);
      this.addLog('WARN', message);
    }
  }

  /**
   * 记录错误信息
   */
  error(...args) {
    if (this.currentLevel <= this.levels.ERROR) {
      const message = this.formatMessage('ERROR', args);
      this.addLog('ERROR', message);
    }
  }

  /**
   * 格式化日志消息
   * @private
   */
  formatMessage(level, args) {
    const timestamp = new Date().toISOString();
    const message = args.map(arg => {
      if (typeof arg === 'object') {
        try {
          return JSON.stringify(arg);
        } catch (e) {
          return String(arg);
        }
      }
      return String(arg);
    }).join(' ');

    return `[${timestamp}] [${level}] ${message}`;
  }

  /**
   * 添加日志到本地存储
   * @private
   */
  addLog(level, message) {
    try {
      this.logs.push({ level, message, timestamp: Date.now() });

      // 只保留最近100条日志
      if (this.logs.length > 100) {
        this.logs = this.logs.slice(-100);
      }

      // 定期清理过期日志
      if (this.logs.length % 10 === 0) {
        this.cleanupOldLogs();
      }
    } catch (error) {
      this.error('Failed to add log:', error);
    }
  }

  /**
   * 清理过期日志
   * @private
   */
  cleanupOldLogs() {
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7天
    const now = Date.now();

    this.logs = this.logs.filter(log => now - log.timestamp < maxAge);
  }

  /**
   * 获取日志列表
   * @param {string} level - 日志级别过滤
   * @param {number} limit - 限制返回数量
   */
  getLogs(level = null, limit = 50) {
    let logs = this.logs;

    if (level && this.levels[level.toUpperCase()]) {
      logs = logs.filter(log => log.level === level.toUpperCase());
    }

    return logs.slice(-limit);
  }

  /**
   * 清除所有日志
   */
  clearLogs() {
    this.logs = [];
    try {
      wx.removeStorageSync('werewolf_store_logs');
    } catch (error) {
      this.error('Failed to clear logs:', error);
    }
  }

  /**
   * 记录性能信息
   */
  performance(label, fn) {
    const start = Date.now();
    const result = fn();
    const duration = Date.now() - start;

    this.info(`Performance [${label}]: ${duration}ms`);
    return result;
  }

  /**
   * 记录用户行为
   */
  userAction(action, data = {}) {
    this.info(`UserAction: ${action}`, data);
  }

  /**
   * 记录业务错误
   */
  businessError(operation, error, context = {}) {
    const errorInfo = {
      operation,
      error: error.message || String(error),
      stack: error.stack,
      context,
      timestamp: Date.now()
    };

    this.error(`BusinessError [${operation}]:`, errorInfo);
  }

  /**
   * 记录网络请求
   */
  networkRequest(url, method = 'GET', data = null) {
    this.info(`NetworkRequest: ${method} ${url}`, data);
  }

  /**
   * 记录网络响应
   */
  networkResponse(url, method = 'GET', response, duration = 0) {
    const status = response.statusCode || response.status;
    const level = status >= 400 ? 'ERROR' : 'INFO';
    const message = `${method} ${url} - ${status} (${duration}ms)`;

    if (level === 'ERROR') {
      this.error(message, response.data || response);
    } else {
      this.info(message, response.data || response);
    }
  }
}

// 创建全局日志实例
const logger = new Logger();

// 错误处理类
class ErrorHandler {
  constructor() {
    this.errorCallbacks = [];
  }

  /**
   * 注册错误回调
   */
  onError(callback) {
    if (typeof callback === 'function') {
      this.errorCallbacks.push(callback);
    }
  }

  /**
   * 处理错误
   */
  handle(error, context = {}) {
    const errorInfo = {
      message: error.message || String(error),
      stack: error.stack,
      context,
      timestamp: Date.now(),
      userAgent: wx.getSystemInfoSync()
    };

    // 记录日志
    logger.error('GlobalError:', errorInfo);

    // 调用注册的回调
    this.errorCallbacks.forEach(callback => {
      try {
        callback(errorInfo);
      } catch (callbackError) {
        logger.error('Error in error callback:', callbackError);
      }
    });

    // 发送错误报告（如果配置了）
    this.reportError(errorInfo);

    return errorInfo;
  }

  /**
   * 报告错误到服务端
   * @private
   */
  reportError() {
    // 这里可以添加错误上报逻辑
    // 例如发送到错误监控服务
    try {
      // wx.request({
      //   url: 'https://your-error-reporting-api.com/errors',
      //   method: 'POST',
      //   data: errorInfo,
      //   fail: (reportError) => {
      //     logger.error('Failed to report error:', reportError);
      //   }
      // });
    } catch (reportError) {
      logger.error('Error reporting failed:', reportError);
    }
  }

  /**
   * 创建友好的错误信息
   */
  createUserFriendlyMessage(errorCode, defaultMessage = '操作失败，请稍后重试') {
    const errorMessages = {
      [Constants.ERROR_CODES.NETWORK_ERROR]: '网络连接失败，请检查网络设置',
      [Constants.ERROR_CODES.AUTH_FAILED]: '登录状态已失效，请重新登录',
      [Constants.ERROR_CODES.PERMISSION_DENIED]: '您没有权限执行此操作',
      [Constants.ERROR_CODES.DATA_NOT_FOUND]: '数据不存在或已被删除',
      [Constants.ERROR_CODES.VALIDATION_ERROR]: '输入数据不符合要求',
      [Constants.ERROR_CODES.SERVER_ERROR]: '服务器开小差了，请稍后重试'
    };

    return errorMessages[errorCode] || defaultMessage;
  }

  /**
   * 显示错误提示
   */
  showError(error, options = {}) {
    const userMessage = options.userMessage || this.createUserFriendlyMessage(error.code);
    const title = options.title || '提示';

    wx.showModal({
      title,
      content: userMessage,
      showCancel: false,
      ...options
    });
  }

  /**
   * 处理异步错误
   */
  async handleAsync(promise, context = '') {
    try {
      return await promise;
    } catch (error) {
      this.handle(error, { context });
      throw error;
    }
  }
}

// 创建全局错误处理器
const errorHandler = new ErrorHandler();

module.exports = {
  logger,
  errorHandler,
  Logger,
  ErrorHandler
};
