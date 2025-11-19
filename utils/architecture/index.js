// 统一导出架构组件
const { BaseManager } = require('./baseManager');
const { UserManager } = require('./userManager');
const { DatabaseManager } = require('./databaseManager');
const { CloudFunctionManager } = require('./cloudFunctionManager');
const { StateManager } = require('./stateManager');
const { ErrorManager } = require('./errorManager');
const { PerformanceManager } = require('./performanceManager');
const { getCacheManager } = require('./cacheManager');
const { getLogger } = require('./logger');

// 获取单例实例
const getDatabaseManager = require('./databaseManager').getDatabaseManager;
const getCloudFunctionManager = require('./cloudFunctionManager').getCloudFunctionManager;
const getStateManager = require('./stateManager').getStateManager;
const getErrorManager = require('./errorManager').getErrorManager;
const getPerformanceManager = require('./performanceManager').getPerformanceManager;

// 架构管理器 - 统一管理系统架构
class ArchitectureManager {
  constructor() {
    this.components = new Map();
    this.initialized = false;
    this.healthCheckInterval = 30000; // 30秒
    this.healthCheckTimer = null;
    this.logger = getLogger();
    
    this.initialize();
  }

  // 初始化架构管理器
  async initialize() {
    if (this.initialized) {
      return;
    }
    
    this.logger.info('开始初始化架构管理器');
    
    try {
      // 注册核心组件
      await this.registerCoreComponents();
      
      // 设置健康检查
      this.setupHealthCheck();
      
      // 验证架构完整性
      await this.validateArchitecture();
      
      this.initialized = true;
      this.logger.info('架构管理器初始化完成');
      
    } catch (error) {
      this.logger.error('架构管理器初始化失败', error);
      throw error;
    }
  }

  // 注册核心组件
  async registerCoreComponents() {
    try {
      // 数据库管理器
      this.registerComponent('database', getDatabaseManager());
      
      // 云函数管理器
      this.registerComponent('cloudFunction', getCloudFunctionManager());
      
      // 状态管理器
      this.registerComponent('state', getStateManager());
      
      // 错误管理器
      this.registerComponent('error', getErrorManager());
      
      // 性能管理器
      this.registerComponent('performance', getPerformanceManager());
      
      // 缓存管理器
      this.registerComponent('cache', getCacheManager());
      
      // 用户管理器（需要数据库管理器）
      this.registerComponent('user', new UserManager());
      
      this.logger.info('核心组件注册完成');
      
    } catch (error) {
      this.logger.error('注册核心组件失败', error);
      throw error;
    }
  }

  // 注册组件
  registerComponent(name, component) {
    if (this.components.has(name)) {
      throw new Error(`组件 ${name} 已存在`);
    }
    
    this.components.set(name, component);
    this.logger.info(`注册组件: ${name}`);
  }

  // 获取组件
  getComponent(name) {
    const component = this.components.get(name);
    if (!component) {
      throw new Error(`组件 ${name} 不存在`);
    }
    
    return component;
  }

  // 设置健康检查
  setupHealthCheck() {
    this.healthCheckTimer = setInterval(async () => {
      await this.performHealthCheck();
    }, this.healthCheckInterval);
    
    this.logger.info(`健康检查已启动，间隔: ${this.healthCheckInterval}ms`);
  }

  // 执行健康检查
  async performHealthCheck() {
    try {
      const healthReport = {
        timestamp: new Date().toISOString(),
        overall: 'healthy',
        components: {}
      };
      
      let hasIssues = false;
      
      // 检查各个组件的健康状态
      for (const [name, component] of this.components) {
        try {
          if (typeof component.healthCheck === 'function') {
            const health = await component.healthCheck();
            healthReport.components[name] = health;
            
            if (health.overall === 'unhealthy') {
              hasIssues = true;
              this.logger.error(`组件 ${name} 健康检查失败`, health);
            } else if (health.overall === 'warning') {
              this.logger.warn(`组件 ${name} 健康检查警告`, health);
            }
          } else {
            healthReport.components[name] = {
              overall: 'unknown',
              message: '组件不支持健康检查'
            };
          }
        } catch (error) {
          hasIssues = true;
          healthReport.components[name] = {
            overall: 'error',
            message: error.message
          };
          this.logger.error(`组件 ${name} 健康检查出错`, error);
        }
      }
      
      // 设置总体健康状态
      healthReport.overall = hasIssues ? 'unhealthy' : 'healthy';
      
      // 记录健康报告
      if (hasIssues) {
        this.logger.error('架构健康检查发现问题', healthReport);
      } else {
        this.logger.debug('架构健康检查通过', healthReport);
      }
      
    } catch (error) {
      this.logger.error('执行健康检查失败', error);
    }
  }

