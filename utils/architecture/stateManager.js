// 状态管理器 - 优化状态管理和缓存机制
const { logger } = require('./logger');
const { getCacheManager } = require('./cacheManager');
const { getDatabaseManager } = require('./databaseManager');

class StateManager {
  constructor() {
    // 全局状态
    this.globalState = new Map();
    
    // 页面状态
    this.pageStates = new Map();
    
    // 用户状态
    this.userStates = new Map();
    
    // 组件状态
    this.componentStates = new Map();
    
    // 状态监听器
    this.stateListeners = new Map();
    
    // 状态变更历史
    this.stateHistory = [];
    
    // 状态持久化配置
    this.persistenceConfig = {
      enabled: true,
      maxHistorySize: 1000,
      debounceDelay: 100,
      batchSize: 50
    };
    
    this.cacheManager = getCacheManager();
    this.databaseManager = getDatabaseManager();
    
    // 防抖和批量处理
    this.debounceTimers = new Map();
    this.batchQueue = [];
    this.batchTimer = null;
    
    // 性能监控
    this.performanceMetrics = {
      stateChanges: 0,
      listenerCalls: 0,
      persistOperations: 0,
      cacheHits: 0,
      cacheMisses: 0
    };
    
    // 初始化
    this.initialize();
  }

  // 初始化状态管理器
  async initialize() {
    logger.info('开始初始化状态管理器');
    
    try {
      // 从缓存恢复状态
      await this.restoreFromCache();
      
      // 从数据库恢复状态
      await this.restoreFromDatabase();
      
      // 设置自动保存
      this.setupAutoSave();
      
      logger.info('状态管理器初始化成功');
      
    } catch (error) {
      logger.error('状态管理器初始化失败', error);
      throw error;
    }
  }

  // 从缓存恢复状态
  async restoreFromCache() {
    try {
      const cachedState = await this.cacheManager.get('stateManager:globalState');
      if (cachedState) {
        this.globalState = new Map(cachedState);
        logger.info('从缓存恢复全局状态成功');
      }
      
      const cachedUserStates = await this.cacheManager.get('stateManager:userStates');
      if (cachedUserStates) {
        this.userStates = new Map(cachedUserStates);
        logger.info('从缓存恢复用户状态成功');
      }
      
    } catch (error) {
      logger.warn('从缓存恢复状态失败', error);
    }
  }

  // 从数据库恢复状态
  async restoreFromDatabase() {
    try {
      const db = await this.databaseManager.getDatabase();
      
      // 获取全局状态
      const globalStateDoc = await db.collection('system_states')
        .doc('global')
        .get();
      
      if (globalStateDoc.data) {
        this.globalState = new Map(Object.entries(globalStateDoc.data.state || {}));
        logger.info('从数据库恢复全局状态成功');
      }
      
      // 获取用户状态
      const userStatesSnapshot = await db.collection('user_states')
        .limit(100)
        .get();
      
      if (userStatesSnapshot.data.length > 0) {
        userStatesSnapshot.data.forEach(doc => {
          this.userStates.set(doc.userId, new Map(Object.entries(doc.state || {})));
        });
        logger.info(`从数据库恢复 ${userStatesSnapshot.data.length} 个用户状态成功`);
      }
      
    } catch (error) {
      logger.warn('从数据库恢复状态失败', error);
    }
  }

