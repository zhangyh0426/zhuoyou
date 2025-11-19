/**
 * 测试模块统一导出
 * 提供测试套件和运行器的统一访问接口
 */

const ArchitectureTestSuite = require('./architecture.test');
const IntegrationTestSuite = require('./integration.test');
const TestRunner = require('./run-tests');

/**
 * 快速测试函数
 * 运行所有测试并返回结果
 */
async function runQuickTest() {
  console.log('🚀 运行快速测试...\n');
  
  const runner = new TestRunner();
  const result = await runner.runAllTests();
  
  return {
    success: result.success,
    duration: result.duration,
    summary: result.success ? '所有测试通过' : '部分测试失败',
    details: result
  };
}

/**
 * 运行特定测试套件
 */
async function runTestSuite(suiteName) {
  console.log(`📋 运行 ${suiteName} 测试套件...\n`);
  
  let testSuite;
  
  switch (suiteName.toLowerCase()) {
    case 'architecture':
    case 'unit':
      testSuite = new ArchitectureTestSuite();
      break;
    case 'integration':
    case 'integration':
      testSuite = new IntegrationTestSuite();
      break;
    default:
      throw new Error(`未知的测试套件: ${suiteName}`);
  }
  
  return await testSuite.runAllTests();
}

/**
 * 性能基准测试
 */
async function runPerformanceBenchmark() {
  console.log('⚡ 运行性能基准测试...\n');
  
  const results = {
    timestamp: new Date().toISOString(),
    benchmarks: {}
  };
  
  // 测试管理器获取性能
  console.log('📊 测试管理器获取性能...');
  const managerGetStart = Date.now();
  for (let i = 0; i < 1000; i++) {
    const { getArchitectureManager } = require('../index');
    getArchitectureManager();
  }
  results.benchmarks.managerGet = Date.now() - managerGetStart;
  
  // 测试状态管理性能
  console.log('📊 测试状态管理性能...');
  const { getStateManager } = require('../index');
  const stateManager = getStateManager();
  
  const stateSetStart = Date.now();
  for (let i = 0; i < 500; i++) {
    stateManager.setGlobalState(`bench_${i}`, { value: i });
  }
  results.benchmarks.stateSet = Date.now() - stateSetStart;
  
  const stateGetStart = Date.now();
  for (let i = 0; i < 500; i++) {
    stateManager.getGlobalState(`bench_${i}`);
  }
  results.benchmarks.stateGet = Date.now() - stateGetStart;
  
  // 测试错误处理性能
  console.log('📊 测试错误处理性能...');
  const { getErrorManager } = require('../index');
  const errorManager = getErrorManager();
  
  const errorHandleStart = Date.now();
  for (let i = 0; i < 100; i++) {
    const error = new Error(`Benchmark error ${i}`);
    error.code = `BENCH_ERROR_${i}`;
    errorManager.handleError(error, 'benchmark');
  }
  results.benchmarks.errorHandle = Date.now() - errorHandleStart;
  
  // 生成报告
  console.log('\n📈 性能基准测试结果:');
  console.log('=' .repeat(40));
  console.log(`管理器获取 (1000次): ${results.benchmarks.managerGet}ms`);
  console.log(`状态设置 (500次): ${results.benchmarks.stateSet}ms`);
  console.log(`状态获取 (500次): ${results.benchmarks.stateGet}ms`);
  console.log(`错误处理 (100次): ${results.benchmarks.errorHandle}ms`);
  console.log('=' .repeat(40));
  
  return results;
}

/**
 * 内存使用测试
 */
