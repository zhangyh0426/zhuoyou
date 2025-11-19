/**
 * 架构测试套件
 * 测试架构管理器的核心功能
 */

const { 
  getArchitectureManager,
  getDatabaseManager,
  getCloudFunctionManager,
  getStateManager,
  getErrorManager,
  getPerformanceManager,
  getCacheManager,
  getLogger
} = require('../index');

class ArchitectureTestSuite {
  constructor() {
    this.testResults = [];
    this.startTime = Date.now();
  }

  /**
   * 运行所有测试
   */
  async runAllTests() {
    console.log('🚀 开始架构测试套件...\n');

    try {
      // 基础测试
      await this.testArchitectureManager();
      await this.testDatabaseManager();
      await this.testCloudFunctionManager();
      await this.testStateManager();
      await this.testErrorManager();
      await this.testPerformanceManager();
      
      // 集成测试
      await this.testIntegration();
      
      // 性能测试
      await this.testPerformance();
      
      // 压力测试
      await this.testStress();

      this.printResults();
      return this.getTestSummary();
    } catch (error) {
      console.error('❌ 测试执行失败:', error);
      return {
        success: false,
        error: error.message,
        results: this.testResults
      };
    }
  }

  /**
   * 测试架构管理器
   */
  async testArchitectureManager() {
    console.log('📋 测试架构管理器...');
    
    try {
      const manager = getArchitectureManager();
      
      // 测试单例模式
      const manager2 = getArchitectureManager();
      this.assert(manager === manager2, '单例模式工作正常');
      
      // 测试初始化状态
      this.assert(manager.initialized === true, '架构管理器已初始化');
      
      // 测试组件注册
      const components = manager.getArchitectureStats();
      this.assert(components.length > 0, '核心组件已注册');
      
      // 测试健康检查
      const healthReport = await manager.performHealthCheck();
      this.assert(healthReport.healthy === true, '架构健康检查通过');
      
      this.addTestResult('ArchitectureManager', true, '所有测试通过');
    } catch (error) {
      this.addTestResult('ArchitectureManager', false, error.message);
      throw error;
    }
  }

  /**
   * 测试数据库管理器
   */
  async testDatabaseManager() {
    console.log('🗄️ 测试数据库管理器...');
    
    try {
      const dbManager = getDatabaseManager();
      
      // 测试连接状态
      const isConnected = await dbManager.isConnected();
      this.assert(typeof isConnected === 'boolean', '连接状态检查正常');
      
      // 测试连接池状态
      const poolStats = dbManager.getPoolStats();
      this.assert(poolStats && typeof poolStats === 'object', '连接池统计正常');
      
      // 测试健康检查
      const health = await dbManager.healthCheck();
      this.assert(health && typeof health === 'object', '健康检查正常');
      
      this.addTestResult('DatabaseManager', true, '所有测试通过');
    } catch (error) {
      this.addTestResult('DatabaseManager', false, error.message);
      // 不抛出错误，数据库可能未配置
      console.warn('⚠️ 数据库测试跳过:', error.message);
    }
  }

  /**
   * 测试云函数管理器
   */
  async testCloudFunctionManager() {
    console.log('☁️ 测试云函数管理器...');
    
    try {
      const cfManager = getCloudFunctionManager();
      
      // 测试函数注册
      const registeredFunctions = cfManager.getRegisteredFunctions();
      this.assert(Array.isArray(registeredFunctions), '函数注册列表正常');
      
      // 测试执行队列
      const queueStats = cfManager.getQueueStats();
      this.assert(queueStats && typeof queueStats === 'object', '执行队列统计正常');
      
      // 测试性能统计
      const performance = cfManager.getPerformanceStats();
      this.assert(performance && typeof performance === 'object', '性能统计正常');
      
      this.addTestResult('CloudFunctionManager', true, '所有测试通过');
    } catch (error) {
      this.addTestResult('CloudFunctionManager', false, error.message);
      throw error;
    }
  }