  // 验证架构完整性
  async validateArchitecture() {
    try {
      const validationResults = {
        timestamp: new Date().toISOString(),
        components: {},
        dependencies: {},
        overall: true
      };
      
      // 验证组件依赖关系
      const dependencies = {
        user: ['database', 'cache', 'error'],
        database: [],
        cloudFunction: ['error', 'performance'],
        state: ['cache'],
        error: [],
        performance: ['cache'],
        cache: []
      };
      
      for (const [componentName, deps] of Object.entries(dependencies)) {
        const component = this.components.get(componentName);
        if (!component) {
          validationResults.components[componentName] = {
            exists: false,
            message: '组件不存在'
          };
          validationResults.overall = false;
          continue;
        }
        
        validationResults.components[componentName] = {
          exists: true,
          dependencies: {}
        };
        
        // 验证依赖
        for (const depName of deps) {
          const depComponent = this.components.get(depName);
          validationResults.components[componentName].dependencies[depName] = {
            exists: !!depComponent,
            message: depComponent ? '依赖存在' : '依赖不存在'
          };
          
          if (!depComponent) {
            validationResults.overall = false;
          }
        }
      }
      
      // 验证配置一致性
      await this.validateConfigurationConsistency();
      
      this.logger.info('架构完整性验证完成', validationResults);
      
      if (!validationResults.overall) {
        throw new Error('架构验证失败');
      }
      
      return validationResults;
      
    } catch (error) {
      this.logger.error('验证架构完整性失败', error);
      throw error;
    }
  }

  // 验证配置一致性
  async validateConfigurationConsistency() {
    try {
      // 检查各组件的配置是否一致
      const cacheManager = this.getComponent('cache');
      const performanceManager = this.getComponent('performance');
      
      // 确保缓存配置一致
      if (cacheManager && performanceManager) {
        const cacheConfig = cacheManager.config || {};
        const performanceConfig = performanceManager.config || {};
        
        if (cacheConfig.defaultTTL && performanceConfig.cacheTTL && 
            cacheConfig.defaultTTL !== performanceConfig.cacheTTL) {
          this.logger.warn('缓存TTL配置不一致');
        }
      }
      
      this.logger.info('配置一致性验证完成');
      
    } catch (error) {
      this.logger.error('验证配置一致性失败', error);
      throw error;
    }
  }

  // 获取架构统计信息
  getArchitectureStats() {
    try {
      const stats = {
        timestamp: new Date().toISOString(),
        components: {
          total: this.components.size,
          list: Array.from(this.components.keys())
        },
        health: {
          monitoring: this.healthCheckTimer !== null,
          interval: this.healthCheckInterval
        },
        performance: {}
      };
      
      // 收集各组件的性能统计
      for (const [name, component] of this.components) {
        if (typeof component.getStats === 'function') {
          stats.performance[name] = component.getStats();
        } else if (typeof component.getPerformanceStats === 'function') {
          stats.performance[name] = component.getPerformanceStats();
        }
      }
      
      return stats;
      
    } catch (error) {
      this.logger.error('获取架构统计信息失败', error);
      return {
        error: error.message,
        components: {
          total: this.components.size,
          list: Array.from(this.components.keys())
        }
      };
    }
  }

  // 获取架构配置
  getArchitectureConfig() {
    try {
      const config = {
        timestamp: new Date().toISOString(),
        components: {}
      };
      
      // 收集各组件的配置
      for (const [name, component] of this.components) {
        if (component.config) {
          config.components[name] = component.config;
        } else {
          config.components[name] = {
            message: '组件没有配置信息'
          };
        }
      }
      
      return config;
      
    } catch (error) {
      this.logger.error('获取架构配置失败', error);
      return {
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  // 重启组件
  async restartComponent(name) {
    try {
      const component = this.components.get(name);
      if (!component) {
        throw new Error(`组件 ${name} 不存在`);
      }
      
      this.logger.info(`重启组件: ${name}`);
      
      // 清理组件
      if (typeof component.cleanup === 'function') {
        await component.cleanup();
      }
      
      // 重新初始化组件
      if (typeof component.initialize === 'function') {
        await component.initialize();
      }
      
      this.logger.info(`组件 ${name} 重启完成`);
      
    } catch (error) {
      this.logger.error(`重启组件 ${name} 失败`, error);
      throw error;
    }
  }

  // 重启架构
  async restartArchitecture() {
    try {
      this.logger.info('开始重启架构');
      
      // 停止健康检查
      if (this.healthCheckTimer) {
        clearInterval(this.healthCheckTimer);
        this.healthCheckTimer = null;
      }
      
      // 清理所有组件
      for (const [name, component] of this.components) {
        if (typeof component.cleanup === 'function') {
          await component.cleanup();
        }
      }
      
      // 清空组件
      this.components.clear();
      
      // 重新初始化
      this.initialized = false;
      await this.initialize();
      
      this.logger.info('架构重启完成');
      
    } catch (error) {
      this.logger.error('重启架构失败', error);
      throw error;
    }
  }

  // 清理资源
  async cleanup() {
    this.logger.info('开始清理架构管理器资源');
    
    // 停止健康检查
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
    
    // 清理所有组件
    for (const [name, component] of this.components) {
      try {
        if (typeof component.cleanup === 'function') {
          await component.cleanup();
        }
      } catch (error) {
        this.logger.error(`清理组件 ${name} 失败`, error);
      }
    }
    
    // 清空组件
    this.components.clear();
    this.initialized = false;
    
    this.logger.info('架构管理器资源清理完成');
  }
}

// 单例模式
let architectureManager = null;

function getArchitectureManager() {
  if (!architectureManager) {
    architectureManager = new ArchitectureManager();
  }
  return architectureManager;
}

module.exports = {
  ArchitectureManager,
  getArchitectureManager,
  
  // 导出所有组件
  BaseManager,
  UserManager,
  DatabaseManager,
  CloudFunctionManager,
  StateManager,
  ErrorManager,
  PerformanceManager,
  
  // 导出单例函数
  getDatabaseManager,
  getCloudFunctionManager,
  getStateManager,
  getErrorManager,
  getPerformanceManager,
  getCacheManager,
  getLogger
};