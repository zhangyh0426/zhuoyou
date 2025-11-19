/**
 * 测试运行器
 * 统一运行所有架构测试
 */

const ArchitectureTestSuite = require('./architecture.test');
const IntegrationTestSuite = require('./integration.test');

class TestRunner {
  constructor() {
    this.results = [];
    this.startTime = Date.now();
  }

  /**
   * 运行所有测试
   */
  async runAllTests() {
    console.log('🧪 开始架构测试套件...\n');
    console.log('=' .repeat(60));
    
    try {
      // 运行架构测试
      console.log('\n📋 运行架构测试...\n');
      const architectureTestSuite = new ArchitectureTestSuite();
      const architectureResults = await architectureTestSuite.runAllTests();
      this.results.push({
        suite: 'Architecture',
        results: architectureResults
      });
      
      // 运行集成测试
      console.log('\n🔗 运行集成测试...\n');
      const integrationTestSuite = new IntegrationTestSuite();
      const integrationResults = await integrationTestSuite.runAllTests();
      this.results.push({
        suite: 'Integration',
        results: integrationResults
      });
      
      // 生成测试报告
      this.generateReport();
      
      return {
        success: this.isAllTestsPassed(),
        results: this.results,
        duration: Date.now() - this.startTime
      };
      
    } catch (error) {
      console.error('❌ 测试运行失败:', error);
      return {
        success: false,
        error: error.message,
        results: this.results,
        duration: Date.now() - this.startTime
      };
    }
  }

  /**
   * 检查是否所有测试都通过
   */
  isAllTestsPassed() {
    return this.results.every(result => result.results.success);
  }

  /**
   * 生成测试报告
   */
  generateReport() {
    console.log('\n' + '=' .repeat(60));
    console.log('📊 测试报告汇总');
    console.log('=' .repeat(60));
    
    let totalTests = 0;
    let totalPassed = 0;
    let totalFailed = 0;
    let totalDuration = 0;
    
    this.results.forEach(result => {
      const suiteResults = result.results;
      totalTests += suiteResults.totalTests;
      totalPassed += suiteResults.passedTests;
      totalFailed += suiteResults.failedTests;
      totalDuration += suiteResults.duration;
      
      console.log(`\n📋 ${result.suite} 测试:`);
      console.log(`  总测试数: ${suiteResults.totalTests}`);
      console.log(`  通过: ${suiteResults.passedTests}`);
      console.log(`  失败: ${suiteResults.failedTests}`);
      console.log(`  耗时: ${suiteResults.duration}ms`);
      console.log(`  成功率: ${suiteResults.successRate}`);
      
      if (suiteResults.failedTests > 0) {
        console.log(`  失败详情:`);
        suiteResults.results
          .filter(r => !r.success)
          .forEach(r => console.log(`    - ${r.testName}: ${r.message}`));
      }
    });
    
    console.log('\n' + '-' .repeat(40));
    console.log('📈 总体统计:');
    console.log(`  总测试数: ${totalTests}`);
    console.log(`  总通过: ${totalPassed}`);
    console.log(`  总失败: ${totalFailed}`);
    console.log(`  总耗时: ${totalDuration}ms`);
    console.log(`  总体成功率: ${((totalPassed / totalTests) * 100).toFixed(1)}%`);
    
    const overallSuccess = totalFailed === 0;
    console.log(`  测试结果: ${overallSuccess ? '✅ 全部通过' : '❌ 有失败测试'}`);
    
    console.log('\n' + '=' .repeat(60));
    
    // 生成详细报告文件
    this.generateDetailedReport();
  }

  /**
   * 生成详细报告文件
   */
  generateDetailedReport() {
    const report = {
      timestamp: new Date().toISOString(),
      duration: Date.now() - this.startTime,
      summary: {
        totalSuites: this.results.length,
        passedSuites: this.results.filter(r => r.results.success).length,
        failedSuites: this.results.filter(r => !r.results.success).length
      },
      suites: this.results.map(result => ({
        name: result.suite,
        success: result.results.success,
        totalTests: result.results.totalTests,
        passedTests: result.results.passedTests,
        failedTests: result.results.failedTests,
        duration: result.results.duration,
        successRate: result.results.successRate,
        testResults: result.results.results
      })),
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        memory: process.memoryUsage()
      }
    };
    
    // 保存报告到文件
    const fs = require('fs');
    const path = require('path');
    
    const reportPath = path.join(__dirname, 'test-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`\n📄 详细报告已保存到: ${reportPath}`);
  }
}

/**
 * 主函数
 */
async function main() {
  const runner = new TestRunner();
  
  try {
    const result = await runner.runAllTests();
    
    if (result.success) {
      console.log('\n🎉 所有测试通过！');
      process.exit(0);
    } else {
      console.log('\n💥 部分测试失败！');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('测试运行器错误:', error);
    process.exit(1);
  }
}

// 如果直接运行此文件，执行主函数
if (require.main === module) {
  main().catch(error => {
    console.error('主函数错误:', error);
    process.exit(1);
  });
}

module.exports = TestRunner;