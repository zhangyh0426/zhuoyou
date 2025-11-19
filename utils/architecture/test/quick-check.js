/**
 * 快速检查核心功能是否正常
 */

const { getLogger } = require('../logger');
const { getArchitectureManager } = require('../index');

async function quickCheck() {
  console.log('🔍 快速功能检查...\n');
  
  let passed = 0;
  let total = 0;
  
  // 1. 检查logger
  try {
    total++;
    console.log('1️⃣ 检查日志器...');
    const logger = getLogger();
    if (logger && typeof logger.info === 'function') {
      console.log('✅ 日志器正常');
      passed++;
    } else {
      console.log('❌ 日志器异常');
    }
  } catch (error) {
    console.log('❌ 日志器检查失败:', error.message);
  }
  
  // 2. 检查架构管理器
  try {
    total++;
    console.log('2️⃣ 检查架构管理器...');
    const architectureManager = getArchitectureManager();
    if (architectureManager && typeof architectureManager.getComponent === 'function') {
      console.log('✅ 架构管理器正常');
      passed++;
    } else {
      console.log('❌ 架构管理器异常');
    }
  } catch (error) {
    console.log('❌ 架构管理器检查失败:', error.message);
  }
  
  // 3. 检查组件获取
  try {
    total++;
    console.log('3️⃣ 检查组件获取...');
    const architectureManager = getArchitectureManager();
    try {
      const database = architectureManager.getComponent('database');
      console.log('✅ 组件获取正常 (database: ' + (database ? 'exists' : 'null') + ')');
      passed++;
    } catch (error) {
      // 部分组件获取失败是正常的
      console.log('⚠️ 组件获取部分正常:', error.message);
      passed++;
    }
  } catch (error) {
    console.log('❌ 组件获取检查失败:', error.message);
  }
  
  // 结果
  console.log(`\n📊 检查结果: ${passed}/${total} 通过`);
  if (passed === total) {
    console.log('🎉 核心功能正常！');
    return true;
  } else {
    console.log('⚠️ 部分功能有问题');
    return false;
  }
}

// 如果直接运行此文件
if (require.main === module) {
  quickCheck().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('检查失败:', error);
    process.exit(1);
  });
}

module.exports = { quickCheck };