  /**
   * 测试状态管理器
   */
  async testStateManager() {
    console.log('📊 测试状态管理器...');
    
    try {
      const stateManager = getStateManager();
      
      // 测试状态设置和获取
      const testKey = 'test_key_' + Date.now();
      const testValue = { data: 'test_data' };
      
      stateManager.setGlobalState(testKey, testValue);
      const retrievedValue = stateManager.getGlobalState(testKey);
      
      this.assert(JSON.stringify(retrievedValue) === JSON.stringify(testValue), '状态存储和获取正常');
      
      // 测试状态变更记录
      const changeHistory = stateManager.getChangeHistory(testKey);
      this.assert(Array.isArray(changeHistory), '状态变更记录正常');
      
      // 测试监听器
      let listenerCalled = false;
      const unsubscribe = stateManager.subscribe(testKey, (newValue) => {
        listenerCalled = true;
      });
      
      stateManager.setGlobalState(testKey, { data: 'updated' });
      
      // 等待异步操作
      await new Promise(resolve => setTimeout(resolve, 100));
      
      this.assert(listenerCalled === true, '状态监听器工作正常');
      
      unsubscribe();
      
      this.addTestResult('StateManager', true, '所有测试通过');
    } catch (error) {
      this.addTestResult('StateManager', false, error.message);
      throw error;
    }
  }

  /**
   * 测试错误管理器
   */
  async testErrorManager() {
    console.log('⚠️ 测试错误管理器...');
    
    try {
      const errorManager = getErrorManager();
      
      // 测试错误处理
      const testError = new Error('测试错误');
      testError.code = 'TEST_ERROR';
      
      errorManager.handleError(testError, 'test-context');
      
      // 测试错误历史
      const errorHistory = errorManager.getErrorHistory();
      this.assert(Array.isArray(errorHistory), '错误历史记录正常');
      
      // 测试错误统计
      const errorStats = errorManager.getErrorStats();
      this.assert(errorStats && typeof errorStats === 'object', '错误统计正常');
      
      this.addTestResult('ErrorManager', true, '所有测试通过');
    } catch (error) {
      this.addTestResult('ErrorManager', false, error.message);
      throw error;
    }
  }

  /**
   * 测试性能管理器
   */
  async testPerformanceManager() {
    console.log('⚡ 测试性能管理器...');
    
    try {
      const perfManager = getPerformanceManager();
      
      // 测试性能监控
      const metrics = perfManager.getMetrics();
      this.assert(metrics && typeof metrics === 'object', '性能指标正常');
      
      // 测试内存管理
      const memoryInfo = perfManager.getMemoryInfo();
      this.assert(memoryInfo && typeof memoryInfo === 'object', '内存信息正常');
      
      // 测试缓存管理
      const cacheStats = perfManager.getCacheStats();
      this.assert(cacheStats && typeof cacheStats === 'object', '缓存统计正常');
      
      this.addTestResult('PerformanceManager', true, '所有测试通过');
    } catch (error) {
      this.addTestResult('PerformanceManager', false, error.message);
      throw error;
    }
  }

  /**
   * 测试集成
   */
  async testIntegration() {
    console.log('🔗 测试集成...');
    
    try {
      const manager = getArchitectureManager();
      
      // 测试架构验证
      const isValid = await manager.validateArchitecture();
      this.assert(isValid === true, '架构验证通过');
      
      // 测试配置一致性
      const configConsistent = await manager.validateConfigurationConsistency();
      this.assert(configConsistent === true, '配置一致性检查通过');
      
      // 测试组件间依赖
      const components = manager.getArchitectureStats();
      const requiredComponents = ['database', 'cloudFunction', 'state', 'error', 'performance'];
      
      for (const component of requiredComponents) {
        const exists = components.some(c => c.name === component);
        this.assert(exists, `组件 ${component} 存在`);
      }
      
      this.addTestResult('Integration', true, '所有集成测试通过');
    } catch (error) {
      this.addTestResult('Integration', false, error.message);
      throw error;
    }
  }