  // 设置自动保存
  setupAutoSave() {
    // 每30秒自动保存一次
    setInterval(() => {
      this.persistAllStates();
    }, 30000);
    
    // 页面卸载时保存
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        this.persistAllStates();
      });
    }
  }

  // 获取全局状态
  getGlobalState(key, defaultValue = null) {
    try {
      const cacheKey = `global:${key}`;
      
      // 检查缓存
      const cachedValue = this.cacheManager.get(cacheKey);
      if (cachedValue !== null) {
        this.performanceMetrics.cacheHits++;
        return cachedValue;
      }
      
      // 从内存获取
      const value = this.globalState.get(key);
      const result = value !== undefined ? value : defaultValue;
      
      // 缓存结果
      this.cacheManager.set(cacheKey, result, 300000); // 5分钟缓存
      this.performanceMetrics.cacheMisses++;
      
      return result;
      
    } catch (error) {
      logger.error('获取全局状态失败', { key, error });
      return defaultValue;
    }
  }

  // 设置全局状态
  setGlobalState(key, value, options = {}) {
    try {
      const oldValue = this.globalState.get(key);
      
      // 设置新值
      this.globalState.set(key, value);
      
      // 记录状态变更
      this.recordStateChange('global', key, oldValue, value, options);
      
      // 通知监听器
      this.notifyListeners('global', key, value, oldValue);
      
      // 更新缓存
      const cacheKey = `global:${key}`;
      this.cacheManager.set(cacheKey, value, options.cacheTimeout || 300000);
      
      // 防抖持久化
      if (options.persist !== false) {
        this.debouncePersist('global', key);
      }
      
      return true;
      
    } catch (error) {
      logger.error('设置全局状态失败', { key, value, error });
      return false;
    }
  }

  // 获取页面状态
  getPageState(pageId, key, defaultValue = null) {
    try {
      const pageState = this.pageStates.get(pageId);
      if (!pageState) {
        return defaultValue;
      }
      
      const value = pageState.get(key);
      return value !== undefined ? value : defaultValue;
      
    } catch (error) {
      logger.error('获取页面状态失败', { pageId, key, error });
      return defaultValue;
    }
  }

  // 设置页面状态
  setPageState(pageId, key, value, options = {}) {
    try {
      let pageState = this.pageStates.get(pageId);
      if (!pageState) {
        pageState = new Map();
        this.pageStates.set(pageId, pageState);
      }
      
      const oldValue = pageState.get(key);
      pageState.set(key, value);
      
      // 记录状态变更
      this.recordStateChange('page', `${pageId}:${key}`, oldValue, value, options);
      
      // 通知监听器
      this.notifyListeners(`page:${pageId}`, key, value, oldValue);
      
      // 防抖持久化
      if (options.persist !== false) {
        this.debouncePersist('page', pageId);
      }
      
      return true;
      
    } catch (error) {
      logger.error('设置页面状态失败', { pageId, key, value, error });
      return false;
    }
  }

  // 获取用户状态
  getUserState(userId, key, defaultValue = null) {
    try {
      const userState = this.userStates.get(userId);
      if (!userState) {
        return defaultValue;
      }
      
      const value = userState.get(key);
      return value !== undefined ? value : defaultValue;
      
    } catch (error) {
      logger.error('获取用户状态失败', { userId, key, error });
      return defaultValue;
    }
  }

  // 设置用户状态
  setUserState(userId, key, value, options = {}) {
    try {
      let userState = this.userStates.get(userId);
      if (!userState) {
        userState = new Map();
        this.userStates.set(userId, userState);
      }
      
      const oldValue = userState.get(key);
      userState.set(key, value);
      
      // 记录状态变更
      this.recordStateChange('user', `${userId}:${key}`, oldValue, value, options);
      
      // 通知监听器
      this.notifyListeners(`user:${userId}`, key, value, oldValue);
      
      // 防抖持久化
      if (options.persist !== false) {
        this.debouncePersist('user', userId);
      }
      
      return true;
      
    } catch (error) {
      logger.error('设置用户状态失败', { userId, key, value, error });
      return false;
    }
  }

  // 获取组件状态
  getComponentState(componentId, key, defaultValue = null) {
    try {
      const componentState = this.componentStates.get(componentId);
      if (!componentState) {
        return defaultValue;
      }
      
      const value = componentState.get(key);
      return value !== undefined ? value : defaultValue;
      
    } catch (error) {
      logger.error('获取组件状态失败', { componentId, key, error });
      return defaultValue;
    }
  }

  // 设置组件状态
  setComponentState(componentId, key, value, options = {}) {
    try {
      let componentState = this.componentStates.get(componentId);
      if (!componentState) {
        componentState = new Map();
        this.componentStates.set(componentId, componentState);
      }
      
      const oldValue = componentState.get(key);
      componentState.set(key, value);
      
      // 记录状态变更
      this.recordStateChange('component', `${componentId}:${key}`, oldValue, value, options);
      
      // 通知监听器
      this.notifyListeners(`component:${componentId}`, key, value, oldValue);
      
      // 防抖持久化
      if (options.persist !== false) {
        this.debouncePersist('component', componentId);
      }
      
      return true;
      
    } catch (error) {
      logger.error('设置组件状态失败', { componentId, key, value, error });
      return false;
    }
  }

  // 添加状态监听器
  addStateListener(scope, key, callback, options = {}) {
    try {
      const listenerKey = `${scope}:${key}`;
      
      if (!this.stateListeners.has(listenerKey)) {
        this.stateListeners.set(listenerKey, []);
      }
      
      const listeners = this.stateListeners.get(listenerKey);
      const listener = {
        id: this.generateListenerId(),
        callback,
        once: options.once || false,
        immediate: options.immediate || false
      };
      
      listeners.push(listener);
      
      // 立即触发一次（如果需要）
      if (listener.immediate) {
        const currentValue = this.getCurrentStateValue(scope, key);
        if (currentValue !== null) {
          callback(currentValue, null);
        }
      }
      
      return listener.id;
      
    } catch (error) {
      logger.error('添加状态监听器失败', { scope, key, error });
      return null;
    }
  }

  // 移除状态监听器
  removeStateListener(listenerId) {
    try {
      for (const [key, listeners] of this.stateListeners) {
        const index = listeners.findIndex(listener => listener.id === listenerId);
        if (index !== -1) {
          listeners.splice(index, 1);
          
          // 如果监听器数组为空，删除键
          if (listeners.length === 0) {
            this.stateListeners.delete(key);
          }
          
          return true;
        }
      }
      
      return false;
      
    } catch (error) {
      logger.error('移除状态监听器失败', { listenerId, error });
      return false;
    }
  }

  // 获取当前状态值
  getCurrentStateValue(scope, key) {
    const parts = scope.split(':');
    const scopeType = parts[0];
    
    switch (scopeType) {
      case 'global':
        return this.getGlobalState(key);
      case 'page':
        return this.getPageState(parts[1], key);
      case 'user':
        return this.getUserState(parts[1], key);
      case 'component':
        return this.getComponentState(parts[1], key);
      default:
        return null;
    }
  }

  // 记录状态变更
  recordStateChange(scope, key, oldValue, newValue, options = {}) {
    try {
      this.performanceMetrics.stateChanges++;
      
      const changeRecord = {
        timestamp: new Date().toISOString(),
        scope,
        key,
        oldValue,
        newValue,
        options
      };
      
      this.stateHistory.push(changeRecord);
      
      // 限制历史记录大小
      if (this.stateHistory.length > this.persistenceConfig.maxHistorySize) {
        this.stateHistory = this.stateHistory.slice(-this.persistenceConfig.maxHistorySize);
      }
      
      // 批量处理
      if (options.batch !== false) {
        this.addToBatchQueue('stateChange', changeRecord);
      }
      
    } catch (error) {
      logger.error('记录状态变更失败', { scope, key, error });
    }
  }

  // 通知监听器
  notifyListeners(scope, key, newValue, oldValue) {
    try {
      this.performanceMetrics.listenerCalls++;
      
      const listenerKey = `${scope}:${key}`;
      const listeners = this.stateListeners.get(listenerKey);
      
      if (!listeners || listeners.length === 0) {
        return;
      }
      
      // 创建监听器副本，避免在遍历时修改数组
      const listenersCopy = [...listeners];
      const listenersToRemove = [];
      
      listenersCopy.forEach(listener => {
        try {
          listener.callback(newValue, oldValue);
          
          // 标记一次性监听器为删除
          if (listener.once) {
            listenersToRemove.push(listener.id);
          }
          
        } catch (error) {
          logger.error('状态监听器回调失败', { 
            listenerId: listener.id, 
            scope, 
            key, 
            error 
          });
        }
      });
      
      // 移除一次性监听器
      listenersToRemove.forEach(listenerId => {
        this.removeStateListener(listenerId);
      });
      
    } catch (error) {
      logger.error('通知状态监听器失败', { scope, key, error });
    }
  }

  // 防抖持久化
  debouncePersist(type, id) {
    if (!this.persistenceConfig.enabled) {
      return;
    }
    
    const persistKey = `${type}:${id}`;
    
    // 清除之前的定时器
    if (this.debounceTimers.has(persistKey)) {
      clearTimeout(this.debounceTimers.get(persistKey));
    }
    
    // 设置新的定时器
    const timer = setTimeout(() => {
      this.persistState(type, id);
      this.debounceTimers.delete(persistKey);
    }, this.persistenceConfig.debounceDelay);
    
    this.debounceTimers.set(persistKey, timer);
  }

  // 持久化状态
  async persistState(type, id) {
    try {
      this.performanceMetrics.persistOperations++;
      
      let stateData = null;
      let collectionName = '';
      let docId = '';
      
      switch (type) {
        case 'global':
          stateData = Object.fromEntries(this.globalState);
          collectionName = 'system_states';
          docId = 'global';
          break;
          
        case 'user':
          const userState = this.userStates.get(id);
          if (userState) {
            stateData = Object.fromEntries(userState);
            collectionName = 'user_states';
            docId = id;
          }
          break;
          
        case 'page':
          const pageState = this.pageStates.get(id);
          if (pageState) {
            stateData = Object.fromEntries(pageState);
            collectionName = 'page_states';
            docId = id;
          }
          break;
          
        case 'component':
          const componentState = this.componentStates.get(id);
          if (componentState) {
            stateData = Object.fromEntries(componentState);
            collectionName = 'component_states';
            docId = id;
          }
          break;
      }
      
      if (stateData && collectionName && docId) {
        const db = await this.databaseManager.getDatabase();
        
        await db.collection(collectionName).doc(docId).set({
          data: {
            state: stateData,
            updatedAt: new Date()
          }
        });
        
        logger.debug(`状态持久化成功: ${type}:${id}`);
      }
      
    } catch (error) {
      logger.error('状态持久化失败', { type, id, error });
    }
  }

  // 批量处理队列
  addToBatchQueue(operation, data) {
    this.batchQueue.push({ operation, data, timestamp: Date.now() });
    
    // 设置批量处理定时器
    if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => {
        this.processBatchQueue();
      }, 1000); // 1秒后批量处理
    }
  }

  // 处理批量队列
  async processBatchQueue() {
    if (this.batchQueue.length === 0) {
      this.batchTimer = null;
      return;
    }
    
    try {
      const batchSize = Math.min(this.batchQueue.length, this.persistenceConfig.batchSize);
      const batch = this.batchQueue.splice(0, batchSize);
      
      // 按操作类型分组
      const groupedOperations = {};
      batch.forEach(item => {
        if (!groupedOperations[item.operation]) {
          groupedOperations[item.operation] = [];
        }
        groupedOperations[item.operation].push(item.data);
      });
      
      // 批量处理每种类型的操作
      for (const [operation, items] of Object.entries(groupedOperations)) {
        switch (operation) {
          case 'stateChange':
            await this.batchPersistStateChanges(items);
            break;
        }
      }
      
    } catch (error) {
      logger.error('批量处理失败', error);
    }
    
    // 继续处理剩余项目
    this.batchTimer = null;
    if (this.batchQueue.length > 0) {
      this.processBatchQueue();
    }
  }

  // 批量持久化状态变更
  async batchPersistStateChanges(changes) {
    try {
      const db = await this.databaseManager.getDatabase();
      
      // 按作用域分组
      const groupedChanges = {};
      changes.forEach(change => {
        if (!groupedChanges[change.scope]) {
          groupedChanges[change.scope] = [];
        }
        groupedChanges[change.scope].push(change);
      });
      
      // 批量更新每个作用域
      for (const [scope, scopeChanges] of Object.entries(groupedChanges)) {
        const stateData = {};
        scopeChanges.forEach(change => {
          stateData[change.key] = change.newValue;
        });
        
        // 更新数据库
        await db.collection('state_history').add({
          data: {
            scope,
            changes: scopeChanges,
            timestamp: new Date()
          }
        });
      }
      
    } catch (error) {
      logger.error('批量持久化状态变更失败', error);
    }
  }

  // 持久化所有状态
  async persistAllStates() {
    try {
      logger.info('开始持久化所有状态');
      
      // 持久化全局状态
      await this.persistState('global', 'global');
      
      // 持久化用户状态
      for (const userId of this.userStates.keys()) {
        await this.persistState('user', userId);
      }
      
      // 持久化页面状态
      for (const pageId of this.pageStates.keys()) {
        await this.persistState('page', pageId);
      }
      
      // 持久化组件状态
      for (const componentId of this.componentStates.keys()) {
        await this.persistState('component', componentId);
      }
      
      logger.info('所有状态持久化完成');
      
    } catch (error) {
      logger.error('持久化所有状态失败', error);
    }
  }

  // 生成监听器ID
  generateListenerId() {
    return `listener_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // 获取状态统计
  getStats() {
    return {
      globalState: this.globalState.size,
      pageStates: this.pageStates.size,
      userStates: this.userStates.size,
      componentStates: this.componentStates.size,
      listeners: this.stateListeners.size,
      history: this.stateHistory.length,
      performance: this.performanceMetrics
    };
  }

  // 健康检查
  async healthCheck() {
    const checks = {
      timestamp: new Date().toISOString(),
      states: {
        global: this.globalState.size,
        pages: this.pageStates.size,
        users: this.userStates.size,
        components: this.componentStates.size
      },
      listeners: this.stateListeners.size,
      history: this.stateHistory.length,
      performance: this.performanceMetrics,
      cache: await this.cacheManager.getStats()
    };
    
    checks.overall = checks.states.global > 0 ? 'healthy' : 'warning';
    return checks;
  }

  // 清理资源
  async cleanup() {
    logger.info('开始清理状态管理器资源');
    
    // 保存所有状态
    await this.persistAllStates();
    
    // 清空状态
    this.globalState.clear();
    this.pageStates.clear();
    this.userStates.clear();
    this.componentStates.clear();
    this.stateListeners.clear();
    this.stateHistory = [];
    
    // 清除定时器
    this.debounceTimers.forEach(timer => clearTimeout(timer));
    this.debounceTimers.clear();
    
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
    
    logger.info('状态管理器资源清理完成');
  }
}

// 单例模式
let stateManager = null;

function getStateManager() {
  if (!stateManager) {
    stateManager = new StateManager();
  }
  return stateManager;
}

module.exports = {
  StateManager,
  getStateManager
};