async function runMemoryUsageTest() {
  console.log('🧠 运行内存使用测试...\n');
  
  const initialMemory = process.memoryUsage();
  
  // 加载所有管理器
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
  
  // 获取所有管理器实例
  const managers = [
    getArchitectureManager(),
    getDatabaseManager(),
    getCloudFunctionManager(),
    getStateManager(),
    getErrorManager(),
    getPerformanceManager(),
    getCacheManager(),
    getLogger()
  ];
  
  const afterLoadMemory = process.memoryUsage();
  
  // 创建大量状态数据
  const stateManager = getStateManager();
  for (let i = 0; i < 1000; i++) {
    stateManager.setGlobalState(`memory_test_${i}`, {
      id: i,
      data: 'x'.repeat(1000), // 1KB 数据
      timestamp: Date.now(),
      metadata: { test: true, index: i }
    });
  }
  
  const afterStateMemory = process.memoryUsage();
  
  // 清理状态
  for (let i = 0; i < 1000; i++) {
    stateManager.removeGlobalState(`memory_test_${i}`);
  }
  
  // 强制垃圾回收（如果可用）
  if (global.gc) {
    global.gc();
  }
  
  const afterCleanupMemory = process.memoryUsage();
  
  // 计算内存使用
  const memoryUsage = {
    initial: initialMemory,
    afterLoad: afterLoadMemory,
    afterState: afterStateMemory,
    afterCleanup: afterCleanupMemory,
    usage: {
      loadOverhead: afterLoadMemory.heapUsed - initialMemory.heapUsed,
      stateOverhead: afterStateMemory.heapUsed - afterLoadMemory.heapUsed,
      cleanupRecovery: afterLoadMemory.heapUsed - afterCleanupMemory.heapUsed
    }
  };
  
  // 生成报告
  console.log('📊 内存使用测试结果:');
  console.log('=' .repeat(40));
  console.log(`初始内存: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
  console.log(`加载后内存: ${(afterLoadMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
  console.log(`状态数据内存: ${(afterStateMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
  console.log(`清理后内存: ${(afterCleanupMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
  console.log(`加载开销: ${(memoryUsage.usage.loadOverhead / 1024 / 1024).toFixed(2)}MB`);
  console.log(`状态开销: ${(memoryUsage.usage.stateOverhead / 1024 / 1024).toFixed(2)}MB`);
  console.log(`清理回收: ${(memoryUsage.usage.cleanupRecovery / 1024 / 1024).toFixed(2)}MB`);
  console.log('=' .repeat(40));
  
  return memoryUsage;
}

/**
 * 健康检查测试
 */
async function runHealthCheck() {
  console.log('🏥 运行健康检查测试...\n');
  
  const { getArchitectureManager } = require('../index');
  const manager = getArchitectureManager();
  
  try {
    // 执行健康检查
    const healthReport = await manager.performHealthCheck();
    
    // 验证架构完整性
    const isValid = await manager.validateArchitecture();
    
    // 检查配置一致性
    const configConsistent = await manager.validateConfigurationConsistency();
    
    const healthCheck = {
      timestamp: new Date().toISOString(),
      overallHealth: healthReport.healthy,
      architectureValid: isValid,
      configConsistent: configConsistent,
      components: healthReport.components,
      recommendations: []
    };
    
    // 生成建议
    if (!healthReport.healthy) {
      healthCheck.recommendations.push('架构存在健康问题，需要修复');
    }
    
    if (!isValid) {
      healthCheck.recommendations.push('架构验证失败，检查组件依赖');
    }
    
    if (!configConsistent) {
      healthCheck.recommendations.push('配置不一致，需要重新配置');
    }
    
    // 生成报告
    console.log('📋 健康检查报告:');
    console.log('=' .repeat(40));
    console.log(`整体健康: ${healthCheck.overallHealth ? '✅ 健康' : '❌ 不健康'}`);
    console.log(`架构有效: ${healthCheck.architectureValid ? '✅ 有效' : '❌ 无效'}`);
    console.log(`配置一致: ${healthCheck.configConsistent ? '✅ 一致' : '❌ 不一致'}`);
    
    if (healthCheck.recommendations.length > 0) {
      console.log('建议:');
      healthCheck.recommendations.forEach(rec => console.log(`  - ${rec}`));
    }
    console.log('=' .repeat(40));
    
    return healthCheck;
    
  } catch (error) {
    console.error('健康检查失败:', error);
    return {
      timestamp: new Date().toISOString(),
      overallHealth: false,
      architectureValid: false,
      configConsistent: false,
      error: error.message,
      recommendations: ['健康检查执行失败，需要调试']
    };
  }
}

// 导出所有测试功能
module.exports = {
  ArchitectureTestSuite,
  IntegrationTestSuite,
  TestRunner,
  runQuickTest,
  runTestSuite,
  runPerformanceBenchmark,
  runMemoryUsageTest,
  runHealthCheck
};

// 如果直接运行此文件，提供命令行接口
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0] || 'quick';
  
  async function runCommand() {
    try {
      switch (command) {
        case 'quick':
        case 'all':
          await runQuickTest();
          break;
          
        case 'unit':
        case 'architecture':
          await runTestSuite('architecture');
          break;
          
        case 'integration':
          await runTestSuite('integration');
          break;
          
        case 'benchmark':
        case 'performance':
          await runPerformanceBenchmark();
          break;
          
        case 'memory':
          await runMemoryUsageTest();
          break;
          
        case 'health':
          await runHealthCheck();
          break;
          
        default:
          console.log(`
🧪 架构测试工具

使用方法: node index.js [命令]

命令:
  quick, all      - 运行快速测试（默认）
  unit, architecture - 运行架构测试
  integration     - 运行集成测试
  benchmark, performance - 运行性能基准测试
  memory          - 运行内存使用测试
  health          - 运行健康检查

示例:
  node index.js quick
  node index.js benchmark
  node index.js health
          `);
      }
    } catch (error) {
      console.error('命令执行失败:', error);
      process.exit(1);
    }
  }
  
  runCommand();
}