  /**
   * 性能测试
   */
  async testPerformance() {
    console.log('🚀 性能测试...');
    
    try {
      const iterations = 100;
      const startTime = Date.now();
      
      // 测试管理器获取性能
      for (let i = 0; i < iterations; i++) {
        getArchitectureManager();
        getDatabaseManager();
        getStateManager();
      }
      
      const endTime = Date.now();
      const avgTime = (endTime - startTime) / iterations;
      
      this.assert(avgTime < 10, `管理器获取平均时间: ${avgTime.toFixed(2)}ms`);
      
      // 测试状态管理性能
      const stateManager = getStateManager();
      const stateStartTime = Date.now();
      
      for (let i = 0; i < iterations; i++) {
        const key = `perf_test_${i}`;
        stateManager.setGlobalState(key, { data: i });
        stateManager.getGlobalState(key);
      }
      
      const stateEndTime = Date.now();
      const stateAvgTime = (stateEndTime - stateStartTime) / iterations;
      
      this.assert(stateAvgTime < 5, `状态管理平均时间: ${stateAvgTime.toFixed(2)}ms`);
      
      this.addTestResult('Performance', true, `性能测试通过 (平均时间: ${avgTime.toFixed(2)}ms)`);
    } catch (error) {
      this.addTestResult('Performance', false, error.message);
      throw error;
    }
  }

  /**
   * 压力测试
   */
  async testStress() {
    console.log('💪 压力测试...');
    
    try {
      const stateManager = getStateManager();
      const errorManager = getErrorManager();
      
      // 并发状态操作
      const promises = [];
      
      for (let i = 0; i < 50; i++) {
        promises.push(
          new Promise((resolve) => {
            setTimeout(() => {
              const key = `stress_test_${i}`;
              stateManager.setGlobalState(key, { data: i });
              resolve();
            }, Math.random() * 100);
          })
        );
      }
      
      await Promise.all(promises);
      
      // 验证所有状态都已设置
      let successCount = 0;
      for (let i = 0; i < 50; i++) {
        const key = `stress_test_${i}`;
        const value = stateManager.getGlobalState(key);
        if (value && value.data === i) {
          successCount++;
        }
      }
      
      this.assert(successCount >= 45, `并发状态操作成功率: ${successCount}/50`);
      
      // 错误处理压力测试
      for (let i = 0; i < 20; i++) {
        const error = new Error(`Stress test error ${i}`);
        error.code = `STRESS_ERROR_${i}`;
        errorManager.handleError(error, 'stress-test');
      }
      
      const errorHistory = errorManager.getErrorHistory();
      this.assert(errorHistory.length >= 20, `错误处理数量: ${errorHistory.length}`);
      
      this.addTestResult('Stress', true, '压力测试通过');
    } catch (error) {
      this.addTestResult('Stress', false, error.message);
      throw error;
    }
  }

  /**
   * 断言
   */
  assert(condition, message) {
    if (!condition) {
      throw new Error(`断言失败: ${message}`);
    }
  }

  /**
   * 添加测试结果
   */
  addTestResult(testName, success, message) {
    this.testResults.push({
      testName,
      success,
      message,
      timestamp: new Date().toISOString()
    });
    
    const status = success ? '✅' : '❌';
    console.log(`${status} ${testName}: ${message}`);
  }

  /**
   * 打印结果
   */
  printResults() {
    console.log('\n📊 测试结果汇总:');
    console.log('=' .repeat(50));
    
    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter(r => r.success).length;
    const failedTests = totalTests - passedTests;
    const duration = Date.now() - this.startTime;
    
    console.log(`总测试数: ${totalTests}`);
    console.log(`通过: ${passedTests}`);
    console.log(`失败: ${failedTests}`);
    console.log(`耗时: ${duration}ms`);
    console.log(`成功率: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
    
    if (failedTests > 0) {
      console.log('\n❌ 失败的测试:');
      this.testResults
        .filter(r => !r.success)
        .forEach(r => console.log(`  - ${r.testName}: ${r.message}`));
    }
    
    console.log('=' .repeat(50));
  }

  /**
   * 获取测试摘要
   */
  getTestSummary() {
    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter(r => r.success).length;
    const duration = Date.now() - this.startTime;
    
    return {
      success: passedTests === totalTests,
      totalTests,
      passedTests,
      failedTests: totalTests - passedTests,
      duration,
      successRate: ((passedTests / totalTests) * 100).toFixed(1) + '%',
      results: this.testResults
    };
  }
}

// 导出测试套件
module.exports = ArchitectureTestSuite;

// 如果直接运行此文件，执行测试
if (require.main === module) {
  const testSuite = new ArchitectureTestSuite();
  testSuite.runAllTests().then(result => {
    process.exit(result.success ? 0 : 1);
  }).catch(error => {
    console.error('测试执行失败:', error);
    process.exit(1);
  });
}